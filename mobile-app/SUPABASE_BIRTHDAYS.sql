-- ─────────────────────────────────────────────────────────────────────────────
-- Birthdays module: who has a birthday today, students and staff shown
-- separately. students/employees have RLS restricting SELECT to the row's
-- own owner (app_user_id = auth.uid()) - and the mobile apps authenticate
-- via the custom student_login/teacher_login RPCs (SECURITY DEFINER, no real
-- Supabase Auth session), so auth.uid() is always null for them and a plain
-- `.from("students")` select would return nothing for anyone but that exact
-- row. Same reasoning as get_class_students/get_class_students_by_name:
-- a SECURITY DEFINER RPC that returns only the few non-sensitive fields
-- actually needed (name, dob, photo, class/designation) - never phone,
-- address, aadhar, etc. - for the handful of people whose birthday is today.
-- Reused as-is by the admin panel too, so the numbers can never drift
-- between the two.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_todays_birthdays()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'students', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
        SELECT s.id, s.first_name, s.last_name, s.photo_url, s.dob,
               c.name AS class_name, sec.name AS section_name
        FROM students s
        JOIN student_enrollments e ON e.student_id = s.id
        JOIN academic_years ay     ON ay.id = e.academic_year_id AND ay.is_current = true
        JOIN sections sec          ON sec.id = e.section_id
        JOIN classes c             ON c.id = sec.class_id
        WHERE s.dob IS NOT NULL
          AND EXTRACT(MONTH FROM s.dob) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY   FROM s.dob) = EXTRACT(DAY   FROM CURRENT_DATE)
        ORDER BY s.first_name
      ) r
    ),
    'staff', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
        SELECT e.id, e.name, e.designation, e.department, e.photo AS photo_url, e.dob
        FROM employees e
        WHERE e.dob IS NOT NULL
          AND e.status = 'Active'
          AND EXTRACT(MONTH FROM e.dob) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY   FROM e.dob) = EXTRACT(DAY   FROM CURRENT_DATE)
        ORDER BY e.name
      ) r
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_todays_birthdays() TO anon, authenticated;
