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
Last verified via `git log`/`git status` 2026-09-16: `main` at `b997c2f`
("Log Teacher app Play Store closed-testing session..."), in sync with
`origin/main`. **As of 2026-09-17, the working tree has real uncommitted
changes** (attendance kiosk face-recognition fixes — see "Last checkpoint"
below and `ai-context\SESSION-2026-09-17-1.md`): `mobile-app/lib/core/
services/face_recognition_service.dart`, `mobile-app/lib/app/modules/
attendance_kiosk/face_enroll_capture_page.dart`, `mobile-app/
SUPABASE_FACE_MATCH_RPC.sql`, plus `governance\planning\TODO.md`. Not
committed — user has not asked. Production (Vercel) tracks `main`, unaffected
(these changes are mobile-app + a Supabase function, not admin-panel).

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
**Current — Session 2026-09-19 (REQ-SEC-005, admin role-tier enforcement).**
While closing out the Staff App Unification plan's CLARIFY question ("does
per-role permission behavior really live only in Zustand?"), found the
answer was worse than assumed: `normal_admin` vs `senior_admin`/`management`
was enforced only in React components for several admin-panel actions, with
no matching backend check. Worst instance: any authenticated admin
(including `normal_admin`) could call `admin_users.update({role:
'management'})` on their own row directly and self-promote — full
privilege escalation, no server-side check at all. Also found: permanent
student delete and the (not-yet-applied) `diagnostic_settings` toggle had
the same gap. **Fixed and applied to production 2026-09-19** (user
approved via explicit "code it"-equivalent after 4 rounds of upfront
clarifying questions, then let the session run uninterrupted to
completion): new migration `mobile-app/SUPABASE_ADMIN_ROLE_ENFORCEMENT.sql`
adds 5 `SECURITY DEFINER` RPCs (`admin_has_role`, `admin_create_user`,
`admin_update_user`, `admin_delete_user`, `admin_delete_student_permanently`)
that check role server-side (management-only for senior_admin/management
accounts and promotions; no self-role-change; no self-delete), then revokes
the direct `admin_users` INSERT/UPDATE/DELETE and `students` DELETE grants
so the RPCs are the only path. Also hardened: revoked the 5 new functions'
default PUBLIC/anon execute grant (flagged by Supabase's own security
advisor immediately after first applying). Fixed the pending
(not-yet-applied) `SUPABASE_DIAGNOSTIC_REPORTS.sql`'s toggle policy the same
way before it ever ships. **Live-verified** via 16 role-simulated test
cases directly in Postgres (`set_config('request.jwt.claim.sub', ...)` +
`SET LOCAL role`, all inside rolled-back transactions — no real data
touched) covering every reject/allow path, plus 2 sanity checks that
legitimate reads still work; all passed. Client code updated
(`settings/UsersRolesTab.js`, `lib/studentService.js`'s
`deleteStudentPermanently`) to call the new RPCs — `npm run lint` clean.
**Deliberate, disclosed tradeoff:** applying the DB fix without deploying
the client first means "Settings → Users & Roles" (create/edit/delete admin
accounts) and "permanently delete a student" will error in the *live* admin
panel for everyone, including management, until the staged client code is
committed/pushed/deployed — user chose this explicitly (security over
temporary inconvenience) over the alternative of leaving the two holes open
longer. **Staged, not committed** per this file's standing rule — user
chose not to auto-deploy this session. **Not fixed, separately tracked
(already pre-existing, not part of this fix's scope):** `student_promotions`/
`transfer_certificates`/`fee_payments` are still open to `anon` (REQ-SEC-002,
much larger, deliberately not touched here); `admin_create_user`
inherits the same pre-existing "account creation isn't fully wired to
Supabase Auth" gap the original direct-insert code already had (confirmed
via live test — not a regression, not fixed here, already tracked in
`documentation/PROJECT_CONTEXT.md`'s roadmap); SEF salary/employee panel
has the identical role-tier pattern, explicitly deferred to its own future
session per user decision. Full detail: `planning/TODO.md` REQ-SEC-005.

**Prior — Session 2026-09-17 (attendance kiosk face recognition
reliability, REQ-BUG-014).** User reported Face Punch sometimes registered
the wrong staff member. Root cause: `match_face_embedding`
(`mobile-app/SUPABASE_FACE_MATCH_RPC.sql`) did nearest-neighbor matching
over every individual stored enrollment shot (~116 vectors across 5+
people) instead of one stable reference per person; the accept threshold
had only ever been tuned against a single enrolled person. **Fix 1:**
rewrote the RPC to compare against a per-person averaged centroid instead —
applied directly to production via Supabase MCP (a deviation from this
project's usual "write the SQL, human runs it" convention; disclosed to
the user in-session, not a standing new precedent — see the session log).
**Fix 2 (regression correction):** the change dropped genuine-match
similarity scores onto a lower scale than the old threshold (0.72) was
tuned for, causing "only recognizes the first/best-scoring person" —
caught by re-validating against all 135 real stored shots (not the
original too-small 3-shot sample), user chose to lower
`kMatchThreshold` to 0.65 favoring recognition over strictness, trusting
the already-confirmed-working "Not Me" confirm step as backstop. **Fix 3:**
pursued further accuracy (with honest ceiling-setting first — this
architecture, a phone camera + small on-device model, cannot reach
commercial/Face-ID-grade zero-error recognition) and found a real,
previously-unknown coordinate bug: ML Kit's face geometry is reported in
un-mirrored space but was being used directly against the mirrored
`decoded` image everywhere (blur check, liveness crop, embedding crop) —
fixed, plus added proper eye-landmark-based face alignment before
embedding (MobileFaceNet expects aligned input; this pipeline never
aligned). **This requires all 6 currently-enrolled staff to re-enroll**
(old embeddings are incompatible with the new crop method) — user said not
to clear the stale data, so it remains until each person redoes
enrollment. **Fix 4 (separate request, same session):** enrollment took
2+ minutes (25/22 near-duplicate shots + padded internal delays) — cut to
8/9 genuinely distinct shots and shortened internal timing constants,
reasoned from the same real-data finding as Fix 1/2 (more near-duplicate
shots didn't help matching, just added noise). All 3 app rebuilds this
session were installed directly via `adb` on a physical OnePlus device
(`AC2001`) connected over USB, not the app's normal S3 update path.
**Explicitly NOT verified:** Fix 3 and Fix 4 have no historical photo data
to check against (this app never stores photos, only embeddings) — unlike
Fix 1/2, which WERE validated against real production data, Fix 3/4 need
an actual person to re-enroll and test a live punch before their
real-world effect is known. Full detail:
`ai-context\SESSION-2026-09-17-1.md`, `work-log\LOG-2026-09-17.md`,
`planning\TODO.md` REQ-BUG-014. Nothing committed.

**Prior — Session 2026-09-16 (governance clarity pass + REQ-HYG-006
diagnostic-logging system, 7 follow-ups).** Reviewed and fixed `AGENTS.md`/
`RULEBOOK.md` governance gaps (rule-ID index, `BOOTSTRAP.md` size
discipline, mandatory-logging rule, MCP-DB-access rule, OPERATE/§J12B
gating clarification, 3-way sync verification, corrected a stale
REQ-SEC-001..004 status block); added §K (engineering execution
standards) and §L (mandatory diagnostic logging) rule sections, mirrored
across all rule-book copies. Then built REQ-HYG-006 (the diagnostic
logging §L itself mandates) end-to-end across 6 same-day follow-ups:
structured loggers + global error capture for both admin-panel and
mobile-app, a centralized `diagnostic_reports` Supabase table (migration
written, **still not run against production**), auto-submission with a
default-OFF `diagnostic_settings` kill switch + cooldown/session caps, and
a `/diagnostics` admin-panel page (view/search/download, senior_admin+).
Separately that day: Teacher app Play Store closed-testing fully
submitted (11/11 checklist items) — see `work-log\LOG-2026-09-16.md`.
**Not verified:** no on-device/in-browser error was ever actually
triggered and watched get captured (§L10 sign-off still pending); the
Supabase migration hasn't been applied yet, so nothing reaches the table
until it is. Full detail: `ai-context\SESSION-2026-09-16-1.md`.

Earlier checkpoints, one line each (full detail in the linked files):
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

0. **REQ-FEAT-001 — Staff App unification (new 2026-09-18, planning only,
   no code yet).** Evolve `mobile-app/` teacher flavor into one role-aware
   Staff App (Teacher + Admin workspaces) per a full discovery spec, now
   archived at `governance\ai-context\STAFF-APP-UNIFICATION-DISCOVERY.md`.
   Working plan: `governance\planning\STAFF-APP-UNIFICATION-PLAN.md`.
   **Blocked on your decision** — `admin_users` and `employees` have no
   reliable link today (checked live: 0/4 match by email, 3/4 coincidental
   name-matches that aren't safe to use for real authorization); see the
   plan file's "Open decisions" for the options. Read the plan file first
   next session before doing anything else on this item.
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
