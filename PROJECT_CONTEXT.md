# PROJECT CONTEXT — Satyam Stars International School ERP

> **As of:** 11 June 2026 (commit `eeffe95`)  
> **Branch:** main  
> **Working directory:** `D:\SATYAM-SCHOOL\admin-panel`

---

## Project Overview

A single-app Next.js 14 school management ERP for **Satyam Stars International School**, Surat, Gujarat (GSEB Board, English Medium). The entire system lives in `admin-panel/` as a monolithic Next.js App Router application. The frontend is complete with dummy data; the Supabase backend has not been connected yet.

**Scale:** ~1,000+ students, 50+ staff, 15 classes (JR KG → 12th Commerce).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.35 (React 18, App Router) |
| Language | **JavaScript only — no TypeScript** |
| Styling | Tailwind CSS 3.4.1 + custom school brand colors |
| Icons | Lucide React |
| State | Zustand 5 (with localStorage persist) |
| Forms | React Hook Form 7 + Zod 4 |
| Database (pending) | Supabase (package installed, not connected) |
| Auth (pending) | Supabase Auth (currently hardcoded credentials) |
| Payments (pending) | Razorpay (package installed, not connected) |
| Export | XLSX (Excel) + jsPDF + jspdf-autotable (PDF) |
| Charts | Recharts 3 |
| Notifications | Sonner (toasts); FCM not yet integrated |
| Dev Server | Custom `scripts/dev-start.js` (run via `npm run dev`) |

**Brand colors:** `school-navy` (#1e3a5f), `school-gold` (#f59e0b)

---

## Route Map

```
/login                        ← Auth (hardcoded admin@school.com / 123456)
/dashboard                    ← Overview: KPIs, charts, notices, activity feed
/student                      ← Student list + filters + export
/student/add                  ← Add new student form
/student/[id]                 ← Student profile view
/student/[id]/edit            ← Edit student details
/student/[id]/tc              ← Transfer Certificate generation
/fees                         ← Fee structure, collection, reminders
/employee                     ← Staff profiles, attendance, salary calculation
/inventory                    ← Stock items, assets, distribution
/expenses                     ← School expense tracking (NEW — eeffe95)
/notice                       ← Notice board: post/pin/archive notices (NEW — eeffe95)
/report                       ← Reports (UI complete — see details below)
/tasks                        ← Task management (assign to staff, track)
/settings                     ← School config, fee structure, user accounts
/super-admin                  ← Bulk student edit wizard, import tool, role login, salary panel
```

---

## Module Status

### 1. Authentication — `/login`
**Status: Complete (frontend only)**

- Email + password form with "remember me" and forgot-password link
- Hardcoded credentials: `admin@school.com` / `123456`
- Super Admin has its own role-based login inside the Super Admin module (not a separate route)
- **Pending:** Replace hardcoded auth with Supabase Auth

---

### 2. Dashboard — `/dashboard`
**Status: Complete (dummy data)**

- KPI cards: Total Students (1,247), Total Staff (68), Fee Collection, Expenses
- Bar charts: Student attendance by class, Employee attendance by week (Recharts)
- Recent notices (4 items) with type badges
- Inventory low-stock alerts (3 items)
- Recent activity feed (7 items: admissions, fee payments, profile updates)
- Pending Tasks popup (session-persistent, reads from Zustand store)
- **Pending:** Wire all stats to real Supabase queries

---

### 3. Student Management — `/student/*`
**Status: Complete (frontend + dummy data)**

#### Student List (`/student`)
- 6-column grid card layout (photo, info, IDs, alerts, fee summary, actions)
- Filters: search (name / enrollment / father name), class, session, pending docs (multi-select), pending govt ID (UDISE / PEN / APAAR)
- Alerts on cards: TC upload warning, pending documents, pending inventory items
- Actions: Edit, View Profile, Deactivate (modal with reason + date), Promote (with discount/uniform fee calculation)
- Export: Excel and PDF (respects active filters)
- Dummy data: 5 students (Arjun Patel, Priya Shah, Rohan Mehta, Sneha Desai, Dev Joshi)

#### Add Student (`/student/add`)
- Multi-section form: Admission info, Personal, Contact, Birth, Previous School, Govt IDs, Documents
- Auto-assigns enrollment number, class selection from 15-class list

#### Student Profile (`/student/[id]`)
- Full profile view: personal details, fee history, document tracking, inventory assignments

#### Edit Student (`/student/[id]/edit`)
- Full editable form, mirrors Add Student layout

#### Transfer Certificate (`/student/[id]/tc`)
- TC generation with DOB-in-words helper
- TC upload tracking (shows warning on student card if not uploaded after TC issued)

#### Government ID Eligibility Logic
- **UDISE eligibility:** Birth certificate required
- **PEN eligibility:** Birth certificate + Aadhar required
- **APAAR eligibility:** Birth certificate + Aadhar + name match on Aadhar required
- Computed dynamically in both Student List and Report module

**Pending:** Backend storage for all student data, photo upload to Supabase storage

---

### 4. Fees — `/fees`
**Status: Complete (frontend only)**

- Fee structure display: 15 class-based annual fees (₹14,500 – ₹19,000)
- Fee entry flow: Select student → view fee summary → record payment → mark inventory distribution
- Fee summary: Total fee, discount amount + reason, actual fee, paid amount, balance due
- Payment history table: dates, amounts, received-by staff
- Inventory distribution: mark items given (auto-dates to today)
- Fee reminders: tri-lingual templates (English / Hindi / Odia), last-date selector, editable message body, per-student amounts filled automatically
- Fee overview table: filter by class/status, search by name/roll, individual notify modal with language toggle
- **Pending:** Razorpay integration for online payments, SMS/WhatsApp delivery of reminders

---

### 5. Employee Management — `/employee`
**Status: Complete (frontend only)**

- 27 employees seeded in Zustand store (EMP001–EMP027): 1 Principal, 7 Admin/Non-Teaching, 1 Media, 1 Care Taker, 16 Teaching, 1 Social Media Manager
- Profile fields: Personal (name, DOB, phone, email, Aadhar, PAN), Job (designation, dept, joining date, employment type), Academic (class teacher of, subject→class mappings)
- Document tracking: Aadhar, PAN, Degree, Experience Letter, Photo, Address Proof (6 docs each)
- View modal: complete profile with document status
- Add modal: 4-tab form (Personal / Job / Academic / Documents) with file upload UI
- Table filters: Type (Management / Teaching / Non-Teaching), Department, text search (name / ID / designation)
- Stats cards: Total staff, Teaching, Non-Teaching, Management
- **Attendance + Salary Calculation section (added eeffe95):**
  - Select from/to date range → compute present/absent/leave days per employee
  - Auto-calculate per-day rate and deduction; shows net salary
  - "Generate Salary" button: marks as paid, writes salary payment records to Zustand `salaryPayments`, and auto-creates an expense entry in the Expenses module (category: Salary)
  - Export salary calculation to Excel
- **Pending:** Backend storage, actual file upload to Supabase storage

---

### 6. Inventory — `/inventory`
**Status: Complete (frontend only)**

- 9 consumable items (6 student-distributed, 3 office supplies) with batch tracking
- Batch management: add batches with date, received-by, quantity, notes
- Usage history: distributions by qty, date, purpose, notes
- Low-stock alerts: configurable minimum thresholds
- Storage location tracking: room, shelf, drawer per item
- 8 permanent assets (microphone, camera, laptop, etc.) with checkout tracking (checked out to, date)
- Student distribution tracking: items given vs total needed per student
- **Pending:** Backend persistence

---

### 7. Expenses — `/expenses`
**Status: Complete (frontend only) — added in commit eeffe95**

- Track all school outgoings: 8 categories (Salary, Infrastructure, Supplies, Utilities, Events, Maintenance, Transport, Other)
- KPI cards: Total all-time, This Month total, Top category by spend
- Expense list with color-coded category badges; sorted newest-first
- Filters: search (title / paid-by), category filter, month filter
- Add Expense modal: title, category, amount, date, paid-by (admin dropdown), optional note
- Delete expense (with confirm dialog)
- Salary payments from the Employee module auto-appear here as Salary category entries (Zustand sync)
- Export filtered list to Excel and PDF
- Data lives in Zustand `expenses` array (persisted via localStorage)
- **Pending:** Supabase persistence

---

### 8. Notice Board — `/notice`
**Status: Complete (frontend only) — added in commit eeffe95**

- 7 notice types: Academic, Event, Holiday, Fee, Circular, General, Urgent (each with its own color badge)
- 5 audience targets: Everyone, All Students, All Staff, Parents, Management
- Notice card features: pin/unpin, edit, archive/restore, delete
- Days-until-expiry indicator on each card (shows "Expired" when past expiry date)
- Filter by type, audience, and active/archived view
- Search by title
- Post Notice modal: title, content, type, audience, posted date, expiry date (optional), posted-by (admin dropdown), pin toggle
- Edit support: pre-fills all fields from existing notice
- Data is local component state (NOT in Zustand store); does not persist across refreshes
- **Pending:** Move to Zustand/Supabase for persistence

---

### 9. Report — `/report`

**Status: Complete (frontend only)**

- 4 report types accessible via tab/section UI:
  1. **Student Reports** — filterable list with eligibility columns (UDISE / PEN / APAAR), export Excel/PDF
  2. **Employee Reports** — staff listing with document status, export
  3. **Fee Reports** — fee collection summary by class/session
  4. **Inventory Reports** — stock levels, asset status
- DOB-to-words conversion function for TC/certificate use built into this module
- Govt ID eligibility logic fully implemented here (same rules as Student module)
- Export available in both Excel and PDF for all report types
- **Pending:** Real data from Supabase; no backend yet

---

### 10. Settings — `/settings`
**Status: Complete (frontend only)**

- School info editor: name, board, medium, address, phone, email, logo
- Academic year management: add/remove session years
- Fee structure editor: set annual fee per class
- User accounts panel: add users with name, email, role (Super Admin / Admin / Teacher), password management (show/hide toggle)
- Class activation: enable/disable individual classes
- Board and medium configuration
- Export school data to Excel/PDF
- **Pending:** Persist all settings to Supabase; currently reads/writes Zustand + localStorage only

---

### 11. Super Admin — `/super-admin`
**Status: Complete (frontend only)**

This module has its own internal role-based login before showing content:

**Role credentials (hardcoded):**
- Management: `Sunil Pradhan` / `sunil123`
- Senior Admin: `Rajesh Biswal` / `rajesh123` or `BK Debiprasad Das` / `bkdas123`

**Features:**
- **Bulk Student Edit Wizard:** Select class → select fields to update → edit per-student → save all at once
- **Student Import Tool:** Import students from Excel file (maps columns to student fields), preview before save
- **Role Permissions Panel:** View/toggle what each role (Admin, Teacher) can access per module
- **System-wide config:** Active classes, readmission date, uniform fee per class, old student discount
- **Task creation:** Add tasks with priority and assign to a staff member (writes to Zustand store)
- **Salary Panel (Management-only, added eeffe95):** View/edit base monthly salary per employee (reads `employeeSalaries` from Zustand); view all salary payment history from `salaryPayments`
- **History / Audit log:** View recent bulk actions (session-only, not persisted)

**Last commits touching this module:** `notice and expeneces module ready`, `super admin changes`, `super admin module with login and bulk update wizard`, `import student completed`

**Pending:** Backend integration; import currently does not persist to DB

---

### 12. Tasks — `/tasks`
**Status: Complete (frontend only)**

- Task list view: all tasks with priority badges (High / Medium / Low), assigned-to, created-by, due date
- Add task modal: title, description, priority, assign to (staff dropdown with 20+ names), due date
- Status tracking: Pending → In Progress → Done
- Edit and delete tasks
- Filter by status / priority / assignee
- Tasks also surfaced on Dashboard as a popup (incomplete tasks only)
- State lives in Zustand store (not persisted to DB)
- **Pending:** Supabase table for tasks, real assignment notifications

---

## Global State (Zustand — `src/lib/store.js`)

```
sidebarOpen / toggleSidebar / closeSidebar
user: { name, role, email, initials }
readmissionDate
activeClasses: 15-item array (JR KG → 12th Commerce)
timetables: {}
timeSlots: [{id, label, time, special?}]  ← 7 slots: Prayer, P1–P5, Recess
setTimeSlots
uniformFees: { [className]: amount }
oldStudentDiscount: 1000   ← fixed ₹1,000 for returning students
employees: [27 seeded staff, EMP001–EMP027]
rolePermissions: {}
employeeSalaries: { [empId]: monthlyAmount }   ← management-only view
updateEmployeeSalary(empId, amount)
salaryPayments: []     ← auto-populated when Employee module generates salary
addSalaryPayments(payments)
expenses: [seeded with 10 initial entries]
setExpenses(list)
feePayments: [seeded with 5 entries for dashboard totals]
pendingTasks: [{ id, text, priority, createdBy, done }]
addTask / toggleTask / deleteTask
```

All state uses localStorage persistence via Zustand `persist` middleware.

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
| Super Admin has its own internal login | Prevents accidental access; no separate auth route needed |
| Salary is management-only in Super Admin + Employee modules | Base salaries stored in `employeeSalaries` Zustand map; not shown to regular admins |
| Salary payments auto-sync to Expenses module | When Employee generates salary, an expense entry (category: Salary) is created automatically via Zustand |
| Notice board state is local (not in Zustand) | Notices are session-only until Supabase integration |
| APAAR eligibility = Birth cert + Aadhar + name match | Government requirement logic implemented in code |

---

## Constraints & Rules (DO NOT VIOLATE)

1. **Never run `npx next build`** during development — corrupts `.next` cache and breaks all CSS.
2. **Never use PowerShell `Out-File` or `Set-Content`** on JS/JSX files — adds UTF-8 BOM and breaks Next.js CSS loading. Always use the `Write` tool instead.
3. **No TypeScript** — all new files must be `.js` or `.jsx`.
4. **Dev server:** always start with `npm run dev` (uses `scripts/dev-start.js`), not `next dev` directly.

---

## What Is NOT Yet Built

| Item | Notes |
|---|---|
| Supabase schema / migrations | No SQL files exist yet; DB design pending |
| Real authentication | Hardcoded credentials everywhere |
| Razorpay payment flow | Package installed, no integration code |
| FCM / push notifications | Sonner toasts ready; FCM not wired |
| Student/staff photo upload | UI elements exist, no Supabase storage calls |
| Timetable module | `timeSlots` and `timetables` in Zustand; no page built yet |
| Attendance module | Referenced in dashboard charts, no dedicated page |
| Parent portal | Not started |
| SMS/WhatsApp delivery | Fee reminder text is ready, no send mechanism |
| Real-time notifications | No WebSocket or Supabase Realtime setup |

---

## File Size Reference (largest files)

| File | Lines | Purpose |
|---|---|---|
| `src/app/(dashboard)/employee/page.js` | ~1,250+ | Employee + attendance + salary calculation |
| `src/app/(dashboard)/fees/page.js` | ~1,250 | Fee management |
| `src/app/(dashboard)/student/page.js` | ~1,235 | Student list |
| `src/app/(dashboard)/super-admin/page.js` | ~1,200+ | Super admin tools + salary panel |
| `src/app/(dashboard)/notice/page.js` | ~416 | Notice board (NEW) |
| `src/app/(dashboard)/report/page.js` | ~800+ | All reports |
| `src/app/(dashboard)/settings/page.js` | ~850+ | School config |
| `src/app/(dashboard)/expenses/page.js` | ~348 | Expense tracking (NEW) |
| `src/app/(dashboard)/inventory/page.js` | ~770+ | Inventory & assets |
| `src/app/(dashboard)/tasks/page.js` | ~500+ | Task management |
| `src/lib/store.js` | ~320+ | Global Zustand state (seeded employees, salaries, expenses) |

---

## Git History Summary

| Commit | Work Done |
|---|---|
| `eeffe95` notice and expenses module ready | **Expenses** + **Notice Board** modules built; Employee gets Attendance+Salary section; Super Admin gets Salary panel; store seeded with 27 employees, salaries, timeSlots, expenses, feePayments |
| `c213c41` project context created | PROJECT_CONTEXT.md created |
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
