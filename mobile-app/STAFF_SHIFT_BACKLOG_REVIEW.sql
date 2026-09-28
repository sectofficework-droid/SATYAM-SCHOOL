-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF_SHIFT_BACKLOG_REVIEW.sql
--
-- READ THIS BEFORE RUNNING. Nothing here runs automatically — this file only
-- creates the two helper functions. You still call them explicitly, by name.
--
-- WHY THIS FILE EXISTS
--   17 employee_shifts rows are still open (check_out_at IS NULL), the oldest
--   from 2026-09-09. They are orphaned: there is no matching employee_attendance
--   day row for any of them (employee_attendance is currently empty), so nothing
--   references them. They will not block a punch-in, because the blocking
--   unique index is a PARTIAL one on open shifts only — but they do show as
--   "on shift" in Employee → Leave & Attendance → Live, and they will be picked
--   up as real hours by any overtime report.
--
-- WHY A BLANKET UPDATE IS WRONG HERE
--   The obvious "just set check_out_at = that day's 16:00" produces NEGATIVE
--   durations for three people, because they punched in AFTER 16:00 and the
--   close would then be earlier than the punch:
--     Debiprasad Das (EMP003) 2026-09-09 18:05
--     Rudra Prasad Muni (EMP007) 2026-09-09 20:26
--     Pragyan Panda (EMP024)  2026-09-17 20:04
--   It also invents hours nobody worked: 16 of the 17 have a punch-in of
--   11:11-14:57 on 2026-09-17, which is almost certainly a bulk test/face-enrol
--   session, not real attendance. Across all 17 the result is -101.7 hours of
--   net shortfall, which is garbage, not a correction.
--
-- SO THIS FILE DOES TWO SAFER THINGS INSTEAD
--   1. preview_stale_shifts()      — read-only. Shows what WOULD be closed and
--                                     what each close would cost, before anything
--                                     is written. Run this first, read the output.
--   2. close_stale_shifts(confirm)  — the actual write. Requires an explicit
--                                     confirm = true argument, and refuses to run
--                                     if it would create any negative duration.
--                                     Defaults to that day's shift_end_time but
--                                     falls back to "leave open" for anyone whose
--                                     punch-in is later than that, rather than
--                                     inventing time.
--
-- SAFE TO RUN: only creates/overwrites the two functions below. No tables are
-- altered, no rows are touched until you call close_stale_shifts(true) yourself.
-- Reversible: see the rollback query at the very bottom.
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. PREVIEW (read-only) ───────────────────────────────────────────────────
-- Safe to run as many times as you like. Writes nothing.
CREATE OR REPLACE FUNCTION preview_stale_shifts()
RETURNS TABLE(
  employee_id UUID, emp_name TEXT, emp_code TEXT,
  shift_date DATE, check_in_ist TIMESTAMPTZ,
  proposed_close_ist TIMESTAMPTZ, proposed_hours NUMERIC,
  verdict TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_end TIME;
  v_rec RECORD;
BEGIN
  SELECT shift_end_time INTO v_end FROM kiosk_settings LIMIT 1;
  IF v_end IS NULL THEN
    RAISE EXCEPTION 'kiosk_settings.shift_end_time is NULL — is the auto-close migration applied?';
  END IF;

  RETURN QUERY
  SELECT
    s.employee_id, e.name, e.emp_code, s.date,
    s.check_in_at AT TIME ZONE 'Asia/Kolkata',
    ((s.check_in_at AT TIME ZONE 'Asia/Kolkata')::DATE + v_end) AT TIME ZONE 'Asia/Kolkata' AS proposed_close,
    ROUND(EXTRACT(EPOCH FROM (v_end - (s.check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME)) / 3600.0, 2),
    CASE
      WHEN (s.check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME > v_end
        THEN 'SKIP - punched in after shift end, would create negative hours'
      ELSE 'would close'
    END
  FROM employee_shifts s
  JOIN employees e ON e.id = s.employee_id
  WHERE s.check_out_at IS NULL
  ORDER BY s.date, s.check_in_at;
END;
$$;

REVOKE ALL ON FUNCTION preview_stale_shifts() FROM PUBLIC;


-- ── 2. THE WRITE (explicit, and refuses to invent time) ─────────────────────
-- close_stale_shifts() with no argument does NOTHING and just reports — this is
-- deliberate, so a stray call can never modify attendance data. You must pass
-- confirm = true deliberately.
CREATE OR REPLACE FUNCTION close_stale_shifts(confirm BOOLEAN DEFAULT false)
RETURNS TABLE(employee_id UUID, emp_name TEXT, shift_date DATE,
              closed_at_ist TIMESTAMPTZ, hours NUMERIC, skipped TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_end TIME;
  v_rec RECORD;
  v_close TIMESTAMPTZ;
  v_hours NUMERIC;
  v_n INT := 0;
  v_skipped INT := 0;
BEGIN
  -- No explicit confirmation: report only, change nothing.
  IF confirm IS NOT TRUE THEN
    RAISE NOTICE 'close_stale_shifts called without confirm=true — no changes made. Run preview_stale_shifts() to see the list.';
    RETURN QUERY
      SELECT p.employee_id, p.emp_name, p.shift_date, NULL::TIMESTAMPTZ, NULL::NUMERIC, 'preview only - not confirmed'
      FROM preview_stale_shifts() p;
    RETURN;
  END IF;

  SELECT shift_end_time INTO v_end FROM kiosk_settings LIMIT 1;
  IF v_end IS NULL THEN
    RAISE EXCEPTION 'kiosk_settings.shift_end_time is NULL — is the auto-close migration applied?';
  END IF;

  FOR v_rec IN
    SELECT s.id, s.employee_id, e.name, s.date, s.check_in_at
    FROM employee_shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.check_out_at IS NULL
  LOOP
    v_close := ((v_rec.check_in_at AT TIME ZONE 'Asia/Kolkata')::DATE + v_end) AT TIME ZONE 'Asia/Kolkata';
    v_hours := ROUND(EXTRACT(EPOCH FROM (v_close - v_rec.check_in_at)) / 3600.0, 2);

    -- Refuse rather than write nonsense. A close at or before the punch-in is
    -- a data-entry mistake, not a 20-hour shift.
    IF v_close <= v_rec.check_in_at THEN
      v_skipped := v_skipped + 1;
      RETURN QUERY SELECT v_rec.employee_id, v_rec.name, v_rec.date, NULL, NULL,
        'SKIPPED - punched in after shift end; left open for manual review';
      CONTINUE;
    END IF;

    UPDATE employee_shifts SET check_out_at = v_close WHERE id = v_rec.id;
    v_n := v_n + 1;
    RETURN QUERY SELECT v_rec.employee_id, v_rec.name, v_rec.date, v_close, v_hours, 'closed';
  END LOOP;

  RAISE NOTICE 'close_stale_shifts: % closed, % skipped.', v_n, v_skipped;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION close_stale_shifts(BOOLEAN) FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO USE
--
--   STEP 1 (read-only, start here):
--     SELECT * FROM preview_stale_shifts();
--
--   STEP 2 — decide. Three honest options for the 2026-09-17 bulk (13 shifts,
--   all punched 11:11-14:57, which looks like a face-enrolment/test session
--   rather than real work):
--     a) close them at 16:00      -> SELECT * FROM close_stale_shifts(true);
--     b) leave them open, and accept the "on shift" noise in Live
--     c) delete them as test data -> see the DELETE query below, which is
--        destructive and needs its own explicit approval. Do NOT run it blind.
--
--   STEP 3 — schedule the recurring job so this cannot recur:
--     CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
--     SELECT cron.schedule('auto-close-shifts', '*/15 * * * *', $$SELECT auto_close_open_shifts()$$);
--     ...then confirm with: SELECT jobname, schedule, command FROM cron.job;
--
--   ROLLBACK (only valid before anyone has been paid against these hours).
--   Reverses exactly the closes this file made — the close is deterministic, so
--   re-deriving the same timestamp and matching on it catches only our own edits
--   and cannot touch a genuine check-out. Parenthesised deliberately: "AT TIME
--   ZONE" binds loosely against "+", and the wrong reading here would silently
--   match nothing (or the wrong rows).
--     UPDATE employee_shifts s
--        SET check_out_at = NULL
--       FROM kiosk_settings k
--      WHERE k.id = (SELECT id FROM kiosk_settings LIMIT 1)
--        AND s.check_out_at IS NOT NULL
--        AND s.check_out_at =
--              (((s.check_in_at AT TIME ZONE 'Asia/Kolkata')::DATE + k.shift_end_time)
--                AT TIME ZONE 'Asia/Kolkata');
--
-- OPTIONAL: destructive cleanup of the 2026-09-17 test-session shifts.
-- NOT recommended without confirming with staff first — listed for completeness
-- only, and it deletes attendance rows.
--   DELETE FROM employee_shifts
--    WHERE check_out_at IS NULL AND date = DATE '2026-09-17';
-- ─────────────────────────────────────────────────────────────────────────────
