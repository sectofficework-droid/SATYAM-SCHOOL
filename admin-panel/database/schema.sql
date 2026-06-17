-- ============================================================
-- SATYAM STARS INTERNATIONAL SCHOOL — DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO roles (name, permissions) VALUES
  ('Super Admin',     '{"student_basic":true,"student_full":true,"fees_view":true,"fees_class_only":false,"fees_remind":true,"attendance":true,"reports":true,"timetable":true}'),
  ('Admin',           '{"student_basic":true,"student_full":true,"fees_view":true,"fees_class_only":false,"fees_remind":true,"attendance":true,"reports":true,"timetable":true}'),
  ('Teacher',         '{"student_basic":true,"student_full":false,"fees_view":true,"fees_class_only":true,"fees_remind":true,"attendance":true,"reports":false,"timetable":true}'),
  ('Management Head', '{"student_basic":true,"student_full":true,"fees_view":true,"fees_class_only":false,"fees_remind":true,"attendance":true,"reports":true,"timetable":true}');

-- ============================================================
-- 2. USERS (linked to Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  role_id    UUID REFERENCES roles(id),
  status     TEXT CHECK (status IN ('Active','Inactive')) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. SCHOOL PROFILE (single row)
-- ============================================================
CREATE TABLE school_profile (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  address    TEXT,
  city       TEXT,
  state      TEXT,
  pincode    CHAR(6) CHECK (pincode ~ '^[0-9]{6}$'),
  phone      CHAR(10) CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email      TEXT,
  website    TEXT,
  board      TEXT,
  medium     TEXT,
  udise      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO school_profile (name, address, city, state, pincode, phone, email, website, board, medium, udise)
VALUES (
  'Satyam Stars International School',
  'Swaminarayan Nagar - Bhidbhanjan Society, Pandesara',
  'Surat', 'Gujarat', '394221', '8200069671',
  'satyamstarsinternational@gmail.com',
  'www.satyamstars.edu.in', 'GSEB', 'English', '24224100067'
);

-- ============================================================
-- 4. ACADEMIC YEARS
-- ============================================================
CREATE TABLE academic_years (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label            TEXT UNIQUE NOT NULL,
  start_date       DATE,
  admission_date   DATE,
  readmission_date DATE,
  is_current       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

INSERT INTO academic_years (label, start_date, admission_date, readmission_date, is_current) VALUES
  ('2024-25', '2024-04-01', '2024-04-01', '2024-03-15', false),
  ('2025-26', '2025-04-01', '2025-04-01', '2025-03-15', false),
  ('2026-27', '2026-04-01', '2026-04-01', '2026-03-15', true);

-- ============================================================
-- 5. CLASSES
-- ============================================================
CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO classes (name, sort_order, is_active) VALUES
  ('JR KG',         1,  true),
  ('SR KG',         2,  true),
  ('Balvatika',     3,  true),
  ('1st',           4,  true),
  ('2nd',           5,  true),
  ('3rd',           6,  true),
  ('4th',           7,  true),
  ('5th',           8,  true),
  ('6th',           9,  true),
  ('7th',           10, true),
  ('8th',           11, true),
  ('9th',           12, true),
  ('10th',          13, true),
  ('11th Commerce', 14, true),
  ('12th Commerce', 15, true);

-- ============================================================
-- 6. SECTIONS
-- ============================================================
CREATE TABLE sections (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, name)
);

-- ============================================================
-- 7. FEE STRUCTURE
-- ============================================================
CREATE TABLE fee_structures (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id     UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id             UUID REFERENCES classes(id) ON DELETE CASCADE,
  tuition_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  uniform_amount       NUMERIC(10,2) DEFAULT 0,
  old_student_discount NUMERIC(10,2) DEFAULT 1000,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (academic_year_id, class_id)
);

-- ============================================================
-- 8. DOCUMENT TYPES (master list)
-- ============================================================
CREATE TABLE document_types (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO document_types (name) VALUES
  ('Birth Certificate'),
  ('Student Aadhar Card'),
  ('Father''s Aadhar Card'),
  ('Mother''s Aadhar Card'),
  ('Leaving Certificate'),
  ('Marksheet'),
  ('Caste Certificate'),
  ('Photo');

-- ============================================================
-- 9. STUDENTS
-- ============================================================
CREATE TABLE students (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grno           TEXT,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  dob            DATE NOT NULL,
  gender         TEXT CHECK (gender IN ('Male','Female','Other')),
  place_of_birth TEXT,
  photo_url      TEXT,
  father_name    TEXT NOT NULL,
  mother_name    TEXT NOT NULL,
  mobile1        TEXT NOT NULL,
  mobile2        TEXT,
  religion       TEXT,
  caste          TEXT DEFAULT 'General',
  sub_caste      TEXT,
  mother_tongue  TEXT,
  height_cm      NUMERIC(5,1),
  weight_kg      NUMERIC(5,1),
  room_plot_no   TEXT,
  society        TEXT,
  landmark       TEXT,
  area           TEXT,
  pincode        CHAR(6),
  address        TEXT,
  aadhar         CHAR(12),
  aadhar_name    TEXT,
  udise          TEXT,
  pen            TEXT,
  apaar          TEXT,
  status         TEXT CHECK (status IN ('Active','Inactive','Left')) DEFAULT 'Active',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. STUDENT ENROLLMENTS (one row per student per year)
-- ============================================================
CREATE TABLE student_enrollments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id         UUID REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id   UUID REFERENCES academic_years(id),
  enrollment_no      TEXT UNIQUE NOT NULL,
  class_id           UUID REFERENCES classes(id),
  section_id         UUID REFERENCES sections(id),
  roll_no            INT NOT NULL,
  date_of_join       DATE,
  admission_class_id UUID REFERENCES classes(id),
  fee_total          NUMERIC(10,2) DEFAULT 0,
  fee_discount       NUMERIC(10,2) DEFAULT 0,
  discount_reason    TEXT,
  deactivate_reason  TEXT,
  deactivate_date    DATE,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (academic_year_id, class_id, section_id, roll_no)
);

-- ============================================================
-- 11. STUDENT PREVIOUS SCHOOL
-- ============================================================
CREATE TABLE student_previous_school (
  student_id      UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  school_name     TEXT NOT NULL,
  grno            TEXT,
  class           TEXT,
  medium          TEXT,
  place           TEXT,
  attendance_days INT,
  last_exam_given BOOLEAN,
  percentage      NUMERIC(5,2),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. STUDENT DOCUMENTS (each document has its own separate URL)
-- ============================================================
CREATE TABLE student_documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES document_types(id),
  status           TEXT CHECK (status IN ('Pending','Uploaded')) DEFAULT 'Pending',
  file_url         TEXT,
  uploaded_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, document_type_id)
);

-- ============================================================
-- 13. STUDENT SIBLINGS
-- ============================================================
CREATE TABLE student_siblings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  sibling_name  TEXT NOT NULL,
  sibling_class TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 14. TRANSFER CERTIFICATES
-- ============================================================
CREATE TABLE transfer_certificates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID REFERENCES students(id),
  tc_number    TEXT UNIQUE NOT NULL,
  issue_date   DATE NOT NULL,
  leaving_date DATE NOT NULL CHECK (leaving_date >= issue_date),
  reason       TEXT NOT NULL,
  conduct      TEXT CHECK (conduct IN ('Excellent','Good','Satisfactory','Needs Improvement')),
  dues_cleared BOOLEAN NOT NULL DEFAULT false,
  remarks      TEXT,
  file_url     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. STUDENT PROMOTIONS (audit history)
-- ============================================================
CREATE TABLE student_promotions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id         UUID REFERENCES students(id),
  from_enrollment_id UUID REFERENCES student_enrollments(id),
  to_enrollment_id   UUID REFERENCES student_enrollments(id),
  promoted_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 16. FEE PAYMENTS
-- ============================================================
CREATE TABLE fee_payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  student_id    UUID REFERENCES students(id),
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE NOT NULL,
  received_by   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 17. EMPLOYEES
-- ============================================================
CREATE TABLE employees (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emp_code                    TEXT UNIQUE NOT NULL,
  name                        TEXT NOT NULL,
  gender                      TEXT CHECK (gender IN ('Male','Female','Other')),
  dob                         DATE,
  phone                       TEXT NOT NULL,
  alt_phone                   TEXT,
  email                       TEXT,
  address                     TEXT,
  aadhar                      TEXT,
  pan                         TEXT,
  type                        TEXT CHECK (type IN ('management','teaching','non-teaching','media')) NOT NULL,
  designation                 TEXT NOT NULL,
  department                  TEXT NOT NULL,
  employment_type             TEXT CHECK (employment_type IN ('Permanent','Contractual','Part-time')) DEFAULT 'Permanent',
  joining_date                DATE NOT NULL,
  status                      TEXT CHECK (status IN ('Active','Inactive')) DEFAULT 'Active',
  class_teacher_of_section_id UUID REFERENCES sections(id),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 18. EMPLOYEE DOCUMENTS
-- ============================================================
CREATE TABLE employee_documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  doc_name    TEXT NOT NULL,
  uploaded    BOOLEAN DEFAULT false,
  file_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 19. EMPLOYEE SUBJECT MAPPINGS
-- ============================================================
CREATE TABLE employee_subject_mappings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  class_id    UUID REFERENCES classes(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 20. EMPLOYEE SALARIES
-- ============================================================
CREATE TABLE employee_salaries (
  employee_id    UUID PRIMARY KEY REFERENCES employees(id),
  monthly_amount NUMERIC(10,2) NOT NULL CHECK (monthly_amount > 0),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 21. SALARY PAYMENTS
-- ============================================================
CREATE TABLE salary_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  month       DATE NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  paid_on     DATE NOT NULL,
  paid_by     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, month)
);

-- ============================================================
-- 22. EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  category     TEXT CHECK (category IN ('Salary','Infrastructure','Supplies','Utilities','Events','Maintenance','Transport','Other')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  paid_by      TEXT,
  note         TEXT,
  receipt_url  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 23. INVENTORY ITEMS
-- ============================================================
CREATE TABLE inventory_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT UNIQUE NOT NULL,
  category        TEXT CHECK (category IN ('student','office','other')),
  unit            TEXT NOT NULL,
  low_stock_at    INT DEFAULT 10,
  storage_address TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 24. INVENTORY BATCHES (stock in)
-- ============================================================
CREATE TABLE inventory_batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id       UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty           INT NOT NULL CHECK (qty > 0),
  received_date DATE NOT NULL,
  received_by   TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 25. INVENTORY USAGES (stock out)
-- ============================================================
CREATE TABLE inventory_usages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id    UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty        INT NOT NULL CHECK (qty > 0),
  usage_date DATE NOT NULL,
  purpose    TEXT CHECK (purpose IN ('student','office','other')),
  used_by    TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 26. STUDENT INVENTORY ASSIGNMENTS
-- ============================================================
CREATE TABLE student_inventory_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES inventory_items(id),
  status        TEXT CHECK (status IN ('Pending','Given')) DEFAULT 'Pending',
  given_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (enrollment_id, item_id)
);

-- ============================================================
-- 27. ASSETS
-- ============================================================
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  brand           TEXT,
  storage_address TEXT,
  invoice_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 28. ASSET CHECKOUTS
-- ============================================================
CREATE TABLE asset_checkouts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id    UUID REFERENCES assets(id) ON DELETE CASCADE,
  taken_by    TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  taken_date  DATE NOT NULL,
  return_date DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 29. NOTICES
-- ============================================================
CREATE TABLE notices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  type           TEXT CHECK (type IN ('Academic','Event','Holiday','Fee','Circular','General','Urgent')),
  audience       TEXT CHECK (audience IN ('Everyone','All Students','All Staff','Parents','Management')),
  posted_date    DATE NOT NULL,
  expiry_date    DATE,
  posted_by      TEXT,
  pinned         BOOLEAN DEFAULT false,
  archived       BOOLEAN DEFAULT false,
  attachment_url TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 30. TASKS
-- ============================================================
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  deadline_date DATE,
  deadline_time TIME,
  priority      TEXT CHECK (priority IN ('High','Medium','Low')) DEFAULT 'Medium',
  status        TEXT CHECK (status IN ('Pending','In Progress','Completed')) DEFAULT 'Pending',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 31. TASK ASSIGNEES
-- ============================================================
CREATE TABLE task_assignees (
  task_id     UUID REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, employee_id)
);

-- ============================================================
-- 32. TIMETABLE PERIOD DEFINITIONS (fully dynamic)
-- ============================================================
CREATE TABLE timetable_period_definitions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  day_group        TEXT NOT NULL CHECK (day_group IN ('Mon - Wed','Thu - Fri','Saturday')),
  sort_order       INT NOT NULL,
  label            TEXT NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL CHECK (end_time > start_time),
  is_break         BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (academic_year_id, day_group, sort_order)
);

-- ============================================================
-- 33. TIMETABLE ENTRIES
-- ============================================================
CREATE TABLE timetable_entries (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_definition_id UUID REFERENCES timetable_period_definitions(id) ON DELETE CASCADE,
  section_id           UUID REFERENCES sections(id) ON DELETE CASCADE,
  subject              TEXT,
  teacher_id           UUID REFERENCES employees(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (period_definition_id, section_id)
);

-- ============================================================
-- 34. YEAR PLAN EVENTS
-- ============================================================
CREATE TABLE year_plan_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date DATE NOT NULL,
  category   TEXT NOT NULL,
  label      TEXT NOT NULL,
  icon       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_date, label)
);

-- ============================================================
-- 35. FEE REMINDER TEMPLATES
-- ============================================================
CREATE TABLE fee_reminder_templates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  language   TEXT UNIQUE CHECK (language IN ('en','hi','or')),
  template   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO fee_reminder_templates (language, template) VALUES
  ('en', 'Dear Parent, {name} (Class {class}, Roll {roll}) has {amount} school fees pending. Please pay on or before {date}. Thank you, Satyam Stars International School, Surat'),
  ('hi', 'प्रिय अभिभावक, {name} (कक्षा {class}, रोल {roll}) की {amount} स्कूल फीस बाकी है। कृपया {date} तक जमा करें। धन्यवाद, सत्यम स्टार्स इंटरनेशनल स्कूल, सूरत'),
  ('or', 'ପ୍ରିୟ ଅଭିଭାବକ, {name} (ଶ୍ରେଣୀ {class}, ରୋଲ {roll}) ର {amount} ସ୍କୁଲ ଶୁଳ୍କ ବାକି ଅଛି। ଦଯାକରି {date} ପୂର୍ବରୁ ଦିଅନ୍ତୁ। ଧନ୍ୟବାଦ, ସତ୍ୟମ ଷ୍ଟାର୍ସ ଇଣ୍ଟରନ୍ୟାସନାଲ ସ୍କୁଲ, ସୁରାଟ');

-- ============================================================
-- All 35 tables created successfully.
-- ============================================================
