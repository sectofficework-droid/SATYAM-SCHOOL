import supabase from "./supabase";

// app_versions: one row per published build. The mobile app compares its own
// installed build number against the highest version_code here and, if
// behind, offers an update - see SUPABASE_APP_VERSIONS.sql.

// app matches exactly what each Flutter flavor sends via
// AppConfig.lockedRole.name in app_update.dart's checkForAppUpdate() -
// 'teacher' / 'student' / 'kiosk' (the Attendance flavor locks UserRole.kiosk,
// not 'attendance' - see main_attendance.dart). app_versions.app is NOT NULL
// with no default, so every one of these must always pass it.

export async function getAppVersionHistory(app) {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .eq("app", app)
    .order("version_code", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLatestAppVersion(app) {
  const { data, error } = await supabase
    .from("app_versions")
    .select("*")
    .eq("app", app)
    .order("version_code", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function publishAppVersion({ app, versionName, versionCode, apkKey, releaseNotes, forceUpdate }) {
  const { error } = await supabase.from("app_versions").insert({
    app,
    version_name:  versionName,
    version_code:  versionCode,
    apk_key:       apkKey,
    release_notes: releaseNotes || null,
    force_update:  !!forceUpdate,
  });
  if (error) throw error;
}
