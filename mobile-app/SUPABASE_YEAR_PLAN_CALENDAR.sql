-- Moves Year Planning (admin panel: Settings > Year Planning) from the
-- admin's own browser localStorage into Supabase, so every admin sees the
-- same calendar and the teacher app can read it too. Categories
-- (govt/function/celebration/ptm/exam/holiday/sunday) match
-- admin-panel/src/lib/yearPlanData.js's YEAR_PLAN_CATEGORIES - kept as free
-- text here (no CHECK constraint) so a new category can be added in the UI
-- without a DB migration. The admin panel auto-seeds this table with the
-- verified 2026-27 calendar the first time it finds it empty.
--
-- If you already ran an earlier SUPABASE_SCHOOL_CALENDAR.sql that created
-- this table with a plain Holiday/Event/Exam `event_type` column, this
-- upgrades it in place; otherwise it creates the table fresh.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_calendar_events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE school_calendar_events RENAME COLUMN event_type TO category;
    ALTER TABLE school_calendar_events DROP CONSTRAINT IF EXISTS school_calendar_events_event_type_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS school_calendar_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date  DATE NOT NULL,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'holiday',
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE school_calendar_events ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE INDEX IF NOT EXISTS idx_school_calendar_events_date ON school_calendar_events(event_date);

ALTER TABLE school_calendar_events DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON school_calendar_events TO anon;
