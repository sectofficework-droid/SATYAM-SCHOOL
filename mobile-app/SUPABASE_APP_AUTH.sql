-- ─────────────────────────────────────────────────────────────────────────────
-- App Auth: Employee ID + Password (no Supabase Auth required)
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add app_password to employees (default: Satyam@123)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS app_password TEXT DEFAULT 'Satyam@123';

-- Add app_password to students (default: Satyam@123)
ALTER TABLE students ADD COLUMN IF NOT EXISTS app_password TEXT DEFAULT 'Satyam@123';

-- ── Login RPC functions (SECURITY DEFINER bypasses RLS) ───────────────────────

CREATE OR REPLACE FUNCTION teacher_login(p_employee_id TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row employees%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM employees
  WHERE UPPER(TRIM(employee_id)) = UPPER(TRIM(p_employee_id))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION student_login(p_enrollment_no TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row students%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM students
  WHERE UPPER(TRIM(enrollment_no)) = UPPER(TRIM(p_enrollment_no))
    AND app_password = p_password;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row);
END;
$$;

-- ── Data RPCs (SECURITY DEFINER so anon key can read protected tables) ────────

CREATE OR REPLACE FUNCTION get_class_students(p_class TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(s))
    FROM (
      SELECT id, full_name, enrollment_no, roll_no, photo_url
      FROM students
      WHERE class = p_class
      ORDER BY full_name
    ) s
  );
END;
$$;

-- Was querying a "fees" table that doesn't exist in the real schema. Fixed
-- once to read student_enrollments.fee_total, but that field turned out to
-- be stale too - the admin panel's Fees page doesn't actually use it. It
-- computes Total Fees from that year's class fee_structures (tuition +
-- uniform) via calcSummary()/getStructureFee() in fees/page.js, because
-- fee_total is only ever set once at original enrollment time and is left
-- at 0 on a student's newer-year enrollment row after promotion. This
-- version matches the admin panel's actual calculation instead.
CREATE OR REPLACE FUNCTION get_student_fees(p_student_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id    UUID;
  v_class_id         UUID;
  v_academic_year_id UUID;
  v_fee_discount     NUMERIC;
  v_discount_reason  TEXT;
  v_total_fee        NUMERIC;
  v_actual_fee       NUMERIC;
  v_total_paid       NUMERIC;
  v_balance          NUMERIC;
  v_payments         JSON;
BEGIN
  SELECT se.id, se.class_id, se.academic_year_id, se.fee_discount, se.discount_reason
  INTO v_enrollment_id, v_class_id, v_academic_year_id, v_fee_discount, v_discount_reason
  FROM student_enrollments se
  JOIN academic_years ay ON ay.id = se.academic_year_id
  WHERE se.student_id = p_student_id AND ay.is_current = true
  LIMIT 1;

  IF v_enrollment_id IS NULL THEN
    RETURN json_build_object(
      'fee_total', 0, 'fee_discount', 0, 'discount_reason', NULL,
      'total_paid', 0, 'balance', 0, 'payments', '[]'::json
    );
  END IF;

  SELECT (COALESCE(fs.tuition_amount, 0) + COALESCE(fs.uniform_amount, 0))
  INTO v_total_fee
  FROM fee_structures fs
  WHERE fs.academic_year_id = v_academic_year_id AND fs.class_id = v_class_id;

  v_total_fee    := COALESCE(v_total_fee, 0);
  v_fee_discount := COALESCE(v_fee_discount, 0);
  v_actual_fee   := GREATEST(v_total_fee - v_fee_discount, 0);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM fee_payments WHERE enrollment_id = v_enrollment_id;

  v_balance := GREATEST(v_actual_fee - v_total_paid, 0);

  SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.payment_date DESC), '[]'::json)
  INTO v_payments
  FROM fee_payments p
  WHERE p.enrollment_id = v_enrollment_id;

  RETURN json_build_object(
    'fee_total',       v_total_fee,
    'fee_discount',    v_fee_discount,
    'discount_reason', v_discount_reason,
    'total_paid',      v_total_paid,
    'balance',         v_balance,
    'payments',        v_payments
  );
END;
$$;

-- ── Allow anon key to call RPCs and read app tables ───────────────────────────

GRANT EXECUTE ON FUNCTION teacher_login(TEXT, TEXT)   TO anon;
GRANT EXECUTE ON FUNCTION student_login(TEXT, TEXT)   TO anon;
GRANT EXECUTE ON FUNCTION get_class_students(TEXT)    TO anon;
GRANT EXECUTE ON FUNCTION get_student_fees(UUID)      TO anon;

-- App tables are not user-specific so allow anon read
ALTER TABLE student_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE homework           DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams              DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_marks         DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON student_attendance TO anon;
GRANT SELECT, INSERT          ON homework           TO anon;
GRANT SELECT                  ON exams              TO anon;
GRANT SELECT, INSERT, UPDATE  ON exam_marks         TO anon;
GRANT SELECT                  ON notices            TO anon;
