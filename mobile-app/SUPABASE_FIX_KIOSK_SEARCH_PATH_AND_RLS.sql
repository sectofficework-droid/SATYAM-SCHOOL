-- REQ-SEC-017 / REQ-SEC-018 (2026-10-04 full-codebase audit)
-- Applied live via mcp__supabase__apply_migration as
-- req_sec_017_018_search_path_and_kiosk_special_day_rls.
--
-- REQ-SEC-018: 17 functions (mostly newer kiosk RPCs) had a mutable
-- search_path (WARN-level live advisory) - same bug class already fixed
-- twice before by name (req_sec_007_fix_punch_code_search_path,
-- REQ-SEC-010 item 3) but this list had never been swept. Purely
-- additive - pins search_path, does not change function logic, grants,
-- or callers.
ALTER FUNCTION public.get_kiosk_public_settings() SET search_path TO 'public','extensions';
ALTER FUNCTION public.recompute_late_arrivals_for_date(p_date date) SET search_path TO 'public','extensions';
ALTER FUNCTION public.save_kiosk_special_day(p_date text, p_expected_start_time time without time zone, p_late_grace_minutes integer, p_absent_cutoff_time time without time zone, p_shift_end_time time without time zone, p_reason text) SET search_path TO 'public','extensions';
ALTER FUNCTION public.delete_kiosk_special_day(p_date text) SET search_path TO 'public','extensions';
ALTER FUNCTION public.redeem_punch_code(p_code text, p_date date, p_check_in_at timestamp with time zone) SET search_path TO 'public','extensions';
ALTER FUNCTION public.redeem_qr_session(p_code text, p_employee_id uuid, p_date date, p_check_in_at timestamp with time zone) SET search_path TO 'public','extensions';
ALTER FUNCTION public.lookup_punch_code(p_code text) SET search_path TO 'public','extensions';
ALTER FUNCTION public.generate_qr_session() SET search_path TO 'public','extensions';
ALTER FUNCTION public.record_check_out(p_employee_id uuid, p_check_out_at timestamp with time zone) SET search_path TO 'public','extensions';
ALTER FUNCTION public.check_qr_session(p_code text) SET search_path TO 'public','extensions';
ALTER FUNCTION public.get_kiosk_admin_settings() SET search_path TO 'public','extensions';
ALTER FUNCTION public.auto_close_open_shifts() SET search_path TO 'public','extensions';
ALTER FUNCTION public.save_kiosk_settings(p_expected_start_time time without time zone, p_late_grace_minutes integer, p_absent_cutoff_time time without time zone, p_shift_end_time time without time zone) SET search_path TO 'public','extensions';
ALTER FUNCTION public.admin_delete_staff_attendance(p_employee_ids uuid[], p_date date, p_employee_id uuid, p_dates date[], p_items jsonb) SET search_path TO 'public','extensions';
ALTER FUNCTION public.get_effective_kiosk_settings(p_date date) SET search_path TO 'public','extensions';
ALTER FUNCTION public.list_kiosk_special_days() SET search_path TO 'public','extensions';
ALTER FUNCTION public.record_face_punch(p_employee_id uuid, p_date date, p_check_in_at timestamp with time zone) SET search_path TO 'public','extensions';

-- REQ-SEC-017: enable RLS on kiosk_special_day_overrides. anon/authenticated
-- already held zero grants on this table (SUPABASE_KIOSK_SPECIAL_DAY.sql
-- revokes them but never ran ENABLE ROW LEVEL SECURITY), so this is pure
-- hardening with no access-pattern change - confirmed before applying.
ALTER TABLE public.kiosk_special_day_overrides ENABLE ROW LEVEL SECURITY;

-- Verified live same session:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'kiosk_special_day_overrides'; -> true
--   SELECT proconfig FROM pg_proc WHERE proname IN (...) -> search_path=public, extensions on all 17
