-- ─────────────────────────────────────────────────────────────────────────────
-- Kiosk Settings: admin-panel-managed PIN + expected start time / grace /
-- absent cutoff, plus late-arrival tracking on every punch.
--
-- Previously the kiosk's admin PIN was set on-device on first run
-- (KioskPinService, flutter_secure_storage) with "no recovery flow by
-- design" - fine for a single kiosk, not for a school that wants the PIN
-- centrally managed/reset from the admin panel. This moves it server-side:
-- the PIN is now set from Settings -> Kiosk in the admin panel
-- (set_kiosk_admin_pin, authenticated-only) and the kiosk verifies against
-- it over the network (verify_kiosk_admin_pin, anon-callable) instead of a
-- local secret. Same bcrypt-via-pgcrypto pattern already used for
-- employees.app_password - never store or expose the raw PIN.
--
-- expected_start_time/late_grace_minutes are a single global rule (not
-- per-designation/per-employee) - simplest model, matches how the kiosk has
-- no other per-role concept today. Computed once per employee per day (only
-- the FIRST shift of the day counts as "the arrival" - a multi-shift day's
-- later punches don't get their own late/on-time judgement) and stored at
-- punch time on employee_shifts/employee_attendance, not recomputed later -
-- an attendance register shouldn't retroactively change because the admin
-- adjusted the shift time next month.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Settings table (single row, same convention as school_profile) ──────────
CREATE TABLE IF NOT EXISTS kiosk_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_pin_hash      TEXT,
  expected_start_time TIME NOT NULL DEFAULT '09:00:00',
  late_grace_minutes  INT NOT NULL DEFAULT 10 CHECK (late_grace_minutes >= 0),
  absent_cutoff_time  TIME,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO kiosk_settings (expected_start_time, late_grace_minutes)
  SELECT '09:00:00', 10 WHERE NOT EXISTS (SELECT 1 FROM kiosk_settings);

-- No direct table access at all - same idiom as kiosk_qr_sessions/
-- employee_punch_codes. Everything goes through the RPCs below, so the PIN
-- hash is never fetched by any client, not even in hashed form (a 4-6 digit
-- PIN's keyspace is small enough that even a bcrypt hash is worth
-- protecting from casual exposure).
REVOKE ALL ON kiosk_settings FROM anon, authenticated;

-- Kiosk-callable: only what's needed to compute/display late-vs-on-time and
-- to know whether a PIN has been configured yet. Never the hash.
CREATE OR REPLACE FUNCTION get_kiosk_public_settings()
RETURNS TABLE(o_expected_start_time TIME, o_late_grace_minutes INT, o_pin_is_set BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$$;

-- Admin-panel-only: full config minus the hash.
CREATE OR REPLACE FUNCTION get_kiosk_admin_settings()
RETURNS TABLE(o_expected_start_time TIME, o_late_grace_minutes INT, o_absent_cutoff_time TIME, o_pin_is_set BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, absent_cutoff_time, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION save_kiosk_settings(p_expected_start_time TIME, p_late_grace_minutes INT, p_absent_cutoff_time TIME)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    updated_at          = now();
END;
$$;

CREATE OR REPLACE FUNCTION set_kiosk_admin_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'pin_too_short';
  END IF;
  UPDATE kiosk_settings SET
    admin_pin_hash = crypt(p_pin, gen_salt('bf')),
    updated_at     = now();
END;
$$;

CREATE OR REPLACE FUNCTION verify_kiosk_admin_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT admin_pin_hash INTO v_hash FROM kiosk_settings LIMIT 1;
  IF v_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN crypt(p_pin, v_hash) = v_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_kiosk_public_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_kiosk_admin_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION save_kiosk_settings(TIME, INT, TIME) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_kiosk_admin_pin(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION verify_kiosk_admin_pin(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_kiosk_public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_kiosk_admin_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_kiosk_admin_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION save_kiosk_settings(TIME, INT, TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION set_kiosk_admin_pin(TEXT) TO authenticated;

-- ── Admin notification inbox (the Header bell was purely decorative before -
-- no table backed it at all) - late-arrival alerts land here, insert-only
-- via SECURITY DEFINER functions (the punch RPCs below), never directly
-- from any client. ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ
);
REVOKE ALL ON admin_alerts FROM anon, authenticated;
GRANT SELECT, UPDATE ON admin_alerts TO authenticated;

-- ── Late-arrival columns ──────────────────────────────────────────────────
-- Only ever set on the day's FIRST shift (see header note) - NULL on later
-- shifts of a multi-shift day, and NULL for admin-marked/leave rows that
-- never went through a punch RPC at all.
ALTER TABLE employee_shifts     ADD COLUMN IF NOT EXISTS is_late BOOLEAN;
ALTER TABLE employee_shifts     ADD COLUMN IF NOT EXISTS late_minutes INT;
ALTER TABLE employee_attendance ADD COLUMN IF NOT EXISTS is_late BOOLEAN;
ALTER TABLE employee_attendance ADD COLUMN IF NOT EXISTS late_minutes INT;
ALTER TABLE kiosk_qr_sessions   ADD COLUMN IF NOT EXISTS is_late BOOLEAN;
ALTER TABLE kiosk_qr_sessions   ADD COLUMN IF NOT EXISTS late_minutes INT;

-- ── Punch RPCs, extended with lateness ────────────────────────────────────
-- Same signatures as before (existing installed kiosk APKs keep working
-- unchanged until they update) - only the RETURNS TABLE grows two trailing
-- columns, which old callers that only read specific keys never notice.

CREATE OR REPLACE FUNCTION record_face_punch(p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_check_in_at TIMESTAMPTZ, o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_open employee_shifts%ROWTYPE;
  v_name TEXT;
  v_settings kiosk_settings%ROWTYPE;
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
    SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.expected_start_time)) / 60)::INT;
    v_is_late := v_local_time > (v_settings.expected_start_time + make_interval(mins => v_settings.late_grace_minutes));
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
  v_settings kiosk_settings%ROWTYPE;
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
    SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.expected_start_time)) / 60)::INT;
    v_is_late := v_local_time > (v_settings.expected_start_time + make_interval(mins => v_settings.late_grace_minutes));
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
  v_settings kiosk_settings%ROWTYPE;
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
    SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
    v_local_time := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.expected_start_time)) / 60)::INT;
    v_is_late := v_local_time > (v_settings.expected_start_time + make_interval(mins => v_settings.late_grace_minutes));
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

-- Kiosk poll target - now also surfaces is_late/late_minutes so the kiosk's
-- own QR success screen can show them, not just the redeeming staff app.
CREATE OR REPLACE FUNCTION check_qr_session(p_code TEXT)
RETURNS TABLE(o_claimed_at TIMESTAMPTZ, o_employee_name TEXT, o_check_in_at TIMESTAMPTZ, o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT s.claimed_at, s.employee_name, s.check_in_at, s.is_late, s.late_minutes
    FROM kiosk_qr_sessions s
    WHERE s.code = p_code;
END;
$$;

-- ── Auto-mark-absent (cutoff-based) ───────────────────────────────────────
-- Called repeatedly (every 30 min, see the admin panel's
-- /api/cron/mark-staff-absent) rather than once at a fixed time, since
-- absent_cutoff_time is admin-configurable and a Vercel cron schedule isn't.
-- No-ops until the configured cutoff has actually passed, and only fills in
-- employees with no employee_attendance row yet today (already-punched-in
-- and already-on-approved-leave employees are untouched) - safe to call as
-- often as the schedule fires.
CREATE OR REPLACE FUNCTION auto_mark_absent_staff(p_date DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings kiosk_settings%ROWTYPE;
  v_count INT;
BEGIN
  SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
  IF v_settings.absent_cutoff_time IS NULL THEN
    RETURN 0;
  END IF;
  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.absent_cutoff_time THEN
    RETURN 0;
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status)
  SELECT e.id, p_date, 'A'
  FROM employees e
  WHERE e.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = p_date
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_mark_absent_staff(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_mark_absent_staff(DATE) TO anon, authenticated;
