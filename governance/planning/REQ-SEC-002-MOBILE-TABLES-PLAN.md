# REQ-SEC-002-MOBILE-TABLES-PLAN.md — SATYAM-SCHOOL

> Planning-only document. No migration, GRANT/REVOKE, or CREATE POLICY has been run against
> production as part of writing this file — every finding below was gathered with read-only
> queries (live `SET LOCAL ROLE anon` simulations inside rolled-back transactions, `pg_policies`,
> `information_schema`) plus a full read of `mobile-app/lib/core/services/supabase_service.dart`
> and `diagnostic_logger.dart` (the only two files that touch Supabase tables directly from any
> Flutter app — confirmed by grep, matching TODO.md's own claim). Nothing here is authorized to be
> coded until you say "code it" per `AGENTS.md` §F, and per-item, not as one blanket approval.

## Scope recap

`governance/planning/TODO.md`'s REQ-SEC-002 entry closed Tranche 1 (46 admin-only tables,
2026-09-19) and explicitly deferred the mobile-touched remainder to its own session — this is that
session. The core blocker restated: **no Flutter app (teacher/student/attendance) ever creates a
real Supabase Auth session** (confirmed 2026-09-09) — every mobile request runs as the Postgres
`anon` role with a hardcoded key, never `authenticated`, and `auth.uid()` is always `NULL`. Any RLS
policy written as `auth.uid() = ...` is therefore dead code for every mobile caller, not a
restriction — it silently denies everyone. This has already broken production once
(`record_check_out`/`employee_shifts`, 2026-09-09) and, as documented below, **has happened again**
inside Tranche 1 itself.

## 🚨 Found during this session's tracing — live production regression, FIXED 2026-09-19

**`tasks` and `daily_task_targets` were included in Tranche 1's "46 admin-only, zero mobile
dependency" list and fully locked down (RLS enabled, `anon` grants revoked entirely, only
`is_admin_user()`-gated policy left).** That premise was wrong for both:

- `supabase_service.dart`'s `fetchTeacherTasks()` (Teacher app "My Tasks") selects
  `task_assignees` with an embedded `task:tasks(*)` — a PostgREST foreign-key embed, which requires
  a `SELECT` grant on `tasks` itself for the calling role, not just on `task_assignees`.
- `fetchDailyTasksForEmployee()` (Teacher app "Daily Tasks") selects `daily_tasks` with an embedded
  `daily_task_targets(employee_id)` — same mechanism, requires `SELECT` on `daily_task_targets`.

**Live-verified right now** (rolled-back `SET LOCAL ROLE anon` transactions):
```
SELECT * FROM tasks LIMIT 1;                 -- ERROR 42501: permission denied for table tasks
SELECT * FROM daily_task_targets LIMIT 1;    -- ERROR 42501: permission denied for table daily_task_targets
```
Both currently deny `anon` entirely — every Teacher-app "My Tasks" and "Daily Tasks" fetch has been
returning a hard error since Tranche 1 shipped (2026-09-19), not a degraded/partial result.
`diagnostic_reports` has 0 rows so this hasn't self-reported (logging is off by default, per
REQ-HYG-006), and real-world impact hasn't been separately confirmed by a user report — flagging
here per §J14 rather than waiting for one.

**Fixed same day, fast-tracked ahead of the rest of this plan (isolated regression, not a design
decision):** restored `GRANT SELECT ON tasks, daily_task_targets TO anon` plus a matching
`anon`-`SELECT`-only policy on each (writes remain `is_admin_user()`-only, unchanged — mobile never
wrote to either table). Migration: `mobile-app/SUPABASE_FIX_TASKS_ANON_REGRESSION.sql`, applied via
`mcp__supabase__apply_migration`. Verified live afterward (role-simulated, rolled back): `anon`
SELECT now returns rows on both; `anon` INSERT still correctly `permission denied`.

## Category 1 — RPC-only tables, zero direct Flutter access (confirmed) — FIXED 2026-09-19

`cron_secrets`, `employee_punch_codes`, `kiosk_qr_sessions`, `kiosk_settings` — the 4 tables behind
this session's RLS-disabled count growing from 29 to 33. Confirmed via grep: no `.from('cron_secrets')`
/ `.from('employee_punch_codes')` / `.from('kiosk_qr_sessions')` / `.from('kiosk_settings')` anywhere
in `mobile-app/lib`. All access is through `SECURITY DEFINER` RPCs (`auto_mark_absent_staff`,
`generate_punch_code`, `get_kiosk_public_settings`, `verify_kiosk_admin_pin`, `generate_qr_session`,
`check_qr_session`, `redeem_qr_session`, `lookup_punch_code`, `redeem_punch_code`) — all already
gated by REQ-SEC-007/009/010's fixes. **Same shape as Tranche 1**: `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY` + `is_admin_user()`-gated `FOR ALL` policy + revoke any stray `anon`/`authenticated` direct
grants (currently none exist on 3 of the 4; worth double-checking `employee_punch_codes` for a
lingering grant before writing the migration, since it wasn't in this session's original 29-list
and hasn't been individually checked before). Lowest-risk item in this whole plan — no client
behavior depends on direct table access to any of these four.

**Applied**: `mobile-app/SUPABASE_LOCK_RPC_ONLY_TABLES.sql`, via `mcp__supabase__apply_migration`
(`req_sec_002_lock_rpc_only_tables`). Verified live afterward: `anon` gets `permission denied` on
all 4 (SELECT included — they were never meant to be readable at all, unlike Category 2).

## Category 2 — mobile reads only, no PII/low sensitivity — quick win, keep `anon` SELECT — FIXED 2026-09-19

Confirmed via the full file read: **zero INSERT/UPDATE/DELETE from any Flutter app** for all 12 of
these. Same fix shape used correctly on `school_calendar_events` (2026-09-04) and already
half-applied (informally, via grants alone, no RLS) to `employee_attendance`/`employee_shifts`:
enable RLS, add an `anon`-`SELECT`-only policy, add an `is_admin_user()`-gated write policy (admin
panel already runs as `authenticated` + admin-membership, unaffected), revoke `anon` INSERT/UPDATE/
DELETE.

| Table | Mobile usage | Live state today |
|---|---|---|
| `academic_years` | SELECT (labels, current-year) | RLS off, full anon CRUD |
| `app_versions` | SELECT (latest version check) | RLS off, full anon CRUD |
| `class_subjects` | SELECT (subject list per class) | RLS off, full anon CRUD |
| `daily_tasks` | SELECT only (`fetchDailyTasksForEmployee`, one call site, `supabase_service.dart:940`) — **missing from this table in the first draft of this plan, added on review; not part of the `tasks`/`daily_task_targets` regression above, which is a different pair of tables** | RLS off, full anon CRUD |
| `employee_attendance` | SELECT (own `employee_id`, writes go through `record_face_punch`/punch-code RPCs) | RLS off, **already `anon: SELECT` only** — just needs formalizing into a real policy |
| `employee_shifts` | SELECT (own shifts for a date; writes via `record_check_out`/`record_face_punch` RPCs) | RLS off, **already `anon: SELECT` only** — same, just formalize |
| `notices` | SELECT (audience-filtered) | RLS off, full anon CRUD |
| `official_exam_subject_config` | SELECT (max marks per subject) | RLS off, full anon CRUD |
| `official_exams` | SELECT (exam list) | RLS off, full anon CRUD |
| `school_profile` | SELECT (max marks default, period defs, day-group weekdays) | RLS off, full anon CRUD |
| `school_rules` | SELECT (one row by audience) | RLS off, full anon CRUD |
| `timetables` | SELECT (by class or by teacher name) | RLS off, full anon CRUD |

**Risk if done wrong:** low. The only way this breaks mobile is if a write call exists that this
trace missed — worth a second `grep -n "\.from('<table>')"` pass per table immediately before
writing the migration, same discipline Tranche 1 used. Getting the write-side revoke wrong (e.g.
accidentally including `SELECT` in the revoke) would show as an immediate, obvious blank-screen
failure on next app open — same detectability as the `tasks` regression above, not a silent one.

**Applied**: `mobile-app/SUPABASE_LOCK_MOBILE_READONLY_TABLES.sql`, via
`mcp__supabase__apply_migration` (`req_sec_002_lock_mobile_readonly_tables`) — re-grepped all 12
tables' write-side immediately before writing the migration (per the risk note above), confirmed
zero insert/update/delete call sites for any of them. Verified live afterward: `anon` SELECT
returns the expected row counts on all 12 (spot-checked); `anon` INSERT correctly `permission
denied` (tested on `notices`). Project-wide `rls_disabled` count dropped from 33 to exactly 17,
matching Category 3's table count with zero surprises.

## Category 3 — the real architectural problem, needs your decision before any "code it"

17 tables where mobile actually writes (or reads other people's/other-owner's rows) keyed only to
an app-supplied id, with **no server-side proof the caller is who they claim to be** beyond
"they're calling with the public anon key, same as everyone":

`employees`, `exam_marks`, `exams`, `homework`, `student_attendance`, `leave_requests`,
`official_exam_marks`, `queries_suggestions`, `student_alerts`, `syllabus`,
`syllabus_edit_requests`, `syllabus_subtopics`, `task_assignees`, `teacher_alerts`,
`teacher_documents`, `attendance_edit_requests`, `daily_task_completions`.

**Confirmed live**: 5 of these (`employees`, `exam_marks`, `exams`, `homework`,
`student_attendance`) already have real `auth.uid()`-keyed policies sitting on the table right now
(`employees_own_profile`, `marks_own_student`, `marks_teachers`, `exams_all_users`,
`homework_all_users`, `homework_teachers_insert`, `attendance_all_users_read`,
`students_own_attendance`, `teachers_attendance`) — all dead weight today (RLS is still disabled on
all 5, so none of them run at all; even if RLS were flipped on, `auth.uid() IS NOT NULL` and
`auth.uid() = ...` both evaluate false/null for every mobile request, which would lock every
teacher and student out entirely, matching TODO.md's own warning not to "just enable RLS" here).

**Secondary gap inside this group, lower severity, worth fixing regardless of which path below is
chosen**: several delete/update calls filter only by row `id`, with no ownership check at all in
the query itself — `deleteSyllabusChapter`, `updateSyllabusChapterName`, `deleteSubtopic`,
`updateSubtopicStatus`, `closeSyllabusEditWindow`, `deleteTeacherDocument`. Today this changes
nothing (the whole table is already wide open), but it means "add a WHERE teacher_id = ... clause"
alone would NOT be a sufficient fix even after a real-identity mechanism exists — the call sites
themselves need the caller's own id added to the filter, not just the table's grants tightened.

### Two real fix paths — not choosing one for you

**(A) Migrate mobile login to a real Supabase Auth session.** After `teacher_login`/`student_login`
verify the password (unchanged), mint an actual Supabase session (Admin API) instead of just
returning a row. `auth.uid()` would then be real for every subsequent mobile request, and the 5
dormant policies above would start working correctly for the first time — for `employees`/
`exam_marks`/`exams`/`homework`/`student_attendance` this could be closer to "flip RLS on" than a
rewrite, since the policy SQL already exists. **Tension to flag explicitly**: REQ-SEC-010 item 1
(`get_all_birthdays`) was deliberately left open with the stated reasoning that "no new auth
system" is this project's own non-negotiable, ruling out exactly this kind of change as an isolated
patch. Revisiting that stance is a real decision, not mine to make by picking this option.

**(B) Convert each write (and any read of another person's row) to a `SECURITY DEFINER` RPC that
re-verifies identity per call** — the pattern already proven 4 times over (REQ-SEC-005/007/008/009).
Concretely: an RPC taking `p_employee_id`/`p_teacher_id`/`p_student_id` plus either a re-sent
password or a short-lived session token issued at login, checked server-side before the write
proceeds. No architecture change, but roughly 25-35 new RPCs across ~17 tables' worth of call sites,
plus the matching Dart refactor across all 3 Flutter flavors — larger than any single REQ-SEC fix
shipped so far in this file, and still leaves reads on non-sensitive fields (e.g. a whole class's
attendance, which teachers legitimately need broadly, not just "their own") an open design question
even after conversion — not every read in this group is "own record" shaped the way writes are.

**(C) Leave as a documented, deferred architectural risk**, same treatment REQ-SEC-010 already gave
`get_all_birthdays` — track it, don't patch it piecemeal. Natural point to revisit: REQ-FEAT-001
(Staff App unification) is already mid-flight on the teacher flavor and already added an
`employees.admin_user_id → admin_users(id)` FK as part of its own identity work — folding a mobile
real-auth decision into that initiative's still-open DESIGN FIXED gate may be lower-cost than a
standalone session, since some of the identity-model thinking is already happening there anyway.

**Not recommending a default here** — (A) reopens a standing project rule, (B) is the largest single
implementation effort in this file's history, (C) leaves real IDOR exposure (attendance, marks,
homework, employee profiles) open indefinitely. This needs your call, likely informed by how
REQ-FEAT-001's identity-model question gets resolved.

## Suggested order, if you proceed

1. ~~**`tasks`/`daily_task_targets` grant restore**~~ — **done**, see above.
2. ~~**Category 1** (4 RPC-only tables)~~ — **done**, see above.
3. ~~**Category 2** (12 read-only tables)~~ — **done**, see above.
4. **Category 3** (17 tables, unchanged) — do not start without an explicit decision on (A)/(B)/(C)
   above, and likely not without a proper written plan of its own (this project's own MAJOR-change
   threshold, §J12B) once a direction is picked. **This is the only piece of REQ-SEC-002 still
   open.**

**Review note (2026-09-19, this file reviewed against live state before any "code it"):**
Category 1's `employee_punch_codes` double-check came back clean (no lingering `anon`/
`authenticated` grants on any of the 4 tables). Category 2/3's live grant state and the 5 dormant
`auth.uid()`-keyed policies on `employees`/`exam_marks`/`exams`/`homework`/`student_attendance`
were independently re-verified and match exactly as described. The syllabus/teacher-document
ownership-filter gap (Category 3) was independently confirmed by reading the actual call sites —
all six filter by `id` alone, no owner/teacher id in the `WHERE`. One gap found and fixed: `daily_tasks`
(item 6 of the original 29) had been dropped from both categories, leaving the plan one table short
(32 vs. 33) — added to Category 2 above, table counts corrected.
