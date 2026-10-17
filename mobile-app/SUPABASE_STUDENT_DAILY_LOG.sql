-- REQ-FEAT-017 (2026-10-17) - new feature, user: "student weekly
-- improvement - homework, classwork, attentiveness, diary (teacher will
-- see their teaching subjects from any class they teaching then they click
-- that class subject that class student list will load then they will
-- click the dropdown of every student will load like: homework,classwork,
-- attentiveness,diary which by default checked if any student didn't have
-- done that it will be crossed by teacher)".
--
-- Clarified before building: entry is per class-subject-period, per day
-- (a "weekly" view is just a 7-day rollup over this daily table, not a
-- separate weekly-grained row); visible to the entering teacher and to a
-- new admin-panel report - no Student/Parent app view yet.
--
-- Granularity note: any teacher can log any class/subject they teach (same
-- "any class" philosophy already established for homework/exams/syllabus
-- in SUPABASE_CAT3_GROUP_B_RPCS.sql's header comment) - gated by session
-- identity only, NOT is_teacher_of_class, since teacherClassSubjectPairs()
-- (lib/core/utils/teacher_classes.dart) already lets a subject teacher
-- with no class_teacher_of_section_id pick any class they're mapped to.
-- marked_by is forced server-side to the verified caller.

CREATE TABLE IF NOT EXISTS public.student_daily_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class           TEXT NOT NULL,
  subject         TEXT NOT NULL,
  date            DATE NOT NULL,
  homework_done   BOOLEAN NOT NULL DEFAULT TRUE,
  classwork_done  BOOLEAN NOT NULL DEFAULT TRUE,
  attentive       BOOLEAN NOT NULL DEFAULT TRUE,
  diary_done      BOOLEAN NOT NULL DEFAULT TRUE,
  marked_by       UUID REFERENCES public.employees(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, class, subject, date)
);
CREATE INDEX IF NOT EXISTS idx_student_daily_log_class_subject_date ON public.student_daily_log (class, subject, date);
CREATE INDEX IF NOT EXISTS idx_student_daily_log_student ON public.student_daily_log (student_id);

-- Mobile (anon role) never gets direct table grants - RLS-enabled, access
-- only through the two SECURITY DEFINER RPCs below, same posture as the
-- REQ-SEC-002 Category 3 tables. Admin panel keeps full access via
-- authenticated + is_admin_user(), matching that same established pattern,
-- so the new admin-panel report (reads this table directly) works with no
-- extra grant.
ALTER TABLE public.student_daily_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin staff manage student_daily_log" ON public.student_daily_log
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.save_student_daily_log_batch(
  p_employee_id uuid, p_session_token text, p_class_name text, p_subject text, p_date date, p_records jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.student_daily_log (student_id, class, subject, date, homework_done, classwork_done, attentive, diary_done, marked_by)
  SELECT
    (r->>'student_id')::uuid, p_class_name, p_subject, p_date,
    COALESCE((r->>'homework_done')::boolean, true),
    COALESCE((r->>'classwork_done')::boolean, true),
    COALESCE((r->>'attentive')::boolean, true),
    COALESCE((r->>'diary_done')::boolean, true),
    p_employee_id
  FROM jsonb_array_elements(p_records) AS r
  ON CONFLICT (student_id, class, subject, date) DO UPDATE
    SET homework_done = EXCLUDED.homework_done, classwork_done = EXCLUDED.classwork_done,
        attentive = EXCLUDED.attentive, diary_done = EXCLUDED.diary_done,
        marked_by = EXCLUDED.marked_by, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_student_daily_log_batch(uuid, text, text, text, date, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_student_daily_log_batch(uuid, text, text, text, date, jsonb) TO anon;

CREATE OR REPLACE FUNCTION public.fetch_student_daily_log(
  p_employee_id uuid, p_session_token text, p_class_name text, p_subject text, p_date date
) RETURNS TABLE(student_id uuid, homework_done boolean, classwork_done boolean, attentive boolean, diary_done boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT sdl.student_id, sdl.homework_done, sdl.classwork_done, sdl.attentive, sdl.diary_done
    FROM public.student_daily_log sdl
    WHERE sdl.class = p_class_name AND sdl.subject = p_subject AND sdl.date = p_date;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_student_daily_log(uuid, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_student_daily_log(uuid, text, text, text, date) TO anon;
