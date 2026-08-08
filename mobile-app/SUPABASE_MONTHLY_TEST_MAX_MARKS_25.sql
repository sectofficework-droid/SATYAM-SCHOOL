-- ─────────────────────────────────────────────────────────────────────────────
-- Monthly Test module (formerly the freeform "Marks" module) is now capped at
-- 25 marks per test - the app no longer lets a teacher pick a different max
-- when creating one. This is a one-time backfill so tests created before that
-- change (previously defaulting to 100, or whatever a teacher typed) show the
-- same 25 cap as new ones instead of a stale, inconsistent max.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE exams SET max_marks = 25;
