-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace, slice 5 of "port remaining web admin modules":
-- Report Builder (the web admin panel's /report page) - 7 report types
-- beyond Staff Attendance (already ported 2026-10-01).
--
-- Deliberately CONDENSED, not field-for-field parity with the web versions.
-- The web's Students report in particular is a ~50-column census/regulatory-
-- filing export (Aadhar numbers, UDISE/PEN/APAAR, birth certificate
-- registration numbers, full previous-school history, etc.) meant for Excel/
-- print, not a phone screen - porting every column would be both unreadable
-- on mobile and a much larger surface of sensitive PII moving through a new
-- code path for no real benefit. Each RPC here returns only the fields an
-- admin would actually want to check on the go; the full export stays a web
-- action, same call as the Monthly Attendance Register and every XLSX/PDF
-- export decision earlier in this effort.
--
-- Same staff_admin_tier()-gated pattern (senior_admin/management only) as
-- the rest of this module - these touch financial and personal student/
-- employee data, same sensitivity tier as Salary/Users & Roles.
--
-- getFeeStructure()'s classFees fallback (used on web for legacy rows with
-- no fee_total snapshot) is NOT replicated here - those rows will show the
-- stored fee_total only (0 if genuinely absent). A real gap for very old
-- enrollments, acceptable for a condensed mobile view; the web report
-- remains the authoritative one for anything that needs the fallback.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Students (current + past years, condensed) ─────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_students(p_employee_id UUID)
RETURNS TABLE(
  o_enroll_no TEXT, o_name TEXT, o_roll INT, o_class TEXT, o_session TEXT,
  o_dob DATE, o_gender TEXT, o_father_name TEXT, o_mobile1 TEXT, o_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT se.enrollment_no, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')),
      se.roll_no, c.name, ay.label, s.dob, s.gender, s.father_name, s.mobile1, s.status
    FROM student_enrollments se
    JOIN students s ON s.id = se.student_id
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN academic_years ay ON ay.id = se.academic_year_id
    ORDER BY se.enrollment_no;
END;
$$;

-- ── Transfer Certificates Issued (condensed) ───────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_tc_issued(p_employee_id UUID)
RETURNS TABLE(
  o_tc_number TEXT, o_student_name TEXT, o_class TEXT, o_issue_date DATE,
  o_leaving_date DATE, o_reason TEXT, o_dues_cleared BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT tc.tc_number, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')),
      -- Enrollment the TC deactivated: the one with a deactivate_date, or
      -- the most recently joined one if none is flagged - same fallback
      -- the web version uses.
      (SELECT c.name FROM student_enrollments se LEFT JOIN classes c ON c.id = se.class_id
         WHERE se.student_id = s.id ORDER BY (se.deactivate_date IS NOT NULL) DESC, se.date_of_join DESC LIMIT 1),
      tc.issue_date, tc.leaving_date, tc.reason, tc.dues_cleared
    FROM transfer_certificates tc
    JOIN students s ON s.id = tc.student_id
    ORDER BY tc.leaving_date DESC;
END;
$$;

-- ── Fee Payments (all time, collection report) ─────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_payments(p_employee_id UUID)
RETURNS TABLE(o_date DATE, o_amount NUMERIC, o_student_name TEXT, o_enroll_no TEXT, o_class TEXT, o_session TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT fp.payment_date, fp.amount, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')),
      se.enrollment_no, c.name, ay.label
    FROM fee_payments fp
    JOIN student_enrollments se ON se.id = fp.enrollment_id
    JOIN students s ON s.id = se.student_id
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN academic_years ay ON ay.id = se.academic_year_id
    ORDER BY fp.payment_date DESC NULLS LAST;
END;
$$;

-- ── Fees (current academic year) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_fees(p_employee_id UUID)
RETURNS TABLE(
  o_enroll_no TEXT, o_name TEXT, o_class TEXT,
  o_total_fee NUMERIC, o_discount NUMERIC, o_total_paid NUMERIC, o_pending NUMERIC, o_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT se.enrollment_no, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), c.name,
      COALESCE(se.fee_total, 0), COALESCE(se.fee_discount, 0), paid.total_paid,
      GREATEST(COALESCE(se.fee_total, 0) - COALESCE(se.fee_discount, 0) - paid.total_paid, 0),
      CASE
        WHEN GREATEST(COALESCE(se.fee_total, 0) - COALESCE(se.fee_discount, 0) - paid.total_paid, 0) <= 0 THEN 'Fully Paid'
        WHEN paid.total_paid = 0 THEN 'Pending'
        ELSE 'Partial'
      END
    FROM student_enrollments se
    JOIN students s ON s.id = se.student_id
    LEFT JOIN classes c ON c.id = se.class_id
    JOIN academic_years ay ON ay.id = se.academic_year_id AND ay.is_current IS TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(fp.amount), 0) AS total_paid FROM fee_payments fp WHERE fp.enrollment_id = se.id
    ) paid ON TRUE
    ORDER BY se.roll_no;
END;
$$;

-- ── Fees — Super Admin variant (current year, discount reason surfaced) ───
CREATE OR REPLACE FUNCTION staff_admin_report_fees_super_admin(p_employee_id UUID)
RETURNS TABLE(
  o_enroll_no TEXT, o_name TEXT, o_class TEXT,
  o_total_fee NUMERIC, o_discount NUMERIC, o_discount_reason TEXT, o_total_paid NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) <> 'management' THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT se.enrollment_no, TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), c.name,
      COALESCE(se.fee_total, 0), COALESCE(se.fee_discount, 0), se.discount_reason, paid.total_paid
    FROM student_enrollments se
    JOIN students s ON s.id = se.student_id
    LEFT JOIN classes c ON c.id = se.class_id
    JOIN academic_years ay ON ay.id = se.academic_year_id AND ay.is_current IS TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(fp.amount), 0) AS total_paid FROM fee_payments fp WHERE fp.enrollment_id = se.id
    ) paid ON TRUE
    ORDER BY se.roll_no;
END;
$$;

-- ── Employees ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_employees(p_employee_id UUID)
RETURNS TABLE(
  o_name TEXT, o_role TEXT, o_subject TEXT, o_mobile TEXT, o_email TEXT,
  o_salary NUMERIC, o_join_date DATE, o_status TEXT, o_type TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT e.name, COALESCE(e.designation, e.type), COALESCE(
        (SELECT string_agg(elem->>'subject', ', ') FROM jsonb_array_elements(e.subject_mappings) elem),
        e.department, '-'
      ),
      e.phone, e.email,
      CASE WHEN staff_admin_tier(p_employee_id) = 'management' THEN sal.latest_amount ELSE NULL END,
      e.joining_date, COALESCE(e.status, 'Active'), e.type
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT sp.amount AS latest_amount FROM salary_payments sp
      WHERE sp.employee_id = e.id ORDER BY sp.month DESC LIMIT 1
    ) sal ON TRUE
    ORDER BY e.name;
END;
$$;

-- ── Inventory (stock items + assets combined) ──────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_report_inventory(p_employee_id UUID)
RETURNS TABLE(
  o_name TEXT, o_category TEXT, o_location TEXT, o_status TEXT,
  o_assigned_to TEXT, o_available INT, o_purchase_date DATE
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT
      i.name, INITCAP(COALESCE(i.category, 'Other')), COALESCE(i.storage_address, '-'),
      CASE
        WHEN (COALESCE(bat.total_in,0) - COALESCE(usg.total_used,0)) <= 0 THEN 'Out of Stock'
        WHEN (COALESCE(bat.total_in,0) - COALESCE(usg.total_used,0)) <= i.low_stock_at THEN 'Low Stock'
        ELSE 'In Stock'
      END,
      '-'::TEXT,
      (COALESCE(bat.total_in,0) - COALESCE(usg.total_used,0))::INT,
      i.created_at::DATE
    FROM inventory_items i
    LEFT JOIN LATERAL (SELECT SUM(b.qty) AS total_in FROM inventory_batches b WHERE b.item_id = i.id) bat ON TRUE
    LEFT JOIN LATERAL (SELECT SUM(u.qty) AS total_used FROM inventory_usages u WHERE u.item_id = i.id) usg ON TRUE

    UNION ALL

    SELECT
      a.name || COALESCE(' (' || a.brand || ')', ''), 'Asset', COALESCE(a.storage_address, '-'),
      CASE WHEN co.taken_by IS NOT NULL THEN 'In Use' ELSE 'Available' END,
      COALESCE(co.taken_by, '-'), NULL::INT, a.created_at::DATE
    FROM assets a
    LEFT JOIN LATERAL (
      SELECT c.taken_by FROM asset_checkouts c WHERE c.asset_id = a.id AND c.return_date IS NULL LIMIT 1
    ) co ON TRUE
    ORDER BY 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_report_students(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_tc_issued(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_payments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_fees(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_fees_super_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_employees(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_report_inventory(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_report_students(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_tc_issued(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_payments(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_fees(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_fees_super_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_employees(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_report_inventory(UUID) TO anon, authenticated;
