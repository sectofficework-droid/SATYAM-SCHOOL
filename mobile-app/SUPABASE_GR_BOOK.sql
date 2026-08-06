-- ─────────────────────────────────────────────────────────────────────────────
-- Digital GR (General Register) Book - the admin panel's GR Book page shows
-- ONE combined register keyed by GR No: every student already in `students`
-- (derived live, no duplicate data entry - see grBookService.js) PLUS
-- historical paper-register entries for students who left long before this
-- system existed and were never digitized as a full student record. This
-- table is only for that second group - there's no FK to `students` because
-- these are, by definition, students the system has no record of.
-- Same convention as every table added this session: RLS disabled, anon grants.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gr_book_imports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_no              TEXT NOT NULL,
  surname            TEXT,
  student_name       TEXT,
  father_name        TEXT,
  mother_name        TEXT,
  religion           TEXT,
  caste              TEXT,
  birth_village      TEXT,
  birth_city         TEXT,
  birth_district     TEXT,
  birth_state        TEXT,
  dob                DATE,
  last_school_gr_no  TEXT,
  last_school_name   TEXT,
  date_of_admission  DATE,
  admission_class    TEXT,
  aadhar_no          TEXT,
  udise_no           TEXT,
  apaar_id           TEXT,
  pen_no             TEXT,
  date_of_leaving    DATE,
  class_when_left    TEXT,
  tc_no              TEXT,
  birth_cert_key     TEXT,   -- S3 key, prefix gr-book/
  student_aadhar_key TEXT,
  father_aadhar_key  TEXT,
  mother_aadhar_key  TEXT,
  tc_key             TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gr_book_imports_gr_no ON gr_book_imports(gr_no);

ALTER TABLE gr_book_imports DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gr_book_imports TO anon;
