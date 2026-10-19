-- REQ-FEAT-020 follow-up (2026-10-19) - user: "every subject is assigned 10
-- marks if ticked total will be counted towards how much time the notebook
-- is checked (different date)". Clarified before building: a report over
-- notebook_log (SUPABASE_NOTEBOOK_LOG.sql), not a data model change - marks
-- are computed on the fly (checks_done * 10), not stored. Per student per
-- subject, over a date range: how many dates it was checked (checks_total)
-- and how many of those were complete (checks_done). Teacher app sums this
-- per subject AND an overall per-student total client-side; admin panel
-- reads notebook_log directly (already authenticated + is_admin_user()
-- policy-gated, same as the admin-panel Daily Log report) so no RPC is
-- needed on that side.

CREATE OR REPLACE FUNCTION public.fetch_notebook_report(
  p_employee_id uuid, p_session_token text, p_class_name text, p_start_date date, p_end_date date
) RETURNS TABLE(student_id uuid, subject text, checks_done bigint, checks_total bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT nl.student_id, nl.subject,
           COUNT(*) FILTER (WHERE nl.complete) AS checks_done,
           COUNT(*) AS checks_total
    FROM public.notebook_log nl
    WHERE nl.class = p_class_name AND nl.date BETWEEN p_start_date AND p_end_date
    GROUP BY nl.student_id, nl.subject;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_notebook_report(uuid, text, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_notebook_report(uuid, text, text, date, date) TO anon;
