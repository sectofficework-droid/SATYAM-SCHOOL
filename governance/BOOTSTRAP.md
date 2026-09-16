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
Current, verified via `git log`/`git status` 2026-09-16: `main` at `b997c2f`
("Log Teacher app Play Store closed-testing session..."), in sync with
`origin/main`, working tree otherwise clean (routine untracked local-only
items: `.claude/settings.local.json`, `.vercel/`, screenshot working files —
none of these are code). Production (Vercel) tracks `main`.

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
**Current — Session 2026-09-16 (governance clarity pass).** Reviewed
`AGENTS.md` against `RULEBOOK.md`/the master template and applied fixes:
(1) added a rule-ID quick index to all three files (theme-grouped, since
~60 rule IDs were hard to navigate); (2) added a §D rule capping
`BOOTSTRAP.md`'s size (this file was 723 lines, well past "curated
snapshot" — trimmed to this, per that new rule); (3) added a §D rule
requiring at least a one-line checkpoint update even for changes too small
for a full SESSION file (logging had been silently skipped at least twice
per the "known governance gaps" note above); (4) added a §J5 rule that
tool-mediated DB access (e.g. an MCP database server — this repo's
`.mcp.json` connects one directly to the production Supabase project) is
held to the same approval bar as a manual query; (5) added a §F rule
clarifying that OPERATE-mode projects are gated by §J12B's PATCH/MINOR/
MAJOR classification, not a full DISCOVERY→RELEASE re-run per change; (6)
added a sync-verification note (dated, in all three files) since none
existed before to catch the three-way copy drifting; (7) found and fixed a
real accuracy bug while doing this: `AGENTS.md`'s project section still
listed all of REQ-SEC-001..004 as open, but `TODO.md` shows only
REQ-SEC-002 is — REQ-SEC-001/004 are fixed, REQ-SEC-003 was a deliberate
accepted-risk decision. Corrected. All edits verified word-for-word
identical across `AGENTS.md` §A/§D/§F/§H/§J, `governance\RULEBOOK.md` PART
I, and `Scratch\AI PROJECT PROMPT PRODUCTION GRADE.md`. Nothing in
`admin-panel\`/`mobile-app\` touched. Full detail:
`ai-context\SESSION-2026-09-16-1.md`. Earlier the same day (separate,
unrelated piece of work): Teacher app Play Store closed-testing submission
completed, 11/11 checklist items — see `work-log\LOG-2026-09-16.md`
(first entry).

**Same-day follow-up:** two more rule-book sections were added — **§K
(ENGINEERING EXECUTION STANDARDS)** and **§L (MANDATORY DEBUGGING &
DIAGNOSTIC LOGGING)** — merged in from two separate prompts the user
supplied, then mirrored/aligned across all four governance-rule copies now
in play: the standalone universal `RULEBOOK.md` at
`D:\Project\SSIS SCHOOL\RULEBOOK.md` (outside this repo, not a git repo
itself), plus this repo's own `AGENTS.md`, `governance\RULEBOOK.md`, and
`Scratch\AI PROJECT PROMPT PRODUCTION GRADE.md` — all four now verified
byte-identical for §D/§F/§H/J5/§K/§L via `md5sum`. §K/§L are now part of
the "copied verbatim into `AGENTS.md`" set (was §A/§D/§F/§H/§J, now
+§K/§L) — every cross-reference to that set across all four files was
updated to match. **New gap found while merging §L:** neither
`admin-panel\` nor `mobile-app\` has the centralized/structured/
correlation-ID'd diagnostic logging §L now mandates — tracked as
**REQ-HYG-006** in `planning\TODO.md`, not fixed, not scoped yet at that
point. `CLAUDE.md` was also updated to surface this gap up front (so a
future Claude Code session doesn't assume log evidence exists that isn't
there — that note should now be revisited given the same-day Phase 1 work
below).

**Same-day, third follow-up — REQ-HYG-006 Phase 1 implemented.** User
confirmed the plan (bundled with a clarifying question on which task
"code it" meant, since none was pending), then "code it" a second time on
the plan itself. Shipped: admin-panel structured logger + global
error/API capture + error boundaries (`src/lib/logger.js`,
`src/lib/apiDiagnostics.js` wired into all 6 API routes,
`src/components/DiagnosticsInit.jsx`, `src/app/error.js`/`global-error.js`);
mobile-app structured logger + `runZonedGuarded`/`FlutterError.onError`/
`PlatformDispatcher.onError` wired once in `app_bootstrap.dart` (covers
all 3 flavors). Zero new dependencies either side. Verified: `npm run
lint` clean, `flutter analyze` clean, a debug Teacher-flavor APK builds
end-to-end.

**Same-day, fourth follow-up — REQ-HYG-006 Phase 1.5, centralized
retrieval.** User redirected the retrieval model: mobile testers *report*
a problem (they don't read/view a log), and both the admin panel and an
AI agent retrieve it centrally — asked for a plan, user confirmed with
"code it". Shipped: new Supabase table `diagnostic_reports`
(`mobile-app/SUPABASE_DIAGNOSTIC_REPORTS.sql`, **not yet run against
production**) with RLS enabled (reuses `public.is_admin_user()`, a
deliberate deviation from this project's usual "disable RLS" convention
since that convention is exactly REQ-SEC-002). Mobile apps' local
"Diagnostic Log" viewer replaced with `report_problem_dialog.dart`
("Report a Problem", same 3 entry points). Admin panel's logger now
auto-submits every captured error to the same table (no manual step);
the now-redundant floating download button was removed in favor of a new
`/diagnostics` admin-panel page. `AGENTS.md`/`CLAUDE.md` both updated
telling a future session to query `diagnostic_reports` via this project's
Supabase MCP connection *before* asking for repro steps. Verified:
`npm run lint` clean, `flutter analyze` clean (2 real bugs caught and
fixed in the mobile-app changes before they shipped — see session log).
**Same-day, fifth follow-up — REQ-HYG-006 Phase 1.6, corrected on user
feedback.** User: "whatever log is it should be auto submitted to master
admin; include log report download in master or above admin ... is it
alligned" — no, it wasn't yet, so fixed both gaps directly (small enough
not to need a fresh plan round): mobile apps' `error()`/`fatal()` now
auto-submit to `diagnostic_reports` themselves (mirrors the admin panel;
"Report a Problem" stays as a secondary, description-adding channel, not
the only path in); admin panel's `/diagnostics` page got a "Download"
button (exports the current filtered list as JSON), gated
`role !== "normal_admin"` — interpreted "master or above admin" as this
project's existing senior_admin/management gate, flagged to the user in
case "master" meant `management` specifically. Verified: `npm run lint`
clean, `flutter analyze` clean, a debug Teacher-flavor APK builds
end-to-end again after the change.

**Same-day, sixth follow-up — REQ-HYG-006 Phase 1.7, cost/privacy safety
rails.** User asked whether many users' logs could blow past Supabase's
free-tier limits. Checked the real database via Supabase MCP instead of
guessing: 19 MB total, `diagnostic_reports` not yet created, ~200
bytes/row on the biggest existing table — storage was never the actual
risk. The real gap: no throttling, so a looping bug could auto-submit
unboundedly. Fixed with a 5-min-per-message cooldown + 20/session cap in
both loggers. Separately, user clarified the deeper intent: "logging is
specifically kept for development purpose not to collect what users do"
— added a `diagnostic_settings` single-row switch (default OFF, RLS
gated the same way as `diagnostic_reports`) that both loggers check
before auto-submitting; a toggle + status banner added to `/diagnostics`.
Manual "Report a Problem" deliberately stays ungated (explicit consent,
not passive collection). Retention: lazy cleanup (delete >90 days) on
`/diagnostics` page load instead of a 3rd Vercel Cron, since the project's
2 existing crons are likely already at the Hobby-tier cap. Verified:
`npm run lint` clean, `flutter analyze` clean, a debug Teacher-flavor APK
builds end-to-end.

**NOT verified, all four follow-ups:** an actual on-device/in-browser
error trigger (no device/emulator or running dev server this session —
full §L10 sign-off still pending), and the migration itself hasn't been
run against production yet, so no report can actually reach the table
until that happens. Full detail: `ai-context\SESSION-2026-09-16-1.md`.
Everything in this file is staged, not committed.

**Prior — Session 2026-09-13 (6 sessions) — kiosk face-scan freeze fixed
and verified on-device.** Root cause was redundant JPEG decoding (5x per
attempt) plus `takePicture()`'s inherent multi-second latency; fixed by
decoding once per attempt and switching to a live preview-stream capture
(`startImageStream`) instead of `takePicture()`. Verified over a
13-minute, 178-tick live run: idle poll cycle time 4,500-7,400ms →
22-400ms (~100-300x faster), zero skips, zero camera reinitializations,
rotation/mirror correctness confirmed via face-box geometry and two
near-threshold live match scores. **Recommended, not blocking:** a sanity
check on the real physical kiosk tablet — every measurement was taken on
the BlueStacks emulator, whose `sensorOrientation=0` is atypical for real
hardware. New, separate, not-yet-discussed finding:
`fetchAllFaceEmbeddings()` takes ~5.8-6.2s over the network (masked
previously by `takePicture()`'s similar delay) — only affects the
post-detection "Verifying..." window, needs its own go-ahead if pursued.
Full detail: `ai-context\SESSION-2026-09-13-4.md`/`-5.md`/`-6.md` (+
`archive\-1.md`/`-2.md`/`-3.md` for the diagnosis/instrumentation/first
on-device pass), `work-log\LOG-2026-09-13.md`. Still staged, not
committed.

Earlier checkpoints, one line each (full detail in the linked files):
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
