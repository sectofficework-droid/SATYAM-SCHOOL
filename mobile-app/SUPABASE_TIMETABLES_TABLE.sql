-- ─────────────────────────────────────────────────────────────────────────────
-- Safety net for the Timetable grid (Settings → Timetable → class/subject/
-- teacher cells). No SQL file in this repo actually defines this table's
-- schema/RLS/grants - it appears to have been created directly in the
-- Supabase dashboard at some point, so unlike every other table this project
-- touches, its access grants were never captured anywhere. If a report of
-- "saved, refreshed, changes gone" turns out to be a permissions issue
-- (RLS blocking reads for the admin panel's session) rather than a real
-- app bug, this closes that gap. CREATE TABLE IF NOT EXISTS also covers the
-- (less likely, but possible) case that the table doesn't exist at all.
-- Safe to run even if the table already exists with the same shape.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timetables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  day_group     TEXT NOT NULL,
  slot_id       TEXT NOT NULL,
  class_name    TEXT NOT NULL,
  subject       TEXT,
  teacher       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (academic_year, day_group, slot_id, class_name)
);
CREATE INDEX IF NOT EXISTS idx_timetables_year ON timetables(academic_year);

ALTER TABLE timetables DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON timetables TO anon, authenticated;
