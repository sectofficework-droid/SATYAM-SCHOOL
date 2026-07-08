-- Fix column names in RPC functions to match actual DB schema
-- Run this in Supabase Dashboard → SQL Editor

-- Fix existing rows (set default password)
UPDATE employees SET app_password = 'Satyam@123' WHERE app_password IS NULL;
UPDATE students  SET app_password = 'Satyam@123' WHERE app_password IS NULL;

-- ── Teacher login: use emp_code ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION teacher_login(p_employee_id TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row employees%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM employees
  WHERE UPPER(TRIM(emp_code)) = UPPER(TRIM(p_employee_id))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$$;

-- ── Student login: enrollment_no is in student_enrollments table ───────────
CREATE OR REPLACE FUNCTION student_login(p_enrollment_no TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student    students%ROWTYPE;
  v_enrollment student_enrollments%ROWTYPE;
BEGIN
  -- Find the enrollment record matching the enrollment_no (handles 0001 = 1)
  SELECT * INTO v_enrollment
  FROM student_enrollments
  WHERE enrollment_no::BIGINT = TRIM(p_enrollment_no)::BIGINT;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Find the student and check password
  SELECT * INTO v_student
  FROM students
  WHERE id = v_enrollment.student_id
    AND app_password = p_password;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Return combined student + enrollment data
  RETURN json_build_object(
    'id',            v_student.id,
    'first_name',    v_student.first_name,
    'last_name',     v_student.last_name,
    'grno',          v_student.grno,
    'photo_url',     v_student.photo_url,
    'dob',           v_student.dob,
    'gender',        v_student.gender,
    'father_name',   v_student.father_name,
    'mother_name',   v_student.mother_name,
    'mobile1',       v_student.mobile1,
    'address',       v_student.address,
    'enrollment_no', v_enrollment.enrollment_no,
    'roll_no',       v_enrollment.roll_no,
    'class_id',      v_enrollment.class_id,
    'section_id',    v_enrollment.section_id
  );
END;
$$;

-- ── Get students for a section (teacher's class) ───────────────────────────
-- p_section_id = teacher's class_teacher_of_section_id value
CREATE OR REPLACE FUNCTION get_class_students(p_section_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.grno,
        s.photo_url,
        e.enrollment_no,
        e.roll_no
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id
      WHERE e.section_id = p_section_id::UUID
      ORDER BY e.roll_no, s.first_name
    ) r
  );
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT)  TO anon;
GRANT EXECUTE ON FUNCTION student_login(TEXT, TEXT)  TO anon;
GRANT EXECUTE ON FUNCTION get_class_students(TEXT)   TO anon;

-- ── Check data (run these lines separately to verify) ─────────────────────
-- SELECT enrollment_no, student_id FROM student_enrollments LIMIT 5;
-- SELECT student_login('1', 'Satyam@123');
-- SELECT emp_code, name FROM employees LIMIT 5;
