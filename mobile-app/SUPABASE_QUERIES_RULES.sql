-- ─────────────────────────────────────────────────────────────────────────────
-- Query/Suggestion box (teachers + students submit, admin panel reviews) and
-- Rules & Regulations (admin panel edits, app displays read-only). Same
-- convention as syllabus/question_bank (SUPABASE_SYLLABUS.sql): RLS
-- disabled, anon grants.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- user_id is polymorphic (an employees.id when user_type='teacher', a
-- students.id when user_type='student') so it has no single FK target -
-- user_name/class_name are captured at submit time instead of joined later.
CREATE TABLE IF NOT EXISTS queries_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type    TEXT NOT NULL CHECK (user_type IN ('teacher','student')),
  user_id      UUID NOT NULL,
  user_name    TEXT NOT NULL,
  class_name   TEXT,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Resolved')),
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_queries_user ON queries_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries_suggestions(status);

ALTER TABLE queries_suggestions DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON queries_suggestions TO anon;

-- Single-row table (id is always 1) holding the current Rules & Regulations
-- text - the admin panel overwrites this one row, the app just reads it.
CREATE TABLE IF NOT EXISTS school_rules (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO school_rules (id, content) VALUES (1, '') ON CONFLICT (id) DO NOTHING;

ALTER TABLE school_rules DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON school_rules TO anon;
