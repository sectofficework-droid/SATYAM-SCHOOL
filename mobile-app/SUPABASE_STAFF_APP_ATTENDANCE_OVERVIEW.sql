-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace, slice 3 of "port remaining web admin modules":
-- Attendance Overview (who's marked/not marked today) + bulk reminder
-- sending to class teachers. Ports the web Attendance page's Overview tab
-- (admin-panel/src/lib/attendanceService.js getAttendanceOverviewForDate/
-- sendBulkAttendanceReminders). The Holidays part of that same web tab needed
-- no new work - it's the same school_calendar_events table already wired up
-- for Year Planning (SUPABASE_STAFF_APP_SETTINGS_ADMIN.sql).
--
-- Entirely RPC-driven (not a direct-select split like earlier slices) -
-- `classes`, `sections`, `students`, `student_enrollments` and
-- `teacher_alerts` all have NO anon grants at all, so every piece of this
-- needs a SECURITY DEFINER join. staff_admin_tier()-gated, senior_admin/
-- management only (matches the web Attendance page's own admin-only scope).
--
-- Joins by class_id/section_id FKs (student_enrollments -> classes/
-- sections), not the name-string matching the web's getStudents() does -
-- the underlying schema is already normalized by id, so this is more
-- precise than the web version, not a looser approximation of it.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION staff_admin_attendance_overview(p_employee_id UUID, p_date DATE)
RETURNS TABLE(
  o_class_name TEXT, o_section_id UUID, o_section_name TEXT,
  o_teacher_id UUID, o_teacher_name TEXT,
  o_total_students INT, o_marked_count INT, o_status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY
    SELECT
      c.name, sec.id, sec.name,
      t.id, t.name,
      COUNT(se.id)::INT AS total_students,
      COUNT(sa.student_id)::INT AS marked_count,
      CASE
        WHEN COUNT(se.id) = 0 THEN 'Empty'
        WHEN COUNT(sa.student_id) = 0 THEN 'Not Marked'
        WHEN COUNT(sa.student_id) = COUNT(se.id) THEN 'Marked'
        ELSE 'Partial'
      END
    FROM classes c
    JOIN sections sec ON sec.class_id = c.id
    LEFT JOIN student_enrollments se ON se.section_id = sec.id AND se.deactivate_date IS NULL
    LEFT JOIN student_attendance sa ON sa.student_id = se.student_id AND sa.date = p_date
    LEFT JOIN employees t ON t.class_teacher_of_section_id = sec.id
    WHERE c.is_active IS NOT FALSE
    GROUP BY c.name, c.sort_order, sec.id, sec.name, t.id, t.name
    HAVING COUNT(se.id) > 0
    ORDER BY c.sort_order, sec.name;
END;
$$;

-- p_section_ids: sections to nudge (NULL/empty = every section with status
-- <> 'Marked'). Same dedup rule as the web version: skip a teacher who
-- already got today's reminder for that exact section.
CREATE OR REPLACE FUNCTION staff_admin_send_attendance_reminders(p_employee_id UUID, p_date DATE, p_section_ids UUID[])
RETURNS TABLE(o_sent INT, o_skipped INT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sent INT := 0;
  v_skipped INT := 0;
  r RECORD;
  v_title TEXT;
  v_already_sent BOOLEAN;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  FOR r IN
    SELECT * FROM staff_admin_attendance_overview(p_employee_id, p_date)
    WHERE o_status <> 'Marked' AND o_teacher_id IS NOT NULL
      AND (p_section_ids IS NULL OR array_length(p_section_ids, 1) IS NULL OR o_section_id = ANY(p_section_ids))
  LOOP
    v_title := 'Mark Attendance — ' || r.o_class_name || ' - ' || r.o_section_name;

    SELECT EXISTS(
      SELECT 1 FROM teacher_alerts
      WHERE teacher_id = r.o_teacher_id AND title = v_title
        AND created_at >= p_date::TIMESTAMPTZ AND created_at < (p_date + 1)::TIMESTAMPTZ
    ) INTO v_already_sent;

    IF v_already_sent THEN
      v_skipped := v_skipped + 1;
    ELSE
      INSERT INTO teacher_alerts (teacher_id, title, message)
      VALUES (r.o_teacher_id, v_title, 'Attendance for ' || r.o_class_name || ' - ' || r.o_section_name || ' on ' || p_date || ' has not been marked yet. Please mark it.');
      v_sent := v_sent + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_sent, v_skipped;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_attendance_overview(UUID, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_send_attendance_reminders(UUID, DATE, UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_attendance_overview(UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_send_attendance_reminders(UUID, DATE, UUID[]) TO anon, authenticated;
