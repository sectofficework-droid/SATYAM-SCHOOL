-- ─────────────────────────────────────────────────────────────────────────────
-- Face-punch override codes. Covers the case where the kiosk's face match
-- is wrong or fails outright: staff taps "Not me" / "Enter Code Instead",
-- admin looks the staff member up in the admin panel (Employee -> View ->
-- "Generate Face-Punch Code") and reads them a 6-digit numeric code valid
-- for 15 minutes. Staff types it into the kiosk, confirms their name, can
-- nudge the check-in time back (capped to no earlier than when admin
-- generated the code, and never into the future - see redeem_punch_code),
-- then punches in.
--
-- Deliberately RPC-only, no direct grants on the table itself - anon
-- (kiosk) can only reach it through lookup_punch_code/redeem_punch_code,
-- authenticated (admin panel) only through generate_punch_code. All three
-- are SECURITY DEFINER so that's enough; the raw table stays locked down.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_punch_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  code         TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_employee_punch_codes_code ON employee_punch_codes (code);

-- punch_method previously only allowed 'face' - 'code' marks a punch that
-- went through this override path instead, so admin can tell them apart
-- later if they ever need to audit attendance.
ALTER TABLE employee_attendance DROP CONSTRAINT IF EXISTS employee_attendance_punch_method_check;
ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_punch_method_check
  CHECK (punch_method IN ('face', 'code'));

-- Admin panel side: generates a fresh code for one employee.
CREATE OR REPLACE FUNCTION generate_punch_code(p_employee_id UUID)
RETURNS TABLE(code TEXT, generated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_now  TIMESTAMPTZ := now();
BEGIN
  RETURN QUERY
    INSERT INTO employee_punch_codes (employee_id, code, generated_at, expires_at)
    VALUES (p_employee_id, v_code, v_now, v_now + interval '15 minutes')
    RETURNING employee_punch_codes.code, employee_punch_codes.generated_at, employee_punch_codes.expires_at;
END;
$$;

-- Kiosk side, step 1: does this code exist/still valid? Read-only (doesn't
-- consume it) so the kiosk can show "Confirm: <name>" and set up the time
-- picker's bounds before the staff member commits to punching in. Output
-- columns are prefixed o_ - RETURNS TABLE implicitly declares each column
-- as a plpgsql variable for the function body, and "employee_id" bare would
-- collide with employee_attendance.employee_id references in
-- redeem_punch_code below (ON CONFLICT (employee_id, date) fails with an
-- ambiguous-column error otherwise).
CREATE OR REPLACE FUNCTION lookup_punch_code(p_code TEXT)
RETURNS TABLE(o_employee_id UUID, o_employee_name TEXT, o_generated_at TIMESTAMPTZ, o_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT e.id, e.name, c.generated_at, c.expires_at
    FROM employee_punch_codes c
    JOIN employees e ON e.id = c.employee_id
    WHERE c.code = p_code AND c.used_at IS NULL AND c.expires_at > now()
    ORDER BY c.generated_at DESC
    LIMIT 1;
END;
$$;

-- Kiosk side, step 2: re-validates (code could have expired/been used
-- between lookup and this call) then actually records the punch and
-- consumes the code. Same idempotent "first check-in wins" behavior as
-- recordFacePunch - if the employee already has a check_in_at today (e.g.
-- a face-scan punch went through fine after all), this does NOT overwrite
-- it; the override only fills in a check-in that's actually missing.
CREATE OR REPLACE FUNCTION redeem_punch_code(p_code TEXT, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_employee_id UUID, o_employee_name TEXT, o_check_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row employee_punch_codes%ROWTYPE;
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

  UPDATE employee_punch_codes SET used_at = now() WHERE id = v_row.id;

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method)
    VALUES (v_row.employee_id, p_date, 'P', p_check_in_at, 'code')
    ON CONFLICT (employee_id, date) DO UPDATE SET
      check_in_at  = COALESCE(employee_attendance.check_in_at, EXCLUDED.check_in_at),
      punch_method = COALESCE(employee_attendance.punch_method, EXCLUDED.punch_method),
      status       = 'P';

  RETURN QUERY
    SELECT e.id, e.name, ea.check_in_at
    FROM employees e
    JOIN employee_attendance ea ON ea.employee_id = v_row.employee_id AND ea.date = p_date
    WHERE e.id = v_row.employee_id;
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on newly created functions,
-- which anon inherits from - without this explicit revoke, the kiosk's
-- anon key (embedded in the APK, extractable by anyone) could call
-- generate_punch_code directly and mint itself a valid code for any
-- employee, skipping admin entirely. lookup/redeem are meant to be
-- anon-callable (that's the kiosk's whole job here), generate is not.
REVOKE EXECUTE ON FUNCTION generate_punch_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_punch_code(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_punch_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_punch_code(TEXT, DATE, TIMESTAMPTZ) TO anon, authenticated;
