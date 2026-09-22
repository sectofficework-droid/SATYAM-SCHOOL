-- REQ-SEC-002 Category 3, Group A (2026-09-19): 9 own-record-only tables,
-- moved from direct anon table access to session-token-gated RPCs. See
-- governance/planning/REQ-SEC-002-CATEGORY3-RPC-PLAN.md.
-- Requires SUPABASE_CAT3_FOUNDATION_MOBILE_SESSIONS.sql applied first
-- (verify_mobile_session).
--
-- Verified live afterward (role-simulated anon, rolled back): full
-- insert->read chain works (teacher_submit_leave_request ->
-- fetch_my_leave_requests); wrong-token calls correctly raise "Not
-- authorized"; direct anon table access to all 9 tables correctly
-- "permission denied"; project-wide rls_disabled count dropped from 17 to
-- 8 (exactly Category 3's remaining Group B/C/employees scope, no
-- surprises). closeSyllabusEditWindow and deleteTeacherDocument now
-- require and verify the owning teacher_id -- previously id-only, no
-- owner check at all (closes the parent plan's flagged "secondary gap").

-- leave_requests -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_submit_leave_request(
  p_employee_id uuid, p_session_token text,
  p_from_date text, p_to_date text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.leave_requests (employee_id, from_date, to_date, reason)
  VALUES (p_employee_id, p_from_date::date, p_to_date::date, p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.teacher_submit_leave_request(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_submit_leave_request(uuid, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_leave_requests(p_employee_id uuid, p_session_token text)
RETURNS SETOF public.leave_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.leave_requests WHERE employee_id = p_employee_id ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_leave_requests(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_leave_requests(uuid, text) TO anon;

-- queries_suggestions (dual: teacher or student) ------------------------
CREATE OR REPLACE FUNCTION public.submit_query(
  p_user_type text, p_user_id uuid, p_session_token text,
  p_user_name text, p_class_name text, p_message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF p_user_type NOT IN ('teacher', 'student') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.verify_mobile_session(p_user_type, p_user_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.queries_suggestions (user_type, user_id, user_name, class_name, message)
  VALUES (p_user_type, p_user_id, p_user_name, p_class_name, p_message);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_query(text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_query(text, uuid, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_queries(p_user_type text, p_user_id uuid, p_session_token text)
RETURNS SETOF public.queries_suggestions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF p_user_type NOT IN ('teacher', 'student') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.verify_mobile_session(p_user_type, p_user_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.queries_suggestions WHERE user_id = p_user_id AND user_type = p_user_type ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_queries(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_queries(text, uuid, text) TO anon;

-- student_alerts / teacher_alerts (read-only) ---------------------------
CREATE OR REPLACE FUNCTION public.fetch_student_alerts(p_student_id uuid, p_session_token text)
RETURNS SETOF public.student_alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('student', p_student_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.student_alerts WHERE student_id = p_student_id ORDER BY created_at DESC LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_student_alerts(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_student_alerts(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_teacher_alerts(p_teacher_id uuid, p_session_token text)
RETURNS SETOF public.teacher_alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.teacher_alerts WHERE teacher_id = p_teacher_id ORDER BY created_at DESC LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_teacher_alerts(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_teacher_alerts(uuid, text) TO anon;

-- task_assignees ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_teacher_tasks(p_employee_id uuid, p_session_token text)
RETURNS TABLE(task_id uuid, status text, task json)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT ta.task_id, ta.status, row_to_json(t.*) AS task
    FROM public.task_assignees ta
    JOIN public.tasks t ON t.id = ta.task_id
    WHERE ta.employee_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_teacher_tasks(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_teacher_tasks(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.update_task_assignee_status(
  p_task_id uuid, p_employee_id uuid, p_session_token text, p_status text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.task_assignees
  SET status = p_status, status_updated_at = now()
  WHERE task_id = p_task_id AND employee_id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_task_assignee_status(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_task_assignee_status(uuid, uuid, text, text) TO anon;

-- daily_task_completions (daily_tasks itself already fixed, Category 2) ---
CREATE OR REPLACE FUNCTION public.fetch_my_daily_task_completions(p_employee_id uuid, p_session_token text, p_date text)
RETURNS SETOF public.daily_task_completions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.daily_task_completions
    WHERE employee_id = p_employee_id AND completion_date = p_date::date;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_daily_task_completions(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_daily_task_completions(uuid, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.mark_daily_task_done(p_daily_task_id uuid, p_employee_id uuid, p_session_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.daily_task_completions (daily_task_id, employee_id, completion_date)
  VALUES (p_daily_task_id, p_employee_id, CURRENT_DATE)
  ON CONFLICT (daily_task_id, employee_id, completion_date) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_daily_task_done(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_daily_task_done(uuid, uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.unmark_daily_task_done(p_daily_task_id uuid, p_employee_id uuid, p_session_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.daily_task_completions
  WHERE daily_task_id = p_daily_task_id AND employee_id = p_employee_id AND completion_date = CURRENT_DATE;
END;
$$;
REVOKE ALL ON FUNCTION public.unmark_daily_task_done(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmark_daily_task_done(uuid, uuid, text) TO anon;

-- attendance_edit_requests -------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_attendance_edit_request(
  p_teacher_id uuid, p_session_token text,
  p_class_name text, p_section_name text, p_date text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.attendance_edit_requests (teacher_id, class_name, section_name, date, reason)
  VALUES (p_teacher_id, p_class_name, p_section_name, p_date::date, p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_attendance_edit_request(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attendance_edit_request(uuid, text, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_edit_requests(p_teacher_id uuid, p_session_token text)
RETURNS SETOF public.attendance_edit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.attendance_edit_requests WHERE teacher_id = p_teacher_id ORDER BY created_at DESC LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_edit_requests(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_edit_requests(uuid, text) TO anon;

-- syllabus_edit_requests ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_syllabus_edit_request(
  p_teacher_id uuid, p_session_token text,
  p_class_name text, p_subject text, p_reason text, p_requested_changes text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.syllabus_edit_requests (teacher_id, class_name, subject_name, reason, requested_changes)
  VALUES (p_teacher_id, p_class_name, p_subject, p_reason, p_requested_changes);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_syllabus_edit_request(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_syllabus_edit_request(uuid, text, text, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_my_syllabus_edit_requests(p_teacher_id uuid, p_session_token text)
RETURNS SETOF public.syllabus_edit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.syllabus_edit_requests WHERE teacher_id = p_teacher_id ORDER BY created_at DESC LIMIT 50;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_syllabus_edit_requests(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_syllabus_edit_requests(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.close_syllabus_edit_window(p_request_id uuid, p_teacher_id uuid, p_session_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.syllabus_edit_requests
  SET closed_at = now()
  WHERE id = p_request_id AND teacher_id = p_teacher_id;
END;
$$;
REVOKE ALL ON FUNCTION public.close_syllabus_edit_window(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_syllabus_edit_window(uuid, uuid, text) TO anon;

-- teacher_documents ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_teacher_documents(p_teacher_id uuid, p_session_token text, p_section text)
RETURNS SETOF public.teacher_documents
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.teacher_documents
    WHERE teacher_id = p_teacher_id AND section = p_section ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_teacher_documents(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_teacher_documents(uuid, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.create_teacher_document(
  p_teacher_id uuid, p_session_token text, p_section text, p_academic_year text,
  p_class text, p_subject text, p_title text, p_file_key text, p_file_name text, p_file_size integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.teacher_documents
    (teacher_id, section, academic_year, class, subject, title, file_key, file_name, file_size)
  VALUES
    (p_teacher_id, p_section, p_academic_year, p_class, p_subject, p_title, p_file_key, p_file_name, p_file_size);
END;
$$;
REVOKE ALL ON FUNCTION public.create_teacher_document(uuid, text, text, text, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_teacher_document(uuid, text, text, text, text, text, text, text, text, integer) TO anon;

CREATE OR REPLACE FUNCTION public.delete_teacher_document(p_id uuid, p_teacher_id uuid, p_session_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_teacher_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.teacher_documents WHERE id = p_id AND teacher_id = p_teacher_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_teacher_document(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_teacher_document(uuid, uuid, text) TO anon;

-- Lock down direct table access for all 9 tables: admin panel keeps full
-- access via authenticated + is_admin_user() (same Tranche 1 pattern),
-- anon loses all direct grants now that every mobile call site goes
-- through the RPCs above.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leave_requests', 'queries_suggestions', 'student_alerts', 'teacher_alerts',
    'task_assignees', 'daily_task_completions', 'attendance_edit_requests',
    'syllabus_edit_requests', 'teacher_documents'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
      'admin staff manage ' || t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- Dart side (mobile-app/lib/core/services/supabase_service.dart and 10
-- call-site files across teacher/student modules): every affected method
-- now takes a sessionToken parameter (AuthService.to.sessionToken at the
-- call site); closeSyllabusEditWindow and deleteTeacherDocument also gained
-- a required teacherId parameter they previously lacked entirely.
-- flutter analyze: clean (0 new issues). teacher-flavor and student-flavor
-- debug APKs both build successfully. NOT yet tested on a real device with
-- a real login -- needs the user to install and verify end-to-end (leave
-- request, queries, alerts, tasks, daily tasks, attendance edit request,
-- syllabus edit request, teacher documents) before considering this closed.
