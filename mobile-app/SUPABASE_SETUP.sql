  -- ─────────────────────────────────────────────────────────────────────────────
  -- Satyam School Mobile App — Supabase Schema Additions
  -- Run this in Supabase Dashboard → SQL Editor
  -- ─────────────────────────────────────────────────────────────────────────────

  -- 1. Link employees to Supabase auth accounts (for teacher app login)
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES auth.users(id);
  CREATE INDEX IF NOT EXISTS idx_employees_app_user_id ON employees(app_user_id);

  -- 2. Link students to Supabase auth accounts (for student app login)
  ALTER TABLE students ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES auth.users(id);
  CREATE INDEX IF NOT EXISTS idx_students_app_user_id ON students(app_user_id);

  -- 3. Student attendance
  CREATE TABLE IF NOT EXISTS student_attendance (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    class       TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('P','A','L')), -- Present/Absent/Leave
    marked_by   UUID REFERENCES employees(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, date)
  );

  -- 4. Homework
  CREATE TABLE IF NOT EXISTS homework (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class       TEXT NOT NULL,
    subject     TEXT,
    description TEXT NOT NULL,
    due_date    DATE NOT NULL,
    created_by  UUID REFERENCES employees(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  -- 5. Exams
  CREATE TABLE IF NOT EXISTS exams (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL,       -- e.g. "Unit Test 1", "Half Yearly"
    class       TEXT NOT NULL,
    subject     TEXT NOT NULL,
    date        DATE,
    max_marks   NUMERIC(5,2) NOT NULL DEFAULT 100,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  -- 6. Exam marks
  CREATE TABLE IF NOT EXISTS exam_marks (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks_obtained  NUMERIC(5,2),
    remarks         TEXT,
    entered_by      UUID REFERENCES employees(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (exam_id, student_id)
  );

  -- ─────────────────────────────────────────────────────────────────────────────
  -- RLS Policies (allow authenticated users to read their own data)
  -- ─────────────────────────────────────────────────────────────────────────────

  ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
  ALTER TABLE homework            ENABLE ROW LEVEL SECURITY;
  ALTER TABLE exams               ENABLE ROW LEVEL SECURITY;
  ALTER TABLE exam_marks          ENABLE ROW LEVEL SECURITY;

  -- Teachers can read/write attendance
  CREATE POLICY "teachers_attendance" ON student_attendance
    FOR ALL USING (
      EXISTS (SELECT 1 FROM employees WHERE app_user_id = auth.uid())
    );

  -- Students can read their own attendance
  CREATE POLICY "students_own_attendance" ON student_attendance
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM students WHERE app_user_id = auth.uid() AND id = student_id)
    );

  -- Homework visible to all logged-in users
  CREATE POLICY "homework_all_users" ON homework
    FOR SELECT USING (auth.uid() IS NOT NULL);

  CREATE POLICY "homework_teachers_insert" ON homework
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM employees WHERE app_user_id = auth.uid())
    );

  -- Exams visible to all logged-in users
  CREATE POLICY "exams_all_users" ON exams
    FOR SELECT USING (auth.uid() IS NOT NULL);

  -- Teachers can insert/update exam marks
  CREATE POLICY "marks_teachers" ON exam_marks
    FOR ALL USING (
      EXISTS (SELECT 1 FROM employees WHERE app_user_id = auth.uid())
    );

  -- Students can read their own marks
  CREATE POLICY "marks_own_student" ON exam_marks
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM students WHERE app_user_id = auth.uid() AND id = student_id)
    );

  -- ─────────────────────────────────────────────────────────────────────────────
  -- Also update existing tables to allow app users to read them
  -- ─────────────────────────────────────────────────────────────────────────────

  -- Students can read own profile
  DROP POLICY IF EXISTS "students_own_profile" ON students;
  CREATE POLICY "students_own_profile" ON students
    FOR SELECT USING (app_user_id = auth.uid());

  -- Employees can read own profile
  DROP POLICY IF EXISTS "employees_own_profile" ON employees;
  CREATE POLICY "employees_own_profile" ON employees
    FOR SELECT USING (app_user_id = auth.uid());
