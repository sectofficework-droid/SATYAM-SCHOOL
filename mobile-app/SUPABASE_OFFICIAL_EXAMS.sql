-- ─────────────────────────────────────────────────────────────────────────────
-- Official Exams module: admin-managed exam list (First Unit Test / Half
-- Yearly / Annual, or whatever management adds/removes), per-exam-per-class-
-- per-subject max marks, and the marks themselves. Separate from the
-- existing freeform exams/exam_marks tables, which stay untouched and keep
-- working for ad hoc teacher-created tests/quizzes.
-- Same convention as syllabus/class_subjects: RLS disabled, anon grants.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per exam definition, SCHOOL-WIDE (not per class/subject — those are
-- chosen at mark-entry time). end_date drives the automatic unlock: marks
-- entry opens once CURRENT_DATE >= end_date, no separate status flag needed.
CREATE TABLE IF NOT EXISTS official_exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  end_date         DATE NOT NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Max marks per exam, per class, per subject - admin-configured (e.g. Math
-- out of 100, English out of 80). Missing row = default 100 app-side.
CREATE TABLE IF NOT EXISTS official_exam_subject_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES official_exams(id) ON DELETE CASCADE,
  class_name   TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  max_marks    NUMERIC(5,2) NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exam_id, class_name, subject_name)
);

-- class_name/subject_name captured AT ENTRY TIME (denormalized text, not FKs)
-- - matches how legacy exams.class already works, and avoids marks silently
-- moving/disappearing if a student is promoted to a new class in a later year.
CREATE TABLE IF NOT EXISTS official_exam_marks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES official_exams(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_name      TEXT NOT NULL,
  subject_name    TEXT NOT NULL,
  marks_obtained  NUMERIC(5,2),
  entered_by      UUID REFERENCES employees(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exam_id, student_id, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_official_exam_marks_lookup
  ON official_exam_marks(exam_id, class_name, subject_name);

ALTER TABLE official_exams               DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_exam_subject_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_exam_marks          DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON official_exams               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON official_exam_subject_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON official_exam_marks          TO anon;
