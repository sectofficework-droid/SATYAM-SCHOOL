-- REQ-BUG-068: the throttling itself already existed server-side
-- (5 failed attempts -> 15-minute lockout, pin_fail_count/pin_locked_until
-- on kiosk_settings) - the actual gap was UX: a locked-out attempt
-- returned NULL the same as a wrong PIN, so the dialog just said
-- "Incorrect PIN" with no indication of the lockout or how long it lasts.
-- Now raises a distinguishable exception carrying the remaining minutes,
-- so the client can show a clear message instead.
-- Applied directly to the live DB via Supabase MCP on 2026-11-19.

CREATE OR REPLACE FUNCTION public.verify_kiosk_admin_pin(p_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
  v_fail_count int;
  v_locked_until timestamptz;
  v_ok boolean;
  v_token text;
  v_minutes_left int;
BEGIN
  SELECT admin_pin_hash, pin_fail_count, pin_locked_until
  INTO v_hash, v_fail_count, v_locked_until
  FROM kiosk_settings LIMIT 1;

  IF v_hash IS NULL THEN RETURN NULL; END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    v_minutes_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())) / 60))::int;
    RAISE EXCEPTION 'locked_out:%', v_minutes_left;
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
$function$;
