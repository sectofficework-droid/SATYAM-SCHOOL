-- Lets management link/unlink an admin_users row to an employees row via
-- the admin panel's Settings -> Users & Roles tab. employees.admin_user_id
-- itself was added by SUPABASE_ADMIN_EMPLOYEE_LINK.sql (2026-09-19,
-- nullable FK + UNIQUE, no backfill) but had no UI to set it until now -
-- required for the Staff App Unification Admin Workspace to ever be
-- reachable by anyone. management-only, mirrors REQ-SEC-005's
-- admin_update_user pattern (SECURITY DEFINER + admin_has_role check)
-- rather than a direct authenticated grant, since this action controls
-- who gets mobile Admin Workspace access - a privilege-granting action,
-- not ordinary data entry. Applied 2026-09-19.

CREATE OR REPLACE FUNCTION public.admin_set_employee_link(p_admin_user_id uuid, p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT admin_has_role(ARRAY['management']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE employees SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;

  IF p_employee_id IS NOT NULL THEN
    UPDATE employees SET admin_user_id = p_admin_user_id WHERE id = p_employee_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_employee_link(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_employee_link(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_employee_links()
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('admin_user_id', admin_user_id, 'employee_id', id, 'employee_name', name, 'emp_code', emp_code)), '[]'::json)
  FROM employees WHERE admin_user_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.admin_get_employee_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_employee_links() TO authenticated;

-- This project's default privileges (pg_default_acl) auto-grant EXECUTE to
-- anon for every function created by the postgres role - REVOKE ALL FROM
-- PUBLIC above doesn't touch anon's own grant. Revoke explicitly: these
-- are management-only admin-panel actions, anon (mobile) must never be
-- able to call them (admin_has_role's auth.uid() check makes an anon call
-- a no-op today, not an active bypass, but the grant itself shouldn't
-- exist). Caught and fixed same session via get_advisors/direct grant
-- check, applied as SUPABASE_ADMIN_EMPLOYEE_LINK_UI_REVOKE_ANON (folded
-- in here for anyone reading this file fresh).
REVOKE EXECUTE ON FUNCTION public.admin_set_employee_link(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_employee_links() FROM anon;
