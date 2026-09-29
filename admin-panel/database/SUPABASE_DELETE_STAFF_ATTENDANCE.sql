-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Staff Attendance & Shift Deletion RPC
--
-- Deletes attendance records from BOTH employee_shifts and employee_attendance
-- atomically with SECURITY DEFINER privileges.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_delete_staff_attendance(
  p_employee_ids uuid[] DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_dates date[] DEFAULT NULL,
  p_items jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_item jsonb;
BEGIN
  -- Case 1: Multiple items [{ employeeId, date }, ...]
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      DELETE FROM employee_shifts
      WHERE employee_id = (v_item->>'employeeId')::uuid
        AND date = (v_item->>'date')::date;

      DELETE FROM employee_attendance
      WHERE employee_id = (v_item->>'employeeId')::uuid
        AND date = (v_item->>'date')::date;

      v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'count', v_count);
  END IF;

  -- Case 2: Multiple employee_ids on a single date
  IF p_employee_ids IS NOT NULL AND array_length(p_employee_ids, 1) > 0 AND p_date IS NOT NULL THEN
    DELETE FROM employee_shifts
    WHERE employee_id = ANY(p_employee_ids)
      AND date = p_date;

    DELETE FROM employee_attendance
    WHERE employee_id = ANY(p_employee_ids)
      AND date = p_date;

    RETURN jsonb_build_object('success', true, 'count', array_length(p_employee_ids, 1));
  END IF;

  -- Case 3: Single employee on a single date
  IF p_employee_id IS NOT NULL AND p_date IS NOT NULL THEN
    DELETE FROM employee_shifts
    WHERE employee_id = p_employee_id
      AND date = p_date;

    DELETE FROM employee_attendance
    WHERE employee_id = p_employee_id
      AND date = p_date;

    RETURN jsonb_build_object('success', true, 'count', 1);
  END IF;

  -- Case 4: Single employee with a list of dates
  IF p_employee_id IS NOT NULL AND p_dates IS NOT NULL AND array_length(p_dates, 1) > 0 THEN
    DELETE FROM employee_shifts
    WHERE employee_id = p_employee_id
      AND date = ANY(p_dates);

    DELETE FROM employee_attendance
    WHERE employee_id = p_employee_id
      AND date = ANY(p_dates);

    RETURN jsonb_build_object('success', true, 'count', array_length(p_dates, 1));
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No matching parameters provided');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_staff_attendance(uuid[], date, uuid, date[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_staff_attendance(uuid[], date, uuid, date[], jsonb) TO authenticated, anon;
