import supabase from "./supabase";

// admin_alerts: the Header bell's inbox - previously the bell was purely
// decorative (a hardcoded dot, no data behind it at all). Rows are inserted
// only by SECURITY DEFINER functions server-side (currently just the kiosk's
// punch RPCs, for late arrivals - see SUPABASE_KIOSK_SETTINGS.sql), never
// directly from the admin panel.

export async function getRecentAdminAlerts(limit = 20) {
  const { data, error } = await supabase
    .from("admin_alerts")
    .select("id, type, title, message, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getUnreadAdminAlertCount() {
  const { count, error } = await supabase
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

export async function markAdminAlertRead(id) {
  const { error } = await supabase
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllAdminAlertsRead() {
  const { error } = await supabase
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
