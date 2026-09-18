# STAFF-APP-UNIFICATION-PLAN.md — SATYAM-SCHOOL

> Tracks the "evolve `mobile-app/` Teacher app into one role-aware Staff App
> (Teacher + Admin workspaces)" initiative. Discovery input:
> `ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`. This is a **MAJOR CHANGE**
> under `AGENTS.md` §J12B (architecture, data model, security posture, and
> scope all affected) — it reopens DESIGN FIXED for the mobile app's identity/
> role model before any coding, per `AGENTS.md` §F. Multi-session effort;
> keep this file current at the start/end of every session that touches it,
> same discipline as `BOOTSTRAP.md`.

## Status
**CLARIFY closed 2026-09-18 — both open questions resolved (below). Next:
full Admin Panel feature inventory (spec §22), then PLANNING/DESIGN FIXED.**
No code changed. Nothing committed.

## Decision record — admin_users ↔ employees linkage (2026-09-18)
**Decided: Option 1 — explicit FK column**, user's own words: "make
recommended decision without breaking the deployment." Add a nullable
`employees.admin_user_id UUID REFERENCES admin_users(id)` (direction may be
swapped to `admin_users.employee_id` if that proves cleaner at DESIGN FIXED
time — not yet drafted), left `NULL` for every row by default. Set manually
by management only for the ~4 admin accounts that need it — no fuzzy
name/email matching at runtime, no backfill of the 3 coincidental
name-matches found during audit (they stay `NULL` until someone deliberately
links them). Explicitly chosen over shared-unique-email (Option 2, would
require adding/enforcing a new `employees.email` uniqueness constraint —
more invasive) and over purely-manual/no-mapping (Option 3, would leave
Teacher+Admin permanently unsupported).
**"Without breaking the deployment" constraint — how this decision satisfies
it:** the column is nullable and additive only (no existing column dropped
or renamed, no existing RPC signature changed), so it needs its own
`ALTER TABLE`/migration file (not yet written) that can be applied without
touching any currently-working login/permission path for any of the 3
mobile flavors or the admin panel. Still needs a real migration script,
review, and explicit "code it" before it's applied to production — this
entry records the decision, not an implementation.

## Mini gate checklist (this feature only — see AGENTS.md §F)
- [x] DISCOVERY — full spec supplied 2026-09-18, archived verbatim in
      `ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`.
- [x] CLARIFY — both questions resolved 2026-09-18: admin↔employee linkage
      decided (above), and the role-permissions question answered (below,
      spun out as `TODO.md` REQ-SEC-005 — worse than assumed, not just
      "client-side only").
- [ ] PLANNING — this file is the draft; not yet reviewed/approved by you.
- [ ] DESIGN FIXED — not started; depends on CLARIFY.
- [ ] UI DESIGN CONFIRMED — not started.
- [ ] CODING — **do not start until "code it" is said, and not before DESIGN
      FIXED for the role-resolution mechanism specifically** — this is
      exactly the auth/security-adjacent, architecture-affecting case
      `PLAN.md`'s "Workflow" section requires a written, approved plan for.
- [ ] TESTING / RELEASE — not applicable yet.

## What's confirmed so far (read-only audit, 2026-09-18)

### Two separate identity systems, confirmed live in Supabase
- **`admin_users`** (web admin identity) — columns: `id` (uuid, = the
  Supabase Auth `auth.users.id`, PKCE session), `name`, `initials`, `role`.
  `role` is exactly `management` / `senior_admin` / `normal_admin` — 4 rows
  total in production right now (1 management, 1 normal_admin, 2
  senior_admin). No `employee_id`, `emp_code`, or `email` column exists on
  this table.
- **`employees`** (mobile/staff identity) — columns include `emp_code`,
  `name`, `type`, `designation`, `department`, `employment_type`,
  `class_teacher_of_section_id`, `subject_mappings`, `app_password` (bcrypt,
  since REQ-SEC-001), `app_user_id` (legacy — references `auth.users`, from
  an abandoned earlier "real Supabase Auth for mobile" design predating the
  current `teacher_login` RPC; not used by the live login path, do not
  build new logic on it without checking first).
- **`employees.type` is the authoritative teaching-status field.** Live
  distinct values: `teaching`, `non-teaching`, `management`, `media`. This
  directly answers spec question 1 ("is this employee a teacher?") — no new
  column needed for that half.
- Mobile login (`teacher_login` RPC) authenticates against `employees` only,
  as `anon` — it has never had any concept of `admin_users` roles.
- An existing bridge already exists in one direction only: the **Admin
  Access Code impersonation module** (`mobile-app/SUPABASE_IMPERSONATION.sql`,
  shipped 2026-08-28) lets a `management`/`senior_admin` admin-panel user
  generate a short code that logs the mobile app in *as* a specific
  `employees` or `students` row — full impersonation of that identity, not
  "this admin, with admin permissions, inside the mobile app." It does not
  give the mobile app any way to know the current employee also holds an
  `admin_users` role.

### Open decision — no reliable admin_users ↔ employees link exists today
Checked both plausible joins live against production data:
- By auth email (`admin_users.id → auth.users.id → auth.users.email` vs.
  `employees.email`): **zero matches** across all 4 admin accounts.
- By name (case-insensitive, trimmed): **3 of 4 match** —
  `SUNIL PRADHAN`/management → `EMP001` (`employees.type = management`),
  `Rajesh Biswal`/senior_admin → `EMP002` (`type = non-teaching`),
  `BK DEBIPRASAD DAS`/senior_admin → `EMP003` (`type = non-teaching`). The
  4th (`normal_admin`, "Satyam School") matches no employee row — it reads
  as a shared/generic front-office login, not a specific staff member.
- **None of the 3 name-matched employees have `type = teaching`** — so
  today's real data has zero actual Teacher+Admin people. Per the spec's own
  rule ("if the current data model does not support identifying a
  Teacher+Admin combination, do not invent one"), Teacher+Admin can be
  documented as **not currently exercised in production data**, but the
  mechanism still needs to exist correctly for whenever it is.
- **Name-matching is not safe to ship as the actual resolution mechanism.**
  It's coincidental string equality, not a real relationship — a typo, a
  legal-name change, a duplicate name across two different real people (a
  ~50-staff school), or a re-entered record would silently misroute
  admin/teacher access. This is exactly the kind of fragile heuristic the
  spec's own §3 rules out ("do not infer roles from... assumptions about an
  employee") and that `AGENTS.md` §J0M (object-level authorization) and §J5
  (database safety) treat as a real security concern, not a style
  preference.

**Decided 2026-09-18 — see "Decision record" above.** Option 1 (explicit
nullable FK, `employees.admin_user_id → admin_users(id)`, set manually per
person) chosen over Option 2 (shared unique email) and Option 3 (purely
manual/no mapping). Unblocks writing `StaffRoleContext`'s admin-role-
resolution half (spec §4) once a migration exists and is applied —
teaching-status resolution (`employees.type`) was already unblocked.

### Admin-panel role-permission behavior — verified 2026-09-18 (CLARIFY closed)
`documentation\PROJECT_CONTEXT.md` claims a Zustand-only `rolePermissions`
store/matrix (client-side, not yet migrated to the DB). **That claim is
stale — verified false as written**: grepped all of `admin-panel/src` for
`rolePermissions`/`permission`/`hasPermission`/`canAccess`, zero matches.
No such store or matrix exists in the current code.
What actually exists, and how it's enforced, is worse than "client-side
matrix" implies — full detail filed as **`TODO.md` REQ-SEC-005** (new,
2026-09-18), summary here:
- Role-tier gating (`normal_admin` vs `senior_admin`/`management`) is done
  via ~7 scattered `authUser.role !== "normal_admin"` conditionals across
  different pages — UI visibility only.
- The Admin Access Code impersonation RPCs correctly re-check the role
  server-side (`SECURITY DEFINER`, `role IN ('management','senior_admin')`)
  — this project's own working example of the right pattern.
- Permanent student delete and the diagnostics download/logging-toggle do
  **not** re-check role server-side — their RLS policies use
  `is_admin_user()`, which only checks admin_users *membership*, not
  `role`. A `normal_admin` calling Supabase directly (not through the UI)
  could currently perform actions the UI reserves for senior_admin/
  management.
**Conclusion for this plan**: confirmed spec §11/§13 concern is real, not
hypothetical, and broader than "some settings live in Zustand" — it's an
inconsistent, party-by-party pattern with no single source of truth.
**Binding for DESIGN FIXED**: `StaffRoleContext`'s admin-role-resolution
half must not copy any UI-only gate as-is; every mobile Admin Workspace
action gated by role tier needs its own real backend check (mirroring the
impersonation RPC pattern), decided explicitly per action in the spec
§22 feature-inventory matrix, not assumed inherited from the admin panel.
- Existing security posture to inherit as-is, not fix opportunistically
  (already tracked in `TODO.md` REQ-SEC-002): RLS disabled / broad `anon`
  grants on `employees` + ~72 other tables. Any new mobile Admin Workspace
  RPCs must be written with this in mind (SECURITY DEFINER + explicit
  in-function role checks, matching the `create_impersonation_code` /
  `get_impersonation_audit_log` pattern already in production — not relying
  on RLS that isn't there).
- Flavors confirmed: `mobile-app/android/app/build.gradle.kts`,
  `flavorDimensions += "role"`, three flavors/entry points
  (`lib/main_teacher.dart` + `--flavor teacher` /
  `lib/main_student.dart` + `--flavor student` /
  `lib/main_attendance.dart` + `--flavor attendance`). The Staff App work is
  scoped to the **teacher flavor only** — student and attendance-kiosk
  flavors are out of scope and must not be touched by this initiative.
- Full Admin Panel feature inventory (spec §7/§8, the "every admin route,
  every CRUD, every permission" audit) **not started yet** — deferred until
  the identity-link decision above is made, since it determines the shape
  of `StaffRoleContext` that every mobile admin screen will depend on.

## Phased plan (mirrors the discovery doc's Phase 1–9, mapped to this project's gates)
1. **Audit (this file, ongoing)** — identity/role model (started), full
   Admin Panel feature inventory (spec §22, not started), Supabase RLS/grant
   audit for anything new this touches (not started).
2. **CLARIFY close-out** — your decision on the open question above, plus
   confirming the Zustand-permissions question.
3. **PLANNING** — turn the feature inventory into the
   `Admin Feature | Existing Role Rules | Backend Operation | Mobile Screen
   | Required Backend Changes | Security Considerations | Status` matrix
   the discovery doc's §22/§32-C require; this becomes the real spec you
   review for "approve plan."
4. **DESIGN FIXED** — `StaffRoleContext` shape, navigation model, permission
   mapping per role/action, confirmed against the linkage decision.
5. **UI DESIGN CONFIRMED** — mobile UX for the Admin Workspace screens
   (lists/cards/sheets, not shrunk desktop tables), iterated until you say
   "UI is final."
6. **CODING** — only after "code it," implemented feature-by-feature against
   the approved matrix, smallest correct change per module, teacher
   flavor's existing functionality re-verified after each step (spec §19).
7. **TESTING** — the spec's §31 scenario matrix (Teacher / normal_admin /
   senior_admin / management / Teacher+Admin combos the data supports /
   missing-role fallback), run against real or designated test accounts,
   not fabricated ones.
8. **RELEASE** — through the existing APK/S3 update path for the teacher
   flavor; no Play Store / build-identifier changes implied by this work.
9. **OPERATE** — fold into normal `BOOTSTRAP.md` checkpoint tracking once
   live.

## Next step
CLARIFY is closed. Remaining before DESIGN FIXED can be drafted:
1. Full Admin Panel feature inventory (spec §22) — now also needs, per
   action, whether it's role-tier-gated and whether that gate is real
   (server-side) or UI-only (per REQ-SEC-005 above), so the mobile version
   doesn't inherit a UI-only gate silently.
2. Draft the `employees.admin_user_id` migration (not yet written) — still
   needs review and an explicit "code it" before touching production, per
   `AGENTS.md` §F/§J12B (this is the auth/security-adjacent case requiring a
   written, approved plan first).
3. Separately, `TODO.md` REQ-SEC-005 needs its own priority/fix decision
   from you — it's a real gap independent of whether Staff App Unification
   proceeds at all.
No code will be written before that, and no gate advances without its
trigger phrase (`AGENTS.md` §F).
