-- REQ-SEC-002 Category 3, Group C (2026-09-22): 2 dual-shape-by-caller-role
-- tables, moved from direct anon table access to session-token-gated RPCs.
-- See governance/planning/REQ-SEC-002-CATEGORY3-RPC-PLAN.md.
--
-- FINDING vs. the plan's stated uncertainty: student_attendance's per-student
-- full-year read (fetchStudentAttendance(studentId)) turned out NOT to be
-- dual-shape after all - grep confirms only student_attendance_page.dart
-- (student app) calls it; the teacher-side attendance methods
-- (saveAttendanceBatch/fetchAttendanceForClassDate) are separate Dart
-- functions already covered by Group B. So this is simple own-record,
-- student-only.
--
-- official_exam_marks IS genuinely dual-shape and had a real pre-existing
-- info leak: student_official_results_page.dart was calling
-- fetchOfficialExamMarksForClass (the whole class's marks across all
-- subjects) and filtering to the student's own row CLIENT-SIDE - meaning
-- any anon caller could already read every student's official exam
-- results directly, worse than the freeform exam_marks leak fixed in
-- Group B (official results are the more sensitive of the two). Fixed with
-- a dedicated student RPC that only ever returns the caller's own rows.
--
-- Entering official exam marks uses the same "any teacher, any class"
-- picker as everything else in Group B (allSchoolClasses, confirmed in
-- teacher_official_exams_page.dart:358) - so save/per-subject-fetch are
-- identity-gated only. The teacher's own "Class Overview" (all subjects,
-- whole class) IS is_teacher_of_class-gated, same as Group B's exams/
-- homework/syllabus broadened reads.
--
-- IMPORTANT - per REQ-BUG-018: this migration only creates RPCs. The
-- anon-revoking lock-down is NOT included - do not run it until a build
-- with matching Dart changes is confirmed installed on real devices.

CREATE OR REPLACE FUNCTION public.fetch_official_exam_marks(
  p_employee_id uuid, p_session_token text, p_exam_id uuid, p_class_name text, p_subject text
) RETURNS SETOF public.official_exam_marks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.official_exam_marks
    WHERE exam_id = p_exam_id AND class_name = p_class_name AND subject_name = p_subject;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_official_exam_marks(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_official_exam_marks(uuid, text, uuid, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_official_exam_marks_for_class(
  p_employee_id uuid, p_session_token text, p_exam_id uuid, p_class_name text
) RETURNS SETOF public.official_exam_marks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.official_exam_marks
    WHERE exam_id = p_exam_id AND class_name = p_class_name;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_official_exam_marks_for_class(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_official_exam_marks_for_class(uuid, text, uuid, text) TO anon;

-- p_marks: jsonb array of {"student_id": uuid, "marks_obtained": numeric} -
-- entered_by is always forced to the verified caller.
CREATE OR REPLACE FUNCTION public.save_official_marks_batch(
  p_employee_id uuid, p_session_token text, p_exam_id uuid, p_class_name text, p_subject text, p_marks jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.official_exam_marks (exam_id, student_id, class_name, subject_name, marks_obtained, entered_by)
  SELECT p_exam_id, (m->>'student_id')::uuid, p_class_name, p_subject, (m->>'marks_obtained')::numeric, p_employee_id
  FROM jsonb_array_elements(p_marks) AS m
  ON CONFLICT (exam_id, student_id, subject_name) DO UPDATE
    SET marks_obtained = EXCLUDED.marks_obtained, entered_by = EXCLUDED.entered_by, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_official_marks_batch(uuid, text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_official_marks_batch(uuid, text, uuid, text, text, jsonb) TO anon;

-- Student-facing: own rows only, across every subject for one exam - fixes
-- the pre-existing info leak (see header note).
CREATE OR REPLACE FUNCTION public.fetch_official_exam_marks_for_student(
  p_student_id uuid, p_session_token text, p_exam_id uuid
) RETURNS SETOF public.official_exam_marks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('student', p_student_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.official_exam_marks
    WHERE exam_id = p_exam_id AND student_id = p_student_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_official_exam_marks_for_student(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_official_exam_marks_for_student(uuid, text, uuid) TO anon;

-- student_attendance (student's own full-year history) - own-record only,
-- not actually dual-shape (see header note).
CREATE OR REPLACE FUNCTION public.fetch_my_attendance_history(p_student_id uuid, p_session_token text)
RETURNS SETOF public.student_attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('student', p_student_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.student_attendance WHERE student_id = p_student_id ORDER BY date DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_attendance_history(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_attendance_history(uuid, text) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- DO NOT RUN THE BLOCK BELOW until a build containing this migration's
-- matching Dart changes is confirmed actually installed on real devices.
-- official_exam_marks is a NEW table for this lock-down (not covered by
-- Group A/B); student_attendance is ALREADY covered by Group B's
-- (also-deferred) lock-down block - don't double-list it there.
-- ═══════════════════════════════════════════════════════════════════════
-- ALTER TABLE public.official_exam_marks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "admin staff manage official_exam_marks" ON public.official_exam_marks
--   FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
-- REVOKE ALL ON public.official_exam_marks FROM anon;
