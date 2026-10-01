-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace: Kiosk Settings + Staff Attendance report.
--
-- Ports the web admin panel's Settings -> Kiosk tab (punch timing, special-day
-- overrides, kiosk admin PIN) and the Staff Attendance (Kiosk) report's daily
-- rows into the Teacher app's Admin Workspace, same pattern as every other
-- staff_admin_* RPC in SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql: every call
-- takes p_employee_id first and re-derives the tier server-side via
-- staff_admin_tier() - never trust a locally-cached role for gating.
--
-- Gated to senior_admin/management only (not normal_admin) - kiosk timing and
-- the PIN affect every staff member's attendance record, same sensitivity
-- tier as student-delete and syllabus-request approval elsewhere in this file
-- set.
--
-- The underlying kiosk_settings/kiosk_special_day_overrides RPCs
-- (get_kiosk_admin_settings, save_kiosk_settings, set_kiosk_admin_pin,
-- list_kiosk_special_days, save_kiosk_special_day, delete_kiosk_special_day)
-- already exist and are callable by `authenticated` (web) - these wrappers
-- add the `anon`-callable, tier-checked surface the mobile app needs, since
-- mobile requests always execute as `anon` (see CLAUDE.md's RPC/anon note).
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Kiosk punch timing settings ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_kiosk_get_settings(p_employee_id UUID)
RETURNS TABLE(o_expected_start_time TIME, o_late_grace_minutes INT, o_absent_cutoff_time TIME, o_shift_end_time TIME, o_pin_is_set BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_kiosk_save_settings(
  p_employee_id UUID,
  p_expected_start_time TIME,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME,
  p_shift_end_time TIME
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  PERFORM save_kiosk_settings(p_expected_start_time, p_late_grace_minutes, p_absent_cutoff_time, p_shift_end_time);
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_kiosk_set_pin(p_employee_id UUID, p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  PERFORM set_kiosk_admin_pin(p_pin);
END;
$$;

-- ── Special-day overrides ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_kiosk_list_special_days(p_employee_id UUID)
RETURNS TABLE(
  o_date DATE, o_expected_start_time TIME, o_late_grace_minutes INT,
  o_absent_cutoff_time TIME, o_shift_end_time TIME, o_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY SELECT * FROM list_kiosk_special_days();
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_kiosk_save_special_day(
  p_employee_id UUID,
  p_date TEXT,
  p_expected_start_time TIME,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME,
  p_shift_end_time TIME,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  PERFORM save_kiosk_special_day(p_date, p_expected_start_time, p_late_grace_minutes, p_absent_cutoff_time, p_shift_end_time, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_kiosk_delete_special_day(p_employee_id UUID, p_date TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  PERFORM delete_kiosk_special_day(p_date);
END;
$$;

-- ── Staff Attendance (Kiosk) report, date-range scoped ─────────────────────
-- Mobile equivalent of admin-panel's getStaffAttendanceForReport(), but
-- bounded by p_from_date/p_to_date (inclusive) rather than pulling every row
-- ever recorded - the web page has no such bound because it's a desktop
-- report tool with its own client-side date filters; a phone screen has no
-- reason to ever hold more than one reporting window in memory at once.
-- Returns one row per employee per day, with lateness/hours already derived
-- server-side so the Flutter layer stays a dumb renderer.
CREATE OR REPLACE FUNCTION staff_admin_kiosk_attendance_report(p_employee_id UUID, p_from_date DATE, p_to_date DATE)
RETURNS TABLE(
  o_employee_id UUID, o_emp_code TEXT, o_name TEXT, o_designation TEXT, o_department TEXT,
  o_date DATE, o_status TEXT, o_check_in_at TIMESTAMPTZ, o_check_out_at TIMESTAMPTZ,
  o_punch_method TEXT, o_is_late BOOLEAN, o_late_minutes INT, o_hours_worked NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_to_date < p_from_date THEN RAISE EXCEPTION 'to_date_before_from_date'; END IF;

  RETURN QUERY
    SELECT
      a.employee_id, e.emp_code, e.name, e.designation, e.department,
      a.date, a.status, a.check_in_at, a.check_out_at,
      a.punch_method, a.is_late, a.late_minutes,
      COALESCE((
        SELECT ROUND(SUM(EXTRACT(EPOCH FROM (s.check_out_at - s.check_in_at))) / 3600.0, 2)
        FROM employee_shifts s
        WHERE s.employee_id = a.employee_id AND s.date = a.date AND s.check_out_at IS NOT NULL
      ), 0)::NUMERIC AS o_hours_worked
    FROM employee_attendance a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.date BETWEEN p_from_date AND p_to_date
    ORDER BY a.date DESC, e.name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_get_settings(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_save_settings(UUID, TIME, INT, TIME, TIME) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_set_pin(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_list_special_days(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_save_special_day(UUID, TEXT, TIME, INT, TIME, TIME, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_delete_special_day(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_kiosk_attendance_report(UUID, DATE, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_kiosk_get_settings(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_save_settings(UUID, TIME, INT, TIME, TIME) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_set_pin(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_list_special_days(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_save_special_day(UUID, TEXT, TIME, INT, TIME, TIME, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_delete_special_day(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_kiosk_attendance_report(UUID, DATE, DATE) TO anon, authenticated;
