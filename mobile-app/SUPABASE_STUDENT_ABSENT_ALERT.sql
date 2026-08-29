-- Automatically drops a student_alerts row (the same in-app bell/popup
-- table admin_reset_student_password already writes to, see
-- SUPABASE_HASH_APP_PASSWORD.sql) whenever a student_attendance row is
-- saved with status = 'A' (Absent) - covers both the teacher app's
-- full-roster upsert (saveAttendanceBatch) and the admin panel's
-- (saveAttendanceForClassDate), since both write to the same table and a
-- DB trigger is the one place that sees every writer without duplicating
-- diff logic in two separate codebases.
--
-- Guarded so a re-save that keeps the same student at 'A' (e.g. the
-- teacher reopens the page and hits Save again with nothing changed)
-- does NOT re-notify - only a genuine transition INTO 'A' fires it.
-- SECURITY DEFINER because student_alerts only grants SELECT to anon
-- (see SUPABASE_HASH_APP_PASSWORD.sql) - the trigger needs to insert as
-- the function owner, same as admin_reset_student_password does.

CREATE OR REPLACE FUNCTION notify_student_absent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'A' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'A') THEN
    INSERT INTO student_alerts (student_id, title, message)
    VALUES (
      NEW.student_id,
      'Absent Today',
      'You were marked absent on ' || to_char(NEW.date, 'DD Mon YYYY') || '. If this is incorrect, please contact your class teacher.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_absent ON student_attendance;
CREATE TRIGGER trg_notify_student_absent
AFTER INSERT OR UPDATE ON student_attendance
FOR EACH ROW EXECUTE FUNCTION notify_student_absent();
