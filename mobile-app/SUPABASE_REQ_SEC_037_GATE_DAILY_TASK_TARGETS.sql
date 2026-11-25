-- REQ-SEC-037 (2026-11-20 full-system audit): the client used to fetch
-- daily_tasks joined with daily_task_targets(employee_id) directly as
-- anon, then filter client-side to decide if the caller was targeted -
-- shipping the FULL task x employee targeting map to every caller
-- regardless of relevance. daily_tasks itself being anon-readable is a
-- deliberate, already-reviewed Category 2 exception (its own comment);
-- the join riding along on top of it was not independently reviewed and
-- let anyone de-anonymize which named staff member is targeted by which
-- checklist item. Server-side filter instead - only the caller's own
-- applicable tasks come back, no raw employee_id targeting list at all.
-- Applied live via Supabase MCP 2026-11-20.

CREATE OR REPLACE FUNCTION public.fetch_my_daily_tasks(p_employee_id uuid, p_session_token text)
 RETURNS TABLE(id uuid, title text, description text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT dt.id, dt.title, dt.description
    FROM public.daily_tasks dt
    WHERE dt.active = true
      AND (
        dt.target_type = 'all'
        OR EXISTS (SELECT 1 FROM public.daily_task_targets tgt WHERE tgt.task_id = dt.id AND tgt.employee_id = p_employee_id)
      )
    ORDER BY dt.created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.fetch_my_daily_tasks(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_daily_tasks(uuid, text) TO anon, authenticated, service_role;

DROP POLICY "anon read daily_task_targets" ON public.daily_task_targets;
CREATE POLICY "admin staff read daily_task_targets" ON public.daily_task_targets
  FOR SELECT TO authenticated USING (is_admin_user());
