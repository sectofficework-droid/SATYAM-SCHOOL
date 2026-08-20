# SETUP-GUIDE.md — SATYAM-SCHOOL

> Backfilled from the actual local-dev tooling already in the repo (root
> `.bat` launchers), not invented. `README.md` at repo root is currently
> corrupted/empty — this file is the real install/run guide until that's
> fixed.

## Install
- **Node.js** v24.18.0, npm 11.16.0 (verified this session — see
  `governance\BOOTSTRAP.md`). `cd admin-panel && npm install`.
- **Flutter** 3.47.0 / Dart 3.13.0 (verified this session), expected at
  `C:\flutter\bin\flutter.bat` per `start-attendance-app.bat`. See
  `mobile-app\FLUTTER_SETUP_GUIDE.md` (pre-existing in-repo doc) if not
  installed at that path.
- **git** 2.55.0.windows.3 (verified this session).
- Environment secrets: `admin-panel/.env.local` (real values, git-ignored —
  do not request or paste its contents into AI sessions per §J6). No
  `.env.example` template was found in the repo — a gap; the required keys
  are visible as **names only** in `Scratch/refdocs/env.png`:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
  `AWS_S3_BUCKET_NAME`.

## Run (local dev)
Launcher menu (moved out of repo root 2026-08-18, now at
`Scratch\SATYAM-SCHOOL\SSIS-AIO.bat`): interactive menu for all four
surfaces. Each script's `admin-panel`/`mobile-app` path was updated to
`%~dp0..\..\admin-panel` / `%~dp0..\..\mobile-app` to account for the new
location two folders deeper than root — NOT VERIFIED by actually running
them (interactive/long-running dev servers, out of scope for this session
to launch); reviewed statically only. If a launcher fails to find
`admin-panel`/`mobile-app`, check that path first.
| # | Surface | Command (if run standalone) | Port |
|---|---|---|---|
| 1 | Admin panel (Next.js) | `cd admin-panel && npm run dev` (custom `scripts/dev-start.js`; no `.bat` launcher — removed from ROOT 2026-08-19) | localhost:3000 |
| 2 | Student app (Flutter web) | `start-student-app.bat` | localhost:5000 |
| 3 | Teacher app (Flutter web) | `start-teacher-app.bat` | localhost:5001 |
| 4 | Attendance kiosk (Flutter web) | `start-attendance-app.bat` | localhost:5002 — needs a camera; face-scan works best on a real device, not a browser |

Each Flutter launcher auto-runs `flutter pub get` on first run, creates a
missing `web/` platform folder if absent, and frees its target port before
starting (`taskkill` on the PID bound to it).

## Configure
Supabase project: `hxkowdaugkkumvzyfsai.supabase.co` (same project for admin
panel + all three mobile flavors). Schema applied via manual SQL Editor runs
of `admin-panel/database/*.sql` and 45+ `mobile-app/SUPABASE_*.sql` files —
no migration tool orders these; see `planning\RELEASE-PLAN.md` "Migrations"
for the gap this creates. AWS S3 bucket:
`satyam-stars-international-school` (`ap-south-1`), presigned for admin
panel, public-read for mobile (see `planning\SECURITY-THREAT-MODEL.md` F3).

## Test
**No automated test suite exists** for `admin-panel/` (no `test` script, no
test files). `mobile-app/test/widget_test.dart` is Flutter's unmodified
default counter-app test — does not exercise this app. Manual verification
today = run the relevant `start-*.bat` and exercise the feature in-browser/
in-app. Tracked as a gap in `planning\TODO.md` (REQ-HYG-001).

## Harden
See `planning\SECURITY-THREAT-MODEL.md` for the full picture. Summary of
what a hardening pass would need to address, in priority order:
1. Stop storing/displaying plaintext `app_password` (REQ-SEC-001).
2. Re-enable RLS + rate-limit the login RPCs (REQ-SEC-002).
3. Move mobile photo/APK storage off the public S3 bucket, or formally
   accept the risk (REQ-SEC-003).
4. Add a root `.env.example` template so new setups don't have to guess
   required keys from a dashboard screenshot.
5. Add automated tests + a CI pipeline before further feature work compounds
   the untested surface area.
