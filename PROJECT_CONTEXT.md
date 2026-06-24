# PROJECT CONTEXT — Satyam Stars International School ERP

> **As of:** 23 June 2026 (commit `41f3fac`)  
> **Branch:** main  
> **Working directory:** `D:\SATYAM-SCHOOL\admin-panel`

---

## Project Overview

A single-app Next.js 14 school management ERP for **Satyam Stars International School**, Surat, Gujarat (GSEB Board, English Medium). The entire system lives in `admin-panel/` as a monolithic Next.js App Router application.

**Backend status:** Supabase is now connected end-to-end. **Authentication is real** (Supabase Auth + an `admin_users` role table) — the old hardcoded login is gone. **Every functional module — Dashboard, Student, Fees, Employee, Inventory, Expenses, Notice Board, Report, Tasks, Settings, Super Admin — now reads and writes Supabase** via a dedicated service file per module. What remains pending is narrower and more specific than before: file/photo upload to Supabase Storage, Razorpay, a handful of Settings sub-tabs (Year Planning, Fee Reminders, Role Permissions) that are still Zustand-only, employee base salary persistence, and some schema drift cleanup (see below).

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
| Payments (pending) | Razorpay (package installed, not connected) |
| Export | XLSX (Excel) + jsPDF + jspdf-autotable (PDF) |
| Charts | Recharts 3 |
| Notifications | Sonner (toasts); FCM not yet integrated |
| Dev Server | Custom `scripts/dev-start.js` (run via `npm run dev`) |

**Brand colors:** `school-navy` (#1e3a5f), `school-gold` (#f59e0b)

**Supabase client:** `src/lib/supabase.js` — singleton browser client, `auth: { flowType: "pkce" }`. `@supabase/ssr` is installed but **not yet used** — there is no server-side or service-role client anywhere in the codebase.

**Service layer (`src/lib/*Service.js`):** one file per module, each wrapping the Supabase calls for that domain. See **DB Integration Progress** and **File Size Reference** below for the full list.

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

Treat the actual Supabase project + code as authoritative; `schema.sql` needs a reconciliation pass (see **Next Integration Steps**).

**Other DB files:**
- `database/fix_class_names.sql` — one-off migration from space-format class names ("JR KG") to dot/dash format ("JR.KG", "11th - Commerce")
- `database/seed_fees_inventory.sql` — now empty (gutted in the `24b1ee3` commit)
- `schema_dump.json` (repo root) — **dead/junk file**, contains only `{"message":"Invalid API key",...}` from a failed dump attempt, not real data

**Class name format note:** DB stores "JR.KG" / "SR.KG" / "11th - Commerce" / "12th - Commerce". Zustand `activeClasses` still uses old format ("JR KG", "SR KG", "11th Commerce", "12th Commerce") for backward compat with `student/page.js` ACTIVE_CLASS_MAP. Conversion via `DB_TO_STORE` map in `settings/page.js` ClassSectionsTab.

---

## Route Map

```
/login                        ← Auth via Supabase Auth (admin must already have an admin_users row)
/auth/callback                 ← PKCE/OTP exchange for invite & password-reset links
/auth/set-password             ← Set password after invite/reset
/dashboard                    ← Overview: KPIs, charts, notices, activity feed — live on Supabase
/student                      ← Student list + filters + export
/student/add                  ← Add new student form
/student/[id]                 ← Student profile view
/student/[id]/edit            ← Edit student details
/student/[id]/tc              ← Transfer Certificate generation
/fees                         ← Fee structure, collection, reminders
/employee                     ← Staff profiles, attendance, salary calculation
/inventory                    ← Stock items, assets, distribution
/expenses                     ← School expense tracking
/notice                       ← Notice board: post/pin/archive notices
/report                       ← Reports
/tasks                        ← Task management (assign to staff, track)
/settings                     ← School config, fee structure, classes, timetable, users & roles
/super-admin                  ← Bulk student edit wizard, import tool, fee/salary panels
```

---

## Module Status

### 1. Authentication — `/login`, `/auth/callback`, `/auth/set-password`
**Status: Complete — real Supabase Auth**

- Login calls `supabase.auth.signInWithPassword`, then looks up the signed-in user's row in `admin_users` (id, name, role, initials) to populate Zustand `authUser`
- **No hardcoded credentials remain** — `admin@school.com` / `123456` is gone
- Roles enforced in code: `management`, `senior_admin`, `normal_admin` (`DB_ROLES` in `settings/page.js`). The login page's UI copy ("Super Admin · Teacher · Accountant · Inventory Manager") is stale and doesn't match the enforced roles — worth a cleanup pass
- `AuthGuard.jsx` wraps `(dashboard)/layout.js`: checks `supabase.auth.getSession()`, redirects to `/login` if there's no session or no matching `admin_users` row, and listens for `SIGNED_OUT`
- `auth/callback/page.js`: handles PKCE `code` exchange and legacy OTP `token_hash` (invite/recovery links), then routes to `/auth/set-password`
- `auth/set-password/page.js`: sets the password via `supabase.auth.updateUser`; requires an admin to have already created the matching `admin_users` row (no self-signup)
- Super Admin's own internal hardcoded role login (Sunil Pradhan / sunil123 etc.) has been **removed** — see Super Admin module below
- **Pending:** Admin-user creation UI (Settings → Users & Roles currently only edits/deletes existing `admin_users` rows; new admins must be invited outside this UI)

---

### 2. Dashboard — `/dashboard`
**Status: Live on Supabase** (`dashboardService.js`, ~114 lines)

- KPI cards (students, staff, fee collection, expenses), attendance charts, recent notices, inventory low-stock alerts, and the recent-activity feed are all computed from DB queries scoped to the current academic year/month
- Pending Tasks popup now reads dashboard-pinned tasks via `taskService.js`
- **Pending:** nothing significant — this module's DB wiring is essentially complete

---

### 3. Student Management — `/student/*`
**Status: Live on Supabase** (`studentService.js`, ~694 lines — the largest service file)

- Full CRUD across students, per-year enrollments (class/section/roll/fee), documents, previous-school records, siblings, and inventory assignments
- Deactivate, Promote (creates a new enrollment + a promotion audit row), fee-payment insert, and TC issuance (flips status to "Left") all hit the DB
- Class dropdowns in Add/Edit still load active classes from DB via `getActiveClasses()` (unchanged)
- Govt ID eligibility logic (UDISE / PEN / APAAR) unchanged, computed dynamically in both Student and Report modules
- **Pending:** Photo/document upload UI still writes a literal string into `file_url`/`photo_url`, not an actual uploaded file — **no Supabase Storage integration yet**

---

### 4. Fees — `/fees`
**Status: Live on Supabase** (`feesService.js`, ~169 lines)

- Per-student fee summary: joins enrollment + student + class + section + payments + inventory assignments
- Payment history insert/update/delete (diffed against existing rows), inventory-given marking, and fee-structure lookups all hit the DB
- **Pending:** Razorpay integration; SMS/WhatsApp delivery for reminders (templates are still Zustand-only — see Settings)

---

### 5. Employee Management — `/employee`
**Status: Live on Supabase** (`employeeService.js`, ~80 lines) — salary calculation partially DB-backed

- Full employee CRUD via DB; class-teacher and subject-class dropdowns still load active classes from DB (unchanged)
- Attendance + Salary Calculation: "Generate Salary" writes directly to `salary_payments` (`supabase.from("salary_payments").insert()` in `page.js`) and auto-creates a matching Expense entry via `expensesService`
- **Base monthly salary amounts (`employeeSalaries`) remain Zustand-only** — the `employee_salaries` table exists in `schema.sql` but nothing in the codebase reads or writes it
- **Pending:** Migrate `employeeSalaries` to DB; real file upload to Storage for employee documents/photos

---

### 6. Inventory — `/inventory`
**Status: Live on Supabase** (`inventoryService.js`, ~191 lines)

- Items, batches, usages, configurable low-stock thresholds, permanent assets, and asset checkouts are all DB-backed
- **Pending:** nothing significant

---

### 7. Expenses — `/expenses`
**Status: Live on Supabase** (`expensesService.js`, ~62 lines)

- Full CRUD; salary payments generated from the Employee module continue to auto-sync in here as Salary-category entries
- **Pending:** nothing significant

---

### 8. Notice Board — `/notice`
**Status: Live on Supabase** (`noticeService.js`, ~78 lines) — previously local-component-state only, now persists

- Full CRUD: pin/unpin, edit, archive/restore, delete now survive a refresh (this was the old doc's biggest "pending" item for this module — now resolved)
- **Pending:** nothing significant

---

### 9. Report — `/report`
**Status: Live on Supabase (read-only aggregation)** (`reportService.js`, ~303 lines)

- Student, employee, fee, and inventory/asset reports all pull live data; the employee report additionally surfaces each employee's latest payment from `salary_payments`
- Govt ID eligibility logic and DOB-to-words helper unchanged
- **Pending:** nothing significant

---

### 10. Settings — `/settings`
**Status: Live on Supabase — now 8 tabs (was 4)**

The original 4 tabs are unchanged in behavior: **School Profile**, **Academic Year**, **Fee Structure**, **Classes & Sections** (see previous version of this doc for details — still accurate).

**New tabs added since the last update:**

- **Timetable** — DB-backed, but via a `timetables` table that does **not** match the `timetable_period_definitions` / `timetable_entries` tables defined in `schema.sql` (schema drift, see above)
- **Year Planning** — Zustand-only; the `year_plan_events` table exists in `schema.sql` but is unused
- **Fee Reminders** — Zustand-only; the `fee_reminder_templates` table exists in `schema.sql` but is unused
- **Users & Roles** — `admin_users` rows can be edited/deleted from the DB here, but **not created** (new admins are invited outside this UI); the Role Permissions matrix on this same tab is Zustand-only (`roles.permissions` JSONB column exists in the schema but is unused)

---

### 11. Super Admin — `/super-admin`
**Status: Live on Supabase for its data operations; auth model changed**

- **Internal hardcoded role login removed.** The module now reads the real `authUser` set by the main Supabase Auth login instead of its own credential check
- `normal_admin` is blocked from this route entirely; `authUser.role === "management"` gates Management-only panels (e.g. the Salary Panel) versus Senior Admin
- Bulk Student Edit Wizard, Import Tool, Fee Panel, and Inventory tools now call `studentService` / `employeeService` / `reportService` / `feesService` / `inventoryService` / `expensesService`
- **Pending:** Re-verify the Import Tool actually persists to DB end-to-end (bulk insert via `studentService`) rather than just previewing — worth a smoke test

---

### 12. Tasks — `/tasks`
**Status: Live on Supabase** (`taskService.js`, ~120 lines)

- Tasks plus a `task_assignees` junction table are now DB-backed (supports multiple assignees per task)
- Dashboard-pinned tasks and the active-employee list used for assignment are both sourced from DB
- **Pending:** nothing significant

---

## Global State (Zustand — `src/lib/store.js`)

**Version: 8** (unchanged — not bumped despite the DB migration)

**Dead weight:** the legacy seed arrays `employees` (27 entries), `expenses` (10 entries), `feePayments` (5 entries), and `students` (5 dummy entries) are **still hardcoded in the file but confirmed unused** by any page now that the equivalent data comes from Supabase. Safe to delete in a later cleanup pass.

Still genuinely live in Zustand (intentionally, not yet migrated to DB):

```
authUser / setAuthUser / clearAuthUser     ← NEW: real auth session (id, name, role, initials)
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
activeClasses + setActiveClasses / activateClass / deactivateClass   ← synced from DB (unchanged)
pendingTasks                                     ← legacy; dashboard popup now reads from taskService instead
```

---

## Key Decisions Made

| Decision | Rationale |
|---|---|
| JavaScript only (no TypeScript) | Project requirement; enforced in all files |
| Next.js App Router (not Pages Router) | Modern default; all routes use `"use client"` |
| Dummy data first, Supabase later | Build UI to validate UX before designing schema |
| All pages are client components | Avoids server/client boundary complexity during early dev |
| Zustand with localStorage | Simple global state without a backend; survives page refresh |
| Custom `dev-start.js` script | Replaces `next dev` to fix port/env issues |
| Tri-lingual fee reminders (EN/HI/OD) | School has students from Odisha; Odia language needed |
| **Real auth replaces hardcoded login** | `admin_users` table holds role (`management` / `senior_admin` / `normal_admin`); `AuthGuard` wraps the dashboard layout; invite/reset flow via PKCE `auth/callback` + `auth/set-password` |
| **Super Admin's internal hardcoded login removed** | Now reuses the main `authUser`/role from Supabase Auth instead of its own credential set; `normal_admin` is blocked, `management` unlocks the Salary Panel |
| **One service file per module (`src/lib/*Service.js`)** | Keeps Supabase query logic out of page components; consistent pattern across Student/Employee/Fees/Inventory/Expenses/Notice/Report/Task/Settings |
| **`schema.sql` is a historical blueprint, not the live source of truth** | Deployed DB has drifted (`admin_users` vs `users`, `timetables` vs `timetable_period_definitions`/`timetable_entries`, ad-hoc columns like `sections.class_teacher` and `tasks.show_on_dashboard`) — code + actual Supabase tables are authoritative until reconciled |
| Notice board moved off local component state into Supabase | Removes the old "lost on refresh" limitation |
| `@supabase/ssr` installed but unused | Added as a dependency for future server-side work; everything currently goes through the browser client in `src/lib/supabase.js` |
| Salary is management-only in Super Admin + Employee modules | Base salaries stored in Zustand `employeeSalaries`; not shown to regular admins |
| Salary payments auto-sync to Expenses module | When Employee generates salary, an expense entry (category: Salary) is created automatically |
| APAAR eligibility = Birth cert + Aadhar + name match | Government requirement logic implemented in code |
| DB class names use dots/dashes; Zustand uses spaces | "JR.KG"→"JR KG", "11th - Commerce"→"11th Commerce"; `DB_TO_STORE` map in `settings/page.js` handles conversion |
| RLS disabled during development | Will be enabled once the auth model is finalized |

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
| Settings — Timetable | ✅ Live (but on a `timetables` table that drifts from `schema.sql`) |
| Settings — Year Planning / Fee Reminders / Role Permissions matrix | ⏳ Pending — still Zustand-only |
| Settings — Users & Roles (admin_users) | ◐ Partial — edit/delete live, create not wired |
| Dashboard | ✅ Live |
| Student (list/add/edit/profile/TC) | ✅ Live |
| Fees | ✅ Live |
| Employee | ◐ Partial — core CRUD + salary payments live; base salary amounts still Zustand-only |
| Inventory | ✅ Live |
| Expenses | ✅ Live |
| Notice board | ✅ Live |
| Report | ✅ Live (read-only) |
| Tasks | ✅ Live |
| Super Admin | ✅ Live for data ops; auth model now reuses main login |
| File/photo upload to Storage | ⏳ Pending |

---

## What Is NOT Yet Built

| Item | Notes |
|---|---|
| Razorpay payment flow | Package installed, no integration code |
| FCM / push notifications | Sonner toasts ready; FCM not wired |
| Student/staff photo & document upload to Storage | UI exists; DB columns save a literal string, not a real uploaded file URL |
| Employee base salary in DB | `employee_salaries` table exists, unused; `employeeSalaries` still Zustand-only |
| Year Planning / Fee Reminder templates / Role Permissions persistence | Tables exist (`year_plan_events`, `fee_reminder_templates`, `roles.permissions`), all unused — corresponding Settings UI is still Zustand-only |
| Admin-user creation UI | Settings → Users & Roles only edits/deletes `admin_users`; new admins must be invited outside this UI |
| Schema drift cleanup | `users` (unused) vs `admin_users` (live); `timetable_period_definitions`/`timetable_entries` (unused) vs `timetables` (live); ad-hoc columns (`sections.class_teacher`, `tasks.show_on_dashboard`) not reflected in `schema.sql` |
| Parent portal | Not started |
| SMS/WhatsApp delivery | Fee reminder text is ready, no send mechanism |
| Real-time notifications | No WebSocket or Supabase Realtime setup |
| Server-side/admin Supabase client | `@supabase/ssr` installed but unused; everything goes through the browser client |

---

## File Size Reference (largest files)

| File | Lines | Purpose |
|---|---|---|
| `src/app/(dashboard)/super-admin/page.js` | ~2,261 | Super admin tools + fee/salary panels — now uses real auth role gating |
| `src/app/(dashboard)/settings/page.js` | ~2,110 | School config — 8 tabs, mostly live on Supabase |
| `src/app/(dashboard)/employee/page.js` | ~1,500 | Employee + attendance + salary calculation |
| `src/app/(dashboard)/fees/page.js` | ~1,377 | Fee management |
| `src/app/(dashboard)/student/page.js` | ~1,310 | Student list |
| `src/app/(dashboard)/inventory/page.js` | ~1,299 | Inventory & assets |
| `src/app/(dashboard)/report/page.js` | ~1,177 | All reports |
| `src/app/(dashboard)/tasks/page.js` | ~725 | Task management |
| `src/lib/studentService.js` | ~694 | **Largest service** — full student/enrollment/document/sibling/promotion CRUD |
| `src/app/(dashboard)/expenses/page.js` | ~467 | Expense tracking |
| `src/app/(dashboard)/notice/page.js` | ~444 | Notice board — now DB-backed |
| `src/app/(dashboard)/dashboard/page.js` | ~439 | Dashboard overview |
| `src/lib/store.js` | ~245 | Global Zustand state — legacy dummy arrays now unused dead weight |
| `src/lib/reportService.js` | ~303 | Read-only aggregation across student/fee/employee/inventory data |
| `src/lib/inventoryService.js` | ~191 | Items/batches/usages/assets/checkouts CRUD |
| `src/lib/feesService.js` | ~169 | Fee summary joins, payment CRUD, inventory-given marking |
| `src/lib/settingsService.js` | ~161 | School/year/fee/class config + `admin_users` + `timetables` calls |
| `src/lib/taskService.js` | ~120 | Tasks + `task_assignees` CRUD |
| `src/lib/dashboardService.js` | ~114 | KPI stats, notices, low-stock alerts, activity feed |
| `src/components/AuthGuard.jsx` | ~63 | Session/role gate wrapping the dashboard layout |
| `src/lib/employeeService.js` | ~80 | Employee CRUD |
| `src/lib/noticeService.js` | ~78 | Notice CRUD |
| `src/lib/expensesService.js` | ~62 | Expense CRUD |
| `src/lib/supabase.js` | ~10 | Supabase client singleton (PKCE auth flow) |

---

## Git History Summary

| Commit | Work Done |
|---|---|
| `41f3fac` all changes done | Polish pass across login, dashboard, employee, expenses, report, settings, student add/edit/profile, super-admin, and auth callback; `expensesService`/`reportService` tweaks; `supabase.js` auth config |
| `24b1ee3` user login saved in database | Real Supabase Auth wired in: `AuthGuard`, `auth/callback`, `auth/set-password`, `admin_users`-based login; `dashboardService`/`feesService`/`reportService`/`taskService` created; Notice/Settings/Super Admin/Tasks pages rewritten against DB; `seed_fees_inventory.sql` gutted |
| `ba4ca92` Database created and supabase installed | Full `database/schema.sql` (35 tables) committed; `studentService`/`employeeService`/`inventoryService`/`expensesService`/`noticeService`/`feesService`/`dashboardService`/`settingsService` created; nearly every module's `page.js` rewritten to call these services |
| `631fa4f` file table schema created | Settings module expanded (Timetable groundwork); `store.js` updates; README expanded |
| `6643560` Frontend Done | Year Planning tab, `validators.js`, `yearPlanData.js` added; broad UI polish across student/employee/fees/inventory/report/super-admin |
| `0f8c4f7` project context updated | PROJECT_CONTEXT.md updated |
| `eeffe95` notice and expenses module ready | **Expenses** + **Notice Board** modules built; Employee gets Attendance+Salary section; Super Admin gets Salary panel; store seeded with 27 employees, salaries, timeSlots, expenses, feePayments |
| `c213c41` project context created | PROJECT_CONTEXT.md first created |
| `40ae014` import student completed | Super Admin student import from Excel finished |
| `ab8fe52` 9july updated | General updates (9 July) |
| `f5907eb` dev server change | Custom dev-start.js script |
| `594bd36` super admin changes | Super Admin module revisions |
| `7c85062` changes in super admin | Super Admin further updates |
| `c6faaa2` super admin module with login and bulk update wizard | Core Super Admin built |
| `cdfb975` assest management | Asset checkout tracking in Inventory |
| `fc8b339` inventory: storage addresses + permanent asset management | Inventory module expanded |
| `fcc6094` employee: fix doc validation, aadhar format, subject-class mapping | Employee form fixes |
| `a973fb5` employee: remove salary, add real file upload for documents | Salary removed; upload UI added |
| `ead2fee` employee module UI complete | Employee module done |
| `a44bc21` inventory module started | Inventory begun |
| `24e0ae6` FEES MODULE UI STARTED | Fees module begun |

---

## Next Integration Steps (in order)

1. **Supabase Storage** — wire real file upload for student/employee documents and photos (currently UI-only, saves literal strings)
2. **Razorpay** — connect payment flow for fee collection
3. **Migrate remaining Zustand-only config to DB** — `employeeSalaries` → `employee_salaries`; Year Planning → `year_plan_events`; Fee Reminder templates → `fee_reminder_templates`; Role Permissions matrix → `roles.permissions`
4. **Admin-user creation UI** — let Settings → Users & Roles create new `admin_users` rows (today only edit/delete)
5. **Schema cleanup** — reconcile `schema.sql` with the live DB: retire or repurpose `users`, decide between `timetables` and `timetable_period_definitions`/`timetable_entries`, formalize `sections.class_teacher` and `tasks.show_on_dashboard` as real schema columns
6. **FCM / Supabase Realtime** — push notifications, live updates
7. **Parent portal** — not started
