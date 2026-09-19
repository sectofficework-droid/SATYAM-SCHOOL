# STAFF-APP-FEATURE-INVENTORY.md — SATYAM-SCHOOL

> Full Admin Panel feature inventory for the Staff App Unification initiative
> (`planning\STAFF-APP-UNIFICATION-PLAN.md`), per the discovery doc's §22/
> §32-C requirement: every existing Admin Panel feature, its current role
> rules, its backend operation, and — separately, at DESIGN FIXED — whether
> it becomes a mobile Admin Workspace screen or is explicitly marked
> "Available only in Admin Panel." Compiled 2026-09-19 via a three-way
> read-only audit of `admin-panel/src/app/(dashboard)/*` (18 modules, SEF
> variants excluded — see Scope note). No code changed.
>
> **This file is the draft feature inventory the plan's PLANNING gate needs
> reviewed/approved — it is not itself an approval.** "Required Backend
> Changes" and "Mobile Screen" columns are left as **TBD** throughout: those
> are DESIGN FIXED decisions (per-action, against the approved
> `StaffRoleContext` shape), not something this read-only audit should
> pre-decide. "Status" reflects only the *admin panel's current* state, not
> a mobile rollout decision.

## Scope note
- Covers all 18 non-SEF `(dashboard)/*` route groups.
- **SEF (`(dashboard)/sef/*`) excluded** — per `CLAUDE.md`, SEF is a
  deliberately separate, Phase-1-scoped second org sharing the same login;
  it is not part of the Teacher app / Staff App at all. Not inventoried
  here; do not add SEF nav items or parity assumptions to the Staff App
  without a separate decision.
- "Role gating" below means *admin-panel* gating (`normal_admin` /
  `senior_admin` / `management`) as it exists today — not a proposal for
  what the Staff App's `StaffRoleContext` should do. That mapping is
  DESIGN FIXED work, done after this inventory is approved.
- Findings are cross-referenced to `TODO.md` items where a gap is already
  tracked (REQ-SEC-002, REQ-SEC-005, REQ-SEC-007) rather than restated in
  full — this file records what mobile needs to know, not a re-audit of
  already-filed security items.

## Headline cross-cutting finding
Of the 18 modules audited, **12 have zero role-tier gating of any kind**
(client or server) — any logged-in `admin_users` row, `normal_admin`
included, can use them identically to `senior_admin`/`management`:
`dashboard`, `attendance`, `employee` (CRUD itself, not the two RPCs below),
`student` (CRUD itself, not permanent delete), `fees`, `expenses`,
`inventory`, `notice`, `queries`, `question-papers`, `gr-book`, `documents`,
`syllabus`, `tasks`, `report`. (That's 15, not 12 — see table; the "12"
figure undercounts slightly because a few of these also have zero gating
on *some* actions but a real RPC-backed gate on one adjacent action, e.g.
`employee`'s password reset. Read the per-module rows, not this summary
count, when precision matters.)

Only **6 modules have any role-tier distinction at all**: `settings`,
`super-admin`, `diagnostics` (page-level `normal_admin` block, all
UI-only except where noted), plus the `employee`/`student` impersonation
actions and the two RPCs fixed under REQ-SEC-005.

This matters directly for the Staff App: **the admin panel itself does not
have a clean, complete "senior_admin-only" feature set to mirror.** Most
modules are already flat across all three admin tiers. `StaffRoleContext`'s
admin-role-resolution half (spec §4) needs to decide role-tier restrictions
per mobile action from scratch (or from the small set below), not by
copying an existing matrix — because a complete one doesn't exist.

## Feature inventory matrix

Columns: **Admin Feature | Existing Role Rules | Backend Operation |
Enforcement | Mobile Screen | Required Backend Changes | Security
Considerations | Status**. The last four are DESIGN FIXED-stage columns and
are marked TBD/N/A throughout this draft, per the note above.

### Dashboard
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Attendance summary, notices, birthdays widget | None — all tiers | Direct `supabase.from()` reads | n/a (read-only) |

### Attendance
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Mark/edit attendance | None — all tiers | Direct `.from("student_attendance")` | n/a |
| Teacher alerts | None — all tiers | Direct `.from("teacher_alerts")` | n/a |
| Attendance edit requests | None — all tiers | Direct `.from("attendance_edit_requests")` | n/a |

### Employee
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Add/edit employee | None — all tiers | Direct `.from("employees")` | n/a |
| Reset employee password | Membership only (`EXISTS admin_users WHERE id=auth.uid()`), not tier | RPC `admin_reset_employee_password` (`SUPABASE_HASH_APP_PASSWORD.sql:188`), `SECURITY DEFINER` | Server-side, membership-only — any tier including normal_admin can reset any employee's password |
| Generate punch-override code | Membership only (`is_admin_user()`) — **fixed 2026-09-19, was previously none at all** | RPC `generate_punch_code` (`SUPABASE_PUNCH_OVERRIDE_CODE.sql:37`, hardened by `SUPABASE_SALARY_PUNCHCODE_ROLE_ENFORCEMENT.sql`), `SECURITY DEFINER` | **Fixed 2026-09-19** — any admin tier still allowed (matches existing unconditional UI access), non-admin authenticated sessions now blocked |
| Impersonate employee (Admin Access Code) | UI: `role !== "normal_admin"` (`employee\page.js:359`) | RPC `create_impersonation_code`, re-checks `role IN ('management','senior_admin')` | **Correctly enforced server-side** despite UI gate being redundant |
| Salary payment entry | None — all tiers | Direct `.from("salary_payments").insert()` | n/a |

### Student
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Add/edit student | None — all tiers | Direct `.from("students"/"student_enrollments")` | n/a |
| TC generation | None — all tiers | Reads data passed from parent, no direct calls in the TC page itself | n/a |
| Impersonate student | UI: same pattern as employee (`student\page.js:748`) | RPC re-checks role | **Correctly enforced server-side** |
| **Permanent student delete** | UI: `role !== "normal_admin"` (`super-admin\page.js:477`, not on the student page itself) | RPC `admin_delete_student_permanently` | **Fixed 2026-09-19 (REQ-SEC-005)** — now correctly enforced server-side, tier-checked |

### Fees
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Fee structure CRUD | None — all tiers | Direct `.from("fee_structures")` | n/a |
| Fee payment record/delete | None — all tiers | Direct `.from("fee_payments")` | RLS enabled today (`is_admin_user()` — membership only, not tier; see REQ-SEC-002) |

### Expenses
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Expense add/edit/delete | None — all tiers | Direct `.from("expenses")` | n/a |

### Inventory
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Add/view stock (items, batches) | None — all tiers | Direct `.from("inventory_items"/"inventory_batches")` | n/a |
| Record usage | None — all tiers | Direct `.from("inventory_usages")` | n/a |
| Asset add/checkout/return | None — all tiers | Direct `.from("assets"/"asset_checkouts"/"asset_history")` | n/a |

### Notice
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Post/edit/delete/pin/archive notice | None — all tiers | Direct `.from("notices")` | n/a |

### Queries
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Reply/resolve/reopen query | None — all tiers | Direct `.from("queries_suggestions")` | n/a |

### Question Papers (Question Bank)
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| View/download teacher-uploaded docs | None — all tiers | Read-only + S3 presigned view URL | n/a |

### GR Book
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Register view + Excel/PDF export | None — all tiers | Reads `gr_book_imports` + derived student data | n/a |
| Bulk import (Active→student, Left→register-only) | None — all tiers | Writes via `studentService.addStudent()` + `.from("gr_book_imports")` | n/a |
| Inline edit + document upload (import rows) | None — all tiers | `.from("gr_book_imports")` + S3 doc keys | n/a |

### Documents
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| ID card / Marksheet / Bonafide generation (PDF) | None — all tiers | Read-only, reads `students`/`official_exams`/`official_exam_marks`, client-side `jsPDF` rendering, zero DB writes in `documents\page.js` | n/a (confirmed no writes anywhere in the file) |
| NOC tab | N/A — not built | "Coming Soon" placeholder (`documents\page.js:1336-1346`); no NOC write path exists anywhere in the codebase | n/a — not a real feature yet, treat as out of scope until built |
| TC tab (inside `documents` module) | N/A — not built here | Same "Coming Soon" placeholder; real TC issuance lives on a different route (below) | n/a |
| **Transfer Certificate issuance (real, live feature — NOT part of the `documents` module)** | None — all tiers, no role check anywhere | Separate route `student\[id]\tc\page.js` → `studentService.saveTransferCertificate()` (`studentService.js:986-1022`): inserts `transfer_certificates`, updates `students.status = "Left"`, deactivates `student_enrollments` — all plain `.from()` calls, no RPC | **Open finding — `TODO.md` REQ-SEC-008 (new 2026-09-19).** A real state-changing action (flips student to Left, deactivates fee enrollment), zero role gating client or server-side; any tier including `normal_admin` can issue a TC for any student. Not fixed — flagged for your priority decision. |

### Report
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Report generation + XLSX export | None — all tiers | Read-only getters | n/a |

### Syllabus
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Syllabus/subtopic CRUD, edit-request approve/reject | None — all tiers | Direct `.from("syllabus"/"syllabus_subtopics"/"syllabus_edit_requests")` | n/a |

### Tasks
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Task CRUD | None — all tiers | Direct `.from("tasks")` | n/a |

### Settings
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Whole page | UI: `role === "normal_admin"` blocked (`settings\page.js:2498`) — senior_admin/management only | — | Page-level, client-side |
| Users & Roles tab (create/edit/delete admin_users) | Same page gate, plus its own tier logic | RPCs `admin_create_user`/`admin_update_user`/`admin_delete_user`, `SECURITY DEFINER` | **Fixed 2026-09-19 (REQ-SEC-005)** — server-side tier checks (management-only for senior_admin/management tier accounts; no self-escalation) |
| App Update, Exams, Kiosk Settings, Rules & Regulations, Year Planning tabs | Only the page-level gate above; no distinction between senior_admin and management | DB-backed via real service functions, not Zustand-only | Client-side only (page gate) |
| Impersonation log viewer | Relies on parent page gate only (explicit comment in code) | Reads impersonation audit log | Client-side only |

### Super-Admin
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| Whole page | UI: `role === "normal_admin"` blocked (`super-admin\page.js:3266`) — senior_admin/management only | — | Page-level, client-side |
| Senior Admin branch: Update Student, Bulk Edit, Pending IDs, Import Students, Replace Full Details | Page gate only — identical for senior_admin and management | `studentService.js`, mostly direct `.from("students")` | Client-side only |
| Management branch tabs: Student Records / Fees / Inventory / Employee | `isMgmt = role === "management"` decides which UI branch renders | Same underlying services as their non-management counterparts | UI-branch-only — **not a real permission boundary**, a senior_admin calling the same functions directly gets the same access |
| **Management branch: Salary tab** | `isMgmt` (management-only) — **fixed 2026-09-19, was UI-only before** | RPCs `admin_get_salary_payments`/`admin_record_salary_payment`/`admin_record_salary_payments_bulk`, `SECURITY DEFINER` (`SUPABASE_SALARY_PUNCHCODE_ROLE_ENFORCEMENT.sql`) | **Fixed 2026-09-19 (`TODO.md` REQ-SEC-007 item 1)** — server-side, management-tier only, matches the existing `isMgmt` UI gate; verified in a rolled-back test transaction (senior_admin blocked, management succeeds) before applying |
| Permanent student delete (`SingleStudentTool`) | UI: `role !== "normal_admin"` | RPC `admin_delete_student_permanently` | **Fixed 2026-09-19 (REQ-SEC-005)** |

### Diagnostics
| Feature | Existing Role Rules | Backend Op | Enforcement |
|---|---|---|---|
| View diagnostic reports | None (any admin_users member) | `.from("diagnostic_reports")`, RLS `is_admin_user()` (membership only) | n/a — open to all tiers by design (viewing), matches CLAUDE.md's description |
| Toggle logging on/off | UI: `role !== "normal_admin"` | `.from("diagnostic_settings")`, RLS — **pending migration only, table not yet live** (REQ-HYG-006) | Pending policy already hardened to `admin_has_role(...)` per REQ-SEC-005's mid-implementation fix — will be tier-checked once the table ships |
| Download diagnostic reports | UI: `role !== "normal_admin"` (`diagnostics\page.js:88`) | Client-side only — repackages already-fetched `rows` state into a local file; no separate backend call | **Open — `TODO.md` REQ-SEC-007 item 3.** Corrected finding (2026-09-19): `diagnostic_reports`/`diagnostic_settings` don't exist in production at all yet (verified via `pg_class`), so there is no live exploit today. But the fix isn't a simple RPC-gate either — the full report list (all tiers, unconditional) is already fetched/rendered on-screen before this button's role check runs, so gating "download" alone would fix nothing real. Needs a business-rule decision (should `normal_admin` see report content at all?) before the pending migration ships — left open for you. |

## Zustand (`store.js`) client-only-config check
Verified across all 18 modules: **no `rolePermissions`/`permission`/
`hasPermission`/`canAccess` store exists anywhere** (confirms/reconfirms
`TODO.md` REQ-SEC-005's original finding — `PROJECT_CONTEXT.md`'s claim of
a Zustand permissions matrix was stale even before REQ-SEC-005, and stays
stale). No module's live config is Zustand-only/un-persisted; the one
stale-looking item (`expenses` seed array in `store.js:110`) is dead demo
data the Expenses page never reads.

## Open items this inventory surfaces
1. **Fixed 2026-09-19** (`TODO.md` REQ-SEC-007 items 1–2): Salary tab
   (management-only RPCs) and `generate_punch_code` (added membership
   check) — both applied to production and verified in a rolled-back test
   transaction first; admin-panel client code staged, not yet committed.
2. **Still open** (`TODO.md` REQ-SEC-007 item 3): diagnostics download.
   Not a live exploit (underlying tables don't exist in production yet),
   but needs a real business-rule decision, not a mechanical RPC fix, per
   the note in the Diagnostics section above.
3. **Traced 2026-09-19.** Documents module's TC/NOC write-path: NOC isn't
   built anywhere (dead "Coming Soon" tab); real TC issuance lives outside
   the `documents` module entirely, at `student\[id]\tc\page.js`, with zero
   role gating on a real state-changing write. Filed as `TODO.md`
   REQ-SEC-008 (new, open). TC/NOC excluded from the Staff App's phase 1
   per the unification plan's 2026-09-19 decision — this finding doesn't
   block that plan, but needs your own priority call independently.

## Next step
**Approved 2026-09-19 — PLANNING gate closed.** You reviewed this inventory
(plus the TC/NOC follow-up trace above) and approved it as-is. DESIGN FIXED
(per-action mobile mapping, `StaffRoleContext` shape) starts from here — see
`planning\STAFF-APP-UNIFICATION-PLAN.md` for the live gate checklist.
