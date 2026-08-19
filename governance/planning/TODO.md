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
- [ ] **REQ-SEC-001 — Plaintext `app_password`. REVERTED 2026-08-18 — back to
      PLANNING, not yet approved for coding.**
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
- [ ] **REQ-SEC-002 — `anon`-role over-exposure (scope corrected, larger
      than first scoped).** Not just 4-5 tables — full grep of every
      `mobile-app/SUPABASE_*.sql` file shows **~25 tables** with full or
      partial `anon` grants and 17 with RLS explicitly disabled, matching
      the fact that `supabase_service.dart` queries ~30 tables directly with
      no RPC wrapper. Includes DELETE rights on `question_bank`/
      `question_papers` (pre-exam content) and `official_exam_marks`. See
      `planning\SECURITY-THREAT-MODEL.md` F2 for the full table/RPC list.
      No rate limiting anywhere in the codebase (verified: zero
      `rate.?limit|throttle` matches outside `package-lock.json`/docs). The
      hardcoded anon key in `mobile-app/lib/app_bootstrap.dart:10-11` is
      trivially extractable from any installed APK. Decision needed:
      re-enable RLS with real per-user/per-class policies, move sensitive
      RPCs behind real Supabase Auth sessions, and/or add rate limiting at
      the Supabase/Edge layer. Also a MAJOR change — reopens DESIGN FIXED.
- [ ] **REQ-SEC-004 — `teacher_update_profile` has zero identity check.
      Checked 2026-08-18: NOT fixable without an app rebuild, so deferred
      out of Stage 1.** Unlike `teacher_change_password` (which verifies
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
- [ ] **REQ-SEC-003 — Public S3 bucket for mobile photos**, contradicting
      the original discovery doc's explicit "DO NOT use public S3 buckets"
      rule. `lib/common/widgets/s3_image.dart`. Decision needed: proxy
      through presigned URLs like the admin panel does, or accept the
      current public-bucket approach (it was chosen deliberately after a
      chain of CORS fixes, per `governance\documentation\PROJECT_CONTEXT.md:67` — may be an informed
      tradeoff, not an oversight; needs your call either way).

## IMPORTANT
- [ ] **REQ-HYG-001 — No automated tests for `admin-panel/`.** No `test`
      script, no test files. `mobile-app/test/widget_test.dart` is still
      Flutter's unmodified default counter test.
- [ ] **REQ-HYG-002 — No CI pipeline.** No `.yml`/`.yaml` CI config anywhere
      in the repo; all verification is manual/local.
- [ ] **REQ-HYG-003 — `schema_dump.json` tracked in git** at repo root,
      contains a leftover API-error debug artifact, not source of truth for
      anything. Candidate for deletion (needs your OK — §J4, even a small
      delete gets a heads-up here since it's tracked history).
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
- [ ] **REQ-HYG-005 — `README.md` is corrupted/empty** (wrong encoding,
      effectively blank). Real setup detail lives in `governance\documentation\PROJECT_CONTEXT.md`
      and now `documentation\SETUP-GUIDE.md` instead.
- [ ] Schema drift: `users` vs `admin_users`, `timetable_period_definitions`/
      `timetable_entries` vs `timetables` — self-flagged in
      `governance\documentation\PROJECT_CONTEXT.md`, unresolved, not re-litigated here.

## Functional bugs (non-security) — found 2026-08-18 via a dedicated code
## review (admin-panel done; mobile-app review still pending, will be
## appended when it finishes)
Found by a full-file bug-hunting review, separate from the security audit
above — none of these are fixed, all await your decision on priority.

### 🛑 CRITICAL
- [ ] **REQ-BUG-001 — "Total Fees" is computed two different, conflicting
      ways across the app, producing different numbers for the same
      student on different pages.** Some pages read the fee amount stored
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

### ⚠️ MODERATE
- [ ] **REQ-BUG-002 — Employee Report's "Teachers" summary count always
      shows 0.** `report\page.js:559` filters for `role === "Teacher"`, but
      `reportService.getEmployeesForReport()` returns `designation`/`type`
      values, and the real designation list
      (`employee\page.js:37-41 DESIGNATIONS.teaching`) never contains the
      literal string `"Teacher"` — only `"Class Teacher"`,
      `"Subject Teacher"`, `"HOD"`, `"PGT"`, `"TGT"`, `"PRT"`.
- [ ] **REQ-BUG-003 — Saving a fee payment silently resets the admin's
      manual "Send Reminder" checkbox selection.** `fees\page.js:494-500`'s
      effect re-initializes `selectedIncomplete` to "every student with
      pending fees" whenever `students` reloads — which happens after
      `handleSavePayment`/`handleSaveInventory` succeed
      (`fees\page.js:620,646`). If an admin had deliberately unchecked
      some students (e.g. already contacted by phone) then records an
      unrelated payment, the selection silently resets with no warning —
      risk of sending reminders to people intentionally excluded.
- [ ] **REQ-BUG-004 — PLAUSIBLE, not confirmed: possible race condition
      switching class/date quickly on Mark Attendance.**
      `attendance\page.js:123-146` (`loadAttendance`) has no
      cancellation/request-id guard on its fetch — a stale in-flight
      request could resolve after a newer one and overwrite the displayed
      attendance with data for the wrong class/date, and a save right
      after could persist attendance against the wrong class. Not
      reproduced, but the missing guard is real.

### MINOR
- [ ] **REQ-BUG-005 — Inventory report totals have no null-safety on
      `qty`.** `reportService.js:341-342` (`getInventoryForReport`) sums
      `b.qty`/`u.qty` with no `|| 0` fallback (unlike the equivalent sums
      in `inventoryService.js`/`dashboardService.js`) — a null quantity on
      any batch/usage row would turn that item's whole running total into
      `NaN`. Low likelihood if the DB column is NOT NULL, no defensive
      check either way.

### mobile-app findings (added 2026-08-18, same review pass)

#### 🛑 CRITICAL
- [ ] **REQ-BUG-006 — Re-saving Monthly Test marks fails and silently loses
      the whole batch.** `mobile-app/lib/core/services/supabase_service.dart:312-314`
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

#### ⚠️ MODERATE
- [ ] **REQ-BUG-007 — Homework due today is wrongly shown as "Overdue" in
      both the teacher and student apps**, from midnight onward on the due
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
- [ ] **REQ-BUG-008 — Un-marking a completed daily task can leave the
      screen showing the wrong state if the request fails.**
      `teacher_daily_tasks_page.dart:33-54` optimistically sets
      `task['completedAt'] = null` immediately, then on failure tries to
      "roll back" by reading `task['completedAt']` — but that field was
      already overwritten to `null` on the line before, so the rollback
      reassigns `null` to `null` (a no-op). If `unmarkDailyTaskDone` fails
      (e.g. a network blip), the UI shows the task as incomplete even
      though the server still has it marked done — until the page reloads,
      the on-screen state is simply wrong.

#### MINOR / PLAUSIBLE
- [ ] **REQ-BUG-009 — A few pages' async `_load()` methods are missing the
      `if (!mounted) return;` guard before `setState`** after an `await`
      (e.g. `student_attendance_page.dart:25`, `student_marks_page.dart:52`)
      — most other pages in the codebase do include this guard. Could
      throw if the user navigates away mid-fetch; low real-world impact,
      just an inconsistency worth cleaning up.

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
