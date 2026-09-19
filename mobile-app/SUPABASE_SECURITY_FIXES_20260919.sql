-- Security fixes applied live via Supabase MCP, 2026-09-19, during the
-- "fix all and close all todo" follow-up to the Staff App Unification work
-- (see governance\planning\TODO.md REQ-SEC-007/008/009 for full narrative).

-- ═══════════════════════════════════════════════════════════════════════
-- REQ-HYG-006 Phase 1.5 — previously-pending migration, applied for real
-- (see mobile-app/SUPABASE_DIAGNOSTIC_REPORTS.sql for the full file this
-- mirrors — identical content, just finally run against production).
-- ═══════════════════════════════════════════════════════════════════════
-- (See SUPABASE_DIAGNOSTIC_REPORTS.sql — applied verbatim, not repeated here.)

-- ═══════════════════════════════════════════════════════════════════════
-- REQ-SEC-007 item 3 — diagnostics read path tier gate
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_get_diagnostic_reports()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM admin_users WHERE id = auth.uid();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF v_role IN ('senior_admin', 'management') THEN
    RETURN COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (SELECT * FROM diagnostic_reports ORDER BY created_at DESC LIMIT 200) r
    ), '[]'::json);
  ELSE
    RETURN COALESCE((
      SELECT json_agg(json_build_object(
        'id', id, 'created_at', created_at, 'app', app, 'platform', platform, 'version', version,
        'user_type', user_type, 'user_name', user_name, 'description', description, 'status', status
      ))
      FROM (SELECT * FROM diagnostic_reports ORDER BY created_at DESC LIMIT 200) r
    ), '[]'::json);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_diagnostic_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_diagnostic_reports() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_diagnostic_reports() FROM anon;

-- ═══════════════════════════════════════════════════════════════════════
-- REQ-SEC-008 — Transfer Certificate issuance gating
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_issue_tc(
  p_student_id uuid, p_enrollment_id uuid, p_tc_number text, p_issue_date date,
  p_leaving_date date, p_reason text, p_conduct text, p_dues_cleared boolean,
  p_remarks text, p_file_url text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row transfer_certificates%ROWTYPE;
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO transfer_certificates (student_id, tc_number, issue_date, leaving_date, reason, conduct, dues_cleared, remarks, file_url)
  VALUES (p_student_id, p_tc_number, p_issue_date, p_leaving_date, p_reason, p_conduct, COALESCE(p_dues_cleared, false), p_remarks, p_file_url)
  RETURNING * INTO v_row;

  UPDATE students SET status = 'Left', updated_at = now() WHERE id = p_student_id;

  IF p_enrollment_id IS NOT NULL THEN
    UPDATE student_enrollments SET deactivate_reason = COALESCE(p_reason, 'TC Issued'), deactivate_date = p_leaving_date
    WHERE id = p_enrollment_id;
  END IF;

  RETURN row_to_json(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_issue_tc(uuid, uuid, text, date, date, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_issue_tc(uuid, uuid, text, date, date, text, text, boolean, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_issue_tc(uuid, uuid, text, date, date, text, text, boolean, text, text) FROM anon;

REVOKE INSERT, UPDATE ON TABLE public.transfer_certificates FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- REQ-SEC-009 — kiosk admin settings/PIN had zero role check and were
-- anon-grantable (full unauthenticated kiosk-PIN-takeover). Fixed by
-- adding is_admin_user() checks and revoking anon.
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_kiosk_admin_settings()
 RETURNS TABLE(o_expected_start_time time without time zone, o_late_grace_minutes integer, o_absent_cutoff_time time without time zone, o_pin_is_set boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, absent_cutoff_time, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_kiosk_settings(p_expected_start_time time without time zone, p_late_grace_minutes integer, p_absent_cutoff_time time without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    updated_at          = now()
  WHERE id IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_kiosk_admin_pin(p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'pin_too_short';
  END IF;
  UPDATE kiosk_settings SET
    admin_pin_hash = crypt(p_pin, gen_salt('bf')),
    updated_at     = now()
  WHERE id IS NOT NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_kiosk_admin_settings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_kiosk_settings(time, integer, time) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_kiosk_admin_pin(text) FROM anon;

-- Not fixed this pass, disclosed as REQ-SEC-010 (see TODO.md):
-- get_all_birthdays (PII exposure, folded into REQ-SEC-002 scope),
-- auto_mark_absent_staff (anon-callable, cron-load-bearing, needs a
-- service-role client change), verify_kiosk_admin_pin (brute-forceable,
-- needs rate-limit infrastructure).
