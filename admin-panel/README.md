# Satyam Stars International School — Admin Panel

A Next.js (App Router, JavaScript only) admin panel for running the school: student records, fees, employees, expenses, inventory, notices, tasks, year planning, and a super-admin toolset.

> **Status:** Frontend is functionally complete and running on dummy/seed data. There is **no backend or database yet** — see [Current Architecture](#current-architecture) and [Known Gaps](#known-gaps--inconsistencies) below. This document is the structural map used to design the upcoming backend/database layer.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Project rules (do not break these):**
- JavaScript only — no TypeScript.
- Never run `npx next build` during development (corrupts `.next` cache and breaks CSS). Use `npm run dev` only.
- Never write/edit `.js`/`.jsx` files with PowerShell `Out-File`/`Set-Content` (adds a UTF-8 BOM that breaks Next.js CSS).

---

## Current Architecture

Everything runs through **one Zustand store** (`src/lib/store.js`) persisted to the browser's `localStorage` under the key `satyam-school-store` (version 7, no migrations defined). There is no server, no real database, and no real authentication — "saving" data today means writing to the in-memory store, which the `persist` middleware mirrors into `localStorage`.

Shared form validation lives in `src/lib/validators.js` (email, phone, pincode, Aadhar format + Verhoeff checksum, name/text length, amounts, dates, password strength, file upload checks) — this file is the best reference for the field-level constraints a real database/API should enforce.

### What's actually persisted vs. not

| Persisted in Zustand store (`localStorage`) | Local component state only (lost on refresh) |
|---|---|
| Students, Employees, Expenses, Fee payments (flat list), Session fee structure, Uniform fees, Old-student discount, Active classes, Timetables, Time slots, Role permissions, Employee salaries, Salary payments, Student inventory master list, Fee reminder templates, Year plan events, `pendingTasks` (small dashboard widget) | **Full Task Management module** (`tasks/page.js`), **Notices** (`notice/page.js`), **Inventory stock batches/usages & fixed assets** (`inventory/page.js`), Report module filters/columns, Super-Admin panel edits (Fees/Inventory/Employee/Salary/Spreadsheet tools), sibling info entered on student forms |

---

## Data Entities

### Student
One row per `(enrollment, session)` — promoting a student creates a **new** row rather than mutating the old one.

- **Identity & enrollment:** `enrollment` (auto-assigned, sequential), `grNo`, `name`, `session`, `admissionClass`
- **Academic placement:** `std` (current class), `section`, `rollNo` (auto-incremented per class+session), `dateOfJoin`
- **Personal:** `dob`, `gender`, `placeOfBirth`, `photo`
- **Family:** `fatherName`, `motherName`, `mobile`, `mobile2`
- **Religion/caste:** `religion`, `caste`/`category` (default "General"), `subCaste`, `motherTongue`
- **Physical:** `height`, `weight`
- **Address:** `roomPlotNo`, `society`, `landmark`, `area`, `pinCode`, `address`
- **Government IDs:** `aadhar` (12-digit, Verhoeff-validated, must be unique), `aadharName`, `udise` (18-digit), `pen` (11-digit), `apaar` (12-digit)
- **Previous school:** `lastSchoolName`, `lastSchoolGrNo`, `lastSchoolClass`, `lastSchoolMedium`, `lastSchoolPlace`, `prevAttendanceDays`, `lastExamGiven`, `prevPercentage`
- **Fees:** `fees: { total, paid, discount, discountReason }`
- **Tracking:** `pendingDocs[]` (document **names**, not IDs), `pendingInventory[]` (item **names**, not IDs)
- **Auth:** `password` (auto-generated: first 3 letters of first name + enrollment, e.g. `ARJ1001`)
- **Status & lifecycle:** `status` (Active / Inactive / Left), `deactivateReason`, `deactivateDate`, `tcUploaded`
- **Promotion history:** `promotedFrom: {session, std}`, `promotedTo: {session, std}`
- **Not persisted:** `siblings[]` is collected on the Add/Edit forms but discarded after submit

### Employee
- **Personal:** `empId` (auto: `EMP` + zero-padded sequence), `name`, `gender`, `dob`, `phone`, `altPhone`, `email`, `address`, `aadhar`, `pan`
- **Job:** `type` (management / teaching / non-teaching / media — gates the designation list), `designation`, `department`, `employmentType` (Permanent/Contractual/Part-time), `joiningDate` (must be ≤ today), `status`
- **Academic (teaching only):** `classTeacherOf` (single class-section or null), `subjectMappings[]` (`{subject, classes[]}`)
- **Documents:** checklist of 6 required types (Aadhar Card, PAN Card, Degree Certificate, Experience Letter, Photo, Address Proof)
- **Salary (separate store maps):** `employeeSalaries[empId] → amount`, `salaryPayments[]` (append-only log; paying an employee also auto-creates an Expense record with category "Salary")

### Fees
- `sessionFeesStructure[year][class] → tuition amount`, `uniformFees`, `oldStudentDiscount` (single global lump amount, not per-student)
- Payments are tracked in **two places at once**: inside `student.fees{total,paid}` / `student.payments[]`, and again in a flat global `feePayments[]` list used for dashboard totals — see [Known Gaps](#known-gaps--inconsistencies)
- A payment can never exceed the student's remaining due balance for their class
- Inventory distribution can be bundled into the same fee-payment form

### Expenses
`{ id, title, category (enum), amount, date, paidBy, note }` — flat array in the store.

### Inventory
- **Master list** (store-backed): `studentInventoryItems[]` — just item names (e.g. "Bag", "Uniform Set"), referenced by name from `student.pendingInventory[]`
- **Stock batches/usages and fixed-asset checkout/return tracking** (seen in `inventory/page.js`) is richer — items have `batches[]` (stock in), `usages[]` (stock out, with purpose: student/office/other), low-stock thresholds, and assets have `currentCheckout`/`checkouts[]` history — **but none of this is in the Zustand store**, it's local `useState` only and resets on reload

### Notices
`{ id, title, content, type (enum), audience (enum), date, expiryDate?, postedBy, pinned, archived }` — auto-archives when `expiryDate` passes. **Local state only, not persisted.**

### Tasks — two distinct entities sharing a name
1. `pendingTasks` (in the store): tiny quick-task widget for the Super-Admin dashboard — `{ id, text, priority, createdBy, createdAt, done }`
2. **Task Management module** (`tasks/page.js`): the real entity — `{ id, title, description, assignedTo[] (staff names), deadline, deadlineTime, priority, status, createdAt }` — **local state only, not persisted**, seeded from a hardcoded `INITIAL_TASKS` constant

### Settings-area entities
- **School profile:** name, address, city, state, pin, phone, email, website, board, medium, udise
- **Academic years:** list of `YYYY-YY` strings, `readmissionDate`, `yearEndApplied`
- **Class/section management:** `activeClasses[]` + per-class section list with a section→teacher assignment (max 5 sections/class)
- **Timetable:** `timetables[year][dayGroup][slotId][class] → {subject, teacher}`, plus `timeSlots[]` (period definitions, prayer/recess flags); teacher-collision detection prevents double-booking a teacher in the same slot
- **Fee reminder templates:** per-language (`en`/`hi`/`or`) strings with `{name} {class} {roll} {amount} {date}` placeholders
- **Role permissions matrix:** per-role boolean toggles (student_basic, student_full, fees_view, fees_class_only, fees_remind, attendance, reports, timetable)
- **Users & Roles (internal accounts):** `{ id, name, email, role, status, password }` — looks like it's meant to be the real auth source but isn't wired to any login flow yet

### Year Planning Events
`{ id, date, category, label, icon? }` — store-backed; powers the annual planning calendar with PDF/Excel export.

---

## Key Workflows

- **Admission (Add Student):** auto-assigns enrollment (max existing + 1) and roll number (max in that class + 1); conditionally requires TC/Marksheet if a previous school is given, and a caste certificate if caste ≠ General; assigns starting fees from the class fee structure.
- **Edit Student:** enrollment/session/DOB/gender/place-of-birth/class/roll are locked; everything else editable.
- **Promote to next class:** only allowed once the readmission window opens and all dues for the current class are paid. Recomputes fees for the next class, applies old-student/uniform/extra discounts, resets `pendingInventory` from the master list, creates a **new** student row, and marks the old row `promotedTo`.
- **Deactivate (temporary leave):** sets `status: "Inactive"` with a reason + date — distinct from leaving permanently.
- **Transfer Certificate / Leave:** generates a TC number, validates `leavingDate ≥ tcIssueDate`, sets `status: "Left"` — but the TC itself is only previewed/printed, not saved anywhere yet.
- **Fee payment:** select class + roll → auto-fills student → computes due = (total − discount) − paid → payment capped at due amount → can simultaneously mark pending inventory items as distributed.
- **Employee onboarding:** a 4-tab gated wizard (Personal → Job → Academic[teaching only] → Documents); each tab must validate before the next unlocks.
- **Excel bulk import (Super-Admin):** parses rows, validates each, and now (as of the recent fix) actually assigns sequential enrollment numbers and per-class roll numbers and calls `addStudent()` for every valid row — previously this was a stub that never persisted anything.
- **Notices:** create/edit with optional expiry; auto-archive sweep runs on page load; pinned notices sort first.
- **Inventory:** add stock batches in, record usage out (student distribution increments a per-item `studentsGiven` counter, capped at total enrolled); fixed assets are checked out to a person/purpose and returned later, with full history retained.
- **Tasks:** create with title/description/assignees/deadline/priority; new tasks can't have a past deadline; status moves Pending → In Progress → Completed, with an "Overdue" badge overriding the status display once the deadline passes.
- **Login:** three independent hardcoded credential checks — main app login (`admin@school.com` / `123456`), Super-Admin login (separate Management-Head/Senior-Admin user lists), and a separate Settings-page login — **none of them validate against the Users & Roles list**.

---

## Relationships

- Student ↔ Class/Section/Roll: plain string match (`std`, `section`, `rollNo`), not a foreign key.
- Student ↔ Fees: embedded object on the student record, not a separate payments table.
- Student ↔ Inventory/Documents: array of item/document **names**, matched against master lists — no per-item metadata (who/when) per student.
- Employee ↔ Subjects/Classes: embedded arrays of strings, no IDs.
- Employee ↔ Salary: separate `empId`-keyed map, not embedded in the employee object.
- Tasks ↔ Staff: `assignedTo` stores staff **names**, not employee IDs.
- Notices ↔ Audience: a plain enum string, not enforced anywhere (UI-only).

---

## Known Gaps & Inconsistencies

These are worth resolving (or deliberately deciding to keep) before designing the database schema:

1. **Tasks (full module), Notices, and Inventory (stock batches/usages + fixed assets) aren't persisted at all** — they reset on every page reload, unlike nearly everything else.
2. **Fees has two sources of truth** — `student.fees`/`student.payments[]` vs. the global flat `feePayments[]` — and the Fees page keeps its own separate local copy of student data for some views.
3. **No real authentication** — three separate hardcoded credential checks, completely disconnected from the "Users & Roles" table that looks like it should be the source of truth.
4. **Single hardcoded `user` object** in the store — there's no real concept of "who is currently logged in."
5. **`activeClasses` only goes up to 9th** — 11th/12th Commerce exist in the 15-class list but are missing from the active classes array.
6. **Document/inventory tracking is name-string based**, not ID-based — fine for a mock, but means no per-item audit trail (who issued it, when) per student.
7. **Sibling info** is collected on student forms but never saved.
8. **Transfer Certificates** are generated/previewed but never persisted — printing is the only "save."

---

## Proposed Database Schema (PostgreSQL / Supabase)

Conventions: every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` unless noted, plus `created_at TIMESTAMPTZ DEFAULT now()` (and `updated_at` where rows get edited). Field-level constraints come directly from `src/lib/validators.js` (10-digit phone, 6-digit pincode, 12-digit Aadhar, etc.). Gaps from the section above are fixed here: Tasks/Notices/Inventory become real tables, fees have one source of truth, name-string links become foreign keys, and a real `users`/`roles` table drives auth.

### Auth & Users

```sql
roles (
  id            UUID PK,
  name          TEXT UNIQUE NOT NULL,      -- 'Super Admin','Admin','Teacher','Fee Clerk','Management Head'
  permissions   JSONB NOT NULL DEFAULT '{}'  -- {student_basic: true, fees_view: true, ...}
)

users (
  id            UUID PK,                   -- = auth.users.id (Supabase Auth)
  name          TEXT NOT NULL,
  email         CITEXT UNIQUE NOT NULL,
  role_id       UUID REFERENCES roles(id),
  employee_id   UUID REFERENCES employees(id) NULL,  -- link staff login to their employee record
  status        TEXT CHECK (status IN ('Active','Inactive')) DEFAULT 'Active'
)
```

### School Settings

```sql
school_profile (        -- single row
  id            UUID PK,
  name          TEXT NOT NULL,
  address       TEXT, city TEXT, state TEXT,
  pincode       CHAR(6) CHECK (pincode ~ '^[0-9]{6}$'),
  phone         CHAR(10) CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email         CITEXT,
  website       TEXT,
  board         TEXT, medium TEXT,
  udise         TEXT CHECK (char_length(udise) BETWEEN 8 AND 11)
)

academic_years (
  id                UUID PK,
  label             TEXT UNIQUE NOT NULL,   -- '2026-27'
  start_date        DATE NOT NULL,
  admission_date    DATE,
  readmission_date  DATE CHECK (readmission_date >= admission_date),
  is_current        BOOLEAN DEFAULT false
)

classes (
  id            UUID PK,
  name          TEXT UNIQUE NOT NULL,       -- 'JR KG' ... '12th Commerce'
  sort_order    INT NOT NULL,
  is_active     BOOLEAN DEFAULT true
)

sections (
  id            UUID PK,
  class_id      UUID REFERENCES classes(id),
  name          TEXT NOT NULL,              -- 'A'..'E', max 5 per class (app-layer check)
  teacher_id    UUID REFERENCES employees(id),
  UNIQUE (class_id, name)
)

fee_structures (
  id                  UUID PK,
  academic_year_id    UUID REFERENCES academic_years(id),
  class_id            UUID REFERENCES classes(id),
  tuition_amount      NUMERIC(10,2) NOT NULL CHECK (tuition_amount > 0),
  uniform_amount      NUMERIC(10,2) DEFAULT 0,
  old_student_discount NUMERIC(10,2) DEFAULT 0,
  UNIQUE (academic_year_id, class_id)
)

fee_reminder_templates (
  id            UUID PK,
  language      TEXT CHECK (language IN ('en','hi','or')),
  template      TEXT NOT NULL,   -- placeholders: {name} {class} {roll} {amount} {date}
  UNIQUE (language)
)
```

### Students

```sql
students (                        -- one row per student, stable across sessions
  id              UUID PK,
  grno            TEXT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  dob             DATE NOT NULL,
  gender          TEXT CHECK (gender IN ('Male','Female','Other')),
  place_of_birth  TEXT,
  photo_url       TEXT,
  father_name     TEXT NOT NULL,
  mother_name     TEXT NOT NULL,
  mobile1         CHAR(10) CHECK (mobile1 ~ '^[6-9][0-9]{9}$') NOT NULL,
  mobile2         CHAR(10) CHECK (mobile2 ~ '^[6-9][0-9]{9}$'),
  religion        TEXT, caste TEXT DEFAULT 'General', sub_caste TEXT, mother_tongue TEXT,
  height_cm       NUMERIC(5,1), weight_kg NUMERIC(5,1),
  room_plot_no    TEXT, society TEXT, landmark TEXT, area TEXT,
  pincode         CHAR(6) CHECK (pincode ~ '^[0-9]{6}$'),
  address         TEXT NOT NULL,
  aadhar          CHAR(12) UNIQUE CHECK (aadhar ~ '^[0-9]{12}$'),  -- Verhoeff checksum enforced at app layer
  aadhar_name     TEXT,
  udise           CHAR(18), pen CHAR(11), apaar CHAR(12),
  password_hash   TEXT NOT NULL,            -- never store plaintext
  status          TEXT CHECK (status IN ('Active','Inactive','Left')) DEFAULT 'Active'
)

student_enrollments (             -- one row per (student, academic_year) -- replaces "promotion = new row" pattern
  id                UUID PK,
  student_id        UUID REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id  UUID REFERENCES academic_years(id),
  enrollment_no     TEXT NOT NULL UNIQUE,    -- sequential, auto-assigned
  class_id          UUID REFERENCES classes(id),
  section_id        UUID REFERENCES sections(id),
  roll_no           INT NOT NULL,
  date_of_join      DATE NOT NULL,
  admission_class_id UUID REFERENCES classes(id),  -- class at first-ever admission
  fee_total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_discount      NUMERIC(10,2) DEFAULT 0,
  discount_reason   TEXT,
  deactivate_reason TEXT, deactivate_date DATE,
  UNIQUE (academic_year_id, class_id, section_id, roll_no)
)

student_previous_school (         -- 0 or 1 row per student
  student_id        UUID PK REFERENCES students(id),
  school_name       TEXT NOT NULL,
  grno              TEXT, class TEXT, medium TEXT, place TEXT,
  attendance_days   INT CHECK (attendance_days BETWEEN 0 AND 365),
  last_exam_given   BOOLEAN,
  percentage        NUMERIC(5,2) CHECK (percentage BETWEEN 0 AND 100)
)

student_siblings (
  id            UUID PK,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  sibling_class_id UUID REFERENCES classes(id),
  sibling_name  TEXT NOT NULL
)

document_types (id UUID PK, name TEXT UNIQUE NOT NULL)   -- 'Birth Certificate','Leaving Certificate', custom ones too

student_documents (
  id              UUID PK,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES document_types(id),
  status          TEXT CHECK (status IN ('Pending','Uploaded')) DEFAULT 'Pending',
  file_url        TEXT,
  uploaded_at     TIMESTAMPTZ,
  UNIQUE (student_id, document_type_id)
)

student_promotions (              -- audit trail, replaces promotedFrom/promotedTo
  id                UUID PK,
  student_id        UUID REFERENCES students(id),
  from_enrollment_id UUID REFERENCES student_enrollments(id),
  to_enrollment_id   UUID REFERENCES student_enrollments(id),
  promoted_at        TIMESTAMPTZ DEFAULT now()
)

transfer_certificates (
  id              UUID PK,
  student_id      UUID REFERENCES students(id),
  tc_number       TEXT UNIQUE NOT NULL,
  issue_date      DATE NOT NULL,
  leaving_date    DATE NOT NULL CHECK (leaving_date >= issue_date),
  reason          TEXT NOT NULL,
  conduct         TEXT CHECK (conduct IN ('Excellent','Good','Satisfactory','Needs Improvement')),
  dues_cleared    BOOLEAN NOT NULL,
  remarks         TEXT,
  file_url        TEXT
)
```

### Fees & Payments

```sql
fee_payments (                    -- single source of truth (fixes the dual-tracking gap)
  id                UUID PK,
  enrollment_id     UUID REFERENCES student_enrollments(id),
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE NOT NULL,
  received_by       UUID REFERENCES employees(id)
)
```
`fee_due` for an enrollment = `fee_total - fee_discount - SUM(fee_payments.amount)`, computed via a view rather than stored.

```sql
v_student_fee_summary AS
  SELECT enrollment_id, fee_total - fee_discount - COALESCE(SUM(amount),0) AS due
  FROM student_enrollments LEFT JOIN fee_payments ON ... GROUP BY ...
```

### Employees & Payroll

```sql
employees (
  id              UUID PK,
  emp_code        TEXT UNIQUE NOT NULL,     -- 'EMP001'
  name            TEXT NOT NULL,
  gender          TEXT CHECK (gender IN ('Male','Female','Other')),
  dob             DATE,
  phone           CHAR(10) CHECK (phone ~ '^[6-9][0-9]{9}$') NOT NULL,
  alt_phone       CHAR(10),
  email           CITEXT,
  address         TEXT,
  aadhar          CHAR(12) CHECK (aadhar ~ '^[0-9]{12}$'),
  pan             CHAR(10) CHECK (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  type            TEXT CHECK (type IN ('management','teaching','non-teaching','media')) NOT NULL,
  designation     TEXT NOT NULL,
  department      TEXT NOT NULL,
  employment_type TEXT CHECK (employment_type IN ('Permanent','Contractual','Part-time')),
  joining_date    DATE NOT NULL CHECK (joining_date <= CURRENT_DATE),
  status          TEXT CHECK (status IN ('Active','Inactive')) DEFAULT 'Active',
  class_teacher_of_section_id UUID REFERENCES sections(id)   -- teaching only
)

employee_documents (
  id            UUID PK,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  doc_name      TEXT NOT NULL,    -- 'Aadhar Card','PAN Card','Degree Certificate', etc.
  uploaded      BOOLEAN DEFAULT false,
  file_url      TEXT
)

employee_subject_mappings (
  id            UUID PK,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  class_id      UUID REFERENCES classes(id)
)

employee_salaries (
  employee_id   UUID PK REFERENCES employees(id),
  monthly_amount NUMERIC(10,2) NOT NULL CHECK (monthly_amount > 0)
)

salary_payments (
  id            UUID PK,
  employee_id   UUID REFERENCES employees(id),
  month         DATE NOT NULL,           -- first-of-month marker
  amount        NUMERIC(10,2) NOT NULL,
  paid_on       DATE NOT NULL,
  paid_by       UUID REFERENCES employees(id),
  UNIQUE (employee_id, month)            -- prevents double-paying same month
)
```
Paying salary also inserts a matching row into `expenses` (category `'Salary'`) — keep as an application-layer transaction, not a trigger, so it stays easy to audit.

### Expenses

```sql
expenses (
  id            UUID PK,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  category      TEXT CHECK (category IN ('Salary','Infrastructure','Supplies','Utilities','Events','Maintenance','Transport','Other')),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount BETWEEN 1 AND 1000000),
  expense_date  DATE NOT NULL,
  paid_by       UUID REFERENCES employees(id),
  note          TEXT CHECK (char_length(note) <= 500)
)
```

### Inventory & Assets

```sql
inventory_items (
  id            UUID PK,
  name          TEXT UNIQUE NOT NULL,
  category      TEXT CHECK (category IN ('student','office','other')),
  unit          TEXT NOT NULL,             -- 'Pcs','Sets','Box'
  low_stock_at  INT DEFAULT 10,
  storage_address TEXT
)

inventory_batches (    -- stock received (in)
  id            UUID PK,
  item_id       UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty           INT NOT NULL CHECK (qty BETWEEN 1 AND 100000),
  received_date DATE NOT NULL,
  received_by   UUID REFERENCES employees(id),
  note          TEXT
)

inventory_usages (     -- stock issued (out)
  id            UUID PK,
  item_id       UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty           INT NOT NULL CHECK (qty > 0),
  usage_date    DATE NOT NULL,
  purpose       TEXT CHECK (purpose IN ('student','office','other')),
  used_by       UUID REFERENCES employees(id),
  note          TEXT
)

student_inventory_assignments (   -- replaces name-string pendingInventory[]
  id            UUID PK,
  enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory_items(id),
  status        TEXT CHECK (status IN ('Pending','Given')) DEFAULT 'Pending',
  given_date    DATE,
  UNIQUE (enrollment_id, item_id)
)

assets (
  id              UUID PK,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  brand           TEXT,
  storage_address TEXT NOT NULL
)

asset_checkouts (
  id            UUID PK,
  asset_id      UUID REFERENCES assets(id) ON DELETE CASCADE,
  taken_by      UUID REFERENCES employees(id),
  purpose       TEXT NOT NULL,
  taken_date    DATE NOT NULL,
  return_date   DATE      -- NULL while still checked out
)
```
"Asset currently in use" = the checkout row for that asset with `return_date IS NULL` (at most one per asset, enforced at app layer or a partial unique index on `(asset_id) WHERE return_date IS NULL`).

### Notices

```sql
notices (
  id            UUID PK,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 2000),
  type          TEXT CHECK (type IN ('Academic','Event','Holiday','Fee','Circular','General','Urgent')),
  audience      TEXT CHECK (audience IN ('Everyone','All Students','All Staff','Parents','Management')),
  posted_date   DATE NOT NULL,
  expiry_date   DATE CHECK (expiry_date >= posted_date),
  posted_by     UUID REFERENCES employees(id),
  pinned        BOOLEAN DEFAULT false,
  archived      BOOLEAN DEFAULT false      -- flip true once expiry_date < CURRENT_DATE (cron or app check)
)
```

### Tasks

```sql
tasks (
  id            UUID PK,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description   TEXT CHECK (char_length(description) <= 1000),
  deadline_date TEXT NOT NULL,
  deadline_time TIME,                      -- NULL = end of day
  priority      TEXT CHECK (priority IN ('High','Medium','Low')),
  status        TEXT CHECK (status IN ('Pending','In Progress','Completed')) DEFAULT 'Pending',
  created_by    UUID REFERENCES employees(id)
)

task_assignees (        -- many-to-many, replaces assignedTo[] of names
  task_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id   UUID REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, employee_id)
)

pending_tasks (          -- keep the small Super-Admin quick-widget separate, it's a different feature
  id            UUID PK,
  text          TEXT NOT NULL,
  priority      TEXT CHECK (priority IN ('High','Medium','Low')),
  created_by    UUID REFERENCES employees(id),
  done          BOOLEAN DEFAULT false
)
```

### Timetable

The period structure is fully dynamic — admins can add, remove, reorder, rename, or adjust times for any period or break on any day group in any academic year without touching code. Moving recess after period 3 instead of period 4 is just an `UPDATE sort_order`. Adding an extra period 8 is just an `INSERT`. Saturday having fewer periods than weekdays is just a different set of rows for `day_group = 'Saturday'`.

```sql
-- Step 1: Define what periods exist on a given day group in a given academic year.
-- This is the "structure" of the day — completely editable at any time.
timetable_period_definitions (
  id                UUID PK,
  academic_year_id  UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  day_group         TEXT NOT NULL CHECK (day_group IN ('Mon-Wed','Thu-Fri','Saturday')),
  sort_order        INT NOT NULL,           -- 1, 2, 3 ... controls display order
  label             TEXT NOT NULL,          -- 'Prayer', 'Period 1', 'Recess', 'Period 6', etc.
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL CHECK (end_time > start_time),
  is_break          BOOLEAN DEFAULT false,  -- true = Prayer/Recess/Assembly; no subject assigned
  UNIQUE (academic_year_id, day_group, sort_order)
)

-- Step 2: For each non-break period, assign a subject+teacher per section.
-- Entries are created only for non-break periods (is_break = false).
timetable_entries (
  id                    UUID PK,
  period_definition_id  UUID REFERENCES timetable_period_definitions(id) ON DELETE CASCADE,
  section_id            UUID REFERENCES sections(id) ON DELETE CASCADE,
  subject               TEXT,
  teacher_id            UUID REFERENCES employees(id),
  UNIQUE (period_definition_id, section_id)
  -- teacher-collision (same teacher, same slot, two sections) enforced at app layer
)
```

**How dynamic changes work:**

| Admin action | DB operation |
|---|---|
| Change recess from after period 4 to after period 3 | `UPDATE sort_order` on the Recess and Period 4 rows |
| Add extra Period 8 on Mon-Wed | `INSERT` one row into `timetable_period_definitions` with `sort_order = 8` |
| Extend period time (e.g. last period 3:00→3:30) | `UPDATE start_time / end_time` on that definition row |
| Remove a period from Saturday | `DELETE` that definition row (cascades to its `timetable_entries`) |
| Copy last year's structure to new year | `INSERT INTO timetable_period_definitions SELECT ... WHERE academic_year_id = old_year` |
| Different Saturday timings vs weekdays | Separate rows for `day_group = 'Saturday'` with their own times |

### Year Planning

```sql
year_plan_events (
  id            UUID PK,
  event_date    DATE NOT NULL,
  category      TEXT NOT NULL,
  label         TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  icon          TEXT,
  UNIQUE (event_date, label)    -- case-insensitive duplicate check enforced at app layer
)
```

### Relationship summary

- `students` 1—N `student_enrollments` (one row per academic year; this is what `promotedFrom`/`promotedTo` becomes)
- `student_enrollments` 1—N `fee_payments`, 1—N `student_inventory_assignments`
- `students` 1—N `student_documents`, 0/1 `student_previous_school`, N `student_siblings`, N `transfer_certificates`
- `employees` 1—N `employee_documents`, `employee_subject_mappings`, `salary_payments`; 0/1 `employee_salaries`
- `tasks` N—N `employees` via `task_assignees`
- `classes` 1—N `sections` 1—N `student_enrollments`, `timetable_entries`
- `inventory_items` 1—N `inventory_batches`, `inventory_usages`, `student_inventory_assignments`
- `assets` 1—N `asset_checkouts`

## Next Steps

1. Review this document and correct/adjust anything above.
2. Stand up these tables in Supabase, then replace the Zustand `persist`-to-`localStorage` pattern with real API calls, module by module.
