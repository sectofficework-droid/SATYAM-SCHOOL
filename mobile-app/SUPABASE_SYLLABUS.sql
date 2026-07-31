-- ─────────────────────────────────────────────────────────────────────────────
-- Syllabus module: chapter/topic list per class+subject, owned by the
-- teacher who added it, with a status a student can see progress on.
-- Same convention as question_bank (SUPABASE_QUESTION_BANK.sql): RLS
-- disabled, anon grants, ownership enforced app-side via teacher_id.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS syllabus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  class       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  chapter     TEXT NOT NULL,
  status      TEXT CHECK (status IN ('Not Started','In Progress','Completed')) DEFAULT 'Not Started',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_syllabus_class_subject ON syllabus(class, subject);

ALTER TABLE syllabus DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON syllabus TO anon;
