import supabase from "./supabase";

// app_versions: one row per published build. The mobile app compares its own
// installed build number against the highest version_code here and, if
// behind, offers an update - see SUPABASE_APP_VERSIONS.sql.

export async function getAppVersionHistory() {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .order("version_code", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLatestAppVersion() {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .order("version_code", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function publishAppVersion({ versionName, versionCode, apkKey, releaseNotes, forceUpdate }) {
  const { error } = await supabase.from("app_versions").insert({
    version_name:  versionName,
    version_code:  versionCode,
    apk_key:       apkKey,
    release_notes: releaseNotes || null,
    force_update:  !!forceUpdate,
  });
  if (error) throw error;
}
