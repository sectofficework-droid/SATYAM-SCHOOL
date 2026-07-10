-- ─────────────────────────────────────────────────────────────────────────────
-- TEACHER + STUDENT LOGIN FIX: return class_name and section_name
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── teacher_login: join sections + classes to return readable names ───────────
CREATE OR REPLACE FUNCTION teacher_login(p_employee_id TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp      employees%ROWTYPE;
  v_cls_name TEXT;
  v_sec_name TEXT;
BEGIN
  SELECT * INTO v_emp FROM employees
  WHERE UPPER(TRIM(emp_code)) = UPPER(TRIM(p_employee_id))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_emp.class_teacher_of_section_id IS NOT NULL THEN
    SELECT c.name, sec.name INTO v_cls_name, v_sec_name
    FROM sections sec
    JOIN classes c ON c.id = sec.class_id
    WHERE sec.id = v_emp.class_teacher_of_section_id;
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
    'class_teacher_of_section_id', v_emp.class_teacher_of_section_id,
    'subject_mappings',            v_emp.subject_mappings,
    'class_name',                  v_cls_name,
    'section_name',                v_sec_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT) TO anon;

-- ── student_login: join classes + sections to return readable names ───────────
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
  WHERE id = v_enrollment.student_id AND app_password = p_password;
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
GRANT EXECUTE ON FUNCTION student_login(TEXT, TEXT) TO anon;
