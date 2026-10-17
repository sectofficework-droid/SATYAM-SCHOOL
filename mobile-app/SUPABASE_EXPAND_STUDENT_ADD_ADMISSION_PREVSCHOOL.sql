-- REQ-FEAT-016 (2026-10-17) - user asked for the Teacher app's Add Student
-- form to be "sequenced according to admin panel new import", then chose
-- "full parity incl. Admission Info" when asked whether that also means
-- adding the fields the admin panel's Replace Full Details import template
-- has that mobile never collected: GR Number, Roll No override, Date of
-- Join, Fee Total, Discount Amount/Reason (all real `student_enrollments`/
-- `students` columns - confirmed via admin-panel/src/lib/studentService.js,
-- not a guess), plus the entire Previous School block, which lives in its
-- own `student_previous_school` table (schema.sql), not on `students` at
-- all.
--
-- New overload (additive, same pattern as SUPABASE_EXPAND_STUDENT_ADD_
-- FULL_FIELDS.sql's 39-arg one) - appends 15 more DEFAULT NULL params after
-- the existing 39, so this is a new function signature, not a breaking
-- change. The original 11-arg and 39-arg overloads are both untouched and
-- still resolvable by PostgREST for any caller that only sends their
-- narrower param set.
CREATE OR REPLACE FUNCTION public.staff_admin_student_add(
  p_employee_id uuid, p_first_name text, p_last_name text, p_dob date, p_gender text,
  p_father_name text, p_mother_name text, p_mobile1 text,
  p_class_id uuid, p_section_id uuid, p_address text,
  p_mobile2 text DEFAULT NULL,
  p_religion text DEFAULT NULL, p_caste text DEFAULT NULL, p_sub_caste text DEFAULT NULL,
  p_mother_tongue text DEFAULT NULL, p_height_cm numeric DEFAULT NULL, p_weight_kg numeric DEFAULT NULL,
  p_room_plot_no text DEFAULT NULL, p_society text DEFAULT NULL, p_landmark text DEFAULT NULL,
  p_area text DEFAULT NULL, p_pincode text DEFAULT NULL,
  p_aadhar text DEFAULT NULL, p_aadhar_name text DEFAULT NULL,
  p_father_aadhar text DEFAULT NULL, p_father_aadhar_name text DEFAULT NULL,
  p_mother_aadhar text DEFAULT NULL, p_mother_aadhar_name text DEFAULT NULL,
  p_place_of_birth text DEFAULT NULL,
  p_birth_city text DEFAULT NULL, p_birth_village text DEFAULT NULL,
  p_birth_district text DEFAULT NULL, p_birth_state text DEFAULT NULL,
  p_birth_cert_reg_no text DEFAULT NULL, p_birth_cert_reg_date date DEFAULT NULL,
  p_udise text DEFAULT NULL, p_pen text DEFAULT NULL, p_apaar text DEFAULT NULL,
  -- Admission Info (new)
  p_gr_no text DEFAULT NULL, p_roll_no int DEFAULT NULL, p_date_of_join date DEFAULT NULL,
  p_admission_class_id uuid DEFAULT NULL,
  p_fee_total numeric DEFAULT NULL, p_discount_amount numeric DEFAULT NULL, p_discount_reason text DEFAULT NULL,
  -- Previous School (new)
  p_last_school_name text DEFAULT NULL, p_last_school_grno text DEFAULT NULL, p_last_school_class text DEFAULT NULL,
  p_last_school_medium text DEFAULT NULL, p_last_school_place text DEFAULT NULL,
  p_prev_attendance_days int DEFAULT NULL, p_last_exam_given boolean DEFAULT NULL, p_prev_percentage numeric DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_year_id uuid;
  v_next_enr text;
  v_next_roll int;
BEGIN
  IF staff_admin_tier(p_employee_id) IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT id INTO v_year_id FROM academic_years WHERE is_current = true LIMIT 1;
  IF v_year_id IS NULL THEN RAISE EXCEPTION 'No current academic year set'; END IF;

  INSERT INTO students (
    first_name, last_name, dob, gender, father_name, mother_name, mobile1, address, status, data_status,
    mobile2, religion, caste, sub_caste, mother_tongue, height_cm, weight_kg,
    room_plot_no, society, landmark, area, pincode,
    aadhar, aadhar_name, father_aadhar, father_aadhar_name, mother_aadhar, mother_aadhar_name,
    place_of_birth, birth_city, birth_village, birth_district, birth_state,
    birth_cert_reg_no, birth_cert_reg_date, udise, pen, apaar, grno
  )
  VALUES (
    p_first_name, COALESCE(p_last_name, ''), p_dob, p_gender, p_father_name, p_mother_name, p_mobile1, p_address, 'Active', 'Complete',
    p_mobile2, p_religion, p_caste, p_sub_caste, p_mother_tongue, p_height_cm, p_weight_kg,
    p_room_plot_no, p_society, p_landmark, p_area, p_pincode,
    p_aadhar, p_aadhar_name, p_father_aadhar, p_father_aadhar_name, p_mother_aadhar, p_mother_aadhar_name,
    p_place_of_birth, p_birth_city, p_birth_village, p_birth_district, p_birth_state,
    p_birth_cert_reg_no, p_birth_cert_reg_date, p_udise, p_pen, p_apaar, p_gr_no
  )
  RETURNING * INTO v_student;

  SELECT lpad((COALESCE(max(enrollment_no::int), 0) + 1)::text, 4, '0') INTO v_next_enr FROM student_enrollments;

  IF p_roll_no IS NOT NULL THEN
    v_next_roll := p_roll_no;
  ELSE
    SELECT COALESCE(max(roll_no), 0) + 1 INTO v_next_roll
      FROM student_enrollments WHERE class_id = p_class_id AND section_id = p_section_id AND academic_year_id = v_year_id;
  END IF;

  INSERT INTO student_enrollments (
    student_id, academic_year_id, enrollment_no, class_id, section_id, roll_no, date_of_join, admission_class_id,
    fee_total, fee_discount, discount_reason
  )
  VALUES (
    v_student.id, v_year_id, v_next_enr, p_class_id, p_section_id, v_next_roll,
    COALESCE(p_date_of_join, CURRENT_DATE), COALESCE(p_admission_class_id, p_class_id),
    COALESCE(p_fee_total, 0), COALESCE(p_discount_amount, 0), p_discount_reason
  );

  IF p_last_school_name IS NOT NULL AND trim(p_last_school_name) <> '' THEN
    INSERT INTO student_previous_school (
      student_id, school_name, grno, class, medium, place, attendance_days, last_exam_given, percentage
    )
    VALUES (
      v_student.id, p_last_school_name, p_last_school_grno, p_last_school_class, p_last_school_medium,
      p_last_school_place, p_prev_attendance_days, p_last_exam_given, p_prev_percentage
    );
  END IF;

  RETURN json_build_object('id', v_student.id, 'enrollment_no', v_next_enr, 'roll_no', v_next_roll);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_admin_student_add(
  uuid, text, text, date, text, text, text, text, uuid, uuid, text,
  text, text, text, text, text, numeric, numeric, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, date, text, text, text,
  text, int, date, uuid, numeric, numeric, text,
  text, text, text, text, text, int, boolean, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_add(
  uuid, text, text, date, text, text, text, text, uuid, uuid, text,
  text, text, text, text, text, numeric, numeric, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, date, text, text, text,
  text, int, date, uuid, numeric, numeric, text,
  text, text, text, text, text, int, boolean, numeric
) TO anon;

-- Verify live before relying on this: confirm `student_enrollments` actually
-- has `fee_total`/`fee_discount`/`discount_reason`/`admission_class_id`
-- columns under those exact names (studentService.js's updateStudent()
-- read/write path says so, but that file was last touched 2026-10 and
-- schema.sql is documented stale elsewhere in this project - re-check via
-- information_schema.columns if this errors).
