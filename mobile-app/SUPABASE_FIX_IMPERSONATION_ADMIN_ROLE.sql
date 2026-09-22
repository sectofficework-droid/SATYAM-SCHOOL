-- BUG FIX (2026-09-22): Admin Access Code login for an admin-linked employee
-- landed on the plain Teacher tabs instead of Admin Workspace, showing an
-- empty profile. Root cause: teacher_login resolves the employee's
-- admin_role (via admin_users.id = employees.admin_user_id) and includes it
-- in the returned profile JSON - teacher_home.dart's _hasAdminWorkspace
-- getter depends on profile['admin_role'] != null to decide whether to show
-- Admin Workspace at all. _impersonation_employee_json (used by the Admin
-- Access Code / redeem_impersonation_code path) was never updated to do the
-- same when Staff App Unification added this field to teacher_login - so an
-- admin-only account (no real teaching data) impersonated via an access
-- code always fell through to the ordinary, data-less Teacher tabs.
--
-- Note: this file also captures the full current definition (session_token
-- via mint_mobile_session) that a prior session applied live via Supabase
-- MCP but never fully wrote into a tracked file (SUPABASE_CAT3_FOUNDATION_
-- MOBILE_SESSIONS.sql only left a comment pointing at it) - this file is
-- now the single source of truth for _impersonation_employee_json going
-- forward, superseding the stale copy in SUPABASE_IMPERSONATION.sql.

CREATE OR REPLACE FUNCTION public._impersonation_employee_json(p_employee_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp        employees%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
  v_section_id UUID;
  v_is_support BOOLEAN := FALSE;
  v_admin_role JSON;
BEGIN
  SELECT * INTO v_emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_section_id := v_emp.class_teacher_of_section_id;

  IF v_section_id IS NULL THEN
    SELECT section_id INTO v_section_id
    FROM section_supporting_teachers
    WHERE employee_id = v_emp.id
    ORDER BY created_at
    LIMIT 1;
    IF v_section_id IS NOT NULL THEN v_is_support := TRUE; END IF;
  END IF;

  IF v_section_id IS NOT NULL THEN
    SELECT c.name, sec.name INTO v_cls_name, v_sec_name
    FROM sections sec
    JOIN classes c ON c.id = sec.class_id
    WHERE sec.id = v_section_id;
  END IF;

  SELECT json_build_object('linked', true, 'adminUserId', au.id, 'tier', au.role)
  INTO v_admin_role
  FROM admin_users au
  WHERE au.id = v_emp.admin_user_id;

  RETURN json_build_object(
    'id',                          v_emp.id,
    'emp_code',                    v_emp.emp_code,
    'name',                        v_emp.name,
    'type',                        v_emp.type,
    'designation',                 v_emp.designation,
    'department',                  v_emp.department,
    'phone',                       v_emp.phone,
    'email',                       v_emp.email,
    'photo_url',                   v_emp.photo_url,
    'class_teacher_of_section_id', v_section_id,
    'is_supporting_teacher',       v_is_support,
    'subject_mappings',            v_emp.subject_mappings,
    'class_name',                  v_cls_name,
    'section_name',                v_sec_name,
    'admin_role',                  v_admin_role,
    'session_token',               public.mint_mobile_session('teacher', v_emp.id)
  );
END;
$$;
