-- REQ-SEC-033 (2026-11-20 full-system audit): staff_admin_issue_tc used
-- to only check staff_admin_tier(...) IS NOT NULL - any linked admin tier,
-- including normal_admin - a regression against the web's admin_issue_tc
-- RPC, which REQ-SEC-030 (2026-11-18) restricted to senior_admin/
-- management. Matched to that same gate. Applied live via Supabase MCP
-- 2026-11-20.

CREATE OR REPLACE FUNCTION public.staff_admin_issue_tc(p_employee_id uuid, p_session_token text, p_student_id uuid, p_enrollment_id uuid, p_tc_number text, p_issue_date date, p_leaving_date date, p_reason text, p_conduct text, p_dues_cleared boolean, p_remarks text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin', 'management') THEN
    RAISE EXCEPTION 'Only senior_admin/management can issue a Transfer Certificate';
  END IF;

  INSERT INTO transfer_certificates (student_id, tc_number, issue_date, leaving_date, reason, conduct, dues_cleared, remarks)
  VALUES (p_student_id, p_tc_number, p_issue_date, p_leaving_date, p_reason, p_conduct, COALESCE(p_dues_cleared, false), p_remarks);

  UPDATE students SET status = 'Left', updated_at = now() WHERE id = p_student_id;

  IF p_enrollment_id IS NOT NULL THEN
    UPDATE student_enrollments SET deactivate_reason = COALESCE(p_reason, 'TC Issued'), deactivate_date = p_leaving_date
    WHERE id = p_enrollment_id;
  END IF;
END;
$function$;
