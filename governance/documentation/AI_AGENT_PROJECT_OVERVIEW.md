# SATYAM-SCHOOL — Full Project Overview for AI Agents

> **Purpose of this document:** a single, self-contained briefing for any AI agent (Claude, GPT,
> Gemini, or a human developer) that needs to understand this entire product — what it is, who
> uses it, every feature in both apps, the architecture, the data model, what's broken, what's
> missing, and what's being worked on — well enough to **suggest new features or run a product/
> security audit** without reading the rest of the repo first.
>
> This is a *product/feature* briefing, not the AI-governance process doc. For repo rules, approval
> gates, and session-logging conventions, see `AGENTS.md` (repo root) and `governance/RULEBOOK.md`.
> For the deepest technical reference (route maps, file sizes, git history), see
> `governance/documentation/PROJECT_CONTEXT.md`. For the live bug/security backlog, see
> `governance/planning/TODO.md`. This document synthesizes all of those into one place, current as
> of **2026-09-18**.

---

## 1. What this project is

**Satyam Stars International School** (Surat, Gujarat, India — GSEB board, English medium,
~1,000+ students, 50+ staff, 15 classes from JR KG to 12th Commerce) runs a custom-built,
in-house **school ERP + mobile app system**, plus a second smaller organization,
**Satyam Education Foundation (SEF)**, that shares the same admin panel and login.

It is a **real, live production system with real users today** — not a prototype. One person
(the project owner) commissions changes feature-by-feature; there is no separate QA team,
no automated test suite, and changes generally ship straight to production after manual
verification.

The system is two applications sharing one Supabase backend:

| App | What it is | Who uses it |
|---|---|---|
| **Admin Panel** (`admin-panel/`) | Next.js 14 web ERP | School office staff / management (desktop/laptop browser) |
| **Mobile App** (`mobile-app/`) | One Flutter codebase, built as **3 separate Android apps** | Teachers, Students/Parents, and one dedicated attendance-kiosk device |

---

## 2. System architecture at a glance

```
                         ┌─────────────────────────┐
                         │   Supabase (Postgres)    │   hxkowdaugkkumvzyfsai.supabase.co
                         │  - DB, Auth, RPCs, RLS   │   ONE shared project for everything
                         └───────────┬─────────────┘
                     ┌───────────────┼────────────────────┐
                     │               │                    │
        ┌────────────▼───────┐  ┌────▼──────────┐  ┌──────▼───────────────┐
        │   Admin Panel        │  │  Teacher App   │  │  Student App          │
        │   (Next.js, Vercel)  │  │  (Flutter APK) │  │  (Flutter APK)        │
        │   Real Supabase Auth │  │  custom RPC    │  │  custom RPC login     │
        │   (admin_users)      │  │  login (anon)  │  │  (anon)               │
        └───────────┬───────────┘  └────────────────┘  └───────────────────────┘
                     │                                   ┌───────────────────────┐
                     │                                   │  Attendance Kiosk App  │
                     │                                   │  (Flutter APK, 1 device)│
                     │                                   │  on-device face match  │
                     │                                   └───────────────────────┘
                     │
              ┌──────▼──────┐
              │   AWS S3     │  photos/documents — admin panel via presigned URLs;
              │  (2 trust    │  mobile apps via a public-read bucket + plain URLs
              │   models)    │
              └─────────────┘
```

Key architectural facts an agent should internalize immediately:

- **One Supabase project backs everything** — admin panel and all three mobile apps read/write
  the same tables.
- **Two completely different auth systems on the same DB.** The admin panel uses real Supabase
  Auth (`admin_users` table, PKCE, `authenticated` Postgres role). The three mobile apps use
  **custom SECURITY DEFINER RPCs** (`teacher_login`, `student_login`) that check an `app_password`
  column on `employees`/`students` directly — no Supabase Auth session is ever created on mobile,
  so **every mobile request hits Postgres as the `anon` role**, forever. This single fact is the
  root cause of most of the project's security backlog (see §8) and is the single most important
  thing to know before proposing any backend change.
- **No central migration tool.** Schema lives in one stale blueprint
  (`admin-panel/database/schema.sql`, 35 tables, unchanged since June) plus **45+ hand-written
  `mobile-app/SUPABASE_*.sql` files**, applied ad hoc through the Supabase SQL Editor, in no
  enforced order. There is real, acknowledged drift between what's documented and what's live
  (see §7).
- **No automated tests, no CI, for either app.** All verification is manual, in-browser or
  on-device. This is a known, deliberately-accepted gap (not an oversight the owner is unaware of).
- **Two different file-storage trust models on the same S3 account**: admin panel uses
  presigned URLs (credentials never leave the server); mobile apps hit a public-read bucket with
  plain URLs (a deliberate tradeoff after repeated CORS failures, not an oversight).

---

## 3. Tech stack

### Admin Panel (`admin-panel/`)
| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.35, React 18, App Router |
| Language | **JavaScript only — no TypeScript anywhere, by hard rule** |
| Styling | Tailwind CSS 3.4.1 + custom brand colors (`school-navy` #1e3a5f, `school-gold` #f59e0b) |
| Icons | Lucide React |
| State | Zustand 5 (+ localStorage persist for config not yet migrated to the DB) |
| Forms | React Hook Form 7 + Zod 4 |
| Backend | Supabase (Postgres + Auth), real `signInWithPassword` + `admin_users` role table, PKCE |
| File storage | AWS S3 via presigned PUT/GET URLs, server-side only (`src/lib/s3.js`) |
| Payments | Razorpay **installed, not integrated** |
| Export | XLSX, jsPDF + jspdf-autotable (legacy), **pdf-lib** (current, exact-fit report tables) |
| Charts | Recharts 3 |
| Notifications | Sonner (toast only) — no push, no realtime |
| Hosting | Vercel, tracks `main` branch |
| Tests / CI | **None** |

### Mobile App (`mobile-app/`) — one Flutter codebase, 3 build flavors
| Layer | Choice |
|---|---|
| Framework | Flutter 3.47.4 / Dart 3.13.3 |
| State / routing / DI | GetX |
| Backend access | `supabase_flutter` — **talks to Supabase directly**, not through the admin-panel API |
| Auth | Custom SECURITY DEFINER RPCs (`teacher_login`/`student_login`) against `app_password` (bcrypt-hashed) on `employees`/`students` — **not** Supabase Auth |
| Local session | `flutter_secure_storage` + `shared_preferences` |
| Photos | Direct public-read S3 bucket URL, plain `Image.network` (no presigning) |
| Attendance kiosk ML | `camera` + `google_mlkit_face_detection` + `tflite_flutter` running a bundled MobileFaceNet model, fully on-device, no cloud ML call |
| PDF generation | `pdf` + `printing` (question papers, assignments) |
| Push notifications | **None** — no `firebase_messaging`; in-app-only via a `teacher_alerts`/`student_alerts` table + notification bell (polling, not realtime) |
| Distribution | **APK via a public S3 bucket + in-app update checker** (`app_versions` table, `checkForAppUpdate()`), not Play Store auto-update. Teacher app additionally has a Play Store **closed testing** track in progress (see §10). |
| Tests / CI | **None** — only Flutter's unmodified default counter-app test exists |

**Three build flavors from one codebase** (`flavorDimensions += "role"` in
`android/app/build.gradle.kts`):

| Flavor | Application ID | Play Store display name | Entry point |
|---|---|---|---|
| `teacher` | `com.satyamstars.teacher` | Teacher App - Satyam School | `lib/main_teacher.dart` |
| `student` | `com.satyamstars.student` | SATYAM SCHOOL | `lib/main_student.dart` |
| `attendance` | `com.satyamstars.attendance` | Staff Attendance | `lib/main_attendance.dart` |

Always build/run with **both** `-t lib/main_<role>.dart` and `--flavor <role>` — a bare
`flutter run`/`flutter build` launches an unrelated fallback `lib/main.dart`.

---

## 4. Admin Panel — full feature list

Access is via `/login` (Supabase Auth) with three roles: **management**, **senior_admin**,
**normal_admin** (role-gating appears throughout — e.g. only senior_admin/management can toggle
diagnostic logging, download logs, or use impersonation). A 15-minute idle timer auto-logs-out any
session (`AuthGuard.jsx`).

| # | Module | Route | What it does |
|---|---|---|---|
| 1 | **Dashboard** | `/dashboard` | KPIs, charts, notices feed, activity feed, birthdays widget |
| 2 | **Student Management** | `/student/*` | Full CRUD, per-student profile, edit, Transfer Certificate (TC) generation, list/search/filter, bulk import tools (Basic Details + Replace Full Details), pending-government-ID flagging |
| 3 | **GR Book** (Digital General Register) | `/gr-book` | Import/edit GR entries, Excel/PDF export, spreadsheet-style full register, Active/Left status tracking, Previous-School-TC document requirement, structured Place-of-Birth fields |
| 4 | **Syllabus** | `/syllabus` | Chapter + subtopic tracking per class-subject; teacher-facing lock + admin-approval edit flow; "Mine / Class Overview" split for teachers |
| 5 | **Question Papers / Question Bank** | `/question-papers` | Build a shared bank of questions; pick Class → Subject → chapters to assemble and export an exam/assignment paper; teacher app has the generation UI, admin panel manages the bank |
| 6 | **Documents** | `/documents` | Student document viewer (S3-backed uploads), Marksheet generation, Official Exam document/ID-card generation (two card designs) |
| 7 | **Fees** | `/fees` | Per-student fee summary, payment recording, inventory-given/pending sync, bulk "Send Reminder" selection for unpaid students |
| 8 | **Employee Management** | `/employee` | Staff profiles, CRUD, photo upload (S3), day-by-day attendance view, salary payments |
| 9 | **Staff Leave** | (part of Employee area) | Leave request review, tied to mobile Teacher app's Leave module |
| 10 | **Inventory** | `/inventory` | Stock/asset tracking, batches, distribution to students |
| 11 | **Expenses** | `/expenses` | Expense tracking |
| 12 | **Notice Board** | `/notice` | Post/manage notices, surfaced on all mobile apps and the dashboard |
| 13 | **Queries & Suggestions** ("Help Desk") | `/queries` | Review/reply/resolve/reopen queries and suggestions submitted from the Student and Teacher apps |
| 14 | **Reports** | `/report` | Read-only cross-module reports: fees, employees, inventory, TC-issued, GR/UDISE/PEN/APAAR government IDs; PDF (pdf-lib, exact-fit) + Excel export |
| 15 | **Settings** | `/settings` (12 tabs) | School Profile, Academic Year, Fee Structure, Classes & Sections, Subjects, **Exams**, Timetable, **Year Planning** (calendar, feeds mobile Calendar), Fee Reminders (template text, no send mechanism yet), Users & Roles (edit/delete `admin_users` — no create UI yet), **Rules & Regulations** (Student/Teacher sections), **App Update** (drives the mobile in-app update prompt) |
| 16 | **Super Admin** | `/super-admin` | Grouped management tools: Student Records (Spreadsheet Edit, Single Student Update, Pending IDs, Import Students), Fees Management, Inventory, Employee, **Salary** (management-only, auto-generates monthly salary expense entries) |
| 17 | **Tasks** | `/tasks` | Task management; related `dailyTaskService` backs the mobile apps' Daily Tasks module |
| 18 | **Diagnostics** | `/diagnostics` | Centralized error/diagnostic log viewer (see §9) — senior_admin/management only for toggle & download |
| 19 | **Admin Access Code / Impersonation** | (Super Admin area) | Lets an admin generate a temporary access code so a teacher/student can be impersonated for support purposes — a real privilege-escalation bug was found and fixed in the same session this shipped |
| 20 | **SEF module set** | `/sef/dashboard`, `/sef/student`, `/sef/fees`, `/sef/settings` | A second, smaller organization (tuition foundation) sharing the same login (`admin_users`) and Supabase project. Deliberately scoped to **Phase 1** (Dashboard/Student/Fees/Settings only) — no class/section/enrollment system like the main school; simpler single fee-reminder template; own `sef_students`/`sef_fee_payments` tables. Everything else (GR Book, Attendance, Syllabus, Employee, Inventory, Expenses, Notice Board, Question Papers, Tasks, Super Admin) is **not yet built for SEF** — "Phase 2," not started. |

**Global org switcher:** header toggle between "School" and "SEF" (Zustand `activeOrg`), filters
the sidebar's nav items by an `orgs` tag per item.

---

## 5. Mobile Apps — full feature list

All three apps share one Flutter codebase and call Supabase directly. Shared building block:
`lib/app_bootstrap.dart::runSatyamApp(role, pages)`.

### 5.1 Student App (`com.satyamstars.student`, "SATYAM SCHOOL")
For students and their parents/guardians. School-issued login only, no public self-registration.

| Feature | Detail |
|---|---|
| Dashboard | Home overview |
| Attendance | View own attendance record |
| Exams / Marks | View exam marks and results (Monthly Test + Main Exams merged into one module) |
| Fees | **View-only** fee status — no in-app payment (Razorpay not connected anywhere in the system) |
| Homework | View homework assigned to their class, active/overdue status |
| Help Desk | Submit help requests |
| Query | Submit queries/suggestions to school administration (routed to admin panel's `/queries`) |
| Notices | Read school notices/announcements |
| Official Results | View official exam results/documents |
| Rules & Regulations | Student-specific rules section |
| Syllabus | Chapter-wise progress for their class |
| Timetable | View class timetable |
| Profile | View/manage own profile |
| Birthdays | Shared widget (not a standalone module) — scrollable list + celebration animation |
| Sibling switcher | Switch between sibling student records under one login |
| Password reset notice | In-app alert (`student_alerts` table) when admin resets their password |
| App update prompt | Polls `app_versions`, prompts to download a new APK from S3, supports forced updates |

### 5.2 Teacher App (`com.satyamstars.teacher`, "Teacher App - Satyam School")
For teaching staff. School-issued login only.

| Feature | Detail |
|---|---|
| Dashboard | Home overview |
| Students | "My Students" / class overview |
| Attendance (class) | Mark and review attendance for assigned classes, edit-request flow, working-day/holiday rules |
| My Attendance | Own staff attendance record (feeds the multi-shift attendance system, see §5.3) |
| Homework | Assign and track homework |
| Marks / Exams | Enter/manage exam marks (batch save, was a real data-loss bug — fixed, see §9) |
| Official Exams | Separate module for official/board-style exams |
| Question Bank | Build and reuse questions; generate exam/assignment papers (PDF via `pdf`+`printing`) |
| Daily Tasks / Tasks | Personal + class task lists |
| Leave | Submit and track leave requests |
| Calendar | Year planning calendar, linked live to the admin panel's Year Planning settings |
| Notices | Read school notices |
| Query | Raise/follow up queries with administration |
| Syllabus | Update chapter/subtopic status for subjects taught, subject to admin-approval lock |
| Rules & Regulations | Teacher-specific section |
| Timetable | View class timetables |
| Birthdays | Shared widget |
| Profile | View/manage profile — editing now **requires re-entering current password** (fixed a real zero-auth-check bug, see §9) |
| Admin Access Code login | Alternate login path using an admin-issued impersonation code |
| Password change/reset notices | `teacher_alerts` table |
| App update prompt | Same mechanism as Student app |

### 5.3 Attendance Kiosk App (`com.satyamstars.attendance`, "Staff Attendance")
A single physical device kept with the admin office (**not** an unsupervised public entrance
kiosk) for staff face-scan punch in/out.

| Piece | Detail |
|---|---|
| Pipeline | Fully on-device, no cloud ML call: `camera` captures → `google_mlkit_face_detection` detects the face → eye-landmark-based alignment → `tflite_flutter` runs a bundled MobileFaceNet model (`assets/models/mobilefacenet.tflite`) → embedding compared against enrolled staff |
| Matching | `match_face_embedding` Postgres RPC compares the live embedding against **one averaged centroid per enrolled person** (rewritten 2026-09-17 from a slower, less reliable "compare against every raw shot" approach) |
| Enrollment | PIN-gated (`admin_pin_dialog.dart` + `kiosk_pin_service.dart`, device-local secure storage, no backend) — only admin can open the enroll flow; captures 8–9 distinct shots per person (recently reduced from 22–25 to cut enrollment time) |
| Punching | Self-service — any staff member can scan to punch; a confirm dialog ("Is this you?" / "Not Me") is the real backstop against mis-identification |
| Multi-shift support | Wired end-to-end (kiosk/teacher/admin) as of 2026-09-09 |
| Known limitation | Face-match accuracy is a live, actively-tuned tradeoff (currently ~76% single-attempt genuine recognition at the current threshold, mitigated by the confirm step) — see §9 for the full accuracy story. **The architecture (phone camera + small on-device model) has an honest ceiling; it will not reach commercial/Face-ID-grade accuracy.** |

---

## 6. Cross-cutting product features (apply to more than one app)

- **In-app diagnostic/error logging** (`diagnostic_reports` table, `diagnostic_settings` kill
  switch, default **OFF**): both apps auto-capture unhandled errors when enabled, throttled
  (5-min cooldown, 20/session cap); mobile users can also manually "Report a Problem" for issues
  that don't throw (this manual path always works, regardless of the switch). Centralized viewer
  in the admin panel at `/diagnostics`. **This is a development/debugging tool, explicitly not a
  passive user-analytics system**, per the owner's stated intent.
- **In-app update mechanism** (mobile only): polls a Supabase `app_versions` table, compares
  against the installed version, prompts with release notes, supports a forced-update flag and a
  per-version dismiss cooldown. APKs are hosted on the same public S3 bucket used for photos.
- **Birthdays**: shared celebration widget across student/teacher/admin.
- **Notices**: posted once in the admin panel, read across both mobile apps.
- **Calendar / Year Planning**: authored once in admin Settings, consumed by the Teacher app's
  Calendar module.
- **Queries & Suggestions ("Help Desk")**: submitted from either mobile app, triaged in one admin
  inbox.

---

## 7. Data model notes an agent should know before proposing schema changes

- **No single schema-of-record.** `admin-panel/database/schema.sql` (35 tables) is a stale
  original blueprint. Real growth since lives across **45+ `mobile-app/SUPABASE_*.sql` files**,
  applied by hand through the Supabase SQL Editor, unordered. Always check
  `governance/documentation/PROJECT_CONTEXT.md` (or query Supabase directly via MCP) before
  assuming a table/column exists or doesn't.
- **Known, unresolved drift:**
  - `users` table exists in `schema.sql` but is **unused** — real admin auth uses `admin_users`,
    which has **no `CREATE TABLE` anywhere in the repo** (created directly in Supabase).
  - `timetable_period_definitions`/`timetable_entries` exist in `schema.sql` but are **unused** —
    the live table is `timetables` (defined later, ad hoc, in `SUPABASE_TIMETABLES_TABLE.sql`).
- **Class name format quirk:** DB stores class names like `"JR.KG"`, `"SR.KG"`,
  `"11th - Commerce"`; a `DB_TO_STORE` map in `settings/page.js` converts for display.
- **Fee amounts have a snapshot-vs-live-structure duality**: `enrollment.fee_total` is a one-time
  snapshot taken at admission, while Settings → Fee Structure can be edited at any time for the
  current year. This caused a real cross-page inconsistency bug (fixed 2026-09-04 by preferring
  the snapshot everywhere, falling back to live structure only for legacy zero-snapshot rows).
  **Any new fees/finance feature must respect this snapshot-first rule.**
- **RLS (Row-Level Security) is inconsistent by design-drift, not by plan**: some tables have it
  properly enabled with real policies (`students`, `admin_users`, `school_calendar_events` —
  fixed 2026-09-04), most mobile-facing tables have it **disabled** with broad `anon` grants
  (still open, see §8), and a few original tables have **stale** `auth.uid()`-based policies that
  don't match how mobile auth actually works anymore (custom RPC login, not real Supabase Auth
  sessions — so those policies are just dead weight, not a real protection).

---

## 8. Known security posture (do not treat as "already handled" — most of this is still open)

This is a real, evidence-based list — several items were **live-confirmed exploitable**
(unauthenticated reads/writes against production), not theoretical. Full detail:
`governance/planning/SECURITY-THREAT-MODEL.md`, `governance/planning/TODO.md`.

| ID | Issue | Status |
|---|---|---|
| REQ-SEC-001 | `app_password` stored/compared as plaintext | **Fixed 2026-08-21** — bcrypt hashing, admin panel now offers Reset-Password instead of View-Password |
| REQ-SEC-002 | `anon`-role over-exposure: RLS disabled + broad grants across mobile-facing and even some admin-only tables, no rate limiting anywhere | **Partially fixed.** `students`, `admin_users`, `school_calendar_events` locked down (2026-09-04). **Supabase's own live security advisor reports 73 tables project-wide still with RLS disabled** (corrected 2026-09-07 from an earlier ~25 estimate). `employees` specifically still fully `anon`-exposed (teacher profile screen reads/writes it with no real session) — blocked on an RPC rework. **Largest single open security item in the project.** |
| REQ-SEC-003 | Public S3 bucket for mobile photos (no presigning) | **Decided 2026-09-04: accepted as a deliberate tradeoff**, not fixed — closed on that decision |
| REQ-SEC-004 | `teacher_update_profile` RPC had zero identity/password check — anyone with a teacher's UUID could change their name/phone/email | **Fixed 2026-09-04** — now requires and verifies the current password, old no-password RPC overload dropped entirely |
| REQ-HYG-001/002 | No automated tests, no CI pipeline, for either app | **Open — owner explicitly chose to defer**, not an oversight |
| — | Hardcoded Supabase anon key in `mobile-app/lib/app_bootstrap.dart` | Trivially extractable from any installed APK — expected for a `anon`-key architecture, but underscores why REQ-SEC-002 matters: the anon key is the *only* gate on ~73 tables |
| — | No mobile app ever creates a real Supabase Auth session | **Structural fact, not a bug** — every Flutter↔Supabase call (all 3 flavors) executes as `anon`, meaning any `authenticated`-only grant is invisible to mobile and has caused real breakage before (a 2026-09-09 incident: a new migration's `authenticated`-only grant silently broke a live mobile feature) |

**Practical implication for any audit or new feature:** before adding any new mobile-facing table
or RPC, explicitly decide its RLS/grant story — the project's default historically has been
"disable RLS, grant broadly to `anon`," which is the exact pattern already flagged as the
project's biggest open risk. Don't repeat it silently; if there's no time to do real per-row
policies, at minimum use the `is_admin_user()` / narrow-grant pattern established for
`school_calendar_events` and `diagnostic_reports`.

---

## 9. Representative bugs already found & fixed (useful context for where fragility tends to hide)

A dedicated bug-hunting pass (2026-08-18, fixes mostly landed 2026-09-04) found and fixed, among
others:
- **Fees:** "Total Fees" computed two conflicting ways across pages (snapshot vs. live structure)
  — real risk of wrong dues/over- or under-collection (fixed).
- **Reports:** "Teachers" summary count always showed 0 due to a field-name mismatch (fixed).
- **Fees:** saving a payment silently reset an admin's manual "Send Reminder" checkbox selections
  (fixed).
- **Attendance:** no request-cancellation guard when quickly switching class/date — stale
  responses could overwrite the UI with the wrong class's data (fixed).
- **Mobile marks entry:** re-saving Monthly Test marks after any student already had a mark threw
  an unhandled error and **silently lost the entire batch** — a real, easily-hit data-loss bug
  (fixed: proper `onConflict` + try/catch).
- **Mobile homework:** due-today homework wrongly rendered as "Overdue" (time-of-day compared
  against a midnight-parsed due date) (fixed).
- **Mobile daily tasks:** un-marking a completed task could leave the UI showing the wrong state
  on a failed request (a rollback bug reassigning an already-overwritten value) (fixed).
- **Attendance kiosk face-match** (2026-09-17, most recent and still being tuned): nearest-neighbor
  matching across every raw enrollment shot (not one stable reference per person) made
  misidentification the *expected* failure mode once more than one person was enrolled — rewritten
  to per-person centroid matching, threshold re-tuned against real data (76% single-attempt
  recognition at the current setting), confirm-before-record dialog is the accepted backstop.
  **All 6 currently-enrolled staff need to re-enroll** (old embeddings are incompatible with the
  new crop/alignment method) — not yet fully done.

This history is a signal: **fee calculation, batch-save mobile flows, and any code with
duplicate/parallel logic across pages are where regressions have actually happened** — worth
extra scrutiny in any audit or refactor.

---

## 10. Current rollout / distribution status (as of 2026-09-18)

- **Admin panel:** live in production on Vercel, tracks `main`.
- **Mobile apps:** distributed as APKs via a public S3 bucket + in-app update prompts — **not**
  on the Play Store yet, with one exception in progress:
  - **Teacher app** — Play Store **closed testing** track fully submitted (store listing, content
    rating, target audience, data safety, all declarations — 11/11 checklist items done as of
    2026-09-16). **Blocked purely on Google Play's own process**, not on anything in the repo:
    needs **≥12 opted-in testers** running the test for **≥14 consecutive days** before
    "Apply for production" unlocks. Tester group/opt-in links exist; recruitment is the open task.
  - **Student app** — Play Store closed testing **submitted 2026-09-17**; as of the last check,
    only 1 of 12 needed testers had opted in. Same 12-tester/14-day requirement applies.
  - **Attendance kiosk app** — not started on the Play Store path at all; stays APK-via-S3 only
    (makes sense — it only ever needs to run on one physical device).

---

## 11. What is explicitly NOT built yet (good candidates for "new feature" suggestions)

| Gap | Notes |
|---|---|
| **Payment gateway** | Razorpay package installed, zero integration code — fees are view-only/manual-record everywhere |
| **Real push notifications (FCM)** | No `firebase_messaging`; all mobile "notifications" are in-app bell + polling, not real device push, not realtime |
| **Realtime updates** | No Supabase Realtime / WebSockets anywhere — every "live" view is a fresh fetch |
| **SMS/WhatsApp fee-reminder delivery** | Reminder text is templated and ready; there is no actual send mechanism — an admin currently has to deliver reminders manually |
| **Admin-user creation UI** | Settings → Users & Roles can only edit/delete `admin_users`; no in-app way to create a new admin account yet |
| **Employee base salary in DB** | Table exists, unused — salary config still lives only in Zustand/localStorage |
| **Year Planning / Fee Reminder templates / Role Permissions matrix persistence** | Tables exist, still Zustand-only (lost on cache clear, not synced across admin devices) |
| **SEF Phase 2** | GR Book, Attendance, Syllabus, Employee, Inventory, Expenses, Notice Board, Question Papers, Tasks, Super Admin — all school-only today, no SEF counterpart |
| **Dedicated parent portal** | Not started as a separate product — but the Student app already covers most of what one would do (fees, attendance, marks, homework, notices); worth asking whether it's still needed at all, or whether the Student app should just be positioned as the parent portal |
| **Schema/documentation cleanup** | `users` vs `admin_users`, `timetable_period_definitions` vs `timetables` — dead tables never removed, could confuse a naive audit |
| **Automated tests / CI** | Zero coverage on either app — highest-leverage non-feature investment if reliability is a goal |

---

## 12. How to use this document to suggest features or run an audit

A good feature suggestion or audit pass on this project should:
1. **Respect the existing architecture** — this is a live system with real users; a suggestion
   that requires ripping out the custom mobile-auth model or the shared-Supabase-project design
   is a MAJOR change, not a quick win (see `AGENTS.md` §J12B classification if proposing scope).
2. **Check §8 and §11 first** — many "obvious" gaps (payments, push notifications, RLS
   hardening, admin-user creation) are already known and tracked, not undiscovered. A useful
   contribution either (a) proposes *how* to close one of these, or (b) finds something genuinely
   not on this list.
3. **Prefer additive features over refactors** — per the project's own engineering rules
   (`AGENTS.md` §K), this codebase favors the smallest correct change; a sweeping architectural
   rewrite proposal needs to justify itself against real pain, not just taste.
4. **Treat "3 mobile apps, always"** as a constant — any mobile feature idea needs an answer for
   which of Teacher/Student/Attendance-kiosk it applies to, and whether it needs a rebuild+re-Play
   Store-review cycle given the apps aren't fully on the Play Store yet.
5. **Flag, don't silently fix, anything security-relevant found during an audit** — this project's
   own convention (§J14) is to record findings with severity and evidence, and let the owner
   decide priority, rather than an agent unilaterally "cleaning up" security or data issues.

---

*Generated 2026-09-18 by synthesizing `CLAUDE.md`, `AGENTS.md`, `README.md`,
`governance/BOOTSTRAP.md`, `governance/documentation/PROJECT_CONTEXT.md`,
`governance/planning/TODO.md`, `governance/planning/SECURITY-THREAT-MODEL.md`,
`mobile-app/store-listing-teacher.md`, and `mobile-app/store-listing-student.md`. Re-generate or
refresh this file if those source documents change materially — it is a snapshot, not a live
view.*
