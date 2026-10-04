import supabase from "./supabase";

// REQ-SEC-012 (2026-10-04): shared client-side fetch wrapper that attaches
// the caller's own Supabase session token, so newly-authenticated API
// routes can re-verify who's asking instead of trusting the client.
// Extracted from settings/UsersRolesTab.js's original local copy (first
// route to need this) so it's not re-implemented per caller.
export default async function authedFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (session?.access_token || ""),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || "Request failed");
    err.body = body;
    throw err;
  }
  return body;
}
