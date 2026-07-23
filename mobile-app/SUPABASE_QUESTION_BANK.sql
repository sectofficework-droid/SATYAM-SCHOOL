-- Question Bank: a teacher builds a private repository of questions per
-- class/subject/chapter (as each chapter finishes), tagged by format (MCQ
-- or Written) and marks. question_papers/question_paper_items record each
-- generated Exam Paper or Assignment (built by picking questions out of the
-- bank on the admin panel) so past papers can be found again later.
--
-- Kept private per teacher at the app level (query always filters by
-- teacher_id), same as every other custom-auth table in this app - there is
-- no Supabase Auth session to hang real RLS off, so this matches the
-- existing security model throughout (anon key, RLS disabled, app-level
-- filtering only).

CREATE TABLE IF NOT EXISTS question_bank (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  class          TEXT NOT NULL,
  subject        TEXT NOT NULL,
  chapter        TEXT NOT NULL,
  question_format TEXT NOT NULL CHECK (question_format IN ('MCQ','Written')) DEFAULT 'Written',
  marks          INTEGER NOT NULL DEFAULT 1,
  question_text  TEXT NOT NULL,
  options        JSONB,        -- MCQ only: [{"label":"A","text":"..."}, ...]
  correct_option TEXT,         -- MCQ only: e.g. "A"
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_papers (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  paper_type       TEXT NOT NULL CHECK (paper_type IN ('Exam','Assignment')) DEFAULT 'Exam',
  title            TEXT NOT NULL,
  class            TEXT NOT NULL,
  subject          TEXT NOT NULL,
  duration_minutes INTEGER,
  full_marks       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_paper_items (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id       UUID NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  order_index    INTEGER NOT NULL,
  marks_override INTEGER
);

CREATE INDEX IF NOT EXISTS idx_question_bank_lookup ON question_bank (teacher_id, class, subject, chapter);
CREATE INDEX IF NOT EXISTS idx_question_paper_items_paper ON question_paper_items (paper_id);

ALTER TABLE question_bank DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_paper_items DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON question_bank TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON question_papers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON question_paper_items TO anon;
