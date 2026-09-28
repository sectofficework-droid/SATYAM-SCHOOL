-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-close open shifts at a configurable shift end time.
--
-- Problem: if a staff member punches in but forgets to check out, their shift
-- stays open forever and blocks them from punching in the next day.
--
-- Fix: a single global shift_end_time (default 4:00 PM, admin-configurable
-- via the admin panel). A scheduled job calls auto_close_open_shifts every 15
-- minutes, which closes any open shift whose check-in date's shift end time
-- has passed. Each auto-closed shift pushes a teacher_alerts notification so
-- the staff member knows they were checked out automatically.
--
-- Future-ready: when multi-shift is needed, kiosk_settings.shift_end_time
-- can be replaced by a shift_definitions table without changing the RPC
-- interface.
--
-- SAFE TO RUN: no data loss, no breaking changes to existing app signatures.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE kiosk_settings ADD COLUMN IF NOT EXISTS shift_end_time TIME NOT NULL DEFAULT '16:00:00';

-- Extend get_kiosk_admin_settings to include shift_end_time
DROP FUNCTION IF EXISTS get_kiosk_admin_settings();
CREATE OR REPLACE FUNCTION get_kiosk_admin_settings()
RETURNS TABLE(o_expected_start_time TIME, o_late_grace_minutes INT, o_absent_cutoff_time TIME, o_shift_end_time TIME, o_pin_is_set BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$$;

-- Extend save_kiosk_settings to accept shift_end_time
DROP FUNCTION IF EXISTS save_kiosk_settings(TIME, INT, TIME);
CREATE OR REPLACE FUNCTION save_kiosk_settings(p_expected_start_time TIME, p_late_grace_minutes INT, p_absent_cutoff_time TIME, p_shift_end_time TIME)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    shift_end_time      = p_shift_end_time,
    updated_at          = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION get_kiosk_admin_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION save_kiosk_settings(TIME, INT, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_kiosk_admin_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION save_kiosk_settings(TIME, INT, TIME, TIME) TO authenticated;

-- ── Auto-close open shifts ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_close_open_shifts()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings kiosk_settings%ROWTYPE;
  v_count INT := 0;
  v_emp_id UUID;
  v_emp_name TEXT;
  v_check_in TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;

  IF v_settings.shift_end_time IS NULL THEN
    RETURN 0;
  END IF;

  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.shift_end_time THEN
    RETURN 0;
  END IF;

  FOR v_emp_id, v_emp_name, v_check_in IN
    SELECT s.employee_id, e.name, s.check_in_at
    FROM employee_shifts s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.check_out_at IS NULL
  LOOP
    UPDATE employee_shifts SET check_out_at = now()
    WHERE employee_id = v_emp_id AND check_out_at IS NULL;

    UPDATE employee_attendance SET check_out_at = now(), status = 'P'
    WHERE employee_id = v_emp_id AND date = (v_check_in AT TIME ZONE 'Asia/Kolkata')::DATE;

    INSERT INTO teacher_alerts (teacher_id, title, message)
    VALUES (
      v_emp_id,
      'Auto Checked Out',
      'You were automatically checked out at ' ||
        to_char(now() AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') ||
        ' (shift end time ' || to_char(v_settings.shift_end_time, 'HH12:MI AM') || ').'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_close_open_shifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_close_open_shifts() TO anon, authenticated;

-- ── Modify record_check_out to push a notification ─────────────────────────
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

  UPDATE employee_attendance SET check_out_at = p_check_out_at, status = 'P'
    WHERE employee_id = p_employee_id AND date = v_open.date;

  INSERT INTO teacher_alerts (teacher_id, title, message)
  VALUES (
    p_employee_id,
    'Checked Out',
    'You checked out at ' || to_char(p_check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') || '.'
  );

  RETURN QUERY SELECT 'checked_out'::TEXT, p_check_out_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_check_out(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_check_out(UUID, TIMESTAMPTZ) TO anon, authenticated;
