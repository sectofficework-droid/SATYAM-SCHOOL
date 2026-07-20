-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher app: Task module (per-assignee status) + Marks/Exam module (create
-- exam from the app, roster lookup by class name).
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Task module: per-assignee status ───────────────────────────────────────
-- Previously "status" lived only on tasks (shared by every assignee). Each
-- assignee now gets their own independent status.
ALTER TABLE task_assignees
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Pending','In Progress','Completed')) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- tasks/task_assignees already work from the admin panel today via the same
-- anon key, so these are a safety net matching the grant pattern already
-- used for homework/exams below — harmless if redundant.
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON tasks TO anon;
GRANT SELECT, UPDATE ON task_assignees TO anon;

-- ── Marks/Exam module: who conducted the exam + create-exam from the app ──
ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id);
GRANT INSERT ON exams TO anon;

-- Roster lookup by class NAME (not section_id) — needed because a subject
-- teacher's subject_mappings only has class name strings, not section ids,
-- so the existing get_class_students(p_section_id) can't be used for a
-- class the teacher isn't the class-teacher of.
CREATE OR REPLACE FUNCTION get_class_students_by_name(p_class_name TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT s.id, s.first_name, s.last_name, s.grno, s.photo_url,
             e.enrollment_no, e.roll_no
      FROM students s
      JOIN student_enrollments e ON e.student_id = s.id
      JOIN sections sec ON sec.id = e.section_id
      JOIN classes c ON c.id = sec.class_id
      WHERE c.name = p_class_name
      ORDER BY e.roll_no, s.first_name
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_class_students_by_name(TEXT) TO anon;
