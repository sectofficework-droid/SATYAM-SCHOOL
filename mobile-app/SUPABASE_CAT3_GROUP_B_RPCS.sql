-- REQ-SEC-002 Category 3, Group B (2026-09-22): 6 class-scoped tables, moved
-- from direct anon table access to session-token-gated RPCs. See
-- governance/planning/REQ-SEC-002-CATEGORY3-RPC-PLAN.md.
-- Requires SUPABASE_CAT3_FOUNDATION_MOBILE_SESSIONS.sql (verify_mobile_session)
-- and SUPABASE_CAT3_GROUP_A_RPCS.sql (established pattern) applied first.
--
-- CORRECTION vs. the original plan doc, found by reading the actual page
-- files (lib/core/utils/teacher_classes.dart's own comment + every create
-- picker in teacher_marks_page.dart/teacher_homework_page.dart/
-- teacher_syllabus_page.dart use allSchoolClasses, not a restricted list):
-- "Any teacher can give homework or conduct an exam for any class" is a
-- DELIBERATE existing feature (cross-class coverage, e.g. substituting for a
-- colleague), not an oversight. So CREATE on exams/homework/syllabus is
-- gated by session identity only (server-forces created_by/teacher_id to the
-- verified caller, can't be spoofed) - NOT by is_teacher_of_class. The
-- class-assignment check (is_teacher_of_class) still applies exactly where
-- the plan intended: a class teacher's broadened READ of their whole
-- class's records (created by anyone), and both directions of
-- student_attendance (no "any class" picker exists there - strictly the
-- teacher's own assigned class, per teacher_attendance_page.dart).
--
-- IMPORTANT - per REQ-BUG-018 (2026-09-21 production incident): do NOT
-- revoke anon's direct grants on these 6 tables until a build containing
-- this migration's matching Dart changes is confirmed actually installed on
-- real devices. This file creates the RPCs and helper; the anon-revoking
-- DO block at the end is written but should only be run once that's true -
-- see governance/planning/TODO.md REQ-BUG-018 for the current distribution
-- status before running that block.

-- Shared helper ------------------------------------------------------------
-- "Is this employee legitimately allowed to see the whole class's records" -
-- true if class-teacher of a section under this class, a supporting teacher
-- of such a section, or timetabled to teach this class (subject teacher,
-- free-text name match against timetables.teacher - same known fragility
-- already flagged in the plan doc, not new).
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_employee_id uuid, p_class_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_result boolean;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.sections sec ON sec.id = e.class_teacher_of_section_id
      JOIN public.classes c ON c.id = sec.class_id
      WHERE e.id = p_employee_id AND c.name = p_class_name
    )
    OR EXISTS (
      SELECT 1 FROM public.section_supporting_teachers sst
      JOIN public.sections sec ON sec.id = sst.section_id
      JOIN public.classes c ON c.id = sec.class_id
      WHERE sst.employee_id = p_employee_id AND c.name = p_class_name
    )
    OR EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.timetables t ON t.teacher = e.name
      WHERE e.id = p_employee_id AND t.class_name = p_class_name
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, text) TO anon;

-- exams ----------------------------------------------------------------
-- Any verified teacher may create an exam for any class (deliberate
-- feature, see header note) - created_by is always forced to the verified
-- caller, never taken from the client.
CREATE OR REPLACE FUNCTION public.create_exam(
  p_employee_id uuid, p_session_token text,
  p_name text, p_class_name text, p_subject text, p_date date, p_max_marks numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.exams (name, class, subject, date, max_marks, created_by)
  VALUES (p_name, p_class_name, p_subject, p_date, p_max_marks, p_employee_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_exam(uuid, text, text, text, text, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam(uuid, text, text, text, text, date, numeric) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_exams(p_employee_id uuid, p_session_token text)
RETURNS SETOF public.exams
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.exams WHERE created_by = p_employee_id ORDER BY date DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_exams(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_exams(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_exams_for_class(p_employee_id uuid, p_session_token text, p_class_name text)
RETURNS SETOF public.exams
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.exams WHERE class = p_class_name ORDER BY date DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_exams_for_class(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_exams_for_class(uuid, text, text) TO anon;

-- exam_marks -------------------------------------------------------------
-- No table-level created_by/class of its own - scoped via the parent exam:
-- caller must have created the exam, or (class-teacher/supporting-teacher/
-- timetabled) be allowed to see the exam's class broadly.
CREATE OR REPLACE FUNCTION public.fetch_exam_marks(p_employee_id uuid, p_session_token text, p_exam_id uuid)
RETURNS SETOF public.exam_marks
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND OR NOT (v_exam.created_by = p_employee_id OR public.is_teacher_of_class(p_employee_id, v_exam.class)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.exam_marks WHERE exam_id = p_exam_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_exam_marks(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_exam_marks(uuid, text, uuid) TO anon;

-- Used only to know which exams already have at least one mark entered
-- (dashboard "pending" count) - naturally filters to exams the caller is
-- authorized to see, rather than raising, since it's a convenience read
-- across a caller-supplied id list.
CREATE OR REPLACE FUNCTION public.fetch_exam_ids_with_marks(p_employee_id uuid, p_session_token text, p_exam_ids uuid[])
RETURNS TABLE(exam_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT DISTINCT em.exam_id
    FROM public.exam_marks em
    JOIN public.exams e ON e.id = em.exam_id
    WHERE em.exam_id = ANY(p_exam_ids)
      AND (e.created_by = p_employee_id OR public.is_teacher_of_class(p_employee_id, e.class));
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_exam_ids_with_marks(uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_exam_ids_with_marks(uuid, text, uuid[]) TO anon;

-- p_marks: jsonb array of {"student_id": uuid, "marks_obtained": numeric} -
-- entered_by is always forced to the verified caller, never taken from the
-- client array.
CREATE OR REPLACE FUNCTION public.save_marks_batch(p_employee_id uuid, p_session_token text, p_exam_id uuid, p_marks jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND OR NOT (v_exam.created_by = p_employee_id OR public.is_teacher_of_class(p_employee_id, v_exam.class)) THEN
    RAISE EXCEPTION 'Not authorized';
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

-- homework -----------------------------------------------------------------
-- Same "any teacher, any class" create rule as exams - see header note.
CREATE OR REPLACE FUNCTION public.create_homework(
  p_employee_id uuid, p_session_token text,
  p_class_name text, p_subject text, p_description text, p_due_date date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.homework (class, subject, description, due_date, created_by)
  VALUES (p_class_name, p_subject, p_description, p_due_date, p_employee_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_homework(uuid, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_homework(uuid, text, text, text, text, date) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_homework(p_employee_id uuid, p_session_token text)
RETURNS SETOF public.homework
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.homework WHERE created_by = p_employee_id ORDER BY due_date ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_homework(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_homework(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_homework_for_class(p_employee_id uuid, p_session_token text, p_class_name text)
RETURNS SETOF public.homework
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.homework WHERE class = p_class_name ORDER BY due_date ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_homework_for_class(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_homework_for_class(uuid, text, text) TO anon;

-- syllabus -------------------------------------------------------------
-- Same "any teacher, any class" create rule - teacher_id always forced to
-- the verified caller. Update/delete/lock are own-record (teacher_id must
-- match the caller), matching this table's existing per-row ownership
-- shape - not class-gated, since a chapter you didn't add isn't yours to
-- edit even if you're allowed to teach that class.
CREATE OR REPLACE FUNCTION public.create_syllabus_chapters(
  p_employee_id uuid, p_session_token text,
  p_class_name text, p_subject text, p_chapters text[], p_start_sort_order integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.syllabus (teacher_id, class, subject, chapter, status, sort_order)
  SELECT p_employee_id, p_class_name, p_subject, c, 'Not Started', p_start_sort_order + (ord - 1)
  FROM unnest(p_chapters) WITH ORDINALITY AS t(c, ord);
END;
$$;
REVOKE ALL ON FUNCTION public.create_syllabus_chapters(uuid, text, text, text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_syllabus_chapters(uuid, text, text, text, text[], integer) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_syllabus(p_employee_id uuid, p_session_token text)
RETURNS SETOF public.syllabus
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.syllabus WHERE teacher_id = p_employee_id ORDER BY sort_order ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_syllabus(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_syllabus(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_syllabus_for_class(p_employee_id uuid, p_session_token text, p_class_name text)
RETURNS SETOF public.syllabus
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.syllabus WHERE class = p_class_name ORDER BY sort_order ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_syllabus_for_class(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_syllabus_for_class(uuid, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.update_syllabus_status(p_employee_id uuid, p_session_token text, p_chapter_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.syllabus SET status = p_status, updated_at = now()
  WHERE id = p_chapter_id AND teacher_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_syllabus_status(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_syllabus_status(uuid, text, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.delete_syllabus_chapter(p_employee_id uuid, p_session_token text, p_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.syllabus WHERE id = p_chapter_id AND teacher_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_syllabus_chapter(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_syllabus_chapter(uuid, text, uuid) TO anon;

CREATE OR REPLACE FUNCTION public.update_syllabus_chapter_name(p_employee_id uuid, p_session_token text, p_chapter_id uuid, p_chapter_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.syllabus SET chapter = p_chapter_name
  WHERE id = p_chapter_id AND teacher_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_syllabus_chapter_name(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_syllabus_chapter_name(uuid, text, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.delete_syllabus_for_subject(p_employee_id uuid, p_session_token text, p_class_name text, p_subject text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.syllabus
  WHERE teacher_id = p_employee_id AND class = p_class_name AND subject = p_subject;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_syllabus_for_subject(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_syllabus_for_subject(uuid, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.lock_syllabus(p_employee_id uuid, p_session_token text, p_class_name text, p_subject text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.syllabus SET locked = true, locked_at = now()
  WHERE teacher_id = p_employee_id AND class = p_class_name AND subject = p_subject;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_syllabus(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_syllabus(uuid, text, text, text) TO anon;

-- syllabus_subtopics ---------------------------------------------------
-- No teacher_id/class of its own - scoped via the parent chapter
-- (syllabus.teacher_id for ownership/writes, syllabus.class for the
-- broadened class-teacher read).
CREATE OR REPLACE FUNCTION public.create_syllabus_subtopics(
  p_employee_id uuid, p_session_token text, p_chapter_id uuid, p_names text[], p_start_sort_order integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.syllabus WHERE id = p_chapter_id AND teacher_id = p_employee_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.syllabus_subtopics (chapter_id, name, status, sort_order)
  SELECT p_chapter_id, n, 'Not Started', p_start_sort_order + (ord - 1)
  FROM unnest(p_names) WITH ORDINALITY AS t(n, ord);
END;
$$;
REVOKE ALL ON FUNCTION public.create_syllabus_subtopics(uuid, text, uuid, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_syllabus_subtopics(uuid, text, uuid, text[], integer) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_syllabus_subtopics(p_employee_id uuid, p_session_token text, p_chapter_ids uuid[])
RETURNS SETOF public.syllabus_subtopics
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT st.* FROM public.syllabus_subtopics st
    JOIN public.syllabus s ON s.id = st.chapter_id
    WHERE st.chapter_id = ANY(p_chapter_ids)
      AND (s.teacher_id = p_employee_id OR public.is_teacher_of_class(p_employee_id, s.class))
    ORDER BY st.sort_order ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_syllabus_subtopics(uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_syllabus_subtopics(uuid, text, uuid[]) TO anon;

CREATE OR REPLACE FUNCTION public.update_subtopic_status(p_employee_id uuid, p_session_token text, p_subtopic_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.syllabus_subtopics st SET status = p_status, updated_at = now()
  FROM public.syllabus s
  WHERE st.id = p_subtopic_id AND s.id = st.chapter_id AND s.teacher_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_subtopic_status(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_subtopic_status(uuid, text, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.delete_subtopic(p_employee_id uuid, p_session_token text, p_subtopic_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.syllabus_subtopics st
  USING public.syllabus s
  WHERE st.id = p_subtopic_id AND s.id = st.chapter_id AND s.teacher_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_subtopic(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_subtopic(uuid, text, uuid) TO anon;

-- student_attendance (teacher side) -----------------------------------
-- Strictly the teacher's own assigned class - no "any class" feature exists
-- here (teacher_attendance_page.dart only ever uses profile['class_name']),
-- so both directions are is_teacher_of_class-gated.
CREATE OR REPLACE FUNCTION public.save_attendance_batch(
  p_employee_id uuid, p_session_token text, p_class_name text, p_date date, p_records jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.student_attendance (student_id, date, class, status, marked_by)
  SELECT (r->>'student_id')::uuid, p_date, p_class_name, r->>'status', p_employee_id
  FROM jsonb_array_elements(p_records) AS r
  ON CONFLICT (student_id, date) DO UPDATE
    SET status = EXCLUDED.status, class = EXCLUDED.class, marked_by = EXCLUDED.marked_by;
END;
$$;
REVOKE ALL ON FUNCTION public.save_attendance_batch(uuid, text, text, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_attendance_batch(uuid, text, text, date, jsonb) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_attendance_for_class_date(p_employee_id uuid, p_session_token text, p_class_name text, p_date date)
RETURNS TABLE(student_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_teacher_of_class(p_employee_id, p_class_name) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT sa.student_id, sa.status FROM public.student_attendance sa
    WHERE sa.class = p_class_name AND sa.date = p_date;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_attendance_for_class_date(uuid, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_attendance_for_class_date(uuid, text, text, date) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- DO NOT RUN THE BLOCK BELOW until a build containing this migration's
-- matching Dart changes is confirmed actually installed on real devices.
-- Running it early reproduces REQ-BUG-018 (2026-09-21 production incident)
-- for these 6 tables too. See governance/planning/TODO.md REQ-BUG-018 for
-- current distribution status.
-- ═══════════════════════════════════════════════════════════════════════
-- DO $$
-- DECLARE
--   t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'exams', 'exam_marks', 'homework', 'syllabus', 'syllabus_subtopics', 'student_attendance'
--   ]
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
--     EXECUTE format(
--       'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
--       'admin staff manage ' || t, t
--     );
--     EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
--   END LOOP;
-- END $$;
