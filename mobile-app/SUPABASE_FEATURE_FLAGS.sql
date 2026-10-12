-- ─────────────────────────────────────────────────────────────────────────────
-- feature_flags - generic on/off switches for admin-panel tools that aren't
-- needed day-to-day but shouldn't be deleted outright (e.g. a one-time bulk
-- import tool). Senior Admin / Management can flip one on from Settings when
-- it's actually needed, instead of an engineer re-adding the UI entry point
-- each time. First row: 'import_basic_details' (Student page's "Import Basic
-- Details" button, hidden by default after the initial data load it was
-- built for was completed).
--
-- Same shape/RLS approach as diagnostic_settings (SUPABASE_DIAGNOSTIC_REPORTS.sql):
-- admin_has_role() from SUPABASE_ADMIN_ROLE_ENFORCEMENT.sql (REQ-SEC-005) -
-- apply that migration first if it hasn't run yet. Unlike diagnostic_settings,
-- no anon SELECT - only the admin panel (never the mobile apps) reads this.
--
-- Run this in Supabase Dashboard -> SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.feature_flags (key, enabled) VALUES
  ('import_basic_details', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Any logged-in admin-panel user can read a flag's current state (e.g. the
-- Student page checking whether to show the Import Basic Details button).
CREATE POLICY "admin staff read feature flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- Only senior_admin/management can flip a flag - matches this project's
-- existing "above normal_admin" gate for sensitive toggles (diagnostic
-- logging switch, impersonation).
CREATE POLICY "admin staff toggle feature flags" ON public.feature_flags
  FOR UPDATE TO authenticated
  USING (public.admin_has_role(ARRAY['senior_admin','management']))
  WITH CHECK (public.admin_has_role(ARRAY['senior_admin','management']));

-- No anon grant, no INSERT/DELETE policy - flags are seeded by migration,
-- not created from the UI.
