# PROJECT CONTEXT — Satyam Stars International School ERP

> **As of:** 27 June 2026 (commit `06d961a`)  
> **Branch:** main  
> **Working directory:** `D:\SATYAM-SCHOOL\admin-panel`

---

## Project Overview

A single-app Next.js 14 school management ERP for **Satyam Stars International School**, Surat, Gujarat (GSEB Board, English Medium). The entire system lives in `admin-panel/` as a monolithic Next.js App Router application.

**Backend status:** Supabase is connected end-to-end for all data. Authentication is real (Supabase Auth + `admin_users` role table). **File/photo upload is now live via AWS S3** — student photos, student documents, and employee photos/documents are all uploaded to private S3 buckets using presigned URLs generated server-side. Every functional module reads and writes Supabase via a dedicated service file per module.

**Scale:** ~1,000+ students, 50+ staff, 15 classes (JR KG → 12th Commerce).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.35 (React 18, App Router) |
| Language | **JavaScript only — no TypeScript** |
| Styling | Tailwind CSS 3.4.1 + custom school brand colors |
| Icons | Lucide React |
| State | Zustand 5 (with localStorage persist, version 8) |
| Forms | React Hook Form 7 + Zod 4 |
| Database | **Supabase (connected)** — `https://hxkowdaugkkumvzyfsai.supabase.co` |
| Auth | **Supabase Auth (connected)** — `signInWithPassword` + `admin_users` role table, PKCE flow, invite/reset via `/auth/callback` + `/auth/set-password` |
| File Storage | **AWS S3 (connected)** — presigned PUT/GET URLs via Next.js API routes; server-side client in `src/lib/s3.js` (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`); browser never touches AWS credentials |
| Payments (pending) | Razorpay (package installed, not connected) |
| Export | XLSX (Excel) + jsPDF + jspdf-autotable (PDF) |
| Charts | Recharts 3 |
| Notifications | Sonner (toasts); FCM not yet integrated |
| Dev Server | Custom `scripts/dev-start.js` (run via `npm run dev`) |

**Brand colors:** `school-navy` (#1e3a5f), `school-gold` (#f59e0b)

**Supabase client:** `src/lib/supabase.js` — singleton browser client, `auth: { flowType: "pkce" }`. `@supabase/ssr` is installed but **not yet used** — there is no server-side or service-role client anywhere in the codebase.

**Service layer (`src/lib/*Service.js`):** one file per module, each wrapping the Supabase calls for that domain. See **DB Integration Progress** and **File Size Reference** below for the full list.

---

## AWS S3 Integration

**Status: Live** — student and employee photos/documents now upload to a private S3 bucket.

**Key files:**

| File | Purpose |
|---|---|
| `src/lib/s3.js` | Server-only S3Client singleton; reads `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` from env |
| `src/lib/s3Upload.js` | Client-side helpers: `uploadFileToS3(file, key)`, `getS3ViewUrl(key, filename)`, `buildDocDownloadName()`, `slugify()`, `fileExt()` |
| `src/lib/fileCompression.js` | Client-side compression before upload: images via canvas JPEG re-encode (iterative quality+dimension reduction to 1 MB); PDFs via pdfjs-dist rasterization + jsPDF rebuild; skips files already within budget |
| `src/components/S3Image.jsx` | Resolves a private S3 object key to a short-lived presigned view URL; renders `fallback` until resolved |
| `src/app/api/s3/upload-url/route.js` | Server route: validates key prefix (`students/` or `employees/`), returns a 5-min presigned PUT URL |
| `src/app/api/s3/view-url/route.js` | Server route: validates key prefix, returns a 15-min presigned GET URL (supports `Content-Disposition` for inline view) |

**Key naming convention:**
- Student photos: `students/{slugified-name}-{enrollmentId}-photo.jpg`
- Student documents: `students/{slugified-name}-{enrollmentId}-{docType}.{ext}`
- Employee photos: `employees/{slugified-name}-{empId}-photo.jpg`
- Employee documents: `employees/{slugified-name}-{empId}-{docType}.{ext}`

**Flow:** browser compresses → calls `/api/s3/upload-url` → gets presigned PUT URL → PUTs directly to S3 → stores the S3 key (not a URL) in the Supabase DB column. To view: `S3Image` or `getS3ViewUrl` calls `/api/s3/view-url` → gets presigned GET URL → renders.

---

## Supabase Schema

`database/schema.sql` (571 lines) defines **35 tables**:

| Area | Tables |
|---|---|
| School config | `roles`, `school_profile`, `academic_years`, `classes`, `sections`, `fee_structures`, `document_types` |
| Students | `students`, `student_enrollments` (core per-year join: class/section/roll/fee), `student_previous_school`, `student_documents`, `student_siblings`, `transfer_certificates`, `student_promotions` |
| Fees | `fee_payments`, `fee_reminder_templates` |
| Employees | `employees`, `employee_documents`, `employee_subject_mappings`, `employee_salaries`, `salary_payments` |
| Money | `expenses` |
| Inventory | `inventory_items`, `inventory_batches`, `inventory_usages`, `student_inventory_assignments`, `assets`, `asset_checkouts` |
| Comms / ops | `notices`, `tasks`, `task_assignees` |
| Scheduling | `timetable_period_definitions`, `timetable_entries`, `year_plan_events` |
| Auth (unused) | `users` |

**RLS:** intentionally OFF during development.

**⚠️ Schema drift — `schema.sql` is a blueprint, not the live source of truth.** The deployed DB and the app code have diverged from it in at least 4 places:
- App auth uses a table called **`admin_users`** (id, name, role, initials) — not the `users` table defined in `schema.sql`, which is unused dead schema.
- Settings' Timetable tab reads/writes a table called **`timetables`**, not the documented `timetable_period_definitions` / `timetable_entries`.
- `sections` is written with a `class_teacher` column (in `settingsService.js`) that isn't in the `schema.sql` definition.
- `tasks` is written with a `show_on_dashboard` boolean (in `taskService.js`) that isn't in the `schema.sql` definition.
- `students` table has columns `aadhar_name`, `society`, `landmark` now fetched in queries — verify these exist in live DB (not in schema.sql).

Treat the actual Supabase project + code as authoritative; `schema.sql` needs a reconciliation pass.

**Other DB files:**
- `database/fix_class_names.sql` — one-off migration from space-format class names ("JR KG") to dot/dash format
- `database/seed_fees_inventory.sql` — empty (gutted)
- `schema_dump.json` (repo root) — dead/junk file (`{"message":"Invalid API key",...}`), not real data

**Class name format note:** DB stores "JR.KG" / "SR.KG" / "11th - Commerce" / "12th - Commerce". Zustand `activeClasses` still uses old format for backward compat. Conversion via `DB_TO_STORE` map in `settings/page.js` ClassSectionsTab.

---

## Route Map

```
/login                        ← Auth via Supabase Auth (admin must already have an admin_users row)
/auth/callback                 ← PKCE/OTP exchange for invite & password-reset links
/auth/set-password             ← Set password after invite/reset
/dashboard                    ← Overview: KPIs, charts, notices, activity feed — live on Supabase
/student                      ← Student list + filters + export
/student/add                  ← Add new student form (with S3 photo + doc upload)
/student/[id]                 ← Student profile view (S3Image for photo; presigned links for docs)
/student/[id]/edit            ← Edit student details (with S3 photo + doc upload)
/student/[id]/tc              ← Transfer Certificate generation
/fees                         ← Fee structure, collection, reminders
/employee                     ← Staff profiles, attendance, salary calculation (with S3 photo + doc upload)
/inventory                    ← Stock items, assets, distribution
/expenses                     ← School expense tracking
/notice                       ← Notice board: post/pin/archive notices
/report                       ← Reports
/tasks                        ← Task management (assign to staff, track)
/settings                     ← School config, fee structure, classes, timetable, users & roles
/super-admin                  ← Bulk student edit wizard, import tool, fee/salary/inventory panels
/api/s3/upload-url            ← Server route: generate presigned PUT URL for S3
/api/s3/view-url              ← Server route: generate presigned GET URL for S3
```

---

## Module Status

### 1. Authentication — `/login`, `/auth/callback`, `/auth/set-password`
**Status: Complete — real Supabase Auth**

- Login calls `supabase.auth.signInWithPassword`, then looks up the signed-in user's row in `admin_users` (id, name, role, initials) to populate Zustand `authUser`
- **No hardcoded credentials remain**
- Roles enforced: `management`, `senior_admin`, `normal_admin` (`DB_ROLES` in `settings/page.js`). Login page UI copy is stale (still says "Super Admin · Teacher · Accountant · Inventory Manager") — worth a cleanup pass
- `AuthGuard.jsx` wraps `(dashboard)/layout.js`: checks session, redirects to `/login` if none, listens for `SIGNED_OUT`
- `auth/callback/page.js`: handles PKCE `code` exchange and legacy OTP `token_hash`
- `auth/set-password/page.js`: sets password via `supabase.auth.updateUser`
- **Pending:** Admin-user creation UI (Settings → Users & Roles only edits/deletes; new admins must be invited outside this UI)

---

### 2. Dashboard — `/dashboard`
**Status: Live on Supabase** (`dashboardService.js`, ~100 lines)

- KPI cards, attendance charts, recent notices, low-stock alerts, and activity feed all computed from DB
- Pending Tasks popup reads dashboard-pinned tasks via `taskService.js`
- **Pending:** nothing significant

---

### 3. Student Management — `/student/*`
**Status: Live on Supabase** (`studentService.js`, ~661 lines)

- Full CRUD across students, enrollments, documents, previous-school records, siblings, inventory assignments
- **S3 upload now live:** student photos and documents upload to S3; `photo_url` and `student_documents.file_url` now store S3 object keys (e.g. `students/...`), not literal strings
- `S3Image` component used in student list and profile to render photos from private S3
- `addStudent` now only creates inventory assignments for `category='student'` items (not assets)
- `updateStudent` now also patches `student_enrollments` (roll_no, date_of_join) when `enrollmentId` provided
- `pendingDocs` logic rewritten: uses `DEFAULT_DOCS` from `constants.js`, compares against "Uploaded" docs, skips "Leaving Certificate" + "Marksheet" for students with no previous school
- `student_previous_school` correctly accessed as `?.[0]` (Supabase returns as array)
- `getStudents` now fetches `aadhar_name`, `society`, `landmark` fields from the students table
- Inventory assignments now expose `_assignmentId` and `givenDateRaw` for Fees/Super Admin use
- **Pending:** nothing significant

---

### 4. Fees — `/fees`
**Status: Live on Supabase** (`feesService.js`, ~187 lines)

- Per-student fee summary, payment CRUD, fee-structure lookups all hit the DB
- `markInventoryGiven` now auto-inserts `inventory_usages` rows to deduct stock when items are marked Given (skips notebooks and book sets — those are deducted manually via Inventory module)
- **New:** `markInventoryPending(assignmentIds)` — reverses "Given" back to "Pending" and clears `given_date`
- **Pending:** Razorpay integration; SMS/WhatsApp delivery for reminders (templates still Zustand-only)

---

### 5. Employee Management — `/employee`
**Status: Live on Supabase** (`employeeService.js`, ~75 lines)

- Full employee CRUD via DB
- **S3 upload now live:** employee photos and documents upload to S3; `photo` and document `key` fields store S3 object keys; `S3Image` used to display photos
- "Generate Salary" writes to `salary_payments` and auto-creates an Expense entry via `expensesService`
- **Base monthly salary amounts (`employeeSalaries`) remain Zustand-only** — `employee_salaries` table exists but is unused
- **Pending:** Migrate `employeeSalaries` to DB

---

### 6. Inventory — `/inventory`
**Status: Live on Supabase** (`inventoryService.js`, ~189 lines)

- Items, batches, usages, thresholds, permanent assets, and asset checkouts are all DB-backed
- `getInventoryItems(yearId)` now accepts an optional academic year ID and filters `student_inventory_assignments` by year, so the "Students Given" count is year-scoped
- `studentsGiven` count now computed from actual assignment records (not usage records), so notebooks and pre-fix assignments are counted correctly
- **Pending:** nothing significant

---

### 7. Expenses — `/expenses`
**Status: Live on Supabase** (`expensesService.js`, ~56 lines)

- Full CRUD; salary payments auto-sync from Employee module as Salary-category entries
- **Pending:** nothing significant

---

### 8. Notice Board — `/notice`
**Status: Live on Supabase** (`noticeService.js`, ~71 lines)

- Full CRUD: pin/unpin, edit, archive/restore, delete — all survive a refresh
- **Pending:** nothing significant

---

### 9. Report — `/report`
**Status: Live on Supabase (read-only)** (`reportService.js`, ~279 lines)

- Student, employee, fee, and inventory/asset reports pull live data; employee report surfaces latest `salary_payments` record
- **Pending:** nothing significant

---

### 10. Settings — `/settings`
**Status: Live on Supabase — 8 tabs**

| Tab | Status |
|---|---|
| School Profile | ✅ Live |
| Academic Year | ✅ Live |
| Fee Structure | ✅ Live |
| Classes & Sections | ✅ Live |
| Timetable | ✅ Live (but `timetables` table — schema drift, see above) |
| Year Planning | ⏳ Zustand-only — `year_plan_events` table unused |
| Fee Reminders | ⏳ Zustand-only — `fee_reminder_templates` table unused |
| Users & Roles | ◐ Partial — edit/delete `admin_users` live; create not wired; Role Permissions matrix Zustand-only |

---

### 11. Super Admin — `/super-admin`
**Status: Live — now has 6 panels**

Internal hardcoded login removed; reuses real `authUser` from Supabase Auth. `normal_admin` blocked entirely; `management` role gates the Salary Panel.

| Panel | Status |
|---|---|
| Single Student Tool | ✅ Live — edit any student field + upload S3 photo/docs |
| Bulk Student Edit (Spreadsheet) | ✅ Live — multi-column spreadsheet editor |
| Student Import (Excel) | ✅ Live — bulk insert via `studentService` |
| Fees Panel | ✅ Live — view/edit fee records and payments per student |
| Inventory Panel | ✅ Live — view/manage student inventory assignments; mark Given/Pending with stock deduction |
| Employee Panel | ✅ Live — edit employee details + upload S3 photo/docs |
| Salary Panel | ✅ Live (Management Head only) — set base salaries, generate payments, view history |
| **Pending IDs Panel** | ✅ Live — filter/export students missing government IDs (UDISE/PEN/APAAR); XLSX export |

**Note on Import Tool:** worth a smoke test to verify end-to-end persistence to DB (not just preview).

---

### 12. Tasks — `/tasks`
**Status: Live on Supabase** (`taskService.js`, ~106 lines)

- Tasks + `task_assignees` junction table DB-backed; multiple assignees per task supported
- Dashboard-pinned tasks and active-employee list sourced from DB
- **Pending:** nothing significant

---

## Shared Utilities

| File | Purpose |
|---|---|
| `src/lib/constants.js` | `DEFAULT_DOCS` — 6 required document names (Birth Certificate, Student Aadhar Card, Father's Aadhar Card, Mother's Aadhar Card, Leaving Certificate, Marksheet) — keep in sync with `studentService.js` pendingDocs and Super Admin |
| `src/lib/utils.js` | `cn()` (clsx + twMerge), `fmtDMY(dateStr)` (converts YYYY-MM-DD → DD-MM-YYYY) |

---

## Global State (Zustand — `src/lib/store.js`)

**Version: 8** — not bumped since DB migration.

**Dead weight (safe to delete):** legacy seed arrays `employees` (27 entries), `expenses` (10 entries), `feePayments` (5 entries), `students` (5 dummy entries) — confirmed unused.

Still genuinely live in Zustand:

```
authUser / setAuthUser / clearAuthUser     ← real auth session (id, name, role, initials)
employeeSalaries: { [empId]: monthlyAmount }   ← base pay; employee_salaries table unused
rolePermissions: {}                              ← Role Permissions matrix UI; roles.permissions unused
feeReminderTemplates                             ← fee_reminder_templates table unused
yearPlanEvents                                   ← year_plan_events table unused
studentInventoryItems                            ← master list of distributable items
periodDefs / timeSlots                           ← legacy timetable scaffolding
sessionFeesStructure
uniformFees: { [className]: amount }
oldStudentDiscount: 1000
sidebarOpen / toggleSidebar / closeSidebar
readmissionDate
activeClasses + setActiveClasses / activateClass / deactivateClass   ← synced from DB
pendingTasks                                     ← legacy; dashboard popup reads from taskService
```

---

## Key Decisions Made

| Decision | Rationale |
|---|---|
| JavaScript only (no TypeScript) | Project requirement; enforced in all files |
| Next.js App Router (not Pages Router) | Modern default; all routes use `"use client"` |
| AWS S3 for file storage (not Supabase Storage) | Chosen over Supabase Storage; presigned URLs keep AWS credentials server-side only |
| Presigned URL pattern for S3 | Browser compresses locally, PUTs directly to S3 via short-lived signed URL; server never proxies file bytes |
| Client-side compression before upload | Keeps files under 1 MB for bandwidth; images: canvas JPEG re-encode; PDFs: pdfjs-dist rasterize → jsPDF rebuild |
| Store S3 key, not URL, in DB | Presigned URLs expire; keys are permanent — view URL generated on demand |
| `DEFAULT_DOCS` constant in `constants.js` | Single source of truth for required doc list; avoids drift between Student, Super Admin, and pendingDocs logic |
| Inventory assignments: `category='student'` only when adding new students | Assets (permanent items) must not get per-student assignment rows |
| `markInventoryGiven` auto-deducts stock via `inventory_usages` | Keeps stock levels correct automatically; books/notebooks excluded (deducted manually) |
| `getInventoryItems(yearId)` year-scoped | "Students Given" count should reflect current academic year, not all-time |
| Dummy data first, Supabase later | Build UI to validate UX before designing schema |
| All pages are client components | Avoids server/client boundary complexity |
| Zustand with localStorage | Simple global state, survives page refresh |
| Custom `dev-start.js` script | Replaces `next dev` to fix port/env issues |
| Tri-lingual fee reminders (EN/HI/OD) | School has students from Odisha |
| Real auth replaces hardcoded login | `admin_users` table holds role; `AuthGuard` wraps dashboard layout; PKCE invite/reset flow |
| One service file per module | Keeps Supabase query logic out of page components |
| `schema.sql` is a historical blueprint | Deployed DB has drifted — code + actual Supabase tables are authoritative until reconciled |
| RLS disabled during development | Will be enabled once auth model is finalized |

---

## Constraints & Rules (DO NOT VIOLATE)

1. **Never run `npx next build`** during development — corrupts `.next` cache and breaks all CSS.
2. **Never use PowerShell `Out-File` or `Set-Content`** on JS/JSX files — adds UTF-8 BOM and breaks Next.js CSS loading. Always use the `Write` tool instead.
3. **No TypeScript** — all new files must be `.js` or `.jsx`.
4. **Dev server:** always start with `npm run dev` (uses `scripts/dev-start.js`), not `next dev` directly.

---

## DB Integration Progress

| Module | Status |
|---|---|
| Authentication | ✅ Live — Supabase Auth + `admin_users` role table + PKCE invite/reset flow |
| Settings — School Profile, Academic Year, Fee Structure, Classes & Sections | ✅ Live |
| Settings — Timetable | ✅ Live (but `timetables` table — schema drift) |
| Settings — Year Planning / Fee Reminders / Role Permissions matrix | ⏳ Pending — Zustand-only |
| Settings — Users & Roles (admin_users) | ◐ Partial — edit/delete live, create not wired |
| Dashboard | ✅ Live |
| Student (list/add/edit/profile/TC) | ✅ Live |
| Student file/photo upload | ✅ Live — AWS S3 via presigned URLs |
| Fees | ✅ Live |
| Employee | ◐ Partial — CRUD + salary payments live; base salary amounts Zustand-only |
| Employee file/photo upload | ✅ Live — AWS S3 via presigned URLs |
| Inventory | ✅ Live (year-scoped students-given count) |
| Expenses | ✅ Live |
| Notice board | ✅ Live |
| Report | ✅ Live (read-only) |
| Tasks | ✅ Live |
| Super Admin | ✅ Live — 6 panels including Inventory and Pending IDs |

---

## What Is NOT Yet Built

| Item | Notes |
|---|---|
| Razorpay payment flow | Package installed, no integration code |
| FCM / push notifications | Sonner toasts ready; FCM not wired |
| Employee base salary in DB | `employee_salaries` table exists, unused; `employeeSalaries` still Zustand-only |
| Year Planning / Fee Reminder templates / Role Permissions persistence | Tables exist (`year_plan_events`, `fee_reminder_templates`, `roles.permissions`), all unused |
| Admin-user creation UI | Settings → Users & Roles only edits/deletes; new admins must be invited outside this UI |
| Schema drift cleanup | `users` (unused) vs `admin_users` (live); `timetable_period_definitions`/`timetable_entries` (unused) vs `timetables` (live); ad-hoc columns not in schema.sql |
| Parent portal | Not started |
| SMS/WhatsApp delivery | Fee reminder text ready, no send mechanism |
| Real-time notifications | No WebSocket or Supabase Realtime setup |
| Server-side/admin Supabase client | `@supabase/ssr` installed but unused |
| Super Admin Import Tool — smoke test | Verify bulk insert actually persists to DB end-to-end |

---

## File Size Reference (current)

| File | Lines | Purpose |
|---|---|---|
| `src/app/(dashboard)/super-admin/page.js` | ~2,511 | 6 panels: Single Student, Spreadsheet Edit, Import, Fees, Inventory, Employee, Salary, Pending IDs |
| `src/app/(dashboard)/settings/page.js` | ~1,971 | 8-tab school config |
| `src/app/(dashboard)/employee/page.js` | ~1,473 | Employee CRUD + attendance + salary + S3 upload |
| `src/app/(dashboard)/fees/page.js` | ~1,297 | Fee management |
| `src/app/(dashboard)/inventory/page.js` | ~1,234 | Inventory & assets |
| `src/app/(dashboard)/student/page.js` | ~1,249 | Student list |
| `src/app/(dashboard)/report/page.js` | ~1,113 | All reports |
| `src/app/(dashboard)/tasks/page.js` | ~665 | Task management |
| `src/lib/studentService.js` | ~661 | Full student/enrollment/document/sibling/promotion CRUD |
| `src/app/(dashboard)/expenses/page.js` | ~434 | Expense tracking |
| `src/app/(dashboard)/notice/page.js` | ~415 | Notice board |
| `src/app/(dashboard)/dashboard/page.js` | ~401 | Dashboard overview |
| `src/lib/reportService.js` | ~279 | Read-only aggregation |
| `src/lib/store.js` | ~220 | Global Zustand state |
| `src/lib/inventoryService.js` | ~189 | Items/batches/usages/assets/checkouts CRUD |
| `src/lib/feesService.js` | ~187 | Fee summary joins, payment CRUD, inventory-given/pending |
| `src/lib/settingsService.js` | ~147 | School/year/fee/class config + `admin_users` + `timetables` |
| `src/lib/fileCompression.js` | ~110 | Client-side image (canvas) and PDF (pdfjs-dist + jsPDF) compression |
| `src/lib/taskService.js` | ~106 | Tasks + `task_assignees` CRUD |
| `src/lib/dashboardService.js` | ~100 | KPI stats, notices, low-stock alerts, activity feed |
| `src/lib/employeeService.js` | ~75 | Employee CRUD |
| `src/lib/noticeService.js` | ~71 | Notice CRUD |
| `src/lib/expensesService.js` | ~56 | Expense CRUD |
| `src/components/AuthGuard.jsx` | ~54 | Session/role gate wrapping dashboard layout |
| `src/lib/s3Upload.js` | ~47 | Client helpers: presigned upload/view, buildDocDownloadName, slugify, fileExt |
| `src/app/api/s3/view-url/route.js` | ~29 | Server route: presigned GET URL for S3 |
| `src/app/api/s3/upload-url/route.js` | ~27 | Server route: presigned PUT URL for S3 |
| `src/components/S3Image.jsx` | ~15 | Resolves S3 key to presigned view URL for img rendering |
| `src/lib/s3.js` | ~11 | Server-side S3Client singleton |
| `src/lib/utils.js` | ~13 | `cn()` + `fmtDMY()` |
| `src/lib/constants.js` | ~10 | `DEFAULT_DOCS` array |
| `src/lib/supabase.js` | ~10 | Supabase client singleton (PKCE auth flow) |

---

## Git History Summary

| Commit | Work Done |
|---|---|
| `06d961a` bug fixed | Bug fixes across dashboard, employee, expenses, fees, inventory, report, settings, student pages and services; student page improvements; inventory service fixes |
| `2e00b3f` all module changes done | Super admin major updates; settings cleanup; feesService and studentService patches; S3 upload-url route fix |
| `6ccddf8` inventory Module Done | Inventory Panel added to Super Admin; Pending IDs Panel added; `constants.js` + `utils.js` added; `feesService` `markInventoryPending` + stock-deduction logic; `inventoryService` year-scoped count + studentsGiven fix; student service and store fixes |
| `c1f2050` super admin updated | Employee Panel S3 photo upload; super admin role-gating refinements |
| `575bade` PHOTO UPLOAD FEATURE DONE | AWS S3 integration: `s3.js`, `s3Upload.js`, `fileCompression.js`, `S3Image.jsx`, `/api/s3/upload-url`, `/api/s3/view-url`; student add/edit/profile/list updated for S3 photos/docs; employee page updated for S3 photos/docs; super admin Single Student Tool gains S3 upload |
| `19b84d3` project context file updated | PROJECT_CONTEXT.md updated (previous version) |
| `41f3fac` all changes done | Polish pass across login, dashboard, employee, expenses, report, settings, student add/edit/profile, super-admin, and auth callback |
| `24b1ee3` user login saved in database | Real Supabase Auth wired; AuthGuard, auth/callback, auth/set-password; dashboardService/feesService/reportService/taskService created; seed gutted |
| `ba4ca92` Database created and supabase installed | Full schema.sql (35 tables); all service files created; every module rewritten against DB |

---

## Next Integration Steps (in priority order)

1. **Smoke test Super Admin Import Tool** — verify bulk student insert actually persists to DB end-to-end
2. **Razorpay** — connect payment flow for fee collection
3. **Migrate remaining Zustand-only config to DB** — `employeeSalaries` → `employee_salaries`; Year Planning → `year_plan_events`; Fee Reminder templates → `fee_reminder_templates`; Role Permissions matrix → `roles.permissions`
4. **Admin-user creation UI** — let Settings → Users & Roles create new `admin_users` rows (today only edit/delete)
5. **Schema cleanup** — reconcile `schema.sql` with live DB; retire `users` table; decide between `timetables` and `timetable_period_definitions`/`timetable_entries`; formalize ad-hoc columns
6. **FCM / Supabase Realtime** — push notifications, live updates
7. **Parent portal** — not started
8. **SMS/WhatsApp delivery** — fee reminder send mechanism
