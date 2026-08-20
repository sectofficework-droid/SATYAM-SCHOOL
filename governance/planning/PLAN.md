# PLAN.md — SATYAM-SCHOOL

> Backfilled retroactively for an ALREADY RUNNING project (AI PROJECT PROMPT
> §I). This does not re-derive scope from zero — it maps the existing,
> shipped system. Full field/route/module detail lives in `governance\documentation\PROJECT_CONTEXT.md`
> (repo root); this file states scope, stack, and file map only, and links
> out rather than duplicating.

## Scope
Two-app school ERP for Satyam Stars International School (Surat, GSEB,
English medium, ~1,000+ students, 50+ staff) plus a second tenant, Satyam
Education Foundation (SEF), sharing the same admin panel:
1. `admin-panel/` — Next.js web ERP (students, fees, staff, inventory, GR
   Book, syllabus, exams, question papers, SEF module set).
2. `mobile-app/` — one Flutter codebase, three build flavors: Teacher app,
   Student app, Attendance-kiosk app (face-scan staff punch in/out).

Original product-vision/discovery input: `ai-context\SATYAM SCHOOL PROJECT
UNDERSTANDING PROMPT.txt` (moved here 2026-08-18 during root cleanup; was at
repo root) — treat as historical intent, not a
live spec; see BOOTSTRAP.md "Architecture drift" table for where reality has
since diverged.

## Chosen stack + rationale (as actually built — see BOOTSTRAP.md for real
verified versions)
- **Admin panel:** Next.js 14 App Router, JavaScript (not TypeScript, despite
  the original discovery doc locking TS — this was a real implementation
  decision, not documented anywhere as an approved change; flagged, not
  reversed). Tailwind CSS, Zustand, React Hook Form + Zod, Recharts, XLSX/jsPDF/pdf-lib for export.
- **Mobile:** Flutter + GetX (state/routing/DI), `supabase_flutter` direct
  client access (no backend-for-frontend layer for mobile).
- **Backend:** Supabase (Postgres + Auth for admin panel; custom SECURITY
  DEFINER RPC auth for mobile — not Supabase Auth sessions on mobile).
- **File storage:** AWS S3 — presigned URLs for admin panel, public-read
  bucket for mobile (see drift table in BOOTSTRAP.md).
- **Hosting:** Vercel (admin panel, Production environment confirmed live).
  Mobile apps distributed as APKs via the same public S3 bucket, not yet on
  Play Store.

## Modules / features
Full module-by-module status (what's live, in progress, or pending) is
already maintained in `governance\documentation\PROJECT_CONTEXT.md` §"Module Status — Admin Panel"
and the mobile-app module lists — do not duplicate here; that file is the
living source and gets refreshed by whoever does the work, same as this
scaffold's own session logs.

## Workflow
Feature work has historically proceeded directly to code per session
(commit-by-commit, see `git log`), without passing through this prompt's
formal DISCOVERY → PLANNING → DESIGN FIXED gates. Going forward under this
AGENTS.md: continue that low-ceremony flow for changes that classify as
PATCH under §J12B (no behavior/design/security/cost impact) — don't force
new gate ceremony on those. Anything that classifies as MINOR or MAJOR
under §J12B (including anything touching auth, payments, security posture,
or the drift items in BOOTSTRAP.md) requires a written plan first, per
§A.1/§A.4, regardless of how small it looks. Confirmed with the user
2026-08-18 (see `GOVERNANCE-AUDIT.md`) that this is the intended default,
not just an unreviewed carry-over.

## File map
Verified against the real tree 2026-08-19 (post `governance\` reorganization):
```
SATYAM-SCHOOL/
├── AGENTS.md                  ← rule book (ROOT — AI-tooling auto-discovery)
├── .gitignore                 ← single /Scratch/ rule covers everything local-only
├── README.md                   ← corrupted/empty, see TODO REQ-HYG-005
├── schema_dump.json             ← leftover debug artifact, see TODO REQ-HYG-003
├── admin-panel/                ← Next.js app (production)
│   ├── src/app/                ← routes (see governance/documentation/PROJECT_CONTEXT.md route map)
│   ├── src/lib/*Service.js     ← service layer, one file per module
│   └── database/*.sql          ← core schema + SEF schema
├── mobile-app/                 ← Flutter app (production, 3 flavors)
│   ├── lib/app_bootstrap.dart  ← shared entrypoint, Supabase client
│   ├── lib/app/modules/        ← per-role feature modules
│   └── SUPABASE_*.sql (45 files) ← incremental schema/RPC migrations
├── governance/                  ← tracked in git, NOT inside Scratch/
│   ├── RULEBOOK.md              ← master compliance rule book (verbatim
│   │                                merge of both reusable prompts + an
│   │                                enforcement/activation layer)
│   ├── BOOTSTRAP.md             ← current-state snapshot, read every session
│   ├── ai-context/               ← SESSION-*.md, archive/, + the original
│   │                                discovery .txt
│   ├── work-log/LOG-*.md
│   ├── planning/                 ← this file + DB-DESIGN/IMPL-SPEC/UI-SPEC/
│   │                                TODO/SECURITY-THREAT-MODEL/RELEASE-PLAN/
│   │                                GOVERNANCE-AUDIT
│   └── documentation/           ← SETUP-GUIDE.md +
│                                    PROJECT_CONTEXT.md (living technical-state
│                                    doc, pre-existing, moved here 2026-08-19)
└── Scratch/                     ← git-ignored, entirely local-only
    ├── AI PROJECT PROMPT PRODUCTION GRADE.md      ← reusable prompt
    ├── GOVERNANCE SECURITY-PROMPT PRODUCTION GRADE.md ← reusable prompt
    ├── refdocs/                  ← dashboard screenshots, source images,
    │                                Annual Planning PDF (moved in 2026-08-19)
    └── SATYAM-SCHOOL/            ← this project's disposable prep workspace
        ├── coding/assets/, debugging/, suggestions/  ← empty stubs
        └── SSIS-AIO.bat, start-*.bat (4 files)  ← local dev launchers
                                                      (paths NOT verified
                                                      by running them)
```

## Progress rules
Same as §A/§J in AGENTS.md — no silent refactors, no scope expansion without
a bundled approval ask, evidence before "done".

## Sample outputs
N/A — live production system; see the deployed app / `Scratch/refdocs/vercel
production.png` for the real deployment list rather than a hypothetical
sample.
