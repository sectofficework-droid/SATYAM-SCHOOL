-- REQ-SEC-029: updateFeesForEnrollment (feesService.js) changes
-- student_enrollments.fee_discount/discount_reason and can UPDATE/DELETE
-- fee_payments rows, using a plain client-side Supabase call with RLS
-- gated only by is_admin_user() (any admin tier) - the Super Admin UI
-- restricts this to senior_admin/management client-side, but nothing
-- stops a normal_admin from calling the same query directly (e.g. browser
-- console) since RLS doesn't check role tier.
--
-- Fixed via BEFORE triggers rather than tightening RLS wholesale, since
-- student_enrollments has many other columns (roll_no, class_id, etc.)
-- that normal_admin legitimately edits every day via Edit Student - only
-- the discount columns specifically need gating. fee_payments INSERT
-- (routine payment collection, fees/page.js's saveFeePayment) stays open
-- to every admin tier; only UPDATE/DELETE on an existing payment is
-- restricted, since normal_admin has no legitimate reason to edit or
-- remove a recorded payment.
-- Applied directly to the live DB via Supabase MCP on 2026-11-18.

CREATE OR REPLACE FUNCTION public.enforce_fee_discount_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.fee_discount IS DISTINCT FROM OLD.fee_discount
     OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN
    SELECT role INTO v_role FROM admin_users WHERE id = auth.uid();
    IF v_role IS NULL OR v_role NOT IN ('senior_admin', 'management') THEN
      RAISE EXCEPTION 'Only senior_admin/management can change fee discounts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_fee_discount_role ON student_enrollments;
CREATE TRIGGER trg_enforce_fee_discount_role
BEFORE UPDATE ON student_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_fee_discount_role();

CREATE OR REPLACE FUNCTION public.enforce_fee_payment_edit_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM admin_users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('senior_admin', 'management') THEN
    RAISE EXCEPTION 'Only senior_admin/management can edit or delete a recorded fee payment';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_fee_payment_edit_role ON fee_payments;
CREATE TRIGGER trg_enforce_fee_payment_edit_role
BEFORE UPDATE OR DELETE ON fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_fee_payment_edit_role();
