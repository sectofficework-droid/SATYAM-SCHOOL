-- ─────────────────────────────────────────────────────────────────────────────
-- Official exams run over several days (7-12 days), not a single date -
-- adds a start_date alongside the existing end_date. Marks-entry unlock
-- logic is unchanged (still keyed off end_date: unlocks the day the exam
-- ends) - start_date is purely informational, shown as the exam's date
-- range in the admin panel and mobile app.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE official_exams ADD COLUMN IF NOT EXISTS start_date DATE;
