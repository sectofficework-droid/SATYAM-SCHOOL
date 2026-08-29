-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher app's Question Bank module - Assignment / Exam Paper / Question Bank
-- sections, all backed by this one table (distinguished by `section`). This
-- replaces the old question-by-question builder (question_bank/question_papers/
-- question_paper_items, left in place but unused) with plain document uploads -
-- teachers attach an already-prepared PDF/photo instead of building questions
-- in-app. `title` doubles as "Exam Name" in the Exam Paper section's UI - same
-- column, just a different label shown to the teacher.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_documents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  section       TEXT NOT NULL CHECK (section IN ('assignment','exam_paper','question_bank')),
  academic_year TEXT NOT NULL,
  class         TEXT NOT NULL,
  subject       TEXT NOT NULL,
  title         TEXT NOT NULL,
  file_key      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher_section
  ON teacher_documents(teacher_id, section);

ALTER TABLE teacher_documents DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_documents TO anon;
