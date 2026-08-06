-- ─────────────────────────────────────────────────────────────────────────────
-- Patch for gr_book_imports: adds the Previous School TC (Leaving
-- Certificate) upload field - required whenever the record has previous
-- school info on file, same as the main Documents module already requires
-- it for a fresh admission with a previous school. Only needed if you ran
-- SUPABASE_GR_BOOK.sql before this field was added - safe to run even if it
-- already exists.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gr_book_imports ADD COLUMN IF NOT EXISTS previous_school_tc_key TEXT;
