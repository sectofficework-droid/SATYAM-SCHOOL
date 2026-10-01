-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace, slice 1 of "port remaining web admin modules":
-- Rules & Regulations, Year Planning (calendar events), Impersonation Log.
--
-- Same pattern as every other staff_admin_* RPC: every call takes
-- p_employee_id first and re-derives the tier server-side via
-- staff_admin_tier(), gated to senior_admin/management (matches the web
-- Settings page, which already blocks normal_admin from reaching any of
-- these tabs at all).
--
-- Reads for school_rules and school_calendar_events stay direct table
-- selects from Flutter (anon already has SELECT grants on both - the
-- teacher/student apps already read these tables directly today) - only
-- writes need a tier-checked RPC surface, since anon has no write grant on
-- either table.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Rules & Regulations ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_save_school_rules(p_employee_id UUID, p_audience TEXT, p_content TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_audience NOT IN ('teacher','student') THEN RAISE EXCEPTION 'invalid_audience'; END IF;

  INSERT INTO school_rules (audience, content, updated_at)
  VALUES (p_audience, p_content, now())
  ON CONFLICT (audience) DO UPDATE SET content = EXCLUDED.content, updated_at = now();
END;
$$;

-- ── Year Planning (school_calendar_events) ─────────────────────────────────
CREATE OR REPLACE FUNCTION staff_admin_calendar_add_event(
  p_employee_id UUID, p_date DATE, p_category TEXT, p_label TEXT, p_icon TEXT, p_classes TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id UUID;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  INSERT INTO school_calendar_events (event_date, category, title, icon, applies_to_classes)
  VALUES (p_date, p_category, p_label, p_icon, p_classes)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_calendar_update_event(
  p_employee_id UUID, p_id UUID, p_date DATE, p_category TEXT, p_label TEXT, p_icon TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Same deliberate omission as the web's updateCalendarEvent: never touches
  -- applies_to_classes, so an edit here can't silently wipe a scope the
  -- Attendance module's Holidays tab set.
  UPDATE school_calendar_events
  SET event_date = p_date, category = p_category, title = p_label, icon = p_icon
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_calendar_delete_event(p_employee_id UUID, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  DELETE FROM school_calendar_events WHERE id = p_id;
END;
$$;

-- ── Impersonation audit log (read-only) ────────────────────────────────────
-- Not a wrapper around get_impersonation_audit_log() - that function checks
-- auth.uid() against admin_users directly, which only resolves for real
-- Supabase Auth (web) callers; mobile's anon+custom-employee-id model has no
-- auth.uid() at all, so it reads impersonation_audit_log itself after the
-- usual staff_admin_tier() check.
CREATE OR REPLACE FUNCTION staff_admin_impersonation_log(p_employee_id UUID, p_limit INT)
RETURNS SETOF impersonation_audit_log
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY SELECT * FROM impersonation_audit_log ORDER BY occurred_at DESC LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_save_school_rules(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_calendar_add_event(UUID, DATE, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_calendar_update_event(UUID, UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_calendar_delete_event(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_impersonation_log(UUID, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_save_school_rules(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_calendar_add_event(UUID, DATE, TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_calendar_update_event(UUID, UUID, DATE, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_calendar_delete_event(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_impersonation_log(UUID, INT) TO anon, authenticated;
