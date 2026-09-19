# STAFF-APP-DESIGN-FIXED.md — SATYAM-SCHOOL

> DESIGN FIXED draft for the Staff App Unification initiative
> (`planning\STAFF-APP-UNIFICATION-PLAN.md`), per that plan's phased-plan
> step 4. Covers the two things DESIGN FIXED must fix per `AGENTS.md` §F
> before UI DESIGN CONFIRMED or CODING can start: **`StaffRoleContext`'s
> shape/resolution mechanism**, and **the per-action mobile mapping**
> (which `planning\STAFF-APP-FEATURE-INVENTORY.md` rows become mobile Admin
> Workspace screens vs. stay "Available only in Admin Panel," and at what
> role tier). **This is a draft — a proposal for your review, not a
> decision I'm making unilaterally.** Several items below are explicitly
> flagged as open questions rather than settled, per this project's "do not
> invent business rules" non-negotiable
> (`ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`).
>
> **Caveat on completeness:** the original discovery input was a full
> 33-section spec supplied verbatim in the 2026-09-18 session
> (role-resolution precedence, failure rules, exact permission-model
> language, required test matrix, etc.). That session's transcript isn't
> available to this session — only the summarized non-negotiables carried
> into `ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md` are. This draft is
> built from that summary plus the plan file's confirmed facts and the
> approved feature inventory. If the original 33-section spec had more
> specific rules than what's summarized there (exact failure-mode copy,
> a precedence rule this draft gets wrong, etc.), flag it against this
> draft — don't assume this file re-derived it correctly from memory.

## 1. StaffRoleContext — shape and resolution

Two independent dimensions, per the discovery non-negotiable ("Teacher
status and Admin role are two independent dimensions — neither implies the
other"):

```
StaffRoleContext {
  employeeId: uuid                // employees.id — source of truth for the session
  employeeName: string

  teacherStatus: {
    isTeacher: bool                // employees.type === 'teaching'
    type: 'teaching' | 'non-teaching' | 'management' | 'media'
    classTeacherOfSectionId: uuid | null
    subjectMappings: [...]         // unchanged — existing Teacher app fields, not touched
  }

  adminRole: {
    linked: bool                   // employees.admin_user_id IS NOT NULL
    adminUserId: uuid | null
    tier: 'normal_admin' | 'senior_admin' | 'management' | null
  }

  resolvedAt: timestamp            // when this payload was produced server-side
}
```

`adminRole.linked = false` (the `employees.admin_user_id` FK, per the
2026-09-18 decision record, still `NULL` for all 28 employees today) means
**no Admin Workspace at all** — the app behaves exactly as the current
Teacher app does, unchanged. This is the common case for all real accounts
today (confirmed live: zero Teacher+Admin combinations exist in production
data yet — see the plan file's "Open decision" section).

### Resolution mechanism — open question, recommendation below
Mobile has no server-side session store — every RPC call runs as Postgres
`anon`, re-authenticated per-call via `app_password` in `teacher_login`,
not a persistent Supabase Auth session (`CLAUDE.md` architecture note).
There is no existing "refresh my session" pattern in this codebase to
extend.
Two options:

- **(a) Recommended — resolve once, at login, embedded in `teacher_login`'s
  response.** Extend `teacher_login`'s existing `SECURITY DEFINER` RPC to
  also look up `admin_users` via `employees.admin_user_id` (a single extra
  join, same transaction, same trust boundary — the RPC has already
  verified the password) and return the full `StaffRoleContext` alongside
  today's payload. The client stores it for the app session. **Tradeoff:**
  if someone links/unlinks/promotes an `admin_user_id` or changes an
  `admin_users.role` while a staff member's app is already open, they
  won't see the change until they log out and back in. No new auth
  system required — consistent with the discovery non-negotiable.
- **(b) A lightweight re-resolve RPC** (`staff_refresh_context`) callable
  mid-session without re-sending the password, gated by some opaque token
  `teacher_login` also returns. **Not recommended without more thought** —
  it's a new quasi-session mechanism (even if small), and needs its own
  threat-modeling (token leakage, replay) that (a) avoids entirely by
  design.

**Proposing (a).** If you want live mid-session role updates, say so and
this needs its own short design pass before DESIGN FIXED can close on it.

### Backend security pattern (binding, not optional)
Per the plan file's existing note and `AGENTS.md` §J0M/§J5: **every** new
mobile Admin Workspace RPC — even for actions the admin panel gates as
"None — all tiers" — must be `SECURITY DEFINER` and re-verify
`adminRole.tier` (or `adminRole.linked`) *inside the function*, the same
pattern as `admin_has_role`/REQ-SEC-005/REQ-SEC-007's salary fix. This is
**not** optional for the "ungated" modules: mobile calls arrive as `anon`
with no RLS backstop (`employees` + ~72 other tables have RLS disabled per
REQ-SEC-002), so parity with the admin panel's current looseness would
mean *zero* enforcement, not matching laxness. Every row below that becomes
a mobile screen needs a brand-new RPC either way, whether or not the admin
panel gates the equivalent action today — porting a feature to mobile is
what triggers writing its first real backend check, in most cases.

## 2. Mobile exposure principle
The admin panel is a controlled office/desktop surface; a phone is more
easily lost, shared, or left unlocked. Recommendation: **default to
Admin-Panel-only** for anything bulk, financial, destructive, or
already-flagged-insecure, and only bring low-risk, high-frequency,
field-useful actions to mobile in phase 1. This intentionally does **not**
mirror the admin panel's current flat (mostly ungated) tiering — see §1's
security pattern note. Every module gets an explicit call below, per the
discovery non-negotiable ("never silently dropped").

## 3. Per-module mapping (draft — needs your review/edits)

| Module | Phase-1 mobile? | Mobile role tier | Reasoning |
|---|---|---|---|
| Dashboard | **Yes** — read-only summary | all linked tiers | Low risk, high value, matches today's read-only n/a enforcement |
| Attendance (mark/edit, teacher alerts, edit requests) | **Yes** | all linked tiers | Core day-to-day front-office work; likely needs `normal_admin` too |
| Employee — punch-override code | **Yes** | all linked tiers | Low risk (generates a code), field-useful (badge forgotten), matches today's membership-only gate |
| Employee — add/edit, password reset, impersonate, salary entry | **No** | — | Bulk data entry / sensitive / impersonation is admin-panel-initiated by nature (see below) |
| Student — add/edit | **No** | — | Bulk form, poor phone fit |
| Student — TC generation | **No** | — | **Blocked separately**: `TODO.md` REQ-SEC-008 (zero role gating, state-changing) is open; do not add a second ungated surface before that's resolved |
| Student — impersonate | **No** | — | Impersonation is initiated from the admin panel to log *into* the mobile app — doesn't make sense as a mobile-originated action |
| Student — permanent delete | **No, and recommend never** | — | Highly destructive; recommend keeping this off mobile regardless of future phases — flag if you disagree |
| Fees (structure CRUD, payment record/delete) | **No** | — | Financial, currently fully ungated by tier (REQ-SEC-002's `fee_payments` `anon` exposure still open) — don't widen this surface yet |
| Expenses | **No** | — | Same financial-risk reasoning as Fees |
| Inventory — record usage, asset checkout/return | **Yes** | all linked tiers | Operational, field-useful (matches how inventory apps work on phones) |
| Inventory — add/view stock (items, batches) | **No** | — | Bulk entry, desktop-friendlier |
| Notice — post/edit/pin/archive | **Yes** | all linked tiers | Natural fit; matches today's flat gating |
| Queries — reply/resolve/reopen | **Yes** | all linked tiers | Quick operational actions, good phone fit |
| Question Papers — view/download | **Yes** | all linked tiers | Read-only, matches today |
| GR Book (register, bulk import, export) | **No** | — | Bulk-data/desktop workflow |
| Documents — ID card/marksheet/bonafide | **No** | — | Desktop print workflow, PDF generation |
| Documents — TC/NOC | **No** | — | NOC isn't built anywhere yet; TC blocked by REQ-SEC-008 (see Student row above) |
| Report (generation + export) | **No** | — | Desktop/export workflow |
| Syllabus — CRUD | **No** | — | Bulk content entry |
| Syllabus — edit-request approve/reject | **Yes** | **senior_admin/management only** (recommended tightening vs. today's flat gate — academic oversight, not front-office) | Quick approve/reject is a strong mobile fit; tier restricted deliberately, flag if you want it open to all tiers instead |
| Tasks — CRUD | **Yes** | all linked tiers | Common front-office/management action, good mobile fit |
| Settings (all tabs, Users & Roles) | **No** | — | Desktop configuration; Users & Roles is security-sensitive (account creation/role changes) — keep desktop-only |
| Super-Admin (all tabs, incl. Salary) | **No** | — | Bulk tools / already covered above under Fees-Inventory-Employee reasoning; Salary stays desktop-only |
| Diagnostics | **No** | — | Dev/ops tooling, not a staff workflow |

**Phase-1 mobile set:** Dashboard (read), Attendance, Employee punch-code,
Inventory usage/checkout, Notice, Queries, Question Papers (read),
Syllabus approve/reject, Tasks. **Everything else stays "Available only in
Admin Panel"** with the reason recorded above — satisfies the "never
silently dropped" non-negotiable without over-widening the mobile attack
surface on day one.

## 4. Navigation model (draft)
A workspace switcher shown only when `adminRole.linked === true`:
- **Teacher workspace** (existing, unchanged) — always present for any
  logged-in staff member, exactly as today's Teacher app behaves.
- **Admin workspace** (new) — only visible when `adminRole.linked` is true;
  within it, the phase-1 module list above, each screen additionally
  checking `adminRole.tier` client-side (UX only) *and* server-side inside
  its RPC (the real gate, per §1).
- For the `isTeacher === false && adminRole.linked === true` case (a
  non-teaching linked admin, e.g. today's 3 name-matched-but-unlinked
  accounts if ever linked) — app opens directly into the Admin workspace,
  no Teacher workspace tab shown (nothing to show there).
- Missing-role fallback (`isTeacher === false && adminRole.linked ===
  false`): existing login behavior, unchanged — not a new case this
  initiative introduces.

## 5. Still open — needs your decision before this gate can close
1. **§1 resolution mechanism** — confirm option (a), or ask for a real
   design pass on (b).
2. **§3 per-module table** — this is a proposal. Confirm, or redirect any
   row (especially: Fees/Expenses read-only view as a phase-2 candidate?
   Syllabus approve/reject tier?).
3. **Permanent student delete** — recommended "never on mobile." Confirm.
4. **REQ-SEC-008 (TC issuance gap)** and **REQ-SEC-007 diagnostics
   decision** (already recorded in `TODO.md`) are independent of this
   plan but block nothing here as scoped — confirming you're OK leaving
   both as separately-tracked, not gating this initiative's progress.
5. Confirm you're comfortable this draft was built without the full
   33-section discovery spec text (see the caveat at the top) — if you
   have that original text handy, a comparison pass would be worth doing
   before UI DESIGN CONFIRMED.

## Status: APPROVED 2026-09-19
User approved this draft as-is, which resolves §5's five open questions as:
option (a) resolution mechanism confirmed; the §3 per-module table
confirmed as proposed (no rows redirected); permanent student delete
confirmed "never on mobile"; REQ-SEC-007/REQ-SEC-008 confirmed as
non-blocking, separately tracked; proceeding without a line-by-line
comparison against the original 33-section spec text (unavailable this
session) accepted.

**Grounding check against real code (done before writing UI DESIGN
CONFIRMED):** confirmed `AuthService.profile` (`mobile-app/lib/core/
services/auth_service.dart`) is exactly the right place for
`StaffRoleContext` — it's already an `Rx<Map<String,dynamic>?>` populated
directly from the `teacher_login` RPC response and persisted via secure
storage across restarts, so extending that RPC's return payload with
`teacherStatus`/`adminRole` fields (§1, option a) fits the existing
pattern with no new state-management mechanism. Also confirmed the
existing teacher-flavor modules that share names with admin-panel
concepts (`teacher/notices`, `teacher/query`, `teacher/syllabus`,
`teacher/tasks`, `teacher/question_bank`) are teacher-scoped
read/submit views (e.g. `TeacherNoticesPage` is a read-only feed) — the
new Admin Workspace screens are additive, not replacements, and must not
modify these existing files' behavior.

DESIGN FIXED gate closed. See `STAFF-APP-UI-DESIGN.md` for UI DESIGN
CONFIRMED.
