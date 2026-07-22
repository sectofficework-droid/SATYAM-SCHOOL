-- Teacher app "Settings": let a logged-in teacher update their own
-- name/phone/email, and change their own password (old password required).
-- Both run as SECURITY DEFINER so the anon key (used for the app's custom
-- emp_code/password auth, not Supabase Auth) can call them, same pattern as
-- teacher_login/student_login.

CREATE OR REPLACE FUNCTION teacher_update_profile(p_employee_id TEXT, p_name TEXT, p_phone TEXT, p_email TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row employees%ROWTYPE;
BEGIN
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
$$;

-- Returns TRUE only if p_old_password matched, and only then applies the change -
-- verification happens server-side so the app never has to read back the
-- current password to check it itself.
CREATE OR REPLACE FUNCTION teacher_change_password(p_employee_id TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id::UUID AND app_password = p_old_password
  ) INTO v_ok;
  IF NOT v_ok THEN RETURN FALSE; END IF;

  UPDATE employees SET app_password = p_new_password, updated_at = now() WHERE id = p_employee_id::UUID;
  RETURN TRUE;
END;
$$;

-- Verify-only step for the Change Password flow: the app checks the current
-- password first and only reveals the new-password fields once this returns
-- true, without touching app_password yet.
CREATE OR REPLACE FUNCTION teacher_verify_password(p_employee_id TEXT, p_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id::UUID AND app_password = p_password
  );
END;
$$;

GRANT EXECUTE ON FUNCTION teacher_update_profile(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION teacher_change_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION teacher_verify_password(TEXT, TEXT) TO anon;
