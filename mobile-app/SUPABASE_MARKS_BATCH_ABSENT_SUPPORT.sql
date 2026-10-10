-- save_official_marks_batch: accept an optional per-record "is_absent" flag
-- (default false, same as before for any caller that omits it) so the
-- teacher app's bulk mark-entry screen can write an explicit Absent record
-- instead of only ever writing a numeric mark. Used by
-- teacher_official_exams_page.dart's "Save All Marks": when some students
-- in the class got a real mark and one or more were left blank, those blank
-- ones are now saved as Absent (marks_obtained: 0, is_absent: true) instead
-- of being silently skipped and left with no record at all.
--
-- Applied directly via Supabase SQL Editor / MCP on 2026-10-10. This file
-- documents that change for anyone reading the schema history later.

CREATE OR REPLACE FUNCTION public.save_official_marks_batch(
  p_employee_id uuid, p_session_token text, p_exam_id uuid, p_class_name text, p_subject text, p_marks jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
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

  INSERT INTO public.official_exam_marks (exam_id, student_id, class_name, subject_name, marks_obtained, entered_by, is_absent)
  SELECT p_exam_id, (m->>'student_id')::uuid, p_class_name, p_subject, (m->>'marks_obtained')::numeric, p_employee_id,
         COALESCE((m->>'is_absent')::boolean, false)
  FROM jsonb_array_elements(p_marks) AS m
  ON CONFLICT (exam_id, student_id, subject_name) DO UPDATE
    SET marks_obtained = EXCLUDED.marks_obtained, entered_by = EXCLUDED.entered_by, updated_at = now(), is_absent = EXCLUDED.is_absent;
END;
$function$;
