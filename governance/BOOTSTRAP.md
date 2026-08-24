# BOOTSTRAP — SATYAM-SCHOOL

> Authoritative "current state" snapshot. Read this every session (§C.2 of
> `AGENTS.md`, which links back here — see `AGENTS.md`'s "Continuity files"
> note). Refreshed every session — never left stale. Full technical detail
> lives in `documentation\PROJECT_CONTEXT.md` (sibling folder — moved here
> 2026-08-19, was at repo ROOT) — this file summarizes
> phase/approvals/environment and points there for detail, per §B ("map
> existing docs instead of duplicating").
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
you tell me otherwise.

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
| RLS mandatory | RLS **disabled** on every new mobile-app table (`student_attendance`, `homework`, `exams`, `exam_marks`, etc.) — and, **live-confirmed 2026-08-21**, `students`/`employees`/`admin_users` are ALSO fully readable by a completely unauthenticated client (public anon key, no session) despite `SUPABASE_SETUP.sql`'s narrower `auth.uid()`-based policies existing on paper | `mobile-app/SUPABASE_APP_AUTH.sql`; live test detail in `planning\SECURITY-THREAT-MODEL.md` F2 |
| "DO NOT... use public S3 buckets" | Mobile app's photo bucket is public-read, plain `Image.network`, no presigning | `mobile-app/lib/common/widgets/s3_image.dart`, `documentation\PROJECT_CONTEXT.md:67` |
| `users` table with `password_hash` | `app_password` stored as **plaintext TEXT**, same hardcoded default value for every account (redacted from every doc, tracked or not — the exact value only exists in `mobile-app/SUPABASE_APP_AUTH.sql` itself, which is production code, already in git history independent of this doc set), compared with `=` | `mobile-app/SUPABASE_APP_AUTH.sql` |
| Firebase Cloud Messaging | Not implemented — in-app notifications only | `documentation\PROJECT_CONTEXT.md:69` |

This is recorded as fact, not fixed. Full detail + risk in
`planning\SECURITY-THREAT-MODEL.md`.

## Environment (REAL, verified 2026-08-18)
| Tool | Version |
|---|---|
| Node | v24.18.0 |
| npm | 11.16.0 |
| git | 2.55.0.windows.3 |
| Flutter | 3.47.0 (stable) |
| Dart | 3.13.0 |
| Next.js | 14.2.35 (from `admin-panel/package.json`) |
| React | ^18 |
| Supabase project | `hxkowdaugkkumvzyfsai.supabase.co` |
| Git remote | `https://github.com/sectofficework-droid/SATYAM-SCHOOL.git`, branch `debiprasad` tracking `origin/debiprasad` |
| Hosting | Vercel (admin-panel, confirmed Production deployments in `Scratch/refdocs/vercel production.png`) |
| Android SDK | **New 2026-08-21** — was entirely absent before this session (`flutter doctor` showed no SDK at all). Installed via `winget install Google.AndroidCLI` (Google's official lightweight CLI, not full Android Studio) at `C:\Users\bkdeb\AppData\Local\Android\Sdk`; `android sdk install` used to pull `platform-tools`, `platforms/android-35`+`36`, `build-tools/35.0.0`+`36.1.0`, `cmdline-tools/latest`, and `ndk/28.2.13676358` (the exact version this project's Gradle build requested). `flutter doctor`'s Android toolchain check still shows `[!]`/license-status-unknown even though the license file's hash matches the correct standard value and a real debug APK build succeeds — cosmetic doctor-check gap with this newer tool, not an actual blocker (see SESSION-2026-08-21-3.md if this resurfaces). |

Do not re-verify these next session unless the task depends on them or the
environment may have changed (§C.2).

## Code status
**Updated 2026-08-24 — see `ai-context\SESSION-2026-08-24-1.md` for full
detail. Flagged gap: `debiprasad` has since been merged to `main` (commit
`2fc2570`) and the repo now works directly on `main` — but four feature
commits between 2026-08-21 and 2026-08-24 (`886c6a3`, `f87a2ce`, `7c96bad`,
`c0e11c1`, `d2f409c`) shipped with no governance log entry at all. Not
backfilled this session (out of scope for what was asked) — the "three
shipped changes" section immediately below is the last state this file
actually attests to; treat everything after it as real but undocumented
until a future session reconstructs it from `git log`.**

**2026-08-24 addition — bulk student import (commit `7bd8cef`, on `main`,
pushed):** new Student-module "Import Basic Details" tool (insert-only, 8
fields, auto enrollment no) and new Super Admin "Replace Full Details" tool
(matches by enrollment no, overwrites via `updateStudent()`). New
`students.data_status` column ('Complete'/'Incomplete') drives a filter
chip + badge on the student list. **Migration
`mobile-app/SUPABASE_STUDENT_BASIC_IMPORT.sql` has NOT been run against
production yet** — feature is shipped in code but non-functional until the
user runs it. Verified: dev server compiled `/student` and `/super-admin`
clean, no errors. Not verified: an actual import run, or mobile login for a
basic-imported student (both need the migration first, then a manual
pass — see SESSION-2026-08-24-1.md's Next steps).

**Updated 2026-08-21 (last fully-attested state before the gap above):
three shipped changes, `debiprasad` only — not yet merged to `main` (now
merged, see gap note above).**
1. **Add Student form extraction** — the ~1,400-line Add Student form moved
   out of `student/add/page.js` into a shared `components/AddStudentForm.js`
   (`variant="page"` | `"modal"`). Student list now opens Add Student as a
   modal in-place; `/student/add` still works standalone. Verified live for
   both entry points via `claude-in-chrome`.
2. **Permanent student delete (new feature)** — `studentService.js`'s
   `deleteStudentPermanently()` + a "Permanently Delete" button/confirm-modal
   in Super Admin → Update Student, gated to `senior_admin`/`management`
   (`normal_admin` already can't reach `/super-admin`). Requires typing the
   exact enrollment number to confirm. Clears `student_promotions`,
   `transfer_certificates`, `fee_payments` first (their FKs to
   `students(id)` don't cascade), then deletes `students` (cascades the
   rest). Verified live — deleted two test students created during (1)'s
   verification, confirmed count back to the real 48-student baseline.

3. **REQ-SEC-001 fixed and shipped** — `students`/`employees.app_password`
   hashed with bcrypt (`mobile-app/SUPABASE_HASH_APP_PASSWORD.sql`,
   **applied directly to production** via the Supabase SQL Editor this
   session, not just written). Verified after: 75/75 rows backed up +
   re-hashed, all 4 RPCs confirmed present. Admin panel's password
   view/copy replaced with a Reset Password action for both students and
   employees, hashed server-side via two new admin-only RPCs. Bundled: a
   new per-student in-app notice mechanism (`student_alerts`, mirrors the
   pre-existing `teacher_alerts`) so a password reset produces a
   "Password Reset" popup in the mobile app — teacher side needed no
   rebuild (already polled `teacher_alerts`); student side needed a Dart
   change + rebuild, done — a debug APK was built successfully this
   session and handed to the user for device install, **not yet installed
   or visually confirmed** as of this snapshot. Along the way, the Android
   SDK toolchain was installed on this machine (previously entirely
   absent) — see Environment table below.

Also this session: a "Vercel seems stale" report turned out to be the user
checking the wrong URL (no actual issue — resolved: user confirmed they use
`debiprasad`'s Preview deployment day-to-day, merge-to-`main` only on
explicit ask, not needed every session); a read-only repo-wide secrets scan
found nothing leaked in tracked files (one hardcoded Supabase key in
`mobile-app/lib/app_bootstrap.dart` confirmed to be the intentionally-public
anon key, not a real secret) — but a separate, live (not file-based) RLS
check requested right after that found `students`/`employees`/`admin_users`
were all fully readable with zero authentication (item 3 above fixes the
`app_password` exposure specifically; the broader RLS/anon-grant picture,
REQ-SEC-002, is still open).

Full detail: `ai-context\SESSION-2026-08-21-1.md`,
`ai-context\SESSION-2026-08-21-2.md` (RLS finding),
`ai-context\SESSION-2026-08-21-3.md` (REQ-SEC-001 fix).

Git state: `cd5d755`/`10c3395` (items 1-2) and `bc74ac0` (item 3, this
delta) are all on `debiprasad`. **`bc74ac0` is committed but not yet
pushed** — push after this BOOTSTRAP/log update, same as the pattern for
every commit this session. `main` is untouched this session — `origin/main`
still at `9a2cfb3` (2026-08-20's merge). Currently checked out: `debiprasad`,
clean except the recurring, pre-existing, uncommitted local change to
`.claude/settings.local.json`.

REQ-SEC-001 is now fixed (see item 3). REQ-SEC-002/003/004 (below) are
unaffected — still exactly as they were.

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

<details><summary>2026-08-18 note (partially superseded — kept for history)</summary>

Root now holds only: `AGENTS.md`, `.gitignore`, `PROJECT_CONTEXT.md`,
`README.md`, `admin-panel\`, `mobile-app\`, `schema_dump.json` (pending
removal OK, see TODO REQ-HYG-003), `refdocs\` (git-ignored, per the user,
same as `Scratch\`), `Scratch\`. **No more `.bat` files at root** — moved
into `Scratch\SATYAM-SCHOOL\` per the user (Part 9); their internal
`admin-panel`/`mobile-app` paths were updated for the new depth
(`%~dp0..\..\` prefix), NOT verified by actually running them. The 8
reference images/PDF that were tracked in git history and are now inside
`refdocs\` will drop out of git tracking on the next commit (expected,
correct effect of gitignoring the folder — not data loss, just no longer
tracked going forward). The two governance prompt `.md` files now live in
`Scratch\`; the original discovery `.txt` now lives in
`Scratch\SATYAM-SCHOOL\ai-context\`; loose reference images/PDF now live in
`refdocs\`.

</details>

If a link in an older note still says "(root)" for any of these, it's
stale — `git status`/`find` are the source of truth, not memory of where
things used to be.

## Last checkpoint
Session `governance\ai-context\SESSION-2026-08-24-1.md` — shipped the bulk
student import feature (Basic Details import + Replace Full Details
import + Complete/Incomplete tracking), committed `7bd8cef`, pushed to
`origin\main`. Flagged (not fixed) a 3-day governance gap — see "Code
status" above. Migration not yet run against production; functional
verification still pending the user.

Prior checkpoint: `governance\ai-context\SESSION-2026-08-21-3.md` — fixed and shipped
REQ-SEC-001 (plaintext `app_password`): wrote a real plan this time
(superseding the 2026-08-18 reverted attempt), got explicit "code" approval,
implemented, and **ran the migration directly against production** via the
Supabase SQL Editor (user's own logged-in browser session) — verified after,
not just assumed. Also installed the Android SDK toolchain on this machine
(previously entirely absent) to build and hand off a real debug APK for the
paired student-side in-app notification feature. Committed (`bc74ac0`) —
not yet pushed as of this checkpoint (push happens right after this log
update, same pattern as every commit this session).

Prior checkpoint: `governance\ai-context\SESSION-2026-08-21-2.md` — user
asked to "check RLS on students and employees tables." Live-confirmed
`students`/`employees`/`admin_users` all fully readable by a completely
anonymous client. Read-only finding, recorded per §J14 — nothing fixed at
the time (fixed in the very next checkpoint, above).

Prior checkpoint: `governance\ai-context\SESSION-2026-08-21-1.md` — finished
+ verified live an in-progress refactor (Add Student form extracted into a
shared `AddStudentForm.js`); built, shipped, and live-verified a new
permanent-delete feature for students. Committed as two commits (`cd5d755`,
`10c3395`), pushed to `origin/debiprasad` — not merged into `main`
(confirmed not needed most sessions — see prior Next-step history).

Prior checkpoints (archived, retention cap — §D):
`ai-context\archive\SESSION-2026-08-20-1.md` (found, root-caused, fixed, and
shipped a real authentication bypass — sidebar Logout never actually signed
out — merged to `main` at `9a2cfb3`) and
`ai-context\archive\SESSION-2026-08-19-2.md` (read-only secrets-hygiene
check).

## Next step
**2026-08-24, current:**
0. **Run `mobile-app/SUPABASE_STUDENT_BASIC_IMPORT.sql` against production
   Supabase** — the new bulk-import feature is non-functional without it.
0a. Manually verify the import flow end-to-end (both tools, badge/filter,
    bogus-enrollment-no error path, mobile login) — see
    `SESSION-2026-08-24-1.md`.
0b. Decide whether/when to backfill the governance gap flagged above
    (four undocumented feature commits, 2026-08-21 → 2026-08-24).

**Carried over from 2026-08-21 (unchanged, not re-verified this session):**
1. `bc74ac0` — since pushed and `debiprasad` merged to `main` per the gap
   note above; no longer an open action.
2. **Install the handed-off debug APK on an actual device and verify the
   password-reset popup live** — reset a test student's password from the
   admin panel, open the app, confirm the "Password Reset" notice appears
   via the existing on-open popup system. Not yet done as of this
   checkpoint — the APK was built and verified to compile/run (web-target
   smoke test), but the actual popup UX has not been visually confirmed on
   a real device/emulator.
3. Once confirmed, `DROP TABLE _app_password_backup_20260821;` in Supabase
   (holds the pre-migration plaintext values — cleanup step noted in the
   migration file itself, not yet run since verification isn't complete).
4. REQ-SEC-002 (broader anon/RLS over-exposure — `students`/`employees`/
   `admin_users` plus the ~25 mobile-app tables) is still open — this
   session only fixed the `app_password` piece of it (REQ-SEC-001). Needs
   its own plan/decision same as before.
5. REQ-SEC-003/004 unchanged — still each needs its own decision from the
   user before any work starts on them.
6. User needs to prioritize REQ-BUG-001..009 — none fixed yet, all just
   recorded.
7. The 2026-08-20 logout fix still hasn't been independently re-checked
   against the live Vercel Production URL (carried over, still open, low
   priority).
