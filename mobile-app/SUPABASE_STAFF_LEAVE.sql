-- ─────────────────────────────────────────────────────────────────────────────
-- Staff leave requests + a real day-by-day staff attendance table. Today
-- there is no day-by-day staff attendance at all - the admin panel's
-- Employee → Attendance view is an Excel-import period summary for salary
-- calculation (Zustand only, no table). Same request/approve/reject shape
-- as attendance_edit_requests (SUPABASE_ATTENDANCE_REQUESTS.sql): approving
-- a leave request also auto-inserts one employee_attendance row per date in
-- the range with status 'L', and notifies via the existing teacher_alerts
-- table (already wired into the teacher app's notification bell).
-- Same convention as every table added this session: RLS disabled, grants
-- to both anon and authenticated (mobile app uses anon, admin panel uses
-- authenticated).
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('P','A','L')),
  marked_by   UUID REFERENCES employees(id), -- null when system-marked via an approved leave request
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_employee ON employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_date     ON employee_attendance(date);

CREATE TABLE IF NOT EXISTS leave_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  from_date    DATE NOT NULL,
  to_date      DATE NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (to_date >= from_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status   ON leave_requests(status);

ALTER TABLE employee_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests      DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON employee_attendance TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leave_requests      TO anon, authenticated;
