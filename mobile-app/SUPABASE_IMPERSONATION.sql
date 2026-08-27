-- ─────────────────────────────────────────────────────────────────────────────
-- Admin "Access Code" impersonation module.
--
-- Lets a management/senior_admin user in the admin panel generate a
-- short-lived, single-use code for a specific student or teacher, which can
-- then be typed into the mobile app's login screen (instead of the normal
-- enrollment_no/emp_code + password) to log straight into that account -
-- full access, without ever knowing or touching their real app_password.
--
-- Mobile-app login is NOT Supabase Auth (see teacher_login/student_login in
-- SUPABASE_FIX_LOGIN_REGRESSION.sql) - it's an anon-callable RPC that
-- returns a JSON profile blob the app caches locally. This module follows
-- the same shape: redeem_impersonation_code returns the identical JSON
-- teacher_login/student_login would, so it drops straight into the app's
-- existing session-save code with no new session/token machinery needed.
--
-- Two tables:
--   impersonation_codes      - short-lived, opportunistically pruned.
--   impersonation_audit_log  - permanent, one row per lifecycle event
--                               (created / redeemed / redeem_failed),
--                               denormalized so history reads fine even
--                               after a token row is pruned or the
--                               target/admin row later changes.
--
-- Run this in Supabase Dashboard -> SQL Editor, top to bottom, once.
-- Idempotent - safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS impersonation_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL CHECK (target_type IN ('student','employee')),
  target_id   UUID NOT NULL,
  created_by  UUID NOT NULL REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_impersonation_codes_code ON impersonation_codes(code);
ALTER TABLE impersonation_codes DISABLE ROW LEVEL SECURITY;
-- No GRANTs to anon/authenticated - all access goes through the
-- SECURITY DEFINER functions below, which is where authorization lives.

CREATE TABLE IF NOT EXISTS impersonation_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id         UUID REFERENCES impersonation_codes(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('created','redeemed','redeem_failed')),
  target_type     TEXT,
  target_id       UUID,
  target_label    TEXT,
  created_by      UUID REFERENCES admin_users(id),
  created_by_name TEXT,
  detail          TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_occurred ON impersonation_audit_log(occurred_at DESC);
ALTER TABLE impersonation_audit_log DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal helpers - build the same JSON shape teacher_login/student_login
-- return, but by id instead of by credentials. Not granted to anon/
-- authenticated; deliberately don't touch the real login functions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _impersonation_employee_json(p_employee_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_emp        employees%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
  v_section_id UUID;
  v_is_support BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_section_id := v_emp.class_teacher_of_section_id;

  IF v_section_id IS NULL THEN
    SELECT section_id INTO v_section_id
    FROM section_supporting_teachers
    WHERE employee_id = v_emp.id
    ORDER BY created_at
    LIMIT 1;
    IF v_section_id IS NOT NULL THEN v_is_support := TRUE; END IF;
  END IF;

  IF v_section_id IS NOT NULL THEN
    SELECT c.name, sec.name INTO v_cls_name, v_sec_name
    FROM sections sec
    JOIN classes c ON c.id = sec.class_id
    WHERE sec.id = v_section_id;
  END IF;

  RETURN json_build_object(
    'id',                          v_emp.id,
    'emp_code',                    v_emp.emp_code,
    'name',                        v_emp.name,
    'type',                        v_emp.type,
    'designation',                 v_emp.designation,
    'department',                  v_emp.department,
    'phone',                       v_emp.phone,
    'email',                       v_emp.email,
    'photo_url',                   v_emp.photo_url,
    'class_teacher_of_section_id', v_section_id,
    'is_supporting_teacher',       v_is_support,
    'subject_mappings',            v_emp.subject_mappings,
    'class_name',                  v_cls_name,
    'section_name',                v_sec_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION _impersonation_student_json(p_student_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student    students%ROWTYPE;
  v_enrollment student_enrollments%ROWTYPE;
  v_cls_name   TEXT;
  v_sec_name   TEXT;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_enrollment FROM student_enrollments
  WHERE student_id = v_student.id
  ORDER BY created_at DESC
  LIMIT 1;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- create_impersonation_code - called from the admin panel (real Supabase
-- Auth session). Restricted to management/senior_admin at the function
-- level, not just the UI.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_impersonation_code(p_target_type TEXT, p_target_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role       TEXT;
  v_admin_name TEXT;
  v_label      TEXT;
  v_code       TEXT;
  v_id         UUID;
  v_alphabet   TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_expires    TIMESTAMPTZ := now() + interval '10 minutes';
BEGIN
  SELECT role, name INTO v_role, v_admin_name FROM admin_users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('management','senior_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_target_type NOT IN ('student','employee') THEN
    RAISE EXCEPTION 'Invalid target type';
  END IF;

  IF p_target_type = 'student' THEN
    SELECT first_name || ' ' || COALESCE(last_name,'') INTO v_label FROM students WHERE id = p_target_id;
  ELSE
    SELECT name INTO v_label FROM employees WHERE id = p_target_id;
  END IF;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Target not found'; END IF;

  -- opportunistic cleanup, keeps the token table small without a cron job
  DELETE FROM impersonation_codes
  WHERE (used_at IS NOT NULL OR expires_at < now()) AND created_at < now() - interval '1 day';

  LOOP
    v_code := (SELECT string_agg(substr(v_alphabet, (floor(random()*32)+1)::int, 1), '') FROM generate_series(1,8));
    BEGIN
      INSERT INTO impersonation_codes (code, target_type, target_id, created_by, expires_at)
      VALUES (v_code, p_target_type, p_target_id, auth.uid(), v_expires)
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- astronomically unlikely with 32^8 codes; loop and retry
    END;
  END LOOP;

  INSERT INTO impersonation_audit_log (code_id, event_type, target_type, target_id, target_label, created_by, created_by_name)
  VALUES (v_id, 'created', p_target_type, p_target_id, v_label, auth.uid(), v_admin_name);

  RETURN json_build_object('code', v_code, 'expires_at', v_expires, 'target_label', v_label);
END;
$$;
GRANT EXECUTE ON FUNCTION create_impersonation_code(TEXT, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- redeem_impersonation_code - called from the mobile app with the shared
-- anon key (same trust model as teacher_login/student_login). p_expected_role
-- comes from the app's own build-locked role (AppConfig.lockedRole), not
-- typed by the user, so a code can't be redeemed against the wrong app
-- build. Single-use claim is atomic (UPDATE ... WHERE used_at IS NULL
-- RETURNING) to close the check-then-act race a SELECT+UPDATE would have.
-- A role mismatch still burns the code - a wrong-app guess isn't retryable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_impersonation_code(p_code TEXT, p_expected_role TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code          TEXT := UPPER(TRIM(p_code));
  v_expected_type TEXT := CASE WHEN p_expected_role = 'teacher' THEN 'employee' ELSE 'student' END;
  v_row           impersonation_codes%ROWTYPE;
  v_existing      impersonation_codes%ROWTYPE;
  v_result        JSON;
  v_label         TEXT;
BEGIN
  UPDATE impersonation_codes SET used_at = now()
  WHERE code = v_code AND used_at IS NULL AND expires_at > now()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM impersonation_codes WHERE code = v_code;
    INSERT INTO impersonation_audit_log (code_id, event_type, detail)
    VALUES (v_existing.id,
            'redeem_failed',
            CASE WHEN v_existing.id IS NULL THEN 'not_found'
                 WHEN v_existing.used_at IS NOT NULL THEN 'already_used'
                 ELSE 'expired' END);
    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'Invalid code.';
    ELSIF v_existing.used_at IS NOT NULL THEN
      RAISE EXCEPTION 'This code has already been used.';
    ELSE
      RAISE EXCEPTION 'This code has expired.';
    END IF;
  END IF;

  IF v_row.target_type != v_expected_type THEN
    INSERT INTO impersonation_audit_log (code_id, event_type, target_type, target_id, detail)
    VALUES (v_row.id, 'redeem_failed', v_row.target_type, v_row.target_id, 'role_mismatch');
    IF v_expected_type = 'employee' THEN
      RAISE EXCEPTION 'This code is for a student account, not a teacher account.';
    ELSE
      RAISE EXCEPTION 'This code is for a teacher account, not a student account.';
    END IF;
  END IF;

  IF v_row.target_type = 'employee' THEN
    v_result := _impersonation_employee_json(v_row.target_id);
  ELSE
    v_result := _impersonation_student_json(v_row.target_id);
  END IF;

  IF v_result IS NULL THEN
    INSERT INTO impersonation_audit_log (code_id, event_type, target_type, target_id, detail)
    VALUES (v_row.id, 'redeem_failed', v_row.target_type, v_row.target_id, 'target_deleted');
    RAISE EXCEPTION 'This account no longer exists.';
  END IF;

  SELECT target_label INTO v_label FROM impersonation_audit_log
  WHERE code_id = v_row.id AND event_type = 'created' LIMIT 1;

  INSERT INTO impersonation_audit_log (code_id, event_type, target_type, target_id, target_label)
  VALUES (v_row.id, 'redeemed', v_row.target_type, v_row.target_id, v_label);

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION redeem_impersonation_code(TEXT, TEXT) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_impersonation_audit_log - for the admin panel's audit log tab.
-- Gated the same as create_impersonation_code.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_impersonation_audit_log(p_limit INT DEFAULT 200)
RETURNS SETOF impersonation_audit_log LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND role IN ('management','senior_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM impersonation_audit_log ORDER BY occurred_at DESC LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION get_impersonation_audit_log(INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running, sanity-check:
--   SELECT create_impersonation_code('student', '<a real student id>');
--   -- (must be run as an authenticated management/senior_admin session)
--   SELECT redeem_impersonation_code('<code from above>', 'student');
--   SELECT * FROM impersonation_audit_log ORDER BY occurred_at DESC LIMIT 5;
-- ─────────────────────────────────────────────────────────────────────────────
