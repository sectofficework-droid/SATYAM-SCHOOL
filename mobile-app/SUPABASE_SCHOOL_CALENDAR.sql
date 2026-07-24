-- School-declared calendar dates (holidays, events, exams) shown alongside
-- India's fixed-date national holidays in the teacher app's Calendar module.
-- Lunar-calendar festivals (Diwali, Holi, Eid, etc.) are NOT hardcoded
-- anywhere in the app since their Gregorian date shifts every year and
-- guessing wrong would be worse than not showing them - add them here from
-- the admin panel's Calendar page instead, tagged as "Holiday".

CREATE TABLE IF NOT EXISTS school_calendar_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date  DATE NOT NULL,
  title       TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('Holiday','Event','Exam')) DEFAULT 'Event',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_calendar_events_date ON school_calendar_events(event_date);

ALTER TABLE school_calendar_events DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON school_calendar_events TO anon;
