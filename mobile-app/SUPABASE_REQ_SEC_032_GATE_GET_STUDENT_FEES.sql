-- REQ-SEC-032 (2026-11-20 full-system audit): get_student_fees(uuid) had
-- zero caller-identity check and was granted to anon - any caller holding
-- the public anon key could read any student's complete financial record
-- (fee total, discount + reason, full payment history) by UUID, no login.
-- Same Category 3 bug class as fetch_my_exam_mark and friends, missed on
-- this RPC. Applied live via Supabase MCP 2026-11-20.

DROP FUNCTION IF EXISTS public.get_student_fees(uuid);

CREATE OR REPLACE FUNCTION public.get_student_fees(p_student_id uuid, p_session_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NOT public.verify_mobile_session('student', p_student_id, p_session_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
$function$;

REVOKE ALL ON FUNCTION public.get_student_fees(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_fees(uuid, text) TO anon, authenticated, service_role;
