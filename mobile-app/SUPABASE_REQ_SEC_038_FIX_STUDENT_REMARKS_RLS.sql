-- REQ-SEC-038 (2026-11-20 full-system audit): student_remarks_authenticated_all
-- covered the whole `authenticated` role with qual=true/with_check=true,
-- bypassing the is_admin_user() check every sibling table uses - any real
-- Supabase Auth session (not just one with an admin_users row) could
-- read/write/delete any student's report-card remark. Not actively
-- exploitable today (every authenticated session currently has a matching
-- admin_users row), but matched to the established pattern to close the
-- gap before it matters. Applied live via Supabase MCP 2026-11-20.

ALTER POLICY student_remarks_authenticated_all ON public.student_remarks
  USING (is_admin_user()) WITH CHECK (is_admin_user());
