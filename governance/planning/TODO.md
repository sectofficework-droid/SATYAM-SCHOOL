# TODO.md — SATYAM-SCHOOL

> Phased checklist + backlog. Items below the line are recorded per §J14
> ("found a bug/security concern → record it, don't silently fix, don't
> expand scope") from the governance audit run earlier this session. None of
> these have been actioned — all await your explicit decision.

## Approval gates — current status
See `governance\BOOTSTRAP.md` "Approvals on record" table for full detail.
Required by AGENTS.md §E.5 ("phased checklist with approval gates") — this
is that checklist, project-wide (not per-feature; each new feature/fix gets
its own mini version of this inside its own plan when it's written):

- [x] DISCOVERY — informal (`ai-context\SATYAM SCHOOL PROJECT UNDERSTANDING
      PROMPT.txt`), not re-run formally — product is already built and running.
- [x] CLARIFY — stack/roles/environment confirmed from code +
      `governance\documentation\PROJECT_CONTEXT.md` + real version checks (`governance\BOOTSTRAP.md`).
- [x] PLANNING — backfilled this session (`planning\*`).
- [ ] DESIGN FIXED — **not recorded**, and known to have drifted from the
      original locked design in material ways (see BOOTSTRAP.md drift
      table). Reopens per-subsystem as each CRITICAL item below gets a real
      plan — not being blanket-reopened for the whole app.
- [x] UI DESIGN CONFIRMED — implicit, see `planning\UI-SPEC.md`.
- [~] CODING — ongoing, feature-by-feature, historically without passing
      through the other gates first (see `planning\PLAN.md` "Workflow" —
      flagged as an open question, see below).
- [ ] TESTING — **not recorded**, no automated tests exist
      (REQ-HYG-001/002).
- [ ] RELEASE — **not recorded** retroactively; see
      `planning\RELEASE-PLAN.md` gap table for what's missing before the
      *next* release specifically.
- [x] OPERATE — active, informally (no monitoring/alerting/backup-restore
      verification on record — also in RELEASE-PLAN.md).

Not reopening any gate retroactively on its own just to "complete the
checklist" — they reopen naturally if/when a MAJOR change (§J12B) is
requested, e.g. fixing the CRITICAL items below.

**Resolved 2026-08-18 — user confirmed `planning\PLAN.md` "Workflow" as
written is correct:** routine/small changes keep the existing low-ceremony
flow; only big/risky (security, auth, database, architecture) changes
require a written plan first. The REQ-SEC-001 revert was specifically
because password-hashing is exactly that kind of big/risky change — not
evidence the policy itself needed to change. No edit needed to `PLAN.md`.

---

## 🛑 CRITICAL — needs an explicit decision before any fix is attempted
- [x] **REQ-SEC-001 — Plaintext `app_password`. FIXED AND SHIPPED 2026-08-21.**
      Written up as a real plan this time (see below for the reverted
      2026-08-18 attempt this superseded), approved via "code", implemented,
      and the migration (`mobile-app/SUPABASE_HASH_APP_PASSWORD.sql`) was
      run directly against production via the Supabase SQL Editor (browser
      session, user already logged in) — verified after: all 75 rows
      (48 students + 27 employees) backed up to
      `_app_password_backup_20260821` and re-hashed to bcrypt (`$2a$...`,
      60 chars), all 4 new/changed functions confirmed present
      (`teacher_login`, `student_login`, `admin_reset_student_password`,
      `admin_reset_employee_password`). Admin panel's password
      view/copy replaced with Reset Password (both `student/page.js` and
      `employee/page.js`), hashed server-side via the two new RPCs — no
      hash ever computed in the browser. Bundled in: a password-reset
      in-app notice, new for students (`student_alerts` table, mirrors the
      pre-existing `teacher_alerts`) — required a Dart change + a rebuilt
      student debug APK (built successfully this session, sent to the
      user for device install; not yet installed/visually confirmed as of
      this entry). Teacher side needed no rebuild. Full detail:
      `governance/ai-context/SESSION-2026-08-21-3.md`.
      **Original 2026-08-18 revert, kept for history:**
      Verified live via an unauthenticated `@supabase/supabase-js` client
      (public anon key, no session — same access any site visitor has):
      `students`/`employees` returned full rows including plaintext
      `app_password` for every row (48/48 students, 27/27 employees), zero
      auth required. Not theoretical — currently exploitable exactly as
      described below. See REQ-SEC-002 for the RLS-side root cause this
      also confirmed.
      A same-day attempt at this (hash the password, remove the admin-panel
      display, add a Reset-Password action) was implemented, then reverted
      at the user's request ("revert back to previous as original we will
      plan first then execute") — the fix went straight from finding to
      code without a proper written plan first, which is exactly the
      "Plan first, code last" rule (AGENTS.md §A.1) this fix itself skipped.
      Code is back to original (`git restore` on `employeeService.js` and
      `employee/page.js`); the draft SQL migration file was deleted (it was
      never applied to the database, so there's nothing to undo there).
      **Nothing about the live app/database has changed because of any of
      this** — the plaintext-password problem is exactly as it was when
      first found, no better, no worse.
      **What was learned from the reverted attempt (keep for the real plan):**
      hashing makes "view password" permanently impossible for anyone —
      admin included — so any real plan needs a Reset-Password flow, not a
      View one, to preserve the front-desk support workflow (confirmed
      requirement — "if the user comes to admin to view password or reset
      the admin can help them back"). `teacher_change_password`/
      `teacher_verify_password` RPCs already exist with stable signatures,
      so hashing can likely be done DB-side with no mobile rebuild — this
      still needs to be written up properly as a plan (approach, exact
      files/migration, rollback, verification steps) before "code it" is
      said again, not re-implemented ad hoc from memory of the reverted
      attempt.
      **Deferred, not fixed:** REQ-SEC-004 below still needs an app rebuild
      to fix properly — separate from this item either way.
- [~] **REQ-SEC-002 — `anon`-role over-exposure (scope corrected, larger
      than first scoped; `students`/`employees`/`admin_users` LIVE-CONFIRMED
      2026-08-21 as part of this — see below).** **PARTIALLY FIXED
      2026-09-04:** `students` and `admin_users` now have RLS enabled
      (gated on a new `is_admin_user()` helper) and `anon`'s grants on both
      were revoked — live-verified via unauthenticated REST calls, both now
      return `42501 permission denied`. `employees` and the remaining ~22
      tables from the figure below are **still fully anon-exposed,
      unchanged**. `employees` specifically couldn't be locked down yet
      because the mobile app reads/writes it directly with the anon key for
      the teacher's own profile (no real session) — deferred to be fixed
      together with REQ-SEC-004's RPC rework. Migration:
      `mobile-app/SUPABASE_LOCK_STUDENTS_ADMIN_USERS.sql`. Full detail:
      `governance/work-log/LOG-2026-09-04.md`. Not just 4-5 tables — full
      grep of every `mobile-app/SUPABASE_*.sql` file shows **~25 tables**
      with full or partial `anon` grants and 17 with RLS explicitly
      disabled, matching the fact that `supabase_service.dart` queries ~30
      tables directly with no RPC wrapper. Includes DELETE rights on
      `question_bank`/`question_papers` (pre-exam content) and
      `official_exam_marks`. See `planning\SECURITY-THREAT-MODEL.md` F2 for
      the full table/RPC list. No rate limiting anywhere in the codebase
      (verified: zero `rate.?limit|throttle` matches outside
      `package-lock.json`/docs). The hardcoded anon key in `mobile-app/
      lib/app_bootstrap.dart:10-11` is trivially extractable from any
      installed APK.
      **2026-08-21 live test (this session)** — ran an actual
      unauthenticated `select` (public anon key, no session) against
      `students`, `employees`, and, newly, `admin_users` (not previously
      called out — it's created directly in Supabase, no `CREATE TABLE` in
      any tracked file, so it wasn't caught by the `mobile-app/SUPABASE_*`
      grep that scoped the ~25 figure above). **All three returned full
      rows to a completely anonymous client** — `admin_panel`'s own core
      tables are exposed the same way the ~25 mobile-app tables already
      were, not just those. `mobile-app/SUPABASE_SETUP.sql` defines
      narrower `auth.uid() = app_user_id`-style "own profile" policies on
      `students`/`employees`, but since mobile auth never creates a real
      Supabase Auth session (custom RPC login instead, per
      `governance\documentation\PROJECT_CONTEXT.md`), those alone would
      block everyone, not open access to everyone — the fact that access
      is instead wide open means either RLS is disabled on these tables, or
      an older, broader permissive policy is still active underneath.
      Couldn't determine which without running
      `mobile-app/SUPABASE_SECURITY_AUDIT.sql` in the Supabase SQL Editor
      (already written for exactly this — needs the user to run it there
      and share the result; no DB-credential/service-role access exists in
      this repo/session to run it directly).
      Decision needed: re-enable RLS with real per-user/per-class policies,
      move sensitive RPCs behind real Supabase Auth sessions, and/or add
      rate limiting at the Supabase/Edge layer. Also a MAJOR change —
      reopens DESIGN FIXED.
      **2026-09-04 (continued): `school_calendar_events` also locked down.**
      Same pattern as `students`/`admin_users` — RLS was disabled and `anon`
      held full write grants. Unlike those two, the mobile teacher app reads
      this table directly with the anon key and no real session, so `anon`
      SELECT was kept; only `anon`'s INSERT/UPDATE/DELETE were revoked, RLS
      enabled, and writes gated on the same `is_admin_user()` helper.
      Migration: `mobile-app/SUPABASE_LOCK_CALENDAR_EVENTS.sql`. Live-verified:
      RLS enabled, `anon` grants now SELECT-only, four policies present
      exactly as written. `employees` and the remaining tables are still
      unaddressed — still **not closed**.
      **2026-09-07 — scope corrected upward.** Supabase's own live security
      advisor (ground truth, not a grep of tracked `.sql` files) reports
      **73 tables** with RLS disabled project-wide, not ~25 — the ~25
      figure only ever covered mobile-app-facing tables grepped from
      `mobile-app/SUPABASE_*.sql`; the advisor also catches admin-panel
      -only tables never in a tracked migration file at all (`fee_payments`,
      `employee_salaries`, `expenses`, `student_documents`,
      `leave_requests`, etc.). `students` and `admin_users` confirmed still
      correctly locked. Not investigated or acted on further this session —
      see `ai-context\SESSION-2026-09-07-1.md`. Do not blanket-enable RLS
      without matching policies (breaks access outright); needs the same
      per-table policy decision this item already required, just at a
      larger scale than previously scoped.
      **2026-09-09 — generalizing note, not a new finding.** Confirmed via
      `grep -rln "\.auth\." mobile-app/lib` = zero matches: **none** of the
      three Flutter apps (kiosk/teacher/student) ever call Supabase Auth's
      sign-in — this item's existing `employees` note ("mobile app reads/
      writes it directly with the anon key... no real session") is true of
      every table/RPC every Flutter app touches, not just `employees`.
      Practically: any grant written as `authenticated`-only in this
      codebase is invisible to all three Flutter apps — only the admin
      panel (real `@supabase/ssr` auth, confirmed) is ever actually
      `authenticated`. Found the hard way this session when a new
      migration's `authenticated`-only grants silently broke a Flutter
      feature (`record_check_out`/`employee_shifts`, see
      `ai-context\SESSION-2026-09-09-1.md`) — fixed for that specific case,
      but the underlying architecture (no real per-user DB identity for any
      mobile client) is exactly what this item is already tracking. No
      severity/status change; recorded per §J14.
- [x] **REQ-SEC-004 — `teacher_update_profile` has zero identity check.
      FIXED 2026-09-04.** Checked 2026-08-18: NOT fixable without an app
      rebuild, so deferred out of Stage 1. Unlike `teacher_change_password` (which verifies
      `app_password` first), this RPC updates any teacher's name/phone/email
      given just their UUID, no password. `mobile-app/
      SUPABASE_TEACHER_SETTINGS.sql:7-22`. Confirmed via
      `supabase_service.dart:744-748` that the installed Flutter app calls
      this RPC with only `employeeId/name/phone/email` — no password is
      available at that call site to send. Adding a required password
      parameter would break every already-installed app's profile-edit
      screen; adding it as optional-and-unenforced would be a fake fix.
      Real fix needs the Settings screen to prompt for the current password
      before saving profile edits — an app UI change + rebuild, bundled with
      Stage 2/3.
      **Fixed 2026-09-04:** `teacher_update_profile` now requires and
      verifies `p_password` before applying any change (same check as
      `teacher_change_password`) — the old no-password 4-arg overload was
      explicitly dropped (not left callable alongside the new one), and
      live-verified: the 4-arg call now errors `function does not exist`,
      the 5-arg call with a wrong password returns `null`.
      `teacher_profile_page.dart`'s Edit Profile sheet now has a required
      "Current Password" field; `supabase_service.dart`'s
      `updateTeacherProfile` takes `password`. `flutter analyze` clean (only
      pre-existing style infos). **Not yet visually tested on a real
      device** — same BlueStacks-not-running caveat as 2026-09-03's
      unrelated change. Full detail: `governance/work-log/LOG-2026-09-04.md`.
- [x] **REQ-SEC-003 — Public S3 bucket for mobile photos**, contradicting
      the original discovery doc's explicit "DO NOT use public S3 buckets"
      rule. `lib/common/widgets/s3_image.dart`. Decision needed: proxy
      through presigned URLs like the admin panel does, or accept the
      current public-bucket approach (it was chosen deliberately after a
      chain of CORS fixes, per `governance\documentation\PROJECT_CONTEXT.md:67` — may be an informed
      tradeoff, not an oversight; needs your call either way).
      **Decided 2026-09-04: keep as-is.** User confirmed the public-bucket
      approach should stand as the deliberate tradeoff it already was — no
      code change. Closing this item on that decision, not on a fix.

## IMPORTANT
- [~] **REQ-SEC-005 — Role-tier gating (`normal_admin` vs `senior_admin`/
      `management`) is enforced client-side only for several actions;
      backend either checks admin membership only (not tier) or has no RLS
      at all. Found 2026-09-18 while closing out the Staff App Unification
      plan's CLARIFY question ("does per-role permission behavior really
      live only in Zustand?").** Corrects a stale claim in
      `governance\documentation\PROJECT_CONTEXT.md` (line ~273/320): grepped
      the entire `admin-panel/` tree for `rolePermissions`/`permission`/
      `hasPermission`/`canAccess` — **zero matches**. No Zustand
      "rolePermissions matrix" exists in the current code at all (it may
      have existed once, or the doc describes an aspirational table that
      was never wired up — either way, treat that doc line as outdated).
      What actually exists instead: five scattered
      `authUser.role !== "normal_admin"` conditionals
      (`super-admin\page.js:477,3266`, `employee\page.js:359`,
      `student\page.js:748`, `diagnostics\page.js:88`,
      `settings\page.js:2498`, `sef\super-admin\page.js:26,31`) that gate UI
      visibility only. Checked what backs each one:
      - **Correctly enforced server-side**: the Admin Access Code
        impersonation RPCs (`create_impersonation_code`,
        `redeem_impersonation_code`, `get_impersonation_audit_log` in
        `mobile-app/SUPABASE_IMPERSONATION.sql`) explicitly check
        `role IN ('management','senior_admin')` inside the
        `SECURITY DEFINER` function body — a `normal_admin` calling these
        directly (bypassing the UI) would get `Not authorized`. This is the
        project's own correct pattern.
      - **Not enforced server-side**: `SingleStudentTool`'s permanent
        student delete (`super-admin\page.js:517` `handleDelete` →
        `studentService.js:867` `deleteStudentPermanently`, four raw
        `supabase.from(...).delete()` calls) and the diagnostics
        download/logging-toggle (`diagnostics\page.js`, backed by
        `SUPABASE_DIAGNOSTIC_REPORTS.sql`'s `diagnostic_settings`
        RLS policy). Both tables' RLS policies use `is_admin_user()`
        (`mobile-app/SUPABASE_LOCK_STUDENTS_ADMIN_USERS.sql:13-21`), which
        only checks *membership* in `admin_users` (`EXISTS (SELECT 1 FROM
        admin_users WHERE id = auth.uid())`) — it does not look at `role`
        at all. **Concretely: a `normal_admin` session calling the Supabase
        client directly (browser devtools, not through the UI) could
        permanently delete a student record or flip the diagnostic-logging
        switch, both of which the UI presents as senior_admin/management-
        only.** Not tested live (would require an actual normal_admin
        session + a disposable test student — not done without your
        go-ahead), but the code path is unambiguous.
      - **No gating of any kind**: the ~72 RLS-disabled tables already
        tracked under REQ-SEC-002 (`fee_payments`, `employee_salaries`,
        etc.) have no role-tier distinction because they have no admin-tier
        check at all yet.
      **Audit closed 2026-09-18 — all 10 files matching a
      `senior_admin|normal_admin|management` grep across `admin-panel/src`
      checked, not just the ones with an obvious gate:** `Header.jsx:43` is
      only a display-label map (`ROLE_LABELS`), not a gate — no issue.
      `impersonationService.js` and `ImpersonationLogTab.js` only reference/
      display the already-correctly-gated impersonation RPCs — no issue.
      No further gate sites exist beyond the ones listed above and in the
      "scope widened" note below — this list is complete, not partial.
      **Why this matters beyond the existing REQ-SEC-002 tracking:** this is
      a different axis (which *tier* of already-authenticated admin can do
      a thing), not just "is RLS on." Feeds directly into
      `planning\STAFF-APP-UNIFICATION-PLAN.md` — that initiative must not
      copy the admin panel's UI-only role gates into the mobile Admin
      Workspace; anything gated by role tier needs a real backend check
      (mirroring the impersonation RPC pattern), decided as part of that
      plan's DESIGN FIXED, not assumed safe because "the button just isn't
      shown."

      **2026-09-18 — scope widened: found a more severe instance while
      finishing the audit before drafting a fix.** `settings\UsersRolesTab.js`
      (`admin_users` create/update/delete — Users & Roles tab) does 3 direct
      `supabase.from("admin_users").{insert,update,delete}()` calls,
      client-side-gated the same way (whole Settings page hidden for
      `normal_admin`). Backing RLS (`SUPABASE_LOCK_STUDENTS_ADMIN_USERS.sql`
      lines 42-53) grants INSERT/UPDATE/DELETE to any `is_admin_user()` —
      **any authenticated admin, including `normal_admin`, can call
      `admin_users.update({role:'management'}).eq('id', <own id>)` directly
      and self-promote to the top tier.** No server-side check exists
      anywhere in this path. This is a full, self-service privilege
      escalation — more severe than the student-delete/diagnostics-toggle
      gaps above (those let a lower tier perform one restricted action;
      this one lets them permanently become the highest tier). Also found:
      `sef\super-admin\page.js` (SEF salary/employee panel) follows the
      identical UI-only-gate pattern; underlying `sefEmployeeService.js`
      writes not yet individually audited.

      **Fix plan (approved 2026-09-18, not yet implemented — audit +
      write-up only so far; needs explicit "code it" per AGENTS.md §F
      before any SQL/code change):**
      Reuse the pattern already proven correct in this codebase (the
      Admin Access Code impersonation RPCs) everywhere role-tier currently
      matters: move the write to a `SECURITY DEFINER` RPC that checks role
      before touching the table, then revoke `authenticated`'s direct
      write grant so the RPC is the only path.
      **User's policy decisions (2026-09-18):**
      - Only `management` may create/edit/promote to `senior_admin` or
        `management`. `senior_admin` may create/edit/delete `normal_admin`
        rows only — not peers or superiors.
      - No admin may change their **own** `role` via the update RPC
        (blocks all self-escalation, not just to management) — self-edit of
        `name`/`initials` stays allowed. Self-delete also blocked (extension
        of the same principle, flagged explicitly here since it wasn't
        asked in so many words: deleting your own account isn't an
        escalation path, but blocking it is a natural, low-cost extension
        of "no self-service identity changes").
      **Implementation — approved 2026-09-18 (4 rounds of upfront
      clarifying questions, then executed uninterrupted per user request:
      "prepare properly... ask first to clarify... after starting don't
      interrupt"), applied and verified 2026-09-19:**
      - [x] **Step 1 — migration written and applied to production**
            (`mobile-app/SUPABASE_ADMIN_ROLE_ENFORCEMENT.sql`, via
            `mcp__supabase__apply_migration`, matching how every prior
            REQ-SEC fix in this file was applied). Contains
            `admin_has_role`, `admin_create_user`, `admin_update_user`,
            `admin_delete_user`, `admin_delete_student_permanently` (all
            `SECURITY DEFINER`, tier checks exactly as decided below), then
            drops the 3 any-admin write policies on `admin_users` and
            revokes `authenticated`'s direct INSERT/UPDATE/DELETE there,
            and drops+replaces `students`' single `FOR ALL` policy with
            separate SELECT/INSERT/UPDATE policies (unchanged behavior)
            plus a `REVOKE DELETE ... FROM authenticated` (DELETE now only
            via the RPC). **Correction found live, mid-implementation:**
            `diagnostic_settings` doesn't exist in production yet (its own
            migration, `SUPABASE_DIAGNOSTIC_REPORTS.sql`, was never applied
            — matches this file's own REQ-HYG-006 note) — so instead of
            tightening a live policy, fixed the *pending* migration file's
            policy in place (now uses `admin_has_role(ARRAY['senior_admin',
            'management'])` instead of `is_admin_user()`) so the flaw never
            ships when that migration eventually runs.
            **Follow-up hardening, same session:** Supabase's own security
            advisor flagged all 5 new functions as callable by `anon`
            (Postgres grants EXECUTE to PUBLIC by default on function
            creation) — internal `auth.uid()`-based checks already rejected
            anon (no JWT `sub` → caller role NULL → "Not authorized"), but
            applied a second small migration
            (`req_sec_005_harden_rpc_execute_grants`) revoking PUBLIC/anon
            EXECUTE anyway, for defense in depth; folded into the tracked
            `.sql` file so it reflects live state.
      - [x] **Step 2 — client code updated** to call the new RPCs instead
            of direct table writes: `settings\UsersRolesTab.js`'s 3 calls
            (`saveUser`/`deleteUser`) now call
            `admin_create_user`/`admin_update_user`/`admin_delete_user`;
            `studentService.js`'s `deleteStudentPermanently` body now calls
            `admin_delete_student_permanently` (its one call site,
            `super-admin\page.js:522`, needed no change). `npm run lint`:
            clean. **Staged, not committed** — user chose this explicitly
            (see "Deployment status" below).
      - [x] **Step 3 — order followed as planned**: migration (Step 1)
            applied to production; client code (Step 2) staged but
            deliberately not deployed this session (user's explicit choice,
            see below) — the two are not both live at the same time, which
            is the one sequencing risk this step existed to manage.
      - [x] **Step 4 — verified live**, via 16 role-simulated test cases
            run directly in Postgres (no real login credentials needed):
            `set_config('request.jwt.claim.sub', '<real admin_users id>',
            true)` + `SET LOCAL role = authenticated` inside a transaction,
            always ended with `ROLLBACK` (confirmed after: `admin_users`
            row count/roles and `students` row count both exactly
            unchanged from before testing — zero side effects). Covered:
            normal_admin self-promote (blocked), normal_admin editing a
            higher tier (blocked), senior_admin promoting/editing/deleting
            a senior_admin or management row (blocked, 3 cases),
            senior_admin managing a normal_admin — create/edit/delete (all
            3 succeed — the legitimate path), management promoting a
            senior_admin (succeeds), management deleting their own account
            (blocked), direct-table bypass of the RPC for both
            `admin_users` UPDATE and `students` DELETE as `normal_admin`
            (both correctly `permission denied` at the grant level, not
            just app-level), `admin_delete_student_permanently` as
            `normal_admin` (blocked) vs `senior_admin` (succeeds), and 2
            sanity checks that unrelated legitimate reads
            (`students`/`admin_users` SELECT as `normal_admin`) still work
            unchanged. **One test-methodology mistake caught and
            corrected in-session**: an early combined run showed 3 tests
            (senior_admin deleting/creating a management-tier row)
            appearing to bypass the tier check — turned out to be my own
            test contamination (an earlier test in the same uncommitted
            transaction had promoted that same senior_admin to management,
            so by the time the later test ran, the check correctly saw them
            as already-management) — re-ran those 3 in isolation with an
            untouched senior_admin identity and all 3 passed correctly.
            Recorded here per §J14 discipline: the fix logic was never
            wrong, the first test run was.
      **Genuine pre-existing gap surfaced by testing, not caused by this
      fix, not fixed here:** `admin_create_user` (and the original
      direct-insert code before it) cannot actually finish creating a
      working admin account — `admin_users.id` is `NOT NULL` with no
      default and must equal a real `auth.users.id`, and neither the old
      code nor the new RPC ever creates that `auth.users` row first. Live
      test confirmed: a correctly-authorized `senior_admin` creating a
      `normal_admin` account passes every role check, then fails on `null
      value in column "id"`. This matches `documentation/
      PROJECT_CONTEXT.md`'s existing roadmap item #7 ("Admin-user creation
      UI... create not wired") — not a regression, not silently expanded
      into this fix's scope; left as its own separate, already-tracked gap.
      **Deployment status (user decision, 2026-09-18):** apply the DB fix
      immediately even though the client code isn't deployed yet, accepting
      that "Settings → Users & Roles" (create/edit/delete admin accounts)
      and "permanently delete a student" will error in the *live* admin
      panel for everyone — including management — until the staged code
      is committed/pushed/deployed. Chosen deliberately (security over
      temporary inconvenience, both are low-frequency actions for this
      school) over the alternative of leaving the two escalation paths open
      longer. **Action still needed from the user:** review the staged
      diff (`admin-panel/src/app/(dashboard)/settings/UsersRolesTab.js`,
      `admin-panel/src/lib/studentService.js`, plus the governance doc
      updates) and commit + push when ready to restore those two features
      and close this item out fully.
      **Deferred to a follow-up, out of scope for this fix (user decision,
      2026-09-18):** SEF salary/employee panel writes
      (`sefEmployeeService.js`) have the identical role-tier pattern but
      need their own audit before committing to specific RPCs — tracked
      here as a reminder, not started.
      **Also explicitly not touched, per user-approved scope (2026-09-18):**
      REQ-SEC-002's still-open `anon` exposure on `student_promotions`/
      `transfer_certificates`/`fee_payments` — this fix's
      `admin_delete_student_permanently` sidesteps it (SECURITY DEFINER
      bypasses those tables' own grants/RLS regardless), but the underlying
      ~72-table exposure remains exactly as large as REQ-SEC-002 already
      describes it.
- [ ] **REQ-HYG-001 — No automated tests for `admin-panel/`.** No `test`
      script, no test files. `mobile-app/test/widget_test.dart` is still
      Flutter's unmodified default counter test.
      **2026-09-04: user chose to skip for now** — a real test suite is a
      substantial separate undertaking, not something to slot into a
      bug-fix session. Left open, not closed.
- [ ] **REQ-HYG-002 — No CI pipeline.** No `.yml`/`.yaml` CI config anywhere
      in the repo; all verification is manual/local.
      **2026-09-04: user chose to skip for now**, same reasoning as
      REQ-HYG-001. Left open, not closed.
- [~] **REQ-HYG-006 — No centralized diagnostic/observability logging.**
      Added 2026-09-16 when `AGENTS.md`/`RULEBOOK.md` §L (mandatory
      debugging & diagnostic logging) was merged in.
      **Phase 1 (foundation) SHIPPED 2026-09-16** — plan approved via
      "code it", implemented same session. **Admin panel:**
      `src/lib/logger.js` (structured JSON, session/diagnostic IDs,
      redaction, 200-entry ring buffer) + `src/lib/apiDiagnostics.js`
      (`withDiagnostics` wrapper, applied to all 6 API routes) +
      `src/components/DiagnosticsInit.jsx` (global `window.onerror`/
      `onunhandledrejection` capture, mounted in root layout) +
      `src/app/error.js`/`global-error.js` (React error-boundary screens
      showing a diagnostic ID instead of a raw crash). **Mobile
      app:** `lib/core/utils/diagnostic_logger.dart` (same structured
      design, zero new dependencies — `path_provider`/`package_info_plus`
      already present) + `lib/app_bootstrap.dart` wired with
      `runZonedGuarded` + `FlutterError.onError` +
      `PlatformDispatcher.instance.onError`, covering all 3 flavors from
      one shared function. Verified: `npm run lint` clean, `flutter
      analyze` clean, a debug APK for the Teacher flavor builds
      successfully end-to-end. **Explicitly NOT in Phase 1** (see the
      original plan in session log 2026-09-16-1): any third-party
      error-tracking service.
      **Phase 1.5 (centralized retrieval) SHIPPED 2026-09-16, same
      session, on user request ("in app they will report log; not view
      the log; retrieved from admin panel").** New table
      `diagnostic_reports` (`mobile-app/SUPABASE_DIAGNOSTIC_REPORTS.sql` —
      **NOT yet run against production**, needs the user to apply it in
      the SQL Editor before anything actually lands in it). RLS
      **enabled** (deliberate deviation from this project's usual
      "disable RLS + full anon grants" convention — reuses the
      `public.is_admin_user()` helper from
      `SUPABASE_LOCK_CALENDAR_EVENTS.sql` instead, since REQ-SEC-002 is
      exactly the pattern this avoids repeating): `anon`+`authenticated`
      can INSERT their own report, only `is_admin_user()` can SELECT/
      UPDATE. Replaced the mobile apps' local-only "Diagnostic Log"
      viewer (`diagnostic_log_page.dart`, deleted) with
      `lib/common/widgets/report_problem_dialog.dart` — a "Report a
      Problem" dialog (optional one-line description, submits the recent
      buffer, shows a short Ref #) wired into the same 3 entry points
      (Teacher Settings row, Student profile button, kiosk PIN-gated
      long-press). Admin panel's `logger.error()`/`fatal()` now also
      insert into the same table automatically (no manual report needed
      there) via a new `submitReport()` in `src/lib/logger.js`; the
      now-redundant `DiagnosticLogButton.jsx` (local-browser-only
      download) was removed since the new `/diagnostics` admin-panel page
      (`src/lib/diagnosticsService.js` + `src/app/(dashboard)/
      diagnostics/page.js`, new Sidebar nav item) supersedes it with a
      complete, centralized view. **AI-agent access**: this project's
      Supabase MCP connection can query `diagnostic_reports` directly —
      documented in `AGENTS.md`'s project section and `CLAUDE.md` so a
      future session queries it before asking for repro steps, per §L12.
      Verified: `npm run lint` clean, `flutter analyze` clean (2 real bugs
      caught and fixed pre-ship in the first `flutter analyze` pass on
      the mobile-app changes — see session log). **NOT verified: any
      on-device/in-browser trigger of a real error, and the migration has
      not been run against production** — no device/emulator, running dev
      server, or DB-apply step happened this session; §L10 sign-off and
      "does a report actually reach the table" both still need a manual
      pass once the migration is applied.
      **Phase 1.6 (auto-submit + master download) SHIPPED 2026-09-16, same
      session, on user correction** ("whatever log is it should be auto
      submitted to master admin; include log report download in master or
      above admin"). Mobile apps no longer require the "Report a Problem"
      tap to reach the table — `diagnostic_logger.dart`'s `error()`/
      `fatal()` now auto-submit too (mirroring the admin panel), reading
      the app name from `AppConfig.lockedRole`; the "Report a Problem"
      dialog stays as a secondary channel for issues that don't throw a
      catchable exception (e.g. "button does nothing") and for adding a
      user description. Admin panel: `/diagnostics` page got a "Download"
      button exporting the current filtered list as JSON, gated
      `role !== "normal_admin"` (senior_admin/management — same gate this
      project already uses for impersonation; flagged to the user that
      "master" was interpreted this way, not `management`-only, in case
      that needs narrowing). Verified: `npm run lint` clean, `flutter
      analyze` clean, a debug Teacher-flavor APK builds end-to-end. Same
      NOT-verified items as Phase 1.5 above (migration not applied,
      no live device/browser trigger).
      **Phase 1.7 (cost/privacy safety rails) SHIPPED 2026-09-16, same
      session, on user request** — asked "if many users log will come does
      it take lot space... exceeding free limit?"; checked the actual
      Supabase DB via MCP (`pg_database_size` + `pg_stat_user_tables`) —
      19 MB total, `diagnostic_reports` didn't exist yet, biggest table
      ~200 bytes/row, so storage size itself was never the real risk. The
      real risk: nothing stopped a repeating error from auto-submitting
      every single occurrence. Then, separately: "logging is specifically
      kept for development purpose not to collect what users do" — so
      auto-submission needed to be an explicit, admin-controlled,
      default-OFF switch, not always-on. Shipped both: new
      `diagnostic_settings` table (single row, `enabled boolean default
      false`, RLS mirrors `diagnostic_reports`' `is_admin_user()` pattern
      — added to the same not-yet-applied migration file) gates
      auto-submission in both `logger.js` and `diagnostic_logger.dart`
      (checked once at startup client-side, live-checked per call
      server-side since there's no long-lived process to cache it in); a
      5-minute per-message cooldown + a 20-per-session hard cap in both
      loggers, independent of the switch, so a looping bug can't flood
      the table even while logging is on. **The manual "Report a
      Problem" flow is deliberately NOT gated by the switch** — that's
      explicit per-incident consent, not passive collection, so it always
      works. Admin panel `/diagnostics` page got a "Logging: ON/OFF"
      toggle (same senior_admin/management gate as Download) plus a
      banner when off. Retention: rather than a 3rd Vercel Cron (the
      Hobby-tier project already has 2, its likely cap), added lazy
      cleanup — `getDiagnosticReports()` deletes anything older than 90
      days as a side effect of the page loading; no new infrastructure.
      Verified: `npm run lint` clean, `flutter analyze` clean, a debug
      Teacher-flavor APK builds end-to-end. Same NOT-verified items still
      apply (migration not applied, no live trigger) — this phase adds no
      new unverified surface beyond that.
- [x] **REQ-HYG-003 — `schema_dump.json` tracked in git. DELETED 2026-09-04**
      (user confirmed OK) at repo root,
      contained a leftover API-error debug artifact
      (`{"message":"Invalid API key","hint":"Only the service_role API key
      can be used for this endpoint."}`, 101 bytes) — not source of truth for
      anything, nothing in the repo referenced it.
- [x] **REQ-HYG-004 — No root `.gitignore`.** Fixed 2026-08-18 (scaffold
      reorganization, not production code) — root `.gitignore` now ignores
      `Scratch/`, real env-file patterns, and OS/editor junk. At the time,
      `refdocs/*.png` (Vercel dashboard screenshots — variable names only,
      no leaked values, verified by viewing them) had their own separate
      `/refdocs/` ignore rule but lived at ROOT as a standalone folder;
      recommended moving them out or adding an explicit rule. **Resolved
      2026-08-19:** `refdocs\` moved into `Scratch\refdocs\` — one
      `/Scratch/` rule now covers it, no separate rule needed.

## MODERATE
- [x] **REQ-HYG-005 — `README.md` is corrupted/empty. FIXED 2026-09-04.**
      (wrong encoding, effectively blank). Real setup detail lives in `governance\documentation\PROJECT_CONTEXT.md`
      and now `documentation\SETUP-GUIDE.md` instead.
      **Fixed:** replaced with a short, clean UTF-8 README (project
      overview + links to `SETUP-GUIDE.md`/`PROJECT_CONTEXT.md`/`TODO.md`)
      rather than re-authoring full setup instructions that already live
      correctly in those files — avoids having two copies to keep in sync.
- [ ] Schema drift: `users` vs `admin_users`, `timetable_period_definitions`/
      `timetable_entries` vs `timetables` — self-flagged in
      `governance\documentation\PROJECT_CONTEXT.md`, unresolved, not re-litigated here.

## Functional bugs (non-security) — found 2026-08-18 via a dedicated code
## review (admin-panel done; mobile-app review still pending, will be
## appended when it finishes)
Found by a full-file bug-hunting review, separate from the security audit
above — none of these are fixed, all await your decision on priority.

### 🛑 CRITICAL
- [x] **REQ-BUG-001 — "Total Fees" is computed two different, conflicting
      ways across the app, producing different numbers for the same
      student on different pages. FIXED 2026-09-04.** Some pages read the fee amount stored
      on the student at admission time (`enrollment.fee_total`, a one-time
      snapshot) — `student\[id]\page.js:350`, `reportService.js:219`
      (`getFeesForReport`). Others re-read the *current* fee structure live
      from Settings — `fees\page.js:56` (`calcSummary`→`getStructureFee`),
      `student\page.js:688,695,1047,1355`, `reportService.js:323`
      (`getFeesForSuperAdmin`). `fee_total` is never re-synced after
      admission/promotion (`studentService.js` `addStudent`/
      `promoteStudent`), but Settings → Fee Structure
      (`settings\page.js` `FeeStructureTab`) lets an admin edit any
      academic year's fee amount at any time, including the current one.
      **Failure scenario:** admin admits JR.KG students at ₹14,500
      (stored), later corrects the JR.KG fee to ₹15,000 in Settings — the
      Fees page and Student List now show ₹15,000 and inflate every
      existing JR.KG student's Due amount by ₹500, while Student Profile
      and the Fee Report still correctly show ₹14,500. Real risk of
      wrong due-amounts, wrong payment caps, and actual over/under
      collection.
      **Fixed 2026-09-04:** the four live-structure call sites (line numbers
      above are stale — the actual current sites were found via grep, not
      by trusting the old numbers) now prefer the `fee_total` snapshot,
      falling back to the live structure only when no snapshot is recorded
      (legacy rows — confirmed via direct query that most current-year
      enrollments have `fee_total = 0`, i.e. never set, so this fallback is
      still doing real work, not dead code):
      `fees\page.js` `calcSummary()`, `student\page.js` (promotion pending-fee
      check, list-row "Fee Summary" card ×2), `reportService.js`
      `getFeesForSuperAdmin`. Left `student\page.js`'s promotion-time
      `feeTotal` write (setting the *new* enrollment's snapshot for the next
      class) untouched — that one correctly should read the live structure,
      same as `AddStudentForm` does at admission. Confirmed via direct query
      that no student's `fee_total` currently disagrees with the live
      structure — this fix prevents the drift described above from ever
      biting, it wasn't caught already happening. `next lint` on all three
      files: clean. Full detail: `governance/work-log/LOG-2026-09-04.md`.

### ⚠️ MODERATE
- [x] **REQ-BUG-002 — Employee Report's "Teachers" summary count always
      shows 0. FIXED 2026-09-04.** `report\page.js:559` filters for
      `role === "Teacher"`, but
      `reportService.getEmployeesForReport()` returns `designation`/`type`
      values, and the real designation list
      (`employee\page.js:37-41 DESIGNATIONS.teaching`) never contains the
      literal string `"Teacher"` — only `"Class Teacher"`,
      `"Subject Teacher"`, `"HOD"`, `"PGT"`, `"TGT"`, `"PRT"`.
      **Fixed:** changed the filter to `type === "teaching"` —
      `getEmployeesForReport()` already returns `type` (no service change
      needed), and it's the same field `syllabusService.js` already uses
      elsewhere to find teachers. Confirmed live: 17 employees have
      `type = 'teaching'` in production, so the tile was showing 0 instead
      of 17. `next lint` clean. Full detail:
      `governance/work-log/LOG-2026-09-04.md`.
- [x] **REQ-BUG-003 — Saving a fee payment silently resets the admin's
      manual "Send Reminder" checkbox selection. FIXED 2026-09-04.**
      `fees\page.js:494-500`'s
      effect re-initializes `selectedIncomplete` to "every student with
      pending fees" whenever `students` reloads — which happens after
      `handleSavePayment`/`handleSaveInventory` succeed
      (`fees\page.js:620,646`). If an admin had deliberately unchecked
      some students (e.g. already contacted by phone) then records an
      unrelated payment, the selection silently resets with no warning —
      risk of sending reminders to people intentionally excluded.
      **Fixed:** the effect now only does a full re-select on an actual
      academic-year change (tracked via a `reminderInitYear` ref) — a
      reload for any other reason (saving a payment/inventory) instead
      prunes only students who are now fully paid out of the existing
      selection, leaving any deliberate unchecks alone. Also had to make
      sure this pruning doesn't leave stale entries inflating the "N
      selected" count — confirmed the prune path removes newly-fully-paid
      students from the Set rather than just skipping the reset (a
      naively simpler "skip the whole effect after year init" fix would
      have let paid-off students linger in the count forever). `next lint`
      clean. Full detail: `governance/work-log/LOG-2026-09-04.md`.
- [x] **REQ-BUG-004 — PLAUSIBLE, not confirmed: possible race condition
      switching class/date quickly on Mark Attendance. FIXED 2026-09-04.**
      `attendance\page.js:123-146` (`loadAttendance`) has no
      cancellation/request-id guard on its fetch — a stale in-flight
      request could resolve after a newer one and overwrite the displayed
      attendance with data for the wrong class/date, and a save right
      after could persist attendance against the wrong class. Not
      reproduced, but the missing guard is real.
      **Fixed:** confirmed by reading the code (not by reproducing it live)
      that this was a genuine gap, not just theoretical — `loadAttendance`
      is re-triggered on every class/date change with no guard at all.
      Added a `loadReqId` ref that increments per call; the response,
      catch, and finally blocks all check it's still the latest request
      before applying `statusMap`/`wasMarked`/`editMode`/`attLoading`,
      discarding stale results instead. `next lint` clean. Full detail:
      `governance/work-log/LOG-2026-09-04.md`.

### MINOR
- [x] **REQ-BUG-005 — Inventory report totals have no null-safety on
      `qty`. FIXED 2026-09-04.** `reportService.js:341-342` (`getInventoryForReport`) sums
      `b.qty`/`u.qty` with no `|| 0` fallback (unlike the equivalent sums
      in `inventoryService.js`/`dashboardService.js`) — a null quantity on
      any batch/usage row would turn that item's whole running total into
      `NaN`. Low likelihood if the DB column is NOT NULL, no defensive
      check either way.
      **Fixed:** added `|| 0` to both reduces, matching
      `dashboardService.js`'s already-correct equivalent exactly. `next
      lint` clean.

### mobile-app findings (added 2026-08-18, same review pass)

#### 🛑 CRITICAL
- [x] **REQ-BUG-006 — Re-saving Monthly Test marks fails and silently loses
      the whole batch. FIXED 2026-09-04.**
      `mobile-app/lib/core/services/supabase_service.dart:312-314`
      (`saveMarksBatch`) calls `client.from('exam_marks').upsert(records)`
      with **no `onConflict`**, unlike every sibling batch-save
      (`saveOfficialMarksBatch`, `saveAttendanceBatch`,
      `markDailyTaskDone`), which all correctly specify one.
      `exam_marks` has `UNIQUE (exam_id, student_id)`
      (`SUPABASE_SETUP.sql:49-58`) but records built in
      `teacher_marks_page.dart:_saveMarks()` never include the row `id`, so
      Postgres has nothing to match on for a student who already has a
      mark — the upsert throws a duplicate-key error. It's one batch call,
      so **one already-saved student blocks the entire save**, and
      `_saveMarks()` has no try/catch, so the error is unhandled: the
      "Saving..." spinner never resolves, no error shown, and the whole
      batch of marks is lost. **Failure scenario:** teacher opens an exam
      that already has some marks saved, edits/adds one student's score,
      taps "Save All Marks" → request throws, nothing saves, UI hangs with
      no explanation. This is a real, easily-hit data-loss bug (marks
      entry is re-visited constantly — corrections, late entries, absent
      students added later).
      **Fixed 2026-09-04:** `saveMarksBatch` now passes
      `onConflict: 'exam_id,student_id'` — confirmed against the live schema
      that this exactly matches `exam_marks`'s unique constraint
      (`exam_marks_exam_id_student_id_key`). Also added the missing
      try/catch in `_saveMarks()` so a save failure (any cause, not just
      this one) shows an error snackbar and resets the spinner instead of
      hanging forever. Pure client-side fix, no migration needed.
      `flutter analyze` clean. Not yet visually tested on a device (same
      BlueStacks caveat). Full detail: `governance/work-log/LOG-2026-09-04.md`.

#### ⚠️ MODERATE
- [x] **REQ-BUG-007 — Homework due today is wrongly shown as "Overdue" in
      both the teacher and student apps. FIXED 2026-09-04.**, from midnight onward on the due
      date itself. `teacher_homework_page.dart:234`,
      `student_homework_page.dart:73` compare the due date (parsed as
      midnight) directly against `DateTime.now()` (current time-of-day)
      instead of truncating both to date-only — which the codebase already
      knows how to do correctly elsewhere
      (`teacher_marks_page.dart:_isUpcoming`, and even
      `student_homework_page.dart`'s own `_isPastDue` a few lines above
      this bug). Result: in the student app, today's homework sits in the
      "Active" tab but renders with the red overdue icon/border/text
      (contradicts its own tab); in the teacher app it shows
      "Overdue · &lt;date&gt;" instead of "Due: &lt;date&gt;" and never gets the
      amber "urgent, ≤2 days" treatment.
      **Fixed:** `student_homework_page.dart`'s itemBuilder now calls the
      already-correct `_isPastDue(hw)` instead of its own separate,
      time-of-day-sensitive check. `teacher_homework_page.dart` had no
      existing date-only helper to reuse, so both `overdue` and `urgent`
      now compare against a `today` truncated to midnight before comparing
      (matching the same fix shape). `flutter analyze` on both files:
      clean. Full detail: `governance/work-log/LOG-2026-09-04.md`.
- [x] **REQ-BUG-008 — Un-marking a completed daily task can leave the
      screen showing the wrong state if the request fails. FIXED 2026-09-04.**
      `teacher_daily_tasks_page.dart:33-54` optimistically sets
      `task['completedAt'] = null` immediately, then on failure tries to
      "roll back" by reading `task['completedAt']` — but that field was
      already overwritten to `null` on the line before, so the rollback
      reassigns `null` to `null` (a no-op). If `unmarkDailyTaskDone` fails
      (e.g. a network blip), the UI shows the task as incomplete even
      though the server still has it marked done — until the page reloads,
      the on-screen state is simply wrong.
      **Fixed:** `_toggle()` now captures `originalCompletedAt` (the actual
      value, not a derived bool) before the optimistic `setState`, and rolls
      back to that exact value on failure instead of reconstructing it from
      the now-stale `wasDone` flag. `flutter analyze` clean. Full detail:
      `governance/work-log/LOG-2026-09-04.md`.

#### MINOR / PLAUSIBLE
- [x] **REQ-BUG-009 — A few pages' async `_load()` methods are missing the
      `if (!mounted) return;` guard before `setState`** after an `await`
      (e.g. `student_attendance_page.dart:25`, `student_marks_page.dart:52`)
      — most other pages in the codebase do include this guard. Could
      throw if the user navigates away mid-fetch; low real-world impact,
      just an inconsistency worth cleaning up.
      **Fixed 2026-09-04, now fully audited.** First pass fixed just the two
      named examples; a follow-up subagent then read all ~17 files the
      broader grep had flagged, one by one, to separate real gaps from
      false positives (most were already correctly guarded). Found and
      fixed 7 more real gaps across 4 files:
      `teacher_attendance_page.dart` (edit-request submit, both date-picker
      `onTap` handlers), `student_notices_page.dart` (`_load()`),
      `student_fees_page.dart` (`_load()`'s success and catch paths), and
      `face_enroll_capture_page.dart`'s `_capture()` (5 setState calls
      across face-detect/eyes-open/embedding/save steps, plus its catch
      block — only the final save step had a guard before this). All now
      use `if (mounted)`/`if (!mounted) return;`. `flutter analyze` on all
      4 files: clean, no errors. Full detail:
      `governance/work-log/LOG-2026-09-04.md`.

### found and fixed 2026-09-04 (calendar + ID card documents)
- [x] **REQ-BUG-010 — Calendar event queries had no tiebreaker for same-day
      events. FIXED 2026-09-04.** Both `calendarService.js` (admin) and
      `supabase_service.dart` (mobile) ordered by `event_date` alone, leaving
      same-day events in whatever order Postgres happened to return them —
      could vary between requests and let the admin/teacher views disagree
      on order for the same day. **Fixed:** added `.order("id")` as a
      tiebreaker in both. `next lint`/`flutter analyze` clean. `ef0bba3`.
- [x] **REQ-BUG-011 — Teacher calendar didn't show the Sunday
      legend/dot on Sundays with no seed event. FIXED 2026-09-04.**
      `teacher_calendar_page.dart` only derived categories from actual
      events, so an eventless Sunday rendered as a plain blank day —
      disagreeing with the admin grid's Sunday fallback in
      `YearPlanningTab.js` for the same underlying calendar. **Fixed:**
      eventless Sundays now get the `'sunday'` category added to both the
      month's legend set and that day's dot color. `flutter analyze` clean
      (one pre-existing, unrelated `withOpacity` info). `a99663a`.
- [x] **REQ-BUG-012 — Design 2 ID card photo squished; class-name box text
      could overflow. FIXED 2026-09-04.** `documents/page.js`'s
      `roundedSquareBase64` always rendered onto a hardcoded 400x400 square
      canvas, so `jsPDF.addImage` had to stretch that square crop into
      Design 2's non-square photo box — squishing every student's photo
      horizontally on the printed card. Separately, the class-name box used
      a fixed 7pt font that overflowed for longer values like
      "11TH - COMMERCE". **Fixed:** the canvas now matches the destination
      box's aspect ratio (no stretch); a new `fitFontSize` helper shrinks the
      class-box font until the text fits. `next lint` clean. `c9ae97c`.
- [x] **REQ-BUG-013 — Calendar event delete failures were silently
      swallowed. FIXED 2026-09-04.** `YearPlanningTab.js`'s delete handler
      reset saving state and closed the modal inside a `finally` block
      regardless of whether the delete actually succeeded — a failed delete
      looked identical to a successful one (no error, modal closed, list
      reloaded as if nothing went wrong). **Fixed:** a failed delete now
      shows "Failed to delete: &lt;message&gt;" and leaves the modal open;
      the reload after a successful delete is now awaited. `next lint`
      clean. `3ad0c59`.
      Not click-tested in the browser (admin-panel dev server wasn't started
      this session).

**Reviewer also checked (no further issues found):** `auth_service.dart`,
`face_recognition_service.dart` + the full attendance-kiosk capture→detect→
embed→match→punch pipeline, teacher/student attendance, fees, official
exams, syllabus, leave, tasks, question bank/paper generation, dashboards,
notices, calendar, birthdays, timetable, help desk, query, profile/
password-change flows, PDF generation utilities.

### found 2026-09-17 (attendance kiosk face-match reliability)
- [ ] **REQ-BUG-014 — Face Punch occasionally matches the wrong enrolled
      staff member (MINOR CHANGE per J12B — localized change to matching
      behavior, no schema/scope change).** `match_face_embedding`
      (`SUPABASE_FACE_MATCH_RPC.sql`) does a nearest-neighbor search across
      EVERY stored enrollment shot of EVERY enrolled person (best single
      shot wins, then best person overall) rather than comparing against one
      stable per-person reference. Confirmed via Supabase query
      (2026-09-17): 5 enrolled staff, 22-25 stored shots each (~116 vectors
      total). `FaceRecognitionService.kMatchThreshold` (0.72) and
      `_matchMargin` (0.05, `face_punch_page.dart`) were tuned with only ONE
      enrolled staff member (see that file's own header comment,
      SESSION-2026-09-15) and explicitly never validated against real
      impostor attempts — with 5 people/~116 vectors now, a noisy/
      badly-lit/badly-angled shot from the wrong person occasionally
      outscoring the true match is the expected failure mode, not a random
      bug. **Not yet a data-integrity problem**: the native confirm dialog
      (shows matched name, offers "Not Me" before any punch is recorded —
      `face_punch_page.dart:519-529`) is catching these per user report
      2026-09-17 — currently a reliability/friction issue (repeat scans),
      not corrupted attendance records. Two employees (Sunil Pradhan, Rudra
      Prasad Muni) have `punch_method='face'` attendance rows from
      2026-09-09 but no `face_embedding` on file now (checked via Supabase
      query) — investigated, user confirmed this is unrelated (no
      misidentification trail, just past enrollment churn).
      **Approved fix direction (user chose "proper fix" over quick
      threshold retune, 2026-09-17):** replace the per-shot nearest-neighbor
      search in `match_face_embedding` with one L2-normalized centroid
      (average-then-renormalize) per enrolled person, computed from their
      stored shots, then compare the live embedding against just the 5
      centroids instead of ~116 raw shots. Removes the root cause (more
      shots per person inflating false-accept odds) rather than moving the
      threshold. Server-side SQL-only change (`CREATE OR REPLACE FUNCTION`)
      — no client rebuild needed for any of the 3 mobile flavors, no schema
      migration (computed on the fly from existing `face_embedding` jsonb).
      `kMatchThreshold`/`_matchMargin` will need re-validation against the 5
      real enrolled staff after the change (centroid similarities behave
      differently from best-of-many-shots similarities) before being
      considered final.

      **Implemented 2026-09-17.** `match_face_embedding` rewritten to
      compare against a per-person averaged centroid and applied directly to
      the live Supabase function (`CREATE OR REPLACE`, no client rebuild
      needed for this part). Initial validation used only 3 shots x 5
      people and wrongly concluded 0.72 could stay unchanged - **that
      validation was too small and missed the real effect**: against all
      135 stored shots across the (by then) 6 enrolled staff, only 56% of
      genuine attempts cleared 0.72, which in production read as "only
      recognizes the first/highest-scoring person, nobody else." Root
      cause: centroid similarity for a genuine match sits on a
      systematically lower scale than the old best-of-25-raw-shots
      similarity did, and 0.72 was carried over unchanged.
      **Corrected same day**: re-tuned against the full 135-shot dataset
      (not a small sample) and lowered `kMatchThreshold` 0.72 → 0.65
      (`face_recognition_service.dart`) - user chose recognition over
      strictness given the native confirm dialog's "Not Me" step is the
      real backstop against mix-ups and is confirmed working in practice.
      Tradeoff at 0.65: 76% single-attempt genuine recognition (was 56%),
      9 of 27 real cross-person mix-up cases in the dataset would now clear
      the bar (was 2 of 27) - mitigated by the confirm-before-record step,
      not eliminated. **This DOES require a new attendance-flavor APK
      build + reinstall on the kiosk** (unlike the SQL-only RPC change) -
      `kMatchThreshold` is compiled into the app, not server-controlled.
      **Follow-up not yet done**: trimming each person's outlier/low-
      quality enrollment shots before averaging (or re-enrolling the
      worst-scoring staff) should raise genuine scores back up without
      giving up recognition, letting the threshold move back up toward
      0.72 properly - worth doing before headcount grows further.

## FEATURE INITIATIVES (large, multi-session — own plan file, own mini gate checklist)
- [ ] **REQ-FEAT-001 — Staff App unification: evolve `mobile-app/` teacher
      flavor into one role-aware Staff App (Teacher workspace + Admin
      workspace), added 2026-09-18.** Full discovery input archived at
      `ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`; working plan at
      `planning\STAFF-APP-UNIFICATION-PLAN.md` (read that file for current
      status, not this line). MAJOR CHANGE per §J12B — reopens DESIGN FIXED
      for the mobile identity/role model before any coding.
      **2026-09-18: admin↔employee linkage decided** — explicit nullable
      `employees.admin_user_id → admin_users(id)` FK, set manually per
      person, no fuzzy matching (see plan file's "Decision record"). CLARIFY
      still open (Zustand-permissions question); no migration written yet,
      no code written, nothing committed. Scope is the **teacher flavor
      only** — student/attendance-kiosk flavors untouched.

## Backlog (deferred scope, not urgent)
- Payments: Razorpay package installed, not connected (per `PLAN.md`/
  `governance\documentation\PROJECT_CONTEXT.md` — known, deliberate, Phase-2-equivalent item).
- Push notifications (FCM) — not implemented; in-app only.
- **PENDING — Teacher app Play Store closed testing, started 2026-09-16.**
  Store listing, content rating (Everyone/All ages), target audience (18+),
  data safety, and government/financial/health/ads declarations all
  completed and submitted to Google for review (`com.satyamstars.teacher`,
  AAB v1.0.0/versionCode 1, closed testing track "Alpha", targeted to India).
  Blocked on Play Console's own production-access requirements, not on
  anything in this repo:
  - Needs **≥12 testers opted in** to the closed test — currently 0 opted in
    (only 1 email, `sectofficework@gmail.com`, is on the "Teacher App
    Testers" list, not yet accepted/installed).
  - Needs the closed test to **run ≥14 days** with those testers active
    before "Apply for production" unlocks on the Dashboard.
  Next action needed from the user: gather ≥12 tester Gmail addresses, add
  them to the tester email list, share the Play Console opt-in link, get
  them to install/open the app, then wait out the 14-day window.
  Student and attendance-kiosk apps not yet started on this path — still
  APK-via-S3 only, per the item below.
- Mobile app not yet on Play Store — APK distribution via S3 + in-app update
  checker only. (Teacher app now in progress, see item above; student and
  attendance-kiosk apps not started.)

---

**How to use this file going forward:** when a session finds something
out-of-scope, add it here under the right severity per §J14 rather than
fixing it inline. When you approve a fix, move it to an "in progress" note
with the session date, and log the outcome in the next `work-log\LOG-*.md`.
