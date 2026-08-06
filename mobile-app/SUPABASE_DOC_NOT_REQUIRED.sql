-- ─────────────────────────────────────────────────────────────────────────────
-- Lets admin mark a student document as "Not Required" (with a mandatory
-- reason) instead of it nagging as pending forever when it genuinely doesn't
-- apply to that student. status already stores free-text values like
-- 'Uploaded'/'Pending' with no CHECK constraint, so 'Not Required' just
-- becomes a third value - only the reason column is new.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS reason TEXT;
