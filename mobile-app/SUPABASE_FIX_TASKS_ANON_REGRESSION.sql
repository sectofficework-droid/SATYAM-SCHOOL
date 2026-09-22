-- REQ-SEC-002 Tranche 1 regression fix, applied 2026-09-19 (same day as the
-- Tranche 1 fix that caused it). tasks and daily_task_targets were locked to
-- authenticated+is_admin_user() only in Tranche 1, with anon's grants fully
-- revoked. But the Teacher app's task_assignees/daily_tasks reads use
-- PostgREST embeds (task:tasks(*), daily_task_targets(employee_id)) that
-- need direct SELECT grants on these two tables even though the app never
-- queries them by name directly (no session, anon key only). Live-verified
-- broken in production: anon SELECT on both returned "permission denied"
-- from the moment Tranche 1 shipped until this fix.
-- Fix: restore anon SELECT-only (writes stay admin-only) — same pattern
-- already used for school_calendar_events (SUPABASE_LOCK_CALENDAR_EVENTS.sql).
-- Verified live afterward (role-simulated, rolled back): anon SELECT now
-- returns rows on both tables; anon INSERT still correctly gets
-- "permission denied".

GRANT SELECT ON public.tasks TO anon;
GRANT SELECT ON public.daily_task_targets TO anon;

CREATE POLICY "anon read tasks" ON public.tasks
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon read daily_task_targets" ON public.daily_task_targets
  FOR SELECT TO anon
  USING (true);
