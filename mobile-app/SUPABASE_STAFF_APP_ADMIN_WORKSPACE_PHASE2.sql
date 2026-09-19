-- Staff App Unification — phase 2 (full admin-web parity), 2026-09-19.
-- User feedback after seeing phase 1 on-device: "no features to view
-- student and their details" + "i want all actions done in admin web
-- should also be available in app too" (explicitly including permanent
-- delete, Users & Roles account management, Salary, and Admin Access Code
-- generation — the four items initially proposed as mobile-panel-only).
--
-- Same binding pattern as phase 1 (see SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql):
-- every RPC is SECURITY DEFINER, re-derives the caller's admin tier
-- server-side via staff_admin_tier(p_employee_id), never trusts a
-- client-supplied role. This file is a consolidated record of everything
-- applied live via Supabase MCP across ~10 migrations this round — see
-- governance\planning\STAFF-APP-UNIFICATION-PLAN.md for the narrative.
--
-- Scope note (disclosed, not silently dropped): a few genuinely
-- desktop-shaped admin-panel workflows were NOT ported 1:1 — bulk Excel
-- import (GR Book, Super-Admin bulk student tools), and PDF template
-- generation with custom visual designs (ID cards, marksheets, bonafide
-- certificates). GR Book and Reports got read/data-entry mobile screens
-- instead of their literal desktop workflow. See the plan file for the
-- full reasoning.

-- ═══════════════════════════════════════════════════════════════════════
-- Students (view/details/add/edit/permanent-delete/TC issuance)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_current_academic_year(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (SELECT row_to_json(y) FROM academic_years y WHERE is_current = true LIMIT 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_current_academic_year(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_class_list(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name) ORDER BY sort_order)
    FROM classes WHERE is_active IS NOT FALSE), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_class_list(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_section_list(p_employee_id uuid, p_class_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name) ORDER BY name)
    FROM sections WHERE class_id = p_class_id), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_section_list(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_students(p_employee_id uuid, p_search text, p_class_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_year_id uuid;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'student_id', s.id, 'enrollment_id', e.id, 'first_name', s.first_name, 'last_name', s.last_name,
      'photo_url', s.photo_url, 'grno', s.grno, 'roll_no', e.roll_no, 'status', s.status,
      'class_name', c.name, 'section_name', sec.name
    ) ORDER BY c.sort_order, sec.name, e.roll_no)
    FROM student_enrollments e
    JOIN students s ON s.id = e.student_id
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN sections sec ON sec.id = e.section_id
    WHERE e.academic_year_id = v_year_id
      AND (p_class_id IS NULL OR e.class_id = p_class_id)
      AND (p_search IS NULL OR p_search = '' OR
           s.first_name ILIKE '%'||p_search||'%' OR s.last_name ILIKE '%'||p_search||'%' OR
           s.grno ILIKE '%'||p_search||'%' OR e.enrollment_no ILIKE '%'||p_search||'%')
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_students(uuid, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_student_details(p_employee_id uuid, p_student_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT json_build_object(
      'id', s.id, 'grno', s.grno, 'first_name', s.first_name, 'last_name', s.last_name,
      'dob', s.dob, 'gender', s.gender, 'photo_url', s.photo_url,
      'father_name', s.father_name, 'mother_name', s.mother_name,
      'mobile1', s.mobile1, 'mobile2', s.mobile2, 'address', s.address,
      'religion', s.religion, 'caste', s.caste, 'status', s.status,
      'aadhar', s.aadhar, 'udise', s.udise, 'pen', s.pen, 'apaar', s.apaar,
      'enrollment', (
        SELECT json_build_object(
          'id', e.id, 'enrollment_no', e.enrollment_no, 'roll_no', e.roll_no,
          'class_name', c.name, 'section_name', sec.name, 'date_of_join', e.date_of_join,
          'fee_total', e.fee_total, 'fee_discount', e.fee_discount
        )
        FROM student_enrollments e
        LEFT JOIN classes c ON c.id = e.class_id
        LEFT JOIN sections sec ON sec.id = e.section_id
        WHERE e.student_id = s.id AND e.academic_year_id = (SELECT id FROM academic_years WHERE is_current = true LIMIT 1)
        LIMIT 1
      ),
      'fee_paid_total', (SELECT COALESCE(sum(amount), 0) FROM fee_payments WHERE student_id = s.id)
    )
    FROM students s WHERE s.id = p_student_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_details(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_student_update_basic(
  p_employee_id uuid, p_student_id uuid, p_first_name text, p_last_name text,
  p_father_name text, p_mother_name text, p_dob date, p_mobile1 text, p_mobile2 text, p_address text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE students SET
    first_name = p_first_name, last_name = COALESCE(p_last_name, ''),
    father_name = p_father_name, mother_name = p_mother_name, dob = p_dob,
    mobile1 = p_mobile1, mobile2 = p_mobile2, address = p_address, updated_at = now()
  WHERE id = p_student_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_update_basic(uuid, uuid, text, text, text, text, date, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_student_add(
  p_employee_id uuid, p_first_name text, p_last_name text, p_dob date, p_gender text,
  p_father_name text, p_mother_name text, p_mobile1 text, p_class_id uuid, p_section_id uuid, p_address text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_student students%ROWTYPE; v_year_id uuid; v_next_enr text; v_next_roll int;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;
  IF v_year_id IS NULL THEN RAISE EXCEPTION 'No current academic year set'; END IF;

  INSERT INTO students (first_name, last_name, dob, gender, father_name, mother_name, mobile1, address, status, data_status)
  VALUES (p_first_name, COALESCE(p_last_name, ''), p_dob, p_gender, p_father_name, p_mother_name, p_mobile1, p_address, 'Active', 'Complete')
  RETURNING * INTO v_student;

  SELECT lpad((COALESCE(max(enrollment_no::int), 0) + 1)::text, 4, '0') INTO v_next_enr FROM student_enrollments;
  SELECT COALESCE(max(roll_no), 0) + 1 INTO v_next_roll
    FROM student_enrollments WHERE class_id = p_class_id AND section_id = p_section_id AND academic_year_id = v_year_id;

  INSERT INTO student_enrollments (student_id, academic_year_id, enrollment_no, class_id, section_id, roll_no, date_of_join, admission_class_id)
  VALUES (v_student.id, v_year_id, v_next_enr, p_class_id, p_section_id, v_next_roll, CURRENT_DATE, p_class_id);

  RETURN json_build_object('id', v_student.id, 'enrollment_no', v_next_enr);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_add(uuid, text, text, date, text, text, text, text, uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_student_delete_permanently(p_employee_id uuid, p_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM student_promotions WHERE student_id = p_student_id;
  DELETE FROM transfer_certificates WHERE student_id = p_student_id;
  DELETE FROM fee_payments WHERE student_id = p_student_id;
  DELETE FROM students WHERE id = p_student_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_delete_permanently(uuid, uuid) TO anon, authenticated;

-- Mobile-safe from the start (unlike the admin panel's own
-- saveTransferCertificate — TODO.md REQ-SEC-008, zero role gating, still
-- open there, separately tracked).
CREATE OR REPLACE FUNCTION public.staff_admin_issue_tc(
  p_employee_id uuid, p_student_id uuid, p_enrollment_id uuid, p_tc_number text,
  p_issue_date date, p_leaving_date date, p_reason text, p_conduct text,
  p_dues_cleared boolean, p_remarks text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO transfer_certificates (student_id, tc_number, issue_date, leaving_date, reason, conduct, dues_cleared, remarks)
  VALUES (p_student_id, p_tc_number, p_issue_date, p_leaving_date, p_reason, p_conduct, COALESCE(p_dues_cleared, false), p_remarks);
  UPDATE students SET status = 'Left', updated_at = now() WHERE id = p_student_id;
  IF p_enrollment_id IS NOT NULL THEN
    UPDATE student_enrollments SET deactivate_reason = COALESCE(p_reason, 'TC Issued'), deactivate_date = p_leaving_date
    WHERE id = p_enrollment_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_issue_tc(uuid, uuid, uuid, text, date, date, text, text, boolean, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_gr_book(p_employee_id uuid, p_search text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'gr_no', gr_no, 'student_name', student_name, 'father_name', father_name,
      'admission_class', admission_class, 'date_of_admission', date_of_admission,
      'class_when_left', class_when_left, 'date_of_leaving', date_of_leaving
    ) ORDER BY gr_no)
    FROM gr_book_imports
    WHERE p_search IS NULL OR p_search = '' OR student_name ILIKE '%'||p_search||'%' OR gr_no ILIKE '%'||p_search||'%'
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_gr_book(uuid, text) TO anon, authenticated;

-- Mobile-safe mirror of create_impersonation_code (auth.uid()-gated,
-- unreachable from mobile). created_by is the caller's linked
-- admin_users.id, not auth.uid().
CREATE OR REPLACE FUNCTION public.staff_create_impersonation_code(p_employee_id uuid, p_target_type text, p_target_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid; v_admin_name TEXT; v_label TEXT; v_code TEXT; v_id UUID;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_expires TIMESTAMPTZ := now() + interval '10 minutes';
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT au.id, au.name INTO v_admin_id, v_admin_name
    FROM employees e JOIN admin_users au ON au.id = e.admin_user_id WHERE e.id = p_employee_id;

  IF p_target_type NOT IN ('student','employee') THEN RAISE EXCEPTION 'Invalid target type'; END IF;
  IF p_target_type = 'student' THEN
    SELECT first_name || ' ' || COALESCE(last_name,'') INTO v_label FROM students WHERE id = p_target_id;
  ELSE
    SELECT name INTO v_label FROM employees WHERE id = p_target_id;
  END IF;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Target not found'; END IF;

  DELETE FROM impersonation_codes
  WHERE (used_at IS NOT NULL OR expires_at < now()) AND created_at < now() - interval '1 day';

  LOOP
    v_code := (SELECT string_agg(substr(v_alphabet, (floor(random()*32)+1)::int, 1), '') FROM generate_series(1,8));
    BEGIN
      INSERT INTO impersonation_codes (code, target_type, target_id, created_by, expires_at)
      VALUES (v_code, p_target_type, p_target_id, v_admin_id, v_expires) RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
    END;
  END LOOP;

  INSERT INTO impersonation_audit_log (code_id, event_type, target_type, target_id, target_label, created_by, created_by_name)
  VALUES (v_id, 'created', p_target_type, p_target_id, v_label, v_admin_id, v_admin_name);

  RETURN json_build_object('code', v_code, 'expires_at', v_expires, 'target_label', v_label);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_create_impersonation_code(uuid, text, uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Employees (full CRUD, reset password, impersonation code)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_employees(p_employee_id uuid, p_search text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'id', id, 'emp_code', emp_code, 'name', name, 'photo_url', photo_url, 'type', type,
      'designation', designation, 'department', department, 'status', status
    ) ORDER BY emp_code)
    FROM employees
    WHERE p_search IS NULL OR p_search = '' OR name ILIKE '%'||p_search||'%' OR emp_code ILIKE '%'||p_search||'%'
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employees(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_employee_details(p_employee_id uuid, p_target_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT json_build_object(
      'id', id, 'emp_code', emp_code, 'name', name, 'photo_url', photo_url, 'type', type,
      'designation', designation, 'department', department, 'gender', gender, 'dob', dob,
      'phone', phone, 'alt_phone', alt_phone, 'email', email, 'address', address,
      'aadhar', aadhar, 'pan', pan, 'joining_date', joining_date, 'employment_type', employment_type,
      'status', status, 'monthly_salary', monthly_salary
    )
    FROM employees WHERE id = p_target_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employee_details(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_employee_add(
  p_employee_id uuid, p_emp_code text, p_name text, p_type text, p_designation text,
  p_department text, p_gender text, p_dob date, p_phone text, p_email text,
  p_address text, p_joining_date date, p_employment_type text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_row employees%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO employees (emp_code, name, type, designation, department, gender, dob, phone, email, address, joining_date, employment_type, status, monthly_salary)
  VALUES (p_emp_code, p_name, p_type, p_designation, p_department, p_gender, p_dob, p_phone, p_email, p_address, COALESCE(p_joining_date, CURRENT_DATE), COALESCE(p_employment_type, 'Permanent'), 'Active', 0)
  RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employee_add(uuid, text, text, text, text, text, text, date, text, text, text, date, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_employee_update(
  p_employee_id uuid, p_target_id uuid, p_name text, p_designation text, p_department text,
  p_phone text, p_email text, p_address text, p_status text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE employees SET name = p_name, designation = p_designation, department = p_department,
    phone = p_phone, email = p_email, address = p_address, status = COALESCE(p_status, status), updated_at = now()
  WHERE id = p_target_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employee_update(uuid, uuid, text, text, text, text, text, text, text) TO anon, authenticated;

-- Mobile-safe mirror of admin_reset_employee_password (authenticated-only).
CREATE OR REPLACE FUNCTION public.staff_admin_employee_reset_password(p_employee_id uuid, p_target_id uuid, p_new_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN RAISE EXCEPTION 'Password must be at least 6 characters'; END IF;
  UPDATE employees SET app_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO teacher_alerts (teacher_id, title, message)
  VALUES (p_target_id, 'Password Reset', 'Your app password was reset by an administrator. Please use your new password to log in.');
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_employee_reset_password(uuid, uuid, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Fees / Expenses
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_expenses(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', id, 'title', title, 'category', category, 'amount', amount,
      'expense_date', expense_date, 'paid_by', paid_by, 'note', note) ORDER BY expense_date DESC, created_at DESC)
    FROM expenses
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_expenses(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_expense_add(
  p_employee_id uuid, p_title text, p_category text, p_amount numeric, p_date date, p_paid_by text, p_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO expenses (title, category, amount, expense_date, paid_by, note) VALUES (p_title, p_category, p_amount, p_date, p_paid_by, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_expense_add(uuid, text, text, numeric, date, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_expense_delete(p_employee_id uuid, p_expense_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM expenses WHERE id = p_expense_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_expense_delete(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_fee_structures(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', fs.id, 'class_id', fs.class_id, 'class_name', c.name,
      'tuition_amount', fs.tuition_amount, 'uniform_amount', fs.uniform_amount) ORDER BY c.sort_order)
    FROM fee_structures fs JOIN classes c ON c.id = fs.class_id
    WHERE fs.academic_year_id = (SELECT id FROM academic_years WHERE is_current = true LIMIT 1)
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_fee_structures(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_fee_structure_upsert(p_employee_id uuid, p_class_id uuid, p_tuition numeric, p_uniform numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_year_id uuid;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;
  UPDATE fee_structures SET tuition_amount = p_tuition, uniform_amount = p_uniform, updated_at = now()
  WHERE class_id = p_class_id AND academic_year_id = v_year_id;
  IF NOT FOUND THEN
    INSERT INTO fee_structures (academic_year_id, class_id, tuition_amount, uniform_amount) VALUES (v_year_id, p_class_id, p_tuition, p_uniform);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_fee_structure_upsert(uuid, uuid, numeric, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_students_fees(p_employee_id uuid, p_search text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'enrollment_id', e.id, 'student_id', s.id, 'name', s.first_name || ' ' || COALESCE(s.last_name,''),
      'class_name', c.name, 'section_name', sec.name, 'roll_no', e.roll_no,
      'fee_total', e.fee_total, 'fee_discount', e.fee_discount,
      'paid', (SELECT COALESCE(sum(amount), 0) FROM fee_payments WHERE enrollment_id = e.id)
    ) ORDER BY c.sort_order, e.roll_no)
    FROM student_enrollments e JOIN students s ON s.id = e.student_id
    LEFT JOIN classes c ON c.id = e.class_id LEFT JOIN sections sec ON sec.id = e.section_id
    WHERE e.academic_year_id = (SELECT id FROM academic_years WHERE is_current = true LIMIT 1)
      AND (p_search IS NULL OR p_search = '' OR s.first_name ILIKE '%'||p_search||'%' OR s.last_name ILIKE '%'||p_search||'%')
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_students_fees(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_record_fee_payment(
  p_employee_id uuid, p_enrollment_id uuid, p_student_id uuid, p_amount numeric, p_date date, p_received_by text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO fee_payments (enrollment_id, student_id, amount, payment_date, received_by) VALUES (p_enrollment_id, p_student_id, p_amount, p_date, p_received_by);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_record_fee_payment(uuid, uuid, uuid, numeric, date, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Inventory (full item/batch CRUD, extends phase 1's usage/checkout)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_inventory_item_add(
  p_employee_id uuid, p_name text, p_category text, p_unit text, p_low_stock_at int, p_storage_address text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_row inventory_items%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO inventory_items (name, category, unit, low_stock_at, storage_address, price)
  VALUES (p_name, p_category, COALESCE(p_unit, 'Pcs'), COALESCE(p_low_stock_at, 10), p_storage_address, 0)
  RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_inventory_item_add(uuid, text, text, text, int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_inventory_item_delete(p_employee_id uuid, p_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM inventory_items WHERE id = p_item_id;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'This item is assigned to one or more students and cannot be deleted.';
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_inventory_item_delete(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_inventory_batch_add(
  p_employee_id uuid, p_item_id uuid, p_qty int, p_received_date date, p_received_by text, p_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO inventory_batches (item_id, qty, received_date, received_by, note) VALUES (p_item_id, p_qty, p_received_date, p_received_by, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_inventory_batch_add(uuid, uuid, int, date, text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Syllabus (full chapter CRUD, extends phase 1's edit-request approve/reject)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_syllabus(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', sy.id, 'class', sy.class, 'subject', sy.subject, 'chapter', sy.chapter,
      'status', sy.status, 'teacher_name', e.name, 'locked', sy.locked) ORDER BY sy.class, sy.subject, sy.sort_order)
    FROM syllabus sy LEFT JOIN employees e ON e.id = sy.teacher_id
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_syllabus_chapter_add(
  p_employee_id uuid, p_teacher_id uuid, p_class text, p_subject text, p_chapter text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_next_sort int;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(max(sort_order), 0) + 1 INTO v_next_sort FROM syllabus WHERE class = p_class AND subject = p_subject;
  INSERT INTO syllabus (teacher_id, class, subject, chapter, status, sort_order) VALUES (p_teacher_id, p_class, p_subject, p_chapter, 'Not Started', v_next_sort);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus_chapter_add(uuid, uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_syllabus_chapter_set_status(p_employee_id uuid, p_chapter_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE syllabus SET status = p_status, updated_at = now() WHERE id = p_chapter_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus_chapter_set_status(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_syllabus_chapter_delete(p_employee_id uuid, p_chapter_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM syllabus WHERE id = p_chapter_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_syllabus_chapter_delete(uuid, uuid) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Settings > Users & Roles, Super-Admin > Salary — mobile-safe mirrors of
-- admin_create_user/admin_update_user/admin_delete_user/
-- admin_get_salary_payments/admin_record_salary_payment (all auth.uid()-
-- gated, unreachable from mobile). Same tier rules exactly.
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.staff_admin_users_list(p_employee_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((SELECT json_agg(json_build_object('id', id, 'name', name, 'initials', initials, 'role', role) ORDER BY name) FROM admin_users), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_users_list(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_user_create(p_employee_id uuid, p_name text, p_initials text, p_role text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller_role text; v_row admin_users%ROWTYPE;
BEGIN
  v_caller_role := staff_admin_tier(p_employee_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('normal_admin','senior_admin','management') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can create senior_admin or management accounts';
  END IF;
  INSERT INTO admin_users (name, initials, role) VALUES (p_name, p_initials, p_role) RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_user_create(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_user_update(p_employee_id uuid, p_target_id uuid, p_name text, p_initials text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller_role text; v_target_role text; v_self_admin_id uuid;
BEGIN
  v_caller_role := staff_admin_tier(p_employee_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('normal_admin','senior_admin','management') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  SELECT admin_user_id INTO v_self_admin_id FROM employees WHERE id = p_employee_id;
  SELECT role INTO v_target_role FROM admin_users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF p_target_id = v_self_admin_id AND p_role IS DISTINCT FROM v_target_role THEN RAISE EXCEPTION 'Cannot change your own role'; END IF;
  IF v_target_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can modify a senior_admin or management account';
  END IF;
  IF p_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can promote to senior_admin or management';
  END IF;
  UPDATE admin_users SET name = p_name, initials = p_initials, role = p_role WHERE id = p_target_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_user_update(uuid, uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_user_delete(p_employee_id uuid, p_target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller_role text; v_target_role text; v_self_admin_id uuid;
BEGIN
  v_caller_role := staff_admin_tier(p_employee_id);
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT admin_user_id INTO v_self_admin_id FROM employees WHERE id = p_employee_id;
  IF p_target_id = v_self_admin_id THEN RAISE EXCEPTION 'Cannot delete your own account'; END IF;
  SELECT role INTO v_target_role FROM admin_users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'Target user not found'; END IF;
  IF v_target_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can delete a senior_admin or management account';
  END IF;
  DELETE FROM admin_users WHERE id = p_target_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_user_delete(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_salary_payments(p_employee_id uuid, p_from date, p_to date)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) <> 'management' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN COALESCE((
    SELECT json_agg(json_build_object('id', sp.id, 'employee_id', sp.employee_id, 'employee_name', e.name,
      'month', sp.month, 'amount', sp.amount, 'paid_on', sp.paid_on, 'paid_by', sp.paid_by) ORDER BY sp.month DESC)
    FROM salary_payments sp JOIN employees e ON e.id = sp.employee_id
    WHERE (p_from IS NULL OR sp.month >= p_from) AND (p_to IS NULL OR sp.month < p_to)
  ), '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_salary_payments(uuid, date, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_admin_record_salary_payment(
  p_employee_id uuid, p_target_employee_id uuid, p_month date, p_amount numeric, p_paid_on date, p_paid_by text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) <> 'management' THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO salary_payments (employee_id, month, amount, paid_on, paid_by) VALUES (p_target_employee_id, p_month, p_amount, p_paid_on, p_paid_by);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_admin_record_salary_payment(uuid, uuid, date, numeric, date, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Post-apply fix, 2026-09-19: Dart called staff_admin_student_details
-- with a p_target_id param that doesn't exist on this function (it's
-- p_student_id) — caught via on-device test on BlueStacks ("Could not
-- load student."), confirmed live via direct SQL call (worked fine
-- server-side), root-caused to the Dart/SQL param-name mismatch, fixed in
-- staff_admin_service.dart. No SQL change needed — recorded here so the
-- fix is traceable against this file's function definition above, which
-- already has the correct p_student_id signature.
