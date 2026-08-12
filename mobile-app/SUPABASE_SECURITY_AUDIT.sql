-- ─────────────────────────────────────────────────────────────────────────────
-- Security audit: current RLS + anon/authenticated grant status for every
-- table in the public schema. Run in Supabase Dashboard → SQL Editor and
-- share the full result.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) RLS enabled/disabled per table
SELECT schemaname, tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- 2) What anon / authenticated can actually do on each table
--    (this is the real exposure — RLS off + a grant here = publicly readable/writable)
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 3) Existing RLS policies, and which tables have RLS on but zero policies
--    (RLS on + no policy = table is fully locked, possibly breaking the app)
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- 4) Columns that could leak sensitive data if a table above turns out open
--    (quick check of what's actually in employees/students)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('employees', 'students')
  AND column_name IN ('app_password', 'phone', 'aadhar', 'aadhar_number', 'pan', 'pan_number', 'address', 'email')
ORDER BY table_name, column_name;
