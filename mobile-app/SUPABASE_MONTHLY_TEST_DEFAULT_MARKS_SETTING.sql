-- ─────────────────────────────────────────────────────────────────────────────
-- Monthly Test's full marks (previously hardcoded to 25 in the teacher app)
-- is now an admin-configurable setting - still defaults to 25, but management
-- can raise/lower it from Settings → Exams without needing an app release.
-- Stored on the single-row school_profile table alongside the rest of the
-- school-wide config (same pattern as school name/address/board/medium).
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE school_profile
  ADD COLUMN IF NOT EXISTS monthly_test_max_marks INTEGER NOT NULL DEFAULT 25;

-- Mobile app (teacher) reads this via the anon key when creating a new
-- Monthly Test - harmless if already granted.
GRANT SELECT ON school_profile TO anon;
