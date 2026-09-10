-- ─────────────────────────────────────────────────────────────────────────────
-- QR-code attendance punch. Third check-in method alongside face-scan
-- (record_face_punch) and the admin-issued override code
-- (SUPABASE_PUNCH_OVERRIDE_CODE.sql) - this one is the other way round from
-- the override code: the KIOSK mints a random, anonymous one-time code and
-- shows it as a QR, and the STAFF MEMBER's own Teacher app scans it and
-- redeems it as themselves (their employee_id is already known locally from
-- their own login - see AuthService.to.profile - the same way
-- recordCheckOut/recordFacePunch already pass employee_id explicitly rather
-- than deriving it from a Supabase Auth session; none of these Flutter apps
-- run under real Supabase Auth, they're all on the anon key).
--
-- Builds on top of SUPABASE_MULTI_SHIFT_MIGRATION.sql, already applied live:
-- employee_shifts is the real per-punch log and the source of truth for
-- "is this employee currently checked in", employee_attendance is just the
-- day-level P/A/L summary kept in sync alongside it (first-shift-in wins
-- check_in_at on conflict, status always flips to 'P'). redeem_qr_session
-- below writes both, exactly like record_face_punch/redeem_punch_code do.
--
-- Deliberately RPC-only, no direct grants on the table itself - same
-- reasoning as SUPABASE_PUNCH_OVERRIDE_CODE.sql: anon (both kiosk and
-- Teacher app) can only reach this through the three functions below, all
-- SECURITY DEFINER, so the raw table stays locked down.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kiosk_qr_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  employee_id   UUID REFERENCES employees(id),
  employee_name TEXT,
  claimed_at    TIMESTAMPTZ,
  check_in_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kiosk_qr_sessions_code ON kiosk_qr_sessions (code);

-- Supabase auto-grants full CRUD (anon=arwdDxtm) to anon/authenticated on
-- every NEW table by default - REVOKE ... FROM PUBLIC below does NOT remove
-- this (PUBLIC and named-role default grants are separate). Without this,
-- anon could write kiosk_qr_sessions directly - e.g. set employee_id/
-- claimed_at on someone else's open code, bypassing redeem_qr_session's
-- validation entirely. Same gap SUPABASE_MULTI_SHIFT_MIGRATION.sql had to
-- retroactively close for employee_shifts/employee_punch_codes - closing it
-- here from the start instead.
REVOKE ALL ON kiosk_qr_sessions FROM anon, authenticated;

-- punch_method previously allowed 'face' and 'code' on BOTH tables - 'qr'
-- marks a punch that went through this scan-to-redeem path. employee_shifts
-- is the one redeem_qr_session actually inserts into per-punch;
-- employee_attendance is the day-level summary alongside it.
ALTER TABLE employee_attendance DROP CONSTRAINT IF EXISTS employee_attendance_punch_method_check;
ALTER TABLE employee_attendance ADD CONSTRAINT employee_attendance_punch_method_check
  CHECK (punch_method IN ('face', 'code', 'qr'));
ALTER TABLE employee_shifts DROP CONSTRAINT IF EXISTS employee_shifts_punch_method_check;
ALTER TABLE employee_shifts ADD CONSTRAINT employee_shifts_punch_method_check
  CHECK (punch_method IN ('face', 'code', 'qr'));

-- Kiosk side: mint a fresh, anonymous one-time code. gen_random_uuid() (not
-- a short numeric code like the override code) since this one is only ever
-- machine-scanned, never hand-typed - length isn't a usability cost here,
-- and a wider keyspace makes guessing/replay pointless within the 60s TTL.
CREATE OR REPLACE FUNCTION generate_qr_session()
RETURNS TABLE(o_code TEXT, o_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT := gen_random_uuid()::text;
  v_now  TIMESTAMPTZ := now();
BEGIN
  RETURN QUERY
    INSERT INTO kiosk_qr_sessions (code, generated_at, expires_at)
    VALUES (v_code, v_now, v_now + interval '60 seconds')
    RETURNING kiosk_qr_sessions.code, kiosk_qr_sessions.expires_at;
END;
$$;

-- Kiosk side: polled every ~2s while the QR is on screen, to detect the
-- moment a staff member's scan claims it. Read-only. No rows back means the
-- code doesn't exist at all (shouldn't normally happen - the kiosk is
-- polling a code it just minted), which the caller treats the same as
-- "still waiting".
CREATE OR REPLACE FUNCTION check_qr_session(p_code TEXT)
RETURNS TABLE(o_claimed_at TIMESTAMPTZ, o_employee_name TEXT, o_check_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT s.claimed_at, s.employee_name, s.check_in_at
    FROM kiosk_qr_sessions s
    WHERE s.code = p_code;
END;
$$;

-- Teacher-app side: staff member scanned the kiosk's QR and is redeeming it
-- as themselves (p_employee_id comes from their own local login, not from
-- the QR - the QR only ever carries the anonymous session code). Re-checks
-- unclaimed/unexpired (the kiosk may have already regenerated a fresh code
-- if this one expired while in transit) and bounds p_check_in_at to
-- [session generated_at, now()] - same defensive range-check
-- redeem_punch_code applies, even though the Teacher app never lets the
-- user adjust this time (it always sends "now"). Then gates + records the
-- punch exactly like record_face_punch/redeem_punch_code do post-multi-shift:
-- blocked (not inserted) if employee_shifts already has an open shift for
-- this employee, 'already_in' reported instead of a silent overwrite;
-- otherwise inserts the shift row and upserts the employee_attendance
-- day-level summary alongside it.
CREATE OR REPLACE FUNCTION redeem_qr_session(p_code TEXT, p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_employee_name TEXT, o_check_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row  kiosk_qr_sessions%ROWTYPE;
  v_name TEXT;
  v_open employee_shifts%ROWTYPE;
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
    RETURN QUERY SELECT 'already_in'::text, v_name, v_open.check_in_at;
    RETURN;
  END IF;

  UPDATE kiosk_qr_sessions SET
    claimed_at = now(), employee_id = p_employee_id, employee_name = v_name, check_in_at = p_check_in_at
    WHERE id = v_row.id;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method)
    VALUES (p_employee_id, p_date, p_check_in_at, 'qr');

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method)
    VALUES (p_employee_id, p_date, 'P', p_check_in_at, 'qr')
    ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  RETURN QUERY SELECT 'checked_in'::text, v_name, p_check_in_at;
END;
$$;

-- generate_qr_session/check_qr_session/redeem_qr_session are all meant to be
-- anon-callable (kiosk and Teacher app are both on the anon key, see the
-- header comment) - unlike generate_punch_code in the override-code flow,
-- there's no admin-only step to lock down here, the kiosk itself is the one
-- minting the code. Still revoke the PUBLIC default explicitly and grant
-- back deliberately, matching SUPABASE_PUNCH_OVERRIDE_CODE.sql's convention.
REVOKE EXECUTE ON FUNCTION generate_qr_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION check_qr_session(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_qr_session(TEXT, UUID, DATE, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_qr_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_qr_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_qr_session(TEXT, UUID, DATE, TIMESTAMPTZ) TO anon, authenticated;
