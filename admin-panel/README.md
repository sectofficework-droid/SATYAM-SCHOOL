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

## Next Steps

1. Review this document and correct/adjust anything above.
2. Once confirmed, design the backend database schema (Supabase/Postgres) informed by the field constraints already enforced in `src/lib/validators.js`.
3. Replace the Zustand `persist`-to-`localStorage` pattern with real API calls, module by module.
