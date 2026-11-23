# Full-System Audit — 2026-11-20

**Trigger:** user asked to "restart the audit from scratch and check each and every single
feature... note down in detail" — a fresh, from-scratch pass distinct from the Nov 18-20
full-system review already closed out in `TODO.md`. This document is the complete record;
`TODO.md` gets a short pointer + the Critical/High list, not the full text, to avoid growing
past its own size-discipline rule again.

**Method:** 10 parallel read-only review passes (forked sub-agents sharing this session's
context), partitioned by feature area to cover ~74,000 lines across the admin panel (Next.js),
all 3 mobile Flutter flavors (Teacher/Student/Attendance-kiosk), and shared service layers.
Each pass was read-only — no files edited, no DB writes/migrations — and was told to use
read-only Supabase MCP queries to verify whether a client-side assumption (a role check, an
RLS policy, an RPC's auth) is actually true live, not just read the code's own comments.
**Status as of this write-up: findings only, nothing in this document has been fixed yet** —
fixes come in a separate pass per the user's explicit instruction to log everything first.

**Coverage gaps, stated up front rather than silently:** `StudentDocumentsSection.jsx` (2348
lines, rendered by `documents/page.js`) was out of scope for every pass and needs its own.
`super-admin.js`'s 6 non-Salary sub-panels (Fees/Inventory/Employee/PendingDetails/
ImportStudents/FullDetailsReplace) only got pattern-scanned, not a full read. `syllabus/page.js`
and `tasks/page.js` (admin-panel) were not reached in the finance/misc pass. `report/page.js`
(3358 lines) got only a targeted check, not a full read (it's how the salary-report bug below
surfaced, not proof the rest of the file is clean). `face_recognition_service.dart` and most of
`core/utils/`/`common/widgets/` got grep-pattern checks, not full reads — nothing found there is
not the same as confirmed clean. Anyone picking this up later should treat these as the next
places to look, not as implicitly audited.

---

## Severity summary

| # | Severity | Area | One-line |
|---|---|---|---|
| 1 | **Critical** | mobile/security | `get_student_fees` RPC — zero auth, `anon`-granted, any student's full financial record readable by UUID with no login |
| 2 | **Critical** | mobile/security | Mobile TC issuance (`staff_admin_issue_tc`) has no role gate at all — any `normal_admin` can issue a legally significant document |
| 3 | **Critical** | admin-lib/security | Real employee PII + salary/expense figures hardcoded in `store.js`, a client-bundled file, in a repo with a documented history of being made public |
| 4 | **Critical** | admin-api/bug | 4 of 6 PDF report routes (ID card, Bonafide, Marksheet, TC) read non-existent `students` columns — produce blank/placeholder documents, including legally significant TCs |
| 5 | **Critical** | admin-lib/bug | "Generate Salary" (`employee/page.js`) is completely broken — queries a table whose direct access was revoked 2 months ago; confirmed only 1 salary row ever recorded, pre-dating the lockdown |
| 6 | **Critical** | admin-api/security | 416-student PII JSON (incl. Aadhaar) still bundled into the server build — already-tracked REQ-SEC-021/BUG-077, re-confirmed still open |
| 7 | **High** | mobile/security | `employee_shifts` — `anon` role can read any employee's full attendance/shift history, unauthenticated |
| 8 | **High** | mobile/security | `record_check_out` RPC — no session-token check, anyone with the anon key + an employee UUID can force-close their shift |
| 9 | **High** | admin-ui/bug | TC date-order validation is backwards — blocks the normal "backdate the leaving date" workflow, silently accepts the nonsensical one |
| 10 | **High** | admin-lib/bug | Staff Attendance "Delete" is broken for every real admin — caller never attaches the session token the route requires |
| 11 | **High** | admin-lib/bug | Admin-panel's own Salary **report** (`reportService.js`) has the identical broken-direct-query bug as #5, independently |
| 12 | **High** | admin-api/security | Both Vercel cron routes still fail *open* if `CRON_SECRET` is unset — already-tracked REQ-SEC-020, re-confirmed still open |

Everything below Critical/High is itemized in full in the sections that follow, organized by
the area each audit pass covered. Each finding carries the severity/category/description/
trigger/fix shape the passes were asked to use.

---

## 1. Admin-panel — Records & Entry (government-entry, gr-book, documents, marksheet-edit)

**Overall:** good. Error handling is unusually disciplined here (`Promise.allSettled` pattern,
try/catch on every write path) — the 3 findings are narrow.

**F1.1 — `student_remarks` RLS policy bypasses the admin-tier check every sibling table uses**
Severity: Medium · Security
`student_remarks_authenticated_all` policy is `cmd=ALL, roles={authenticated}, qual=true,
with_check=true` — any real Supabase Auth session (not just one with an `admin_users` row) can
read/write/delete any student's report-card remark directly. Not actively exploitable today
(every `authenticated` session currently has a matching `admin_users` row), but a live landmine
if that ever changes. Called from `admin-panel/src/lib/examService.js:197-205`
(`saveStudentRemark`), used by `documents/marksheet-edit/page.js:121-123`.
Fix: `ALTER POLICY student_remarks_authenticated_all ON public.student_remarks USING
(is_admin_user()) WITH CHECK (is_admin_user());`

**F1.2 — TC generator unescaped date fallback (re-confirmed, already tracked as REQ-BUG-079)**
Severity: Low · Security (residual stored-XSS)
`admin-panel/src/lib/tcGenerator.js:107,113,127` fall back to raw unescaped `String(v)` when a
date doesn't parse; interpolated unescaped at lines 368/385/411/465, reached from
`documents/page.js:1534-1556`'s "Print TC" (`win.document.write(html)`). Exploitable via the
bulk TC Excel-import path on this same page. Fix: wrap the fallbacks in the file's own `esc()`.

**F1.3 — Hardcoded `document_types` UUID fallback in `government-entry/page.js:2376`**
Severity: Low · Hygiene
`handleBcFileSelected` falls back to a hardcoded UUID if the "Birth Certificate" document-type
lookup misses. Currently correct (verified live) but silently miscategorizes or FK-fails if that
row is ever recreated with a new id. Fix: throw a clear error on lookup miss instead.

**Confirmed fine:** all 4 S3 routes, `online-general-register` (all 3 handlers), `student/
update-gr` — all properly gated; `gr_book_imports`/`student_documents`/`document_types` RLS
correctly `is_admin_user()`-only; the `document_documents_student_id_document_type_id_key`
unique constraint backs the upsert dedup correctly; no `dangerouslySetInnerHTML`/`eval`/raw
`innerHTML` anywhere in these 4 files.

---

## 2. Admin-panel — Student Master Data (super-admin, student pages, TC)

**F2.1 — TC date-order validation is backwards** — see severity table #9.
File: `student/[id]/tc/page.js:211-213`. `isDateOnOrAfter(form.leavingDate, form.tcDate)`
enforces `leavingDate >= tcDate`; the correct rule is the opposite — `tcDate >= leavingDate`
(you certify someone who has *already* left). Blocks the single most common real workflow
(backdating leaving date after the fact) and silently accepts the nonsensical case. Fix: swap
the arguments to `isDateOnOrAfter(form.tcDate, form.leavingDate)`, reword the error message.

**F2.2 — Hardcoded `"Sunil Pradhan"` as `paid_by` on every salary payment/expense, regardless of
who's logged in**
Severity: Medium · Bug (financial audit-trail integrity)
File: `super-admin/page.js:1822,1824,1840,1845` (`SalaryPanel`'s `payOne()`/`payAll()`) — the
panel never even reads `authUser` from the store, unlike its siblings in the same file. Same
root cause recurs independently in `employee/page.js` (see F3.2 below) — two call sites, one
fix pattern. Fix: read `authUser` from the store, pass `authUser?.name` as `paid_by`/`paidBy`.

**F2.3 — Secondary form-support loads fail completely silently**
Severity: Low-Medium · Bug
`student/[id]/edit/page.js:234,252,268` — `getActiveClasses()`/`searchStudentsForSibling()`
use `.catch(() => {})` with no fallback UI or logging, unlike the page's primary load. A
transient network blip leaves the Standards dropdown or sibling autocomplete empty with zero
indication anything failed. Fix: at minimum `console.error`; ideally an inline retry affordance.

**Confirmed fine:** `create_impersonation_code` (server-side role check verified live, matches
UI gate), `admin_delete_student_permanently` (server-side role check + correct pre-deletion of
the 3 `NO ACTION` FKs before the main delete, all other FKs confirmed `CASCADE`/`SET NULL`), TC
number generation (deterministic, no bug), REQ-BUG-081's GR-duplicate warning (still intact),
REQ-SEC-030's TC role gate on the **web** side (confirmed present and correct — the mobile side
lacking the equivalent is F7.1 below).

**Coverage gap:** `super-admin.js`'s 6 other sub-panels (Fees/Inventory/Employee/
PendingDetails/ImportStudents/FullDetailsReplace) only pattern-scanned (grep for role checks,
`dangerouslySetInnerHTML`, `window.open`, RPC calls), not read line-by-line. Flagged as the main
residual gap from this pass — worth its own dedicated audit.

---

## 3. Admin-panel — Org/Settings (employee, settings)

**F3.1 — "Generate Salary" is completely broken** — see severity table #5.
File: `employee/page.js:1407-1437` (`AttendanceSection.handleGenerate()`). Does a direct
`supabase.from("salary_payments").select(...)`/`.insert(rows)` from the browser, but
`SUPABASE_SALARY_PUNCHCODE_ROLE_ENFORCEMENT.sql` (2026-09-19, REQ-SEC-007) revoked
`SELECT/INSERT/UPDATE/DELETE` on `salary_payments` from `authenticated` entirely and replaced
direct access with `admin_get_salary_payments`/`admin_record_salary_payment`/
`admin_record_salary_payments_bulk` RPCs — this caller was never migrated. Both the duplicate-
check SELECT and the INSERT fail with a permission-denied error, caught by the existing generic
`alert()` — which is likely why this has gone unnoticed. **Confirmed live: `salary_payments` has
exactly 1 row ever, dated 2026-08-30 — before the lockdown.** Fix: switch to the RPCs, same
pattern `super-admin/page.js`'s Salary tab already uses.

**F3.2 — Hardcoded `paid_by: "Sunil Pradhan"`** (same root-cause family as F2.2)
File: `employee/page.js:1434`. Fix: same as F2.2 — pass the real `authUser.name`; the
replacement RPC already takes `p_paid_by`.

**F3.3 — Settings page's "normal_admin has no access" rule is enforced only client-side for
most of its 16 tabs**
Severity: Medium · Security (needs the user's decision on intent, not a blind fix)
`settings/page.js:2532` blocks the whole page for `normal_admin` in React, but the underlying
tables most tabs write to (`timetables`, `academic_years`, `fee_structures`,
`employee_salaries`, and by the same pattern likely most others) carry RLS gated by
`is_admin_user()` only — any admin tier, not specifically senior_admin/management. Only Salary
and Access Codes/impersonation have real tier enforcement matching the page's blanket denial;
Users & Roles is separately enforced via its own API route. A `normal_admin` using devtools or
the already-loaded `settingsService.js` functions (or a direct Supabase client call) can still
read/write Timetable, Academic Year, Fee Structure, Classes & Sections, Subjects, Exams, Year
Planning, Rules & Regulations, Entry Batches, App Update, Feature Toggles — despite the UI
telling them "You do not have access to this section." Needs the project owner's call: was "hide
the UI" always the real bar, or should the underlying tables get the same `admin_has_role`-style
gating already used for Salary/TC?

**F3.4 — `nextEmpId` generation has a narrow race window** (downgraded on verification)
Severity: Low · Bug
`AddEmployeeModal` computes `max(existing)+1` client-side; `employees.emp_code` has a live
`UNIQUE` constraint, so a collision fails loudly (confusing error) rather than silently
duplicating — annoyance, not data corruption. Fix (if revisited): generate server-side.

**Confirmed fine:** `canImpersonate` gate backed by a real server-side role check in
`create_impersonation_code`; `generate_punch_code`'s lack of a tier gate matches the UI's own
lack of one (not a mismatch); only one direct (non-service-layer) Supabase call exists in the
entire 2874-line `employee/page.js` (the broken salary one, F3.1) — everything else correctly
routes through `src/lib/*Service.js`; document-upload flow correctly blocks submission mid-
upload and validates file type/size.

---

## 4. Admin-panel — Finance/Reports/Misc (report, fees, inventory, expenses, attendance,
syllabus, tasks, notice, queries, question-papers, diagnostics, dashboard)

**F4.1 — Admin-panel's own Salary report is broken, same root cause as F3.1, independently**
Severity: High · Bug. See severity table #11.
`admin-panel/src/lib/reportService.js:273-282` (`getEmployeesForReport`) does the same direct
`salary_payments` query, now confirmed via `pg_policies` to return zero rows for any role
(RLS enabled, zero policies = default-deny). Worse: the `Promise.all` result only checks
`empRes.error`, never `salRes.error` — the permission-denied failure is silently swallowed and
the salary column just reads 0/blank, no error shown at all. Fix: same RPC migration as F3.1,
plus actually check `salRes.error`.

**F4.2 — Expenses have no role gating at all, inconsistent with the equivalently-sensitive
`fee_payments` table**
Severity: Medium · Security/hygiene
Any admin tier, including `normal_admin`, can add/edit/**permanently delete** any expense via a
plain `window.confirm()` — no typed confirmation, no audit trail. `fee_payments` got dedicated
`enforce_fee_payment_edit_role` triggers specifically because untrusted edits to financial
records were judged too risky; expenses (real money out) got no equivalent. Needs a decision:
extend the same trigger pattern, or treat the looser model as intentional.

**F4.3 — Fee Reminder "Send" buttons are fully non-functional but look like they worked**
Severity: Medium · UX/Bug
`fees/page.js:258-262,701-709` — both the per-student and bulk "Send to N Students" buttons only
`alert("...sent! (FCM integration pending)")`. No message/SMS/push is actually sent. The UI
(due-amount display, message preview, "Sent on: {date}") is detailed enough that office staff
could reasonably believe a parent was just notified when nothing happened. Fix: either wire to a
real channel, or make the non-functional state visually obvious instead of a success alert.

**F4.4 — Fee payment amount validation is client-side only**
Severity: Low · Hygiene. `fees/page.js:616-656` checks `amt > dueFees` only in React;
`saveFeePayment`'s DB insert has no equivalent check/trigger. Low priority (requires an already-
authenticated admin session) but worth a DB CHECK if financial accuracy matters more than
flexibility.

**F4.5 — Inventory usage quantity can exceed available stock (client-only check)**
Severity: Low · Hygiene. `inventory/page.js:500`/`inventoryService.js:143-165` — `qtyNum <=
availQty` only enforced in the modal, no DB-level check; `avail()` could go negative with just a
display glitch, not data loss.

**Confirmed fine:** Inventory reset (`canResetInventory`) is backed by a real server-side
role+confirm-phrase check; inventory/assets/expenses RLS is consistently `is_admin_user()`
(intentional "any admin can do routine entry," the inconsistency is specifically against
`fee_payments`, see F4.2); diagnostics download gate is cosmetic on top of a real server
restriction (REQ-BUG-061, already fixed); attendance writes are covered by this session's own
RLS consolidation; queries/question-papers/notice pages are clean CRUD with proper error
handling; dashboard page has no missing-error-handling gaps.

**Coverage gap:** `syllabus/page.js` and `tasks/page.js` not reached in this pass; `report.js`
(3358 lines) only got a targeted check (which is how F4.1 surfaced), not a full read.

---

## 5. Admin-panel — API routes (all 18 `route.js` files)

**Headline: the "service-role client with zero caller auth" bug class that's bitten this
project 4 times before (REQ-SEC-012/013/024/025) does NOT recur in any of these 18 files.**
Every route has a real server-side auth check in front of its DB access. The problems found
here are different in kind — see below.

**F5.1 — 4 of 6 PDF report routes read non-existent `students` columns, producing blank/
placeholder documents** — severity table #4. `api/reports/id-card/route.js`, `bonafide/
route.js` (both via `pdfReportsServer.js`'s `generateIdCardPdf`/`generateBonafidePdf`), `api/
reports/marksheet/route.js` (via `marksheetService.js`, `s.name`), `api/reports/tc/route.js`
(`student.name`/`student.std`/`student.fatherName`/`student.admissionDate`). **Verified live:**
`students` has `first_name`/`last_name`/`father_name`/`dob` — no `name`, `std`, `fatherName`,
`admissionDate`, or `doa`; class/admission data lives in `student_enrollments`, never joined in
any of these 4 routes. Every ID card/Bonafide/Marksheet/TC generated via the mobile Admin
Workspace's report feature renders placeholder text ("STUDENT NAME", "STD: —", "Father's Name:
—") instead of real data. **TC is a legally significant document — this is an operational
failure, not cosmetic.** Fix: join/fetch the real columns + current enrollment, map to whatever
field names each PDF generator expects (check whether an existing `mapToStudent()`-style helper
already does this composition and these 4 routes just skipped calling it).

**F5.2 — PII JSON still bundled in the server build** — severity table #6, already-tracked
REQ-SEC-021/BUG-077, re-confirmed: `admin-panel/src/data/onlineGeneralRegisterData.json` (222KB,
416 students incl. Aadhaar) still exists and is still imported by `api/online-general-
register/route.js:3`.

**F5.3 — Both cron routes still fail open if `CRON_SECRET` is unset** — severity table #12,
already-tracked REQ-SEC-020, re-confirmed still open in both `api/cron/attendance-reminders/
route.js:17` and `api/cron/mark-staff-absent/route.js:18`.

**F5.4 — `staff-attendance/delete` has no role-tier restriction on an irreversible bulk action**
Severity: Medium · Security. Gated with `requireAdminSession` but no `allowedTiers` — can mass-
delete attendance/shift history by employee/date-range, or a whole class's attendance for a
date, with no confirmation or audit trail. (Note: this combines with F6.2 below — the route
currently 401s for every real caller because the UI never attaches a token at all, so this isn't
exploitable *today*, but the fix needs to restore working auth **with** the tier restriction,
not just re-add a header.)

**F5.5 — `s3/view-url` still has wildcard CORS** (`Access-Control-Allow-Origin: "*"`) despite
auth being added — defense-in-depth gap, low standalone risk now that auth is required.

**F5.6 — Stale comment in `reports/tc/route.js:5-7`** claims TC issuance has "zero role gating
on the admin-panel web side (REQ-SEC-008, still open)" — false; REQ-SEC-030 fixed that weeks
ago. A future reader trusting this comment would wrongly assume the web side is unprotected.

**F5.7 — Stale hardcoded dev-machine path** in `documents/sync-collection-report/route.js:56`
(`D:\Project\SSIS SCHOOL\...`) — harmless on Vercel, dead/misleading.

**F5.8 — `s3/upload` has no object-level ownership check**, only a key-prefix check — likely an
accepted tradeoff given this project's broad-trust mobile RPC model, flagged for awareness.

**F5.9 — `student/update-gr` API route has no duplicate-GR check**, unlike `AddStudentForm.js`'s
client-side soft warning (REQ-BUG-081) — a GR change via this specific route could create a
duplicate silently.

**F5.10 — `admin-users` route has no protection against removing the last senior_admin/
management account** — two `management` users could mutually demote/delete each other to zero
elevated accounts with no superuser bypass.

**Confirmed correctly gated (all 18 routes, full table in the fork's own report):**
`admin-users`, `kiosk-settings`, `documents/sync-collection-report`, `online-general-register`,
all 6 `reports/*`, all 4 `s3/*`, both `staff-attendance/*`, `student/update-gr`, both `cron/*` —
every handler in every file calls a real auth helper before touching the DB.

---

## 6. Admin-panel — shared `src/lib/` services

**F6.1 — Real employee PII + financial-attribution data hardcoded in `store.js`** — severity
table #3. `store.js:42-67` (employees) hardcodes 15 real names/codes/designations/departments
(one with phone+email); `:95-106` (expenses) attributes real-looking salary figures (e.g.
₹185,000 "Staff Salary — June 2026") to the same named individuals. **Cross-referenced two
names against this project's own tracked docs — confirmed real, not placeholder** ("Manisha
Biswal"/EMP017 matches `BOOTSTRAP.md`'s open re-enrollment task; "BK Debiprasad Das"/EMP003
matches the project owner). This ships in every Next.js client bundle, in a repo with a
documented history of being toggled public (REQ-SEC-021, last flipped public 2026-10-25). Fix:
replace with empty array or clearly fictional placeholder data — the comment's stated purpose
("Salary panel works without visiting Employee module first") doesn't require real names.

**F6.2 — "Delete staff attendance" fails for every real admin — no Authorization header sent**
Severity: High · Bug. `staffLeaveService.js:193-200` (`deleteStaffAttendanceRecord`) does a
plain `fetch` with only `Content-Type` — no `Authorization` header — but the route requires one
(`requireAdminSession`). Every real invocation from `employee/page.js:2015,2062` 401s. Fix:
attach `Authorization: Bearer <token>` or switch to the shared `authedFetch` helper — and apply
the tier restriction from F5.4 in the same change.

**F6.3 — Two "try the new authed API, silently fall back to the old unguarded path on ANY
failure" patterns**
Severity: Medium · Security-fragility. `kioskSettingsService.js:23-58` (`saveKioskSettings`)
and `studentService.js:928-954` (`updateStudentGrNo`) both fall through to a direct/RPC write
bypassing the new gate on any error (network blip, 401, 500 — not just "route doesn't exist").
Not exploitable today (the fallback currently allows the same population), but a silent
regression waiting to happen if either route's gate is ever tightened later. Fix: remove the
fallback now, or make it re-check the same condition.

**F6.4 — `tcGenerator.js`'s own header comment is now factually wrong** — claims it's "the one
exception that needs escaping," but `marksheetGenerator.js` (added later) uses the identical
raw-HTML pattern and also needs it (and, per the fork's full read, already correctly has it).
Risk: a future third HTML-templated generator gets built without escaping because the comment
implies only one file needs the discipline.

**F6.5 — `employeeService.js` fetches the hashed `app_password` into every employee-list
response, unused** — `select("*")` includes it, `mapFromDB` maps it to `appPassword`, nothing
ever reads it. Not exploitable (bcrypt hash, not plaintext) but needless exposure surface.

**F6.6 — `isStrongPassword` validator only checks length (≥6), not complexity** — naming/hygiene
mismatch, consistent with already-tracked REQ-SEC-023 rather than a new issue.

**F6.7 — Marksheet's computed `rollNo` is never rendered** — `marksheetGenerator.js:171`
computes it into the view-model, the template never interpolates it; parents/teachers see no
Roll No. field on the printed report card, apparently an oversight (no comment explaining the
omission, unlike other deliberate omissions in the same file).

**F6.8 — Duplicated manual auth-header logic instead of the shared `authedFetch` helper** across
`kioskSettingsService.js`, `s3Upload.js`, `studentService.js` — all 3 attach the header
correctly, just not via the one shared helper `authedFetch.js` exists to standardize.

**F6.9 — 60-second stale-session cache in `apiAuth.js`** — a just-demoted/deactivated admin can
keep acting on their old cached role for up to 60s. Narrow window, low likelihood; flagged as an
accepted tradeoff unless instant privilege revocation is ever required.

**Confirmed fine:** `s3/photo` route (unused but still correctly hardened — intentional, not an
oversight); `admin_delete_student_permanently` (role check + correct FK pre-handling, re-
verified independently of the F2 pass); `marksheetGenerator.js` (every dynamic field traced is
correctly `esc()`-ed, unlike `tcGenerator.js`); `pdfReportsServer.js`/`reportService.js`/
`pdfTableExport.js` (structured PDF libs, not HTML injection — not exposed to the XSS class);
zero hardcoded secrets/API keys found anywhere in `src/lib/`; `s3.js` (server-only, env-sourced
credentials, no fallback); `reportsServerAuth.js`/`impersonationService.js` (sound); no real
N+1 patterns found in the files grepped.

**Coverage gap:** ~35 of 51 files got pattern-grep rather than a line-by-line read (listed in
the fork's own report) — none matched a red-flag pattern, but that's "nothing found yet," not
"confirmed clean."

---

## 7. Mobile — Teacher Admin Workspace (30 files, Staff App Unification)

**F7.1 — Mobile TC issuance has NO role gate — a regression against the web-side fix**
Severity: Critical · Security. See severity table #2.
`staff_admin_service.dart:336-345` (`issueTc`) → RPC `staff_admin_issue_tc`. **Verified live:**
the RPC only checks `staff_admin_tier(p_employee_id) IS NULL` — ANY linked admin tier, including
`normal_admin`, passes. The web's equivalent `admin_issue_tc` RPC requires `senior_admin`/
`management` (REQ-SEC-030, shipped 2026-11-18) — that fix never propagated to mobile. Worse: the
code comment at `admin_student_detail_page.dart:9-13` **actively claims the opposite** — that
mobile "was built correctly from the start," which was true before REQ-SEC-030 shipped and is
now backwards. The "Issue Transfer Certificate" button also renders unconditionally (unlike
"Delete Permanently" two lines below it, which IS tier-gated in the UI). Fix: add the identical
`IF staff_admin_tier(...) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION` check to
`staff_admin_issue_tc`; gate the UI button behind `_isSeniorOrMgmt` to match.

**F7.2 — "Generate Admin Access Code" button shown to every tier** (RPC correctly rejects —
UX gap, not a security hole)
Severity: Medium · UX. `admin_student_detail_page.dart:202` renders unconditionally; the RPC
(`staff_create_impersonation_code`, verified live) correctly requires senior_admin/management.
A `normal_admin` gets a raw/generic error instead of never seeing the button — same class REQ-
FEAT-027 already fixed on the web side, not mirrored here. Fix: wrap in `if (_isSeniorOrMgmt)`.

**F7.3 — Near-universal `TextEditingController` disposal gap (REQ-BUG-083 class), confirmed in
the large majority of these 29 files**
Severity: Medium · Hygiene (widespread). Two shapes, file-by-file confirmed by the fork:
- **State-level field, no `dispose()` anywhere in the file:** `admin_students_page.dart`,
  `admin_employees_page.dart` (`_searchCtrl`), `admin_gr_book_page.dart`, `admin_salary_page.dart`,
  `admin_fees_page.dart` (all `_searchCtrl`), `admin_inventory_page.dart`'s `_UsageTabState`.
- **Method-local, created fresh per dialog, never disposed on close:**
  `admin_employee_detail_page.dart`, `admin_employees_page.dart` (its add-employee dialog,
  separate from the search leak above), `admin_expenses_page.dart`, `admin_fees_page.dart`
  (payment/fee-structure dialogs), `admin_inventory_page.dart` (add-item/checkout dialogs),
  `admin_kiosk_settings_page.dart`, `admin_notices_page.dart`, `admin_queries_page.dart`,
  `admin_student_detail_page.dart` (Edit + Issue-TC sheets), `admin_syllabus_page.dart`,
  `admin_tasks_page.dart`, `admin_users_roles_page.dart`, `admin_year_planning_page.dart`,
  `admin_exams_page.dart` (has a `dispose()` override, but it only disposes an unrelated
  `TabController`, not these).
- **Confirmed correctly disposed (the right pattern, for reference):** `admin_add_student_
  page.dart` (41 controllers, one loop), `admin_punch_code_page.dart`.
Fix: add `dispose()` overrides for state-level fields; chain `.whenComplete(() => ...dispose())`
on dialog-opening calls for method-local ones — exactly the pattern `teacher_profile_page.dart`
already uses post-REQ-BUG-083.

**F7.4 — `StaffAdminService.deleteInventoryItem` is dead code** — defined, never called; no
delete-item UI exists on mobile inventory (only "Return Asset" has a flow). Product decision:
wire it up, or remove.

**F7.5 — `_issueTc` builds its own ad-hoc confirmation sheet instead of the shared
`confirmAdminAction` helper** every other destructive action in this directory uses — cosmetic/
consistency only (it does have its own inline warning text, so not a missing-confirmation bug).

**Confirmed fine:** every RPC in `staff_admin_service.dart` attaches both `employeeId` and
`sessionToken`; spot-verified live Postgres bodies for `staff_admin_student_delete_
permanently`, `staff_admin_user_delete`, `staff_create_impersonation_code`,
`staff_admin_record_salary_payment` — all correctly re-derive tier server-side;
`staff_admin_user_delete` additionally blocks self-delete and blocks senior_admin from deleting
management. Nav-level tier gating in `admin_workspace_home.dart` is consistent for every
sensitive module. No file is missing try/catch on its primary data load (REQ-BUG-069 class
absent here — unlike the non-admin-workspace Teacher pages, see §9).

---

## 8. Mobile — Student app + Attendance Kiosk

**F8.1 — `get_student_fees` RPC: zero auth, `anon`-granted, any student's full financial record**
Severity: Critical · Security. See severity table #1.
`student_fees_page.dart:30` → `supabase_service.dart:1419-1423` (`fetchFees`) → Postgres
`get_student_fees(p_student_id uuid)`. **Verified live:** `SECURITY DEFINER`, no session-token
parameter, no caller-identity check at all — unlike `fetch_my_exam_mark` and siblings which
require `p_session_token`. `EXECUTE` is granted to **both `anon` and `authenticated`**. Anyone
with only the public anon key (embedded in every APK, and this project's own history shows it
has leaked via a public repo before) can call `get_student_fees` with **any** student UUID and
get: fee total, discount amount, discount reason (often sensitive), total paid, balance, and
complete payment history (dates, amounts, who received each payment) — no login, no
relationship to that student required. Same bug class already fixed on `exam_marks`/
`student_attendance` (REQ-SEC-002 Category 3) but missed on `fee_payments`/`student_
enrollments`/`student_inventory_assignments` reached through this one RPC. **This is the single
most severe finding across every pass that touched the mobile side.** Fix: add
`p_session_token`, verify it resolves to a `student` subject matching `p_student_id` via
`verify_mobile_session`, reject otherwise — same pattern as the already-fixed siblings.

**F8.2 — `staff_enroll_list_page.dart:101-119`'s delete has no try/catch**
Severity: Low · Bug. An expired kiosk-admin session token or network blip during "Remove" leaves
an unhandled exception and the list never refreshes — no user-facing message either way. Fix:
wrap in try/catch, show a SnackBar on failure.

**F8.3 — `student_help_desk_page.dart`'s `fetchHelpDeskContacts` has the same no-session-token
shape as F8.1, but the data (staff contact numbers) is intentionally low-sensitivity** — flagged
for consistency awareness only, not a fix candidate.

**F8.4 — `student_home.dart`'s tab pages re-fetch on every switch (no `IndexedStack`)**
Severity: Low · Hygiene/UX. Each of the 5 tabs is disposed/recreated on switch, unlike
`student_exams_page.dart`'s sub-tabs which deliberately use `IndexedStack` to avoid this. May be
intentional (data freshness) — worth confirming intent.

**Confirmed fine:** the entire Attendance Kiosk module (7 files) — camera/timer resource
lifecycle handled with unusual care (`face_punch_page.dart`'s dispose/reinit logic, `qr_punch_
page.dart`'s dual-timer cleanup, `admin_pin_dialog.dart`'s lockout surfacing), every load has
try/catch + `mounted` checks, no resource leaks found anywhere. `student_attendance_page.dart`,
`student_exams_page.dart`, `student_homework_page.dart`, `student_notices_page.dart`,
`student_timetable_page.dart` all clean. The 6 student files already touched this session
(marks/official_results/profile/query/rules/syllabus) were spot-checked only, per instruction,
and nothing further was found there.

---

## 9. Mobile — Teacher core features (24 files, excluding Admin Workspace)

**F9.1 — `record_check_out` RPC: no session-token check at all — unauthenticated attendance
write**
Severity: High · Security. See severity table #8.
`supabase_service.dart:498-510` (`recordCheckOut`) → Postgres `record_check_out(p_employee_id,
p_check_out_at)`. Unlike every sibling RPC in this file (`record_face_punch`, `redeem_qr_
session`, `redeem_punch_code`), takes only an employee id and a timestamp — **verified live:**
`SECURITY DEFINER`, `EXECUTE` granted to `anon`, no identity check. Anyone with the (effectively
public) anon key and any employee's UUID can close their open shift at an arbitrary timestamp —
even mid-shift — and it inserts a "Checked Out" alert as them. Called from `teacher_my_
attendance_page.dart:46-68`. Fix: add `p_session_token`, verify via `verify_mobile_session`,
mirroring `redeem_qr_session`'s own REQ-SEC-026 fix.

**F9.2 — Systemic: missing try/catch (REQ-BUG-069 class) confirmed in 13 of these 24 files** —
this fix was applied to some pages (rules/timetable, both fixed this session) but never swept
across the rest. Locations: `teacher_my_attendance_page.dart` `_load()`, `teacher_daily_tasks_
page.dart` `_load()`, `teacher_calendar_page.dart` `_loadMonth()`, `teacher_notebook_report_
page.dart` `_load()`, `teacher_marks_page.dart` `_load()`/`_selectExam()`, `teacher_attendance_
page.dart` `_loadStudents()`/`_loadAttendanceForDate()`, `teacher_homework_page.dart` `_load()`,
`teacher_leave_page.dart` `_load()`, `teacher_students_page.dart` `_load()`, `teacher_daily_log_
page.dart` `_loadRoster()`, `teacher_question_bank_page.dart` `_load()`, `teacher_notebook_
page.dart` `_loadGrid()`, `teacher_syllabus_page.dart` `_load()`, `teacher_official_exams_
page.dart` `_load()` (plus a bare unhandled `.then()` at `_selectClass()`), `teacher_home.dart`
`_loadNotifications()` (lower impact — notification bell only).

**F9.3 — Systemic: `TextEditingController`s in ad-hoc `showModalBottomSheet` dialogs never
disposed, confirmed in 5 files** (REQ-BUG-083 class) — `teacher_attendance_page.dart`
(`reasonController`), `teacher_marks_page.dart` (`nameCtrl`/`marksCtrl`), `teacher_homework_
page.dart` (`descCtrl`), `teacher_leave_page.dart` (`reasonCtrl`), `teacher_question_bank_
page.dart` (`titleCtrl`). Not independently checked: `teacher_official_exams_page.dart`/
`teacher_syllabus_page.dart` for the same shape — flagged as a follow-up grep.

**F9.4 — `teacher_profile_page.dart` sign-out has no confirmation dialog**
Severity: Low · UX. `teacher_home.dart` shows "Are you sure?"; the profile page signs out on a
single tap — the exact inconsistency just fixed on the Student app side (`student_profile_
page.dart` vs `student_home.dart`), not mirrored into Teacher. Fix: copy the same dialog.

**F9.5 — `teacher_attendance_page.dart::_openRequestEditSheet()` — no try/catch, button can get
permanently stuck disabled**
Severity: Medium · Bug. If `submitAttendanceEditRequest` throws, `setState(() => _requesting =
false)` never runs — "Request Edit" stays disabled forever with zero error shown. Fix: wrap in
try/catch, reset `_requesting` on failure.

**F9.6 — `teacher_leave_page.dart` Submit Request — no try/catch AND no double-submit guard**
Severity: Medium · Bug. Worse than F9.5 — zero error feedback of any kind on failure, and the
button isn't disabled while in flight, so a double-tap on slow network submits two identical
leave requests. Fix: add a `_submitting` guard + try/catch with a snackbar.

**Confirmed fine:** `teacher_profile_page.dart`'s controllers (all correctly disposed via
`.whenComplete()` — already fixed) and its password-change flow (correctly requires + verifies
the current password server-side, confirming REQ-BUG-084's fix is live and CLAUDE.md's "no
password check" line is just stale documentation, not a live bug); `scan_attendance_qr_page.dart`
(double-tap guarded, clean); `teacher_marks_page.dart::_saveMarks()` (REQ-BUG-067's fix intact);
`teacher_daily_log_page.dart`/`teacher_notebook_page.dart`/`teacher_official_exams_page.dart`
save paths (proper try/catch); `teacher_notices_page.dart` (already fixed); `teacher_dashboard_
tab.dart` (AnimationController disposed); every RPC in this file-set other than `record_check_
out` consistently requires + passes a session token.

---

## 10. Mobile — core services (`supabase_service.dart` et al.) + common widgets

**F10.1 — `employee_shifts`: `anon` role can read any employee's full shift/attendance history,
unauthenticated**
Severity: High · Security. See severity table #7.
`supabase_service.dart:517-525` (`fetchEmployeeShiftsForDate`) does a direct `.from(...)` with
no session token. **Verified live:** `anon read employee_shifts` policy, `qual: true`, roles
`{anon, authenticated}` — the function's own `.eq('employee_id', ...)` is just a client query
param, not an enforced restriction. Anyone with the anon key can query any `employee_id`/`date`
and get full check-in/out timestamps, lateness flags, minutes-late. The code comment at this
call site is also factually wrong about which role needs the grant (claims `authenticated` needs
it; mobile never runs as `authenticated` — and `anon` turns out to already have it too). Fix:
move behind a session-token-gated RPC (mirror `fetchStudentAttendance`'s shape), then revoke the
`anon` SELECT policy, keep only an `is_admin_user()`-gated one.

**F10.2 — `daily_task_targets`: anon-readable join exposes which employee is assigned which
task**
Severity: Medium-High · Security. `fetchDailyTasksForEmployee` joins `daily_tasks` with
`daily_task_targets(employee_id)` directly; **verified live:** `anon read daily_task_targets`,
`qual: true`, role `{anon}` — the full join (every task × every targeted employee) ships over
the wire to any anon caller, filtered only client-side. Combined with the already-intentional
`fetchOtherTeachers` exposure of employee id→name, an outside party could de-anonymize which
named staff member is assigned which specific (free-text) checklist item. Needs a decision: move
to a session-gated RPC filtering server-side, or narrow the policy if broad `daily_tasks`
visibility is intentional but the targeting map specifically shouldn't be.

**F10.3 — Session token sent as a GET query-string parameter**
Severity: Low-Medium · Security/hygiene. `s3_upload_service.dart:40-47` (`getS3ViewUrl`)
appends `sessionToken` to the URL rather than a header/body field (the POST upload in the same
file does this correctly). More likely to end up in server/proxy access logs than a header. Fix:
switch to POST-with-body or an `Authorization` header, matching the rest of the codebase.

**F10.4 — `TextEditingController` never disposed in the shared "Report a Problem" dialog**
Severity: Low · Hygiene (affects both Teacher and Student apps, since the dialog is shared).
`report_problem_dialog.dart:21` — same REQ-BUG-083 class, missed because this shared widget sat
outside that pass's file list. Fix: `.whenComplete(() => controller.dispose())`.

**F10.5 — Two near-identical functions reading the same table**
Severity: Low · Hygiene. `fetchCurrentAcademicYearLabel` vs `fetchAcademicYearLabels` — minor
duplication, not a bug.

**Confirmed fine — full direct-anon-read classification for every `.from()` call in
`supabase_service.dart`:** `app_versions`, `employees` (column-GRANT-limited, documented
exception), `school_profile`, `official_exams`, `class_subjects`, `official_exam_subject_
config`, `academic_years`, `timetables`, `diagnostic_reports` (INSERT-only, documented), `school_
rules`, `daily_tasks` itself, `notices`, `school_calendar_events` — all intentional, non-
sensitive, or already-documented exceptions. Only `employee_shifts` (F10.1) and the `daily_task_
targets` join (F10.2) are unverified/risky. `_withNetworkRetry`/`_firstRow` consistently applied
everywhere checked; `staff_admin_service.dart`'s entire high-risk write surface (deletes,
salary, password resets, TC issuance, impersonation) attaches a session token on every call;
`auth_service.dart` (role-mismatch guard, tokenless-session guard, server-side sign-out
revocation) clean; `s3_upload_service.dart`'s POST path correctly uses a body field (only the GET
path, F10.3, doesn't); `kiosk_pin_service.dart` clean.

**Coverage gap:** `face_recognition_service.dart` (598 lines), `diagnostic_logger.dart`,
`native_ui_service.dart`, `pdf_reports_service.dart`, most of `core/utils/` and `common/
widgets/` (beyond a `TextEditingController` grep) were grep-checked, not read line-by-line.

---

## Cross-cutting patterns worth noting

1. **The "RPC with no session-token param" bug class recurs independently at least 3 times**
   (`get_student_fees` F8.1, `record_check_out` F9.1, `employee_shifts`'s direct read F10.1,
   `daily_task_targets` F10.2) across 3 different forks that never saw each other's work — this
   is the single most important theme of this audit. The Category 3 RPC-migration sweep this
   project already did for `exam_marks`/`student_attendance`/`homework`/etc. evidently didn't
   reach every table that should have gotten the same treatment. **Recommend: before fixing
   each one individually, do one more targeted sweep of every remaining direct-anon-read call
   site across the whole mobile codebase** (both `supabase_service.dart` and `staff_admin_
   service.dart`) rather than assuming these 4 are the only ones — this audit's 10 passes each
   covered a bounded slice and a table reached from two different functions in two different
   files could still be missed by both.
2. **The "hardcoded employee name instead of the real caller" bug recurs in 2 independent files**
   (`super-admin.js` SalaryPanel, `employee.js`'s salary flow) — same root cause, same fix.
3. **The "broken because a table's direct access was revoked and this caller was never
   migrated" bug recurs in 2 independent files** (`employee.js`'s Generate Salary, `reportService
   .js`'s salary report) — both stemming from the same `SUPABASE_SALARY_PUNCHCODE_ROLE_
   ENFORCEMENT.sql` migration, both silently swallowed by a generic error handler instead of
   surfacing clearly, which is likely why neither was caught sooner.
4. **The "missing try/catch on an async load" (REQ-BUG-069) and "undisposed TextEditingController
   in an ad-hoc dialog" (REQ-BUG-083) bug classes are each fixed correctly in SOME files and
   simply never swept across the rest** — both classes recur across teacher core (13 + 5 files)
   and the admin workspace (controller gap in ~20 files). Worth considering a lint rule or a
   repo-wide sweep rather than fixing file-by-file forever.
5. **A real-looking web-vs-mobile parity gap**: REQ-SEC-030 (TC role gate) and this project's own
   established pattern of fixing something on one surface (web) without checking the mobile
   equivalent has now caused a real regression (F7.1) — worth checking whether any other recent
   web-only security fix has an un-mirrored mobile counterpart.

---

## What's next

Per the user's instruction, this document is the complete note-down; no fixes have been applied
yet. The next step is executing fixes — prioritized by the severity table above, Critical first.
