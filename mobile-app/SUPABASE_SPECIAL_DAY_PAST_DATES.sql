-- ─────────────────────────────────────────────────────────────────────────────
-- Allow Special Day overrides on past dates (REQ-FEAT-014).
--
-- save_kiosk_special_day() (originally SUPABASE_KIOSK_SPECIAL_DAY.sql) had
-- "IF p_date::DATE < (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN RAISE
-- EXCEPTION 'special_day_in_past'; END IF;" - fine for the Settings page's
-- own date picker (min=today, scheduling an upcoming exam/function), but it
-- blocks the Staff Attendance Grid from toggling a day that's already
-- happened between Regular/Special, which the Grid now needs to do.
--
-- Note while writing this: the LIVE function already differs from
-- SUPABASE_KIOSK_SPECIAL_DAY.sql's original body - it gained an
-- is_admin_user() check and a PERFORM recompute_late_arrivals_for_date(...)
-- call at some point after that file was written, with no file updated to
-- match (this project's schema is not centralized - see CLAUDE.md). Both
-- are preserved here exactly as found live; this migration's only real
-- change is deleting the past-date guard.
--
-- Why this is safe to backdate: recompute_late_arrivals_for_date(p_date)
-- already exists and is already called at the end of this function (and of
-- delete_kiosk_special_day, unguarded, already applying to past dates) - it
-- walks every employee_shifts row for that date with a non-null is_late and
-- recomputes is_late/late_minutes against the (now-changed) effective
-- settings, syncing the result into both employee_shifts and
-- employee_attendance. So marking a past day Special (or reverting it to
-- Regular) correctly cascades to every existing record on that date rather
-- than leaving them stale - this was already true for every future-dated
-- Special Day change before this migration; it now also applies to past
-- ones.
--
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_kiosk_special_day(
  p_date TEXT,
  p_expected_start_time TIME,
  p_late_grace_minutes INT,
  p_absent_cutoff_time TIME,
  p_shift_end_time TIME,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
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

  PERFORM recompute_late_arrivals_for_date(p_date::DATE);
END;
$function$
