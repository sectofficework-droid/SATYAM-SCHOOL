-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnostic reports (AGENTS.md §L, REQ-HYG-006 Phase 1.5) - centralizes
-- error/bug reports from the Teacher/Student/Attendance mobile apps ("Report
-- a Problem") and the admin panel (auto-submitted from src/lib/logger.js on
-- every captured error) into one table, so both the admin panel UI and an AI
-- agent querying this project's Supabase MCP connection can see them without
-- the reporter having to describe technical details.
--
-- Deliberately NOT following this project's usual "disable RLS, grant anon
-- everything" convention (see SUPABASE_QUERIES_RULES.sql) - that pattern is
-- exactly what REQ-SEC-002 flags as a problem, and this table will hold stack
-- traces and app-state context that's more sensitive than a suggestion-box
-- message. Instead reuses the public.is_admin_user() helper already
-- established in SUPABASE_LOCK_STUDENTS_ADMIN_USERS.sql /
-- SUPABASE_LOCK_CALENDAR_EVENTS.sql: anyone can submit their own report
-- (INSERT, no gate - reporting a bug isn't a sensitive action), only a
-- logged-in admin-panel user can read or triage them.
--
-- Run this in Supabase Dashboard -> SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  app          TEXT NOT NULL CHECK (app IN ('admin-panel','teacher','student','attendance')),
  platform     TEXT,                 -- e.g. 'web', 'android'
  version      TEXT,                 -- app/build version at time of report
  session_id   TEXT,                 -- correlates entries from the same session (AGENTS.md §L4)
  user_type    TEXT,                 -- 'teacher' | 'student' | 'kiosk_admin' | 'admin' | null (unauthenticated)
  user_id      TEXT,                 -- polymorphic like queries_suggestions.user_id - no single FK target
  user_name    TEXT,
  description  TEXT,                 -- optional one-line note the reporter typed ("what happened?")
  log_entries  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- recent structured, already-redacted entries
  status       TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Reviewed','Resolved')),
  reviewed_by  TEXT,
  reviewed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_status     ON public.diagnostic_reports(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_created_at ON public.diagnostic_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_app        ON public.diagnostic_reports(app);

ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (anon mobile apps, or the admin panel before/after login) can
-- submit their own report - matches queries_suggestions' no-gate INSERT.
CREATE POLICY "anyone can submit a diagnostic report" ON public.diagnostic_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only a logged-in admin-panel user can read or triage reports.
CREATE POLICY "admin staff read diagnostic reports" ON public.diagnostic_reports
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "admin staff update diagnostic reports" ON public.diagnostic_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Admin can delete old reports - used by the admin panel's lazy retention
-- cleanup (src/lib/diagnosticsService.js, runs on /diagnostics page load;
-- deletes anything older than 90 days regardless of status, since these
-- are development-debugging aids, not a permanent audit record).
CREATE POLICY "admin staff delete diagnostic reports" ON public.diagnostic_reports
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

-- No anon SELECT/UPDATE/DELETE grant.

-- ─────────────────────────────────────────────────────────────────────────────
-- diagnostic_settings - single global on/off switch (REQ-HYG-006, added
-- 2026-09-16 at the user's explicit request: this logging exists for
-- development/debugging, not to passively collect what users do, so it
-- must be possible to turn off). Gates AUTOMATIC error auto-submission
-- only (logger.js's error()/fatal(), diagnostic_logger.dart's error()/
-- fatal()) - the user-initiated "Report a Problem" flow in the mobile
-- apps is unaffected by this switch, since that's explicit per-incident
-- consent, not passive collection, and should always work.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.diagnostic_settings (
  id          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.diagnostic_settings (id, enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.diagnostic_settings ENABLE ROW LEVEL SECURITY;

-- Every client (anon mobile apps + admin panel) needs to read this to know
-- whether to auto-submit at all.
CREATE POLICY "anyone can read the diagnostic logging switch" ON public.diagnostic_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "admin staff toggle diagnostic logging" ON public.diagnostic_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
