-- ─────────────────────────────────────────────────────────────────────────────
-- SUPPORTING TEACHERS: let a section have any number of extra teachers who
-- get the same mobile-app access as the Class Teacher (roster, attendance,
-- marks) when they don't have a homeroom class of their own.
-- Run this in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS section_supporting_teachers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id  UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (section_id, employee_id)
);

-- teacher_login: grant a supporting teacher the same section access as the
-- class teacher (class_teacher_of_section_id) when they have no class of
-- their own. Downstream RPCs (get_class_students, attendance, marks) only
-- take a section_id parameter and don't re-check who "owns" it, so
-- resolving the right section_id here is sufficient for full access.
--
-- Note: if the same employee is added as a supporting teacher to more than
-- one section, only the earliest-added one is used here — the app is built
-- around a single "my section" per teacher throughout (attendance, marks,
-- students, dashboard, profile all read one class_teacher_of_section_id).
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
    AND app_password = p_password;
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
GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT) TO anon;
