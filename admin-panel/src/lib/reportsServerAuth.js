import { createClient } from "@supabase/supabase-js";

// Mirrors the mobile Admin Workspace's existing trust model (see
// mobile-app/SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql header comment): every
// mobile-facing report route re-derives the caller's admin tier server-side
// via staff_admin_tier(p_employee_id) rather than trusting a client-supplied
// role string.
//
// REQ-SEC-014 (2026-10-04 full-codebase audit): this used to authorize on
// employeeId alone - anyone who obtained or guessed a valid employee ID
// (e.g. visible in a mobile request) could call these report routes
// directly, bypassing the app entirely, and receive PDFs containing
// Aadhaar numbers, DOB, parent names, or salary figures. Closed the same
// way REQ-SEC-002 Category 3 closed the identical gap on every Postgres
// RPC: also require and verify a mobile session token
// (verify_mobile_session, 'teacher' subject - admin accounts are always
// linked employees/teacher logins in this project) before trusting the
// employeeId at all.
export async function requireStaffAdminTier(employeeId, sessionToken, allowedTiers) {
  if (!employeeId) return { ok: false, status: 401, error: "Missing employeeId" };
  if (!sessionToken) return { ok: false, status: 401, error: "Missing session token" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(supabaseUrl, anonKey);

  const { data: sessionOk, error: sessionErr } = await client.rpc("verify_mobile_session", {
    p_subject_type: "teacher",
    p_subject_id: employeeId,
    p_token: sessionToken,
  });
  if (sessionErr) return { ok: false, status: 500, error: sessionErr.message };
  if (!sessionOk) return { ok: false, status: 401, error: "Not authenticated" };

  const { data: tier, error } = await client.rpc("staff_admin_tier", { p_employee_id: employeeId });
  if (error) return { ok: false, status: 500, error: error.message };
  if (!tier) return { ok: false, status: 403, error: "Not authorized" };
  if (allowedTiers && !allowedTiers.includes(tier)) {
    return { ok: false, status: 403, error: "Not authorized for this report" };
  }
  return { ok: true, tier };
}

// Code-quality note (2026-10-04 audit): this used to silently fall back to
// the anon key if no service key was configured, despite its name promising
// a privileged client - misleading for a future reader of call sites, and
// it would have quietly run every report query RLS-restricted instead of
// erroring loudly. Returns null on missing config now; callers already
// check this the same way getAdminClient() in api/admin-users/route.js does.
export function supabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
