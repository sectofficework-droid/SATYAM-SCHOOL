-- ─────────────────────────────────────────────────────────────────────────────
-- Marksheet feature (admin panel): per-class subject list + read access for
-- the admin panel's Supabase Auth session on tables that were previously
-- only readable by the mobile app's teacher/student identities.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-class subject list - didn't exist anywhere before (mobile app only has
-- one flat global subject list shared by every class). Keyed by class NAME
-- (text), matching how exams.class already stores class names (e.g.
-- "JR.KG", "11th - Commerce"), so the marksheet report can join against
-- exams without reconciling this against the admin panel's separate
-- classes.id primary keys.
CREATE TABLE IF NOT EXISTS class_subjects (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_name   TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_name, subject_name)
);

GRANT SELECT ON class_subjects TO anon;

-- exams already has "exams_all_users" (any logged-in user can SELECT).
-- exam_marks and student_attendance only have teacher/student-scoped
-- policies (auth.uid() must match an employees or students row's
-- app_user_id) - the admin panel's admin_users-based auth session matches
-- neither, so without these it would silently get zero rows back.
CREATE POLICY "marks_all_users_read" ON exam_marks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "attendance_all_users_read" ON student_attendance
  FOR SELECT USING (auth.uid() IS NOT NULL);
