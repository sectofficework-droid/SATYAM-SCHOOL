-- REQ-SEC-007 (governance/planning/TODO.md) - role-tier enforcement, part 2.
-- Applied 2026-09-19 via mcp__supabase__apply_migration (2 migrations:
-- req_sec_007_salary_punchcode_role_enforcement, then
-- req_sec_007_fix_punch_code_search_path after Supabase's security advisor
-- flagged generate_punch_code's missing `SET search_path = public` -
-- folded into this file so it reflects live state, same convention as
-- SUPABASE_ADMIN_ROLE_ENFORCEMENT.sql).
--
-- Two gaps found during the Staff App Unification feature-inventory audit
-- (2026-09-19), same class as REQ-SEC-005 but not covered by that fix:
--
-- 1. generate_punch_code(uuid) was granted to `authenticated` with NO
--    internal check at all - not even admin_users membership (every other
--    admin-facing RPC in this project checks at least is_admin_user()).
--    Any Supabase-authenticated session (in practice: any admin_users
--    member today, but also any stray leftover auth.users row from the
--    abandoned "real Supabase Auth for mobile" design - see
--    employees.app_user_id) could mint a face-punch override code for any
--    employee. Fix: add is_admin_user() check, matching every sibling RPC
--    in this project. Not a new business rule - every admin tier can
--    already do this via the UI unconditionally (no role gate exists
--    there either); this only blocks non-admin authenticated sessions.
--
-- 2. salary_payments read/insert (super-admin/page.js's Salary tab, UI-
--    gated to management-tier only via `isMgmt`) went straight through
--    supabase.from("salary_payments"), RLS policy `is_admin_user()` -
--    membership only, not tier. A senior_admin or normal_admin calling
--    Supabase directly could read or write salary data despite the UI
--    never showing them that tab. Fix: same SECURITY DEFINER RPC +
--    revoke-direct-grant pattern as REQ-SEC-005 (reusing its
--    admin_has_role() helper), restricted to 'management' only - mirrors
--    the existing `isMgmt` UI gate exactly, not a new rule.
--
-- Diagnostics-report download (the other REQ-SEC-007 item) is deliberately
-- NOT touched here - see governance/planning/TODO.md REQ-SEC-007 update
-- for why fixing it the same way wouldn't close the real gap.

-- ── generate_punch_code: add the membership check every sibling RPC has ────
CREATE OR REPLACE FUNCTION generate_punch_code(p_employee_id UUID)
RETURNS TABLE(code TEXT, generated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code TEXT := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_now  TIMESTAMPTZ := now();
BEGIN
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    INSERT INTO employee_punch_codes (employee_id, code, generated_at, expires_at)
    VALUES (p_employee_id, v_code, v_now, v_now + interval '15 minutes')
    RETURNING employee_punch_codes.code, employee_punch_codes.generated_at, employee_punch_codes.expires_at;
END;
$$;
-- Grants unchanged from SUPABASE_PUNCH_OVERRIDE_CODE.sql (authenticated
-- only, PUBLIC/anon already revoked there).

-- ── salary_payments: management-only RPCs, replacing direct table access ──
CREATE OR REPLACE FUNCTION public.admin_get_salary_payments(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(id uuid, employee_id uuid, month date, amount numeric, paid_on date, paid_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT admin_has_role(ARRAY['management']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT sp.id, sp.employee_id, sp.month, sp.amount, sp.paid_on, sp.paid_by
    FROM salary_payments sp
    WHERE (p_from IS NULL OR sp.month >= p_from)
      AND (p_to IS NULL OR sp.month < p_to);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_salary_payments(date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_salary_payment(p_employee_id uuid, p_month date, p_amount numeric, p_paid_on date, p_paid_by text)
RETURNS public.salary_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.salary_payments;
BEGIN
  IF NOT admin_has_role(ARRAY['management']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO salary_payments (employee_id, month, amount, paid_on, paid_by)
  VALUES (p_employee_id, p_month, p_amount, p_paid_on, p_paid_by)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_salary_payment(uuid, date, numeric, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_salary_payments_bulk(p_rows jsonb)
RETURNS SETOF public.salary_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT admin_has_role(ARRAY['management']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    INSERT INTO salary_payments (employee_id, month, amount, paid_on, paid_by)
    SELECT (r->>'employee_id')::uuid, (r->>'month')::date, (r->>'amount')::numeric, (r->>'paid_on')::date, r->>'paid_by'
    FROM jsonb_array_elements(p_rows) r
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_salary_payments_bulk(jsonb) TO authenticated;

-- ── Lock down salary_payments: RPCs above are now the only write/read path ─
DROP POLICY IF EXISTS "admin staff manage salary_payments" ON public.salary_payments;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.salary_payments FROM authenticated;

-- ── Harden RPC execute grants (PUBLIC/anon default, defense in depth) ──────
REVOKE EXECUTE ON FUNCTION public.admin_get_salary_payments(date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_salary_payment(uuid, date, numeric, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_record_salary_payments_bulk(jsonb) FROM PUBLIC, anon;
