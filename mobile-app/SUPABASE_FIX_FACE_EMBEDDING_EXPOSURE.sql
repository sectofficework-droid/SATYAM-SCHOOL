-- REQ-SEC-002 / Category 3 fast-track (2026-09-19). Found while tracing the
-- employees table for governance/planning/REQ-SEC-002-CATEGORY3-RPC-PLAN.md:
-- raw biometric face-embedding vectors for every enrolled staff member were
-- readable by ANY anon caller with the public anon key, no auth of any
-- kind (employees.face_embedding, table-level RLS still disabled). Treated
-- as urgent and fixed immediately, ahead of and separate from the larger
-- Category 3 session-token/RPC rollout (which is NOT started -- this fix
-- does not use the mobile_sessions design decided for that broader work;
-- it's a smaller, self-contained kiosk-admin-token mechanism scoped only
-- to face-embedding read/write).
--
-- Mechanism: teacher/student-style login doesn't apply here (kiosk admin
-- access is PIN-gated, not login-gated). verify_kiosk_admin_pin now mints a
-- short-lived (20 min, fixed) token on a correct PIN instead of returning a
-- bare bool; the token gates 4 new RPCs that replace direct table access.
--
-- CORRECTION included below (req_sec_002_fix_employees_column_grant): the
-- first attempt used a column-level REVOKE (REVOKE SELECT (face_embedding)
-- ... FROM anon), which turned out to have NO EFFECT -- confirmed live,
-- anon could still read the column afterward. Root cause: a column-level
-- REVOKE does nothing when the role already holds the TABLE-level grant
-- for that privilege (Postgres treats the column as already covered by
-- the table-level grant). Fixed properly below: revoke table-level SELECT
-- entirely, then re-grant SELECT on an explicit column list (every column
-- except face_embedding).

CREATE TABLE public.kiosk_admin_tokens (
  token_hash text PRIMARY KEY,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.kiosk_admin_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_admin_tokens FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_kiosk_admin_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM kiosk_admin_tokens
    WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') AND expires_at > now()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.verify_kiosk_admin_token(text) FROM PUBLIC;

-- Return type changes bool -> text (the token, or NULL on any failure), so
-- must be dropped and recreated rather than CREATE OR REPLACE'd. Lockout
-- logic (5 attempts / 15 min) is unchanged, copied exactly from the prior
-- live definition (REQ-SEC-010 item 3).
DROP FUNCTION public.verify_kiosk_admin_pin(text);

CREATE FUNCTION public.verify_kiosk_admin_pin(p_pin text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
  v_fail_count int;
  v_locked_until timestamptz;
  v_ok boolean;
  v_token text;
BEGIN
  SELECT admin_pin_hash, pin_fail_count, pin_locked_until
  INTO v_hash, v_fail_count, v_locked_until
  FROM kiosk_settings LIMIT 1;

  IF v_hash IS NULL THEN RETURN NULL; END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN NULL;
  END IF;

  v_ok := crypt(p_pin, v_hash) = v_hash;

  IF v_ok THEN
    UPDATE kiosk_settings SET pin_fail_count = 0, pin_locked_until = NULL WHERE id IS NOT NULL;
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO kiosk_admin_tokens (token_hash, expires_at)
    VALUES (encode(digest(v_token, 'sha256'), 'hex'), now() + interval '20 minutes');
    RETURN v_token;
  ELSE
    IF v_fail_count + 1 >= 5 THEN
      UPDATE kiosk_settings SET pin_fail_count = 0, pin_locked_until = now() + interval '15 minutes' WHERE id IS NOT NULL;
    ELSE
      UPDATE kiosk_settings SET pin_fail_count = v_fail_count + 1 WHERE id IS NOT NULL;
    END IF;
    RETURN NULL;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_kiosk_admin_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_kiosk_admin_pin(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kiosk_get_face_embeddings(p_token text)
RETURNS TABLE(id uuid, name text, face_embedding jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_kiosk_admin_token(p_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e.name, e.face_embedding
    FROM public.employees e
    WHERE e.face_embedding IS NOT NULL AND e.status <> 'Inactive';
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_get_face_embeddings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_get_face_embeddings(text) TO anon;

CREATE OR REPLACE FUNCTION public.kiosk_get_staff_for_enrollment(p_token text)
RETURNS TABLE(id uuid, name text, registered boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_kiosk_admin_token(p_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT e.id, e.name, (e.face_embedding IS NOT NULL) AS registered
    FROM public.employees e
    WHERE e.status <> 'Inactive'
    ORDER BY e.name;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_get_staff_for_enrollment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_get_staff_for_enrollment(text) TO anon;

CREATE OR REPLACE FUNCTION public.kiosk_save_face_embedding(p_token text, p_employee_id uuid, p_embeddings jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_kiosk_admin_token(p_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.employees
  SET face_embedding = p_embeddings, face_enrolled_at = now()
  WHERE id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_save_face_embedding(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_save_face_embedding(text, uuid, jsonb) TO anon;

CREATE OR REPLACE FUNCTION public.kiosk_delete_face_embedding(p_token text, p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.verify_kiosk_admin_token(p_token) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.employees
  SET face_embedding = NULL, face_enrolled_at = NULL
  WHERE id = p_employee_id;
END;
$$;
REVOKE ALL ON FUNCTION public.kiosk_delete_face_embedding(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_delete_face_embedding(text, uuid) TO anon;

-- CORRECTION (applied right after the above, same session): the initial
-- attempt here was REVOKE SELECT (face_embedding), UPDATE (face_embedding,
-- face_enrolled_at) ON employees FROM anon -- confirmed live to have NO
-- EFFECT (anon could still read raw face_embedding directly afterward).
-- Fixed by revoking the table-level grants entirely and re-granting an
-- explicit column list for SELECT (every column except face_embedding).
-- UPDATE is revoked outright, not column-restricted -- a full grep of
-- mobile-app/lib confirmed zero remaining direct anon UPDATE call sites on
-- employees once saveFaceEmbedding/deleteFaceEmbedding moved to the RPCs
-- above.
REVOKE SELECT ON public.employees FROM anon;
GRANT SELECT (
  id, emp_code, name, gender, dob, phone, alt_phone, email, address, aadhar,
  pan, type, designation, department, employment_type, joining_date, status,
  class_teacher_of_section_id, created_at, updated_at, photo_url,
  subject_mappings, documents, app_user_id, app_password, face_enrolled_at,
  monthly_salary, admin_user_id
) ON public.employees TO anon;
REVOKE UPDATE ON public.employees FROM anon;

-- Verified live afterward (role-simulated anon, rolled back): direct
-- `SELECT face_embedding FROM employees` -> permission denied; direct
-- `UPDATE employees ...` -> permission denied; other legitimate anon reads
-- (e.g. WHERE type = 'teaching', used by fetchOtherTeachers) still work;
-- kiosk_get_face_embeddings with a valid simulated token returns rows,
-- with a bogus token raises "Not authorized"; verify_kiosk_admin_pin with
-- a wrong PIN returns NULL (transaction rolled back, no real lockout state
-- touched). Dart side (supabase_service.dart, kiosk_pin_service.dart,
-- admin_pin_dialog.dart, kiosk_home_page.dart, staff_enroll_list_page.dart,
-- face_enroll_capture_page.dart) updated to thread the token through;
-- flutter analyze clean; attendance-flavor debug APK builds successfully.
-- NOT yet installed/tested on the physical kiosk device with the real PIN
-- -- needs the user to install app-attendance-debug.apk and confirm the
-- enrollment flow still works end-to-end.
