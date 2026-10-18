-- REQ-FEAT-018 (2026-10-18) - new feature, user: "i want teacher should be
-- notified about student progress so teachers and principles can counsile
-- before it comes to parents attention; suppose if any student is
-- performing poor consistently then it should be notified".
--
-- Clarified before building (AskUserQuestion): signals = official exam
-- marks + daily log (homework/classwork/attentiveness/diary) + attendance,
-- combined with OR logic; recipients = class teacher first (own students
-- only), Principal/admin gets a school-wide dashboard across all classes;
-- trigger = a fixed rule now (not a Settings-configurable threshold):
--   - exam:      avg < 33% across the last 2 official exams (current
--                academic year) with marks entered - 33% chosen to match
--                this app's own existing grade boundary (gradeFor() in
--                marksheetService.js: <33% = grade E, the lowest band)
--                rather than an arbitrary number.
--   - daily_log: 3+ incomplete Homework/Classwork/Attentiveness/Diary
--                entries within a rolling 7-day window.
--   - attendance: <75% present (of P+A, Leave excluded) over the current
--                calendar month, with at least 5 marked days so one
--                absence can't trigger it.
--
-- Persisted (not computed fresh every read) so a flag can be Acknowledged
-- by the teacher / Resolved by admin and stay that way instead of
-- re-appearing on every page load - same reasoning as teacher_alerts, but
-- this needs structured status/signal tracking a plain title+message alert
-- doesn't carry. No pg_cron dependency (REQ-FEAT-006 found that job may
-- never have actually been scheduled) - evaluation runs inline, scoped to
-- just the relevant class, whenever a teacher opens their dashboard or the
-- admin panel opens the report, so it's always fresh without relying on a
-- background schedule.
--
-- Same posture as student_daily_log (REQ-FEAT-017): RLS enabled, admin
-- panel gets full access via authenticated + is_admin_user(); mobile never
-- gets direct table grants, only through SECURITY DEFINER RPCs gated by
-- verify_mobile_session.
-- Run this in Supabase Dashboard -> SQL Editor (or via Supabase MCP).

CREATE TABLE IF NOT EXISTS public.student_risk_flags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_name      TEXT NOT NULL,
  signal          TEXT NOT NULL CHECK (signal IN ('exam','daily_log','attendance')),
  detail          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Acknowledged','Resolved')),
  flagged_at      TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by UUID REFERENCES public.employees(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, signal)
);
CREATE INDEX IF NOT EXISTS idx_student_risk_flags_status ON public.student_risk_flags (status);
CREATE INDEX IF NOT EXISTS idx_student_risk_flags_class   ON public.student_risk_flags (class_name);

ALTER TABLE public.student_risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin staff manage student_risk_flags" ON public.student_risk_flags
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Re-evaluates all three signals and upserts flags. p_class_name scopes the
-- (re)evaluation to one class (cheap, called from a teacher's own dashboard
-- load); NULL evaluates every class (admin panel's school-wide dashboard).
-- A flag that no longer qualifies is left as-is (a human closes the loop by
-- Resolving it, it isn't auto-cleared) - but a Resolved flag whose signal
-- re-triggers reopens as New, since the problem recurring is itself
-- meaningful. An Acknowledged/New flag just gets its detail/flagged_at
-- refreshed, status untouched.
CREATE OR REPLACE FUNCTION public.evaluate_student_risk_flags(p_class_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_year_id uuid;
BEGIN
  SELECT id INTO v_year_id FROM public.academic_years WHERE is_current = true LIMIT 1;

  -- Signal: exam performance.
  WITH exam_pct AS (
    SELECT
      m.student_id, m.class_name, e.id AS exam_id, e.end_date,
      SUM(m.marks_obtained) AS obtained,
      SUM(COALESCE(cfg.max_marks, 100)) AS max_total
    FROM public.official_exam_marks m
    JOIN public.official_exams e ON e.id = m.exam_id
    LEFT JOIN public.official_exam_subject_config cfg
      ON cfg.exam_id = m.exam_id AND cfg.class_name = m.class_name AND cfg.subject_name = m.subject_name
    WHERE m.marks_obtained IS NOT NULL
      AND (v_year_id IS NULL OR e.academic_year_id = v_year_id)
      AND (p_class_name IS NULL OR m.class_name = p_class_name)
    GROUP BY m.student_id, m.class_name, e.id, e.end_date
  ),
  ranked AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY end_date DESC) AS rn,
      CASE WHEN max_total > 0 THEN 100.0 * obtained / max_total ELSE NULL END AS pct
    FROM exam_pct
  ),
  flagged AS (
    SELECT student_id, MAX(class_name) AS class_name,
      STRING_AGG(ROUND(pct)::text || '%', ', ' ORDER BY end_date DESC) AS detail_pcts
    FROM ranked WHERE rn <= 2
    GROUP BY student_id
    HAVING COUNT(*) = 2 AND BOOL_AND(pct IS NOT NULL AND pct < 33)
  )
  INSERT INTO public.student_risk_flags (student_id, class_name, signal, detail, flagged_at)
  SELECT student_id, class_name, 'exam',
    'Scored ' || detail_pcts || ' in the last 2 official exams (below 33% both times).', now()
  FROM flagged
  ON CONFLICT (student_id, signal) DO UPDATE SET
    class_name = EXCLUDED.class_name, detail = EXCLUDED.detail, flagged_at = now(), updated_at = now(),
    status = CASE WHEN public.student_risk_flags.status = 'Resolved' THEN 'New' ELSE public.student_risk_flags.status END;

  -- Signal: daily log (homework/classwork/attentiveness/diary).
  WITH recent_logs AS (
    SELECT student_id, MAX(class) AS class_name,
      COUNT(*) FILTER (WHERE NOT (homework_done AND classwork_done AND attentive AND diary_done)) AS incomplete
    FROM public.student_daily_log
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      AND (p_class_name IS NULL OR class = p_class_name)
    GROUP BY student_id
    HAVING COUNT(*) FILTER (WHERE NOT (homework_done AND classwork_done AND attentive AND diary_done)) >= 3
  )
  INSERT INTO public.student_risk_flags (student_id, class_name, signal, detail, flagged_at)
  SELECT student_id, class_name, 'daily_log',
    incomplete || ' incomplete Homework/Classwork/Attentiveness/Diary entries logged in the last 7 days.', now()
  FROM recent_logs
  ON CONFLICT (student_id, signal) DO UPDATE SET
    class_name = EXCLUDED.class_name, detail = EXCLUDED.detail, flagged_at = now(), updated_at = now(),
    status = CASE WHEN public.student_risk_flags.status = 'Resolved' THEN 'New' ELSE public.student_risk_flags.status END;

  -- Signal: attendance (Leave excluded from the denominator, same idiom
  -- already used for staff attendance %).
  WITH month_att AS (
    SELECT student_id, MAX(class) AS class_name,
      COUNT(*) FILTER (WHERE status IN ('P','A')) AS marked,
      COUNT(*) FILTER (WHERE status = 'P') AS present
    FROM public.student_attendance
    WHERE date >= date_trunc('month', CURRENT_DATE)::date
      AND (p_class_name IS NULL OR class = p_class_name)
    GROUP BY student_id
    HAVING COUNT(*) FILTER (WHERE status IN ('P','A')) >= 5
       AND (100.0 * COUNT(*) FILTER (WHERE status = 'P') / COUNT(*) FILTER (WHERE status IN ('P','A'))) < 75
  )
  INSERT INTO public.student_risk_flags (student_id, class_name, signal, detail, flagged_at)
  SELECT student_id, class_name, 'attendance',
    ROUND(100.0 * present / marked) || '% attendance this month (' || present || ' of ' || marked || ' marked days).', now()
  FROM month_att
  ON CONFLICT (student_id, signal) DO UPDATE SET
    class_name = EXCLUDED.class_name, detail = EXCLUDED.detail, flagged_at = now(), updated_at = now(),
    status = CASE WHEN public.student_risk_flags.status = 'Resolved' THEN 'New' ELSE public.student_risk_flags.status END;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_student_risk_flags(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_student_risk_flags(text) TO authenticated;

-- Teacher app: re-evaluates every class this teacher is class-teacher of,
-- then returns every open (New/Acknowledged) flag for any class they're
-- recognized as a teacher of (is_teacher_of_class - same broader "any
-- teacher of that class" visibility already used for daily log/homework,
-- not just the class-teacher), so a subject teacher sees it too once the
-- class teacher (or admin panel) has triggered an evaluation.
CREATE OR REPLACE FUNCTION public.fetch_my_class_risk_alerts(p_employee_id uuid, p_session_token text)
RETURNS TABLE(
  id uuid, student_id uuid, first_name text, last_name text,
  class_name text, signal text, detail text, status text, flagged_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_class text;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_class IN
    SELECT DISTINCT c.name FROM public.employees e
    JOIN public.sections sec ON sec.id = e.class_teacher_of_section_id
    JOIN public.classes c ON c.id = sec.class_id
    WHERE e.id = p_employee_id
  LOOP
    PERFORM public.evaluate_student_risk_flags(v_class);
  END LOOP;

  RETURN QUERY
    SELECT f.id, f.student_id, s.first_name, s.last_name, f.class_name, f.signal, f.detail, f.status, f.flagged_at
    FROM public.student_risk_flags f
    JOIN public.students s ON s.id = f.student_id
    WHERE f.status IN ('New','Acknowledged')
      AND public.is_teacher_of_class(p_employee_id, f.class_name)
    ORDER BY f.flagged_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_class_risk_alerts(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_class_risk_alerts(uuid, text) TO anon;

-- Teacher taps "Noted" - marks a flag Acknowledged. Only on a class this
-- teacher is recognized as a teacher of (same is_teacher_of_class check),
-- and only from New (acknowledging an already-Acknowledged/Resolved flag
-- again is a no-op, not an error, so a double-tap race is harmless).
CREATE OR REPLACE FUNCTION public.acknowledge_risk_flag(p_employee_id uuid, p_session_token text, p_flag_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_class text;
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT class_name INTO v_class FROM public.student_risk_flags WHERE id = p_flag_id;
  IF v_class IS NULL OR NOT public.is_teacher_of_class(p_employee_id, v_class) THEN
    RAISE EXCEPTION 'Not authorized for this student''s class';
  END IF;
  UPDATE public.student_risk_flags
  SET status = 'Acknowledged', acknowledged_by = p_employee_id, acknowledged_at = now(), updated_at = now()
  WHERE id = p_flag_id AND status = 'New';
END;
$$;
REVOKE ALL ON FUNCTION public.acknowledge_risk_flag(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_risk_flag(uuid, text, uuid) TO anon;
