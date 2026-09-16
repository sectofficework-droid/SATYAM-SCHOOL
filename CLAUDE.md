# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Governance comes first

This project runs under a formal AI-agent rule book: **`AGENTS.md`** (repo root). Read it before
doing any non-trivial work — it defines mandatory approval gates (DISCOVERY → CLARIFY → PLANNING →
DESIGN FIXED → UI DESIGN CONFIRMED → CODING → TESTING → RELEASE → OPERATE), exact trigger phrases
needed to advance a gate (e.g. only the literal words **"code it"** open Coding — "continue" or "ok"
never do), mandatory session logging, git/secrets/destructive-operation rules, engineering-execution
standards (§K — smallest correct change, match existing conventions, root-cause debugging), a
mandatory application diagnostic-logging requirement (§L — distinct from the AI session logs; see
below), and dozens of other binding constraints (J0–J18 series). Do not paraphrase or shortcut
these rules from memory — open the file, and use its own QUICK INDEX to jump to a theme instead of
reading start to finish. Current phase is **OPERATE**: this is a live production system with real
users; treat existing behavior as intentional and do not refactor/rewrite without explicit approval
(§J1) — day-to-day changes are gated by §J12B's PATCH/MINOR/MAJOR classification, not a full
DISCOVERY→RELEASE re-run per change (§F).

**§L diagnostic logging (REQ-HYG-006) — centralized in Supabase, query it before asking the user
anything, BUT it's off by default.** `diagnostic_reports` (migration
`mobile-app/SUPABASE_DIAGNOSTIC_REPORTS.sql`, RLS enabled — `is_admin_user()`-gated SELECT/UPDATE/
DELETE, open INSERT) is the single table every surface reports into, two ways: (1) **automatic** —
admin panel (`src/lib/logger.js`'s `error()`/`fatal()`, wired into `apiDiagnostics.js`'s
`withDiagnostics` on all 6 API routes, `DiagnosticsInit.jsx`'s global `window.onerror`/
`onunhandledrejection`, `error.js`/`global-error.js`) and mobile apps (`lib/core/utils/
diagnostic_logger.dart`'s `error()`/`fatal()`, wired once in `app_bootstrap.dart` for all 3 flavors)
both auto-submit on every captured error — **gated by `diagnostic_settings` (a single-row switch,
default OFF)**, checked at startup and throttled (5-min/message cooldown, 20/session cap)
regardless. (2) **Manual** — mobile users tap **"Report a Problem"** (`lib/common/widgets/
report_problem_dialog.dart`) for issues that don't throw (e.g. "button does nothing"); this path is
NOT gated by the switch — it's explicit per-incident consent, always works. Humans browse/toggle/
download at `/diagnostics` in the admin panel (senior_admin/management only for the toggle and
download). **Why the switch exists:** per the project owner's explicit instruction, this logging is
for active development/debugging, not for passively collecting what users do — expect it to be OFF
most of the time. **You (an AI agent) should still reach for the table directly** — this project's
Supabase MCP connection (`.mcp.json`) can query
`SELECT * FROM diagnostic_reports WHERE status = 'New' ORDER BY created_at DESC` in any session —
but if it comes back empty, check `diagnostic_settings.enabled` before concluding nothing's wrong;
manual "Report a Problem" entries will be there regardless, auto-captured ones only if the switch
was on at the time. **Not yet done:** frontend↔backend↔DB request-ID threading through Supabase
calls (Phase 2, not started), and none of this has been exercised end-to-end on a real device/
running dev server yet — treat it as "should work, not yet watched catch a real error" until that
pass happens (see `governance/BOOTSTRAP.md`). **Also not yet done:** the migration above needs to
be run against production before any report can actually land in the table — check
`governance/planning/TODO.md` REQ-HYG-006 for current status before assuming it's live.

Read in this order when starting work: `AGENTS.md` → `governance/BOOTSTRAP.md` (current-state
snapshot: phase, approvals, environment, last checkpoint, open next-steps) → the relevant file
under `governance/planning/` or `governance/documentation/` for the task at hand. Full rule text
`AGENTS.md` doesn't already inline lives in `governance/RULEBOOK.md`.

**Never commit to git unless the user explicitly asks.** When code work is done, stage it and say
"staged, not committed" — the user triggers the commit themselves.

## Repository structure

Two independent apps sharing one Supabase project, in one repo:

- **`admin-panel/`** — Next.js 14 web app (ERP for the school + a lighter module set for a second
  org, SEF). Deployed to Vercel.
- **`mobile-app/`** — single Flutter codebase built as **three separate Android apps** (Teacher,
  Student, Attendance kiosk), each its own Play Store listing. Distributed as APKs via a public S3
  bucket with an in-app update prompt, not Play Store auto-update (Teacher app also has a closed
  Play Store testing track in progress).
- **`governance/`** — tracked continuity docs (rule book, current-state snapshot, session logs,
  specs). Not application code.
- **`Scratch/`** — fully git-ignored disposable prep workspace (drafting stubs, `.bat` dev
  launchers, reference screenshots). Never treat anything here as production code or as a
  continuity record.

Full architecture detail (route map, per-module status, DB schema, shared utilities, file sizes,
git history highlights) lives in **`governance/documentation/PROJECT_CONTEXT.md`** — it's the
authoritative technical reference; don't duplicate it here, open it when a task needs that depth.

## Commands

### Admin panel (`admin-panel/`)
```
cd admin-panel
npm install
npm run dev      # starts via scripts/dev-start.js — do NOT run `next dev` directly
npm run lint
npm run build     # next build — see constraint below, avoid during normal dev
```
Runs on `localhost:3000`. **No automated test suite exists** — there is no `test` script and no
test files; verification is manual, in-browser.

### Mobile app (`mobile-app/`)
Three flavors from one codebase — always pass `-t <entry>` and `--flavor <role>` together, or a
plain `flutter run`/`flutter build` launches the unintended fallback `lib/main.dart`:
```
flutter pub get
flutter run   -t lib/main_teacher.dart    --flavor teacher
flutter run   -t lib/main_student.dart    --flavor student
flutter run   -t lib/main_attendance.dart --flavor attendance
flutter build apk -t lib/main_teacher.dart    --flavor teacher
flutter build apk -t lib/main_student.dart    --flavor student
flutter build apk -t lib/main_attendance.dart --flavor attendance
flutter analyze
```
Flavor entry points: `com.satyamstars.teacher` / `com.satyamstars.student` /
`com.satyamstars.attendance`, defined via `flavorDimensions += "role"` in
`mobile-app/android/app/build.gradle.kts`. `mobile-app/test/widget_test.dart` is Flutter's
unmodified default counter-app test — it does not exercise this app.

For Windows local dev, `Scratch/SATYAM-SCHOOL/` has `.bat` launchers (`SSIS-AIO.bat` for an
interactive menu, plus one per surface) that wrap the commands above and free the target port
first — see `governance/documentation/SETUP-GUIDE.md`.

## Hard constraints (violating these breaks the dev environment or production)

1. **Never run `npx next build` during normal development** — corrupts the `.next` cache and
   breaks all CSS. Only run a real build when a build/release task specifically calls for it.
2. **Never use PowerShell `Out-File` or `Set-Content` on `admin-panel/` JS/JSX files** — adds a
   UTF-8 BOM and breaks Next.js CSS loading. Use the Write tool instead.
3. **No TypeScript in `admin-panel/`** — the whole codebase is JavaScript only (`.js`/`.jsx`); do
   not introduce `.ts`/`.tsx` files.
4. **Mobile builds always need `-t <entry>` and `--flavor <role>` together** (see above) — never
   assume a plain `flutter run` targets the right app.
5. Real secrets (`admin-panel/.env.local`, Supabase keys, AWS credentials) are git-ignored and must
   never be read into a session, pasted into a doc, or logged — see `AGENTS.md` §J6. No
   `.env.example` template exists yet (a known gap; do not fabricate one with guessed keys — see
   `governance/documentation/SETUP-GUIDE.md` for the real key names).

## Architecture notes worth knowing before touching code

- **Backend:** one shared Supabase project (`hxkowdaugkkumvzyfsai.supabase.co`) for both apps.
  Admin panel uses real Supabase Auth (`admin_users` role table, PKCE flow). The mobile apps use
  **custom SECURITY DEFINER RPCs** (`teacher_login`/`student_login`) checking an `app_password`
  column on `employees`/`students`, not Supabase Auth sessions — so every mobile request executes
  as the Postgres `anon` role, never `authenticated`. This has caused real grant bugs before
  (RPCs/tables granted only to `authenticated` silently break mobile callers) — keep it in mind
  whenever writing or reviewing SQL grants.
- **Schema is not centralized.** `admin-panel/database/schema.sql` is the original blueprint and is
  stale; most real schema growth since lives in 45+ `mobile-app/SUPABASE_*.sql` files, applied
  ad hoc via the Supabase SQL Editor (no migration tool orders them). Known drift: `users` table is
  unused (real admin auth uses `admin_users`, which has no in-repo `CREATE TABLE`);
  `timetable_period_definitions`/`timetable_entries` are unused (live table is `timetables`). Check
  `governance/documentation/PROJECT_CONTEXT.md` before assuming a table/column exists.
- **File storage:** AWS S3 for both apps, but different trust models — admin panel uses presigned
  PUT/GET URLs (`admin-panel/src/lib/s3.js`, credentials server-side only); mobile apps hit a
  **public-read** bucket directly with plain `Image.network` URLs (`mobile-app/lib/common/widgets/s3_image.dart`).
- **Known open security items** (recorded, not fixed — do not silently "clean up"): RLS disabled on
  most mobile-app tables and broad `anon` grants; public S3 bucket for mobile assets;
  `teacher_update_profile` has no password check. Full detail and current status in
  `governance/planning/SECURITY-THREAT-MODEL.md` and `governance/planning/TODO.md`
  (REQ-SEC-001..004). Don't attempt to fix these opportunistically — they need their own approved
  plan per the phase-gate process.
- **State:** admin panel uses Zustand (`admin-panel/src/lib/store.js`) with localStorage persist for
  config that hasn't been migrated to the DB yet (employee salaries, year planning, fee reminder
  templates, role permissions). Mobile app uses GetX for state/routing/DI.
- **SEF** (`admin-panel/src/app/(dashboard)/sef/*`) is a second organization sharing the same admin
  panel login and Supabase project, deliberately scoped to Phase 1 (Dashboard/Student/Fees/Settings
  only) — do not add SEF nav items or assume SEF parity with the main school modules without
  checking current scope first.
