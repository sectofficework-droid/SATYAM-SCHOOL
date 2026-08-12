-- ─────────────────────────────────────────────────────────────────────────────
-- SEF Settings — 7 tabs mirroring (in shape, not complexity) the school's
-- Settings: Institute Profile, Academic Year, Fee Structure, Classes &
-- Section, Fee Reminder, Users & Roles, Rules & Regulations. Users & Roles
-- isn't here - it reuses the school's existing admin_users table (same
-- shared admin-panel login for both orgs, decided in SEF Phase 1).
--
-- Deliberately simpler than the school's equivalents: no admission/
-- readmission dates on academic years (that's for the school's class-
-- promotion workflow, which SEF doesn't have), no class+section+teacher
-- assignment (sef_students never had a section field), one fee reminder
-- template instead of three languages, one rules blob instead of a
-- teacher/student split (no SEF mobile app yet to show it to).
--
-- Run this in Supabase Dashboard → SQL Editor.
-- RLS intentionally OFF, same as every other table in this project.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sef_profile (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       TEXT,
  address    TEXT,
  city       TEXT,
  state      TEXT,
  pincode    TEXT,
  phone      TEXT,
  email      TEXT,
  website    TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO sef_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sef_academic_years (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT UNIQUE NOT NULL,          -- e.g. "2026-27"
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- The Std list the Student form's dropdown pulls from (see sef/student/page.js).
CREATE TABLE IF NOT EXISTS sef_classes (
  std        TEXT PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0
);

-- Default monthly fee per std - only prefills sef_students.monthly_fee when
-- adding a student for that std; stays freely editable per student.
CREATE TABLE IF NOT EXISTS sef_fee_structure (
  std         TEXT PRIMARY KEY REFERENCES sef_classes(std) ON DELETE CASCADE,
  default_fee NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sef_fee_reminder_template (
  id      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content TEXT NOT NULL DEFAULT ''
);
INSERT INTO sef_fee_reminder_template (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sef_rules (
  id      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content TEXT NOT NULL DEFAULT ''
);
INSERT INTO sef_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE sef_profile              DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_academic_years       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_classes              DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_fee_structure        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_fee_reminder_template DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_rules                DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sef_profile               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_academic_years        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_classes               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_fee_structure         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_fee_reminder_template TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_rules                 TO anon, authenticated;
