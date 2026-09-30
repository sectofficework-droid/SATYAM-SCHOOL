-- ============================================================================
-- FIX: save_kiosk_settings safeupdate error & auto-recalculate today's punches
-- PostgreSQL safeupdate extension requires a WHERE clause on all UPDATE statements.
-- This script drops the old function and recreates save_kiosk_settings with WHERE id IS NOT NULL,
-- and automatically recalculates today's punches so reports stay accurate when timings change.
-- ============================================================================

DROP FUNCTION IF EXISTS public.save_kiosk_settings(TIME, INT, TIME, TIME);
DROP FUNCTION IF EXISTS public.save_kiosk_settings(TIME WITHOUT TIME ZONE, INT, TIME WITHOUT TIME ZONE, TIME WITHOUT TIME ZONE);
DROP FUNCTION IF EXISTS public.save_kiosk_settings(TIME, INT, TIME);
DROP FUNCTION IF EXISTS public.save_kiosk_settings;

CREATE OR REPLACE FUNCTION public.save_kiosk_settings(
  p_expected_start_time TIME WITHOUT TIME ZONE,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME WITHOUT TIME ZONE,
  p_shift_end_time TIME WITHOUT TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- 1. Update settings
  UPDATE public.kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    shift_end_time      = p_shift_end_time,
    updated_at          = now()
  WHERE id IS NOT NULL;

  -- 2. Automatically recalculate today's attendance records in employee_attendance
  WITH today_att AS (
    SELECT
      id,
      GREATEST(0, EXTRACT(EPOCH FROM ((check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME - p_expected_start_time)) / 60)::INT AS new_late_minutes,
      ((check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME > (p_expected_start_time + make_interval(mins => p_late_grace_minutes))) AS new_is_late
    FROM public.employee_attendance
    WHERE date = (now() AT TIME ZONE 'Asia/Kolkata')::DATE
      AND check_in_at IS NOT NULL
  )
  UPDATE public.employee_attendance a
  SET
    late_minutes = r.new_late_minutes,
    is_late = r.new_is_late
  FROM today_att r
  WHERE a.id = r.id;

  -- 3. Automatically recalculate today's shift records in employee_shifts
  WITH today_shifts AS (
    SELECT
      id,
      GREATEST(0, EXTRACT(EPOCH FROM ((check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME - p_expected_start_time)) / 60)::INT AS new_late_minutes,
      ((check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME > (p_expected_start_time + make_interval(mins => p_late_grace_minutes))) AS new_is_late
    FROM public.employee_shifts
    WHERE date = (now() AT TIME ZONE 'Asia/Kolkata')::DATE
      AND check_in_at IS NOT NULL
  )
  UPDATE public.employee_shifts s
  SET
    late_minutes = r.new_late_minutes,
    is_late = r.new_is_late
  FROM today_shifts r
  WHERE s.id = r.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) TO anon;
