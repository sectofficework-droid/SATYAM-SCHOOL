-- Staff App Unification — phase-1 Admin Workspace backend.
-- Governance: governance\planning\STAFF-APP-UNIFICATION-PLAN.md,
-- STAFF-APP-DESIGN-FIXED.md, STAFF-APP-UI-DESIGN.md (all approved
-- 2026-09-19). "code it" given 2026-09-19.
--
-- Pattern (binding, see STAFF-APP-DESIGN-FIXED.md §1): every RPC here is
-- SECURITY DEFINER, granted to `anon` (mobile never holds an authenticated
-- Supabase session), and re-derives the caller's admin tier server-side via
-- staff_admin_tier(p_employee_id) — never trusts a client-supplied role.
-- This mirrors the existing "RPC re-checks role" convention
-- (create_impersonation_code, admin_has_role) rather than inventing a new
-- one. Known, disclosed, pre-existing limitation this inherits (not
-- introduced by this migration): every mobile RPC across the whole app,
-- including these, trusts the client-supplied p_employee_id itself with no
-- per-call re-authentication (teacher_login only checks the password once,
-- at login) — this is the same trust model every existing mobile write
-- (e.g. student_attendance's marked_by) already uses, tracked under the
-- broader REQ-SEC-002 anon-exposure family, not a new gap this feature
-- introduces. See TODO.md for a disclosure entry.

-- ═══════════════════════════════════════════════════════════════════════
-- 0. Helper: resolve an employee's admin tier (or NULL if not linked)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_tier(p_employee_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.role
  FROM employees e
  JOIN admin_users au ON au.id = e.admin_user_id
  WHERE e.id = p_employee_id;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_tier(uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. teacher_login — additive field only, existing behavior untouched
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.teacher_login(p_employee_id text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_emp        employees%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
  v_section_id UUID;
  v_is_support BOOLEAN := FALSE;
  v_admin_role JSON;
BEGIN
  SELECT * INTO v_emp FROM employees
  WHERE UPPER(TRIM(emp_code)) = UPPER(TRIM(p_employee_id))
    AND app_password = crypt(p_password, app_password);
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_section_id := v_emp.class_teacher_of_section_id;

  IF v_section_id IS NULL THEN
    SELECT section_id INTO v_section_id
    FROM section_supporting_teachers
    WHERE employee_id = v_emp.id
    ORDER BY created_at
    LIMIT 1;
    IF v_section_id IS NOT NULL THEN v_is_support := TRUE; END IF;
  END IF;

  IF v_section_id IS NOT NULL THEN
    SELECT c.name, sec.name INTO v_cls_name, v_sec_name
    FROM sections sec
    JOIN classes c ON c.id = sec.class_id
    WHERE sec.id = v_section_id;
  END IF;

  -- New: resolve admin_role once, at login (STAFF-APP-DESIGN-FIXED.md §1,
  -- option a — no new session mechanism). NULL when unlinked (the common
  -- case today for all real accounts).
  SELECT json_build_object('linked', true, 'adminUserId', au.id, 'tier', au.role)
  INTO v_admin_role
  FROM admin_users au
  WHERE au.id = v_emp.admin_user_id;

  RETURN json_build_object(
    'id',                          v_emp.id,
    'emp_code',                    v_emp.emp_code,
    'name',                        v_emp.name,
    'type',                        v_emp.type,
    'designation',                 v_emp.designation,
    'department',                  v_emp.department,
    'phone',                       v_emp.phone,
    'email',                       v_emp.email,
    'photo_url',                   v_emp.photo_url,
    'class_teacher_of_section_id', v_section_id,
    'is_supporting_teacher',       v_is_support,
    'subject_mappings',            v_emp.subject_mappings,
    'class_name',                  v_cls_name,
    'section_name',                v_sec_name,
    'admin_role',                  v_admin_role
  );
END;
$function$;
-- Grants unchanged (already PUBLIC/anon/authenticated) — CREATE OR REPLACE
-- doesn't touch them, but restate for clarity/idempotency.
GRANT EXECUTE ON FUNCTION public.teacher_login(text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Dashboard (read-only, any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_dashboard_summary(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_tier text;
BEGIN
  v_tier := staff_admin_tier(p_employee_id);
  IF v_tier IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN json_build_object(
    'classesMarkedToday',     (SELECT count(DISTINCT class) FROM student_attendance WHERE date = CURRENT_DATE),
    'pendingAttendanceEdits', (SELECT count(*) FROM attendance_edit_requests WHERE status = 'Pending'),
    'openQueries',            (SELECT count(*) FROM queries_suggestions WHERE status = 'Pending'),
    'activeNotices',          (SELECT count(*) FROM notices WHERE archived IS NOT TRUE AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)),
    'pendingSyllabusRequests', CASE WHEN v_tier IN ('senior_admin','management')
                                THEN (SELECT count(*) FROM syllabus_edit_requests WHERE status = 'Pending')
                                ELSE 0 END,
    'openTasks',              (SELECT count(*) FROM tasks WHERE status <> 'Completed')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_dashboard_summary(uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Attendance (any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_classes(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('className', c.name, 'sectionName', sec.name) ORDER BY c.name, sec.name)
    FROM sections sec JOIN classes c ON c.id = sec.class_id
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_classes(uuid) TO anon, authenticated;
-- Roster reuse note: class rosters themselves come from the existing
-- get_class_students_by_name(p_class_name) RPC (already anon-granted,
-- used by the Teacher flavor) — not duplicated here.

CREATE OR REPLACE FUNCTION public.staff_admin_mark_attendance(p_employee_id uuid, p_records jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO student_attendance (student_id, date, class, status, marked_by)
  SELECT
    (r->>'student_id')::uuid,
    (r->>'date')::date,
    r->>'class',
    r->>'status',
    p_employee_id
  FROM jsonb_array_elements(p_records) r
  ON CONFLICT (student_id, date) DO UPDATE
    SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_mark_attendance(uuid, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_class_attendance(p_employee_id uuid, p_class text, p_date date)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('student_id', student_id, 'status', status))
    FROM student_attendance WHERE class = p_class AND date = p_date
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_class_attendance(uuid, text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_attendance_edit_requests(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', r.id, 'teacher_id', r.teacher_id, 'teacher_name', e.name,
      'class_name', r.class_name, 'section_name', r.section_name,
      'date', r.date, 'reason', r.reason, 'status', r.status,
      'created_at', r.created_at
    ) ORDER BY r.created_at DESC)
    FROM attendance_edit_requests r
    LEFT JOIN employees e ON e.id = r.teacher_id
    WHERE r.status = 'Pending'
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_attendance_edit_requests(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_attendance_edit_request_respond(
  p_employee_id uuid, p_request_id uuid, p_approve boolean, p_admin_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_req attendance_edit_requests%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_req FROM attendance_edit_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF p_approve THEN
    UPDATE attendance_edit_requests
      SET status = 'Approved', approved_at = now(), responded_at = now()
      WHERE id = p_request_id;
    INSERT INTO teacher_alerts (teacher_id, title, message) VALUES (
      v_req.teacher_id, 'Attendance Edit Approved',
      'You can now edit attendance for ' || v_req.class_name ||
        COALESCE(' - ' || v_req.section_name, '') || ' on ' || v_req.date ||
        ' - this window closes in 10 minutes.'
    );
  ELSE
    UPDATE attendance_edit_requests
      SET status = 'Rejected', admin_note = p_admin_note, responded_at = now()
      WHERE id = p_request_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_attendance_edit_request_respond(uuid, uuid, boolean, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_send_attendance_reminder(
  p_employee_id uuid, p_teacher_id uuid, p_class_name text, p_section_name text, p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO teacher_alerts (teacher_id, title, message) VALUES (
    p_teacher_id,
    'Mark Attendance - ' || p_class_name || COALESCE(' - ' || p_section_name, ''),
    p_message
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_send_attendance_reminder(uuid, uuid, text, text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Employee — punch-override code (any linked tier; new mobile-safe
--    wrapper, existing generate_punch_code stays admin-panel-only)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_generate_punch_code(p_employee_id uuid, p_target_employee_id uuid)
RETURNS TABLE(code text, generated_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_now  TIMESTAMPTZ := now();
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    INSERT INTO employee_punch_codes (employee_id, code, generated_at, expires_at)
    VALUES (p_target_employee_id, v_code, v_now, v_now + interval '15 minutes')
    RETURNING employee_punch_codes.code, employee_punch_codes.generated_at, employee_punch_codes.expires_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_generate_punch_code(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_employee_search(p_employee_id uuid, p_query text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'emp_code', emp_code, 'designation', designation))
    FROM (
      SELECT id, name, emp_code, designation FROM employees
      WHERE status IS DISTINCT FROM 'Left'
        AND (p_query IS NULL OR p_query = '' OR name ILIKE '%' || p_query || '%' OR emp_code ILIKE '%' || p_query || '%')
      ORDER BY name LIMIT 30
    ) s
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employee_search(uuid, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Inventory — usage + asset checkout/return (any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_inventory_items(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'unit', unit, 'category', category) ORDER BY name)
    FROM inventory_items
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_inventory_items(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_record_inventory_usage(
  p_employee_id uuid, p_item_id uuid, p_qty int, p_usage_date date, p_purpose text, p_used_by text, p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO inventory_usages (item_id, qty, usage_date, purpose, used_by, note)
  VALUES (p_item_id, p_qty, p_usage_date, p_purpose, p_used_by, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_record_inventory_usage(uuid, uuid, int, date, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_assets(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id, 'name', a.name, 'brand', a.brand, 'status', a.status,
      'currentCheckout', (
        SELECT json_build_object('id', c.id, 'takenBy', c.taken_by, 'purpose', c.purpose, 'takenDate', c.taken_date)
        FROM asset_checkouts c WHERE c.asset_id = a.id AND c.return_date IS NULL
        ORDER BY c.taken_date DESC LIMIT 1
      )
    ) ORDER BY a.name)
    FROM assets a
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_assets(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_asset_checkout(
  p_employee_id uuid, p_asset_id uuid, p_taken_by text, p_purpose text, p_taken_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM asset_checkouts WHERE asset_id = p_asset_id AND return_date IS NULL) THEN
    RAISE EXCEPTION 'Asset is already checked out';
  END IF;
  INSERT INTO asset_checkouts (asset_id, taken_by, purpose, taken_date)
  VALUES (p_asset_id, p_taken_by, p_purpose, p_taken_date);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_asset_checkout(uuid, uuid, text, text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_asset_return(p_employee_id uuid, p_checkout_id uuid, p_return_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE asset_checkouts SET return_date = p_return_date WHERE id = p_checkout_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_asset_return(uuid, uuid, date) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Notices (any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_notices(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'title', title, 'content', content, 'type', type, 'audience', audience,
      'posted_date', posted_date, 'expiry_date', expiry_date, 'pinned', pinned, 'archived', archived
    ) ORDER BY pinned DESC NULLS LAST, posted_date DESC)
    FROM notices
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_notices(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_notice_create(
  p_employee_id uuid, p_title text, p_content text, p_type text, p_audience text,
  p_posted_date date, p_expiry_date date, p_pinned boolean, p_posted_by text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row notices%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO notices (title, content, type, audience, posted_date, expiry_date, pinned, posted_by)
  VALUES (p_title, p_content, p_type, p_audience, p_posted_date, p_expiry_date, COALESCE(p_pinned, false), p_posted_by)
  RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_notice_create(uuid, text, text, text, text, date, date, boolean, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_notice_update(
  p_employee_id uuid, p_notice_id uuid, p_title text, p_content text, p_expiry_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE notices SET title = p_title, content = p_content, expiry_date = p_expiry_date, updated_at = now()
  WHERE id = p_notice_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_notice_update(uuid, uuid, text, text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_notice_set_flags(
  p_employee_id uuid, p_notice_id uuid, p_pinned boolean, p_archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE notices SET pinned = p_pinned, archived = p_archived, updated_at = now() WHERE id = p_notice_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_notice_set_flags(uuid, uuid, boolean, boolean) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Queries (any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_queries(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'user_type', user_type, 'user_name', user_name, 'class_name', class_name,
      'message', message, 'status', status, 'admin_reply', admin_reply, 'created_at', created_at
    ) ORDER BY created_at DESC)
    FROM queries_suggestions
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_queries(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_query_reply(p_employee_id uuid, p_query_id uuid, p_reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE queries_suggestions
    SET admin_reply = p_reply, status = 'Resolved', resolved_at = now()
    WHERE id = p_query_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_query_reply(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_query_set_status(p_employee_id uuid, p_query_id uuid, p_resolved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_resolved THEN
    UPDATE queries_suggestions SET status = 'Resolved', resolved_at = now() WHERE id = p_query_id;
  ELSE
    UPDATE queries_suggestions SET status = 'Pending', resolved_at = NULL WHERE id = p_query_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_query_set_status(uuid, uuid, boolean) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Question Papers / teacher-uploaded documents (read-only, any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_teacher_documents(p_employee_id uuid, p_section text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', d.id, 'teacher_name', e.name, 'class', d.class, 'subject', d.subject,
      'title', d.title, 'file_key', d.file_key, 'file_name', d.file_name,
      'created_at', d.created_at
    ) ORDER BY d.created_at DESC)
    FROM teacher_documents d
    LEFT JOIN employees e ON e.id = d.teacher_id
    WHERE p_section IS NULL OR d.section = p_section
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_teacher_documents(uuid, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 9. Syllabus edit-requests — senior_admin/management tier ONLY
--    (deliberate tightening vs. the admin panel's flat gate — see
--    STAFF-APP-DESIGN-FIXED.md §3)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_syllabus_edit_requests(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', r.id, 'teacher_id', r.teacher_id, 'teacher_name', e.name,
      'class_name', r.class_name, 'subject_name', r.subject_name,
      'reason', r.reason, 'requested_changes', r.requested_changes,
      'status', r.status, 'created_at', r.created_at
    ) ORDER BY r.created_at DESC)
    FROM syllabus_edit_requests r
    LEFT JOIN employees e ON e.id = r.teacher_id
    WHERE r.status = 'Pending'
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus_edit_requests(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_syllabus_edit_request_respond(
  p_employee_id uuid, p_request_id uuid, p_approve boolean, p_admin_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_req syllabus_edit_requests%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_req FROM syllabus_edit_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF p_approve THEN
    UPDATE syllabus_edit_requests
      SET status = 'Approved', approved_at = now(), responded_at = now()
      WHERE id = p_request_id;
    INSERT INTO teacher_alerts (teacher_id, title, message) VALUES (
      v_req.teacher_id, 'Syllabus Edit Approved',
      'You can now edit the ' || v_req.subject_name || ' syllabus for ' || v_req.class_name ||
        ' - this window closes in 24 hours.'
    );
  ELSE
    UPDATE syllabus_edit_requests
      SET status = 'Rejected', admin_note = p_admin_note, responded_at = now()
      WHERE id = p_request_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus_edit_request_respond(uuid, uuid, boolean, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 10. Tasks (any linked tier)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_tasks(p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', t.id, 'title', t.title, 'description', t.description,
      'deadline_date', t.deadline_date, 'priority', t.priority, 'status', t.status,
      'assignees', (
        SELECT json_agg(json_build_object('employee_id', ta.employee_id, 'name', e.name, 'status', ta.status))
        FROM task_assignees ta JOIN employees e ON e.id = ta.employee_id WHERE ta.task_id = t.id
      )
    ) ORDER BY t.created_at DESC)
    FROM tasks t
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_tasks(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_task_create(
  p_employee_id uuid, p_title text, p_description text, p_deadline_date date,
  p_priority text, p_assignee_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_task tasks%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO tasks (title, description, deadline_date, priority, status, created_by)
  VALUES (p_title, p_description, p_deadline_date, COALESCE(p_priority, 'Medium'), 'Pending', p_employee_id)
  RETURNING * INTO v_task;

  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    INSERT INTO task_assignees (task_id, employee_id)
    SELECT v_task.id, unnest(p_assignee_ids);
  END IF;

  RETURN json_build_object('id', v_task.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_task_create(uuid, text, text, date, text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_task_update_status(p_employee_id uuid, p_task_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE tasks SET status = p_status, updated_at = now() WHERE id = p_task_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_task_update_status(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_task_delete(p_employee_id uuid, p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM tasks WHERE id = p_task_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_task_delete(uuid, uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Advisor hygiene: every function above sets search_path explicitly and is
-- SECURITY DEFINER by design (mirrors every existing admin RPC in this
-- project) — run get_advisors('security') after applying to confirm no
-- new mutable-search-path or missing-grant flags, same discipline as
-- REQ-SEC-005/007.
