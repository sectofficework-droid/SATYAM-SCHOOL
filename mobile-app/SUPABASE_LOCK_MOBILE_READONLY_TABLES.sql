-- REQ-SEC-002, Category 2 of the mobile-tables remediation plan
-- (governance/planning/REQ-SEC-002-MOBILE-TABLES-PLAN.md), applied 2026-09-19.
-- academic_years, app_versions, class_subjects, daily_tasks,
-- employee_attendance, employee_shifts, notices,
-- official_exam_subject_config, official_exams, school_profile,
-- school_rules, timetables -- confirmed by grepping
-- mobile-app/lib/core/services/supabase_service.dart (the only file with
-- direct Flutter table access, alongside diagnostic_logger.dart which
-- touches none of these) to have ZERO insert/update/delete call sites --
-- read-only from every mobile flavor (teacher/student/attendance).
-- employee_attendance/employee_shifts already had anon restricted to
-- SELECT-only via grants alone (no RLS) -- this formalizes that into a real
-- policy, matching the other 10. Pattern: same as school_calendar_events
-- (SUPABASE_LOCK_CALENDAR_EVENTS.sql, 2026-09-04) -- keep anon SELECT,
-- admin-only writes via is_admin_user().
-- Verified live afterward: anon SELECT returns the expected row counts on
-- all 12; anon INSERT/UPDATE/DELETE correctly "permission denied". Live
-- project-wide rls_disabled count dropped from 33 to 17, matching exactly
-- the 17 tables left in Category 3 (the tables needing a real architecture
-- decision before any fix -- not touched by this migration).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_years', 'app_versions', 'class_subjects', 'daily_tasks',
    'employee_attendance', 'employee_shifts', 'notices',
    'official_exam_subject_config', 'official_exams', 'school_profile',
    'school_rules', 'timetables'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'anon read ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin_user())',
      'admin staff insert ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
      'admin staff update ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin_user())',
      'admin staff delete ' || t, t
    );
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;
