-- ─────────────────────────────────────────────────────────────────────────────
-- SEF Phase 2 — Inventory, Employee (+Attendance+Salary), Notice Board,
-- Task Management, Syllabus, Question Bank/Papers, and the per-Std subject
-- list (sef_std_subjects) that Employee/Syllabus/Question Bank all draw
-- their Subject dropdowns from.
--
-- No SEF mobile app exists yet, so unlike the school's equivalents:
-- - sef_employee_attendance has no leave-request approval queue - admin
--   marks a day 'L' directly, same table, no separate submission channel.
-- - sef_syllabus / sef_question_bank are authored directly by admin, no
--   lock/edit-request workflow (that exists on the school side to protect
--   a teacher's own app-submitted data from being silently overwritten -
--   nothing writes here except the admin panel itself).
-- - sef_task_assignees.status is admin-settable, not self-reported from a
--   staff app.
--
-- Run this in Supabase Dashboard → SQL Editor (after sef_schema.sql and
-- sef_settings_schema.sql). RLS intentionally OFF, same as every table in
-- this project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Per-Std subjects ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_std_subjects (
  std        TEXT NOT NULL REFERENCES sef_classes(std) ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (std, subject)
);

-- ── Employee + Attendance + Salary ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_employees (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  gender           TEXT CHECK (gender IN ('Male','Female','Other')),
  dob              DATE,
  phone            TEXT NOT NULL,
  alt_phone        TEXT,
  email            TEXT,
  address          TEXT,
  aadhar           TEXT,
  pan              TEXT,
  role_type        TEXT NOT NULL DEFAULT 'Tutor' CHECK (role_type IN ('Tutor','Admin','Management')),
  designation      TEXT,
  joining_date     DATE NOT NULL,
  employment_type  TEXT DEFAULT 'Permanent' CHECK (employment_type IN ('Permanent','Contractual','Part-time')),
  status           TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  photo_key        TEXT,               -- S3 key, sef-employees/ prefix
  subject_mappings JSONB,              -- [{ std, subjects: [...] }]
  documents        JSONB,              -- [{ name, uploaded, fileName, fileUrl }]
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_employee_attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES sef_employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('P','A','L')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS sef_salary_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES sef_employees(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  month       DATE NOT NULL,
  paid_on     DATE NOT NULL,
  paid_by     TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, month)
);

-- ── Inventory (stock only — no assets/checkouts) ────────────────────
CREATE TABLE IF NOT EXISTS sef_inventory_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT UNIQUE NOT NULL,
  unit         TEXT NOT NULL,
  low_stock_at INT DEFAULT 10,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_inventory_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id       UUID NOT NULL REFERENCES sef_inventory_items(id) ON DELETE CASCADE,
  qty           INT NOT NULL CHECK (qty > 0),
  received_date DATE NOT NULL,
  received_by   TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_inventory_usages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    UUID NOT NULL REFERENCES sef_inventory_items(id) ON DELETE CASCADE,
  qty        INT NOT NULL CHECK (qty > 0),
  usage_date DATE NOT NULL,
  used_by    TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Notice Board ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_notices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'General' CHECK (type IN ('Academic','Event','Holiday','Fee','Circular','General','Urgent')),
  posted_date DATE NOT NULL,
  expiry_date DATE,
  posted_by   TEXT,
  pinned      BOOLEAN DEFAULT false,
  archived    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Task Management ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_tasks (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title              TEXT NOT NULL,
  description        TEXT,
  deadline_date      DATE NOT NULL,
  deadline_time      TIME,
  priority           TEXT DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  status             TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
  show_on_dashboard  BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_task_assignees (
  task_id     UUID NOT NULL REFERENCES sef_tasks(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES sef_employees(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed')),
  PRIMARY KEY (task_id, employee_id)
);

-- ── Syllabus ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_syllabus (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  std        TEXT NOT NULL,
  subject    TEXT NOT NULL,
  chapter    TEXT NOT NULL,
  tutor_id   UUID REFERENCES sef_employees(id),
  status     TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_syllabus_subtopics (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES sef_syllabus(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed')),
  sort_order INT DEFAULT 0
);

-- ── Question Bank + Papers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sef_question_bank (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  std             TEXT NOT NULL,
  subject         TEXT NOT NULL,
  chapter         TEXT NOT NULL,
  question_format TEXT DEFAULT 'Written' CHECK (question_format IN ('MCQ','Written')),
  marks           INT NOT NULL DEFAULT 1,
  question_text   TEXT NOT NULL,
  options         JSONB,
  correct_option  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_question_papers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_type       TEXT DEFAULT 'Exam' CHECK (paper_type IN ('Exam','Assignment')),
  title            TEXT NOT NULL,
  std              TEXT NOT NULL,
  subject          TEXT NOT NULL,
  duration_minutes INT,
  full_marks       INT NOT NULL DEFAULT 0,
  exam_date        DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_question_paper_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id       UUID NOT NULL REFERENCES sef_question_papers(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES sef_question_bank(id) ON DELETE CASCADE,
  order_index    INT NOT NULL,
  marks_override INT
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sef_employee_attendance_emp    ON sef_employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_sef_employee_attendance_date   ON sef_employee_attendance(date);
CREATE INDEX IF NOT EXISTS idx_sef_inventory_batches_item     ON sef_inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_sef_inventory_usages_item      ON sef_inventory_usages(item_id);
CREATE INDEX IF NOT EXISTS idx_sef_task_assignees_employee    ON sef_task_assignees(employee_id);
CREATE INDEX IF NOT EXISTS idx_sef_syllabus_lookup            ON sef_syllabus(std, subject);
CREATE INDEX IF NOT EXISTS idx_sef_syllabus_subtopics_chapter ON sef_syllabus_subtopics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_sef_question_bank_lookup       ON sef_question_bank(std, subject, chapter);
CREATE INDEX IF NOT EXISTS idx_sef_question_paper_items_paper ON sef_question_paper_items(paper_id);

-- ── RLS off, grants ───────────────────────────────────────────────
ALTER TABLE sef_std_subjects         DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_employees            DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_employee_attendance  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_salary_payments      DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_inventory_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_inventory_batches    DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_inventory_usages     DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_notices              DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_tasks                DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_task_assignees       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_syllabus             DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_syllabus_subtopics   DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_question_bank        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_question_papers      DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_question_paper_items DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sef_std_subjects         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_employees            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_employee_attendance  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_salary_payments      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_inventory_items      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_inventory_batches    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_inventory_usages     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_notices              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_tasks                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_task_assignees       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_syllabus             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_syllabus_subtopics   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_question_bank        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_question_papers      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_question_paper_items TO anon, authenticated;
