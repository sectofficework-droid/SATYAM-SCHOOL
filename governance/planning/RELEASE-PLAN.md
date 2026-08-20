# RELEASE-PLAN.md — SATYAM-SCHOOL

> Required per AGENTS.md §E.8. Backfilled **retroactively** — the system is
> already live. This documents actual release practice today and the real
> gaps against the checklist, rather than inventing a release process that
> was never followed. Use it going forward for the NEXT release, and to
> honestly show what's missing for the current one.

## Environments
- **Production:** Vercel, `admin-panel/`, confirmed live via
  `Scratch/refdocs/vercel production.png` (multiple "Ready" Production deployments on
  `main`). Supabase project `hxkowdaugkkumvzyfsai.supabase.co` — appears to
  be a single environment (no separate staging Supabase project found in the
  repo/config).
- **Local dev:** `.bat` launchers (`SSIS-AIO.bat`, `start-*.bat`, moved to
  `Scratch\SATYAM-SCHOOL\` 2026-08-18, was at repo root) start the admin
  panel dev server and mobile-app flavors locally.
- **Mobile distribution:** APKs hosted on the same public S3 bucket used for
  photos (see `SECURITY-THREAT-MODEL.md` F3) — not Play Store. In-app update
  checker (`app_update.dart`) polls a Supabase `app_versions` table.
- **No separate staging environment identified** — admin panel appears to
  deploy straight to Production from `main` via Vercel's git integration.

## Build
Next.js: `next build` (from `package.json` scripts). No documented build
verification step (typecheck N/A — no TS; `next lint` exists but no evidence
it's run in a required gate). Flutter: standard `flutter build apk
--flavor {teacher|student|attendance}` implied by the 3-flavor Gradle setup;
no build script documented in the repo beyond the `.bat` dev launchers.

## Migrations
No migration tool/ordering system found — schema changes ship as standalone
`.sql` files (`admin-panel/database/*.sql`, 45+ `mobile-app/SUPABASE_*.sql`
files) applied manually via the Supabase SQL Editor, per file comments (e.g.
"Run this in Supabase Dashboard → SQL Editor"). No rollback script exists
for any of them. This is a real gap: migrations are unordered and
unversioned relative to app deploys.

## Secrets/config
Admin panel: AWS + Supabase keys via Vercel environment variables
(confirmed present in `Scratch/refdocs/env.png` — names only, `Sensitive`-flagged,
values masked). Mobile: Supabase URL + anon key hardcoded in source (see
threat model F2) rather than injected via `--dart-define` — cannot be
rotated without a full app rebuild + redistribution.

## Backup/recovery
**Not verified.** Supabase's own backup tier/frequency for this project was
not checked this session (would require Supabase dashboard access, out of
scope for a read-only repo audit). No documented restore drill anywhere in
the repo. Flag: a backup that has never been restore-tested is not verified
recovery capability (§J0Q).

## Monitoring/alerts
None found in the codebase (no Sentry/error-tracking SDK, no uptime/alerting
config). Vercel's own dashboard provides deploy status only.

## Rollback procedure
Implicit only: Vercel keeps prior deployments and supports promoting an
older one (standard Vercel capability), but no documented/rehearsed rollback
runbook exists for this project specifically. DB migrations have no rollback
script (see above) — a rollback of app code without a matching DB rollback
could break compatibility if a migration changed a column/table shape.

## Deployment steps
**Admin panel:** push/merge to `main` → Vercel's git integration auto-builds
(`next build`) and auto-promotes to Production — no manual deploy step, no
staging gate, no approval click confirmed in the repo/config. This means
every merge to `main` is effectively an immediate production release.
**Mobile app:** `flutter build apk --flavor {teacher|student|attendance}`
(implied by the Gradle flavor setup, not scripted) → upload the APK to the
public S3 bucket → update the `app_versions` table (checked by
`app_update.dart`'s in-app update prompt) so installed apps see the new
version. No documented step-by-step for this in the repo — reconstructed
from the code paths that consume each artifact.

## Smoke tests
None automated. No documented manual smoke-test checklist for critical
journeys (login, mark attendance, record a fee payment, generate a question
paper) post-deploy.

## Release criteria — gap summary
| Checklist item (AGENTS.md §J16) | Status |
|---|---|
| Required tests/security checks passed | **Not verified** — no automated tests exist |
| Production config/secrets present, not exposed | Present (Vercel env vars); mobile secret is hardcoded, not rotatable — partial |
| DB migrations reviewed/ordered | **No** — unordered, manual, unversioned |
| Backup/recovery path known, restore tested | **Not verified** |
| Monitoring/alerts active | **No** |
| Rollback procedure executable | Partial — Vercel deploy rollback only, no DB rollback |
| Critical user journeys have smoke tests | **No** |
| Release/version identifiable | Partial — git commit SHA per Vercel deployment; no app-level version tagging beyond `package_info_plus` on mobile |
| Privacy/retention/third-party config approved | **Not defined** (see threat model "Data handling / retention") |

This is not a blocker retroactively — the system is already live and this
audit is not proposing a rollback. It's the honest baseline for the NEXT
release: which of these gaps get closed before the next production push is
your call, tracked in `planning\TODO.md`.
