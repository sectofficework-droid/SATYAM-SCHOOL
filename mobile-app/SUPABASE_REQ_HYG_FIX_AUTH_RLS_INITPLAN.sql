-- Tech-debt cleanup from the 2026-11 full-system audit's "still open" list
-- (TODO.md's non-checkbox tail: "auth_rls_initplan ... re-evaluates
-- auth.<fn>() per row instead of (select auth.<fn>())"). Supabase's live
-- performance advisor flagged 12 RLS policies across 7 tables. Perf-only
-- rewrite: wraps every auth.uid() call in a scalar subquery so Postgres
-- evaluates it once per query instead of once per row - same boolean
-- result for every row, just cached instead of re-evaluated. Verified
-- live (pg_policies) that each `qual`/`with_check` is identical except for
-- the wrapping. Applied live via Supabase MCP 2026-11-20.

ALTER POLICY "self read own admin_users row" ON public.admin_users
  USING (((select auth.uid()) = id) OR is_admin_user());

ALTER POLICY employees_own_profile ON public.employees
  USING (app_user_id = (select auth.uid()));

ALTER POLICY marks_all_users_read ON public.exam_marks
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY marks_own_student ON public.exam_marks
  USING (EXISTS (SELECT 1 FROM students WHERE students.app_user_id = (select auth.uid()) AND students.id = exam_marks.student_id));

ALTER POLICY marks_teachers ON public.exam_marks
  USING (EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));

ALTER POLICY exams_all_users ON public.exams
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY homework_all_users ON public.homework
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY homework_teachers_insert ON public.homework
  WITH CHECK (EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));

ALTER POLICY attendance_all_users_read ON public.student_attendance
  USING ((select auth.uid()) IS NOT NULL);

ALTER POLICY students_own_attendance ON public.student_attendance
  USING (EXISTS (SELECT 1 FROM students WHERE students.app_user_id = (select auth.uid()) AND students.id = student_attendance.student_id));

ALTER POLICY teachers_attendance ON public.student_attendance
  USING (EXISTS (SELECT 1 FROM employees WHERE employees.app_user_id = (select auth.uid())));

ALTER POLICY students_own_profile ON public.students
  USING (app_user_id = (select auth.uid()));
