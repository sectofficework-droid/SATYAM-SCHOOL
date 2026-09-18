-- REQ-SEC-005 (governance/planning/TODO.md) - role-tier enforcement.
-- Applied 2026-09-19 via mcp__supabase__apply_migration.
--
-- Problem: admin_users.role ('normal_admin'/'senior_admin'/'management') was
-- only ever checked in the admin-panel's React components (UI visibility).
-- The database only checked is_admin_user() - membership in admin_users,
-- not which role - for admin_users writes and students deletes. Concretely,
-- a normal_admin session could call the Supabase client directly (bypassing
-- the UI) and self-promote to 'management', or permanently delete a
-- student, both of which the UI presents as senior_admin/management-only.
--
-- Fix: move these writes behind SECURITY DEFINER RPCs that check role
-- server-side (the same pattern this project already uses correctly for
-- the Admin Access Code impersonation RPCs, SUPABASE_IMPERSONATION.sql),
-- then revoke the direct grants so the RPC is the only path.
--
-- Policy (user decision, 2026-09-18):
--   - Only 'management' may create/edit/delete a 'senior_admin' or
--     'management' row, or promote anyone to either of those roles.
--   - 'senior_admin' may create/edit/delete 'normal_admin' rows only.
--   - No admin may change their OWN role (self-edit of name/initials still
--     allowed) or delete their OWN account.

-- ── admin_has_role(required_roles) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_has_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid() AND role = ANY(required_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_role(text[]) TO authenticated;

-- ── admin_create_user ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_user(p_name text, p_initials text, p_role text)
RETURNS public.admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_row public.admin_users;
BEGIN
  SELECT role INTO v_caller_role FROM admin_users WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('normal_admin','senior_admin','management') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can create senior_admin or management accounts';
  END IF;

  INSERT INTO admin_users (name, initials, role)
  VALUES (p_name, p_initials, p_role)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text) TO authenticated;

-- ── admin_update_user ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_user(p_target_id uuid, p_name text, p_initials text, p_role text)
RETURNS public.admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_role text;
  v_row public.admin_users;
BEGIN
  SELECT role INTO v_caller_role FROM admin_users WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('normal_admin','senior_admin','management') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT role INTO v_target_role FROM admin_users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF p_target_id = auth.uid() AND p_role IS DISTINCT FROM v_target_role THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  IF v_target_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can modify a senior_admin or management account';
  END IF;

  IF p_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can promote to senior_admin or management';
  END IF;

  UPDATE admin_users
  SET name = p_name, initials = p_initials, role = p_role
  WHERE id = p_target_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text) TO authenticated;

-- ── admin_delete_user ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_caller_role FROM admin_users WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  SELECT role INTO v_target_role FROM admin_users WHERE id = p_target_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF v_target_role IN ('senior_admin','management') AND v_caller_role <> 'management' THEN
    RAISE EXCEPTION 'Only management can delete a senior_admin or management account';
  END IF;

  DELETE FROM admin_users WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- ── admin_delete_student_permanently ─────────────────────────────────────────
-- Wraps the same 4 deletes studentService.js's deleteStudentPermanently does
-- today (4 separate, non-atomic client calls) in one atomic, role-checked
-- function. Runs as SECURITY DEFINER, so it works regardless of
-- student_promotions/transfer_certificates/fee_payments' own RLS state
-- (tracked separately, still open, under REQ-SEC-002 - not resolved here).
CREATE OR REPLACE FUNCTION public.admin_delete_student_permanently(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM admin_users WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('senior_admin','management') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM student_promotions WHERE student_id = p_student_id;
  DELETE FROM transfer_certificates WHERE student_id = p_student_id;
  DELETE FROM fee_payments WHERE student_id = p_student_id;
  DELETE FROM students WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_student_permanently(uuid) TO authenticated;

-- ── Lock down admin_users: RPCs above are now the only write path ──────────
DROP POLICY IF EXISTS "admin staff manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "admin staff update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "admin staff delete admin_users" ON public.admin_users;

REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated;
-- SELECT grant + "self read own admin_users row" policy untouched - still
-- needed for the Users & Roles list view.

-- ── Lock down students: DELETE only via admin_delete_student_permanently ───
DROP POLICY IF EXISTS "admin staff manage students" ON public.students;

CREATE POLICY "admin staff select students" ON public.students
  FOR SELECT TO authenticated
  USING (is_admin_user());

CREATE POLICY "admin staff insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "admin staff update students" ON public.students
  FOR UPDATE TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

REVOKE DELETE ON public.students FROM authenticated;
-- "students_own_profile" (mobile self-read) policy untouched.

-- ── Harden RPC execute grants ────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default on function creation. The
-- internal auth.uid()-based checks above already reject anon (no JWT sub ->
-- caller role NULL -> "Not authorized"), but revoke the unneeded PUBLIC/anon
-- grant too, for defense in depth - flagged by Supabase's own security
-- advisor immediately after first applying this migration (2026-09-19).
REVOKE EXECUTE ON FUNCTION public.admin_has_role(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_student_permanently(uuid) FROM PUBLIC, anon;
