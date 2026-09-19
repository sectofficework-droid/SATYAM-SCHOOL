# STAFF-APP-UI-DESIGN.md — SATYAM-SCHOOL

> UI DESIGN CONFIRMED draft for the Staff App Unification initiative, per
> `planning\STAFF-APP-UNIFICATION-PLAN.md` phased-plan step 5 and
> `planning\STAFF-APP-DESIGN-FIXED.md` (approved 2026-09-19). Covers mobile
> UX for the phase-1 Admin Workspace module set only. Grounded in the real
> Teacher-flavor codebase (`mobile-app/lib/app/modules/teacher/`,
> `core/services/auth_service.dart`, `core/theme/app_theme.dart`) — not
> invented from scratch.

## Navigation shell
`TeacherHome` (`teacher/dashboard/teacher_home.dart`) today is a
`StatefulWidget` with a fixed bottom-tab `_pages` list (Dashboard,
Attendance, Exams, Homework, Notices), driven by `AuthService.to.profile`.

**Two dimensions decide what's shown — corrected 2026-09-19 after the
first on-device test surfaced a real gap between this doc and what got
built.** `isTeacher` (`profile['type'] == 'teaching'`) and `adminRole`
(`profile['admin_role'] != null`) are independent, per the discovery
non-negotiable, and combine as:
- **Teacher+Admin combo** (`isTeacher && adminRole.linked`): the existing
  5 Teacher tabs stay exactly as-is, Admin Workspace is appended as a 6th
  tab — additive, matches the original design.
- **Admin-only / non-teaching linked account** (`!isTeacher &&
  adminRole.linked`): **Admin Workspace REPLACES the Teacher tabs
  entirely** — no bottom nav at all (a single destination needs none;
  `Get.to()` push routes already provide all needed depth), no Teacher
  dashboard, no "student marks entry"/Syllabus/Homework tabs that make no
  sense for someone with nothing to teach. This was the design's original
  intent (§4 below) but the first implementation pass missed coding the
  exclusion and just always appended a 6th tab regardless of
  `isTeacher` — caught by the user during the first BlueStacks test
  (EMP003 is `type = non-teaching`) and fixed same session.
- **Unlinked** (`!adminRole.linked`, either `isTeacher` value): unchanged
  existing behavior — the common case for every real account today.

Either way, `TeacherHome`'s own AppBar (greeting/notifications/profile/
logout) stays the single header shown — `AdminWorkspaceHome` never shows
its own AppBar when reached through `TeacherHome` (`embedded: true` in
both the tab-6 case and the whole-app-replacement case), avoiding a
double-header.

## Per-module screen design (phase-1 set only)

### Admin Dashboard (read-only)
Single scroll screen, reusing the visual language of
`teacher_dashboard_tab.dart`'s summary cards: attendance-marked-today
count, open queries count, active notices count, pending syllabus
edit-requests count (only for senior_admin/management — see below). Tap
any card to jump into that module.

### Attendance (mark/edit, alerts, edit requests)
- List screen: student roster for a selected class/section (reuse the
  class/section picker pattern from `teacher_attendance_page.dart`), each
  row a swipeable/tappable card to mark Present/Absent/Late — same
  interaction language as the existing teacher attendance screen, not a
  new pattern.
- "Edit requests" and "Teacher alerts" — a simple tabbed sub-list (Pending
  / Resolved), each item a card with Approve/Reject actions in a bottom
  sheet.

### Employee — punch-override code
Single-purpose sheet: employee search field → "Generate Code" button →
large code display with a copy button and countdown (mirrors the intent
of the admin-panel's existing modal, adapted to a bottom sheet — the
standard mobile pattern for a single quick action, per the discovery
spec's "sheets" guidance).

### Inventory — usage/checkout-return
Two cards on an Inventory home: "Record Usage" (item picker + quantity
sheet) and "Asset Checkout/Return" (asset search → checkout or return
action sheet with the borrower's name).

### Notice (post/edit/pin/archive)
List of existing notices (card per notice, same visual card style as
`TeacherNoticesPage`'s read-only `_NoticeCard`, extended with edit/pin/
archive icon-buttons for this admin view only — the teacher-facing
`_NoticeCard` itself is untouched, this is a new widget). Floating "+"
button opens a compose sheet (title, body, audience picker, pin toggle).

### Queries (reply/resolve/reopen)
List of open queries (card per query — asker name, subject, submitted
date), tap to open a detail/reply screen (message thread + a text input,
same shape as a support-ticket thread). Resolve/Reopen as a top-right
action.

### Question Papers (view/download, read-only)
Simple document list (file name, uploader, date) with a tap-to-open
action using the existing S3 presigned-URL viewer already used elsewhere
in the app for documents — no new viewer component needed.

### Syllabus — edit-request approve/reject only (senior_admin/management tier)
List of pending edit requests (card: subject, what changed, submitted by,
date) with Approve/Reject buttons inline on each card (a single tap plus a
confirm sheet for Reject, which needs a reason). `normal_admin` sessions
don't see this module at all in the Admin home (card omitted client-side,
**and** the backing RPC also rejects it server-side per the binding
security pattern in `STAFF-APP-DESIGN-FIXED.md` §1).

### Tasks (CRUD)
List of tasks (card: title, assignee, due date, status), floating "+" for
a new-task sheet (title, description, assignee picker, due date). Tap a
card to edit/complete/delete via a bottom sheet.

## Cross-cutting UI rules
- Every write action (mark attendance, post notice, reply to query,
  approve/reject syllabus request, create/edit task, generate punch code,
  record inventory usage/checkout) shows a standard loading/error/success
  state consistent with the existing Teacher screens' patterns — no new
  error-handling convention invented.
- Every Admin Workspace screen call goes through §L's diagnostic logger
  (`diagnostic_logger.dart`) on failure, same as the rest of the app —
  not a new logging path.
- No screen in this phase-1 set requires a desktop-style data table;
  everything above is list/card/sheet, matching the discovery spec's
  mobile-UX non-negotiable.

## Explicitly out of scope for this pass (confirmed via DESIGN FIXED §3)
Employee/Student CRUD, Fees, Expenses, GR Book, Documents (ID
card/marksheet/bonafide/TC/NOC), Report generation, full Syllabus CRUD,
Settings, Super-Admin, Diagnostics, Salary, impersonation-initiation. All
stay "Available only in Admin Panel" — no mobile screen this phase.

## Status: proceeding to implementation
This is a same-session continuation per your instruction to keep going
without further check-ins once implementation starts. If anything here
needs a mid-flight correction once you're back, it's easy to point at a
specific module in this file.
