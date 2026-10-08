# SATYAM SCHOOL — Pending Tasks & Status Report

**Generated:** 2026-10-04, corrected 2026-10-05, **re-verified 2026-10-06**
**Repository:** `SATYAM-SCHOOL` (`origin/main`)
**Context:** Post-audit remediation, mobile app resilience hardening, Teacher Admin Workspace parity, and Play Store production rollout.

> **2026-10-06 note:** this pass re-read `governance/planning/TODO.md` directly (the
> authoritative, fully-detailed record) rather than `git log`, since DB-only fixes (via
> Supabase MCP) never show up in git history. Two items below (REQ-BUG-061, REQ-BUG-068)
> were corrected on 2026-10-05 as already-handled server-side, but `TODO.md`'s own
> checkboxes for them are still unchecked — flagged as a doc-sync gap, not re-opened as
> real risk, pending someone flipping those checkboxes in TODO.md itself.

---

## 1. Executive Summary & Recent Completions

Resolved and pushed to `origin/main` (commits `811d25f`, `8db198c`, `2138dcc`, `ad0649b`, `aaa4660`, `60f4451`) plus live-only DB fixes applied via Supabase MCP:

* **REQ-SEC-012 (Fixed)** — session auth enforced on `kiosk-settings`, `staff-attendance/delete`, `staff-attendance/sync-absent`; also closed a deeper gap where 5 kiosk RPCs were reachable with zero auth inside the function body itself (`SUPABASE_FIX_KIOSK_ADMIN_RPC_AUTH.sql`).
* **REQ-SEC-014/015/016 (Fixed)** — PDF report routes now verify mobile session tokens server-side; TC generator HTML-escapes all student fields (stored XSS closed); `fetchEmployeeAttendance` moved to session-gated RPC.
* **REQ-SEC-017/018 (Fixed 2026-10-04)** — `kiosk_special_day_overrides` RLS enabled; `search_path` pinned on all 17 flagged functions (`SUPABASE_FIX_KIOSK_SEARCH_PATH_AND_RLS.sql`).
* **REQ-BUG-015/016/017/062/063/064/066/067/069/070 (Fixed)** — session-cache purge, salary-column role gating, empty-result guards, face-enrollment crash loop, silent-save failures, controller-disposal leaks, try/catch+retry UI across student/teacher screens.
* **REQ-FEAT-007 (Shipped 2026-10-04)** — Teacher Admin Workspace "Add Student" now has full ~30-field parity with the web form (`AdminAddStudentPage`, `staff_admin_student_add` expanded to a 39-arg overload, old 11-arg shape still callable). **Not yet visually confirmed on-device.**
* **REQ-SEC-013/014/015/016 audit batch fully closed; REQ-SEC-013 is the one still open** (see §2).

---

## 2. 🚨 Critical Security Items Still Pending

| ID | Issue Description | Location | Action Required |
| :--- | :--- | :--- | :--- |
| **REQ-SEC-013** (top open item) | **Unauthenticated S3 Storage API Routes.** Routes only check prefix strings (`students/`, `employees/`, etc.), no session verification. Anyone can generate presigned PUT/GET URLs for student/employee photos (minors' data) and question-bank files. `view-url` also sets wildcard CORS `*`. | `admin-panel/src/app/api/s3/{upload-url,upload,photo,view-url}/route.js` | Needs a design decision first — these routes are called by both the admin-panel web *and* mobile with no real session, so it isn't a drop-in `requireAdminSession` the way the other routes were. |
| **REQ-SEC-020** | Vercel cron routes fail **open** (not closed) if `CRON_SECRET` is ever unset. | `admin-panel/src/app/api/cron/{attendance-reminders,mark-staff-absent}/route.js` | Flip to fail-closed: `if (!process.env.CRON_SECRET \|\| authHeader !== ...) return 401`. |
| **REQ-SEC-019** | Supabase Auth leaked-password (HaveIBeenPwned) check off project-wide. | Supabase Dashboard → Auth → Policies | Toggle on — zero cost. |
| **REQ-SEC-002 Cat3 table-locks** | RPCs for Groups A/B/C are live; the matching `REVOKE ... FROM anon` on the underlying tables is **deliberately deferred** per the REQ-BUG-018 incident lesson. | Database Permissions | Do NOT run until Teacher/Student v1.0.0+3 (or later) is confirmed installed on real devices — do not re-raise as new, don't re-run without the user asking. |

---

## 3. ⚠️ External Blockers & Distribution

| Item | Status & Blocker | Required Steps |
| :--- | :--- | :--- |
| **REQ-BUG-060: App Update S3 CORS** | **BLOCKED on AWS Console login (user's own).** Direct browser→S3 upload for "Publish App Update" 403s on CORS preflight. User said "will work later" (2026-10-04) — parked, not forgotten. | Add a CORS rule for the Vercel origin(s) to the `satyam-stars-international-school` bucket, merged into whatever CORS config already exists. |
| **Teacher app Play Store** | **Production access applied 2026-10-04** — Google review in progress, "usually 7 days or less" → expect ~**2026-10-11**. Teacher app v4 (1.0.0+4) built/signed locally but not yet distributed: Play Store AAB sits as an unsent draft release (needs the user's own submit click); S3/in-app-update path blocked by REQ-BUG-060. | Wait on Google; user to submit the v4 draft release when ready; resolve REQ-BUG-060 to unblock the S3 path. |
| **Student app Play Store** | **Production access applied 2026-10-01** — decision expected by ~**2026-10-08**. | Check Play Console dashboard around that date. |
| **Attendance-kiosk app** | Not started on the Play Store path — still APK-only. | No action yet, not urgent. |

---

## 4. 🐛 Functional Bugs & Operational Items

| ID | Issue Description | Location | Status |
| :--- | :--- | :--- | :--- |
| **REQ-BUG-065 / REQ-BUG-014** | Kiosk face-match has a self-documented ~33% cross-person false-accept rate, only backstopped by a tap-through "Yes/Not Me" dialog — flagged as a policy decision, not just a threshold tweak. | `face_recognition_service.dart` (`kMatchThreshold = 0.65`), `face_punch_page.dart` | **Open.** Also waiting on the user to physically re-enroll EMP017 (Manisha Biswal) on the kiosk device. |
| **REQ-BUG-020** | 17 orphaned open `employee_shifts` (oldest from 2026-09-09/17 test sessions), no matching `employee_attendance` day row. Blanket auto-close would invent/negate real hours for several staff (3 would go negative). | `employee_shifts` table; review script `mobile-app/STAFF_SHIFT_BACKLOG_REVIEW.sql` | **Open — needs a human per-shift decision**, not a bulk fix. |
| **REQ-FEAT-006** | `auto-close-shifts` pg_cron job has no positive evidence of ever running (0 "Auto Checked Out" alerts ever created, 17 shifts stuck open past 16:00 cutoff for weeks). Migration itself is confirmed live. | Supabase `cron.job` | **Open** — run `SELECT jobname, schedule, command FROM cron.job;` in the SQL Editor; if absent, run `SUPABASE_PG_CRON_SCHEDULE.sql`. |
| **REQ-HYG-007** | `employee_attendance` is empty (truncated during 2026-09-29 testing) — blocks in-browser verification of the new Staff Attendance report. | `employee_attendance` table | **Open**, not a defect — just needs real punches to accumulate. |
| **REQ-BUG-061** | Diagnostics page's `normal_admin` download restriction looked client-side-only. | `diagnostics/page.js` | **Corrected 2026-10-05**: `admin_get_diagnostic_reports()` RPC already omits `log_entries` for `normal_admin` server-side — verified live. The client gate is cosmetic on top of an already-real server restriction. No action needed. *(TODO.md checkbox still unchecked — doc-sync gap only.)* |
| **REQ-BUG-068** | Kiosk admin PIN dialog looked like it had no throttling. | `admin_pin_dialog.dart` | **Corrected 2026-10-05**: `verify_kiosk_admin_pin` already enforces server-side lockout (5 fails → 15-min lock via `kiosk_settings.pin_fail_count`/`pin_locked_until`) — confirmed by reading the live function body. Only real gap is cosmetic: a lockout shows the same "Incorrect PIN" message as a wrong guess. Not security-relevant. *(TODO.md checkbox still unchecked — doc-sync gap only.)* |

---

## 5. 📋 HR, Attendance & Schema Enhancements (all need a decision, none started)

* **REQ-FEAT-002** — Half-day attendance not representable (`status` CHECK is `'P','A','L'` only). Needs a migration (`'HD'` or `half_day BOOLEAN`) + Mark-Attendance UI control.
* **REQ-FEAT-003** — `leave_requests` has no type classification (Casual/Sick/Earned/Unpaid), only free-text `reason`. Needs a DDL migration + approval-form field.
* **REQ-FEAT-004** — No staff holiday calendar; report only excludes Sundays/weekends. Needs a decision on reusing the student-side `holidays` table vs. a staff-specific one.
* **REQ-FEAT-005** — Staff attendance report loads all 11 report types in one `Promise.all` up front; fine at current data volume, will degrade as history grows. Needs the loader split before a date-range pushdown is useful.

## 5b. Large feature initiative — awaiting CLARIFY

* **REQ-FEAT-001 — Staff App Unification** (evolve the Teacher flavor into a role-aware Staff App). Admin↔employee linkage decided (explicit `employees.admin_user_id` FK). **CLARIFY stage still open** (a Zustand-permissions question) — no migration or code written yet. Plan file: `governance/planning/STAFF-APP-UNIFICATION-PLAN.md`.

---

## 6. 🛠️ Code Hygiene & Tech Debt (deliberately not being worked, by the user's own prior calls)

* **REQ-HYG-001 / REQ-HYG-002** — no automated tests, no CI pipeline.
* **REQ-HYG-006 Phase 2** — request-ID log threading, not started.
* Schema drift: unused legacy `users`, `timetable_period_definitions`/`timetable_entries` tables.
* Payment gateway (Razorpay) installed, not wired — Phase 2 scope.
* Push notifications (FCM) — in-app polling only.
* Large monolithic files worth splitting if touched again: `report/page.js` (~2,250 lines), `AddStudentForm.js` (~1,450 lines), `supabase_service.dart` (~1,350 lines, also mixes unprotected `.from()` calls with session-gated RPCs with no marker distinguishing the two).

---

## 7. Recommended Next Actions

1. **Security**: resolve REQ-SEC-013's design question (S3 routes), then fix REQ-SEC-020's cron fail-open logic and flip REQ-SEC-019's dashboard toggle.
2. **Blocked on user**: apply the S3 CORS policy in the AWS Console (REQ-BUG-060); re-enroll EMP017 on the kiosk (REQ-BUG-014); decide REQ-FEAT-002/003/004.
3. **Operations**: check Play Console around 2026-10-08 (Student app) and 2026-10-11 (Teacher app) for production-review outcomes; submit the Teacher v4 draft release when ready.
4. **Database check**: confirm `auto-close-shifts` is actually scheduled (REQ-FEAT-006) and decide what to do with the 17 orphaned shifts (REQ-BUG-020) — both need a look, neither is urgent.
5. **Housekeeping**: flip the REQ-BUG-061/068 checkboxes in `TODO.md` to reflect the 2026-10-05 correction, so this report and the source of truth stop disagreeing.
