-- ─────────────────────────────────────────────────────────────────────────────
-- Sibling profile switcher (Student app). A family often has 2-3 children
-- enrolled here, each with their own separate login - this lets a student
-- switch to a linked sibling's profile in-app, no second password needed.
--
-- student_siblings already existed (schema.sql) but was purely cosmetic:
-- sibling_name/sibling_class are free text typed on the admin panel's Add/
-- Edit Student form, never linked to the sibling's actual student_id. This
-- adds that real link as a nullable column - old free-text-only rows keep
-- displaying fine in the admin panel; only rows where this is populated
-- become switchable in the app.
--
-- Same trust model as student_login/teacher_login: no Supabase Auth session
-- exists in this app, just anon-key RPC calls that return a JSON profile
-- blob the client caches locally. The actual security boundary for
-- get_sibling_profile is that it only ever returns data for a target
-- student when a student_siblings row genuinely links the two ids (set by
-- an admin who verified the relationship at enrollment) - it is not an
-- open "fetch any student by id" RPC.
--
-- Run this in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE student_siblings
  ADD COLUMN IF NOT EXISTS sibling_student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_siblings_sibling_student ON student_siblings(sibling_student_id);

-- Every linked sibling for a given student, resolved to "the other side" of
-- each student_siblings row (a row can name either student as student_id),
-- deduped, current-enrollment class/section attached for display. Only
-- rows with sibling_student_id populated count - a free-text-only row (no
-- real link yet) contributes nothing here.
CREATE OR REPLACE FUNCTION get_linked_siblings(p_student_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_result FROM (
    SELECT DISTINCT ON (s.id)
      s.id, s.first_name, s.last_name, s.photo_url,
      c.name AS class_name, sec.name AS section_name
    FROM student_siblings ss
    JOIN students s ON s.id = CASE
      WHEN ss.student_id = p_student_id THEN ss.sibling_student_id
      ELSE ss.student_id
    END
    LEFT JOIN student_enrollments se ON se.student_id = s.id
    LEFT JOIN academic_years ay ON ay.id = se.academic_year_id AND ay.is_current = true
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN sections sec ON sec.id = se.section_id
    WHERE (ss.student_id = p_student_id OR ss.sibling_student_id = p_student_id)
      AND ss.sibling_student_id IS NOT NULL
      AND s.id != p_student_id
      AND s.status = 'Active'
  ) t;
  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- Returns the target student's full login-equivalent profile JSON (same
-- shape student_login returns), but only if student_siblings actually
-- links p_current_student_id <-> p_target_student_id. No password check -
-- the link itself, established by an admin, is the trust boundary.
CREATE OR REPLACE FUNCTION get_sibling_profile(p_current_student_id UUID, p_target_student_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_linked     BOOLEAN;
  v_student    students%ROWTYPE;
  v_enrollment student_enrollments%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM student_siblings
    WHERE sibling_student_id IS NOT NULL
      AND (
        (student_id = p_current_student_id AND sibling_student_id = p_target_student_id) OR
        (student_id = p_target_student_id AND sibling_student_id = p_current_student_id)
      )
  ) INTO v_linked;
  IF NOT v_linked THEN RETURN NULL; END IF;

  SELECT * INTO v_student FROM students WHERE id = p_target_student_id AND status = 'Active';
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_enrollment FROM student_enrollments
  WHERE student_id = p_target_student_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_enrollment.class_id IS NOT NULL THEN
    SELECT c.name INTO v_cls_name FROM classes c WHERE c.id = v_enrollment.class_id;
  END IF;
  IF v_enrollment.section_id IS NOT NULL THEN
    SELECT sec.name INTO v_sec_name FROM sections sec WHERE sec.id = v_enrollment.section_id;
  END IF;

  RETURN json_build_object(
    'id',            v_student.id,
    'first_name',    v_student.first_name,
    'last_name',     v_student.last_name,
    'grno',          v_student.grno,
    'photo_url',     v_student.photo_url,
    'dob',           v_student.dob,
    'gender',        v_student.gender,
    'father_name',   v_student.father_name,
    'mother_name',   v_student.mother_name,
    'mobile1',       v_student.mobile1,
    'address',       v_student.address,
    'enrollment_no', v_enrollment.enrollment_no,
    'roll_no',       v_enrollment.roll_no,
    'class_id',      v_enrollment.class_id,
    'section_id',    v_enrollment.section_id,
    'class_name',    v_cls_name,
    'section_name',  v_sec_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_linked_siblings(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_sibling_profile(UUID, UUID) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running: test directly before relying on the apps.
--   SELECT get_linked_siblings('<a real student id>');
--   SELECT get_sibling_profile('<student A id>', '<student B id>');  -- NULL until linked
-- Link two students as siblings via the admin panel (Add/Edit Student ->
-- "Sibling at This School"), then re-run get_sibling_profile with their
-- ids in both directions - both should now return JSON, not NULL.
-- ─────────────────────────────────────────────────────────────────────────────
