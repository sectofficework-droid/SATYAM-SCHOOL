-- ─────────────────────────────────────────────────────────────────────────────
-- SEF (Satyam Education Foundation) — Phase 1: a second, simpler org sharing
-- this same admin panel via the header/sidebar org switcher. Same
-- organization/people as Satyam Stars International School, but a
-- different operation (tuition classes) with its own students and fees —
-- deliberately NOT reusing students/fee_payments (those carry a whole
-- class/section/academic-year enrollment system SEF doesn't have) and NOT
-- adding SEF columns onto those tables either.
--
-- monthly_fee lives directly on sef_students (one tuition rate per
-- student, editable) rather than a separate fee-structure table — no
-- session/class fee matrix like the school has, just a number per student.
-- sef_fee_payments mirrors fee_payments' shape (amount, payment_date,
-- received_by) rather than inventing something new.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- RLS intentionally OFF, same as every other table in this project.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sef_students (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  std            TEXT NOT NULL,
  medium         TEXT,                    -- English / Gujarati / Hindi / Odia / Other
  school_name    TEXT,                    -- the school this tuition student formally attends
  dob            DATE,
  father_name    TEXT,
  mother_name    TEXT,
  mobile_1       TEXT NOT NULL,
  mobile_2       TEXT,
  address        TEXT,
  aadhar_no      TEXT,
  aadhar_name    TEXT,                    -- name as printed on the Aadhar card
  aadhar_doc_key TEXT,                    -- S3 key, private bucket (see sef-students/ prefix)
  monthly_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sef_fee_payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES sef_students(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE NOT NULL,
  received_by   TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sef_students_status       ON sef_students(status);
CREATE INDEX IF NOT EXISTS idx_sef_fee_payments_student   ON sef_fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_sef_fee_payments_date      ON sef_fee_payments(payment_date);

ALTER TABLE sef_students     DISABLE ROW LEVEL SECURITY;
ALTER TABLE sef_fee_payments DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sef_students     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sef_fee_payments TO anon, authenticated;
