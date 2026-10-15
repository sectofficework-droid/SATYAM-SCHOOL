-- ─────────────────────────────────────────────────────────────────────────────
-- Admin attendance cell editor (REQ-FEAT-012) - supersedes
-- admin_set_manual_checkin (SUPABASE_ADMIN_MANUAL_CHECKIN.sql).
--
-- The Grid (Editable)'s first cut (REQ-FEAT-010/011) only let admin cycle
-- P/A/L and, separately, set a check-in time. User: "i told you to create a
-- spreadsheet like where we can manage all manually present leave absent
-- whether informed or not or what time they come what is the correct timing
-- for that is that any special day or not" - i.e. one place to set status,
-- an Absent/Leave day's Informed/reason (new - didn't exist anywhere in this
-- schema before), the check-in time, and to SEE that date's expected time
-- and Special Day status while doing it.
--
-- This file adds exactly what's new:
--   1. employee_attendance.is_informed/reason - new nullable columns.
--   2. admin_save_attendance_cell() - one RPC that saves a whole cell
--      (status + check-in time + informed/reason) in a single call, so the
--      Grid has one correct write path instead of two partial ones.
--   3. list_kiosk_special_days_in_range() - list_kiosk_special_days() only
--      ever returns upcoming overrides (SUPABASE_KIOSK_SPECIAL_DAY.sql,
--      built for the Settings page's own need); the Grid also needs to know
--      about PAST special days to show "was this day special" for a month
--      already gone by, so this adds the range version without touching the
--      original.
--
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE employee_attendance ADD COLUMN IF NOT EXISTS is_informed BOOLEAN;
ALTER TABLE employee_attendance ADD COLUMN IF NOT EXISTS reason TEXT;

-- employee_set_manual_checkin's write path, generalized: saves status,
-- check-in time (Present only), and informed+reason (Absent/Leave only) in
-- one call. Always an authoritative admin correction - overwrites whatever
-- was on record for that day, including clearing check-in/lateness when the
-- status is no longer Present (a day can't be both "Absent" and carry a
-- stale check-in time) and clearing informed/reason when the status is
-- Present (not meaningful there).
CREATE OR REPLACE FUNCTION admin_save_attendance_cell(
  p_employee_id UUID,
  p_date        DATE,
  p_status      TEXT,
  p_check_in_at TIMESTAMPTZ DEFAULT NULL,
  p_is_informed BOOLEAN     DEFAULT NULL,
  p_reason      TEXT        DEFAULT NULL
)
RETURNS TABLE(o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings     RECORD;
  v_local_time   TIME;
  v_is_late      BOOLEAN := NULL;
  v_late_minutes INT     := NULL;
  v_check_in     TIMESTAMPTZ := NULL;
  v_is_informed  BOOLEAN := NULL;
  v_reason       TEXT    := NULL;
  v_shift_id     UUID;
BEGIN
  IF p_date > (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'cannot_set_attendance_for_future_date';
  END IF;
  IF p_status NOT IN ('P', 'A', 'L') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF p_status = 'P' AND p_check_in_at IS NOT NULL THEN
    SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
    v_local_time   := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
    v_is_late      := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));
    v_check_in     := p_check_in_at;
  END IF;

  IF p_status IN ('A', 'L') THEN
    v_is_informed := p_is_informed;
    v_reason      := NULLIF(p_reason, '');
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method, is_late, late_minutes, is_informed, reason)
  VALUES (p_employee_id, p_date, p_status, v_check_in, NULL, v_is_late, v_late_minutes, v_is_informed, v_reason)
  ON CONFLICT (employee_id, date) DO UPDATE SET
    status       = EXCLUDED.status,
    check_in_at  = EXCLUDED.check_in_at,
    punch_method = NULL,
    is_late      = EXCLUDED.is_late,
    late_minutes = EXCLUDED.late_minutes,
    is_informed  = EXCLUDED.is_informed,
    reason       = EXCLUDED.reason;

  -- Only correct an existing employee_shifts row, same reasoning as
  -- admin_set_manual_checkin: never insert a new open one
  -- (idx_employee_shifts_one_open is one-open-shift-per-employee globally,
  -- and an open shift means "still clocked in right now", wrong for a
  -- backdated correction). Left entirely alone when status isn't Present -
  -- switching a day to Absent/Leave doesn't delete any real punch data.
  IF p_status = 'P' AND v_check_in IS NOT NULL THEN
    SELECT id INTO v_shift_id FROM employee_shifts
      WHERE employee_id = p_employee_id AND date = p_date
      ORDER BY check_in_at ASC LIMIT 1;
    IF v_shift_id IS NOT NULL THEN
      UPDATE employee_shifts SET
        check_in_at  = v_check_in,
        punch_method = NULL,
        is_late      = v_is_late,
        late_minutes = v_late_minutes
      WHERE id = v_shift_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_is_late, v_late_minutes;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_save_attendance_cell(UUID, DATE, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_attendance_cell(UUID, DATE, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO authenticated;

-- Superseded by admin_save_attendance_cell above - dropped rather than left
-- as unused dead API surface the Grid no longer calls.
DROP FUNCTION IF EXISTS admin_set_manual_checkin(UUID, DATE, TIMESTAMPTZ);

-- Read-only, any date range (unlike list_kiosk_special_days, which only
-- ever returns upcoming overrides) - lets the Grid show "was this date a
-- Special Day" for a month that's already gone by, not just the future.
CREATE OR REPLACE FUNCTION list_kiosk_special_days_in_range(p_from DATE, p_to DATE)
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
    WHERE date >= p_from AND date <= p_to
    ORDER BY date ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION list_kiosk_special_days_in_range(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_kiosk_special_days_in_range(DATE, DATE) TO authenticated;
