# BOOTSTRAP — SATYAM-SCHOOL

> Authoritative "current state" snapshot. Read this every session (§C.2 of
> `AGENTS.md`, which links back here — see `AGENTS.md`'s "Continuity files"
> note). Refreshed every session — never left stale. Full technical detail
> lives in `documentation\PROJECT_CONTEXT.md` (sibling folder — moved here
> 2026-08-19, was at repo ROOT) — this file summarizes
> phase/approvals/environment and points there for detail, per §B ("map
> existing docs instead of duplicating").
>
> **Size discipline (added 2026-09-16, `AGENTS.md`/`RULEBOOK.md` §D):** this
> file is a curated snapshot, not an archive. "Code status" and "Last
> checkpoint" below carry the current checkpoint in full, plus at most one
> prior checkpoint's short summary; anything older is a single-line pointer
> to its `ai-context\SESSION-*.md`/`work-log\LOG-*.md` file. Trimmed from
> 723 lines to this on 2026-09-16 — nothing was deleted, the detail this
> removed already lives in the linked session/log files.
>
> **Location note:** this file lives in `governance\` (ROOT-level, NOT
> inside `Scratch/`) per `RULEBOOK.md` §B, which is now PART I's own
> default (updated 2026-08-19 — no longer an exception layered on top of
> an older default). `AGENTS.md` stays at repo ROOT itself (AI-tooling
> auto-discovery convention); `RULEBOOK.md`, this file, `ai-context\`,
> `work-log\`, `planning\`, and `documentation\` all live together in
> `governance\`, git-tracked normally with zero gitignore exceptions,
> since the folder simply isn't inside `Scratch/`. Deeper technical
> history lives in `governance\ai-context\` (session-by-session detail,
> `SESSION-*.md`); a plain-English mirror lives in `governance\work-log\`
> (`LOG-*.md`). Read this file first — it's the small, curated summary;
> open a `SESSION-*.md`/`LOG-*.md` only when you need file-level detail
> this snapshot doesn't carry.

## Mode
**ALREADY RUNNING** (detected 2026-08-18: git history back to project start,
deployed to Vercel production, real Supabase project, real users). This
scaffold (`AGENTS.md` at ROOT + `governance\` for `RULEBOOK.md`,
`BOOTSTRAP.md`, `ai-context\`, `work-log\`, `planning\`, `documentation\`
+ `Scratch\SATYAM-SCHOOL\` for the remaining disposable/ephemeral material)
was added retroactively per PART I §I of `RULEBOOK.md` — production code
was not touched to create it.

## Current phase
**OPERATE** (informal — already live in production), with a **retroactive
gap**: no DESIGN FIXED / RELEASE approval was ever formally recorded before
go-live. This scaffold is documenting the system as it actually is, not
re-approving it. Treat all existing behavior as intentional per §J1 unless
you tell me otherwise. **Gating for ongoing work:** per `AGENTS.md` §F's
"Already-running / OPERATE-mode projects" rule (added 2026-09-16), day-to-day
changes are gated by §J12B's PATCH/MINOR/MAJOR classification, not a re-run
of the DISCOVERY→RELEASE ladder.

## Approvals on record
| Gate | Status | Note |
|---|---|---|
| DISCOVERY | Informal — see `ai-context\SATYAM SCHOOL PROJECT UNDERSTANDING PROMPT.txt` (moved here 2026-08-18, was at repo root) | Original product-vision doc; treat as historical discovery input, not a live spec |
| CLARIFY | Not formally recorded | Stack/roles are evident from code + `documentation\PROJECT_CONTEXT.md` |
| PLANNING | Not formally recorded | Backfilled now in `planning\*` |
| DESIGN FIXED | **Not recorded** — and the live design has drifted from the original locked architecture (see below) | Needs your decision, see `planning\SECURITY-THREAT-MODEL.md` |
| UI DESIGN CONFIRMED | Implicit (shipped, iterated over many commits) | Not re-litigating |
| CODING | N/A — ongoing, feature-by-feature via direct "code it"-style requests in each session | |
| TESTING | **Not recorded** — no automated tests exist for `admin-panel/`; only Flutter's default boilerplate test exists for `mobile-app/` | See `planning\TODO.md` backlog |
| RELEASE | **Not recorded** — no release checklist was ever run; the app is already live | Backfilled retroactively in `planning\RELEASE-PLAN.md` |
| OPERATE | Active | No monitoring/alerting/backup-restore verification on record |

## Architecture drift vs. the original locked stack
`ai-context\SATYAM SCHOOL PROJECT UNDERSTANDING PROMPT.txt` declared these as
**mandatory** ("LOCKED" stack / "DO NOT" list). Reality now differs:

| Locked rule | Reality | Where |
|---|---|---|
| TypeScript | JavaScript only, no TypeScript | `admin-panel/` entire codebase |
| RLS mandatory | RLS **disabled** on every new mobile-app table (`student_attendance`, `homework`, `exams`, `exam_marks`, etc.) — and, **live-confirmed 2026-08-21**, `students`/`employees`/`admin_users` were ALSO fully readable by a completely unauthenticated client (public anon key, no session) despite `SUPABASE_SETUP.sql`'s narrower `auth.uid()`-based policies existing on paper. **`students`/`admin_users` fixed 2026-09-04** (RLS re-enabled, `anon` grants revoked, live-verified). `employees` + ~22 other tables still exposed this way — see REQ-SEC-002 in TODO.md. | `mobile-app/SUPABASE_APP_AUTH.sql`; live test detail in `planning\SECURITY-THREAT-MODEL.md` F2 |
| "DO NOT... use public S3 buckets" | Mobile app's photo bucket is public-read, plain `Image.network`, no presigning. **Decided 2026-09-04: keep as-is** — a deliberate tradeoff (CORS history), not an oversight. | `mobile-app/lib/common/widgets/s3_image.dart`, `documentation\PROJECT_CONTEXT.md:67` |
| `users` table with `password_hash` | `app_password` was stored as plaintext TEXT, compared with `=`. **Fixed 2026-08-21** — hashed with bcrypt, admin panel's view/copy replaced with a Reset-Password action. | `mobile-app/SUPABASE_APP_AUTH.sql`, `mobile-app/SUPABASE_HASH_APP_PASSWORD.sql` |
| Firebase Cloud Messaging | Not implemented — in-app notifications only | `documentation\PROJECT_CONTEXT.md:69` |

This is recorded as fact, not fixed-everywhere. Full detail + risk in
`planning\SECURITY-THREAT-MODEL.md`; current REQ-SEC-001..004 status is also
summarized in `AGENTS.md`'s project section (corrected 2026-09-16 — it had
gone stale, see that file's note).

## Environment (REAL, verified 2026-08-18)
| Tool | Version |
|---|---|
| Node | v24.18.0 |
| npm | 11.16.0 |
| git | 2.55.0.windows.3 |
| Flutter | 3.47.4 (stable) — **updated 2026-09-13**, was 3.47.0 |
| Dart | 3.13.3 — **updated 2026-09-13**, was 3.13.0 |
| Next.js | 14.2.35 (from `admin-panel/package.json`) |
| React | ^18 |
| Supabase project | `hxkowdaugkkumvzyfsai.supabase.co` |
| Git remote | `https://github.com/sectofficework-droid/SATYAM-SCHOOL.git`, branch `main` (repo now works directly on `main`; the earlier `debiprasad` working branch was merged in and is no longer the day-to-day branch as of the 2026-09-13 session) |
| Hosting | Vercel (admin-panel, confirmed Production deployments in `Scratch/refdocs/vercel production.png`) |
| Android SDK | **New 2026-08-21** — was entirely absent before this session (`flutter doctor` showed no SDK at all). Installed via `winget install Google.AndroidCLI` (Google's official lightweight CLI, not full Android Studio) at `C:\Users\bkdeb\AppData\Local\Android\Sdk`; `android sdk install` used to pull `platform-tools`, `platforms/android-35`+`36`, `build-tools/35.0.0`+`36.1.0`, `cmdline-tools/latest`, and `ndk/28.2.13676358` (the exact version this project's Gradle build requested). `flutter doctor`'s Android toolchain check still shows `[!]`/license-status-unknown even though the license file's hash matches the correct standard value and a real debug APK build succeeds — cosmetic doctor-check gap with this newer tool, not an actual blocker (see SESSION-2026-08-21-3.md if this resurfaces). |

Do not re-verify these next session unless the task depends on them or the
environment may have changed (§C.2).

## Code status
**Committed and pushed 2026-09-19** — `main` at `6f67b8e` ("Add Staff App
Unification (Admin Workspace) + close REQ-SEC-005/007/008, fix new
REQ-SEC-009"), pushed to `origin/main` at the user's explicit request
("fix all push merge"). This repo works directly on `main` (no PR/branch
flow), so the push is the merge. 42 files, all of session (2)/(3)'s Staff
App work plus the earlier-staged REQ-SEC-005/007 client wiring. Working
tree clean as of the push. Production (Vercel) auto-deploys from `main`,
so the admin-panel changes (Users & Roles linking UI, TC issuance RPC
call, diagnostics RPC call) are now live — **not verified in a live
browser before pushing** (Chrome extension wasn't connected this
session); verified via `npm run lint` (clean) and a manual diff review
only. Watch for user-reported issues on Settings → Users & Roles, the
student TC-issuance page, and `/diagnostics` specifically.

Prior 2026-09-17 uncommitted work (kiosk face-recognition fixes —
`mobile-app/lib/core/services/face_recognition_service.dart`,
`mobile-app/lib/app/modules/attendance_kiosk/face_enroll_capture_page.dart`,
`mobile-app/SUPABASE_FACE_MATCH_RPC.sql`) was **not** part of this push —
check `git status` fresh before assuming it's still there or already
landed some other way.

**Known governance gaps, flagged not backfilled:** four feature commits
between 2026-08-21 and 2026-08-24 (`886c6a3`, `f87a2ce`, `7c96bad`,
`c0e11c1`, `d2f409c`), and the 2026-09-05/06 Play Store signing +
privacy-policy work, both shipped with no `governance\` session-log entry.
Real work, just undocumented — reconstruct from `git log` only if a task
specifically needs that detail.

Prior checkpoints (one line each — full detail in the linked files):
- **2026-09-09** — multi-shift attendance wired end-to-end (kiosk/teacher/
  admin), two real bugs found+fixed live (camera-freeze on route-pop,
  `anon`-vs-`authenticated` grant gap affecting every Flutter↔Supabase call
  project-wide, not just this feature). Merged to `main` at `1c8e08a`. →
  `ai-context\SESSION-2026-09-09-1.md` (archived), `work-log\LOG-2026-09-09.md`.
- **2026-08-28** — Admin Access Code impersonation module; found + fixed a
  privilege-escalation bug in the same migration same session (default
  PUBLIC execute grant); deleted 2 standing QA test accounts. Merged
  `debiprasad`→`main`. → `ai-context\SESSION-2026-08-28-1.md` (archived),
  `work-log\LOG-2026-08-28.md`.
- **2026-08-24** — bulk student import (Basic Details + Replace Full
  Details tools, `data_status` tracking). Commit `7bd8cef`. Migration
  `SUPABASE_STUDENT_BASIC_IMPORT.sql` — confirm it has since been run
  against production before trusting this feature end-to-end. →
  `ai-context\SESSION-2026-08-24-1.md` (archived), `work-log\LOG-2026-08-24.md`.
- **2026-08-21 (3 sessions)** — live-confirmed RLS exploit on
  `students`/`employees`/`admin_users`; REQ-SEC-001 fixed + shipped
  (bcrypt); Add Student form extracted to a shared component + permanent
  student-delete feature shipped. → `ai-context\archive\SESSION-2026-08-21-1.md`
  /`-2.md`/`-3.md`.
- **2026-08-20** — real auth bypass found + fixed (sidebar Logout never
  actually signed out). Merged to `main` at `9a2cfb3`. →
  `ai-context\archive\SESSION-2026-08-20-1.md`.

## Continuity folder — no git-ignore exception needed (RULEBOOK.md §0.8/§0.9)
History: on 2026-08-19, `ai-context\`/`work-log\` were first tracked via a
gitignore carve-out cut into `Scratch/` (the user asked: "if I lost it
locally I should be able to recover them"). Later the same day the user
asked for something cleaner — a dedicated folder outside `Scratch/`
entirely, so no per-path gitignore exceptions are needed at all: `AGENTS.md`
stays at repo ROOT (tooling convention); `RULEBOOK.md`, `BOOTSTRAP.md`
(this file), `ai-context\`, `work-log\` all moved into `governance\`
(ROOT-level, sibling of `Scratch\`, not inside it) via `git mv`. Then,
same day, the user extended it once more to cover the requirement/spec
docs too: `planning\` (`PLAN.md`, `DB-DESIGN.md`, `IMPL-SPEC.md`,
`UI-SPEC.md`, `TODO.md`, `SECURITY-THREAT-MODEL.md`, `RELEASE-PLAN.md`,
`GOVERNANCE-AUDIT.md`) and `documentation\` (`SETUP-GUIDE.md`) moved into
`governance\` too. `governance\` is tracked like any normal folder —
nothing in `.gitignore` references it. `Scratch\SATYAM-SCHOOL\` now holds
only the genuinely disposable/ephemeral material (`coding\` stubs,
`debugging\`, `suggestions\` — all empty) plus 4 of the 5 `.bat` launchers
(`SSIS-AIO.bat`, `start-attendance-app.bat`, `start-student-app.bat`,
`start-teacher-app.bat` — functional, just stored there by choice, not
prep material). `start-website.bat` (the 5th, previously restored to ROOT)
was removed from ROOT entirely 2026-08-19 (later pass than the restore
below) per explicit user decision — no `.bat` launcher for the admin panel
now; `npm run dev` inside `admin-panel\` directly. `Scratch\`'s
root also still holds the two reusable prompt templates, kept as untouched
master copies per an earlier explicit "keep both" decision. Deleted one
stray leftover: a stale duplicate `Scratch\SATYAM-SCHOOL\start-website.bat`
from earlier troubleshooting, now redundant since ROOT no longer has one
either.
`Scratch\` stays fully git-ignored, no exceptions.

`refdocs\` (dashboard screenshots, planning PDFs, source images) moved
from its own ROOT-level folder into `Scratch\refdocs\` — one `/Scratch/`
gitignore rule now covers everything local-only instead of two separate
rules. No tracking change: `refdocs\` was already fully git-ignored before
the move, still is after.

`PROJECT_CONTEXT.md` (the project's own pre-existing technical-architecture
doc — route map, module status, DB schema, constraints — NOT part of the
AI scaffold) moved from ROOT into `governance\documentation\`, via
`git mv` (it was already tracked, so this is a clean rename in git
history, not a re-add). Reasoning: it's a "living reference doc," same
genre as `SETUP-GUIDE.md`, which already lives there — TODO.md and
`ai-context\` serve different purposes (task checklist vs. AI session
logs) and were the wrong fit. Every cross-reference to it, including
`file:line` citations, updated to `documentation\PROJECT_CONTEXT.md` — the
line numbers themselves are unaffected since moving doesn't change file
content.

Before each move, re-scanned everything going into `governance\` for
secrets (`grep` for key/token/password/secret patterns plus the specific
known default-password string). Found and redacted **two** real exposures
this round, in addition to the one already redacted from this file
earlier: `planning\DB-DESIGN.md` and `planning\SECURITY-THREAT-MODEL.md`
both quoted the same live default-password value in their security
write-ups. Redacted both — the finding stays fully documented, just not
the literal value. That value still exists in exactly one place:
`mobile-app/SUPABASE_APP_AUTH.sql` itself (production code, already
committed to git history independent of any of this — redacting the docs
doesn't erase that pre-existing exposure, it just stops the docs from
duplicating it). Verified with `git check-ignore -v` that `Scratch\` is
fully ignored again (no leftover per-path exceptions) after `.gitignore`
was simplified back to a single `/Scratch/` line.

## Root folder layout (updated 2026-08-19, later pass — supersedes both notes below)
Root now holds: `AGENTS.md` (tooling convention — stays here, not moved),
`governance\` (new 2026-08-19, final pass — dedicated tracked folder,
sibling of `Scratch\`, holding: `RULEBOOK.md` [master compliance rule
book, merges both `Scratch\*PROMPT PRODUCTION GRADE.md` files verbatim,
genericized for reuse in any project], `BOOTSTRAP.md` [this file],
`ai-context\` [`SESSION-*.md`, `archive\`], `work-log\` [`LOG-*.md`],
`planning\` [`PLAN.md`, `DB-DESIGN.md`, `IMPL-SPEC.md`, `UI-SPEC.md`,
`TODO.md`, `SECURITY-THREAT-MODEL.md`, `RELEASE-PLAN.md`,
`GOVERNANCE-AUDIT.md`], `documentation\` [`SETUP-GUIDE.md`,
`PROJECT_CONTEXT.md` — the latter moved here 2026-08-19 too, was at ROOT]
— all moved here via `git mv`/`mv`, no gitignore exception needed since
the folder isn't inside `Scratch\`), `.gitignore`, `README.md`,
`admin-panel\`, `mobile-app\`, `schema_dump.json` (pending removal OK, see
TODO REQ-HYG-003), `Scratch\` (fully git-ignored, no exceptions — root
holds the 2 reusable prompt templates + `refdocs\` [moved in 2026-08-19
from its own ROOT-level folder, so one `/Scratch/` rule covers it instead
of a separate `/refdocs/` rule]; `Scratch\SATYAM-SCHOOL\` holds
disposable/ephemeral material [`coding\` stubs, `debugging\`,
`suggestions\`, all empty] plus 4 of the 5
`.bat` launchers — see "Continuity folder" section above for detail). No
`.bat` launcher lives at ROOT: `start-website.bat` was briefly restored to
ROOT 2026-08-19 (content verified byte-identical to the last git commit)
then removed again from ROOT the same day, later pass, per explicit user
decision — superseding both the restore note and the 2026-08-18 "no more
`.bat` files at root" note below. The other 4 `.bat` files
(`start-student-app.bat`, `start-teacher-app.bat`,
`start-attendance-app.bat`, `SSIS-AIO.bat`) remain in
`Scratch\SATYAM-SCHOOL\` — their internal paths use the `%~dp0..\..\`
prefix for that depth, verified working for `SSIS-AIO.bat`'s menu logic and
its Flutter-app dependencies; not re-run end-to-end this session.

If a link in an older note still says "(root)" for any of these, it's
stale — `git status`/`find` are the source of truth, not memory of where
things used to be.

## Last checkpoint
**Current — Session 2026-09-22 — REQ-BUG-018 distribution blocker
resolved via manual Play Store upload; Cat3 Group A restriction
re-applied same day, before device adoption confirmed (user's explicit,
informed choice).**
A prior session (2026-09-21, undocumented until this checkpoint — no
work-log existed for it, only a TODO.md entry) had found Cat3 Group A's
2026-09-19 DB migration went live before its matching Dart/session-token
code reached any real device, breaking every installed Teacher/Student
app (`anon` permission-denied on 9 tables, no error handling — Mark
Attendance, Leave Requests, Alerts, Queries, Tasks, Daily Tasks, Edit
Requests, Teacher Documents all silently stuck). That session rolled the
DB back (`SUPABASE_ROLLBACK_CAT3_GROUP_A_PENDING_APK.sql`) since neither
S3 nor the Play Publisher API could distribute the prepared fix
(v1.0.0+3) at the time.

This session: user connected Claude in Chrome and manually selected both
emergency AABs (~104-113MB, still over the browser-automation upload
tool's limit) through the native file picker, resolving the distribution
blocker. Teacher app release 3 (1.0.0, versionCode 3) and Student app
release 2 (1.0.0, versionCode 3) both submitted for Google review —
replacing stale versionCode 2 (Sep 19)/1 (Sep 17) respectively. Confirmed
via `git diff --cached` that Student's release carries real changes
(guard-pattern fix + shared session-token wiring), not a no-op, when the
user questioned why Student needed a release. Play Publisher API access
for Student (403) remains unfixed — this was a manual-upload success
only.

**Same day, user then explicitly chose to re-apply the Cat3 Group A DB
restriction immediately** — before Google's review cleared and before any
device had versionCode 3. Flagged the tradeoff first (every
currently-installed device breaks again; `app_versions` has no populated
rows so there's no force-update signal), asked via AskUserQuestion, user
confirmed. Applied migration
`req_sec_002_cat3_group_a_relock_after_v3_submission` (only needed to
re-enable RLS + revoke `anon` — the 2026-09-21 rollback never dropped the
original policies/RPC functions), live-verified. **The REQ-BUG-018 outage
is back in effect right now, by deliberate choice** — do not roll it back
again without the user asking; do not treat user reports of these 9
features breaking as a new bug. Real next step once review clears:
populate `app_versions` rows for `teacher`/`student` with `force_update`
considered. Full detail: `work-log\LOG-2026-09-22.md`, `planning\TODO.md`
REQ-BUG-018.

**Later the same session: REQ-SEC-002 Category 3 Group B (6 tables)
implemented and verified.** User asked to continue with Group B + Group C
+ `employees` in one push. Built Group B fully: `exams`, `exam_marks`,
`homework`, `syllabus`, `syllabus_subtopics`, `student_attendance` moved
to session-token-gated RPCs (~30 functions including student-facing
reads). Migration: `mobile-app/SUPABASE_CAT3_GROUP_B_RPCS.sql` + 2
follow-up migrations for gaps found mid-build. **Two real corrections
found by reading actual page files, not trusting the plan doc**: (1)
`teacher_classes.dart`'s own comment says any teacher can create exams/
homework/syllabus for any class (deliberate cross-class-coverage feature)
— so CREATE is identity-gated only, not class-gated, while READ still
uses the new `is_teacher_of_class` helper exactly as the plan intended;
(2) the student app also reads these same tables for its own class —
missed in the initial teacher-focused pass, fixed with 5 additional
student-facing RPCs that resolve the student's own class server-side via
`student_enrollments`, never trusting the client. Verified via 20
rolled-back-transaction test cases (Group A's proven method): class-
broadening gated correctly, "any class" create correctly open, ownership
checks block other teachers, wrong/cross-identity tokens rejected,
student own-mark-only access confirmed (a real tightening — previously
any anon could read every student's exam marks). `flutter analyze` clean;
both teacher- and student-flavor debug APKs build. **Table lock-down
deliberately NOT run** — written but commented out in the migration, per
the REQ-BUG-018 lesson: only run it once a build with these Dart changes
is confirmed installed on real devices, same as Group A's still-pending
v4. **Not yet tested on a real device.**

**Immediately after, same session: Group C (2 tables) done, then the
`employees` phase closed out REQ-SEC-002 Category 3 entirely.** Group C
(`official_exam_marks`, `student_attendance`'s per-student read) built the
same way as Group B — found `student_attendance` wasn't actually
dual-shape (only the student app calls that specific read), but found a
real pre-existing info leak in `official_exam_marks`: the student page was
fetching the whole class's official results and filtering to its own row
client-side, meaning any anon caller could already read every student's
official marks. Fixed with a dedicated student-only RPC. Migration:
`mobile-app/SUPABASE_CAT3_GROUP_C_RPCS.sql`. Verified via 9 rolled-back
tests; `flutter analyze` clean; both flavors build. Table lock-down
deferred, same REQ-BUG-018 discipline as Group A/B.

**Then `employees`: a real, currently-live exposure found and fixed
immediately, no app release needed.** `anon` had live INSERT and DELETE on
the whole `employees` table (zero legitimate mobile use) plus SELECT on
Aadhaar number, PAN number, salary, DOB, address — none of it read by any
mobile Dart code. Confirmed live-exploitable via a role-simulated
rolled-back transaction (INSERT reached a NOT-NULL constraint, proving the
grant was real). Only 2 legitimate reads exist anywhere in mobile Dart,
needing just `id, name, phone, type, status, designation`. Fixed with a
direct grant narrowing (`REVOKE ALL` + narrow column `GRANT SELECT`) — no
RPC needed, no Dart change needed, so unlike every other Category 3 piece
this one is **already live in production**, not waiting on a future
release. **REQ-SEC-002 Category 3 is now fully complete** (Foundation +
Groups A/B/C + employees). Group A/B/C's own table locks remain the only
deferred piece, still waiting on confirmed v4 device adoption per
REQ-BUG-018. Full detail: `planning\TODO.md` REQ-SEC-002 Category 3 entry.

**Then, user-reported bug found and fixed same session: REQ-BUG-019 —
Admin Access Code login showed an empty Teacher profile instead of Admin
Workspace for admin-linked accounts.** Root cause: `_impersonation_
employee_json` (the Admin Access Code login path) never got the
`admin_role` field that `teacher_login` gained when Staff App Unification
shipped — confirmed by diffing both live function bodies directly. Fixed
via `mobile-app/SUPABASE_FIX_IMPERSONATION_ADMIN_ROLE.sql` (also captures
the `session_token` addition a prior session applied live but never fully
wrote to a tracked file). Verified against a real admin-linked employee
(EMP003). **No Dart change needed — already live.** Full detail:
`planning\TODO.md` REQ-BUG-019.

**Prior — Session 2026-09-19 (4) — REQ-SEC-002 status audit, tasks/
daily_task_targets production regression fixed, face-embedding exposure
fast-tracked and fixed, Category 3 Foundation + Group A implemented.**
User asked for a status check across all open `TODO.md` items, then to
work through them. Live-verified findings against the file's claims
(Supabase MCP queries, git log, greps) rather than trusting the file as
current truth — found several stale notes (corrected) and one real gap.

**Live production regression found and fixed**: Tranche 1's earlier
REQ-SEC-002 fix (same day, prior session) had wrongly classified `tasks`
and `daily_task_targets` as admin-only and revoked `anon` access entirely
— but the Teacher app's PostgREST embeds (`task:tasks(*)`,
`daily_task_targets(employee_id)`) need direct `SELECT` on those tables
too, even though no Dart code queries them by name. Every "My Tasks"/
"Daily Tasks" fetch had been failing since that fix shipped. Fixed:
restored `anon` SELECT-only (writes stay admin-only). Migration:
`mobile-app/SUPABASE_FIX_TASKS_ANON_REGRESSION.sql`.

**REQ-SEC-002 mobile-tables plan drafted, reviewed, then Categories 1+2
applied.** Wrote `planning\REQ-SEC-002-MOBILE-TABLES-PLAN.md` (33
remaining RLS-disabled tables, split into 3 categories). Independently
re-verified its claims against live state before acting (caught one real
gap: `daily_tasks` had been dropped from the categorization, fixed).
Applied Categories 1 (4 RPC-only tables) and 2 (12 mobile-read-only
tables) — same proven Tranche-1 shape, `rls_disabled` count dropped
33→17, matching Category 3's remaining scope exactly.

**Face-embedding exposure — found while planning Category 3, fast-tracked
ahead of it on the user's decision.** `employees.face_embedding` (raw
biometric vectors for every enrolled staff member) was readable directly
by any `anon` caller, no auth at all — comparable severity to the already-
fixed REQ-SEC-006 plaintext-password backup. Fixed with a new, narrower
kiosk-admin-token mechanism (20 min fixed expiry, minted on correct PIN
entry — separate from Category 3's teacher/student session tokens):
`mobile-app/SUPABASE_FIX_FACE_EMBEDDING_EXPOSURE.sql`. **Caught and fixed
a real bug in my own fix during verification**: the first attempt used a
column-level `REVOKE SELECT (face_embedding) ... FROM anon`, which had no
effect (Postgres doesn't restrict a column via REVOKE when the role
already holds the table-level grant) — confirmed live that `anon` could
still read the column afterward, then corrected to a full table-level
revoke + explicit column allowlist. Dart side (`admin_pin_dialog.dart`,
`kiosk_home_page.dart`, `staff_enroll_list_page.dart`,
`face_enroll_capture_page.dart`, `kiosk_pin_service.dart`,
`supabase_service.dart`) threads the new token through; attendance-flavor
debug APK builds. **Not yet installed/tested on the physical kiosk.**

**REQ-SEC-002 Category 3 (mobile session-token rollout): direction
decided, plan drafted and reviewed, Foundation + Group A implemented.**
User chose RPC re-verification over real Supabase Auth (rejected — would
reopen the "no new auth system" rule) or deferral. Plan:
`planning\REQ-SEC-002-CATEGORY3-RPC-PLAN.md`. User then decided the
identity mechanism (server-issued session token, 7-day sliding expiry)
and scoped this session to Foundation + Group A (not the full 17-table
rollout). Built: `mobile_sessions` table + `mint_mobile_session`/
`verify_mobile_session`/`revoke_mobile_session`, wired into
`teacher_login`/`student_login` and — found necessary mid-build, not
originally scoped this precisely — the impersonation-login and
sibling-switch paths too, since those also produce a cached session via
`AuthService._saveSession`. Deliberately NOT wired into password-change
this pass (flagged, not silently dropped). Then all 9 Group A tables
(`leave_requests`, `queries_suggestions`, `student_alerts`,
`teacher_alerts`, `task_assignees`, `daily_task_completions`,
`attendance_edit_requests`, `syllabus_edit_requests`,
`teacher_documents`) moved to session-token-gated RPCs; also closed two
previously id-only, no-owner-check call sites
(`closeSyllabusEditWindow`/`deleteTeacherDocument`). Migrations:
`mobile-app/SUPABASE_CAT3_FOUNDATION_MOBILE_SESSIONS.sql`,
`mobile-app/SUPABASE_CAT3_GROUP_A_RPCS.sql`. **Caught and fixed a real bug
during verification**: `verify_mobile_session`'s first version used `GET
DIAGNOSTICS` into a `boolean` variable instead of `int` — failed on its
first live test. Verified live throughout (role-simulated, rolled back):
full RPC chains work, wrong-token calls rejected, direct table access
blocked, `rls_disabled` count dropped 17→8 (exactly Group B + Group C +
`employees`' remaining scope). Dart: 18 `supabase_service.dart` methods +
10 call-site files across teacher/student modules updated;
`flutter analyze` clean; teacher- and student-flavor debug APKs both
build. **Not yet tested on a real device with a real login.**

Full detail: `planning\TODO.md` REQ-SEC-002 (both entries),
`planning\REQ-SEC-002-MOBILE-TABLES-PLAN.md`,
`planning\REQ-SEC-002-CATEGORY3-RPC-PLAN.md`. Nothing committed — staged
only (DB migrations are live in Supabase; Dart changes are local, not
committed to git), per this project's standing rule.

**Prior — Session 2026-09-19 (3) — Staff App Unification: DESIGN FIXED,
UI DESIGN CONFIRMED, and both phase-1 AND phase-2 CODING done same
session.**
Continuation of session (2) below: user approved the DESIGN FIXED draft
as-is, delegated UI DESIGN CONFIRMED review ("check ui design if
everything ok confirm"), then said "code it" and asked to be left alone
until the feature was complete ("i am here if anythng otherr questions...
ask me out after you start working ill be out you need complete the feat
witout interrupting"). Built the full phase-1 Admin Workspace:
- **Backend**: `mobile-app/SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql`, ~30
  new `SECURITY DEFINER` RPCs (one per phase-1 action, each re-deriving
  admin tier server-side via a new `staff_admin_tier()` helper —
  never trusting a client flag), plus `teacher_login` extended with an
  additive `admin_role` field. Applied live via Supabase MCP across 6
  migrations, advisor-checked clean.
- **Admin-panel prerequisite**: `mobile-app/SUPABASE_ADMIN_EMPLOYEE_LINK_UI.sql`
  + a "Link to employee" control added to Settings → Users & Roles
  (management-only) — without this, `employees.admin_user_id` (added
  2026-09-18) had no UI to ever set, so the feature would have shipped
  unreachable. **Caught a real bug while building it**: this project's
  default privileges auto-grant `EXECUTE` to `anon` for every function
  `postgres` creates — the two new management-only RPCs were briefly
  anon-callable (not an active exploit — `admin_has_role()`'s `auth.uid()`
  check is always null for anon — but the grant itself was wrong) until an
  explicit `REVOKE ... FROM anon` closed it, verified via a second advisor
  pass.
- **Mobile UI**: `mobile-app/lib/app/modules/teacher/admin_workspace/`
  (9 new screens: Dashboard, Attendance, Punch Code, Inventory, Notices,
  Queries, Question Papers/Documents, Syllabus Requests
  [senior_admin/management only], Tasks) + new
  `lib/core/services/staff_admin_service.dart`. `teacher_home.dart`
  touched only to append one conditional "Admin" bottom-nav tab after the
  existing 5 — verified the existing Teacher tabs/indices are untouched.
- **Correctness pass, caught before shipping**: cross-checked every
  status/enum value against the real admin-panel source instead of
  assuming, and found two invented values that would have written data
  nothing else in the system recognizes — attendance only has
  Present/Absent (a "Late" state had been added, doesn't exist anywhere
  else), and notice audience is `"All Students"` not `"Students"`. Also
  corrected a wrong assumption inherited from the original feature
  inventory: admin-panel "Question Papers" is actually the
  `teacher_documents` table (uploaded files), unrelated to the
  `question_papers`/`question_bank` paper-builder tables — fixed before
  the mobile screen was built, not after.
- **Verified**: `npm run lint` (admin-panel) clean; `flutter analyze`
  clean (0 issues, after fixing 7 style/async-safety infos); a debug APK
  for the teacher flavor builds successfully end-to-end
  (`assembleTeacherDebug`, 43s).
- **On-device tested same session, on BlueStacks** (`emulator-5554`).
  With the user's permission, linked `EMP003` (their own employee record,
  senior_admin) and set a temporary password to log in. Confirmed against
  real live data: Admin tab/workspace appears, dashboard summary matched a
  direct DB check exactly, Attendance's class picker + real roster +
  Present/Absent toggle worked, Queries' list + reply sheet correctly
  pre-filled from a real pending query. No crashes.
- **Real bug caught by the user during that test, fixed same session**:
  `EMP003` is `type = non-teaching`, and the first implementation pass had
  always appended Admin Workspace as a 6th tab regardless of `isTeacher` —
  missing the non-teaching case `STAFF-APP-DESIGN-FIXED.md` §4 had
  actually specified (Admin Workspace should *replace* the Teacher tabs
  for an admin-only account, not sit next to irrelevant ones like student
  marks entry or Syllabus). Fixed: `teacher_home.dart` now branches on
  `isTeacher` — Teacher+Admin combo keeps the untouched additive 6th tab;
  admin-only gets Admin Workspace as the whole app, no bottom nav.
  Re-verified on BlueStacks after rebuilding: works correctly, no
  double-header, sub-navigation into modules still fine. Neither the
  Teacher tab screens nor `AdminWorkspaceHome`'s own visual design were
  touched by this fix — only the shell logic deciding when each is shown.
  `flutter analyze` clean throughout.
- User decided to keep the `EMP003` ↔ `admin_users` link permanently
  (it's real, not just test scaffolding) — **user still needs to reset
  the temporary password** via the admin panel before this account is
  production-safe again.
- **Deliberately out of scope, phase 1 only** (superseded by phase 2
  below, same session): Employee/Student CRUD, Fees, Expenses, GR Book,
  Documents (ID card/marksheet/bonafide/TC/NOC), Report generation, full
  Syllabus CRUD, Settings, Super-Admin, Diagnostics, Salary,
  impersonation-initiation.

**Phase 2 (full admin-web parity), same session, immediately after the
above.** After seeing phase 1 live, the user asked for a richer dashboard
and, separately, full feature parity — explicitly including the 4 items
just listed as excluded ("Include everything, no exceptions"). Built:
dashboard redesign (categorized sections, richer cards — caught and fixed
a real overflow bug on-device); ~35 more RPCs
(`SUPABASE_STAFF_APP_ADMIN_WORKSPACE_PHASE2.sql`) covering Students (full
CRUD + permanent delete + TC issuance, gated correctly unlike the
admin-panel's own ungated version), Employees (full CRUD + password reset
+ Admin Access Code generation), Fees, Expenses, full Inventory CRUD,
full Syllabus CRUD, GR Book, Users & Roles, Salary. **Second real bug
caught via on-device testing**: a Dart↔SQL RPC parameter name mismatch
(`p_target_id` vs the function's actual `p_student_id`) surfaced as
"Could not load student."; audited every other new RPC call against live
function signatures afterward to rule out the same class of bug
elsewhere — this was the only one. Verified on BlueStacks with real data
across Students (list + full detail), Employees list, GR Book, Expenses
(including a delete-confirmation flow, canceled without touching data),
Users & Roles (all 4 real accounts, self-delete protection correct).
Deliberately NOT ported (disclosed, not silent): bulk Excel import (GR
Book, Super-Admin bulk tools), PDF template generation (ID
cards/marksheets/bonafide — a materially different, large undertaking
from CRUD screens), Settings' deeper config tabs, a dedicated Reports
module.

**Follow-up "fix all and close all todo" pass, same session**: EMP003's
temp password reset; REQ-SEC-007 fully closed (applied the long-pending
diagnostics migration + tier-gated RPC); REQ-SEC-008 closed (admin
panel's TC issuance now gated via `admin_issue_tc`); **new finding
REQ-SEC-009 found+fixed** (kiosk admin settings/PIN had zero role check
and were anon-callable — full unauthenticated kiosk-PIN-takeover, worse
than 007/008); three more low-severity findings disclosed not fixed as
**REQ-SEC-010**. BlueStacks disconnected mid-pass, so no further on-device
testing happened; bulk import/PDF generation/deeper Settings/Reports
remain not built. Full detail: `planning\TODO.md` REQ-SEC-007/008/009/010.

Full detail: `planning\STAFF-APP-UNIFICATION-PLAN.md`'s "What
shipped" sections, `planning\STAFF-APP-DESIGN-FIXED.md`,
`planning\STAFF-APP-UI-DESIGN.md`. **Nothing committed** — staged only,
per this project's standing rule.

**Prior — Session 2026-09-19 (2) — Staff App Unification: PLANNING
approved, DESIGN FIXED drafted.** User asked to review
`planning\STAFF-APP-FEATURE-INVENTORY.md`, surface anything pending, and
get all needed decisions upfront before proceeding. Asked 4 questions,
got answers: (1) inventory approved as-is — **PLANNING gate closed**; (2)
REQ-SEC-007's diagnostics-download policy decided (`normal_admin` should
not see full report content) — recorded in `TODO.md`, not yet implemented
(table still not live); (3) traced the Documents module's TC/NOC
write-path (previously flagged, not done) — found NOC isn't built
anywhere (dead "Coming Soon" tab) and real TC issuance lives outside the
`documents` module entirely (`student\[id]\tc\page.js` →
`studentService.saveTransferCertificate()`), with **zero role gating on a
real state-changing write** (flips student to "Left", deactivates
enrollment) — filed as new **`TODO.md` REQ-SEC-008**, not fixed, flagged
for priority decision; corrected the feature inventory's Documents section
to match. (4) User chose to keep going same session — drafted
**`planning\STAFF-APP-DESIGN-FIXED.md`**: `StaffRoleContext` shape +
resolution mechanism (recommends resolving role at `teacher_login` time,
embedded in its response — no new session mechanism, per the "no new auth
system" non-negotiable), a binding backend-security pattern (every mobile
Admin Workspace RPC must be `SECURITY DEFINER` + re-verify role
server-side, regardless of how loosely the admin panel itself gates the
same action — mobile runs as `anon` with RLS disabled project-wide, so
copying the panel's laxness would mean zero enforcement), and a proposed
per-module mobile-vs-admin-panel-only mapping for all 18 inventory
modules (phase-1 mobile set: Dashboard read, Attendance, punch-code
generation, inventory usage/checkout, Notice, Queries, Question Papers
read, Syllabus approve/reject, Tasks — everything else stays admin-panel-
only with a reason, including a "recommend never on mobile" flag on
permanent student delete). **Explicitly flagged as a draft, not a
decision** — DESIGN FIXED §5 lists 5 open questions for the user,
including that the original 2026-09-18 33-section discovery spec's full
text wasn't available this session (only the summarized non-negotiables
in `ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md` were), so this draft
couldn't be checked against it line-by-line. **No code written, nothing
committed** — this whole session was planning-doc work only, per the
gate rules (`AGENTS.md` §F: no gate advances without its trigger phrase;
CODING needs literal "code it," not given this session).

Earlier checkpoints, one line each (full detail in the linked files):
- **2026-09-19 (1)** — REQ-SEC-005: found and fixed a real privilege-
  escalation hole (any admin could self-promote to `management` via a
  direct `admin_users` update, no server-side check) plus 2 related gaps
  (permanent student delete, pending diagnostics toggle); 5 new
  `SECURITY DEFINER` RPCs, live-verified via 16 rolled-back-transaction
  test cases, direct table grants revoked. Staged, not committed. →
  `planning/TODO.md` REQ-SEC-005.
- **2026-09-17** — attendance kiosk face-recognition reliability
  (REQ-BUG-014): centroid-based matching, threshold retune, un-mirrored
  ML Kit coordinate bug fixed + face alignment added (all 6 enrolled staff
  need to re-enroll), enrollment flow shortened. Fix 3/4 not yet verified
  against a live re-enrollment. → `ai-context\SESSION-2026-09-17-1.md`,
  `work-log\LOG-2026-09-17.md`, `TODO.md` REQ-BUG-014.
- **2026-09-16** — governance clarity pass (rule-book fixes, §K/§L added)
  + REQ-HYG-006 diagnostic-logging system built end-to-end (migration
  **still not applied** to production); Teacher app Play Store
  closed-testing submitted (11/11). → `ai-context\SESSION-2026-09-16-1.md`,
  `work-log\LOG-2026-09-16.md`.
- **2026-09-13 (6 sessions)** — kiosk face-scan freeze fixed (redundant
  JPEG decoding + `takePicture()` latency → single decode + live
  preview-stream capture), verified over a 13-min on-device run
  (4,500-7,400ms → 22-400ms per poll). Real-device (non-BlueStacks) sanity
  check was flagged as recommended-not-blocking at the time — since done,
  see the 2026-09-17 checkpoint above (same physical kiosk device used
  repeatedly that session). → `ai-context\SESSION-2026-09-13-4.md`/`-5.md`/
  `-6.md` (+ `archive\-1.md`/`-2.md`/`-3.md`), `work-log\LOG-2026-09-13.md`.
- **2026-09-09** — multi-shift attendance shipped + merged to `main`. →
  `ai-context\SESSION-2026-09-09-1.md` (archived), `work-log\LOG-2026-09-09.md`.
- **2026-09-07** — Play Store store-listing assets (descriptions,
  screenshots, reviewer test accounts) for Teacher/Student apps; confirmed
  a new Play Console developer account needs 12+ opted-in closed testers
  for 14 consecutive days before either app reaches Production; corrected
  REQ-SEC-002's real scope to 73 RLS-disabled tables (not ~25). →
  `ai-context\archive\SESSION-2026-09-07-1.md`, `work-log\LOG-2026-09-07.md`.
- **2026-09-04** — merged `debiprasad`→`main` (calendar/ID-card bug fixes;
  REQ-SEC-002 partial fix on `students`/`admin_users`; REQ-SEC-004 fixed;
  REQ-SEC-003 decided as accepted-risk). → `work-log\LOG-2026-09-04.md`
  session 2.
- **2026-08-28** — Admin Access Code impersonation module + same-session
  privilege-escalation fix; deleted 2 standing QA test accounts. →
  `ai-context\SESSION-2026-08-28-1.md` (archived), `work-log\LOG-2026-08-28.md`.
- **2026-08-24** — bulk student import feature shipped, 3-day governance
  gap flagged (not backfilled). → `ai-context\SESSION-2026-08-24-1.md`
  (archived), `work-log\LOG-2026-08-24.md`.
- **2026-08-21 (3 sessions)** — RLS exploit live-confirmed (finding);
  REQ-SEC-001 fixed + shipped (bcrypt); Add Student form extraction +
  permanent student-delete shipped. →
  `ai-context\archive\SESSION-2026-08-21-1.md`/`-2.md`/`-3.md`.
- **2026-08-20** — real auth bypass (Logout never signed out) found +
  fixed, merged to `main`. → `ai-context\archive\SESSION-2026-08-20-1.md`.
- **2026-08-19** — read-only secrets-hygiene check, nothing leaked in
  tracked files. → `ai-context\archive\SESSION-2026-08-19-2.md`.

## Next step
Open items, most recent first (superseded/completed items removed — see
the checkpoint list above for what already shipped):

-2. **Cat3 Group A DB restriction is LIVE right now (re-applied
    2026-09-22), and every device still on versionCode 1/2 is currently
    broken on 9 features (Mark Attendance's edit-request check, Leave
    Requests, Alerts, Queries, Task Assignees, Daily Task Completions,
    Attendance/Syllabus Edit Requests, Teacher Documents) — this is
    accepted/expected, not a bug to fix by rolling back.** Once Google's
    review clears for Teacher release 3 / Student release 2 (both
    versionCode 3, submitted 2026-09-22): populate `app_versions` rows for
    `teacher`/`student` (schema exists, no rows populated yet) with
    `force_update` considered, so the app can actually prompt installed
    devices to update rather than relying on passive Play Store
    auto-update. Separately, Play Publisher API access for
    `com.satyamstars.student` is still not granted in Play Console Users &
    permissions (403) — only matters if a future session wants to automate
    Student uploads via API instead of the manual browser path that worked
    this session. See `work-log\LOG-2026-09-22.md`, `planning\TODO.md`
    REQ-BUG-018.
-1. **Three debug APKs built 2026-09-19 (4), none installed/tested on a
    real device yet.** `app-attendance-debug.apk` (face-embedding fix —
    needs the kiosk PIN → staff enrollment flow checked with the real
    PIN); `app-teacher-debug.apk` / `app-student-debug.apk` — superseded
    for the Cat3 Group A concern specifically by the versionCode 3
    Play Store releases above, but the face-embedding/kiosk PIN check on
    `app-attendance-debug.apk` is still outstanding on its own.
-0.5. **REQ-SEC-002 Category 3 — Groups B/C + rest of `employees` not
    started.** Group B (6 tables: `exams`, `exam_marks`, `homework`,
    `syllabus`, `syllabus_subtopics`, `student_attendance`) needs a new
    `is_teacher_of_class` helper. Group C (`official_exam_marks` +
    `student_attendance`'s dual student/teacher shape) needs tracing
    student-app page files the existing plan didn't cover — do last. See
    `planning\REQ-SEC-002-CATEGORY3-RPC-PLAN.md`.
0. **REQ-FEAT-001 — Staff App unification (phase-1 AND phase-2 CODING
   done 2026-09-19, same day, on-device tested).** Phase 2 added same
   session after the user reviewed phase 1 live and said "Include
   everything, no exceptions" on full admin-web parity (including the 4
   originally-excluded high-risk actions: permanent student delete, Users
   & Roles account management, Salary, Admin Access Code generation).
   Dashboard redesigned (richer, categorized sections). ~35 more RPCs
   (`mobile-app/SUPABASE_STAFF_APP_ADMIN_WORKSPACE_PHASE2.sql`): Students
   (full CRUD + permanent delete + TC issuance), Employees (full CRUD +
   password reset + impersonation codes), Fees, Expenses, full Inventory
   CRUD, full Syllabus CRUD, GR Book, Users & Roles, Salary. Two real bugs
   caught and fixed via on-device BlueStacks testing this session (see
   `planning\STAFF-APP-UNIFICATION-PLAN.md`'s two "What shipped"
   sections for both). A few desktop-shaped workflows (bulk Excel import,
   PDF template generation for ID cards/marksheets, Settings' deeper
   config tabs, a dedicated Reports module) were deliberately not ported
   — disclosed in the plan file, not silently dropped, and flagged for
   the user to weigh in on. Original phase-1 checkpoint text below is
   preserved as history. Evolved
   `mobile-app/` teacher flavor into a role-aware Staff App (Teacher +
   Admin workspaces). Discovery archived at
   `governance\ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`. Working
   plan: `governance\planning\STAFF-APP-UNIFICATION-PLAN.md` (see its
   "What shipped 2026-09-19" section). **All gates through CODING are
   closed**: CLARIFY, PLANNING, DESIGN FIXED
   (`planning\STAFF-APP-DESIGN-FIXED.md`), UI DESIGN CONFIRMED
   (`planning\STAFF-APP-UI-DESIGN.md`), and CODING (backend RPCs + 9
   mobile screens + admin-panel employee-linking prerequisite, all built
   and verified via lint/analyze/debug-APK-build). **Tested on BlueStacks
   the same session** — with your permission, linked `EMP003` (your own
   employee record) to its `admin_users` row and set a temporary password
   to log in; verified the Admin tab appears, dashboard summary/Attendance/
   Queries work correctly against real live data, no crashes. Not yet
   independently clicked through: Notices/Inventory/Punch Code/Documents/
   Syllabus/Tasks (same proven pattern, not separately exercised) or any
   actual write action. **Decided 2026-09-19**: keeping the `EMP003` ↔ `admin_users` link (real,
   not just test scaffolding) — **you still need to reset the password off
   the temporary `TestPass2026!` value** via the admin panel's Employee →
   Reset Password action before this account is production-safe again; not
   done automatically, flagged here so it isn't forgotten. Two related findings,
   tracked separately in `TODO.md`, not blocking this plan: REQ-SEC-007
   (diagnostics-download policy — decided, not yet implemented) and
   REQ-SEC-008 (Transfer Certificate issuance has zero role gating on a
   real state-changing write; needs a priority call).
1. **REQ-SEC-002 (only remaining open security item)** — `employees` +
   ~22 other tables (73 total per Supabase's live advisor) still have RLS
   disabled / broad `anon` grants; `employees` specifically is blocked on
   REQ-SEC-004-style RPC rework since the mobile app reads/writes it
   directly with the anon key. Needs your priority decision — see
   `planning\TODO.md`.
1a. **REQ-HYG-006 (Phase 1 through 1.7 shipped 2026-09-16, not fully
    verified)** — **run `mobile-app\SUPABASE_DIAGNOSTIC_REPORTS.sql` in
    the Supabase SQL Editor first** — nothing reports anywhere until that
    migration is applied. **Auto-submission defaults to OFF** (the new
    `diagnostic_settings` switch) — turn it on from `/diagnostics` when
    you actually want to catch errors automatically; it stays off
    otherwise by design. After the migration: needs a real
    on-device/in-browser error-trigger pass (§L10) to close out, plus a
    decision on whether/when to do the still-not-started Phase 2
    (request-ID threading through Supabase calls) — see
    `planning\TODO.md`.
2. **Real-device sanity check for the kiosk fix (2026-09-13, not
   blocking)** — every measurement so far was on BlueStacks; a real-tablet
   scan would close out the "recommended, not blocking" item from that
   session.
3. **Install the fixed build on the real physical kiosk device
   (2026-09-09 finding, carried forward)** — confirm whether this has
   since been done; if not, check-ins on the physical device may still be
   using an old build.
4. **Live-verify the Admin Access Code mobile-app login UI (2026-08-28,
   carried forward)** — only verified via direct RPC calls + static
   analysis so far, not an actual device run of "Have an Admin Access
   Code?".
5. **Manually verify the bulk-import flow end-to-end (2026-08-24, carried
   forward)** — both tools, badge/filter, bogus-enrollment-no error path,
   mobile login; confirm `SUPABASE_STUDENT_BASIC_IMPORT.sql` has been run
   against production.
6. **`DROP TABLE _app_password_backup_20260821;`** — cleanup step noted in
   the REQ-SEC-001 migration itself; not run yet since full verification
   of the password-reset UX wasn't confirmed complete as of that session.
7. **REQ-HYG-001/002** — no automated tests for `admin-panel/`, no CI
   pipeline. User chose to skip for now (2026-09-04) — left open, not
   closed, see `TODO.md`.
8. **Teacher app Play Store closed testing** — submitted 2026-09-16,
   11/11 checklist items done; now blocked on the 12-tester/14-day clock.
   See `work-log\LOG-2026-09-16.md`.
9. **Governance gaps not backfilled** — the four undocumented commits
   (2026-08-21→24) and the 2026-09-05/06 Play Store signing/privacy-policy
   work (see "Code status" above). Decide whether/when to reconstruct
   session logs for these, or accept the gap as-is.
