-- ─────────────────────────────────────────────────────────────────────────────
-- Per-class scoping for school_calendar_events - lets a holiday/govt/
-- working_day entry apply to only some classes instead of the whole school
-- (e.g. board-exam classes closed while everyone else has normal school, or
-- one class open on an otherwise-closed Sunday). NULL = every class, same
-- as the behavior before this column existed - nothing changes for any
-- existing row until an admin actually picks specific classes.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE school_calendar_events ADD COLUMN IF NOT EXISTS applies_to_classes TEXT[];
