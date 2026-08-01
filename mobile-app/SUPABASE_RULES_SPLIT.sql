  -- ─────────────────────────────────────────────────────────────────────────────
  -- Splits Rules & Regulations into separate Teacher and Student content
  -- (previously one single blob shown to both). Run this AFTER
  -- SUPABASE_QUERIES_RULES.sql - it replaces the school_rules table.
  -- The existing row's content was still empty (nothing had been published
  -- yet), so this recreates the table rather than migrating data.
  -- Run this in Supabase Dashboard → SQL Editor
  -- ─────────────────────────────────────────────────────────────────────────────

  DROP TABLE IF EXISTS school_rules;

  CREATE TABLE school_rules (
    audience    TEXT PRIMARY KEY CHECK (audience IN ('teacher','student')),
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  );

  INSERT INTO school_rules (audience, content) VALUES ('teacher', ''), ('student', '');

  ALTER TABLE school_rules DISABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON school_rules TO anon;
