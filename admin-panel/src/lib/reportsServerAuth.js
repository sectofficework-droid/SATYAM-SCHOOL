import { createClient } from "@supabase/supabase-js";

// Mirrors the mobile Admin Workspace's existing trust model (see
// mobile-app/SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql header comment): every
// mobile-facing report route re-derives the caller's admin tier server-side
// via staff_admin_tier(p_employee_id) rather than trusting a client-supplied
// role string. Known, pre-existing, disclosed limitation this inherits (not
// introduced here): the client-supplied employeeId itself isn't
// re-authenticated per call, same as every other mobile RPC (REQ-SEC-002).
export async function requireStaffAdminTier(employeeId, allowedTiers) {
  if (!employeeId) return { ok: false, status: 401, error: "Missing employeeId" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(supabaseUrl, anonKey);

  const { data: tier, error } = await client.rpc("staff_admin_tier", { p_employee_id: employeeId });
  if (error) return { ok: false, status: 500, error: error.message };
  if (!tier) return { ok: false, status: 403, error: "Not authorized" };
  if (allowedTiers && !allowedTiers.includes(tier)) {
    return { ok: false, status: 403, error: "Not authorized for this report" };
  }
  return { ok: true, tier };
}

export function supabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}
