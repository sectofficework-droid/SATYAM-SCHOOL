-- ─────────────────────────────────────────────────────────────────────────────
-- Birthdays module v2: the mobile "Birthdays" page now shows every student
-- and staff member's birthday across the whole academic year (Jun 1 - May
-- 31), grouped by date and scrollable, not just today - get_todays_birthdays
-- (SUPABASE_BIRTHDAYS.sql) stays as-is for the admin dashboard's "today"
-- cards. Same SECURITY DEFINER reasoning as that function: students/
-- employees RLS only lets each row's own owner read it, so this returns
-- only the non-sensitive fields actually needed, for everyone with a dob on
-- file rather than filtering by date server-side.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_all_birthdays()
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
        ORDER BY s.first_name
      ) r
    ),
    'staff', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) FROM (
        SELECT e.id, e.name, e.designation, e.department, e.photo_url, e.dob
        FROM employees e
        WHERE e.dob IS NOT NULL
          AND e.status = 'Active'
        ORDER BY e.name
      ) r
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_birthdays() TO anon, authenticated;
