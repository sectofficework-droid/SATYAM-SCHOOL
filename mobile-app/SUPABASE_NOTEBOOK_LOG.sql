-- REQ-FEAT-020 (2026-10-19) - new feature, user: "add module Notebook -
-- mam will click class todays date then those class students name will be
-- loaded and class will be in header row; by default the notebook cell will
-- be ticked (that student notebook is complete) if any students notebook is
-- incomplete then it will be unticked and it will autosave". Clarified
-- before building: one grid per class+date, student names frozen down the
-- left, every subject of that class frozen across the top (from
-- class_subjects, not a per-teacher subject list) - each cell is a tick,
-- default complete, toggling a cell autosaves that single cell immediately
-- (no batch Save button, unlike REQ-FEAT-017's Daily Log). Date defaults to
-- today but is picker-editable like Daily Log. No class-teacher restriction
-- - any teacher may open any class, same "any class" philosophy already
-- established for homework/exams/syllabus/daily-log (gated by session
-- identity only, NOT is_teacher_of_class).

CREATE TABLE IF NOT EXISTS public.notebook_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  date        DATE NOT NULL,
  complete    BOOLEAN NOT NULL DEFAULT TRUE,
  marked_by   UUID REFERENCES public.employees(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, class, subject, date)
);
CREATE INDEX IF NOT EXISTS idx_notebook_log_class_date ON public.notebook_log (class, date);
CREATE INDEX IF NOT EXISTS idx_notebook_log_student ON public.notebook_log (student_id);

-- Mobile (anon role) never gets direct table grants - RLS-enabled, access
-- only through the two SECURITY DEFINER RPCs below, same posture as
-- student_daily_log (SUPABASE_STUDENT_DAILY_LOG.sql). Admin panel keeps
-- full access via authenticated + is_admin_user(), matching that pattern.
ALTER TABLE public.notebook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin staff manage notebook_log" ON public.notebook_log
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
-- This project's schema auto-grants anon a default table privilege on new
-- tables (same gotcha hit and fixed for student_daily_log, REQ-FEAT-017) -
-- revoke it explicitly since mobile access must only go through the RPCs
-- below. authenticated's default grant is left alone - the admin panel
-- needs it for the policy above to take effect.
REVOKE ALL ON public.notebook_log FROM anon;

-- Single-cell upsert, called on every tick/untick for the autosave UX (no
-- batch Save button for this module, unlike save_student_daily_log_batch).
CREATE OR REPLACE FUNCTION public.save_notebook_entry(
  p_employee_id uuid, p_session_token text, p_class_name text, p_subject text,
  p_date date, p_student_id uuid, p_complete boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.notebook_log (student_id, class, subject, date, complete, marked_by)
  VALUES (p_student_id, p_class_name, p_subject, p_date, p_complete, p_employee_id)
  ON CONFLICT (student_id, class, subject, date) DO UPDATE
    SET complete = EXCLUDED.complete, marked_by = EXCLUDED.marked_by, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_notebook_entry(uuid, text, text, text, date, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_notebook_entry(uuid, text, text, text, date, uuid, boolean) TO anon;

-- Every (student_id, subject, complete) row already saved for a class+date -
-- used to prefill the grid with real prior taps (not a blank all-ticked
-- grid) whenever a teacher reopens a class/date already started.
CREATE OR REPLACE FUNCTION public.fetch_notebook_log(
  p_employee_id uuid, p_session_token text, p_class_name text, p_date date
) RETURNS TABLE(student_id uuid, subject text, complete boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT nl.student_id, nl.subject, nl.complete
    FROM public.notebook_log nl
    WHERE nl.class = p_class_name AND nl.date = p_date;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_notebook_log(uuid, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_notebook_log(uuid, text, text, date) TO anon;
