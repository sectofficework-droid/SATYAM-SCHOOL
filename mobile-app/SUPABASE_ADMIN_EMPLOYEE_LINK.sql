-- Staff App Unification (governance/planning/STAFF-APP-UNIFICATION-PLAN.md)
-- admin_users <-> employees linkage. Applied 2026-09-19 via
-- mcp__supabase__apply_migration (dry-run tested in a rolled-back
-- transaction first - clean, 28 employees / 0 linked before and after).
-- Verified: FK + UNIQUE constraint present as written, no grant/RLS
-- changes, so no existing login/permission path for any of the 3 mobile
-- flavors or the admin panel was touched.
--
-- Decision record (plan file, "Decision record" section, 2026-09-18):
--   - Option 1 chosen: explicit nullable FK column, employees.admin_user_id
--     -> admin_users(id). Left NULL for every row by default.
--   - Set manually by management only, for the ~4 admin accounts that need
--     it. No fuzzy name/email matching at runtime, no backfill of the 3
--     coincidental name-matches found during the 2026-09-18 audit (SUNIL
--     PRADHAN/EMP001, Rajesh Biswal/EMP002, BK DEBIPRASAD DAS/EMP003) -
--     they stay NULL until someone deliberately links them.
--   - Chosen over shared-unique-email (would need a new employees.email
--     uniqueness constraint - more invasive) and over no-mapping-at-all
--     (would leave Teacher+Admin permanently unsupported).
--   - "Without breaking the deployment": nullable + additive only. No
--     existing column dropped/renamed, no existing RPC signature changed.
--     Safe to apply without touching any currently-working login/
--     permission path for any of the 3 mobile flavors or the admin panel.
--
-- Two choices below were NOT explicitly decided in the plan file and are
-- this draft's own judgment call, not yet approved - flagged so you can
-- veto either without needing to touch the rest:
--
--   1. ON DELETE SET NULL (not RESTRICT/CASCADE). If a linked admin_users
--      row is ever deleted (via admin_update_user's sibling
--      admin_delete_user RPC, REQ-SEC-005), the linked employee record
--      should not be blocked from deletion, nor should it be silently
--      deleted itself just because the admin side went away - the link
--      should simply clear. This is the least-surprising default; RESTRICT
--      would make admin_delete_user fail unexpectedly for the ~3 people
--      who might get linked, and CASCADE would delete a real employee
--      record over an unrelated admin-account cleanup.
--
--   2. UNIQUE constraint on employees.admin_user_id (NULLs excluded, so
--      this only restricts non-null links - unlimited employees may still
--      have NULL). Prevents one admin_users row ever being linked from two
--      different employee rows at once - a plain data-integrity guard, not
--      a new access-control rule. If you'd rather allow that (no realistic
--      use case comes to mind, but flagging it exists as a choice), drop
--      the UNIQUE constraint statement below.

ALTER TABLE employees
  ADD COLUMN admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE employees
  ADD CONSTRAINT employees_admin_user_id_unique UNIQUE (admin_user_id);

-- No grant changes needed - employees' existing SELECT/UPDATE grants
-- already cover this new column like any other (tracked separately under
-- REQ-SEC-002's broader anon-exposure item, not reopened here). No RLS
-- policy references this column yet; StaffRoleContext's admin-role-
-- resolution half (spec SS4) is what will read it, once DESIGN FIXED
-- decides exactly how.
--
-- No backfill statement included deliberately, per the decision record
-- above - every employees.admin_user_id row stays NULL until management
-- links a specific person by hand (e.g. via a future Settings UI action,
-- not designed yet).
