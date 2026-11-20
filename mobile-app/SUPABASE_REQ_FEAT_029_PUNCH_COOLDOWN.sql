-- REQ-FEAT-029: a suggested feature from the full-system audit - today a
-- second check-in is only blocked by "already has an open shift", so an
-- accidental check-out immediately followed by check-in (a mis-tap
-- sequence) isn't caught by anything. Adds a shared cooldown helper and
-- applies it to all 3 check-in paths (face, QR, code) right after their
-- existing open-shift check, before inserting a new shift.
--
-- Applied live via mcp__supabase__apply_migration on 2026-11-19/20.
-- This file is the tracked copy for repo history - see governance/planning/TODO.md.

CREATE OR REPLACE FUNCTION public.employee_punch_cooldown_active(p_employee_id uuid, p_check_in_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_checkout timestamptz;
BEGIN
  SELECT check_out_at INTO v_last_checkout
  FROM employee_shifts
  WHERE employee_id = p_employee_id AND check_out_at IS NOT NULL
  ORDER BY check_out_at DESC
  LIMIT 1;

  IF v_last_checkout IS NULL THEN RETURN FALSE; END IF;
  RETURN (p_check_in_at - v_last_checkout) < interval '2 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.record_face_punch(p_employee_id uuid, p_date date, p_check_in_at timestamp with time zone)
RETURNS TABLE(o_status text, o_check_in_at timestamp with time zone, o_is_late boolean, o_late_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_open employee_shifts%ROWTYPE;
  v_name TEXT;
  v_settings RECORD;
  v_is_first BOOLEAN;
  v_local_time TIME;
  v_is_late BOOLEAN := NULL;
  v_late_minutes INT := NULL;
BEGIN
  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = p_employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 'already_in'::TEXT, v_open.check_in_at, NULL::BOOLEAN, NULL::INT;
    RETURN;
  END IF;

  IF public.employee_punch_cooldown_active(p_employee_id, p_check_in_at) THEN
    RETURN QUERY SELECT 'too_soon_after_checkout'::TEXT, NULL::TIMESTAMPTZ, NULL::BOOLEAN, NULL::INT;
    RETURN;
  END IF;

  SELECT NOT EXISTS(
    SELECT 1 FROM employee_shifts WHERE employee_id = p_employee_id AND date = p_date
  ) INTO v_is_first;

  IF v_is_first THEN
    SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60))::INT;
    v_is_late := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));
  END IF;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method, is_late, late_minutes)
  VALUES (p_employee_id, p_date, p_check_in_at, 'face', v_is_late, v_late_minutes);

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method, is_late, late_minutes)
  VALUES (p_employee_id, p_date, 'P', p_check_in_at, 'face', v_is_late, v_late_minutes)
  ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  IF v_is_late THEN
    SELECT name INTO v_name FROM employees WHERE id = p_employee_id;
    INSERT INTO admin_alerts (type, title, message) VALUES (
      'late_arrival', 'Late Arrival',
      coalesce(v_name, 'A staff member') || ' checked in ' || v_late_minutes || ' min late at ' ||
        to_char(p_check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')
    );
  END IF;

  RETURN QUERY SELECT 'checked_in'::TEXT, p_check_in_at, v_is_late, v_late_minutes;
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

  IF public.employee_punch_cooldown_active(v_row.employee_id, p_check_in_at) THEN
    RETURN QUERY SELECT v_row.employee_id, v_name, 'too_soon_after_checkout'::TEXT, NULL::TIMESTAMPTZ, NULL::BOOLEAN, NULL::INT;
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

CREATE OR REPLACE FUNCTION public.redeem_qr_session(p_code text, p_employee_id uuid, p_session_token text, p_date date, p_check_in_at timestamp with time zone)
RETURNS TABLE(o_status text, o_employee_name text, o_check_in_at timestamp with time zone, o_is_late boolean, o_late_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_row  kiosk_qr_sessions%ROWTYPE;
  v_name TEXT;
  v_open employee_shifts%ROWTYPE;
  v_settings RECORD;
  v_is_first BOOLEAN;
  v_local_time TIME;
  v_is_late BOOLEAN := NULL;
  v_late_minutes INT := NULL;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_row FROM kiosk_qr_sessions s
    WHERE s.code = p_code AND s.claimed_at IS NULL AND s.expires_at > now()
    ORDER BY s.generated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_code';
  END IF;
  IF p_check_in_at < v_row.generated_at OR p_check_in_at > now() THEN
    RAISE EXCEPTION 'check_in_time_out_of_range';
  END IF;

  SELECT e.name INTO v_name FROM employees e WHERE e.id = p_employee_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'unknown_employee';
  END IF;

  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = p_employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE kiosk_qr_sessions SET
      claimed_at = now(), employee_id = p_employee_id, employee_name = v_name, check_in_at = v_open.check_in_at
      WHERE id = v_row.id;
    RETURN QUERY SELECT 'already_in'::text, v_name, v_open.check_in_at, NULL::BOOLEAN, NULL::INT;
    RETURN;
  END IF;

  IF public.employee_punch_cooldown_active(p_employee_id, p_check_in_at) THEN
    UPDATE kiosk_qr_sessions SET claimed_at = now(), employee_id = p_employee_id, employee_name = v_name WHERE id = v_row.id;
    RETURN QUERY SELECT 'too_soon_after_checkout'::text, v_name, NULL::TIMESTAMPTZ, NULL::BOOLEAN, NULL::INT;
    RETURN;
  END IF;

  SELECT NOT EXISTS(
    SELECT 1 FROM employee_shifts WHERE employee_id = p_employee_id AND date = p_date
  ) INTO v_is_first;

  IF v_is_first THEN
    SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60))::INT;
    v_is_late := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));
  END IF;

  UPDATE kiosk_qr_sessions SET
    claimed_at = now(), employee_id = p_employee_id, employee_name = v_name, check_in_at = p_check_in_at,
    is_late = v_is_late, late_minutes = v_late_minutes
    WHERE id = v_row.id;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method, is_late, late_minutes)
    VALUES (p_employee_id, p_date, p_check_in_at, 'qr', v_is_late, v_late_minutes);

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method, is_late, late_minutes)
    VALUES (p_employee_id, p_date, 'P', p_check_in_at, 'qr', v_is_late, v_late_minutes)
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  IF v_is_late THEN
    INSERT INTO admin_alerts (type, title, message) VALUES (
      'late_arrival', 'Late Arrival',
      coalesce(v_name, 'A staff member') || ' checked in ' || v_late_minutes || ' min late at ' ||
        to_char(p_check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')
    );
  END IF;

  RETURN QUERY SELECT 'checked_in'::text, v_name, p_check_in_at, v_is_late, v_late_minutes;
END;
$function$;
