-- REQ-SEC-030: admin_issue_tc only checked is_admin_user() (any admin
-- tier) - any normal_admin could issue a Transfer Certificate (a legally
-- significant document) and deactivate a student, with the same access
-- as marking attendance. No UI role gate either (student/[id]/tc/page.js
-- had none). Restricted to senior_admin/management, matching this
-- project's existing pattern for similarly significant actions
-- (admin_delete_student_permanently, REQ-SEC-005's admin_users RPCs).
-- Applied directly to the live DB via Supabase MCP on 2026-11-18.

CREATE OR REPLACE FUNCTION public.admin_issue_tc(
  p_student_id uuid, p_enrollment_id uuid, p_tc_number text, p_issue_date date,
  p_leaving_date date, p_reason text, p_conduct text, p_dues_cleared boolean,
  p_remarks text, p_file_url text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row transfer_certificates%ROWTYPE;
  v_role text;
BEGIN
  SELECT role INTO v_role FROM admin_users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('senior_admin', 'management') THEN
    RAISE EXCEPTION 'Only senior_admin/management can issue a Transfer Certificate';
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
$function$;
