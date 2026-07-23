-- Attendance is now Present/Absent only - "Leave" has been removed from the
-- teacher app, student app, and admin panel. No existing rows used 'L' (checked
-- before writing this), so this tightens the CHECK constraint with no data
-- migration needed.
ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_status_check;
ALTER TABLE student_attendance ADD CONSTRAINT student_attendance_status_check CHECK (status IN ('P', 'A'));
