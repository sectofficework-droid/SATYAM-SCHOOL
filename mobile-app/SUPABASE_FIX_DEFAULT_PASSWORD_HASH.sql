-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: new students/employees still get a PLAINTEXT default app_password.
--
-- SUPABASE_HASH_APP_PASSWORD.sql hashed every existing row, but the column
-- default itself (set back in SUPABASE_APP_AUTH.sql) was never updated:
--   app_password TEXT DEFAULT 'Satyam@123'
-- studentService.js/employeeService.js never set app_password on insert -
-- they rely entirely on this column default. So every student/employee added
-- from the admin panel since the hashing migration has gotten a raw,
-- unhashed 'Satyam@123' - which teacher_login/student_login's
-- `app_password = crypt(p_password, app_password)` compare cannot match
-- (crypt() uses the stored value as its own salt; a non-bcrypt string there
-- doesn't produce a matching hash). Their app login would fail the same way
-- as the outage just fixed, just for one row at a time instead of everyone.
--
-- Fix: make the default hash itself at insert time, so every new row lands
-- already in the correct bcrypt form - same default password, correctly
-- stored. Confirmed PostgREST's authenticated/anon roles can already reach
-- pgcrypto (crypt/gen_salt live in `extensions`, same schema uuid_generate_v4()
-- already resolves from for every table's `id` default), so this needs no
-- role/search_path change, unlike the SECURITY DEFINER functions fixed
-- earlier.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE students  ALTER COLUMN app_password SET DEFAULT crypt('Satyam@123', gen_salt('bf'));
ALTER TABLE employees ALTER COLUMN app_password SET DEFAULT crypt('Satyam@123', gen_salt('bf'));

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: add a new test student/employee from the admin panel (no
-- app_password field to fill in - there never was one), then confirm:
--   SELECT app_password FROM students  WHERE id = '<new student id>';
--   SELECT app_password FROM employees WHERE id = '<new employee id>';
-- Both should start with $2 (bcrypt), not read as 'Satyam@123'. Then confirm
-- student_login/teacher_login succeeds with enrollment_no/emp_code +
-- 'Satyam@123' for that new row.
-- ─────────────────────────────────────────────────────────────────────────────
