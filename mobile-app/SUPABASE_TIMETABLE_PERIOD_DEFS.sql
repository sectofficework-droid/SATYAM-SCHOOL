-- ─────────────────────────────────────────────────────────────────────────────
-- Bug fix: the Timetable tab's period timings (Prayer/Period 1/Recess/...
-- start-end times per day-group) were stored ONLY in the admin panel's
-- Zustand store, which persists to that browser's localStorage - so editing
-- them only ever showed up on the machine that made the edit, never for any
-- other admin. This adds a place to store them in Supabase (single-row
-- school_profile table, same pattern as monthly_test_max_marks) so every
-- admin session reads/writes the same shared value.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE school_profile ADD COLUMN IF NOT EXISTS period_defs JSONB;
