-- ─────────────────────────────────────────────────────────────────────────────
-- Fix teacher_login / student_login regression from REQ-SEC-001
-- Run in Supabase Dashboard -> SQL Editor, top to bottom, once.
--
-- What broke: SUPABASE_HASH_APP_PASSWORD.sql (2026-08-21) redefined
-- teacher_login/student_login using stale column names that were never
-- actually correct on the live schema:
--   - teacher_login compared against "employee_id" - employees' real column
--     is emp_code.
--   - student_login compared against "enrollment_no" directly on students -
--     that column lives on student_enrollments, not students.
-- Both calls now fail with a Postgres "column does not exist" error on every
-- single login attempt (confirmed live via direct RPC calls with the app's
-- own anon key - reproducible right now). This is a regression of a bug that
-- was already fixed once before (SUPABASE_FIX_COLUMNS.sql,
-- SUPABASE_TEACHER_CLASS_FIX.sql, SUPABASE_SUPPORTING_TEACHERS.sql,
-- SUPABASE_HELPDESK.sql) - this file restores that correct logic (section
-- resolution for supporting teachers, class/section names, enrollment
-- number, roll number) while keeping the bcrypt compare from yesterday's
-- migration (crypt() against the hashed app_password, never returning
-- app_password itself).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION teacher_login(p_employee_id TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp        employees%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
  v_section_id UUID;
  v_is_support BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_emp FROM employees
  WHERE UPPER(TRIM(emp_code)) = UPPER(TRIM(p_employee_id))
    AND app_password = crypt(p_password, app_password);
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_section_id := v_emp.class_teacher_of_section_id;

  IF v_section_id IS NULL THEN
    SELECT section_id INTO v_section_id
    FROM section_supporting_teachers
    WHERE employee_id = v_emp.id
    ORDER BY created_at
    LIMIT 1;
    IF v_section_id IS NOT NULL THEN v_is_support := TRUE; END IF;
  END IF;

  IF v_section_id IS NOT NULL THEN
    SELECT c.name, sec.name INTO v_cls_name, v_sec_name
    FROM sections sec
    JOIN classes c ON c.id = sec.class_id
    WHERE sec.id = v_section_id;
  END IF;

  RETURN json_build_object(
    'id',                          v_emp.id,
    'emp_code',                    v_emp.emp_code,
    'name',                        v_emp.name,
    'type',                        v_emp.type,
    'designation',                 v_emp.designation,
    'department',                  v_emp.department,
    'phone',                       v_emp.phone,
    'email',                       v_emp.email,
    'photo_url',                   v_emp.photo_url,
    'class_teacher_of_section_id', v_section_id,
    'is_supporting_teacher',       v_is_support,
    'subject_mappings',            v_emp.subject_mappings,
    'class_name',                  v_cls_name,
    'section_name',                v_sec_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION student_login(p_enrollment_no TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student    students%ROWTYPE;
  v_enrollment student_enrollments%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
BEGIN
  SELECT * INTO v_enrollment FROM student_enrollments
  WHERE enrollment_no::BIGINT = TRIM(p_enrollment_no)::BIGINT;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_student FROM students
  WHERE id = v_enrollment.student_id
    AND app_password = crypt(p_password, app_password);
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_enrollment.class_id IS NOT NULL THEN
    SELECT c.name INTO v_cls_name FROM classes c WHERE c.id = v_enrollment.class_id;
  END IF;
  IF v_enrollment.section_id IS NOT NULL THEN
    SELECT sec.name INTO v_sec_name FROM sections sec WHERE sec.id = v_enrollment.section_id;
  END IF;

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
    'section_id',    v_enrollment.section_id,
    'class_name',    v_cls_name,
    'section_name',  v_sec_name
  );
END;
$$;

-- CREATE OR REPLACE preserves existing GRANTs, but re-asserting is harmless
-- and matches this repo's convention of every login-touching file doing so.
GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION student_login(TEXT, TEXT) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: test both functions directly, then via the apps.
--   SELECT teacher_login('<a real emp_code>', '<their current password>');
--   SELECT student_login('<a real enrollment_no>', '<their current password>');
-- Both should return a JSON object (not NULL, not an error).
-- ─────────────────────────────────────────────────────────────────────────────
