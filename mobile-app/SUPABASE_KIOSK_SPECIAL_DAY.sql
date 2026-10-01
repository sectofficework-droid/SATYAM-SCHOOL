-- ─────────────────────────────────────────────────────────────────────────────
-- Kiosk Special-Day Override: lets management set a one-off report time for
-- a specific future date (exam day, function, etc.) without touching the
-- permanent kiosk_settings default - the override only applies on its date
-- and there's nothing to remember to revert afterwards.
--
-- Scope decided with the project owner: one override applies to ALL staff
-- uniformly (no per-department targeting), set in advance for a specific
-- date, auto-applied that day via get_effective_kiosk_settings() and
-- auto-reverting to kiosk_settings the next day since lookups are always
-- keyed on the punch's own date.
--
-- Any column left NULL on the override row falls back to the default
-- kiosk_settings value for that field (e.g. only overriding start time
-- while keeping the usual grace/cutoff/shift-end).
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kiosk_special_day_overrides (
  date                 DATE PRIMARY KEY,
  expected_start_time  TIME,
  late_grace_minutes   INT CHECK (late_grace_minutes IS NULL OR late_grace_minutes >= 0),
  absent_cutoff_time   TIME,
  shift_end_time       TIME,
  reason               TEXT,
  created_by           UUID REFERENCES admin_users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON kiosk_special_day_overrides FROM anon, authenticated;

-- Shared by the punch RPCs and the auto-absent job: today's (or p_date's)
-- effective settings, with any special-day override merged over the
-- default row field-by-field (COALESCE per column, not whole-row swap).
CREATE OR REPLACE FUNCTION get_effective_kiosk_settings(p_date DATE)
RETURNS TABLE(o_expected_start_time TIME, o_late_grace_minutes INT, o_absent_cutoff_time TIME, o_shift_end_time TIME)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_default kiosk_settings%ROWTYPE;
  v_override kiosk_special_day_overrides%ROWTYPE;
BEGIN
  SELECT * INTO v_default FROM kiosk_settings LIMIT 1;
  SELECT * INTO v_override FROM kiosk_special_day_overrides WHERE date = p_date;

  RETURN QUERY SELECT
    COALESCE(v_override.expected_start_time, v_default.expected_start_time),
    COALESCE(v_override.late_grace_minutes,  v_default.late_grace_minutes),
    COALESCE(v_override.absent_cutoff_time,  v_default.absent_cutoff_time),
    COALESCE(v_override.shift_end_time,      v_default.shift_end_time);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_effective_kiosk_settings(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_effective_kiosk_settings(DATE) TO anon, authenticated;

-- ── Admin-panel CRUD ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION save_kiosk_special_day(
  p_date TEXT,
  p_expected_start_time TIME,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME,
  p_shift_end_time TIME,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_date::DATE < (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'special_day_in_past';
  END IF;

  INSERT INTO kiosk_special_day_overrides
    (date, expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, reason, created_by)
  VALUES
    (p_date::DATE, p_expected_start_time,
     CASE WHEN p_late_grace_minutes IS NULL THEN NULL ELSE GREATEST(p_late_grace_minutes, 0) END,
     p_absent_cutoff_time, p_shift_end_time, p_reason, auth.uid())
  ON CONFLICT (date) DO UPDATE SET
    expected_start_time = EXCLUDED.expected_start_time,
    late_grace_minutes  = EXCLUDED.late_grace_minutes,
    absent_cutoff_time  = EXCLUDED.absent_cutoff_time,
    shift_end_time      = EXCLUDED.shift_end_time,
    reason               = EXCLUDED.reason,
    updated_at           = now();
END;
$$;

CREATE OR REPLACE FUNCTION delete_kiosk_special_day(p_date TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM kiosk_special_day_overrides WHERE date = p_date::DATE;
END;
$$;

-- Upcoming + today's overrides for the admin panel list view.
CREATE OR REPLACE FUNCTION list_kiosk_special_days()
RETURNS TABLE(
  o_date DATE, o_expected_start_time TIME, o_late_grace_minutes INT,
  o_absent_cutoff_time TIME, o_shift_end_time TIME, o_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT date, expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, reason
    FROM kiosk_special_day_overrides
    WHERE date >= (now() AT TIME ZONE 'Asia/Kolkata')::DATE
    ORDER BY date ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION save_kiosk_special_day(TEXT, TIME, INT, TIME, TIME, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION delete_kiosk_special_day(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION list_kiosk_special_days() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION save_kiosk_special_day(TEXT, TIME, INT, TIME, TIME, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_kiosk_special_day(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_kiosk_special_days() TO authenticated;

-- ── Wire the override into the three punch RPCs ──────────────────────────
-- Same bodies as SUPABASE_KIOSK_SETTINGS.sql, just reading lateness config
-- via get_effective_kiosk_settings(p_date) instead of kiosk_settings
-- directly, so a special day's start time/grace applies to that date's
-- first-punch lateness judgement.

CREATE OR REPLACE FUNCTION record_face_punch(p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
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
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
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

CREATE OR REPLACE FUNCTION redeem_punch_code(p_code TEXT, p_date DATE, p_check_in_at TIMESTAMPTZ)
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
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
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

CREATE OR REPLACE FUNCTION redeem_qr_session(p_code TEXT, p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
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
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
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

-- ── Wire the override into the auto-absent job's cutoff check ────────────
-- Keeps the current live signature (p_date, p_secret) and cron_secrets
-- guard exactly as deployed - only the cutoff source changes, from the
-- default kiosk_settings row to the effective (possibly overridden) one.
CREATE OR REPLACE FUNCTION auto_mark_absent_staff(p_date DATE, p_secret TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_settings RECORD;
  v_count INT;
  v_hash TEXT;
BEGIN
  SELECT secret_hash INTO v_hash FROM cron_secrets WHERE name = 'mark_staff_absent';
  IF v_hash IS NULL OR p_secret IS NULL OR crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
  IF v_settings.o_absent_cutoff_time IS NULL THEN
    RETURN 0;
  END IF;
  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.o_absent_cutoff_time THEN
    RETURN 0;
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status)
  SELECT e.id, p_date, 'A'
  FROM employees e
  WHERE e.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = p_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance_sync_exclusions x WHERE x.employee_id = e.id AND x.date = p_date
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
