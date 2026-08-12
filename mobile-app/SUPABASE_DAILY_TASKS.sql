-- ─────────────────────────────────────────────────────────────────────────────
-- Daily Task module: a recurring admin-defined staff checklist, separate from
-- tasks/task_assignees (SUPABASE_TASKS_AND_EXAMS.sql), which is a one-off,
-- deadline-based assignment workflow (Pending/In Progress/Completed). This is
-- simpler and recurring: admin defines standing checklist items - some common
-- to every staff member every day, some assigned to specific staff only - and
-- each staff member just ticks them off per day. The tick's timestamp is
-- captured automatically (completed_at defaults to NOW()), not typed in, and
-- naturally resets each day since completions are keyed by calendar date
-- while history is preserved.
--
-- teacher_login (SUPABASE_APP_AUTH.sql) has no employees.type filter, so
-- "All Staff" (target_type='all') means every Active employee of any type
-- (teaching, non-teaching, management, media), not just teachers.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('all','specific')),
  active      BOOLEAN NOT NULL DEFAULT true, -- soft-delete: keeps completion history meaningful after retiring a routine
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Only populated when target_type = 'specific'.
CREATE TABLE IF NOT EXISTS daily_task_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_task_id UUID NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE (daily_task_id, employee_id)
);

-- One row per (task, staff, day) they've ticked - the completion ledger.
CREATE TABLE IF NOT EXISTS daily_task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_task_id   UUID NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (daily_task_id, employee_id, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_task_targets_task     ON daily_task_targets(daily_task_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_targets_employee ON daily_task_targets(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_completions_task_date     ON daily_task_completions(daily_task_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_daily_task_completions_employee_date ON daily_task_completions(employee_id, completion_date);

ALTER TABLE daily_tasks             DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_targets      DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_task_completions  DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_tasks            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_task_targets     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_task_completions TO anon, authenticated;
