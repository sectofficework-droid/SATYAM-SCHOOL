-- ============================================================================
-- FIX: save_kiosk_settings safeupdate error
-- PostgreSQL safeupdate extension requires a WHERE clause on all UPDATE statements.
-- This script replaces save_kiosk_settings with WHERE id IS NOT NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_kiosk_settings(
  p_expected_start_time TIME,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME,
  p_shift_end_time TIME
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    shift_end_time      = p_shift_end_time,
    updated_at          = now()
  WHERE id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) TO authenticated;
