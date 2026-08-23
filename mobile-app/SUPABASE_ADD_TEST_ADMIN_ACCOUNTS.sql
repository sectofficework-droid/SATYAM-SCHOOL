-- ─────────────────────────────────────────────────────────────────────────────
-- Adds one permanent test/admin login for the student app and one for the
-- staff (teacher) app, so the admin can QA either app without ever borrowing
-- a real student's or real staff member's credentials.
--
-- The test student is enrolled in its own dedicated class+section
-- ("ADMIN QA" / section "A", is_active = false) instead of a real class, so
-- it never shows up in any teacher's attendance list, "My Students", fee
-- collection, promotion, or exam-marks screens, and never counts toward
-- class strength. The test employee has no class_teacher_of_section_id and
-- no subject_mappings, so it likewise never shows up as a real class's
-- teacher anywhere.
--
-- Both accounts get the same default app_password every new row gets
-- (Satyam@123, hashed at insert time via the column default fixed in
-- SUPABASE_FIX_DEFAULT_PASSWORD_HASH.sql) - login the same way any new
-- student/employee would, then change the password from the app's own
-- Settings screen if desired.
--
-- Idempotent - safe to re-run. Skips creating the class/section/rows if
-- they already exist from a previous run.
--
-- Run this in Supabase Dashboard -> SQL Editor, top to bottom, once.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_class_id      UUID;
  v_section_id    UUID;
  v_year_id       UUID;
  v_student_id    UUID;
  v_enrollment_no TEXT;
BEGIN
  -- 1) Dedicated, inactive (hidden from every class picker) test class/section
  SELECT id INTO v_class_id FROM classes WHERE name = 'ADMIN QA';
  IF v_class_id IS NULL THEN
    INSERT INTO classes (name, sort_order, is_active)
    VALUES ('ADMIN QA', 999, false)
    RETURNING id INTO v_class_id;
  END IF;

  SELECT id INTO v_section_id FROM sections WHERE class_id = v_class_id AND name = 'A';
  IF v_section_id IS NULL THEN
    INSERT INTO sections (class_id, name) VALUES (v_class_id, 'A')
    RETURNING id INTO v_section_id;
  END IF;

  SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;

  -- 2) Test student (only if not already created)
  IF NOT EXISTS (SELECT 1 FROM students WHERE first_name = 'ADMIN' AND last_name = 'TESTSTUDENT') THEN
    INSERT INTO students (first_name, last_name, dob, gender, father_name, mother_name, mobile1, status)
    VALUES ('ADMIN', 'TESTSTUDENT', '2000-01-01', 'Male', 'ADMIN', 'ADMIN', '9999999999', 'Active')
    RETURNING id INTO v_student_id;

    SELECT LPAD((COALESCE(MAX(enrollment_no::INT), 0) + 1)::TEXT, 4, '0') INTO v_enrollment_no
    FROM student_enrollments;

    INSERT INTO student_enrollments (
      student_id, academic_year_id, enrollment_no, class_id, section_id,
      roll_no, date_of_join, admission_class_id
    ) VALUES (
      v_student_id, v_year_id, v_enrollment_no, v_class_id, v_section_id,
      1, CURRENT_DATE, v_class_id
    );
  END IF;

  -- 3) Test staff/employee (only if not already created)
  IF NOT EXISTS (SELECT 1 FROM employees WHERE name = 'ADMIN TESTSTAFF') THEN
    INSERT INTO employees (emp_code, name, phone, type, designation, department, status, employment_type, joining_date)
    SELECT
      'EMP' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(emp_code, '\D', '', 'g'), '')::INT), 0) + 1)::TEXT, 3, '0'),
      'ADMIN TESTSTAFF', '9999999999', 'teaching', 'Test Account (QA)', 'Administration', 'Active', 'Permanent', CURRENT_DATE
    FROM employees;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: these two SELECTs return the login credentials to use.
-- Password for both is the default: Satyam@123
-- ─────────────────────────────────────────────────────────────────────────────

SELECT se.enrollment_no AS student_login_id, 'Satyam@123' AS password
FROM student_enrollments se
JOIN students s ON s.id = se.student_id
WHERE s.first_name = 'ADMIN' AND s.last_name = 'TESTSTUDENT';

SELECT emp_code AS staff_login_id, 'Satyam@123' AS password
FROM employees
WHERE name = 'ADMIN TESTSTAFF';
