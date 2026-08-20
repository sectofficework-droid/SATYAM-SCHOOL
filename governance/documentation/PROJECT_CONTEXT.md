# PROJECT CONTEXT — Satyam Stars International School ERP

> **As of:** 17 August 2026 (commit `1e45848`)
> **Branch:** main
> **Working directory:** `D:\Project\SSIS SCHOOL\SATYAM-SCHOOL` (repo root — contains `admin-panel/` and `mobile-app/`)

---

## Project Overview

A two-app system for **Satyam Stars International School**, Surat, Gujarat (GSEB Board, English Medium), plus a second organization, **Satyam Education Foundation (SEF)**, now sharing the same admin panel:

1. **`admin-panel/`** — Next.js 14 App Router web app. School management ERP (students, fees, staff, inventory, GR Book, syllabus, exams, question papers, etc.) plus a lighter SEF (tuition-org) module set.
2. **`mobile-app/`** — a single Flutter codebase built as **three separate apps**: a Teacher app, a Student app, and a face-scan Attendance kiosk app, each its own Play Store listing.

**Backend status:** Supabase is connected end-to-end for both the admin panel and the mobile apps (same Supabase project, `https://hxkowdaugkkumvzyfsai.supabase.co`). Admin-panel auth is real Supabase Auth (`admin_users` role table); mobile-app auth is custom SECURITY DEFINER RPCs (`teacher_login`/`student_login`), not Supabase Auth sessions. File/photo storage is AWS S3 for both — admin panel via presigned URLs, mobile apps via direct public bucket URLs.

**Scale:** ~1,000+ students, 50+ staff, 15 classes (JR KG → 12th Commerce).

---

## Tech Stack — Admin Panel (`admin-panel/`)

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.35 (React 18, App Router) |
| Language | **JavaScript only — no TypeScript** |
| Styling | Tailwind CSS 3.4.1 + custom school brand colors |
| Icons | Lucide React |
| State | Zustand 5 (with localStorage persist) |
| Forms | React Hook Form 7 + Zod 4 |
| Database | **Supabase (connected)** — `https://hxkowdaugkkumvzyfsai.supabase.co` |
| Auth | **Supabase Auth (connected)** — `signInWithPassword` + `admin_users` role table, PKCE flow, invite/reset via `/auth/callback` + `/auth/set-password` |
| File Storage | **AWS S3 (connected)** — presigned PUT/GET URLs via Next.js API routes; server-side client in `src/lib/s3.js`; browser never touches AWS credentials |
| Payments (pending) | Razorpay (package installed, not connected) |
| Export | XLSX (Excel), jsPDF + jspdf-autotable, and **pdf-lib** (report exports rewritten onto pdf-lib for exact-fit tables) |
| Charts | Recharts 3 |
| Notifications | Sonner (toasts); no FCM/push — see Mobile App section |
| Dev Server | Custom `scripts/dev-start.js` (run via `npm run dev`) |

**Brand colors:** `school-navy` (#1e3a5f), `school-gold` (#f59e0b)

**Supabase client:** `src/lib/supabase.js` — singleton browser client, PKCE flow. `@supabase/ssr` is installed but still not used — no server-side/service-role client anywhere.

**Service layer (`src/lib/*Service.js`):** one file per module — see **File Size Reference** for the full current list.

---

## Tech Stack — Mobile App (`mobile-app/`)

**Status: Live** — built from scratch since the last snapshot; didn't exist in the June baseline.

**Architecture:** one Flutter codebase, **three build flavors**, not three repos:

| Flavor | Application ID | Label | Entry point |
|---|---|---|---|
| `teacher` | `com.satyamstars.teacher` | Teacher App - Satyam School | `lib/main_teacher.dart` |
| `student` | `com.satyamstars.student` | SATYAM SCHOOL | `lib/main_student.dart` |
| `attendance` | `com.satyamstars.attendance` | Staff Attendance | `lib/main_attendance.dart` |

All three entrypoints call shared `lib/app_bootstrap.dart::runSatyamApp(role, pages)`. Gradle product flavors (`flavorDimensions += "role"` in `android/app/build.gradle.kts`) build each as a distinct Play Store package. `lib/main.dart` is a fallback that delegates to teacher.

**Code layout:** `lib/app/modules/{student,teacher,attendance_kiosk,auth,splash}/`, `lib/app/routes/app_pages_{student,teacher,attendance}.dart`, `lib/core/` (services/theme/utils), `lib/common/widgets/` (shared UI incl. `s3_image.dart`).

**Backend access:** Flutter talks to Supabase **directly** — `supabase_flutter: ^2.5.6`, same Supabase project as the admin panel — not through the Next.js API. A Vercel `adminPanelUrl` constant exists in `app_bootstrap.dart` but is unused (dead/reserved). Auth is custom SECURITY DEFINER RPCs (`teacher_login`/`student_login`, defined in `mobile-app/SUPABASE_APP_AUTH.sql`), which check an `app_password` column added directly to `employees`/`students` — there is no separate `mobile_users` table and no real Supabase Auth session on mobile.

**S3 photos:** direct public bucket URL, no presigning — `lib/common/widgets/s3_image.dart` builds `https://satyam-stars-international-school.s3.ap-south-1.amazonaws.com/{key}` and renders with plain `Image.network`. This is the end state of a long chain of CORS/photo-loading fixes; the bucket itself was made public-read rather than proxying bytes through the app.

**Key dependencies:** `get` (GetX — state, routing, DI), `supabase_flutter`, `flutter_secure_storage` + `shared_preferences` (session), `camera` + `google_mlkit_face_detection` + `tflite_flutter` + `image` (attendance kiosk), `pdf` + `printing` (question paper/assignment generation), `package_info_plus` (version check), `flutter_launcher_icons` (dev dep, per-flavor icon from `assets/images/school_logo.jpg`). **No push-notification package** — `firebase_messaging` is absent; in-app notifications only, via a `teacher_alerts` table and a notification bell.

**In-app update mechanism:** `lib/core/utils/app_update.dart::checkForAppUpdate()` — polls a Supabase `app_versions` table, compares against `PackageInfo.fromPlatform()`, prompts with release notes; "Update Now" opens the APK URL (hosted on the same public S3 bucket) via `url_launcher` — there's no Play Store auto-update. Supports a `force_update` flag (blocks dismissal) and a per-version, per-day dismiss cooldown via `SharedPreferences`.

### Student app modules
Dashboard, Attendance, Exams, Marks, Fees (fee status), Homework, Help Desk, Query (queries/suggestions), Notices, Official Results, Rules & Regulations, Syllabus, Timetable, Profile. Birthdays is a shared widget (`birthdays_view.dart` + celebration overlay), not its own module.

### Teacher app modules
Dashboard, Students (My Students / class overview), Attendance (class), My Attendance (own staff attendance), Homework, Marks, Exams, Official Exams, Question Bank (paper generator), Daily Tasks/Tasks, Leave (leave requests), Calendar (year planning, linked to the admin panel's Year Planning data), Notices, Query, Syllabus, Rules & Regulations, Timetable, Birthdays, Profile.

### Attendance kiosk app
One shared device at the school entrance (not per-user) for staff face-scan punch in/out. Fully on-device pipeline, no cloud ML calls: `camera` captures → `google_mlkit_face_detection` detects the face → `tflite_flutter` runs a bundled MobileFaceNet model (`assets/models/mobilefacenet.tflite`) for embedding match against enrolled staff faces. Screens: `kiosk_home_page.dart`, `face_enroll_login_page.dart`, `face_enroll_capture_page.dart` (staff registration), `face_punch_page.dart` (punch in/out).

---

## Supabase Schema

**`admin-panel/database/schema.sql`** (35 tables, `CREATE TABLE` count verified) — the original core school-management blueprint (students, fees, employees, timetable, notices, tasks). **Unchanged since the June baseline.** Still defines `users` (unused — real auth uses `admin_users`, which has no `CREATE TABLE` anywhere in the repo, created directly in Supabase) and `timetable_period_definitions`/`timetable_entries` (unused — the live table is `timetables`).

**`admin-panel/database/` also now has:**
- `sef_schema.sql` — `sef_students` (tuition students, own record, no class/section/enrollment system), `sef_fee_payments` (payment ledger)
- `sef_settings_schema.sql` — `sef_profile`, `sef_academic_years`, `sef_classes`, `sef_fee_structure`, `sef_fee_reminder_template`, `sef_rules`. Comment confirms SEF reuses the school's `admin_users` table for login rather than its own auth.
- `fix_class_names.sql` — one-off data migration (`JR KG` → `JR.KG` format)
- `seed_fees_inventory.sql` — empty, gutted

**Correction to prior framing:** most of the real schema growth since June did **not** happen in `admin-panel/database/` — it happened across **45 `SUPABASE_*.sql` files under `mobile-app/`**, written to support the new mobile apps and their admin-panel counterparts. Key ones:
- `SUPABASE_GR_BOOK.sql` (+ patches) — `gr_book_imports` and birth-field/prev-school-TC additions
- `SUPABASE_SYLLABUS.sql` / `_V2.sql` — `syllabus`, `syllabus_subtopics`, `syllabus_edit_requests`
- `SUPABASE_QUESTION_BANK.sql` / `_V2` / `_V3` — `question_bank`, `question_papers`, `question_paper_items`
- `SUPABASE_OFFICIAL_EXAMS.sql` (+ date-range patch) — `official_exams`, `official_exam_subject_config`, `official_exam_marks`
- `SUPABASE_TIMETABLES_TABLE.sql` — defines `timetables` as an explicit "safety net" (the table was created ad-hoc in Supabase before any file documented it)
- `SUPABASE_BIRTHDAYS.sql` / `SUPABASE_ALL_BIRTHDAYS.sql`
- `SUPABASE_HELPDESK.sql` — `helpdesk_admin_numbers`
- `SUPABASE_QUERIES_RULES.sql` — `queries_suggestions`, `school_rules`
- `SUPABASE_ATTENDANCE_NO_LEAVE.sql` / `_REQUESTS.sql` — `attendance_edit_requests`, `teacher_alerts`
- `SUPABASE_STAFF_LEAVE.sql` — `employee_attendance`, `leave_requests`
- `SUPABASE_DAILY_TASKS.sql`
- `SUPABASE_APP_AUTH.sql` — adds `app_password` to `employees`/`students`, plus `teacher_login`/`student_login` RPCs
- `SUPABASE_SECURITY_AUDIT.sql` — an ad-hoc query to check live RLS/grant state, implying the current RLS picture is not fully trusted

**RLS — correction, no longer uniformly off.** Every new mobile-app table explicitly `DISABLE ROW LEVEL SECURITY`. But `students` and `employees` still have RLS **enabled** with the original `auth.uid()`-based policies from initial setup — now effectively moot since mobile login uses custom RPCs, not real Supabase Auth sessions, but never cleaned up.

**Class name format note (unchanged):** DB stores "JR.KG" / "SR.KG" / "11th - Commerce" / "12th - Commerce"; conversion via `DB_TO_STORE` map in `settings/page.js`.

**Drift is still unreconciled** — same two gaps as before (`users` vs `admin_users`, `timetable_period_definitions`/`timetable_entries` vs `timetables`), no migration/cleanup has happened.

---

## Route Map — Admin Panel

```
/login                        ← Supabase Auth
/auth/callback  /auth/set-password
/dashboard                    ← KPIs, charts, notices, activity feed, birthdays widget
/student, /student/add, /student/[id], /student/[id]/edit, /student/[id]/tc
/gr-book                      ← Digital GR (General Register) — import, edit, document uploads
/attendance                   ← Class/date attendance marking, history, absentee notify
/syllabus                     ← Chapter/subtopic tracking per class-subject
/fees                         ← Fee structure, collection, reminders
/employee                     ← Staff profiles, attendance, salary
/inventory                    ← Stock, assets, distribution
/expenses
/notice                       ← Notice board
/queries                      ← Queries & Suggestions inbox (reply/resolve/reopen) — effectively the "help desk"
/report                       ← All reports, PDF (pdf-lib) + Excel export (~1,554 lines)
/documents                    ← Student document viewer (S3) + Marksheet/Official-Exam document generation (~1,813 lines)
/question-papers              ← Question Bank: pick Class → Subject → chapters, assemble/export paper
/tasks                        ← Task management
/settings                     ← 12 tabs — see Module Status §10
/super-admin                  ← Grouped management modules — see Module Status §11
/sef/dashboard  /sef/student  /sef/fees  /sef/settings   ← SEF org, parallel to school routes
/api/s3/upload-url  /api/s3/view-url
```

Exams, Timetable, Rules & Regulations, and App Update are **Settings tabs**, not standalone routes.

---

## Module Status — Admin Panel

### 1. Authentication — `/login`, `/auth/callback`, `/auth/set-password`
**Status: Complete.** Unchanged from before — Supabase Auth + `admin_users` lookup, `AuthGuard.jsx` gate, roles `management`/`senior_admin`/`normal_admin`.

**New: idle auto-logout.** `AuthGuard.jsx` — `IDLE_LIMIT_SECONDS = 15 * 60`; tracks activity across mouse/keyboard/touch/scroll (scroll listener uses capture phase since it doesn't bubble); signs out via `supabase.auth.signOut()` when the timer hits 0. `src/lib/idleTimerContext.js` provides `useIdleTimer()`. Header shows a live MM:SS countdown pill with a tooltip.

---

### 2. Dashboard — `/dashboard`
**Status: Live** (`dashboardService.js`, 147 lines). Now also shows a birthdays widget. No other significant change.

---

### 3. Student Management — `/student/*`
**Status: Live** (`studentService.js`, now **876 lines**, up from 661). Core CRUD unchanged; grown to support GR Book linkage, more government-ID fields, and richer import validation.

---

### 4. GR Book — `/gr-book` *(new)*
**Status: Live** (`grBookService.js`, 239 lines). Digital General Register: import/edit GR entries, Excel/PDF export, spreadsheet-style full register view, Active/Left status, required Previous-School-TC document field, Place of Birth split into Village/City/District/State.

---

### 5. Syllabus — `/syllabus` *(new)*
**Status: Live** (`syllabusService.js`, 157 lines). Chapter + subtopic tracking per class-subject, lock + admin-approval editing flow, teacher-facing "Mine / Class Overview" split, subject dropdown, its own icon (previously shared Question Bank's).

---

### 6. Question Papers / Question Bank — `/question-papers` *(new)*
**Status: Live** (`questionBankService.js`, 86 lines). Pick Class → Subject → chapters (changed from starting-with-teacher), assembles and exports a paper; teacher app has the paper-generator UI, admin panel has the class/subject picker and bank management.

---

### 7. Documents — `/documents` *(new)*
**Status: Live** (~1,813 lines). Student document viewer (S3-backed) plus Marksheet generation (`marksheetService.js`, 213 lines) and Official Exam document generation (`examService.js`, 160 lines).

---

### 8. Fees — `/fees`
**Status: Live** (`feesService.js`, 214 lines). Unchanged core behavior — per-student summary, payment CRUD, inventory-given/pending sync.

---

### 9. Employee Management — `/employee`
**Status: Live** (`employeeService.js`, 81 lines). Unchanged core; **Staff Leave** (`staffLeaveService.js`, 106 lines) and day-by-day staff attendance (via mobile "My Attendance" + admin panel) added as related but separate concerns.

---

### 10. Inventory — `/inventory`
**Status: Live** (`inventoryService.js`, 203 lines). No significant change.

---

### 11. Expenses — `/expenses`
**Status: Live** (`expensesService.js`, 62 lines). No significant change.

---

### 12. Notice Board — `/notice`
**Status: Live** (`noticeService.js`, 78 lines). No significant change.

---

### 13. Queries & Suggestions — `/queries` *(new — the "help desk")*
**Status: Live** (`queryService.js`, 38 lines). Admin review UI for queries/suggestions submitted from the student/teacher apps' Help Desk and Query modules.

---

### 14. Report — `/report`
**Status: Live, read-only** (`reportService.js`, 375 lines; page ~1,554 lines). PDF export rewritten from jsPDF/autoTable onto **pdf-lib** for exact-fit tables (no text wrapping, no overflow); added TC Issued Details, GR/UDISE/PEN/APAAR report sections.

---

### 15. Settings — `/settings`
**Status: Live — 12 tabs** (up from 8): School Profile, Academic Year, Fee Structure, Classes & Sections, Subjects, **Exams** *(new)*, Timetable, Year Planning, Fee Reminders, Users & Roles, **Rules & Regulations** *(new, split into Student/Teacher sections)*, **App Update** *(new)*. Several tabs extracted into their own files: `ExamsTab.js`, `RulesRegulationsTab.js`, `UsersRolesTab.js` (now shared between school and SEF settings — importing one route's `page.js` from another hangs Next.js's dev compiler indefinitely, which is why this was extracted), `YearPlanningTab.js`, `AppUpdateTab.js`. `settings/page.js` itself is now ~110KB holding the remaining tabs inline (incl. Timetable).

**`/sef/settings` — new, 7 tabs:** Institute Profile, Academic Year, Fee Structure, Classes & Section, Fee Reminder, Users & Roles, Rules & Regulations — simpler SEF-only versions (no class-promotion dates, no per-class-per-session fee matrix, one fee reminder template instead of three languages).

---

### 16. Super Admin — `/super-admin`
**Status: Live — grouped `MGMT_MODULES`:**
- **Student Records** — sub-tabs: Spreadsheet Edit, Single Student Update, Pending IDs, Import Students
- **Fees Management**
- **Inventory**
- **Employee**
- **Salary** (management-head-only; auto-generates monthly salary expense entries)

Plus `PendingDetailsPanel` (flags/fills missing government ID fields) and `ImportStudentsPanel` (bulk import).

---

### 17. Tasks — `/tasks`
**Status: Live** (`taskService.js`, 150 lines). Related: `dailyTaskService.js` (142 lines) backs the mobile apps' Daily Tasks module.

---

### 18. SEF (Satyam Education Foundation) — `/sef/*` *(new — second org, "Phase 1")*

A second organization sharing the same admin panel and login. Header has an org switcher (School ↔ SEF); Zustand `activeOrg` drives it; `Sidebar.jsx` filters `navItems` by an `orgs: ["school" | "sef"]` tag per item.

- **SEF nav (4 items):** Dashboard, Student, Fees, Setting — vs. school's 15 items. A comment in `Sidebar.jsx` explicitly marks this as **Phase 1**: everything else stays school-only until a SEF counterpart is built, to avoid a sidebar full of dead links.
- **Services:** `sefStudentService.js` (67 lines), `sefFeesService.js` (51 lines), `sefSettingsService.js` (119 lines).
- **Data model:** SEF students have their own record type (`sef_students`) with no class/section/enrollment system like the school. Student's "Std" field is a dropdown sourced from SEF's Classes & Section settings tab (falls back to free text if empty) and prefills Monthly Fee from SEF's Fee Structure tab.
- **Auth:** SEF reuses the school's `admin_users` table — same shared admin-panel login for both orgs, no separate SEF auth.

---

## Shared Utilities

| File | Purpose |
|---|---|
| `src/lib/constants.js` | `DEFAULT_DOCS` — required document names |
| `src/lib/utils.js` | `cn()`, `fmtDMY()` |
| `src/lib/validators.js` | Form validation helpers |
| `src/lib/pdfTableExport.js` (170 lines) | Shared pdf-lib table export logic used by Report and other PDF exports |
| `src/lib/yearPlanData.js` (177 lines) | Year Planning seed/reference data |
| `src/lib/idleTimerContext.js` (8 lines) | Idle-logout countdown context/hook |
| `src/lib/calendarService.js` (62 lines) | Year Planning data, linked to teacher app's Calendar module |
| `src/lib/appUpdateService.js` (36 lines) | Backs Settings → App Update tab and mobile in-app update checks |

---

## Global State (Zustand — `src/lib/store.js`, ~211 lines)

Same shape/role as before: `authUser`, `activeOrg` *(new — School/SEF toggle)*, `employeeSalaries`, `rolePermissions`, `feeReminderTemplates`, `yearPlanEvents`, `studentInventoryItems`, `periodDefs`/`timeSlots`, `sessionFeesStructure`, `uniformFees`, `oldStudentDiscount`, `sidebarOpen`, `readmissionDate`, `activeClasses`, `pendingTasks`.

---

## Key Decisions Made

| Decision | Rationale |
|---|---|
| JavaScript only (no TypeScript), admin panel | Project requirement |
| Flutter for mobile, one codebase / three flavors | Teacher, Student, and Attendance kiosk share code/design but need separate Play Store listings and app icons |
| GetX for mobile state/routing/DI | Lightweight, minimal boilerplate for a small team |
| Mobile apps hit Supabase directly, not the admin-panel API | Avoids building/maintaining a separate mobile API surface; same Supabase project as the web app |
| Mobile auth via custom SECURITY DEFINER RPCs, not Supabase Auth | Simpler login flow (enrollment ID / employee ID + password) suited to students/staff who won't manage email-based accounts |
| Public S3 bucket + direct URLs for mobile photos | Presigned-URL round-trips caused persistent CORS/loading failures on Flutter Web/mobile; public-read bucket policy resolved it |
| On-device face match for the attendance kiosk (tflite, no cloud ML) | Single fixed entrance device; avoids network dependency and per-scan cloud cost |
| In-app APK update prompts instead of Play Store auto-update | Simpler distribution/versioning while apps are still evolving fast |
| AWS S3 for admin-panel file storage (not Supabase Storage) | Presigned URLs keep AWS credentials server-side only |
| Store S3 key, not URL, in DB | Presigned URLs expire; keys are permanent |
| `UsersRolesTab` extracted to its own file, shared by school + SEF settings | Importing one route's `page.js` from another hangs Next.js's dev compiler indefinitely |
| SEF reuses `admin_users` for login | One shared admin-panel login for both orgs; no separate SEF auth system |
| SEF scoped to Phase 1 (Dashboard/Student/Fees/Settings only) | Avoids a sidebar full of dead links before the rest of SEF's modules exist |
| pdf-lib for Report PDF export (replacing jsPDF/autoTable) | Exact-fit table cells, no wrapping/overflow bugs that plagued the jsPDF version |
| 15-minute idle auto-logout | Security — admin panel handles sensitive student/financial data |
| `schema.sql` is a historical blueprint; most new schema lives in `mobile-app/SUPABASE_*.sql` | Ad-hoc per-feature files were faster to iterate than keeping one central schema current |
| RLS disabled on new tables; `students`/`employees` RLS left enabled but stale | Original policies assumed real Supabase Auth sessions, which mobile no longer uses; never cleaned up |
| One service file per module | Keeps Supabase query logic out of page components |

---

## Constraints & Rules (DO NOT VIOLATE)

1. **Never run `npx next build`** during development — corrupts `.next` cache and breaks all CSS.
2. **Never use PowerShell `Out-File` or `Set-Content`** on JS/JSX files — adds UTF-8 BOM and breaks Next.js CSS loading. Always use the `Write` tool instead.
3. **No TypeScript** in `admin-panel/` — all new files must be `.js`/`.jsx`.
4. **Dev server:** always start with `npm run dev` (uses `scripts/dev-start.js`), not `next dev` directly.
5. **Mobile builds:** build a specific app with `flutter build apk -t lib/main_<role>.dart --flavor <role>` (`teacher`/`student`/`attendance`) — a plain `flutter run` without `-t`/`--flavor` launches the fallback `main.dart`, not the intended app.

---

## DB Integration Progress

| Area | Status |
|---|---|
| Authentication (admin panel) | ✅ Live — Supabase Auth + `admin_users` + PKCE invite/reset |
| Authentication (mobile) | ✅ Live — custom `teacher_login`/`student_login` RPCs against `app_password` on `employees`/`students` |
| Settings — School Profile, Academic Year, Fee Structure, Classes & Sections, Subjects | ✅ Live |
| Settings — Exams, Timetable | ✅ Live (Timetable via `timetables` table — schema drift, see above) |
| Settings — Year Planning / Fee Reminders / Role Permissions matrix | ⏳ Pending — Zustand-only |
| Settings — Users & Roles (`admin_users`) | ◐ Partial — edit/delete live, create not wired |
| Settings — App Update | ✅ Live — drives mobile in-app update prompts |
| Dashboard, Student, Fees, Inventory, Expenses, Notice, Tasks | ✅ Live |
| GR Book, Syllabus, Question Bank, Documents (Marksheet/Official Exams), Queries & Suggestions, Staff Leave, Daily Tasks | ✅ Live — all new since June baseline |
| Employee | ◐ Partial — CRUD + salary payments live; base salary amounts Zustand-only |
| Report | ✅ Live (read-only) |
| Super Admin | ✅ Live |
| SEF — Dashboard, Student, Fees, Settings | ✅ Live (Phase 1 scope only) |

---

## What Is NOT Yet Built

| Item | Notes |
|---|---|
| Razorpay payment flow | Package installed, still no integration code |
| Real push notifications (FCM) | Still no push package/table in the mobile app; in-app-only via `teacher_alerts` table + notification bell |
| Real-time notifications | No WebSocket / Supabase Realtime; mobile "notifications" are polling-based |
| Employee base salary in DB | `employee_salaries` table exists, unused; `employeeSalaries` still Zustand-only |
| Year Planning / Fee Reminder templates / Role Permissions persistence | Tables exist, unused |
| Admin-user creation UI | Settings → Users & Roles only edits/deletes |
| Schema drift cleanup | `users` (unused) vs `admin_users` (live, no `CREATE TABLE` in repo); `timetable_period_definitions`/`timetable_entries` (unused) vs `timetables` (live, backfilled by `SUPABASE_TIMETABLES_TABLE.sql`) |
| `students`/`employees` RLS cleanup | Still enabled with stale `auth.uid()` policies that assume a Supabase Auth session mobile no longer creates |
| Dedicated parent portal | Not started as a distinct product, but the **Student app now covers most of what a parent portal would** (fees, attendance, marks, homework, notices) — worth reconsidering whether a separate portal is still needed |
| SMS/WhatsApp delivery | Fee reminder text ready, no send mechanism |
| SEF Phase 2 | GR Book, Attendance, Syllabus, Employee, Inventory, Expenses, Notice Board, Question Papers, Tasks, Super Admin — all still school-only |

---

## File Size Reference (current, `wc -l`)

### Admin panel — services (`src/lib/*Service.js`)
| File | Lines |
|---|---|
| `studentService.js` | 876 |
| `reportService.js` | 375 |
| `settingsService.js` | 365 |
| `grBookService.js` | 239 |
| `feesService.js` | 214 |
| `marksheetService.js` | 213 |
| `inventoryService.js` | 203 |
| `examService.js` | 160 |
| `syllabusService.js` | 157 |
| `taskService.js` | 150 |
| `attendanceService.js` | 149 |
| `dashboardService.js` | 147 |
| `dailyTaskService.js` | 142 |
| `sefSettingsService.js` | 119 |
| `staffLeaveService.js` | 106 |
| `questionBankService.js` | 86 |
| `employeeService.js` | 81 |
| `noticeService.js` | 78 |
| `sefStudentService.js` | 67 |
| `expensesService.js` | 62 |
| `calendarService.js` | 62 |
| `sefFeesService.js` | 51 |
| `queryService.js` | 38 |
| `appUpdateService.js` | 36 |

### Admin panel — large pages
| File | Approx. lines | Purpose |
|---|---|---|
| `src/app/(dashboard)/documents/page.js` | ~1,813 | Document viewer + Marksheet/Official Exam generation |
| `src/app/(dashboard)/report/page.js` | ~1,554 | All reports, pdf-lib export |
| `src/app/(dashboard)/super-admin/page.js` | ~2,511 | Grouped `MGMT_MODULES` panels |
| `src/app/(dashboard)/settings/page.js` | ~110KB | Remaining inline tabs (Timetable, etc.) |
| `src/app/(dashboard)/sef/settings/page.js` | ~21KB (431 lines) | All 7 SEF settings tabs, inline |
| `src/app/(dashboard)/employee/page.js` | ~1,473 | Employee CRUD + attendance + salary + S3 upload |
| `src/app/(dashboard)/fees/page.js` | ~1,297 | Fee management |
| `src/app/(dashboard)/inventory/page.js` | ~1,234 | Inventory & assets |
| `src/app/(dashboard)/student/page.js` | ~1,249 | Student list |

---

## Git History Summary (recent highlights, newest first)

| Commit | Work Done |
|---|---|
| `1e45848` | SEF Settings (7 tabs); `UsersRolesTab` extracted to a shared file |
| `d3080d7` | School/SEF org toggle moved into the header |
| `093a9d1` | SEF Phase 1: org switcher + Dashboard/Student/Fees |
| `72405ca` | Question Papers: pick Class then Subject instead of a teacher first |
| `052f46f`–`23731b0` | Attendance kiosk polish: own icon/name, real error surfacing on capture/camera-init failures |
| `2ab10a1` | Face-scan staff attendance kiosk app added; syllabus subject dropdown |
| `02cd719` | Staff leave requests + day-by-day staff attendance; working-day/holiday rule for student attendance |
| `cd9b570`–`6d48d44` | Birthdays module added (student/teacher/admin), then reworked into a scrollable list + celebration animation |
| `947c13b`–`112b74b` | Timetable module added to student/teacher apps, sync fixes |
| `92a10ca` | Syllabus subtopics, lock + admin-approval editing |
| `791a740` | Exams & Marks merged into one module (Monthly Test / Main Exams) |
| `09e0ebe`–`2197e35` | Idle auto-logout added, extended to 15 min, styled |
| `b20422e` | Mobile app split into separate Teacher and Student Play Store apps |
| `522ece1`–`ecd6f03` | Digital GR Book added to admin panel, iterated (Excel/PDF export, document workflow) |
| `1270b91`–`9cb2969` | Question Bank + Auto Exam/Assignment Paper Generator added |
| `2d50710`–`e08d998` | Official Exams module added; Marksheet generation rewired to use it |
| `bb8c2ba` | Marksheet generator added to Documents module |
| `0f5d956`–`2911bb2` | Query/Suggestion + Rules & Regulations modules added (teacher + student), admin review UI |
| `f8feb92` | Help Desk module added to student app |
| `82b9894`–`3e02130` | Flutter mobile app scaffolded from nothing — auth, dashboards, S3 photo support |
| `06d961a` | *(prior snapshot baseline — 27 June 2026)* |

*(Full history: `git log --oneline` — 243 commits since the prior baseline.)*

---

## Next Integration Steps (in priority order)

1. **Schema drift cleanup** — reconcile `schema.sql` with the live DB and the 45 `mobile-app/SUPABASE_*.sql` files; retire the unused `users` table; formalize `admin_users` and `timetables` with real `CREATE TABLE` statements in-repo
2. **RLS cleanup** — resolve `students`/`employees` still having enabled-but-stale `auth.uid()` policies now that mobile auth doesn't use Supabase Auth sessions; run/act on `SUPABASE_SECURITY_AUDIT.sql`
3. **SEF Phase 2** — build SEF counterparts for GR Book, Attendance, Syllabus, Employee, Inventory, Expenses, Notice Board, Question Papers, Tasks, Super Admin
4. **Razorpay** — connect payment flow for fee collection
5. **Real push notifications (FCM)** — replace the in-app-only `teacher_alerts` bell with real device push
6. **Migrate remaining Zustand-only config to DB** — `employeeSalaries`, Year Planning, Fee Reminder templates, Role Permissions matrix
7. **Admin-user creation UI** — let Settings → Users & Roles create new `admin_users` rows
8. **SMS/WhatsApp delivery** — fee reminder send mechanism
9. **Re-evaluate the parent portal** — the Student app already covers most of that need; decide if a separate portal is still worth building
