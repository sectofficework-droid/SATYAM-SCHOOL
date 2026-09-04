-- REQ-SEC-002 (staged, part 1) - applied 2026-09-04 via mcp__supabase__apply_migration.
-- students + admin_users were fully exposed to the anon key: RLS was
-- disabled and anon held full SELECT/INSERT/UPDATE/DELETE grants on both.
-- employees is deliberately NOT covered here - the mobile app reads/writes
-- it directly with the anon key for the teacher's own profile with no real
-- session (supabase_service.dart), so locking it now would break the
-- teacher app. Deferred to be fixed together with REQ-SEC-004's RPC rework.
--
-- admin-panel uses real Supabase Auth (supabase.auth.signInWithPassword),
-- so auth.uid() is meaningful there - that's what makes it safe to gate
-- these two tables on `authenticated` + admin_users membership.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid());
$$;

REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.admin_users FROM anon;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin staff manage students" ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- SELECT also allows a user to read their own row - needed by the
-- login/set-password flows, which look up admin_users by auth.uid() right
-- after signing in, before is_admin_user() would necessarily still hold
-- (e.g. mid-provisioning).
CREATE POLICY "self read own admin_users row" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin_user());

CREATE POLICY "admin staff manage admin_users" ON public.admin_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "admin staff update admin_users" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "admin staff delete admin_users" ON public.admin_users
  FOR DELETE TO authenticated
  USING (public.is_admin_user());
