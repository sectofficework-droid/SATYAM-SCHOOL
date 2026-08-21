-- ─────────────────────────────────────────────────────────────────────────────
-- Fix "function crypt(text, text) does not exist" across every REQ-SEC-001
-- function - a second bug uncovered after fixing the column-name regression
-- in SUPABASE_FIX_LOGIN_REGRESSION.sql.
--
-- What's broken: every function from SUPABASE_HASH_APP_PASSWORD.sql declares
-- SET search_path = public, but Supabase installs pgcrypto (crypt(), gen_salt())
-- into the `extensions` schema, not `public`. Any SECURITY DEFINER function
-- that pins its own search_path (as all of these correctly do, to avoid
-- search_path hijacking) therefore can't resolve crypt() at all - confirmed
-- live: teacher_login, student_login, and teacher_verify_password all
-- currently fail with "function crypt(text, text) does not exist" on every
-- call. teacher_change_password and the two admin_reset_* functions call
-- crypt() the same way and are affected identically, even though their
-- error wasn't directly reproduced here (admin_reset_* short-circuit on the
-- admin_users check before reaching crypt() when called as anon).
--
-- Fix: add `extensions` to each function's search_path. Re-affirms every
-- password-related RPC from yesterday's migration; does not touch table
-- data (already hashed/correct from that migration) or column logic
-- (already fixed by SUPABASE_FIX_LOGIN_REGRESSION.sql - run that first).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION teacher_login(TEXT, TEXT)                 SET search_path = public, extensions;
ALTER FUNCTION student_login(TEXT, TEXT)                 SET search_path = public, extensions;
ALTER FUNCTION teacher_change_password(TEXT, TEXT, TEXT)  SET search_path = public, extensions;
ALTER FUNCTION teacher_verify_password(TEXT, TEXT)        SET search_path = public, extensions;
ALTER FUNCTION admin_reset_student_password(UUID, TEXT)   SET search_path = public, extensions;
ALTER FUNCTION admin_reset_employee_password(UUID, TEXT)  SET search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: SELECT teacher_login('<real emp_code>', '<their password>');
-- should return a JSON object, not an error. Same for student_login. Then
-- test the admin panel's Reset Password button on a real (or test) account.
-- ─────────────────────────────────────────────────────────────────────────────
