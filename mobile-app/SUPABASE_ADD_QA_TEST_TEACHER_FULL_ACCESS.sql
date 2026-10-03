-- ─────────────────────────────────────────────────────────────────────────────
-- Adds one standing test teacher login ("ZZ-TEST Satyam", EMP999) so the app
-- can be fully QA'd without ever using a real teacher's or student's account.
--
-- Supersedes the teacher half of SUPABASE_ADD_TEST_ADMIN_ACCOUNTS.sql (2026-08
-- -ish; that account + its isolated "ADMIN QA" class were deleted 2026-08-28
-- in favor of the Admin Access Code impersonation feature). This time the
-- requirement is different: the account must see EVERY real class/subject,
-- not sit in its own isolated empty class - impersonation was explicitly
-- ruled out because it still means logging into a real person's account.
--
-- EMP999 follows this project's existing "999 = reserved/non-real" convention
-- (ADMIN QA class has sort_order = 999; EMP900 is the separate "Play Store
-- Reviewer" account) - clearly not a real employee number.
--
-- How "sees everything" is actually achieved (two different mechanisms,
-- both additive, neither touches any real teacher/class row):
--   1. subject_mappings (every real subject -> every real class currently in
--      class_subjects) - this only drives the Flutter app's own UI picker
--      defaults (lib/core/utils/teacher_classes.dart); it is NOT read by any
--      server-side permission check.
--   2. section_supporting_teachers - one row per real, active section. THIS
--      is what the server-side is_teacher_of_class() RPC gate actually
--      checks, so it's what really grants read access to every class's
--      homework/exams/syllabus/marks and lets attendance be marked for every
--      class (Group A/B/C of REQ-SEC-002's session-token RPCs all gate on
--      is_teacher_of_class). Any teacher may already CREATE homework/exams
--      for any class regardless (see teacher_classes.dart) - this only
--      affects READ, which was the gated half.
--
-- Deliberately NOT touched, and why:
--   - `timetables` (the shared day/period grid) - it keys off a plain
--     `teacher = employees.name` text match with no permission layer of its
--     own, shared by every real student's and teacher's live schedule
--     display. Writing this account's name into it would silently replace
--     real teachers' names on real class schedules school-wide. Accepted
--     tradeoff, confirmed with the project owner: this account's own "My
--     Timetable" tab stays empty; every other feature is fully populated.
--   - `employees.class_teacher_of_section_id` - left NULL, so this account
--     never displaces a real section's actual class teacher anywhere.
--
-- Admin Workspace (management-tier) access is a SEPARATE manual step after
-- this runs - it needs a real Supabase Auth login, which requires the
-- service-role key and must go through the admin panel's own "Add User"
-- UI (Settings -> Users & Roles), never through this SQL connection. Once
-- that login exists, link it with:
--   UPDATE employees SET admin_user_id = '<new admin_users.id>'
--   WHERE emp_code = 'EMP999';
--
-- Default app_password (Satyam@123 - same default every new employee row
-- gets project-wide) applies automatically since it's omitted below.
--
-- Idempotent - safe to re-run. Run in Supabase Dashboard -> SQL Editor, top
-- to bottom, once.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_emp_id   uuid;
  v_mappings jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM employees WHERE emp_code = 'EMP999') THEN
    SELECT jsonb_agg(jsonb_build_object('subject', subject_name, 'classes', classes))
    INTO v_mappings
    FROM (
      SELECT subject_name, jsonb_agg(DISTINCT class_name) AS classes
      FROM class_subjects
      WHERE class_name <> 'ADMIN QA'
      GROUP BY subject_name
    ) s;

    INSERT INTO employees (
      emp_code, name, phone, type, designation, department,
      employment_type, joining_date, status, subject_mappings
    ) VALUES (
      'EMP999', 'ZZ-TEST Satyam', '9999999999', 'teaching',
      'Test Account (QA - Full Access)', 'Administration',
      'Permanent', CURRENT_DATE, 'Active', COALESCE(v_mappings, '[]'::jsonb)
    );
  END IF;

  SELECT id INTO v_emp_id FROM employees WHERE emp_code = 'EMP999';

  -- Supporting-teacher row for every real, active section - the actual
  -- server-side is_teacher_of_class() gate. Additive only.
  INSERT INTO section_supporting_teachers (section_id, employee_id)
  SELECT sec.id, v_emp_id
  FROM sections sec
  JOIN classes c ON c.id = sec.class_id
  WHERE c.is_active = true
  ON CONFLICT (section_id, employee_id) DO NOTHING;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Login credentials (Teacher app, "Have an Admin Access Code?" NOT needed -
-- log in normally with these):
-- ─────────────────────────────────────────────────────────────────────────────
SELECT emp_code AS staff_login_id, 'Satyam@123' AS password, name
FROM employees WHERE emp_code = 'EMP999';
