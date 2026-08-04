  -- ─────────────────────────────────────────────────────────────────────────────
  -- Attendance edit-request workflow + a lightweight targeted in-app alert
  -- (used both for "please mark attendance" admin reminders and "your edit
  -- request was approved" notices - see recent_notices.dart's taskAsNoticeItem
  -- for the same merge-into-notice-bell pattern this reuses).
  -- Same convention as every table added this session: RLS disabled, anon grants.
  -- Run this in Supabase Dashboard → SQL Editor
  -- ─────────────────────────────────────────────────────────────────────────────

  -- A teacher's request to re-open an already-submitted day for editing.
  -- Approving sets approved_at, which starts a 10-minute edit window - checked
  -- app-side (now() - approved_at < 10 min), no separate stored status flag
  -- for "window still open", same idiom as official-exam unlock dates.
  CREATE TABLE IF NOT EXISTS attendance_edit_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    class_name   TEXT NOT NULL,
    section_name TEXT,
    date         DATE NOT NULL,
    reason       TEXT,
    status       TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
    admin_note   TEXT,
    approved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_attendance_edit_requests_teacher ON attendance_edit_requests(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_edit_requests_status  ON attendance_edit_requests(status);

  -- Lightweight in-app notification targeted at one teacher.
  CREATE TABLE IF NOT EXISTS teacher_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_teacher_alerts_teacher ON teacher_alerts(teacher_id);

  ALTER TABLE attendance_edit_requests DISABLE ROW LEVEL SECURITY;
  ALTER TABLE teacher_alerts           DISABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_edit_requests TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_alerts           TO anon;
