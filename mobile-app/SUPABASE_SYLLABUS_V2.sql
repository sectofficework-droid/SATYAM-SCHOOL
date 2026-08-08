-- ─────────────────────────────────────────────────────────────────────────────
-- Syllabus v2: subtopics with their own progress, a per-(teacher,class,subject)
-- lock, and an admin-approval request workflow to edit a locked syllabus -
-- same shape as attendance_edit_requests (SUPABASE_ATTENDANCE_REQUESTS.sql):
-- approving sets approved_at, which opens a 24-hour edit window checked
-- app-side (no separate "window open" flag), and closed_at lets the teacher
-- end that window early via "Save & Lock" instead of waiting it out.
-- Same convention as every table added this session: RLS disabled, anon
-- grants. Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Locking sets these on every chapter row for that teacher+class+subject at
-- once - locked freezes the syllabus PLAN (chapter/subtopic names); progress
-- status stays editable regardless of lock state.
ALTER TABLE syllabus ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE syllabus ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Subtopics under a chapter - optional, independent progress. When a chapter
-- has any subtopics, its own status is derived app-side from these instead
-- of being set directly.
CREATE TABLE IF NOT EXISTS syllabus_subtopics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id  UUID NOT NULL REFERENCES syllabus(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('Not Started','In Progress','Completed')) DEFAULT 'Not Started',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_syllabus_subtopics_chapter ON syllabus_subtopics(chapter_id);

-- A teacher's request to add/update a locked class+subject's syllabus.
CREATE TABLE IF NOT EXISTS syllabus_edit_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  class_name        TEXT NOT NULL,
  subject_name      TEXT NOT NULL,
  reason            TEXT,
  requested_changes TEXT,
  status            TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  admin_note        TEXT,
  approved_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  responded_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_syllabus_edit_requests_teacher ON syllabus_edit_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_edit_requests_status  ON syllabus_edit_requests(status);

ALTER TABLE syllabus_subtopics     DISABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_edit_requests DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON syllabus_subtopics     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON syllabus_edit_requests TO anon;

-- Approval notifications reuse the existing teacher_alerts table (already
-- wired into the teacher app's notification bell) - no schema change needed
-- for that part.
