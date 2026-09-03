-- Student app "Change Password" - the student-side equivalent of
-- teacher_change_password/teacher_verify_password (SUPABASE_TEACHER_SETTINGS.sql),
-- which the student app never got. Written directly against the current
-- (post REQ-SEC-001) schema: students.app_password is a bcrypt hash, so this
-- compares/writes via crypt()/gen_salt('bf') from the start, and sets
-- search_path to `public, extensions` up front - the teacher functions
-- originally shipped with plaintext `=` compares and a public-only
-- search_path, and needed two follow-up migrations (SUPABASE_HASH_APP_PASSWORD.sql,
-- SUPABASE_FIX_CRYPT_SEARCHPATH.sql) to fix both. Both SECURITY DEFINER so
-- the anon key (used for the app's custom enrollment_no/password auth, not
-- Supabase Auth) can call them, same pattern as student_login.

-- Verify-only step for the Change Password flow: the app checks the current
-- password first and only reveals the new-password fields once this returns
-- true, without touching app_password yet.
CREATE OR REPLACE FUNCTION student_verify_password(p_student_id TEXT, p_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM students WHERE id = p_student_id::UUID AND app_password = crypt(p_password, app_password)
  );
END;
$$;

-- Returns TRUE only if p_old_password matched, and only then applies the change -
-- verification happens server-side so the app never has to read back the
-- current password to check it itself.
CREATE OR REPLACE FUNCTION student_change_password(p_student_id TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM students WHERE id = p_student_id::UUID AND app_password = crypt(p_old_password, app_password)
  ) INTO v_ok;
  IF NOT v_ok THEN RETURN FALSE; END IF;

  UPDATE students SET app_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = p_student_id::UUID;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION student_verify_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION student_change_password(TEXT, TEXT, TEXT) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: SELECT student_verify_password('<real student id>', '<their password>');
-- should return true/false, not "function crypt(text, text) does not exist".
-- ─────────────────────────────────────────────────────────────────────────────
