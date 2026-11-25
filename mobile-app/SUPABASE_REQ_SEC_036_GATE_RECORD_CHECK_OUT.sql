-- REQ-SEC-036 (2026-11-20 full-system audit): record_check_out used to
-- take only p_employee_id + a timestamp with no identity check at all -
-- unlike every sibling check-in RPC (record_face_punch, redeem_qr_session,
-- redeem_punch_code), anyone holding the public anon key and an employee
-- UUID could close their open shift at an arbitrary timestamp, even
-- mid-shift. Applied live via Supabase MCP 2026-11-20.

DROP FUNCTION IF EXISTS public.record_check_out(uuid, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.record_check_out(p_employee_id uuid, p_session_token text, p_check_out_at timestamp with time zone)
 RETURNS TABLE(o_status text, o_check_out_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_open employee_shifts%ROWTYPE;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = p_employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_open_shift'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  UPDATE employee_shifts SET check_out_at = p_check_out_at WHERE id = v_open.id;

  UPDATE employee_attendance SET check_out_at = p_check_out_at, status = 'P'
    WHERE employee_id = p_employee_id AND date = v_open.date;

  INSERT INTO teacher_alerts (teacher_id, title, message)
  VALUES (
    p_employee_id,
    'Checked Out',
    'You checked out at ' || to_char(p_check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || '.'
  );

  RETURN QUERY SELECT 'checked_out'::TEXT, p_check_out_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_check_out(uuid, text, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_check_out(uuid, text, timestamp with time zone) TO anon, authenticated, service_role;
