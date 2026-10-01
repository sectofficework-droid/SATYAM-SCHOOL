-- ─────────────────────────────────────────────────────────────────────────────
-- Staff App Admin Workspace, slice 4 of "port remaining web admin modules":
-- Diagnostics viewer (Settings area on web, admin's error-report inbox - see
-- CLAUDE.md's REQ-HYG-006 note for the full picture of this feature).
--
-- diagnostic_reports/diagnostic_settings both have RLS policies keyed on
-- is_admin_user()/admin_has_role(), which resolve via auth.uid() - NULL for
-- mobile's anon+custom-employee-id sessions, so even though anon has table
-- grants, RLS blocks every read/write from the app today. These RPCs give
-- the usual staff_admin_tier()-gated, anon-callable surface instead.
--
-- The Teacher app's Admin Workspace is senior_admin/management only
-- end-to-end (see admin_workspace_home.dart's _isSeniorOrMgmt gate before
-- any of these tiles even render), so unlike the web's
-- admin_get_diagnostic_reports() - which still gives normal_admin a
-- redacted summary-only view - staff_admin_diagnostic_reports() only has
-- one branch: full content, since a normal_admin can never reach this
-- screen on mobile at all.
-- Run this in Supabase Dashboard -> SQL Editor (or via the Supabase MCP).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION staff_admin_diagnostic_reports(p_employee_id UUID)
RETURNS SETOF diagnostic_reports
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  RETURN QUERY SELECT * FROM diagnostic_reports ORDER BY created_at DESC LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_mark_diagnostic_report(p_employee_id UUID, p_report_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name TEXT;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT name INTO v_name FROM employees WHERE id = p_employee_id;

  -- reviewed_by is a free-text display name on this table (matches the
  -- web's own markDiagnosticReport(id, status, reviewedBy) convention),
  -- not an FK - never the raw employee id.
  UPDATE diagnostic_reports
  SET status = p_status, reviewed_by = COALESCE(v_name, 'Admin'), reviewed_at = now()
  WHERE id = p_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_get_diagnostics_enabled(p_employee_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_enabled BOOLEAN;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT enabled INTO v_enabled FROM diagnostic_settings WHERE id = 1;
  RETURN COALESCE(v_enabled, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION staff_admin_set_diagnostics_enabled(p_employee_id UUID, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name TEXT;
BEGIN
  IF staff_admin_tier(p_employee_id) NOT IN ('senior_admin','management') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT name INTO v_name FROM employees WHERE id = p_employee_id;
  UPDATE diagnostic_settings SET enabled = p_enabled, updated_by = COALESCE(v_name, 'Admin'), updated_at = now() WHERE id = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION staff_admin_diagnostic_reports(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_mark_diagnostic_report(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_get_diagnostics_enabled(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_set_diagnostics_enabled(UUID, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION staff_admin_diagnostic_reports(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_mark_diagnostic_report(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_get_diagnostics_enabled(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION staff_admin_set_diagnostics_enabled(UUID, BOOLEAN) TO anon, authenticated;
