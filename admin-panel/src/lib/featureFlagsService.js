import supabase from "./supabase";

// Generic on/off switches (feature_flags, one row per key) for admin-panel
// tools that aren't needed day-to-day but shouldn't be deleted outright -
// see SUPABASE_FEATURE_FLAGS.sql. Toggling is senior_admin/management only
// (enforced server-side by RLS); any logged-in admin can read a flag.

export async function getFeatureFlag(key) {
  const { data, error } = await supabase.from("feature_flags").select("enabled").eq("key", key).single();
  if (error) return false;
  return !!data?.enabled;
}

export async function listFeatureFlags() {
  const { data, error } = await supabase.from("feature_flags").select("key, enabled, updated_by, updated_at").order("key");
  if (error) throw error;
  return data || [];
}

export async function setFeatureFlag(key, enabled, updatedBy) {
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}
