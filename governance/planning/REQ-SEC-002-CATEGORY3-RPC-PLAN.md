# REQ-SEC-002-CATEGORY3-RPC-PLAN.md — SATYAM-SCHOOL

> Planning-only document. No migration, GRANT/REVOKE, CREATE POLICY, CREATE FUNCTION, or Dart/JS
> code change has been made while writing this file. Every finding below comes from a full read of
> `mobile-app/lib/core/services/supabase_service.dart` (1108 lines, read in full), `auth_service.dart`,
> and the relevant tracked `mobile-app/SUPABASE_*.sql` files. Nothing here is authorized to be coded
> until you say "code it" per `AGENTS.md` §F — and this is a MAJOR change (§J12B, reopens DESIGN
> FIXED), so treat it as needing sign-off on the open questions below before implementation starts,
> not just a blanket "code it" on the whole file.

## Recap: why this plan exists

`governance/planning/REQ-SEC-002-MOBILE-TABLES-PLAN.md` split the 33 remaining RLS-disabled tables
into 3 categories; Categories 1–2 (16 tables) are done. Category 3 — 17 tables where mobile writes
data or reads other people's rows with **no server-side proof of caller identity** — is what this
file plans. You chose fix path **(B): move each risky write behind a `SECURITY DEFINER` RPC that
re-verifies identity per call**, not real Supabase Auth for mobile (rejected — conflicts with
REQ-SEC-010's "no new auth system" stance) and not deferral.

## Identity mechanism — DECIDED: (a) server-issued session token, minted at login

**User's explicit choice**: a server-issued opaque session token, minted at login — not a re-sent
password, not a stateless signed token. Rationale (matches what this plan already found before the
decision came in): this is the only option that supports real revocation, and it fits the existing
architecture with the least new surface.

Checked what's already cached after login (`auth_service.dart`, `_saveSession`): the app already
uses `flutter_secure_storage` (existing dependency, no new package needed) and caches `user_role` +
the full login-RPC response JSON — but explicitly **not** the password (`teacher_login`/
`student_login` strip `app_password` from the returned row before sending it: `row_to_json(v_row)
- 'app_password'`, confirmed in `SUPABASE_HASH_APP_PASSWORD.sql`). Adding a token field to that same
cached JSON blob is a small, natural extension of `_saveSession` — no new client-side storage
mechanism needed.

**Design, as decided:**
- New table `mobile_sessions`: `token_hash` (the token itself is never stored server-side, only its
  hash — same principle as `app_password`, so a DB read/leak doesn't hand out usable tokens),
  `subject_type` (`'teacher'` | `'student'`), `subject_id`, `issued_at`, `expires_at`.
- `teacher_login`/`student_login` mint a token and return it alongside the existing profile JSON.
- Every new Category 3 RPC takes `p_session_token` (not a password), hashes it, looks up the row,
  checks `expires_at > now()`, resolves `subject_id` — same `SECURITY DEFINER` +
  `RAISE EXCEPTION 'Not authorized'` pattern as every other RPC in this codebase.
- Revocation: delete the row on logout (add to `signOut()`), on password change
  (`teacher_change_password`/`student_change_password` should invalidate existing sessions for that
  subject), and this gives a real path to an admin-forced remote logout later if ever needed
  (delete-by-subject-id), which password re-sending never could.

**Still open, small — not silently picked**: exact **expiry/refresh policy**. This codebase has no
existing precedent for a session lifetime to anchor on (no prior session concept at all — logins are
just a cached profile blob with no expiry today, and the user stays "logged in" until they explicitly
sign out or clear the app). Two sub-questions worth your explicit answer before Step 1 below is
coded:
1. **How long-lived should a token be?** A school day (re-login each morning) vs. a week vs. until
   explicit logout (matching today's de-facto behavior, just now with a revocable artifact instead
   of nothing) are all defensible; longer is more convenient, shorter limits a stolen-device window.
2. **What happens on expiry?** A silent re-login (re-run `teacher_login`/`student_login` using
   still-cached credentials) is not possible today since the password isn't cached (by design, see
   above) — so expiry would need to surface as a forced re-login screen, unless the token itself is
   refreshed on every successful call (sliding expiry) rather than fixed at login. Recommend a
   sliding expiry (extend `expires_at` on each successful RPC call) so an actively-used app never
   hits a forced re-login mid-session, only after real inactivity — but this is a real design choice,
   flagging it rather than assuming it.

## 🔴 Face-embedding exposure — FAST-TRACKED AND FIXED 2026-09-19, separately from the rest of this plan

Separate from the routine own-record problem above. Two `employees`-table findings:

1. **`fetchAllFaceEmbeddings()` and `fetchStaffForEnrollment()` broadly read every enrolled staff
   member's raw face-embedding vectors** (`supabase_service.dart:237-270`) — biometric data, to any
   caller with the public anon key, no auth of any kind. This is a materially more sensitive
   exposure than anything else in Category 3 (marks/attendance/HR data vs. biometric templates) and
   arguably deserves fixing on its own timeline, not bundled at the same priority as "a teacher can
   mark someone else's task done."
2. **`saveFaceEmbedding()`/`deleteFaceEmbedding()` (lines 190-205) have a different identity shape
   than everything else in this file**: they're not "is the caller really employee X" (an employee
   doesn't enroll their own face from their own phone) — they're kiosk-admin-initiated actions,
   gated today only by `verifyKioskAdminPin()` returning a bare `bool` to the client. **That PIN
   check produces no server-side artifact** — nothing about a subsequent `saveFaceEmbedding` call
   proves the PIN was ever actually verified for that request; the kiosk app is just trusted to have
   gated its own UI. The now-decided session-token mechanism above extends cleanly here too: mint a
   short-lived kiosk-admin token on successful `verify_kiosk_admin_pin`, store it in the same
   `mobile_sessions` shape (`subject_type = 'kiosk_admin'`), require it on the enrollment RPCs —
   same table, same verification helper, just a third `subject_type`. Small addition, not a new
   mechanism, but still its own implementation slice since it's a different trigger (PIN, not
   login) — sequence it after the teacher/student token plumbing is proven working.

**User chose to fast-track this (2026-09-19), separate from the general per-table rollout below.**
Fixed the same day: `employees.face_embedding` is no longer anon-readable/writable at all, directly
or via any table-level grant — a new short-lived (20 min, fixed expiry — NOT the sliding
teacher/student mechanism decided elsewhere in this plan; a one-off admin errand doesn't need that)
kiosk-admin token, minted by `verify_kiosk_admin_pin` on a correct PIN, gates 4 new RPCs
(`kiosk_get_face_embeddings`, `kiosk_get_staff_for_enrollment`, `kiosk_save_face_embedding`,
`kiosk_delete_face_embedding`) that replace every direct table read/write. Migration:
`mobile-app/SUPABASE_FIX_FACE_EMBEDDING_EXPOSURE.sql`.

**A real bug was caught and fixed during verification, not before shipping**: the first attempt
used a column-level `REVOKE SELECT (face_embedding) ... FROM anon`, which had **no effect** —
confirmed live, `anon` could still read the raw column directly afterward. Root cause: Postgres
column-level REVOKE does nothing when the role already holds the *table-level* grant for that
privilege (the column is already covered). Fixed properly: revoked `anon`'s table-level `SELECT`
on `employees` entirely and re-granted an explicit column list (every column except
`face_embedding`) — the only way Postgres actually supports single-column restriction here.
`UPDATE` was revoked outright (no column list needed — a full grep confirmed zero remaining direct
anon `UPDATE` call sites on `employees` once the two write functions moved to RPCs). Re-verified
live afterward: direct column read/write both correctly `permission denied`; other legitimate anon
reads (`fetchOtherTeachers`/`fetchPrincipalContact`'s `name`/`phone`/`type` columns) still work
unchanged; the RPC chain works end-to-end (tested with a simulated token in a rolled-back
transaction, since the real kiosk PIN isn't available in this session).

**Dart changes** (`supabase_service.dart`, `kiosk_pin_service.dart`, `admin_pin_dialog.dart`,
`kiosk_home_page.dart`, `staff_enroll_list_page.dart`, `face_enroll_capture_page.dart`): the token
is threaded from the PIN dialog through GetX route arguments to every face-embedding call site.
`flutter analyze`: clean. Attendance-flavor debug APK builds successfully
(`app-attendance-debug.apk`). **Not yet verified**: installed/tested on the physical kiosk device
with the real PIN — needs the user to install the new APK and confirm the enrollment flow
(PIN → staff list → capture → save, and the "Registered" tab's delete) still works end-to-end.

**Still deliberately not addressed by this fast-track** (in scope for `employees`' eventual
Category 3 phase, not here): every other `employees` column is still fully anon-readable (though no
longer anon-*writable* at all, an incidental tightening from the `UPDATE` revoke above) — `name`,
`phone`, `app_password` (bcrypt-hashed, not plaintext, but still not a real per-user auth boundary),
etc. The broader `employees_own_profile` dead-policy problem and the rest of Category 3's
mobile_sessions design are entirely separate, still-not-started work.

## Per-table findings

Legend: **own** = write/read keyed to a single param already at the call site (needs "is the caller
really that person" verification only). **class** = legitimately broader than one person's rows —
needs a "is this teacher actually assigned to this class/section" check, not an ownership check.
**dual** = the same table needs different scope depending on caller role.

### Group A — own-record only, no class-assignment logic needed (9 tables)

| Table | Call sites (file:line) | Params already available | Shape |
|---|---|---|---|
| `leave_requests` | `submitLeaveRequest` (:119), `fetchMyLeaveRequests` (:133) | `employeeId` | own |
| `queries_suggestions` | `submitQuery` (:871), `fetchMyQueries` (:884) | `userId` | own |
| `student_alerts` | `fetchStudentAlerts` (:54) — read-only, writes are server-side (`admin_reset_student_password`) | `studentId` | own |
| `teacher_alerts` | `fetchTeacherAlerts` (:40) — read-only, same as above | `teacherId` | own |
| `task_assignees` | `fetchTeacherTasks` (:915), `updateTaskAssigneeStatus` (:923) | `employeeId`, composite key `(task_id, employee_id)` | own |
| `daily_task_completions` | read bundled into `fetchDailyTasksForEmployee` (:944), `markDailyTaskDone`/`unmarkDailyTaskDone` (:972/981) | `employeeId` | own |
| `attendance_edit_requests` | `fetchMyEditRequests` (:64), `submitAttendanceEditRequest` (:86) | `teacherId` | own |
| `syllabus_edit_requests` | `submitSyllabusEditRequest` (:724), `fetchMySyllabusEditRequests` (:740), `closeSyllabusEditWindow` (:752 — **id-only today, no owner check in the call at all**) | `teacherId` (missing on close) | own |
| `teacher_documents` | `fetchTeacherDocuments` (:1081), `createTeacherDocument` (:1091), `deleteTeacherDocument` (:1095 — **id-only, no owner check**) | `teacherId` (missing on delete) | own |

**Proposed RPC shape** (one pair per table is enough; read + write don't need to be separate RPCs
where a single one can branch, but keeping them separate matches this project's existing style —
see `admin_get_diagnostic_reports` vs `admin_issue_tc` as two distinct RPCs rather than one
do-everything function):

```sql
CREATE OR REPLACE FUNCTION public.teacher_submit_leave_request(
  p_employee_id uuid, p_session_token text,
  p_from_date date, p_to_date date, p_reason text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_mobile_session('teacher', p_employee_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO leave_requests (employee_id, from_date, to_date, reason)
  VALUES (p_employee_id, p_from_date, p_to_date, p_reason)
  RETURNING row_to_json(leave_requests.*) INTO STRICT result; -- shape illustrative
END;
$$;
REVOKE ALL ON FUNCTION public.teacher_submit_leave_request(uuid, text, date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_submit_leave_request(uuid, text, date, date, text) TO anon;
```

`verify_mobile_session(subject_type, subject_id, p_session_token)` is proposed as **one shared
helper** (mirrors `is_admin_user()`'s role in the admin-side RPCs): hashes `p_session_token`, looks
it up in `mobile_sessions`, checks `subject_type`/`subject_id` match and `expires_at > now()`, and
(per the sliding-expiry recommendation above) extends `expires_at` on a successful check. Every new
RPC in Groups A/B/C calls this one function — it's the only place the session-token logic lives.

**`closeSyllabusEditWindow`/`deleteTeacherDocument` need their call sites changed too**, not just
the RPC — today the Dart functions don't even pass a teacher/employee id, so the new RPC signature
must add that parameter and the call site must start supplying it (already noted as a gap in the
parent plan's "secondary gap" section).

**Effort estimate**: ~9-11 RPCs, 9 tables, all single-identity-param — the most mechanical group.
Roughly comparable in size to Category 2's 12-table migration, plus the new shared helper function.

### Group B — class/section-scoped, needs "is this teacher assigned here" (6 tables)

This project already has the data to answer that question — confirmed via
`SUPABASE_SUPPORTING_TEACHERS.sql`: `employees.class_teacher_of_section_id` (homeroom) plus
`section_supporting_teachers` (extra assigned teachers, same access as the class teacher) cover
**class-teacher** access. For a **subject teacher** with no homeroom class, the only existing signal
is `timetables.teacher` matched against `employees.name` (free text, not an FK — already flagged
elsewhere in this codebase as fragile, e.g. a teacher rename would silently break it; worth noting
as a real limitation of building this check today, not inventing a new problem).

| Table | Call sites | Current scoping | Class-check needed |
|---|---|---|---|
| `exams` | `fetchExams` (:482), `createExam` (:503) | class name / createdBy | is teacher class-teacher, supporting teacher, or timetabled for this class |
| `exam_marks` | `fetchExamMarks`/`fetchExamIdsWithMarks` (:517-529), `saveMarksBatch` (:537) | exam_id | same, resolved via the exam's class |
| `homework` | `fetchHomework` (:449), `createHomework` (:470) | class name / createdBy | same |
| `syllabus` | `fetchSyllabus`/`createSyllabusChapters`/`updateSyllabusStatus`/`deleteSyllabusChapter`/`updateSyllabusChapterName`/`deleteSyllabusForSubject`/`lockSyllabus` (:628-722) | class+subject / teacher_id | same |
| `syllabus_subtopics` | `fetchSubtopics`/`createSubtopics`/`updateSubtopicStatus`/`deleteSubtopic` (:688-708) | chapter_id (needs a join back to `syllabus.teacher_id`/`class` to resolve) | same, one join deeper |
| `student_attendance` (teacher side) | `saveAttendanceBatch` (:22), `fetchAttendanceForClassDate` (:33) | class name + date | same |

**Proposed helper**: `is_teacher_of_class(p_employee_id uuid, p_class_name text) RETURNS boolean` —
checks class-teacher-of-section, supporting-teacher, and timetable-name-match in one place, called
by every Group B RPC's identity check (in addition to `verify_mobile_session` for "is this really
that employee, with a live session" first). Two-layer check per RPC: *who are you* (`verify_mobile_
session`) then *are you allowed to touch this class* (this new helper).

**Effort estimate**: ~10-13 RPCs (some tables share one RPC across their few call sites, e.g.
syllabus's 7 call sites likely collapse to 4-5 RPCs: create/update-status/rename/delete/lock). The
new `is_teacher_of_class` helper is the one piece of genuinely new logic, not just a copy of an
existing pattern — budget extra review time here versus Group A.

### Group C — dual-shape by caller role (2 tables, trickiest)

**`official_exam_marks`**: `fetchOfficialExamMarks`/`fetchOfficialExamMarksForClass` (:598-616) are
called by **both** the teacher app (needs the whole class's marks — legitimate breadth, Group-B
shaped) **and**, per the comment at :608 ("Class-teacher read-only 'all subjects for my class'
view"), presumably also surfaced to students for their own results — if a student-facing call site
exists elsewhere (not in this file — check `mobile-app/lib/app/modules/student/` before designing,
this file only has the shared service layer) it must be scoped to **that student's own row only**,
not the whole class, or every student could read every classmate's marks for an exam. This needs
tracing student-side call sites (outside `supabase_service.dart`) before the RPC can be finalized —
flagged as a research gap in this plan, not resolved here.

**`student_attendance`**: `fetchStudentAttendance(studentId)` (:105) is single-student, full-year —
needs to allow either "this is my own studentId" (student app) or "I'm a teacher of this student's
class" (teacher app, if this function is shared — check call sites) — same dual-shape problem as
above.

**Effort estimate**: small in table count (2) but requires tracing call sites in the actual page
files (`teacher_marks_page.dart`, `student_*` pages), not just the shared service layer this plan
was scoped to read — likely the single riskiest group to get wrong, recommend doing it last, after
the helper functions from Groups A/B are already proven working.

## `employees` (face embeddings) — its own phase, see Open Question #2

`saveFaceEmbedding`/`deleteFaceEmbedding` need a kiosk-admin-token check (new, no existing pattern
to reuse directly); `fetchAllFaceEmbeddings`/`fetchStaffForEnrollment` need the same broad-read-of-
biometric-data question resolved (can the raw embeddings ever be anon-readable, or must this move
behind a kiosk-admin-gated RPC too — recommend the latter given the sensitivity, but not decided
here); `fetchOtherTeachers`/`fetchPrincipalContact` are low-sensitivity (name/phone only) and could
become a simple narrow RPC or even move to Category 2's shape (anon SELECT restricted to just those
columns via a view) independent of the biometric question.

## Suggested order

1. ~~Build `mobile_sessions` ... nothing else can start before this exists.~~ **DONE 2026-09-19.**
   Token lifetime decided: 7-day sliding expiry. `mobile_sessions` table,
   `mint_mobile_session`/`verify_mobile_session`/`revoke_mobile_session` built; wired into
   `teacher_login`, `student_login`, and (found necessary during implementation, not originally
   scoped this precisely) the two impersonation-JSON helpers and `get_sibling_profile`, since all
   of those also flow through `AuthService._saveSession` and would otherwise leave
   impersonated/switched sessions with no token at all. **Deliberately NOT wired into
   password-change** this pass — flagged, not dropped. Migration:
   `mobile-app/SUPABASE_CAT3_FOUNDATION_MOBILE_SESSIONS.sql`. A real bug (wrong `GET DIAGNOSTICS`
   target type) was caught on the first live test and fixed before proceeding.
2. ~~**Group A** (9 tables, ~9-11 RPCs)~~ **DONE 2026-09-19.** All 9 tables (`leave_requests`,
   `queries_suggestions`, `student_alerts`, `teacher_alerts`, `task_assignees`,
   `daily_task_completions`, `attendance_edit_requests`, `syllabus_edit_requests`,
   `teacher_documents`) moved to session-token-gated RPCs; direct `anon` table access revoked,
   admin-panel access preserved via the usual `authenticated` + `is_admin_user()` policy. Also
   closed the two "secondary gap" call sites this plan flagged
   (`closeSyllabusEditWindow`/`deleteTeacherDocument` previously took no owner id at all — both
   now require and verify the real owner). Migration: `mobile-app/SUPABASE_CAT3_GROUP_A_RPCS.sql`.
   Verified live: full insert→read chain works, wrong-token calls rejected, direct table access
   blocked, `rls_disabled` count dropped 17→8 (exactly Group B + Group C + `employees`' remaining
   scope, no surprises). Dart side: all 18 affected `supabase_service.dart` methods plus 10
   call-site files across teacher/student modules updated to thread the session token through;
   `flutter analyze` clean; both teacher- and student-flavor debug APKs build successfully. **Not
   yet tested on a real device with a real login** — needs the user to verify end-to-end before
   this is fully closed.
3. **Group B** (6 tables, ~10-13 RPCs + new `is_teacher_of_class` helper) — NOT started. More
   design work, budget extra review.
4. **Group C** (2 tables) — NOT started, do last; requires tracing student-app page files this plan
   didn't cover, and gets the dual-shape logic wrong most easily.
5. **`employees`/face-embedding** — the face-embedding half was fast-tracked and fixed separately
   (see above). The rest of `employees` (every other column) is still fully `anon`-readable and not
   part of Group A — still NOT started.

**Given the scale (~20-25 new RPCs, a new shared helper or two, and matching Dart call-site changes
across all 3 Flutter flavors), this is realistically multiple sessions, not one** — Group A alone is
a reasonable single session; Groups B, C, and the `employees` phase each probably warrant their own.
