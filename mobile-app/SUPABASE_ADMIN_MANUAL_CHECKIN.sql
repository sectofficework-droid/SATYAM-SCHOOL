-- ─────────────────────────────────────────────────────────────────────────────
-- Admin-entered check-in time correction (REQ-FEAT-011).
--
-- The admin panel's Staff Attendance "Grid (Editable)" view could only cycle
-- a day's P/A/L status - there was no way to record an actual arrival time
-- (e.g. "came in late at 9:45") from the admin side at all; only the Kiosk
-- app's punch RPCs (record_face_punch/redeem_punch_code/redeem_qr_session)
-- ever wrote a check-in time. This adds exactly one admin-side write path for
-- that, mirroring those RPCs' own insert shape rather than inventing a new
-- one.
--
-- Reuses get_effective_kiosk_settings(p_date) (SUPABASE_KIOSK_SPECIAL_DAY.sql)
-- so a manually-entered time is judged against that date's Special Day
-- override when one exists, not blindly against the default kiosk_settings
-- row - the same rule the Kiosk app's own punches already follow.
--
-- Deliberately check-in only (no check-out param): Hours Worked/OT still
-- needs a check-out before it can compute anything for that day - this does
-- not fabricate one. It writes the matching employee_shifts row (not just
-- employee_attendance) so that if a check-out is added later the normal way,
-- hours combine correctly instead of being stuck unrecoverable in the wrong
-- table.
--
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_set_manual_checkin(
  p_employee_id UUID,
  p_date        DATE,
  p_check_in_at TIMESTAMPTZ
)
RETURNS TABLE(o_is_late BOOLEAN, o_late_minutes INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings     RECORD;
  v_local_time   TIME;
  v_is_late      BOOLEAN;
  v_late_minutes INT;
  v_shift_id     UUID;
BEGIN
  IF p_date > (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'cannot_set_checkin_for_future_date';
  END IF;

  SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);
  v_local_time   := (p_check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
  v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
  v_is_late      := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));

  -- Authoritative correction: unlike a kiosk re-punch (which only updates
  -- `status` on conflict, see record_face_punch), an explicit admin-entered
  -- time always overwrites whatever check-in was on record for that day.
  INSERT INTO employee_attendance (employee_id, date, status, check_in_at, punch_method, is_late, late_minutes)
  VALUES (p_employee_id, p_date, 'P', p_check_in_at, 'manual', v_is_late, v_late_minutes)
  ON CONFLICT (employee_id, date) DO UPDATE SET
    status       = 'P',
    check_in_at  = EXCLUDED.check_in_at,
    punch_method = 'manual',
    is_late      = EXCLUDED.is_late,
    late_minutes = EXCLUDED.late_minutes;

  -- Correct the day's earliest shift row if one already exists (a real kiosk
  -- punch, or an earlier manual entry), else insert a new open one (no
  -- check_out_at - this call only ever sets a check-in).
  SELECT id INTO v_shift_id FROM employee_shifts
    WHERE employee_id = p_employee_id AND date = p_date
    ORDER BY check_in_at ASC LIMIT 1;

  IF v_shift_id IS NOT NULL THEN
    UPDATE employee_shifts SET
      check_in_at  = p_check_in_at,
      punch_method = 'manual',
      is_late      = v_is_late,
      late_minutes = v_late_minutes
    WHERE id = v_shift_id;
  ELSE
    INSERT INTO employee_shifts (employee_id, date, check_in_at, punch_method, is_late, late_minutes)
    VALUES (p_employee_id, p_date, p_check_in_at, 'manual', v_is_late, v_late_minutes);
  END IF;

  RETURN QUERY SELECT v_is_late, v_late_minutes;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_manual_checkin(UUID, DATE, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_manual_checkin(UUID, DATE, TIMESTAMPTZ) TO authenticated;
