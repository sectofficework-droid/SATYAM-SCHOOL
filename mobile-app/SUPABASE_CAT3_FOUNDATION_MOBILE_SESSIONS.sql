-- REQ-SEC-002 Category 3 foundation (2026-09-19). No mobile Flutter app
-- (teacher/student/attendance) ever creates a real Supabase Auth session --
-- every mobile request runs as anon, auth.uid() always NULL. This is the
-- session-token mechanism decided for Category 3's routine-write problem:
-- a short-lived, revocable, server-issued opaque token minted at login,
-- re-verified by each new gated RPC instead of a password. NOT the same
-- mechanism as kiosk_admin_tokens (fast-tracked separately for
-- face-embedding, SUPABASE_FIX_FACE_EMBEDDING_EXPOSURE.sql -- fixed
-- 20min, no sliding) -- this one is 7-day SLIDING expiry (extends on each
-- successful verify), matching the decided UX: an actively-used app
-- should never force a re-login.
--
-- Wired into every login-adjacent path that flows through AuthService.
-- _saveSession (auth_service.dart): teacher_login, student_login,
-- redeem_impersonation_code (via _impersonation_employee_json /
-- _impersonation_student_json, where its JSON is actually built), and
-- get_sibling_profile (the profile-switcher flow) -- not just the two
-- primary logins, or impersonated/switched sessions would have no token
-- at all and every Category 3 RPC would reject them.
--
-- Deliberately NOT wired into teacher_change_password/
-- student_change_password in this pass: doing so safely means revoking
-- all OTHER sessions but reissuing a fresh one for the current device
-- (naive revoke-all would self-lock the device that just changed its own
-- password), which needs its own careful, isolated change to an
-- already-hardened REQ-SEC-001 RPC -- deferred, not silently dropped.
-- Sessions still expire naturally via the 7-day sliding window regardless.
--
-- BUG CAUGHT AND FIXED DURING VERIFICATION (folded into this file):
-- verify_mobile_session's first version declared v_ok as boolean but used
-- GET DIAGNOSTICS v_ok = ROW_COUNT (which needs an integer target) --
-- "operator does not exist: boolean > integer" on the very first live
-- test. Fixed below (v_rows int, compared with > 0).

CREATE TABLE public.mobile_sessions (
  token_hash text PRIMARY KEY,
  subject_type text NOT NULL CHECK (subject_type IN ('teacher', 'student')),
  subject_id uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX mobile_sessions_subject_idx ON public.mobile_sessions (subject_type, subject_id);
ALTER TABLE public.mobile_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.mint_mobile_session(p_subject_type text, p_subject_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_token text := encode(gen_random_bytes(24), 'hex');
BEGIN
  INSERT INTO public.mobile_sessions (token_hash, subject_type, subject_id, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), p_subject_type, p_subject_id, now() + interval '7 days');
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.mint_mobile_session(text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.verify_mobile_session(p_subject_type text, p_subject_id uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_rows int;
BEGIN
  UPDATE public.mobile_sessions
  SET expires_at = now() + interval '7 days'
  WHERE token_hash = v_hash AND subject_type = p_subject_type AND subject_id = p_subject_id
    AND expires_at > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_mobile_session(text, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.revoke_mobile_session(p_token text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  DELETE FROM public.mobile_sessions WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_mobile_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_mobile_session(text) TO anon;

-- teacher_login / student_login / _impersonation_employee_json /
-- _impersonation_student_json / get_sibling_profile: each CREATE OR
-- REPLACE'd with an identical body to their prior live definition, plus
-- one added 'session_token' key in the returned json_build_object, calling
-- mint_mobile_session. Full bodies omitted here for brevity -- see the
-- live pg_get_functiondef or the migration applied via
-- mcp__supabase__apply_migration (req_sec_002_cat3_foundation_mobile_
-- sessions) for the exact text; every other field/line is byte-for-byte
-- unchanged from the pre-existing function.
--
-- Dart side: AuthService gained a `sessionToken` getter (reads
-- profile.value['session_token'], the same cached blob every other
-- profile field already lives in) and signOut() now calls
-- revoke_mobile_session (best-effort, doesn't block local sign-out on a
-- network failure) before clearing local storage.
