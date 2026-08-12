-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes get_student_fees (SUPABASE_APP_AUTH.sql):
--
-- 1. Bug: payments were returned `ORDER BY payment_date DESC` (most recent
--    first, a reasonable display order), but the student app numbered them
--    "Payment #1, #2, ..." using that same DESC list's position - so the
--    most recent payment was mislabeled #1 and the earliest came last. Each
--    payment now carries its own payment_number computed by date ascending
--    (1 = the very first payment), independent of the display order.
--
-- 2. New: adds an `inventory` array - the student's inventory_items
--    assignments (bag, uniform, books, etc.) with status and given_date, so
--    the Fee Status screen can show what's actually been given to them.
--    Given items are ordered by given_date (the order they were actually
--    handed out); Pending items follow, alphabetically.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_inventory        JSON;
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
      'total_paid', 0, 'balance', 0, 'payments', '[]'::json, 'inventory', '[]'::json
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

  -- Displayed most-recent-first (unchanged), but each row now also carries
  -- its true chronological payment_number (1 = earliest payment ever made).
  SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.payment_date DESC), '[]'::json)
  INTO v_payments
  FROM (
    SELECT fp.*,
           ROW_NUMBER() OVER (ORDER BY fp.payment_date ASC, fp.created_at ASC) AS payment_number
    FROM fee_payments fp
    WHERE fp.enrollment_id = v_enrollment_id
  ) p;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
  INTO v_inventory
  FROM (
    SELECT ii.name AS item_name, sia.status, sia.given_date
    FROM student_inventory_assignments sia
    JOIN inventory_items ii ON ii.id = sia.item_id
    WHERE sia.enrollment_id = v_enrollment_id
    ORDER BY (sia.status = 'Given') DESC, sia.given_date ASC NULLS LAST, ii.name ASC
  ) r;

  RETURN json_build_object(
    'fee_total',       v_total_fee,
    'fee_discount',    v_fee_discount,
    'discount_reason', v_discount_reason,
    'total_paid',      v_total_paid,
    'balance',         v_balance,
    'payments',        v_payments,
    'inventory',       v_inventory
  );
END;
$$;
