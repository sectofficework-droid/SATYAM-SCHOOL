# DB-DESIGN.md — SATYAM-SCHOOL

> Backfilled. The real, authoritative schema lives in SQL files already in
> the repo — this file maps/indexes them per AGENTS.md §B rather than
> re-transcribing every column (that would drift from the SQL immediately).

## Source of truth
- **Core schema:** `admin-panel/database/schema.sql` — 35 tables (verified
  `CREATE TABLE` count in `governance\documentation\PROJECT_CONTEXT.md`). Original blueprint: students,
  fees, employees, timetable, notices, tasks.
- **SEF schema:** `admin-panel/database/sef_schema.sql`,
  `sef_settings_schema.sql`.
- **Mobile-app incremental schema (45 files):**
  `mobile-app/SUPABASE_*.sql` — GR Book, syllabus, question bank, official
  exams, timetables, birthdays, helpdesk, queries/rules, attendance/leave,
  daily tasks, **app auth** (`SUPABASE_APP_AUTH.sql`).
- **Known drift (documented, unreconciled):** `users` table exists in
  `schema.sql` but is unused — real admin auth uses `admin_users`, which has
  no `CREATE TABLE` anywhere in the repo (created directly in Supabase).
  `timetable_period_definitions`/`timetable_entries` are defined but unused —
  the live table is `timetables` (`SUPABASE_TIMETABLES_TABLE.sql`).

## Row Level Security — current real state (verified by reading the SQL, not
assumed)
- `students`, `employees`: RLS **enabled**, but with the original
  `auth.uid()`-based policies from initial setup — now effectively moot since
  mobile login uses custom RPCs, not real Supabase Auth sessions. Never
  cleaned up.
- Every table added for the mobile app (`student_attendance`, `homework`,
  `exams`, `exam_marks`, and others per `governance\documentation\PROJECT_CONTEXT.md`): RLS
  **explicitly disabled**, with broad `GRANT` to the `anon` role.
- The project's own `SUPABASE_SECURITY_AUDIT.sql` is an ad-hoc query written
  to check the live RLS/grant state — its existence is itself evidence the
  current RLS picture was already known to be untrusted before this audit.
- Full risk analysis: `planning\SECURITY-THREAT-MODEL.md`.

## Auth-adjacent data (flagged, not changed)
`employees.app_password` / `students.app_password` — `TEXT`, same hardcoded
default value for every account (redacted here — exact value is in
`mobile-app/SUPABASE_APP_AUTH.sql` itself, which is production code, not a
tracked doc), compared with plain `=` in `teacher_login`/`student_login`
RPCs. Not hashed. See threat model.

## Class name format
DB stores `"JR.KG"` / `"SR.KG"` / `"11th - Commerce"` / `"12th - Commerce"`;
conversion via `DB_TO_STORE` map in `admin-panel/src/app/settings/page.js`.
Not re-documented here — same reason as above, avoid drift from the one real
implementation.

## Seed data / key calculations / acceptance notes
Not centrally recorded pre-existing this scaffold. If/when a new
table/migration is added going forward, record its acceptance notes here
rather than only in a commit message, so the next AI session doesn't have to
reverse-engineer it from SQL.
