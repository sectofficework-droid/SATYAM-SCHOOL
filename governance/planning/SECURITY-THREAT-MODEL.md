# SECURITY-THREAT-MODEL.md — SATYAM-SCHOOL

> Required per AGENTS.md §E.7 — this system handles accounts, private
> student/staff data (Aadhaar, DOB, addresses, photos), and fee/payment
> records. Backfilled retroactively for an already-live system; formalizes
> findings from a read-only governance audit performed earlier this session.
> Nothing described here has been fixed — this is documentation of the
> current state for a human decision, per §J0H/§J14.

## Assets
- Student PII: name, DOB, Aadhaar, address, parent contact, photos,
  academic records, fee/payment history.
- Staff PII: employee records, Aadhaar, PAN, salary-adjacent data, login
  credentials.
- Institutional data: attendance, exam marks, question banks (pre-exam,
  confidentiality-sensitive), notices, GR Book (statutory register).
- Credentials: Supabase Auth (admin panel), custom `app_password`
  (mobile), AWS credentials (S3), Razorpay keys (installed, not yet wired).

## Trust boundaries
1. Browser (admin panel) ↔ Next.js server ↔ Supabase (admin panel talks to
   Supabase via a browser-side singleton client using the anon key + real
   Supabase Auth session + RLS on `admin_users`-gated tables).
2. Flutter app (any installed device, any user) ↔ Supabase directly, using
   a **hardcoded anon key** — this boundary has no server in between at all.
3. Browser (admin panel) ↔ Next.js API routes (`/api/s3/*`) ↔ AWS S3 — the
   only boundary where a server-side secret (AWS creds) is actually kept off
   the client.

## CRITICAL findings (evidence-based, from this session's audit)

### F1 — Plaintext password storage, comparison, and display
- **Evidence:** `mobile-app/SUPABASE_APP_AUTH.sql` — `app_password TEXT
  DEFAULT '<redacted — see the SQL file itself for the live value>'` on
  `employees` and `students`; `teacher_login`/`student_login` RPCs compare
  with plain `WHERE ... AND app_password = p_password`.
  `admin-panel/src/lib/employeeService.js:23` maps
  `row.app_password` straight into the frontend object; commit `1167210`
  ("Show teacher app login password in Employee detail view") confirms it
  is rendered in the admin UI.
- **Threat:** any DB read (backup leak, insider, future SQL-editor access
  grant, or the RLS gap in F2) exposes real login credentials directly, not
  hashes. A shared default password across ~1,000+ students / 50+ staff
  means a single leaked value likely still works for many unchanged
  accounts.
- **Contradicts:** the original discovery doc (`SATYAM SCHOOL PROJECT
  UNDERSTANDING PROMPT.txt`) explicitly modeled a `password_hash` field —
  hashing was the original intent, not an oversight of an unconsidered
  requirement.
- **Mitigation options (not yet chosen):** hash with bcrypt/argon2 server-side
  (requires an Edge Function or server-side RPC change, since comparison
  currently happens in plain SQL); force a password-reset flow on rollout;
  stop displaying the value in the admin UI regardless of storage format.
- **STATUS 2026-08-18 — attempted, then REVERTED at user's request; back to
  PLANNING.** A same-day attempt (remove the plaintext display, hash
  `app_password`, add an admin Reset-Password flow) was implemented, then
  explicitly reverted ("we will plan first then execute") because it skipped
  straight from finding to code without a written plan. `git restore` on
  `employeeService.js`/`employee/page.js`; the draft SQL migration was
  deleted (never applied to the DB, nothing to undo there). **The
  vulnerability itself is unchanged — still fully present, still live.** The
  reset-not-view approach and the "no mobile rebuild needed" finding remain
  valid and should carry into whatever plan gets written next; see
  `planning\TODO.md` REQ-SEC-001 for the full note.

### F2 — `anon`-role over-exposure (RLS disabled + broad grants + no rate limit)
- **CORRECTED SCOPE (2026-08-18, follow-up pass):** the original evidence
  below undercounted this. `client.from(...)` calls in
  `mobile-app/lib/core/services/supabase_service.dart` hit **~30 tables
  directly**, with no RPC wrapper — meaning the app only works at all
  because every one of them is opened to `anon`. Full grep of every
  `mobile-app/SUPABASE_*.sql` file for `DISABLE ROW LEVEL SECURITY` and
  `GRANT ... TO anon` gives the real list:
  - **RLS explicitly disabled:** `app_versions`, `attendance_edit_requests`,
    `employee_attendance`, `gr_book_imports`, `official_exam_subject_config`,
    `queries_suggestions`, `question_bank`, `question_paper_items`,
    `question_papers`, `school_calendar_events`, `school_rules`,
    `student_attendance`, `syllabus`, `syllabus_edit_requests`,
    `task_assignees`, `tasks`, `timetables`.
  - **Full `SELECT, INSERT, UPDATE, DELETE` granted to `anon`:**
    `app_versions`, `attendance_edit_requests`, `daily_task_completions`,
    `daily_task_targets`, `daily_tasks`, `employee_attendance`,
    `gr_book_imports`, `leave_requests`, `official_exam_marks`,
    `official_exam_subject_config`, `official_exams`, `queries_suggestions`,
    `question_bank`, `question_paper_items`, `question_papers`,
    `school_calendar_events`, `school_rules`, `syllabus`,
    `syllabus_edit_requests`, `syllabus_subtopics`, `teacher_alerts`,
    `timetables`. This includes **DELETE** on pre-exam `question_bank`/
    `question_papers` and on `official_exam_marks`.
  - **Partial grants:** `exams` (SELECT+INSERT), `notices`/`class_subjects`/
    `school_profile`/`tasks` (SELECT only), `student_attendance`/
    `exam_marks` (SELECT+INSERT+UPDATE), `task_assignees` (SELECT+UPDATE).
  - **RPCs granted to `anon`** beyond the two login functions:
    `get_class_students`, `get_class_students_by_name`,
    `get_class_students_details`, `get_student_fees`,
    `get_student_helpdesk_contacts`, `get_all_birthdays`,
    `get_todays_birthdays`, `teacher_change_password`,
    `teacher_update_profile`, `teacher_verify_password` — several of these
    (password change/verify, profile update) are exactly the kind of
    function that most needs an identity check and is exactly the kind that
    was granted to the fully-anonymous role.
  - Net effect: there is effectively **no database-layer authorization** for
    the mobile surface — the Flutter UI's own filters (`.eq('class', ...)`,
    `.eq('created_by', ...)`) are a convenience, not a security boundary;
    nothing stops a direct API call from omitting them.
- **Original evidence (still valid, now a subset):** `SUPABASE_APP_AUTH.sql`
  — `ALTER TABLE student_attendance / homework / exams / exam_marks DISABLE
  ROW LEVEL SECURITY;` plus grants on those tables and `notices`; `GRANT
  EXECUTE ON FUNCTION teacher_login/student_login ... TO anon`.
  `governance\documentation\PROJECT_CONTEXT.md:107,109` — the project's own
  `SUPABASE_SECURITY_AUDIT.sql` exists specifically because "the current RLS
  picture is not fully trusted" (their words, already on record before this
  audit). Anon key hardcoded client-side (`app_bootstrap.dart:10-11`),
  extractable from any installed APK. `mobile-app/lib/core/services/
  auth_service.dart:34-39` — `teacher_login`/`student_login` `RETURN
  row_to_json(v_row)` on the **whole** `employees`/`students` row, which
  still includes the plaintext `app_password` column (F1) — the password is
  shipped back to the client and cached locally on every login, not just
  stored server-side. Grep for `rate.?limit|throttle`
  across the whole repo: zero matches in application code.
- **Threat:** anyone who extracts the public anon key (trivial — it's in
  every install) can call `teacher_login`/`student_login` directly against
  Supabase's REST API with no rate limiting, brute-forcing `employee_id` /
  `enrollment_no` + password combinations entirely outside the app. That
  same key gives direct, unauthenticated `SELECT`/`INSERT`/`UPDATE`/`DELETE`
  on ~25 tables spanning attendance, exam marks, official exam marks,
  question bank/papers (pre-exam content), leave requests, syllabus, staff
  attendance, and daily tasks — no ownership/tenant/role check at the
  database layer at all (IDOR/BOLA-class gap, no object-level authorization
  per §J0M). The app's own client-side filters/role checks are not a
  security boundary once RLS is off — they only shape what the *app's UI*
  shows, not what the API will accept.
- **Contradicts:** the original discovery doc: "RLS mandatory."
- **Mitigation options (not yet chosen):** re-enable RLS with real
  per-student/per-class/per-teacher policies keyed off the custom auth
  identity (harder here than with real Supabase Auth, since sessions aren't
  JWT-based on mobile — may require moving mobile auth onto real Supabase
  Auth, which is a bigger architecture change); add attempt-rate limiting
  (Supabase Auth hooks / Edge Function wrapper) on the login RPCs regardless
  of the RLS decision.

### F2b — `teacher_update_profile` has no identity check at all
- **Evidence:** `mobile-app/SUPABASE_TEACHER_SETTINGS.sql:7-22` —
  `teacher_update_profile(p_employee_id, p_name, p_phone, p_email)` runs
  `UPDATE employees ... WHERE id = p_employee_id::UUID` with **no password
  or session check whatsoever**, unlike its sibling
  `teacher_change_password` (which does verify `app_password` first). Any
  caller holding the anon key and any employee UUID can overwrite that
  teacher's name/phone/email. Employee UUIDs are plausibly discoverable
  via the ~25 anon-readable tables in F2 that likely carry `created_by`/
  `teacher_id` columns (e.g. `syllabus`, `homework`, `daily_tasks`) — not
  independently confirmed column-by-column this pass, but consistent with
  the F2 exposure and worth checking before dismissing as low-risk.
- **Threat:** unauthenticated profile tampering for any teacher whose UUID
  leaks through another already-open table.
- **Mitigation:** add the same `app_password` check `teacher_change_password`
  already does, at minimum, regardless of the broader F2 decision.
- **STATUS 2026-08-18 — checked, deferred, not fixed.** Confirmed
  (`supabase_service.dart:744-748`) the installed app calls this RPC with no
  password available at that call site. A required-password fix would break
  every already-installed app's profile-edit screen; an optional/unenforced
  one would be a fake fix. Needs a Settings-screen UI change (prompt for
  current password) + app rebuild — bundled into Stage 2/3, not this
  no-rebuild pass. See `planning\TODO.md` REQ-SEC-004.

### F3 — Public S3 bucket for mobile photos (contradicts locked "no public
buckets" rule)
- **Evidence:** `mobile-app/lib/common/widgets/s3_image.dart` builds
  `https://satyam-stars-international-school.s3.ap-south-1.amazonaws.com/{key}`
  and loads with plain `Image.network` — no presigning, no auth check on
  read. `governance\documentation\PROJECT_CONTEXT.md:67` confirms this was a deliberate end-state
  after a chain of CORS/photo-loading fixes, not an accident.
  APK download links for app updates are also hosted on this same public
  bucket (`lib/core/utils/app_update.dart`).
- **Threat:** any student/staff photo (and the distributed APK itself) is
  readable by anyone who can guess or enumerate an S3 key — no
  authentication or authorization at all on read.
- **Mitigation options (not yet chosen):** switch mobile reads to presigned
  GET URLs (admin panel already has this pattern in `src/lib/s3.js`/`/api/
  s3/view-url` — reusable); or, if performance/simplicity is the deliberate
  tradeoff, formally record it as an accepted risk exception (§J0E) with an
  owner and review date instead of leaving it undocumented.

## Abuse cases considered
- Credential stuffing against `teacher_login`/`student_login` — currently
  unmitigated (F1 + F2 combined).
- Direct PostgREST access to `anon`-granted tables bypassing the app UI
  entirely — currently unmitigated (F2).
- Photo/APK enumeration via public S3 bucket — currently unmitigated (F3).
- Admin panel session hijack — out of scope for this pass; admin panel uses
  real Supabase Auth + PKCE, not audited in depth this session.

## Secrets handling (verified this session)
- `admin-panel/.env.local` exists locally and **is** correctly git-ignored
  (`admin-panel/.gitignore:.env*`, verified via `git check-ignore -v`).
- No hardcoded AWS or Razorpay secrets found in application code (both read
  from `process.env.*`, verified by grep).
- The Supabase **anon** key in `mobile-app/lib/app_bootstrap.dart` is not a
  "leak" in the traditional sense — Supabase's anon key is designed to be
  public/client-side — but its safety depends entirely on RLS being correct
  (F2), which it currently is not for several tables.

## Data handling / retention
Not formally defined anywhere in the repo (no data retention/deletion
policy found). Flagged as a gap for `planning\TODO.md` rather than invented
here — legal/compliance interpretation is out of scope for an AI agent
(§J0U) and needs your review if the school has regulatory obligations around
minors' data (likely, given Aadhaar/DOB fields on students).

## Verification note
All findings above are evidence-based (file:line or grep result), not
inferred. Nothing in this document has been fixed; see `planning\TODO.md`
for the tracked decision items (REQ-SEC-001/002/003).
