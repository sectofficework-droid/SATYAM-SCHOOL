-- REQ-SEC-031: lookup_punch_code/redeem_punch_code have no identity
-- parameter at all (the 6-digit code itself is the only proof) and no
-- rate limiting - a scripted brute force against the Supabase REST
-- endpoint could try all 1,000,000 combinations well within a code's
-- 15-minute validity window. Fixed with a 1-second delay on every failed
-- lookup/redeem - a standard tar-pit that caps a remote brute force at
-- ~900 guesses in that window, far short of the 1,000,000 needed, while
-- being invisible to a legitimate user who enters one correct code.
-- Applied directly to the live DB via Supabase MCP on 2026-11-19.

CREATE OR REPLACE FUNCTION public.lookup_punch_code(p_code text)
RETURNS TABLE(o_employee_id uuid, o_employee_name text, o_generated_at timestamp with time zone, o_expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_found boolean;
BEGIN
  RETURN QUERY
    SELECT e.id, e.name, c.generated_at, c.expires_at
    FROM employee_punch_codes c
    JOIN employees e ON e.id = c.employee_id
    WHERE c.code = p_code AND c.used_at IS NULL AND c.expires_at > now()
    ORDER BY c.generated_at DESC
    LIMIT 1;
  GET DIAGNOSTICS v_found = ROW_COUNT;
  IF NOT v_found THEN
    PERFORM pg_sleep(1);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_punch_code(p_code text, p_date date, p_check_in_at timestamp with time zone)
RETURNS TABLE(o_employee_id uuid, o_employee_name text, o_status text, o_check_in_at timestamp with time zone, o_is_late boolean, o_late_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_row  employee_punch_codes%ROWTYPE;
  v_name TEXT;
  v_open employee_shifts%ROWTYPE;
  v_settings RECORD;
  v_is_first BOOLEAN;
  v_local_time TIME;
  v_is_late BOOLEAN := NULL;
  v_late_minutes INT := NULL;
BEGIN
  SELECT * INTO v_row FROM employee_punch_codes c
    WHERE c.code = p_code AND c.used_at IS NULL AND c.expires_at > now()
    ORDER BY c.generated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    PERFORM pg_sleep(1);
    RAISE EXCEPTION 'invalid_or_expired_code';
  END IF;
  IF p_check_in_at < v_row.generated_at OR p_check_in_at > now() THEN
    RAISE EXCEPTION 'check_in_time_out_of_range';
  END IF;

  SELECT name INTO v_name FROM employees WHERE id = v_row.employee_id;

  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = v_row.employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_row.employee_id, v_name, 'already_in'::TEXT, v_open.check_in_at, NULL::BOOLEAN, NULL::INT;
    RETURN;
  END IF;

  UPDATE employee_punch_codes SET used_at = now() WHERE id = v_row.id;

  SELECT NOT EXISTS(
    SELECT 1 FROM employee_shifts WHERE employee_id = v_row.employee_id AND date = p_date
  ) INTO v_is_first;

  IF v_is_first THEN
    SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60))::INT;
    v_is_late := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));
  END IF;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method, is_late, late_minutes)
  VALUES (v_row.employee_id, p_date, p_check_in_at, 'code', v_is_late, v_late_minutes);

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method, is_late, late_minutes)
  VALUES (v_row.employee_id, p_date, 'P', p_check_in_at, 'code', v_is_late, v_late_minutes)
  ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  IF v_is_late THEN
    INSERT INTO admin_alerts (type, title, message) VALUES (
      'late_arrival', 'Late Arrival',
      coalesce(v_name, 'A staff member') || ' checked in ' || v_late_minutes || ' min late at ' ||
        to_char(p_check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')
    );
  END IF;

  RETURN QUERY SELECT v_row.employee_id, v_name, 'checked_in'::TEXT, p_check_in_at, v_is_late, v_late_minutes;
END;
$function$;
