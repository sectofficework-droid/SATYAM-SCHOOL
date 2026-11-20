# SEF-EXTRACTION-PLAN.md — SATYAM-SCHOOL

> Tracks pulling SEF (the second organization currently living inside this
> repo at `admin-panel/src/app/(dashboard)/sef/*`) out into its own fully
> independent project — separate Git repo, separate Supabase project,
> separate Vercel deployment, separate login. This is a **MAJOR CHANGE**
> under `AGENTS.md` §J12B (architecture, data model, deployment topology,
> and security posture all affected) — it reopens DESIGN FIXED before any
> coding, per `AGENTS.md` §F. This file is the planning record; nothing
> below has been built yet.

## Status

**`sef/*` removed from SATYAM-SCHOOL 2026-11-20**, ahead of the standalone
app being live. User explicitly asked to remove it now ("remove sef out of
satyam school because that is seperate standalone will be created"), and
confirmed via `AskUserQuestion` that this means SEF users have **no working
app at all** until the standalone `SEF-COACHING` project is provisioned and
deployed (it has no real Supabase/S3/GitHub/Vercel infra yet — see below) —
chose "remove now anyway" over waiting. This supersedes the original plan's
sequencing (removal was meant to wait until the new project was verified
working end-to-end); recorded here since it's a live change in plan, not a
correction of a mistake.

**What was removed from this repo (code only, nothing in Supabase/S3
touched):**
- All 11 pages under `admin-panel/src/app/(dashboard)/sef/*` (dashboard,
  student, fees, inventory, employee, notice, report, question-papers,
  tasks, syllabus, super-admin, settings).
- All 10 `sef*Service.js` files in `admin-panel/src/lib/`.
- The 3 now-unused schema files in `admin-panel/database/` (`sef_schema.sql`,
  `sef_settings_schema.sql`, `sef_phase2_schema.sql`) — the standalone
  project has its own `database/schema.sql` already.
- The School/SEF org switcher entirely (`activeOrg`/`setActiveOrg` in
  `store.js`, the switcher UI + SEF page titles in `Header.jsx`, the SEF nav
  items + per-org filtering in `Sidebar.jsx`) — with only one org left,
  the concept had nothing left to switch between.
- `sef-students/`/`sef-employees/` dropped from the allowed S3 key prefixes
  in all 3 `api/s3/*` routes — any previously-uploaded SEF file under those
  prefixes is now unreachable through this app's upload/view routes (the
  S3 objects themselves were not deleted).

**Deliberately NOT touched:** the live `sef_*` Supabase tables (still
have their 2026-11-18 row counts — mostly empty, `sef_profile`/`sef_rules`/
`sef_fee_reminder_template` hold seed rows) and the SEF-prefixed S3
objects — dropping those is a separate, more destructive step with its own
rollback considerations, not implied by "remove it from the code."
Revert path if needed: `git log` on this repo for the commit(s) around
2026-11-20 restores the deleted files; the DB/S3 data was never touched.
`npm run lint` clean; dev server confirmed `/login`, `/dashboard`,
`/settings` still compile and serve 200, `/sef/dashboard` now 404s.

**Prior — scaffold built and verified 2026-11-18**, same day as the request. User
said "make the default calls and proceed" + "make separate possible so
that when we will work on it we have low workload for setup" — read as
approval to build the low-risk, reversible part (a new, separate local
project; nothing in SATYAM-SCHOOL touched) immediately rather than wait on
a formal "approve plan"/"code it", given it carries no production risk and
directly serves the stated goal. The six open questions below were
answered with the stated defaults instead of being asked again.

**What exists now:** `D:\Project\SSIS SCHOOL\SEF-COACHING\` (renamed from
`SEF-SCHOOL` 2026-11-18 — more accurate name, it's a tuition-coaching
business, not a school) — a complete,
independent Next.js project (own git repo, initialized and staged, not
committed), with:
- Every real/working SEF page ported and adapted: Dashboard, Student,
  Fees, Settings (incl. Users & Roles), Super Admin, Reports.
- A clean standalone schema (`database/schema.sql`) — the 8 real `sef_*`
  tables from the live DB, de-prefixed, plus a `std_subjects` table that
  the source app's Settings page needed but never had (fixed here, not
  carried over broken).
- Its own auth (Supabase Auth + a local `admin_users` table + the same
  proven login/reset/idle-timeout flow), fully independent of
  SATYAM-SCHOOL's login as decided below.
- S3 upload/view routes that **require a logged-in session from the
  start** — SATYAM-SCHOOL's equivalent routes have no auth at all
  (`REQ-SEC-013`, still open there) and that gap was deliberately not
  carried forward.
- `npm run build` verified clean (all 9 pages + 4 API routes compile) with
  placeholder env vars — the only remaining failure without them is the
  expected "no real Supabase project yet," not a code defect.
- The six genuinely non-functional SEF modules (Employee, Inventory,
  Notices, Syllabus, Tasks, Question Bank — none of their tables were ever
  created in the source app either) preserved as reference-only code in
  `_unbuilt-reference/`, not wired into the app.
- `SETUP.md` (exact remaining steps), `ADAPTATION-NOTES.md` (what changed
  and why), `README.md`.

**What's left — needs the user, not more code:** creating the actual new
Supabase project, S3 bucket, and GitHub repo/Vercel project (none of which
this session has the credentials or tooling to provision itself — see
"What I can't provision myself" below, unchanged). Once those exist,
`SETUP.md` is the complete remaining checklist.

**Update 2026-11-20:** the old `sef/*` code *has* now been removed from the
SATYAM-SCHOOL repo — see the status note above. The original sequencing
below (wait for the standalone app first) was superseded by an explicit
user decision; kept here as the historical plan, not current status.

## Decisions recorded (2026-11-18)

1. **Separation scope: fully independent.** New Git repo, new Supabase
   project/database, new Vercel deployment — no shared infrastructure with
   SATYAM-SCHOOL once this is done.
2. **Login: fully independent accounts.** SEF gets its own
   `admin_users`-equivalent table and login flow — no shared identity with
   Satyam School staff, even though both currently authenticate against the
   same `admin_users` table today.
3. **Execution order: plan first, build after review.** Nothing in this
   repo or any new infrastructure has been touched. This document is that
   plan.

## What exists today (verified live, 2026-11-18)

**Pages** (`admin-panel/src/app/(dashboard)/sef/`): `student/`,
`employee/`, `super-admin/`, `inventory/`, `report/`.

**Services:** `sefEmployeeService.js`, `sefInventoryService.js` (both call
tables that don't exist — see below), plus SEF-specific logic inlined in
`student/page.js` and `super-admin/page.js` where they branch on org.

**Live Supabase tables (confirmed via direct query, not just the SQL files
— `CLAUDE.md` already flags the SQL files as possibly stale):**

| Table | Row count | Status |
| --- | --- | --- |
| `sef_students` | 0 | empty |
| `sef_fee_payments` | 0 | empty |
| `sef_classes` | 0 | empty |
| `sef_academic_years` | 0 | empty |
| `sef_fee_structure` | 0 | empty |
| `sef_fee_reminder_template` | 1 | default seed row |
| `sef_profile` | 1 | default seed row |
| `sef_rules` | 1 | default seed row |

**No employee or inventory tables exist for SEF at all** — `sef/employee/`
and `sef/inventory/` throw a live "relation does not exist" error the
moment they're opened. This was already known and tracked (not a new
finding from today's extraction request) — see `TODO.md`.

**The practical upshot: there is zero real SEF data to migrate.** Everything
in scope here is a code/infrastructure decision, not a data-migration
project. This makes right now a materially lower-risk time to do this than
it will ever be again once real students/fees exist.

## Proposed target architecture

- **New Git repo** — separate from `SATYAM-SCHOOL`, own history. Scaffolded
  from the current `admin-panel/` Next.js app (same framework, same
  conventions: JS-only per `CLAUDE.md`'s no-TypeScript rule, same component
  patterns) rather than starting from an empty Next.js template — reuses
  working UI code instead of rewriting it.
- **New Supabase project** — a clean schema, not a copy of the `sef_`-
  prefixed tables. The `sef_` prefix only existed to avoid colliding with
  SATYAM-SCHOOL's own `students`/`fee_payments`/etc. in the *shared*
  database; a standalone project has no such collision, so the new schema
  drops the prefix (`students`, `fee_payments`, `classes`, `academic_years`,
  `fee_structure`, `fee_reminder_template`, `profile`, `rules`) and is
  modeled on the main schema's proven shape for each, not reinvented.
- **New Vercel deployment**, own domain/env vars, own `SUPABASE_SERVICE_ROLE_KEY`/
  S3 credentials (own bucket or bucket prefix — needs a decision, see Open
  Questions).
- **New auth**: recommend mirroring the main app's proven pattern — a real
  Supabase Auth user per admin, plus its own role table (this repo's
  `admin_users` equivalent) — rather than inventing a new auth mechanism.
  Same reasoning as the main app's own design: real sessions, not a
  custom password-on-a-table scheme (that pattern is only used for the
  *mobile* apps here, and is flagged as a known weakness in
  `SECURITY-THREAT-MODEL.md`, not something to deliberately repeat).

## What moves vs. what gets rebuilt

- **`student/`, `report/`, and the SEF branches of `super-admin/`** have
  real, working code against real (if currently empty) tables — port and
  adapt these first.
- **`employee/` and `inventory/`** are broken today (no backing tables,
  confirmed above) — recommend **not** porting the broken stub code as-is.
  Treat SEF Employee/Inventory as new feature work to design properly once
  the standalone app is live, rather than carrying over code that has never
  actually worked.
- **The three seed-config rows** (`sef_profile`, `sef_rules`,
  `sef_fee_reminder_template`) are trivial defaults — recreate them fresh
  in the new project rather than exporting/importing, unless you've
  actually customized any of them already (needs confirmation — see Open
  Questions).

## What I can't provision myself

My tools here are scoped to the existing SATYAM-SCHOOL GitHub repo and
Supabase project. I don't have a way to create a brand-new GitHub repo,
Supabase project, or Vercel project from inside this session — those three
need to exist (or you need to hand me access/credentials for them) before
I can start building against them. Everything else — the schema, the
ported pages, the new auth flow, the cleanup of `sef/*` out of this repo
once the new one is verified working — I can do once they're provisioned.

## Open questions — resolved with defaults 2026-11-18

1. **New repo name and host**: `SEF-COACHING`, same GitHub account
   (`sectofficework-droid`) as SATYAM-SCHOOL — git initialized locally,
   staged, not yet pushed (no remote created — needs the user to create
   it, see "What I can't provision myself").
2. **New Supabase project**: separate project, user creates it (can't be
   done from this session) and hands over the URL + anon key +
   service_role key.
3. **New Vercel project**: separate project, same reasoning.
4. **S3**: fresh, separate bucket — deliberately not reusing
   SATYAM-SCHOOL's public-read bucket (`REQ-SEC-013`/F3), so the new
   project doesn't inherit that exposure.
5. **Seed data**: checked live content 2026-11-18 — `sef_profile` had real
   values ("SATYAM EDUCATION FOUNDATION", phone, email), carried over into
   `database/schema.sql`'s seed insert. `sef_rules` and
   `sef_fee_reminder_template` were both still blank, so they seed empty.
6. **Timeline**: none given; proceeded immediately since the scaffold work
   was zero-risk to build ahead of time.

## Mini gate checklist (this initiative only — see `AGENTS.md` §F)

- [x] DISCOVERY — request made 2026-11-18, three scoping decisions
      recorded above.
- [x] CLARIFY — all six open questions resolved 2026-11-18 (defaults, user
      said "make the default calls and proceed").
- [x] PLANNING — this document.
- [x] DESIGN FIXED — schema (`database/schema.sql`), auth flow (Supabase
      Auth + local `admin_users`, same pattern as SATYAM-SCHOOL), S3
      strategy (fresh bucket, auth-required routes) all built and
      verified 2026-11-18. No separate approval round held — treated as
      covered by "make the default calls and proceed" given zero
      production risk (new repo, nothing in SATYAM-SCHOOL touched).
- [x] UI DESIGN CONFIRMED — ported pages reuse SATYAM-SCHOOL's existing,
      already-approved UI patterns verbatim; no new UI designed from
      scratch, so nothing new to confirm here.
- [x] CODING (phase 1 — the part buildable without external accounts) —
      done 2026-11-18. `npm run build` verified clean. Nothing in the
      SATYAM-SCHOOL repo was moved, copied, or deleted.
- [ ] CODING (phase 2 — wiring up real infrastructure) — blocked on the
      user provisioning Supabase/S3/GitHub/Vercel; `SETUP.md` is the
      checklist.
- [ ] TESTING — only structural (build/lint) verification done; no live
      Supabase connection has been exercised (none exists yet). Real
      testing happens once phase 2 is unblocked.
- [ ] RELEASE / OPERATE — not applicable yet.
- [x] **Old `sef/*` removal from SATYAM-SCHOOL** — done 2026-11-20, on
      explicit user go-ahead, ahead of the standalone app being live (see
      status note at top).

**Next step:** user provisions Supabase project + S3 bucket + GitHub repo
(`SETUP.md` has the exact steps) and hands over credentials; this session
picks up from there to wire up and verify against real infrastructure.
