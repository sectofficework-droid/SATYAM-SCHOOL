-- Tech-debt cleanup from the 2026-11 full-system audit's "still open" list
-- (TODO.md's non-checkbox tail: "multiple_permissive_policies ... redundant
-- overlapping SELECT policies ... artifact of old *_all_users_read/
-- *_own_*/*_teachers policies never cleaned up after the RPC migration").
-- Supabase's live performance advisor flagged 61 role/action combinations
-- across 6 tables where 2+ permissive RLS policies apply to the same
-- {role, command} - each extra policy is a separate plan node Postgres
-- must evaluate and OR together on every matching query.
--
-- Two kinds of overlap, handled differently so NO effective access changes:
--
-- (A) One policy is a strict superset of the others for that action, so
--     the narrower ones contribute nothing (verified below) - drop the
--     narrower ones outright, keep the superset as the sole policy.
-- (B) Two policies are genuinely different populations (e.g. "is admin" OR
--     "is the class teacher") that must both keep granting access - merged
--     into ONE policy per {table, command} with an explicit OR, instead of
--     2 separate ALL-command policies whose SELECT/INSERT/UPDATE/DELETE
--     branches all overlapped pairwise.
--
-- Verified before writing this: is_admin_user() = EXISTS(admin_users WHERE
-- id = auth.uid()) - since `id = NULL` is never true, is_admin_user() TRUE
-- always implies auth.uid() IS NOT NULL. Same reasoning for the
-- employees.app_user_id = auth.uid() / students.app_user_id = auth.uid()
-- EXISTS checks: a NULL auth.uid() can never satisfy them. That's what
-- makes the "(select auth.uid()) IS NOT NULL" policies on exam_marks/
-- exams/homework/student_attendance a true superset of every other SELECT
-- policy on those same tables.
--
-- Applied live via Supabase MCP 2026-11-20. Re-verified after via
-- pg_policies (merged qual is logically equivalent to the OR of the
-- originals) and the Supabase performance advisor (multiple_permissive_
-- policies count: 61 -> 0).

-- ── employees ───────────────────────────────────────────────────────────
-- SELECT: "anon read employees" (qual = true) already grants unconditional
-- row visibility to every role (REQ-SEC-002's deliberate Category-2
-- open-row-policy-plus-column-GRANT pattern - see TODO.md) - both
-- "admin staff manage employees"'s SELECT branch and "employees_own_profile"
-- are strictly dominated by `true` and contribute nothing. Writes
-- (INSERT/UPDATE/DELETE) stay admin-only, just split out of the ALL policy
-- so SELECT is no longer bundled in.
CREATE POLICY "admin staff insert employees" ON public.employees
  FOR INSERT TO public WITH CHECK (is_admin_user());
CREATE POLICY "admin staff update employees" ON public.employees
  FOR UPDATE TO public USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "admin staff delete employees" ON public.employees
  FOR DELETE TO public USING (is_admin_user());
DROP POLICY "admin staff manage employees" ON public.employees;
DROP POLICY "employees_own_profile" ON public.employees;
-- "anon read employees" (SELECT, qual=true) is now the sole SELECT policy.

-- ── exams ───────────────────────────────────────────────────────────────
-- SELECT: "exams_all_users" (auth.uid() IS NOT NULL) dominates
-- is_admin_user() per the proof above. Only one write policy exists
-- (admin-only), so just drop its SELECT branch by splitting ALL -> 3.
CREATE POLICY "admin manage insert exams" ON public.exams
  FOR INSERT TO public WITH CHECK (is_admin_user());
CREATE POLICY "admin manage update exams" ON public.exams
  FOR UPDATE TO public USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "admin manage delete exams" ON public.exams
  FOR DELETE TO public USING (is_admin_user());
DROP POLICY "admin staff manage exams" ON public.exams;
-- "exams_all_users" (SELECT) is now the sole SELECT policy.

-- ── exam_marks ──────────────────────────────────────────────────────────
-- SELECT: "marks_all_users_read" (auth.uid() IS NOT NULL) dominates both
-- is_admin_user() and the teacher-exists check, AND dominates
-- "marks_own_student" (a strictly narrower subset of "any authenticated
-- user") - drop all 3 narrower SELECT contributors, keep it as the sole
-- SELECT policy. Writes: "admin staff manage exam_marks" and
-- "marks_teachers" were 2 separate ALL policies (admin OR teacher) -
-- merged into one explicit policy per write command instead.
CREATE POLICY "admin or teacher insert exam_marks" ON public.exam_marks
  FOR INSERT TO public WITH CHECK (
    is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid()))
  );
CREATE POLICY "admin or teacher update exam_marks" ON public.exam_marks
  FOR UPDATE TO public
  USING (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())))
  WITH CHECK (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));
CREATE POLICY "admin or teacher delete exam_marks" ON public.exam_marks
  FOR DELETE TO public
  USING (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));
DROP POLICY "admin staff manage exam_marks" ON public.exam_marks;
DROP POLICY "marks_teachers" ON public.exam_marks;
DROP POLICY "marks_own_student" ON public.exam_marks;
-- "marks_all_users_read" (SELECT) is now the sole SELECT policy.

-- ── homework ────────────────────────────────────────────────────────────
-- SELECT: "homework_all_users" (auth.uid() IS NOT NULL) dominates
-- is_admin_user() - drop that branch. INSERT: "admin staff manage
-- homework" and "homework_teachers_insert" both gated INSERT (admin OR
-- teacher) - merged into one. UPDATE/DELETE: admin-only, unchanged logic,
-- just split out of the ALL policy.
CREATE POLICY "admin or teacher insert homework" ON public.homework
  FOR INSERT TO public WITH CHECK (
    is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid()))
  );
CREATE POLICY "admin manage update homework" ON public.homework
  FOR UPDATE TO public USING (is_admin_user()) WITH CHECK (is_admin_user());
CREATE POLICY "admin manage delete homework" ON public.homework
  FOR DELETE TO public USING (is_admin_user());
DROP POLICY "admin staff manage homework" ON public.homework;
DROP POLICY "homework_teachers_insert" ON public.homework;
-- "homework_all_users" (SELECT) is now the sole SELECT policy.

-- ── student_attendance ─────────────────────────────────────────────────
-- Same shape as exam_marks: "attendance_all_users_read" dominates
-- is_admin_user(), the teacher-exists check, AND "students_own_attendance"
-- for SELECT; writes merge admin + teacher into one policy per command.
CREATE POLICY "admin or teacher insert student_attendance" ON public.student_attendance
  FOR INSERT TO public WITH CHECK (
    is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid()))
  );
CREATE POLICY "admin or teacher update student_attendance" ON public.student_attendance
  FOR UPDATE TO public
  USING (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())))
  WITH CHECK (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));
CREATE POLICY "admin or teacher delete student_attendance" ON public.student_attendance
  FOR DELETE TO public
  USING (is_admin_user() OR EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));
DROP POLICY "admin staff manage student_attendance" ON public.student_attendance;
DROP POLICY "teachers_attendance" ON public.student_attendance;
DROP POLICY "students_own_attendance" ON public.student_attendance;
-- "attendance_all_users_read" (SELECT) is now the sole SELECT policy.

-- ── students ────────────────────────────────────────────────────────────
-- SELECT only (the one the advisor flagged): "admin staff select students"
-- (role=authenticated, is_admin_user()) and "students_own_profile"
-- (role=public, app_user_id = auth.uid()) are genuinely different
-- populations - neither dominates the other - so merged into one policy
-- instead of dropping either. Kept roles=public (students_own_profile's
-- original scope): for a true anon caller both OR-terms were already
-- false before (auth.uid() NULL fails both an admin-row match and a
-- profile match), so widening the merged policy's role scope changes
-- nothing for anon. INSERT/UPDATE (admin-only, single policy each) were
-- not flagged and are untouched.
CREATE POLICY "admin or own profile select students" ON public.students
  FOR SELECT TO public USING (is_admin_user() OR app_user_id = (select auth.uid()));
DROP POLICY "admin staff select students" ON public.students;
DROP POLICY "students_own_profile" ON public.students;
