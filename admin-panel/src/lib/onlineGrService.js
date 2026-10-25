import authedFetch from "./authedFetch";

// REQ-SEC-022 (2026-10-25): switched from plain fetch to authedFetch so
// these calls carry the admin's real session token - /api/online-general-
// register now verifies that server-side via requireAdminSession (see
// route.js). Mirrors UsersRolesTab.js's authedFetch usage; authedFetch
// throws an Error whose message is the route's `error` field on failure,
// so the original per-call friendly messages below are preserved by
// re-mapping onto that thrown error. Zero mobile callers (route is
// admin-panel-web only) so attaching the web session can't break anyone.

export async function getOnlineGrData() {
  try {
    return await authedFetch("/api/online-general-register", { cache: "no-store" })
      .then((json) => json.data);
  } catch (e) {
    throw new Error(e.message || "Failed to load online general register data");
  }
}

export async function updateOnlineGrRow(id, section, updates) {
  try {
    const json = await authedFetch("/api/online-general-register", {
      method: "POST",
      body: JSON.stringify({ id, section, updates }),
    });
    return json.item;
  } catch (e) {
    throw new Error(e.message || "Failed to update record");
  }
}

export async function deleteOnlineGrRow(id, section) {
  try {
    await authedFetch(
      `/api/online-general-register?id=${encodeURIComponent(id)}&section=${encodeURIComponent(section)}`,
      { method: "DELETE" }
    );
    return true;
  } catch (e) {
    throw new Error(e.message || "Failed to delete record");
  }
}
