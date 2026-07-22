-- "My Students" module (teacher app): a proper student-personal-details list,
-- separate from Mark Attendance. get_class_students() only ever returned
-- roster fields (name/roll/photo) - fine for taking attendance, but the new
-- module needs actual personal details, so this adds a second RPC alongside
-- it rather than widening get_class_students (which stays lean for the
-- attendance screen's per-day fetch).
CREATE OR REPLACE FUNCTION get_class_students_details(p_section_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        s.id, s.first_name, s.last_name, s.grno, s.photo_url,
        s.dob, s.gender, s.mobile1, s.mobile2,
        s.father_name, s.mother_name,
        s.address, s.society, s.landmark, s.area, s.pincode,
        e.enrollment_no, e.roll_no
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id
      WHERE e.section_id = p_section_id::UUID
      ORDER BY e.roll_no, s.first_name
    ) r
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_class_students_details(TEXT) TO anon;
