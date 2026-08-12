-- ─────────────────────────────────────────────────────────────────────────────
-- Staff face-scan punch attendance. Builds on employee_attendance
-- (SUPABASE_STAFF_LEAVE.sql), which today only carries a P/A/L status per
-- staff per day, set either by an admin (Mark Attendance tab) or
-- auto-marked 'L' by an approved leave request. This adds a third, staff
-- self-service path: the teacher app's Face Punch screen matches a live
-- selfie against the staff member's enrolled face embedding (on-device
-- TFLite, no cloud call) and, on a match, upserts today's row itself with
-- an actual check-in/check-out timestamp - status stays 'P', and
-- punch_method distinguishes it from an admin/system-marked row so nothing
-- about the existing manual-marking flow has to change.
--
-- face_embedding is a JSON array of ~192 floats (MobileFaceNet output),
-- stored as jsonb rather than a pgvector column since there's no
-- server-side similarity search here - matching happens entirely in the
-- app against the one row for the logged-in staff member.
--
-- Same convention as every table/column added this session: RLS disabled,
-- grants to both anon and authenticated (mobile app uses anon, admin panel
-- uses authenticated).
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS face_embedding   JSONB,
  ADD COLUMN IF NOT EXISTS face_enrolled_at TIMESTAMPTZ;

ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS check_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS punch_method  TEXT CHECK (punch_method IN ('face')); -- null = admin-marked or leave-auto-marked, as today
