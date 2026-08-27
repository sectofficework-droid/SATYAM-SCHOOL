-- ─────────────────────────────────────────────────────────────────────────────
-- Fix a privilege-escalation bug in SUPABASE_IMPERSONATION.sql: PostgreSQL
-- grants EXECUTE on every newly created function to PUBLIC by default. That
-- migration only ever added GRANTs (to authenticated/anon) and never
-- REVOKEd the default PUBLIC grant - so even the two internal helper
-- functions (_impersonation_employee_json / _impersonation_student_json),
-- which have no authorization check of their own because they're only
-- meant to be called from inside redeem_impersonation_code, were callable
-- by anyone holding nothing but the public anon key. Confirmed exploitable
-- live: `anon.rpc('_impersonation_employee_json', {p_employee_id: <any id>})`
-- returned a real teacher's full profile with no code, no login, nothing.
--
-- This revokes the implicit PUBLIC grant from all five impersonation
-- functions and re-asserts only the intended grants, so:
--   - the two internal helpers are callable by NOBODY over the API
--     (not even authenticated admin sessions - only from inside the
--     other SECURITY DEFINER functions in this same migration)
--   - create_impersonation_code / get_impersonation_audit_log stay
--     authenticated-only (their own internal role check still applies too)
--   - redeem_impersonation_code stays anon-callable (that's intentional -
--     the mobile app has no Supabase Auth session at all), gated by the
--     code itself, not by role
--
-- Run this in Supabase Dashboard -> SQL Editor, top to bottom, once.
-- Idempotent - safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION _impersonation_employee_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION _impersonation_student_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_impersonation_code(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_impersonation_code(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_impersonation_audit_log(INT) FROM PUBLIC;

-- Also explicitly revoke from anon/authenticated where they were never
-- meant to have access, then re-assert the intended grants exactly.
REVOKE EXECUTE ON FUNCTION _impersonation_employee_json(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION _impersonation_student_json(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION create_impersonation_code(TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION get_impersonation_audit_log(INT) FROM anon;

GRANT EXECUTE ON FUNCTION create_impersonation_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_impersonation_code(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_impersonation_audit_log(INT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running, verify with the anon key (should now be rejected/blocked,
-- not return data):
--   SELECT _impersonation_employee_json('<any real employee id>');
--   -- expect: permission denied for function _impersonation_employee_json
-- ─────────────────────────────────────────────────────────────────────────────
