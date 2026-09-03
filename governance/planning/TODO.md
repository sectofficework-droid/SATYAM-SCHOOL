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

**Reviewer also checked (no further issues found):** `auth_service.dart`,
`face_recognition_service.dart` + the full attendance-kiosk capture→detect→
embed→match→punch pipeline, teacher/student attendance, fees, official
exams, syllabus, leave, tasks, question bank/paper generation, dashboards,
notices, calendar, birthdays, timetable, help desk, query, profile/
password-change flows, PDF generation utilities.

## Backlog (deferred scope, not urgent)
- Payments: Razorpay package installed, not connected (per `PLAN.md`/
  `governance\documentation\PROJECT_CONTEXT.md` — known, deliberate, Phase-2-equivalent item).
- Push notifications (FCM) — not implemented; in-app only.
- Mobile app not yet on Play Store — APK distribution via S3 + in-app update
  checker only.

---

**How to use this file going forward:** when a session finds something
out-of-scope, add it here under the right severity per §J14 rather than
fixing it inline. When you approve a fix, move it to an "in progress" note
with the session date, and log the outcome in the next `work-log\LOG-*.md`.
