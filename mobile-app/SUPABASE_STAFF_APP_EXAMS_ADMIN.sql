-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace, slice 2 of "port remaining web admin modules":
-- Exams (Settings -> Exams tab) - Monthly Test default max marks, read-only
-- Monthly Tests visibility, and Official Exams CRUD + per-class/subject max
-- marks config.
--
-- Same staff_admin_tier()-gated pattern (senior_admin/management only,
-- matching the web Settings page's gate) for every write and for any read
-- that needs an employees/students name join - anon has no SELECT grant on
-- either table, so those joins must happen inside a SECURITY DEFINER
-- function. Reads with no such join (school_profile.monthly_test_max_marks,
-- official_exams, official_exam_subject_config, academic_years,
-- class_subjects) stay direct Flutter table selects - anon already has
-- SELECT on all of those.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Monthly Test default max marks ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_save_monthly_test_max_marks(p_employee_id UUID, p_max_marks INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_max_marks IS NULL OR p_max_marks <= 0 THEN RAISE EXCEPTION 'invalid_max_marks'; END IF;

  UPDATE school_profile SET monthly_test_max_marks = p_max_marks, updated_at = now() WHERE id IS NOT NULL;
END;
$$;

-- ── Monthly Tests (freeform, teacher-created) — read-only visibility ──────
CREATE OR REPLACE FUNCTION staff_admin_monthly_tests(p_employee_id UUID)
RETURNS TABLE(o_id UUID, o_name TEXT, o_class TEXT, o_subject TEXT, o_date DATE, o_max_marks NUMERIC, o_teacher_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT e.id, e.name, e.class, e.subject, e.date, e.max_marks, emp.name
    FROM exams e
    LEFT JOIN employees emp ON emp.id = e.created_by
    ORDER BY e.date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_monthly_test_marks(p_employee_id UUID, p_exam_id UUID)
RETURNS TABLE(o_student_id UUID, o_name TEXT, o_marks NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT m.student_id, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), m.marks_obtained
    FROM exam_marks m
    LEFT JOIN students s ON s.id = m.student_id
    WHERE m.exam_id = p_exam_id
    ORDER BY 2;
END;
$$;

-- ── Official Exams CRUD ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_official_exam_create(
  p_employee_id UUID, p_name TEXT, p_start_date DATE, p_end_date DATE, p_academic_year_id UUID, p_sort_order INT
)
RETURNS official_exams
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row official_exams%ROWTYPE;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO official_exams (name, start_date, end_date, academic_year_id, sort_order)
  VALUES (p_name, p_start_date, p_end_date, p_academic_year_id, p_sort_order)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_official_exam_update(
  p_employee_id UUID, p_id UUID, p_name TEXT, p_start_date DATE, p_end_date DATE, p_sort_order INT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE official_exams
  SET name = p_name, start_date = p_start_date, end_date = p_end_date, sort_order = p_sort_order, updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_official_exam_delete(p_employee_id UUID, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  DELETE FROM official_exams WHERE id = p_id;
END;
$$;

-- ── Official Exam per-class/subject max marks ──────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_exam_subject_max_marks_save(
  p_employee_id UUID, p_exam_id UUID, p_class_name TEXT, p_subject_name TEXT, p_max_marks INT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO official_exam_subject_config (exam_id, class_name, subject_name, max_marks)
  VALUES (p_exam_id, p_class_name, p_subject_name, p_max_marks)
  ON CONFLICT (exam_id, class_name, subject_name) DO UPDATE SET max_marks = EXCLUDED.max_marks;
END;
$$;

-- p_rows: jsonb array of {"className": "...", "subjectName": "...", "maxMarks": n}
CREATE OR REPLACE FUNCTION staff_admin_exam_subject_max_marks_bulk(p_employee_id UUID, p_exam_id UUID, p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO official_exam_subject_config (exam_id, class_name, subject_name, max_marks)
  SELECT p_exam_id, r->>'className', r->>'subjectName', (r->>'maxMarks')::INT
  FROM jsonb_array_elements(p_rows) r
  ON CONFLICT (exam_id, class_name, subject_name) DO UPDATE SET max_marks = EXCLUDED.max_marks;
END;
$$;

-- ── Official Exam marks entered so far (read-only visibility) ─────────────
CREATE OR REPLACE FUNCTION staff_admin_official_exam_marks_entered(p_employee_id UUID, p_exam_id UUID, p_class_name TEXT)
RETURNS TABLE(o_student_id UUID, o_name TEXT, o_subject TEXT, o_marks NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT m.student_id, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), m.subject_name, m.marks_obtained
    FROM official_exam_marks m
    LEFT JOIN students s ON s.id = m.student_id
    WHERE m.exam_id = p_exam_id AND m.class_name = p_class_name
    ORDER BY 2, 3;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_save_monthly_test_max_marks(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_monthly_tests(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_monthly_test_marks(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_official_exam_create(UUID, TEXT, DATE, DATE, UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_official_exam_update(UUID, UUID, TEXT, DATE, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_official_exam_delete(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_exam_subject_max_marks_save(UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_exam_subject_max_marks_bulk(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_official_exam_marks_entered(UUID, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_save_monthly_test_max_marks(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_monthly_tests(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_monthly_test_marks(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_official_exam_create(UUID, TEXT, DATE, DATE, UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_official_exam_update(UUID, UUID, TEXT, DATE, DATE, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_official_exam_delete(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_exam_subject_max_marks_save(UUID, UUID, TEXT, TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_exam_subject_max_marks_bulk(UUID, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_official_exam_marks_entered(UUID, UUID, TEXT) TO anon, authenticated;
