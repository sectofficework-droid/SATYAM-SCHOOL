-- ─────────────────────────────────────────────────────────────────────────────
-- Hash app_password (students/employees) — REQ-SEC-001
-- Run in Supabase Dashboard -> SQL Editor, top to bottom, once.
-- Plan/approval on record: governance/planning/TODO.md REQ-SEC-001,
-- governance/ai-context/SESSION-2026-08-21-2.md.
--
-- What this does:
--   1. Enables pgcrypto (bcrypt) - not previously enabled.
--   2. Backs up every current plaintext app_password into a table you should
--      DROP once you've verified logins still work (see bottom of this file).
--   3. Hashes app_password in place on students/employees. Idempotent - safe
--      to re-run, already-hashed rows (bcrypt values start with $2) are
--      skipped, never double-hashed.
--   4. Redefines teacher_login/student_login to compare against the hash
--      instead of plaintext `=`, and to stop returning app_password at all
--      in the login response (previously the whole row, password included,
--      was shipped back to the client on every login).
--   5. Redefines teacher_change_password/teacher_verify_password the same
--      way (compare + write via crypt()).
--   6. Adds student_alerts (new table, mirrors the existing teacher_alerts) -
--      students previously had no per-student (non-broadcast) message
--      mechanism at all.
--   7. Adds two new admin-only RPCs (admin_reset_student_password /
--      admin_reset_employee_password) for the admin panel's new Reset
--      Password action - granted to `authenticated` only, never `anon`, and
--      each checks the caller is a real row in admin_users before writing.
--      Both also drop a row into teacher_alerts/student_alerts respectively,
--      so the teacher/student sees "Password Reset - use your new password"
--      next time they open the app.
--
-- Steps 1-5 and 7's RPC bodies touch no Dart code - existing installed apps
-- keep sending plaintext passwords over TLS exactly as before, only the
-- DB-side comparison/storage changed. Step 6 (student_alerts) DOES need a
-- paired Dart change + rebuild of the student app flavor specifically, to
-- actually surface it in the UI - see mobile-app/lib/core/services/
-- supabase_service.dart (fetchStudentAlerts, new) and
-- mobile-app/lib/app/modules/student/dashboard/student_home.dart
-- (_loadNotifications, updated) in this same commit. The teacher-side popup
-- needs NO rebuild - teacher_home.dart already polls teacher_alerts today.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Enable bcrypt support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Backup current plaintext values before hashing (rollback source).
--    DROP TABLE _app_password_backup_20260821; once you've verified logins
--    work post-migration - don't leave plaintext passwords sitting around
--    longer than needed.
CREATE TABLE IF NOT EXISTS _app_password_backup_20260821 (
  id            UUID NOT NULL,
  source_table  TEXT NOT NULL,
  old_password  TEXT,
  backed_up_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id, source_table)
);

INSERT INTO _app_password_backup_20260821 (id, source_table, old_password)
SELECT id, 'students', app_password FROM students
WHERE app_password IS NOT NULL AND app_password NOT LIKE '$2%'
ON CONFLICT DO NOTHING;

INSERT INTO _app_password_backup_20260821 (id, source_table, old_password)
SELECT id, 'employees', app_password FROM employees
WHERE app_password IS NOT NULL AND app_password NOT LIKE '$2%'
ON CONFLICT DO NOTHING;

-- 3) Hash in place (skips rows already hashed - safe to re-run)
UPDATE students SET app_password = crypt(app_password, gen_salt('bf'))
WHERE app_password IS NOT NULL AND app_password NOT LIKE '$2%';

UPDATE employees SET app_password = crypt(app_password, gen_salt('bf'))
WHERE app_password IS NOT NULL AND app_password NOT LIKE '$2%';

-- 4) Login RPCs - compare against hash, stop returning app_password
CREATE OR REPLACE FUNCTION teacher_login(p_employee_id TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row employees%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM employees
  WHERE UPPER(TRIM(employee_id)) = UPPER(TRIM(p_employee_id))
    AND app_password = crypt(p_password, app_password);
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN (row_to_json(v_row)::jsonb - 'app_password')::json;
END;
$$;

CREATE OR REPLACE FUNCTION student_login(p_enrollment_no TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row students%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM students
  WHERE UPPER(TRIM(enrollment_no)) = UPPER(TRIM(p_enrollment_no))
    AND app_password = crypt(p_password, app_password);
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN (row_to_json(v_row)::jsonb - 'app_password')::json;
END;
$$;

-- 5) Teacher settings RPCs - compare + write against hash
CREATE OR REPLACE FUNCTION teacher_change_password(p_employee_id TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id::UUID AND app_password = crypt(p_old_password, app_password)
  ) INTO v_ok;
  IF NOT v_ok THEN RETURN FALSE; END IF;

  UPDATE employees SET app_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = p_employee_id::UUID;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_verify_password(p_employee_id TEXT, p_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id::UUID AND app_password = crypt(p_password, app_password)
  );
END;
$$;

-- 6) New: student_alerts, the per-student equivalent of teacher_alerts.
--    Didn't exist before this file - students previously had no way to
--    receive a targeted (non-broadcast) in-app message. SELECT-only grant
--    to anon: the student app only ever reads its own alerts; nothing in
--    the client writes to this table (unlike teacher_alerts, which the app
--    never writes to either despite its broader legacy grant - not
--    replicating that over-grant here, see REQ-SEC-002).
CREATE TABLE IF NOT EXISTS student_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_alerts_student ON student_alerts(student_id);
ALTER TABLE student_alerts DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON student_alerts TO anon;

-- 7) New: admin-panel password reset (hashes server-side, one implementation
--    of bcrypt-writing shared with everything above - the admin panel never
--    computes a hash itself). Restricted to real admin_users rows, mirroring
--    how AuthGuard.jsx already gates the admin panel itself (admin_users.id
--    = auth.users.id via Supabase Auth). Granted to `authenticated`, never
--    `anon` - the mobile apps have no reason to call these.
CREATE OR REPLACE FUNCTION admin_reset_student_password(p_student_id UUID, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE students SET app_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_student_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO student_alerts (student_id, title, message)
  VALUES (p_student_id, 'Password Reset',
    'Your app password was reset by an administrator. Please use your new password to log in.');

  RETURN TRUE;
END;
$$;

-- Also drops a row into teacher_alerts, the table the teacher app's existing
-- notification bell/popup already polls (supabase_service.dart::
-- fetchTeacherAlerts, merged in via teacher_home.dart's _loadNotifications) -
-- shows up automatically next time they open the app, no app rebuild needed
-- for this function itself (student_alerts above IS new, though - see the
-- Dart-side changes this migration pairs with, in the same commit).
CREATE OR REPLACE FUNCTION admin_reset_employee_password(p_employee_id UUID, p_new_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE employees SET app_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO teacher_alerts (teacher_id, title, message)
  VALUES (p_employee_id, 'Password Reset',
    'Your app password was reset by an administrator. Please use your new password to log in.');

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_student_password(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_employee_password(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER running this file: log into the teacher app and the student app with
-- an existing (pre-migration) account each, confirm login still works: proves
-- the hash + crypt() comparison round-trips correctly. Then test
-- teacher_change_password once via the app. Then, once confirmed:
--   DROP TABLE _app_password_backup_20260821;
--
-- To see the reset popup itself: reset a teacher's password from the admin
-- panel, then open the (already-installed, no update needed) teacher app -
-- the alert should appear via the existing notice popup within a day (once
-- per day per shouldShowNoticePopupToday - clear the app's storage/reinstall
-- to force it sooner while testing). The student-side popup additionally
-- needs the rebuilt student APK installed first (see the Dart changes note
-- above) before it can be tested at all.
-- ─────────────────────────────────────────────────────────────────────────────
