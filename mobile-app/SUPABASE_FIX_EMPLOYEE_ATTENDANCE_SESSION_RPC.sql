-- REQ-SEC-016 (2026-10-04 full-codebase audit)
-- fetchEmployeeAttendance in supabase_service.dart queried employee_attendance
-- directly with a client-supplied employee_id and no session check - the
-- same anon-direct-access bug class REQ-SEC-002 Category 3 closed for every
-- other table it covered. This one was missed by that migration.
--
-- Single call site (teacher_my_attendance_page.dart) always passes the
-- logged-in caller's own employeeId - matches the established "own record"
-- RPC shape already used for fetch_my_leave_requests / fetch_my_attendance_history.
--
-- Applied live via mcp__supabase__apply_migration on 2026-10-04.

CREATE OR REPLACE FUNCTION public.fetch_my_employee_attendance(p_employee_id uuid, p_session_token text)
RETURNS SETOF public.employee_attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.employee_attendance WHERE employee_id = p_employee_id ORDER BY date DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_my_employee_attendance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_my_employee_attendance(uuid, text) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- DO NOT RUN THE BLOCK BELOW until a build containing this migration's
-- matching Dart change (SupabaseService.fetchEmployeeAttendance ->
-- fetch_my_employee_attendance RPC) is confirmed actually installed on
-- real devices - same v1.0.0+3/REQ-BUG-018 sequencing this project already
-- follows for every other Category-3-style table lock. employee_attendance
-- currently keeps its existing anon SELECT-only grant until then.
-- ═══════════════════════════════════════════════════════════════════════
-- REVOKE SELECT ON public.employee_attendance FROM anon;
