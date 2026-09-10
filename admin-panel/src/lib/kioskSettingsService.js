import supabase from "./supabase";

// kiosk_settings: single-row config for the Attendance Kiosk - admin PIN
// (hashed, never read back), expected staff start time + late grace period,
// and an optional absent-marking cutoff. No direct table grants at all (see
// SUPABASE_KIOSK_SETTINGS.sql) - everything goes through these RPCs so the
// PIN hash is never fetched by any client, not even in hashed form.

export async function getKioskSettings() {
  const { data, error } = await supabase.rpc("get_kiosk_admin_settings");
  if (error) throw error;
  const row = data?.[0];
  return {
    expectedStartTime: row?.o_expected_start_time?.slice(0, 5) || "09:00",
    lateGraceMinutes:  row?.o_late_grace_minutes ?? 10,
    absentCutoffTime:  row?.o_absent_cutoff_time?.slice(0, 5) || "",
    pinIsSet:          !!row?.o_pin_is_set,
  };
}

// absentCutoffTime: "" disables the auto-absent job (stored as NULL).
export async function saveKioskSettings({ expectedStartTime, lateGraceMinutes, absentCutoffTime }) {
  const { error } = await supabase.rpc("save_kiosk_settings", {
    p_expected_start_time: expectedStartTime,
    p_late_grace_minutes:  Number(lateGraceMinutes) || 0,
    p_absent_cutoff_time:  absentCutoffTime || null,
  });
  if (error) throw error;
}

export async function setKioskAdminPin(pin) {
  const { error } = await supabase.rpc("set_kiosk_admin_pin", { p_pin: pin });
  if (error) throw error;
}
