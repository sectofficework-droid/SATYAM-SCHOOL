import { createClient } from "@supabase/supabase-js";

// REQ-SEC-012 (2026-10-04 full-codebase audit): shared auth helper for
// admin-panel API routes that previously had NO authentication check at
// all - anyone who could reach the deployed URL could call them with no
// login (see TODO.md REQ-SEC-012). Mirrors the pattern already proven in
// api/admin-users/route.js's requireCaller(), pulled out to one shared
// module instead of copy-pasted per route (the duplicated service-key
// fallback chain across 4+ routes was already flagged as a drift risk in
// the same audit - not repeating that mistake for this new helper).
//
// Only for admin-panel-web-only routes confirmed to have zero mobile
// caller (grepped mobile-app/lib for the route path first) - mobile has no
// real Supabase Auth session (see REQ-SEC-002/PROJECT_CONTEXT.md), so this
// helper would incorrectly reject every mobile request if applied to a
// route mobile actually calls.

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// Re-derives the caller's identity from their own session token (never
// trusts a client-asserted role/id) and checks real admin_users membership.
// No tier restriction here, matching how these routes' own UI call sites
// already gate them (any logged-in admin can reach the action) - pass
// allowedTiers to restrict further where the UI itself already does.
export async function requireAdminSession(request, supabaseAdmin, allowedTiers) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { errorResponse: errJson("Not authenticated", 401) };

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return { errorResponse: errJson("Not authenticated", 401) };

  const { data: caller } = await supabaseAdmin.from("admin_users").select("id, role").eq("id", user.id).single();
  if (!caller) return { errorResponse: errJson("Not authorized", 403) };
  if (allowedTiers && !allowedTiers.includes(caller.role)) {
    return { errorResponse: errJson("Not authorized", 403) };
  }
  return { caller };
}

function errJson(error, status) {
  return Response.json ? Response.json({ error }, { status }) : new Response(JSON.stringify({ error }), { status });
}
