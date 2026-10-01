-- ─────────────────────────────────────────────────────────────────────────────
-- Staff Attendance — sync-absent exclusions
--
-- Problem: /api/staff-attendance/sync-absent auto-inserts an "Absent" row for
-- today for every active employee who hasn't punched in by the cutoff time.
-- It runs on every report load (getStaffAttendanceForReport). If an admin
-- deletes today's auto-marked "Absent" row via the Report page, the very
-- next report refresh calls sync-absent again, sees that employee missing a
-- row for today, and silently re-inserts it - the deleted row comes right
-- back, making "Delete" look broken.
--
-- Fix: when the admin delete API removes an employee_attendance row dated
-- today, it also records an exclusion here. sync-absent skips anyone with an
-- exclusion for today, so the delete sticks for the rest of the day. A new
-- day is a new row in this table (or none, if the employee punches in) - this
-- table is never backfilled or consulted for past dates.
--
-- Run this in Supabase Dashboard → SQL Editor (or via an agent with DB access).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_attendance_sync_exclusions (
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, date)
);

-- Only the server (service_role, via /api/staff-attendance/delete and
-- /api/staff-attendance/sync-absent) ever reads or writes this table -
-- service_role bypasses RLS, and no client (admin panel browser session or
-- the mobile kiosk) has any legitimate reason to touch it directly. RLS is
-- enabled with zero policies, so every other role is denied by default.
ALTER TABLE employee_attendance_sync_exclusions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- admin_delete_staff_attendance RPC fallback (only used when
-- SUPABASE_SERVICE_ROLE_KEY is not configured in the deployment - see
-- SUPABASE_DELETE_STAFF_ATTENDANCE.sql) now records the same exclusions as
-- the primary service-role delete path in route.js, so both paths behave
-- identically.
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
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
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

      IF (v_item->>'date')::date = v_today THEN
        INSERT INTO employee_attendance_sync_exclusions (employee_id, date)
        VALUES ((v_item->>'employeeId')::uuid, v_today)
        ON CONFLICT (employee_id, date) DO NOTHING;
      END IF;

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

    IF p_date = v_today THEN
      INSERT INTO employee_attendance_sync_exclusions (employee_id, date)
      SELECT unnest(p_employee_ids), v_today
      ON CONFLICT (employee_id, date) DO NOTHING;
    END IF;

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

    IF p_date = v_today THEN
      INSERT INTO employee_attendance_sync_exclusions (employee_id, date)
      VALUES (p_employee_id, v_today)
      ON CONFLICT (employee_id, date) DO NOTHING;
    END IF;

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

    IF v_today = ANY(p_dates) THEN
      INSERT INTO employee_attendance_sync_exclusions (employee_id, date)
      VALUES (p_employee_id, v_today)
      ON CONFLICT (employee_id, date) DO NOTHING;
    END IF;

    RETURN jsonb_build_object('success', true, 'count', array_length(p_dates, 1));
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'No matching parameters provided');
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_staff_attendance(uuid[], date, uuid, date[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_staff_attendance(uuid[], date, uuid, date[], jsonb) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- auto_mark_absent_staff - the THIRD place that auto-marks absence (besides
-- sync-absent's route and this file's RPC fallback above): the Vercel daily
-- cron (/api/cron/mark-staff-absent) calls the 2-arg, secret-protected
-- overload. Live-testing this fix turned up that BOTH overloads needed the
-- same exclusion check - without it, a delete could still be silently
-- undone by whichever of the three paths ran next. The 1-arg overload below
-- has no secret check at all and is granted to anon (confirmed via
-- has_function_privilege) - no caller for it was found anywhere in this
-- repo (mobile-app or admin-panel).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_mark_absent_staff(p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_settings kiosk_settings%ROWTYPE;
  v_count INT;
BEGIN
  SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
  IF v_settings.absent_cutoff_time IS NULL THEN
    RETURN 0;
  END IF;
  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.absent_cutoff_time THEN
    RETURN 0;
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status)
  SELECT e.id, p_date, 'A'
  FROM employees e
  WHERE e.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = p_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance_sync_exclusions x WHERE x.employee_id = e.id AND x.date = p_date
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_mark_absent_staff(p_date date, p_secret text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_settings kiosk_settings%ROWTYPE;
  v_count INT;
  v_hash text;
BEGIN
  SELECT secret_hash INTO v_hash FROM cron_secrets WHERE name = 'mark_staff_absent';
  IF v_hash IS NULL OR p_secret IS NULL OR crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
  IF v_settings.absent_cutoff_time IS NULL THEN
    RETURN 0;
  END IF;
  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.absent_cutoff_time THEN
    RETURN 0;
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status)
  SELECT e.id, p_date, 'A'
  FROM employees e
  WHERE e.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = p_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance_sync_exclusions x WHERE x.employee_id = e.id AND x.date = p_date
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Closes REQ-SEC-010 item 2 (TODO.md) for real: the 2026-09-19 fix added the
-- secret-protected overload above but never dropped the original
-- auto_mark_absent_staff(p_date) - Postgres function overloading let both
-- signatures coexist, so the unsecured one (no auth check, granted to anon)
-- stayed live and callable by anyone with the public anon key. Confirmed no
-- caller anywhere in this repo (mobile-app or admin-panel; only the cron
-- route above calls the secured 2-arg form) and no DB-internal dependents
-- (no trigger, no other function references it) before dropping.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.auto_mark_absent_staff(date);
