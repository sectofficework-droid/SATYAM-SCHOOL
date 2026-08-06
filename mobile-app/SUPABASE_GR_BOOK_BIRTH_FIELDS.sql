-- ─────────────────────────────────────────────────────────────────────────────
-- Patch for gr_book_imports: adds the Village/City/District/State birth
-- fields (replacing the old single place_of_birth column) - only needed if
-- you ran the original SUPABASE_GR_BOOK.sql before this split was added.
-- Safe to run even if these columns already exist.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gr_book_imports ADD COLUMN IF NOT EXISTS birth_village  TEXT;
ALTER TABLE gr_book_imports ADD COLUMN IF NOT EXISTS birth_city     TEXT;
ALTER TABLE gr_book_imports ADD COLUMN IF NOT EXISTS birth_district TEXT;
ALTER TABLE gr_book_imports ADD COLUMN IF NOT EXISTS birth_state    TEXT;
ALTER TABLE gr_book_imports DROP COLUMN IF EXISTS place_of_birth;
