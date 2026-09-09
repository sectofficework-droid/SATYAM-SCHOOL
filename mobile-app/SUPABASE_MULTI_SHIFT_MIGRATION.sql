-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-shift attendance. employee_attendance is one row per employee per
-- day - fine for a single check-in/check-out, but staff can have multiple
-- shifts in a day, and that table can't represent shift 2 without erasing
-- shift 1. employee_shifts adds a row-per-shift log underneath it;
-- employee_attendance keeps showing day-level P/A/L + first-in/last-out for
-- the views that only care about "present or not" (admin's Attendance tab,
-- payroll, etc.) - it's kept in sync by the RPCs below, not written to
-- directly by the app anymore.
--
-- Business rule (from the actual school's workflow): once punched in, a
-- second punch-in is blocked until that shift is checked out (from the
-- teacher's own app - the kiosk never checks out, same reasoning as the
-- original single-shift design: a shared login-less device shouldn't be
-- trusted to end a shift, only start one). Enforced server-side so a
-- tampered kiosk APK can't bypass it - the anon key is embedded in the
-- APK and extractable, so any rule that matters has to hold at the RPC/DB
-- level, not just in the Flutter code that happens to call it.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  date         DATE NOT NULL,
  check_in_at  TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ,
  punch_method TEXT NOT NULL DEFAULT 'face' CHECK (punch_method IN ('face', 'code')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_date ON employee_shifts (employee_id, date);

-- At most one OPEN shift per employee at a time - the actual enforcement of
-- "can't punch in twice without checking out" is in the RPCs below (which
-- give a friendly "already checked in at H:MM" response instead of a raw
-- constraint violation), this index is the backstop against a race between
-- two concurrent punch-in attempts both passing the RPC's check before
-- either INSERT commits.
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_shifts_one_open ON employee_shifts (employee_id) WHERE check_out_at IS NULL;

-- Supabase auto-grants full CRUD (anon=arwdDxtm) to anon/authenticated on
-- every NEW table via default privileges - REVOKE ... FROM PUBLIC does NOT
-- remove these (PUBLIC and named-role default grants are separate), so the
-- table comes up wide open until explicitly revoked from the named roles.
-- This silently undermined employee_punch_codes' "RPC-only" design too
-- (anon could INSERT a row directly, minting itself a valid punch code for
-- any employee) - revoking both tables here closes that gap as well.
REVOKE ALL ON employee_shifts, employee_punch_codes FROM anon, authenticated;

-- No direct grants on employee_shifts for writes - every role only ever
-- reaches it through the RPCs below, same "RPC-only" pattern as
-- employee_punch_codes. Reads go straight to the table (matches how
-- employee_attendance is already read directly elsewhere in this
-- codebase) so the UI can list a day's shifts without a bespoke fetch RPC.
--
-- Granted to BOTH anon and authenticated, not just authenticated: none of
-- the Flutter apps (kiosk, teacher, student) ever call Supabase Auth's
-- sign-in - there's no `.auth.` call anywhere in mobile-app/lib - so every
-- request from every flavor, including the teacher app's own My
-- Attendance page, runs as anon at the DB level. Only the admin panel
-- (Next.js, real Supabase Auth via @supabase/ssr) is actually
-- "authenticated". Granting authenticated-only here (as first written)
-- broke the teacher app's shift list with a silent permission-denied.
GRANT SELECT ON employee_shifts TO anon, authenticated;

-- Kiosk face-punch. Blocks (doesn't insert) if there's already an open
-- shift for this employee - o_status distinguishes 'checked_in' from
-- 'already_in' so the client can show "you're already in since H:MM,
-- check out from your app" instead of a silent no-op or a confusing
-- second "checked in" toast.
CREATE OR REPLACE FUNCTION record_face_punch(p_employee_id UUID, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_check_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_open employee_shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = p_employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 'already_in'::TEXT, v_open.check_in_at;
    RETURN;
  END IF;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method)
  VALUES (p_employee_id, p_date, p_check_in_at, 'face');

  -- Day-level summary: first shift of the day creates the row; later
  -- shifts that same day only touch status, leaving check_in_at as the
  -- day's actual first-in (see recordCheckOut below for last-out).
  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method)
  VALUES (p_employee_id, p_date, 'P', p_check_in_at, 'face')
  ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  RETURN QUERY SELECT 'checked_in'::TEXT, p_check_in_at;
END;
$$;

-- Teacher-initiated checkout (My Attendance, self-service, behind their own
-- login) - closes whichever shift is currently open for them, wherever it
-- is (not scoped to "today" - a shift opened late one day and closed after
-- midnight should still close cleanly rather than erroring on a date
-- mismatch).
CREATE OR REPLACE FUNCTION record_check_out(p_employee_id UUID, p_check_out_at TIMESTAMPTZ)
RETURNS TABLE(o_status TEXT, o_check_out_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_open employee_shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_open FROM employee_shifts
    WHERE employee_id = p_employee_id AND check_out_at IS NULL
    ORDER BY check_in_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'no_open_shift'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  UPDATE employee_shifts SET check_out_at = p_check_out_at WHERE id = v_open.id;

  -- Day-level summary's check_out_at always reflects the latest shift's
  -- checkout - unlike check_in_at (kept as first-in above), there's no
  -- "which one wins" ambiguity here, later always overwrites.
  UPDATE employee_attendance SET check_out_at = p_check_out_at, status = 'P'
    WHERE employee_id = p_employee_id AND date = v_open.date;

  RETURN QUERY SELECT 'checked_out'::TEXT, p_check_out_at;
END;
$$;

-- Punch-code fallback, updated to the same open-shift gate as
-- record_face_punch above - a code redeem is just another way of starting
-- a shift, so it has to respect the same "not while already punched in"
-- rule. The block check runs BEFORE the code gets marked used, so a
-- blocked attempt doesn't burn the code - staff can check out and redeem
-- the same code again within its validity window.
CREATE OR REPLACE FUNCTION redeem_punch_code(p_code TEXT, p_date DATE, p_check_in_at TIMESTAMPTZ)
RETURNS TABLE(o_employee_id UUID, o_employee_name TEXT, o_status TEXT, o_check_in_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row  employee_punch_codes%ROWTYPE;
  v_name TEXT;
  v_open employee_shifts%ROWTYPE;
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
    RETURN QUERY SELECT v_row.employee_id, v_name, 'already_in'::TEXT, v_open.check_in_at;
    RETURN;
  END IF;

  UPDATE employee_punch_codes SET used_at = now() WHERE id = v_row.id;

  INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method)
  VALUES (v_row.employee_id, p_date, p_check_in_at, 'code');

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method)
  VALUES (v_row.employee_id, p_date, 'P', p_check_in_at, 'code')
  ON CONFLICT (employee_id, date) DO UPDATE SET status = 'P';

  RETURN QUERY SELECT v_row.employee_id, v_name, 'checked_in'::TEXT, p_check_in_at;
END;
$$;

-- record_face_punch/record_check_out replace the kiosk's/teacher app's
-- direct employee_attendance table writes - anon no longer needs raw
-- INSERT/UPDATE/DELETE on that table (it was wide open before this, anon
-- had full CRUD - a pre-existing gap this migration happens to close as a
-- side effect of moving check-in/out server-side). authenticated keeps its
-- grants: the admin panel still writes employee_attendance directly for
-- manual P/A/L marking and leave, unrelated to shifts.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON employee_attendance FROM anon;

REVOKE EXECUTE ON FUNCTION record_face_punch(UUID, DATE, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_face_punch(UUID, DATE, TIMESTAMPTZ) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION record_check_out(UUID, TIMESTAMPTZ) FROM PUBLIC;
-- anon too, not just authenticated - see the employee_shifts grant comment
-- above, same "the teacher app is actually anon" reasoning: this is the
-- RPC behind the teacher app's own checkout button.
GRANT EXECUTE ON FUNCTION record_check_out(UUID, TIMESTAMPTZ) TO anon, authenticated;
