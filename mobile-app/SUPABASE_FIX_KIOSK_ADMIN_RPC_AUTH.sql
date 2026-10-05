-- REQ-SEC-012 (2026-10-04 full-codebase audit) - deeper finding while
-- fixing the audit's original scope (the /api/kiosk-settings Next.js
-- route). Applied live via mcp__supabase__apply_migration as
-- req_sec_012_kiosk_admin_rpcs_auth_gate.
--
-- /api/kiosk-settings has a direct-RPC fallback path, and these 5 RPCs
-- had ZERO auth check inside their own function bodies - gating only the
-- Next.js route (also fixed this session, see admin-panel/src/lib/
-- apiAuth.js) would have left these directly callable with the public
-- anon key, bypassing the route entirely. Same bug class already fixed
-- once on set_kiosk_admin_pin/generate_punch_code (REQ-SEC-007 item 2).
-- Confirmed via grep that only kioskSettingsService.js (admin panel web,
-- no mobile caller) calls any of these 5, so an is_admin_user() gate
-- cannot break any mobile flow.

CREATE OR REPLACE FUNCTION public.save_kiosk_settings(
  p_expected_start_time time without time zone,
  p_late_grace_minutes integer,
  p_absent_cutoff_time time without time zone,
  p_shift_end_time time without time zone
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.kiosk_settings SET
    expected_start_time = p_expected_start_time,
    late_grace_minutes  = GREATEST(p_late_grace_minutes, 0),
    absent_cutoff_time  = p_absent_cutoff_time,
    shift_end_time      = p_shift_end_time,
    updated_at          = now()
  WHERE id IS NOT NULL;

  PERFORM recompute_late_arrivals_for_date((now() AT TIME ZONE 'Asia/Kolkata')::DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_kiosk_special_day(
  p_date text,
  p_expected_start_time time without time zone,
  p_late_grace_minutes integer,
  p_absent_cutoff_time time without time zone,
  p_shift_end_time time without time zone,
  p_reason text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_date::DATE < (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'special_day_in_past';
  END IF;

  INSERT INTO kiosk_special_day_overrides
    (date, expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, reason, created_by)
  VALUES
    (p_date::DATE, p_expected_start_time,
     CASE WHEN p_late_grace_minutes IS NULL THEN NULL ELSE GREATEST(p_late_grace_minutes, 0) END,
     p_absent_cutoff_time, p_shift_end_time, p_reason, auth.uid())
  ON CONFLICT (date) DO UPDATE SET
    expected_start_time = EXCLUDED.expected_start_time,
    late_grace_minutes  = EXCLUDED.late_grace_minutes,
    absent_cutoff_time  = EXCLUDED.absent_cutoff_time,
    shift_end_time      = EXCLUDED.shift_end_time,
    reason               = EXCLUDED.reason,
    updated_at           = now();

  PERFORM recompute_late_arrivals_for_date(p_date::DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_kiosk_special_day(p_date text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM kiosk_special_day_overrides WHERE date = p_date::DATE;
  PERFORM recompute_late_arrivals_for_date(p_date::DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_kiosk_admin_settings()
RETURNS TABLE(
  o_expected_start_time time without time zone,
  o_late_grace_minutes integer,
  o_absent_cutoff_time time without time zone,
  o_shift_end_time time without time zone,
  o_pin_is_set boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, admin_pin_hash IS NOT NULL
    FROM kiosk_settings LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_kiosk_special_days()
RETURNS TABLE(
  o_date date,
  o_expected_start_time time without time zone,
  o_late_grace_minutes integer,
  o_absent_cutoff_time time without time zone,
  o_shift_end_time time without time zone,
  o_reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT date, expected_start_time, late_grace_minutes, absent_cutoff_time, shift_end_time, reason
    FROM kiosk_special_day_overrides
    WHERE date >= (now() AT TIME ZONE 'Asia/Kolkata')::DATE
    ORDER BY date ASC;
END;
$$;

-- Verified live same session via role-simulated rolled-back transactions:
--   anon (no session) calling save_kiosk_settings -> 'Not authorized'
--   real senior_admin (role-simulated via request.jwt.claim.sub) calling
--   get_kiosk_admin_settings -> succeeds, data unchanged
