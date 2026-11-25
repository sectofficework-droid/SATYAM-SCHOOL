-- REQ-SEC-035 (2026-11-20 full-system audit): "anon read employee_shifts"
-- granted unconditional SELECT (qual=true) to BOTH anon and authenticated -
-- anyone holding the public anon key could read any employee's full
-- shift/attendance history by employee_id+date, no login. authenticated
-- callers (admin-panel web) already satisfy is_admin_user() per this
-- project's architecture (every authenticated session has an admin_users
-- row), so narrowing to that costs the web side nothing. Applied live via
-- Supabase MCP 2026-11-20.

CREATE OR REPLACE FUNCTION public.fetch_my_employee_shifts(p_employee_id uuid, p_session_token text, p_date date)
 RETURNS SETOF employee_shifts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.employee_shifts
    WHERE employee_id = p_employee_id AND date = p_date
    ORDER BY check_in_at;
END;
$function$;

DROP POLICY "anon read employee_shifts" ON public.employee_shifts;
CREATE POLICY "admin staff read employee_shifts" ON public.employee_shifts
  FOR SELECT TO authenticated USING (is_admin_user());
