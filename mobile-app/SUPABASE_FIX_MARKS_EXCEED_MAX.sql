-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: marks entry (both Monthly Test and Official Exams, teacher app)
-- accepted any value, including above the exam's configured max marks (or
-- negative) - reported by teachers as a bug. The mobile app now blocks this
-- client-side too (teacher_marks_page.dart / teacher_official_exams_page.dart),
-- but mobile RPCs run as the anon role and the client is not a trust
-- boundary (same reasoning as verify_mobile_session elsewhere in this file
-- set) - enforce it here as well so a bypassed or future client can't write
-- out-of-range marks.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- Monthly Test (freeform teacher-created exams) - max_marks lives directly
-- on the exams row already fetched for the authorization check below.
CREATE OR REPLACE FUNCTION public.save_marks_batch(p_employee_id uuid, p_session_token text, p_exam_id uuid, p_marks jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
  v_bad_count int;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND OR NOT (v_exam.created_by = p_employee_id OR public.is_teacher_of_class(p_employee_id, v_exam.class)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_bad_count FROM jsonb_array_elements(p_marks) AS m
    WHERE (m->>'marks_obtained')::numeric < 0 OR (m->>'marks_obtained')::numeric > v_exam.max_marks;
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'marks_out_of_range';
  END IF;

  INSERT INTO public.exam_marks (exam_id, student_id, marks_obtained, entered_by)
  SELECT p_exam_id, (m->>'student_id')::uuid, (m->>'marks_obtained')::numeric, p_employee_id
  FROM jsonb_array_elements(p_marks) AS m
  ON CONFLICT (exam_id, student_id) DO UPDATE
    SET marks_obtained = EXCLUDED.marks_obtained, entered_by = EXCLUDED.entered_by;
END;
$$;
REVOKE ALL ON FUNCTION public.save_marks_batch(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_marks_batch(uuid, text, uuid, jsonb) TO anon;


-- Official Exams (admin-managed) - max_marks is per exam/class/subject in
-- official_exam_subject_config; a missing row means the app's own default
-- of 100, so the RPC falls back the same way.
CREATE OR REPLACE FUNCTION public.save_official_marks_batch(
  p_employee_id uuid, p_session_token text, p_exam_id uuid, p_class_name text, p_subject text, p_marks jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_max_marks numeric;
  v_bad_count int;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT max_marks INTO v_max_marks FROM public.official_exam_subject_config
    WHERE exam_id = p_exam_id AND class_name = p_class_name AND subject_name = p_subject;
  v_max_marks := COALESCE(v_max_marks, 100);

  SELECT count(*) INTO v_bad_count FROM jsonb_array_elements(p_marks) AS m
    WHERE (m->>'marks_obtained')::numeric < 0 OR (m->>'marks_obtained')::numeric > v_max_marks;
  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'marks_out_of_range';
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
