-- REQ-BUG-084: teacher_update_profile was missed by the REQ-SEC-001
-- bcrypt migration (2026-08-21) - it still compared
-- app_password = p_password (plain equality) against a column that's now
-- a bcrypt hash, so the check can never succeed for a real user: this
-- makes "Update Profile" silently fail for every teacher today (fails
-- closed, not a security hole, but a real functional bug). Fixed to
-- match its already-correct siblings
-- (teacher_change_password/teacher_verify_password).
-- Applied directly to the live DB via Supabase MCP on 2026-11-19.

CREATE OR REPLACE FUNCTION public.teacher_update_profile(p_employee_id text, p_name text, p_phone text, p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_row employees%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id::UUID AND app_password = crypt(p_password, app_password)
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE employees
  SET name  = p_name,
      phone = p_phone,
      email = p_email,
      updated_at = now()
  WHERE id = p_employee_id::UUID
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$function$;
