# IMPL-SPEC.md — SATYAM-SCHOOL

> Backfilled conventions doc, extracted from the actual codebase as it
> stands — not a spec to build fresh from. Use this to keep NEW code
> consistent with what's already there; do not use it to justify rewriting
> existing code (§J1/§J9).

## Admin panel (`admin-panel/`)
- **Service layer:** one file per module under `src/lib/*Service.js` (e.g.
  `employeeService.js`). New modules should follow the same pattern — a
  service file wrapping Supabase calls, consumed by page components.
- **Language:** JavaScript only, no TypeScript, despite the original
  discovery doc locking TS (see BOOTSTRAP.md drift table) — do not
  introduce `.ts`/`.tsx` files into this codebase without an explicit
  approved decision to migrate; that would be a MAJOR change (§J12B), not a
  drive-by file-by-file switch.
- **Forms/validation:** React Hook Form + Zod — follow existing pattern for
  new forms.
- **Auth:** Supabase Auth (`signInWithPassword`), `admin_users` role table,
  PKCE flow, gated by `AuthGuard.jsx`, roles `management` / `senior_admin` /
  `normal_admin`. `src/lib/supabase.js` is a singleton browser client — no
  server-side/service-role client exists anywhere; if a future feature needs
  one (e.g. an admin action that must bypass RLS), that is a security-relevant
  architecture decision requiring the DESIGN FIXED gate, not an inline
  addition.
- **File uploads:** presigned PUT/GET URLs via Next.js API routes
  (`src/app/api/s3/*`), server-side S3 client in `src/lib/s3.js` — browser
  never touches AWS credentials. New upload features must follow this
  pattern, not the mobile app's public-bucket pattern.
- **Exports:** XLSX (Excel), jsPDF + jspdf-autotable, and pdf-lib (reports
  rewritten onto pdf-lib for exact-fit tables) — reuse existing export
  helpers rather than adding a fourth PDF library.

## Mobile app (`mobile-app/`)
- **Shared entrypoint:** `lib/app_bootstrap.dart::runSatyamApp(role, pages)`,
  called by each flavor's `main_*.dart`. New shared behavior belongs there,
  not duplicated per flavor.
- **State/routing/DI:** GetX (`get` package). Follow existing module
  structure: `lib/app/modules/{student,teacher,attendance_kiosk,auth,splash}/`,
  `lib/app/routes/app_pages_{student,teacher,attendance}.dart`.
- **Backend access:** direct `supabase_flutter` calls, not through the
  Next.js API. Auth is custom (`teacher_login`/`student_login` RPCs), not
  Supabase Auth sessions — session state kept via `flutter_secure_storage` +
  `shared_preferences`.
- **Images:** `lib/common/widgets/s3_image.dart` builds a public bucket URL
  and renders with `Image.network` — this is a known-divergent pattern (see
  threat model); do not copy it into the admin panel.
- **In-app update:** `lib/core/utils/app_update.dart::checkForAppUpdate()` —
  new app-version-gating logic should extend this, not create a parallel
  mechanism.

## Cross-cutting conventions not yet formalized (gaps, not invented rules)
- No shared error-handling convention is documented; behavior currently
  varies by file. Not fixing this retroactively — noting it as a gap for
  `planning\TODO.md`.
- No standard API response envelope for the few Next.js API routes
  (`/api/s3/upload-url`, `/api/s3/view-url`) — each returns its own shape.
- No automated test convention exists (see `planning\TODO.md`).

## Acceptance tests
None automated today. Manual acceptance has historically been "does it work
in the browser/app" per commit. See `planning\TODO.md` for the testing gap
and `documentation\SETUP-GUIDE.md` for how to run the apps locally to verify
manually.
