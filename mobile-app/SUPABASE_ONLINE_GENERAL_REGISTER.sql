-- REQ-BUG-077 (2026-10-25): Online General Register storage move.
--
-- WHY: the Online GR module (commits 2026-10-23/24) persisted its data by
-- rewriting the git-tracked file admin-panel/src/data/
-- onlineGeneralRegisterData.json at runtime — which on Vercel serverless
-- fails silently (per-instance memory diverges, edits vanish), and in dev
-- mutates a tracked file full of student PII (Aadhaar etc.). This
-- migration gives the module a real table so the JSON stops being a
-- write target (REQ-SEC-021 context: that file is student PII and should
-- not live in a git-tracked file at all).
--
-- ADDITIVE / NON-DESTRUCTIVE: creates two new tables only; touches no
-- existing table. Reversible with:
--   DROP TABLE IF EXISTS public.online_general_register_meta;
--   DROP TABLE IF EXISTS public.online_general_register;
--
-- APPLY: Supabase Dashboard → SQL Editor → paste this whole file → Run.
-- The admin panel route auto-seeds this table ONCE from the bundled JSON
-- on first read (guarded by online_general_register_meta), so no PII rows
-- go into any tracked SQL file.
--
-- ADMIN PANEL ACCESS: the route uses the service-role key (same pattern
-- as kiosk-settings), which bypasses RLS. The policy below is
-- defense-in-depth for any future direct dashboard access (same
-- is_admin_user() pattern as notebook_log / student_daily_log); the anon
-- default grants are explicitly revoked up front (REQ-SEC-002 lesson).

CREATE TABLE IF NOT EXISTS public.online_general_register (
  id                TEXT PRIMARY KEY,
  section           TEXT NOT NULL CHECK (section IN ('primary', 'general')),
  session           TEXT,
  tc_status         TEXT,
  cls               TEXT,
  gr_no             TEXT,
  name              TEXT,
  mobile1           TEXT,
  mobile2           TEXT,
  dob_slash         TEXT,
  doa_slash         TEXT,
  doe_slash         TEXT,
  aadhar_no         TEXT,
  pen               TEXT,
  apaar             TEXT,
  udise             TEXT,
  remarks           TEXT,
  documents_pending TEXT,
  status            TEXT NOT NULL DEFAULT 'Pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.online_general_register ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.online_general_register_meta (
  id        TEXT PRIMARY KEY,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.online_general_register_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY online_general_register_admin_policy
  ON public.online_general_register FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY online_general_register_meta_admin_policy
  ON public.online_general_register_meta FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

REVOKE ALL ON public.online_general_register        FROM anon;
REVOKE ALL ON public.online_general_register_meta   FROM anon;
