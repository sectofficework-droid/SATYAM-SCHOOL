-- REQ-SEC-002 (Category 3, Groups B/C): the last 8 tables still fully
-- exposed to anon. The replacement RPCs (session-token-gated, same
-- pattern as Group A's leave_requests/daily_task_completions/etc.) were
-- already built and verified weeks ago; this migration itself - flipping
-- RLS on + revoking anon - was deliberately deferred pending confirmation
-- that real installed devices have the matching Dart RPC-calling code
-- (flipping it once before, 2026-09-21, broke Mark Attendance for
-- teachers on an old build and had to be rolled back). User confirmed
-- 2026-11-19 that adoption is now safe to assume.
--
-- 7 tables (exam_marks, exams, homework, official_exam_marks,
-- student_attendance, syllabus, syllabus_subtopics): confirmed zero
-- remaining direct `.from()` reads anywhere in mobile-app/lib - fully
-- migrated to RPCs, so these get the same fully-closed pattern as Group
-- A's leave_requests (one admin-only ALL policy, no anon policy at all).
--
-- `employees` is the exception: mobile-app/lib/core/services/
-- supabase_service.dart still reads it directly in 2 places
-- (fetchOtherTeachers, fetchPrincipalContact) - both already scoped to
-- the same small set of non-sensitive columns the existing column-level
-- GRANT already restricts anon to (id/name/phone/type/status/
-- designation). RLS is row-level, not column-level, so enabling it with
-- only an admin policy would silently break those two legitimate reads -
-- this one gets an open-row anon SELECT policy (column list stays
-- enforced by the pre-existing GRANT), matching the Category 2
-- "SELECT-only kept, writes gated" pattern (e.g. daily_tasks) rather than
-- the fully-closed one.
-- Applied directly to the live DB via Supabase MCP on 2026-11-19.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'exam_marks', 'exams', 'homework', 'official_exam_marks',
    'student_attendance', 'syllabus', 'syllabus_subtopics'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admin staff manage ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user())',
      'admin staff manage ' || t, t
    );
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin staff manage employees" ON employees;
CREATE POLICY "admin staff manage employees" ON employees
  FOR ALL USING (is_admin_user()) WITH CHECK (is_admin_user());
DROP POLICY IF EXISTS "anon read employees" ON employees;
CREATE POLICY "anon read employees" ON employees
  FOR SELECT USING (true);
