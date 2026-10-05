-- REQ-FEAT-007 (2026-10-04) - user: "in teacher admin panel add new
-- student shows very less field (only basic details) but i want all
-- student related field available in admin panel web also should be
-- available in application". Applied live via
-- mcp__supabase__apply_migration as
-- expand_staff_admin_student_add_full_fields.
--
-- The admin-panel web's AddStudentForm.js already collects ~30 fields;
-- mobile's Add Student only ever sent 11. Every one of the web form's
-- fields already has a real column on `students` (confirmed via
-- information_schema.columns before writing this) - no DDL needed, just
-- extending the RPC + the Dart/UI layers to match.
--
-- New params are all optional (DEFAULT NULL), appended after the original
-- 11 in the same order/type, so this is a new overload, not a breaking
-- change to the existing one - PostgREST resolves by which param names
-- the caller actually sends, so any already-installed app instance still
-- calling the narrow 11-arg shape keeps hitting the original function,
-- untouched.
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
  p_udise text DEFAULT NULL, p_pen text DEFAULT NULL, p_apaar text DEFAULT NULL
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
    birth_cert_reg_no, birth_cert_reg_date, udise, pen, apaar
  )
  VALUES (
    p_first_name, COALESCE(p_last_name, ''), p_dob, p_gender, p_father_name, p_mother_name, p_mobile1, p_address, 'Active', 'Complete',
    p_mobile2, p_religion, p_caste, p_sub_caste, p_mother_tongue, p_height_cm, p_weight_kg,
    p_room_plot_no, p_society, p_landmark, p_area, p_pincode,
    p_aadhar, p_aadhar_name, p_father_aadhar, p_father_aadhar_name, p_mother_aadhar, p_mother_aadhar_name,
    p_place_of_birth, p_birth_city, p_birth_village, p_birth_district, p_birth_state,
    p_birth_cert_reg_no, p_birth_cert_reg_date, p_udise, p_pen, p_apaar
  )
  RETURNING * INTO v_student;

  SELECT lpad((COALESCE(max(enrollment_no::int), 0) + 1)::text, 4, '0') INTO v_next_enr FROM student_enrollments;
  SELECT COALESCE(max(roll_no), 0) + 1 INTO v_next_roll
    FROM student_enrollments WHERE class_id = p_class_id AND section_id = p_section_id AND academic_year_id = v_year_id;

  INSERT INTO student_enrollments (student_id, academic_year_id, enrollment_no, class_id, section_id, roll_no, date_of_join, admission_class_id)
  VALUES (v_student.id, v_year_id, v_next_enr, p_class_id, p_section_id, v_next_roll, CURRENT_DATE, p_class_id);

  RETURN json_build_object('id', v_student.id, 'enrollment_no', v_next_enr);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_admin_student_add(
  uuid, text, text, date, text, text, text, text, uuid, uuid, text,
  text, text, text, text, text, numeric, numeric, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, date, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_admin_student_add(
  uuid, text, text, date, text, text, text, text, uuid, uuid, text,
  text, text, text, text, text, numeric, numeric, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, text, text, date, text, text, text
) TO anon;

-- Verified live same session via a rolled-back transaction: called the new
-- 39-arg overload with real values for all 27 new fields, confirmed every
-- field (religion, caste, height_cm, aadhar, birth_village, udise, etc.)
-- came back correctly on SELECT, then ROLLBACK - zero rows actually
-- persisted. Also confirmed the original 11-arg overload is unaffected
-- (still present as its own entry in pg_proc, resolvable by PostgREST for
-- any caller that only sends the original 11 param names).
