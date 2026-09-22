-- REQ-SEC-002, Category 1 of the mobile-tables remediation plan
-- (governance/planning/REQ-SEC-002-MOBILE-TABLES-PLAN.md), applied 2026-09-19.
-- cron_secrets, employee_punch_codes, kiosk_qr_sessions, kiosk_settings are
-- touched by NO Flutter .from() call anywhere in mobile-app/lib (confirmed
-- by grep) -- all access goes through SECURITY DEFINER RPCs already gated
-- by REQ-SEC-007/009/010 (auto_mark_absent_staff, generate_punch_code,
-- get_kiosk_public_settings, verify_kiosk_admin_pin, generate_qr_session,
-- check_qr_session, redeem_qr_session, lookup_punch_code, redeem_punch_code).
-- Confirmed live before applying: no anon/authenticated grants existed on
-- any of the 4. Same shape as Tranche 1 (req_sec_002_lock_admin_only_tables):
-- enable RLS + is_admin_user()-gated FOR ALL policy, revoke stray anon
-- grants (none existed, applied for defense in depth / future-proofing).
-- Verified live afterward: anon gets "permission denied" on all 4.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cron_secrets', 'employee_punch_codes', 'kiosk_qr_sessions', 'kiosk_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user())',
      'admin staff manage ' || t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
