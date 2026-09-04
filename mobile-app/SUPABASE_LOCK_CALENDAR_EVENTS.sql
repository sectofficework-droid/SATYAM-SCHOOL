-- REQ-SEC-002 (staged, continued) - school_calendar_events was fully
-- exposed to the anon key: RLS was disabled and anon held full
-- SELECT/INSERT/UPDATE/DELETE grants (SUPABASE_YEAR_PLAN_CALENDAR.sql:38-39).
-- Unlike students/admin_users, the mobile app DOES need anon read access
-- here (teacher app reads the calendar with no real session), so this keeps
-- anon SELECT and only revokes anon's write grants, gating writes on the
-- same is_admin_user() helper from SUPABASE_LOCK_STUDENTS_ADMIN_USERS.sql.

REVOKE INSERT, UPDATE, DELETE ON public.school_calendar_events FROM anon;

ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read calendar events" ON public.school_calendar_events
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "admin staff manage calendar events" ON public.school_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "admin staff update calendar events" ON public.school_calendar_events
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "admin staff delete calendar events" ON public.school_calendar_events
  FOR DELETE TO authenticated
  USING (public.is_admin_user());
