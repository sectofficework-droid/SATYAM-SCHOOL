-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: changing the kiosk grace period / expected start time (the default
-- row or a special-day override) left already-punched staff for that date
-- frozen at whatever late/on-time verdict was computed at their original
-- punch time - the admin panel's report never "aligned" with a settings
-- change made later the same day.
--
-- Root cause (confirmed against the live DB on 2026-10-03): an earlier
-- one-off fix for exactly this (SUPABASE_FIX_SAVE_KIOSK_SETTINGS.sql,
-- 2026-09-30) added inline recompute logic to save_kiosk_settings, but it
-- was silently lost when that function got redefined for the special-day
-- feature on 2026-10-01 (SUPABASE_KIOSK_SPECIAL_DAY.sql never carried the
-- recompute forward). The live function had zero recompute logic. That
-- old inline version was also wrong on its own terms: it recalculated
-- every shift row with a check-in that day, not just each employee's
-- first shift, which would have stamped a late/on-time verdict onto
-- later same-day shifts that must stay NULL (see SUPABASE_KIOSK_SETTINGS.sql's
-- header note).
--
-- This re-adds the recompute as a shared function, scoped correctly:
-- only rows where is_late IS NOT NULL (i.e. each employee's actual
-- day-first shift) are touched, and only for the one date being edited -
-- every other date keeps its originally-recorded verdict untouched, same
-- as the project's existing "an attendance register shouldn't
-- retroactively change because the admin adjusted the shift time next
-- month" design intent.
--
-- Applied directly to production via the Supabase MCP on 2026-10-03 and
-- verified live: 3 staff who had punched in 7:18-7:33 AM under an earlier
-- (looser) grace period correctly flipped from "On Time" to "Late" the
-- moment this ran, matching the 0-minute grace period in effect by then.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP)
-- if re-applying elsewhere.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recompute_late_arrivals_for_date(p_date DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_shift RECORD;
  v_is_late BOOLEAN;
  v_late_minutes INT;
  v_local_time TIME;
  v_count INT := 0;
BEGIN
  SELECT * INTO v_settings FROM get_effective_kiosk_settings(p_date);

  FOR v_shift IN
    SELECT id, employee_id, check_in_at
    FROM employee_shifts
    WHERE date = p_date AND is_late IS NOT NULL
  LOOP
    v_local_time := (v_shift.check_in_at AT TIME ZONE 'Asia/Kolkata')::TIME;
    v_late_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_local_time - v_settings.o_expected_start_time)) / 60)::INT;
    v_is_late := v_local_time > (v_settings.o_expected_start_time + make_interval(mins => v_settings.o_late_grace_minutes));

    UPDATE employee_shifts SET is_late = v_is_late, late_minutes = v_late_minutes WHERE id = v_shift.id;
    UPDATE employee_attendance SET is_late = v_is_late, late_minutes = v_late_minutes
      WHERE employee_id = v_shift.employee_id AND date = p_date;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.recompute_late_arrivals_for_date(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_late_arrivals_for_date(DATE) TO authenticated;

-- ── Wire it into every settings-change entry point ───────────────────────

CREATE OR REPLACE FUNCTION public.save_kiosk_settings(
  p_expected_start_time TIME, p_late_grace_minutes INT, p_absent_cutoff_time TIME, p_shift_end_time TIME
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    shift_end_time      = p_shift_end_time,
    updated_at          = now()
  WHERE id IS NOT NULL;

  -- Default settings apply "from now on"; only today's already-punched
  -- rows are re-judged, every earlier date stays exactly as recorded.
  PERFORM recompute_late_arrivals_for_date((now() AT TIME ZONE 'Asia/Kolkata')::DATE);
END;
$$;
REVOKE ALL ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_kiosk_settings(TIME, INT, TIME, TIME) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_kiosk_special_day(
  p_date TEXT, p_expected_start_time TIME, p_late_grace_minutes INT,
  p_absent_cutoff_time TIME, p_shift_end_time TIME, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_date::DATE < (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'special_day_in_past';
  END IF;

  INSERT INTO kiosk_special_day_overrides
    (date, expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, reason, created_by)
  VALUES
    (p_date::DATE, p_expected_start_time,
     CASE WHEN p_late_grace_minutes IS NULL THEN NULL ELSE GREATEST(p_late_grace_minutes, 0) END,
     p_absent_cutoff_time, p_shift_end_time, p_reason, auth.uid())
  ON CONFLICT (date) DO UPDATE SET
    expected_start_time = EXCLUDED.expected_start_time,
    late_grace_minutes  = EXCLUDED.late_grace_minutes,
    absent_cutoff_time  = EXCLUDED.absent_cutoff_time,
    shift_end_time      = EXCLUDED.shift_end_time,
    reason               = EXCLUDED.reason,
    updated_at           = now();

  -- Editing today's (or an already-arrived special day's) override should
  -- re-judge that date's punches too, same reasoning as the default path.
  PERFORM recompute_late_arrivals_for_date(p_date::DATE);
END;
$$;
REVOKE ALL ON FUNCTION public.save_kiosk_special_day(TEXT, TIME, INT, TIME, TIME, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_kiosk_special_day(TEXT, TIME, INT, TIME, TIME, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_kiosk_special_day(p_date TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM kiosk_special_day_overrides WHERE date = p_date::DATE;
  -- Falls back to the default settings for that date - re-judge against
  -- those now that the override is gone.
  PERFORM recompute_late_arrivals_for_date(p_date::DATE);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_kiosk_special_day(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_kiosk_special_day(TEXT) TO anon, authenticated;
