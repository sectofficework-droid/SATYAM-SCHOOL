-- INCIDENT (2026-09-21): REQ-SEC-002 Category 3 Group A
-- (SUPABASE_CAT3_GROUP_A_RPCS.sql, applied 2026-09-19) revoked anon's direct
-- table access on the 9 tables below and moved them to session-token-gated
-- RPCs, but the matching Dart code was never committed/shipped to a real
-- device or distributed build. Every currently-installed Teacher/Student
-- app (S3-distributed AND the Play Store alpha/closed-testing build) still
-- calls these tables directly as `anon` and got permission-denied errors
-- with no error handling anywhere in the call chain - this silently broke,
-- in production, starting 2026-09-19:
--   - Mark Attendance screen (unhandled fetchMyEditRequests call inside
--     _loadAttendanceForDate() left _attLoading stuck true - the screen
--     spins forever, teachers can never see the roster or Save button)
--   - Leave Requests, Teacher/Student Alerts, Queries & Suggestions,
--     Task Assignees, Daily Task Completions, Syllabus Edit Requests,
--     Teacher Documents
--
-- Found 2026-09-21 while investigating a teacher-reported "can't take
-- attendance" bug. A fixed build was prepared (session-token Dart code
-- already existed locally, version bumped to 1.0.0+3, APK+AAB built for
-- both flavors) but could not actually be distributed to already-installed
-- devices from that session (no working S3 upload path, and the Play
-- Console AAB upload failed at the network layer) - so the only fix that
-- reaches real users immediately is reverting the DB side.
--
-- This migration restores the exact pre-2026-09-19 state (RLS disabled +
-- full anon grants), matching every other not-yet-migrated mobile table.
-- TEMPORARY: re-apply SUPABASE_CAT3_GROUP_A_RPCS.sql's restriction once a
-- build containing its matching Dart changes is confirmed distributed and
-- installed (S3 app_versions row live + Play Store release live), not
-- before - see governance/planning/TODO.md REQ-SEC-002.

ALTER TABLE leave_requests             DISABLE ROW LEVEL SECURITY;
ALTER TABLE queries_suggestions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_alerts             DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_alerts             DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees             DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_completions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_edit_requests   DISABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_edit_requests     DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_documents          DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON leave_requests             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON queries_suggestions        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_alerts             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_alerts             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON task_assignees             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_task_completions     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_edit_requests   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON syllabus_edit_requests     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_documents          TO anon;
