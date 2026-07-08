-- ─────────────────────────────────────────────────────────────────────────────
-- App Auth: Employee ID + Password (no Supabase Auth required)
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add app_password to employees (default: Satyam@123)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS app_password TEXT DEFAULT 'Satyam@123';

-- Add app_password to students (default: Satyam@123)
ALTER TABLE students ADD COLUMN IF NOT EXISTS app_password TEXT DEFAULT 'Satyam@123';

-- ── Login RPC functions (SECURITY DEFINER bypasses RLS) ───────────────────────

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
  WHERE UPPER(TRIM(employee_id)) = UPPER(TRIM(p_employee_id))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION student_login(p_enrollment_no TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row students%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM students
  WHERE UPPER(TRIM(enrollment_no)) = UPPER(TRIM(p_enrollment_no))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$$;

-- ── Data RPCs (SECURITY DEFINER so anon key can read protected tables) ────────

CREATE OR REPLACE FUNCTION get_class_students(p_class TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(s))
    FROM (
      SELECT id, full_name, enrollment_no, roll_no, photo_url
      FROM students
      WHERE class = p_class
      ORDER BY full_name
    ) s
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_student_fees(p_student_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(f))
    FROM (
      SELECT * FROM fees
      WHERE student_id = p_student_id
      ORDER BY created_at DESC
    ) f
  );
END;
$$;

-- ── Allow anon key to call RPCs and read app tables ───────────────────────────

GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT)   TO anon;
GRANT EXECUTE ON FUNCTION student_login(TEXT, TEXT)   TO anon;
GRANT EXECUTE ON FUNCTION get_class_students(TEXT)    TO anon;
GRANT EXECUTE ON FUNCTION get_student_fees(UUID)      TO anon;

-- App tables are not user-specific so allow anon read
ALTER TABLE student_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE homework           DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams              DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_marks         DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON student_attendance TO anon;
GRANT SELECT, INSERT          ON homework           TO anon;
GRANT SELECT                  ON exams              TO anon;
GRANT SELECT, INSERT, UPDATE  ON exam_marks         TO anon;
GRANT SELECT                  ON notices            TO anon;
