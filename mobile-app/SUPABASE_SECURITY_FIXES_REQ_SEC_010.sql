-- REQ-SEC-010 items 2 and 3, fixed 2026-09-19 (user follow-up: "complete
-- req 10" after the initial disclosure). See TODO.md REQ-SEC-010 for full
-- narrative, including a real bug caught in the first pass of this fix
-- (missing 'extensions' in search_path for crypt()).

-- Item 2: auto_mark_absent_staff was anon-callable directly, bypassing
-- the cron route's CRON_SECRET header check (that route uses the anon
-- key, not service_role). Gate with a dedicated DB-side shared secret.
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name        text PRIMARY KEY,
  secret_hash text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE public.cron_secrets FROM PUBLIC, anon, authenticated;

-- Seeded with a freshly-generated secret (not this project's existing
-- CRON_SECRET) - value given directly to the user in-session, set as
-- Vercel env var MARK_ABSENT_CRON_SECRET. Not recorded here.
-- INSERT INTO public.cron_secrets (name, secret_hash)
-- VALUES ('mark_staff_absent', crypt('<value given to user>', gen_salt('bf')))
-- ON CONFLICT (name) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, updated_at = now();

CREATE OR REPLACE FUNCTION public.auto_mark_absent_staff(p_date date, p_secret text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_settings kiosk_settings%ROWTYPE;
  v_count INT;
  v_hash text;
BEGIN
  SELECT secret_hash INTO v_hash FROM cron_secrets WHERE name = 'mark_staff_absent';
  IF v_hash IS NULL OR p_secret IS NULL OR crypt(p_secret, v_hash) <> v_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_settings FROM kiosk_settings LIMIT 1;
  IF v_settings.absent_cutoff_time IS NULL THEN
    RETURN 0;
  END IF;
  IF (now() AT TIME ZONE 'Asia/Kolkata')::TIME < v_settings.absent_cutoff_time THEN
    RETURN 0;
  END IF;

  INSERT INTO employee_attendance (employee_id, date, status)
  SELECT e.id, p_date, 'A'
  FROM employees e
  WHERE e.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM employee_attendance ea WHERE ea.employee_id = e.id AND ea.date = p_date
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Item 3: verify_kiosk_admin_pin had no rate-limiting - simple
-- fail-counter + lockout directly on kiosk_settings (single row).
ALTER TABLE public.kiosk_settings
  ADD COLUMN IF NOT EXISTS pin_fail_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

CREATE OR REPLACE FUNCTION public.verify_kiosk_admin_pin(p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_fail_count int;
  v_locked_until timestamptz;
  v_ok boolean;
BEGIN
  SELECT admin_pin_hash, pin_fail_count, pin_locked_until
  INTO v_hash, v_fail_count, v_locked_until
  FROM kiosk_settings LIMIT 1;

  IF v_hash IS NULL THEN RETURN FALSE; END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN FALSE;
  END IF;

  v_ok := crypt(p_pin, v_hash) = v_hash;

  IF v_ok THEN
    UPDATE kiosk_settings SET pin_fail_count = 0, pin_locked_until = NULL WHERE id IS NOT NULL;
  ELSE
    IF v_fail_count + 1 >= 5 THEN
      UPDATE kiosk_settings SET pin_fail_count = 0, pin_locked_until = now() + interval '15 minutes' WHERE id IS NOT NULL;
    ELSE
      UPDATE kiosk_settings SET pin_fail_count = v_fail_count + 1 WHERE id IS NOT NULL;
    END IF;
  END IF;

  RETURN v_ok;
END;
$function$;

-- set_kiosk_admin_pin also clears any active lockout when the PIN is
-- reset, so management isn't accidentally locked out right after
-- changing it.
CREATE OR REPLACE FUNCTION public.set_kiosk_admin_pin(p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'pin_too_short';
  END IF;
  UPDATE kiosk_settings SET
    admin_pin_hash    = crypt(p_pin, gen_salt('bf')),
    pin_fail_count     = 0,
    pin_locked_until   = NULL,
    updated_at         = now()
  WHERE id IS NOT NULL;
END;
$function$;

-- Item 1 (get_all_birthdays PII exposure) deliberately NOT fixed - same
-- class as REQ-SEC-002 (broad anon grants, ~72 tables), needs its own
-- approved plan per CLAUDE.md's own standing rule for this class of
-- finding, not an isolated patch. See TODO.md REQ-SEC-010 for the full
-- reasoning.
