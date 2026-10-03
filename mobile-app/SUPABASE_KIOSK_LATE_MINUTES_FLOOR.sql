-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: late_minutes was computed as
--   GREATEST(0, EXTRACT(EPOCH FROM (...)) / 60)::INT
-- which ROUNDS to the nearest whole minute (Postgres numeric->int cast
-- rounds, not truncates), not the full minutes actually elapsed. That made
-- two real arrivals ~24s apart (2m51s and 3m15s late) both display "Late
-- by 3 min", reading as if they'd arrived at the same time.
--
-- Switched to FLOOR so late_minutes always reflects whole minutes elapsed
-- (2m51s -> 2, 3m15s -> 3), matching the usual "late by N min" convention.
-- is_late (boolean) is unaffected - it was always based on the raw time
-- comparison against expected_start_time + grace, never on the rounded
-- minutes.
--
-- Same four call sites as SUPABASE_KIOSK_RECOMPUTE_LATE.sql
-- (recompute_late_arrivals_for_date, record_face_punch, redeem_punch_code,
-- redeem_qr_session) - every place that computes late_minutes, all with
-- the identical one-line change (::INT -> FLOOR(...)::INT).
--
-- Applied directly to production via the Supabase MCP on 2026-10-03, then
-- recompute_late_arrivals_for_date() was re-run for today to bring
-- already-punched rows in line immediately rather than waiting for their
-- next settings-triggered recompute.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP)
-- if re-applying elsewhere - apply AFTER SUPABASE_KIOSK_RECOMPUTE_LATE.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recompute_late_arrivals_for_date(p_date DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_shift RECORD;
  v_is_late BOOLEAN;
  v_late_minutes INT;
  v_local_time TIME;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);

  FOR v_shift IN
    SELECT id, employee_id, check_in_at
    FROM employee_shifts
    WHERE date = p_date AND is_late IS NOT NULL
  LOOP
    v_local_time := (v_shift.check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60))::INT;
    v_is_late := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));

    UPDATE employee_shifts SET is_late = v_is_late, late_minutes = v_late_minutes WHERE id = v_shift.id;
    UPDATE employee_attendance SET is_late = v_is_late, late_minutes = v_late_minutes
      WHERE employee_id = v_shift.employee_id AND date = p_date;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_face_punch(p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_check_in_at TIMESTAMPTZ, o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.redeem_punch_code(p_code TEXT, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_employee_id UUID, o_employee_name TEXT, o_status TEXT, o_check_in_at TIMESTAMPTZ, o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.redeem_qr_session(p_code TEXT, p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_employee_name TEXT, o_check_in_at TIMESTAMPTZ, o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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
$$;
