-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENT HELP DESK: class teacher / supporting teacher(s) / admin office
-- number(s) / principal, all in one call for the student app's Help Desk screen.
-- Run this in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin/office numbers shown on the student Help Desk screen — any count,
-- configured in admin-panel Settings → School Profile.
CREATE TABLE IF NOT EXISTS helpdesk_admin_numbers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label      TEXT NOT NULL,
  phone      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Re-assert the known-good student_login shape (class_id/section_id/class_name/
-- section_name) — a later ad-hoc SQL file in this repo's history reverted this
-- function to a version without those fields, and Help Desk needs section_id
-- to look up the class teacher / supporting teachers. Safe no-op if the
-- function already returns these fields.
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

-- One call for the whole Help Desk screen: class teacher, supporting
-- teacher(s), admin numbers, and principal, in the display order needed.
CREATE OR REPLACE FUNCTION get_student_helpdesk_contacts(p_section_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_class_teacher JSON;
  v_supporting    JSON;
  v_admins        JSON;
  v_principal     JSON;
BEGIN
  IF p_section_id IS NOT NULL THEN
    SELECT json_build_object('name', e.name, 'phone', e.phone) INTO v_class_teacher
    FROM employees e
    WHERE e.class_teacher_of_section_id = p_section_id::UUID
    LIMIT 1;

    SELECT COALESCE(json_agg(json_build_object('name', e.name, 'phone', e.phone) ORDER BY sst.created_at), '[]'::json)
    INTO v_supporting
    FROM section_supporting_teachers sst
    JOIN employees e ON e.id = sst.employee_id
    WHERE sst.section_id = p_section_id::UUID;
  END IF;

  SELECT COALESCE(json_agg(json_build_object('label', label, 'phone', phone) ORDER BY sort_order), '[]'::json)
  INTO v_admins
  FROM helpdesk_admin_numbers;

  SELECT json_build_object('name', e.name, 'phone', e.phone) INTO v_principal
  FROM employees e
  WHERE e.designation = 'Principal' AND e.status = 'Active'
  ORDER BY e.created_at
  LIMIT 1;

  RETURN json_build_object(
    'class_teacher',       v_class_teacher,
    'supporting_teachers', COALESCE(v_supporting, '[]'::json),
    'admins',              COALESCE(v_admins, '[]'::json),
    'principal',           v_principal
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_student_helpdesk_contacts(TEXT) TO anon;
