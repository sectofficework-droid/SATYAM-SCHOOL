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
    shiftEndTime:      row?.o_shift_end_time?.slice(0, 5) || "16:00",
    pinIsSet:          !!row?.o_pin_is_set,
  };
}

// absentCutoffTime: "" disables the auto-absent job (stored as NULL).
export async function saveKioskSettings({ expectedStartTime, lateGraceMinutes, absentCutoffTime, shiftEndTime }) {
  // First attempt via internal server API (uses service key and WHERE id IS NOT NULL
  // to avoid PostgreSQL safeupdate constraint errors)
  try {
    const res = await fetch("/api/kiosk-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedStartTime,
        lateGraceMinutes: Number(lateGraceMinutes) || 0,
        absentCutoffTime: absentCutoffTime || null,
        shiftEndTime: shiftEndTime || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      return json.data;
    }
    if (json.error) {
      throw new Error(json.error);
    }
  } catch (apiErr) {
    if (apiErr.message && !apiErr.message.includes("fetch")) {
      throw apiErr;
    }
  }

  // Fallback to direct RPC
  const { error } = await supabase.rpc("save_kiosk_settings", {
    p_expected_start_time: expectedStartTime,
    p_late_grace_minutes:  Number(lateGraceMinutes) || 0,
    p_absent_cutoff_time:  absentCutoffTime || null,
    p_shift_end_time:      shiftEndTime || null,
  });
  if (error) throw error;
}

export async function setKioskAdminPin(pin) {
  const { error } = await supabase.rpc("set_kiosk_admin_pin", { p_pin: pin });
  if (error) throw error;
}

// Special-day overrides: a one-off report time for a specific future date
// (exam day, function, etc.) that doesn't touch the kiosk_settings default
// and needs no manual revert - it only applies on its own date. Any field
// left blank falls back to the normal default for that field.
export async function listKioskSpecialDays() {
  const { data, error } = await supabase.rpc("list_kiosk_special_days");
  if (error) throw error;
  return (data || []).map(row => ({
    date:              row.o_date,
    expectedStartTime: row.o_expected_start_time?.slice(0, 5) || "",
    lateGraceMinutes:  row.o_late_grace_minutes ?? "",
    absentCutoffTime:  row.o_absent_cutoff_time?.slice(0, 5) || "",
    shiftEndTime:      row.o_shift_end_time?.slice(0, 5) || "",
    reason:            row.o_reason || "",
  }));
}

export async function saveKioskSpecialDay({ date, expectedStartTime, lateGraceMinutes, absentCutoffTime, shiftEndTime, reason }) {
  const { error } = await supabase.rpc("save_kiosk_special_day", {
    p_date:                date,
    p_expected_start_time: expectedStartTime || null,
    p_late_grace_minutes:  lateGraceMinutes === "" || lateGraceMinutes == null ? null : Number(lateGraceMinutes),
    p_absent_cutoff_time:  absentCutoffTime || null,
    p_shift_end_time:      shiftEndTime || null,
    p_reason:              reason || null,
  });
  if (error) throw error;
}

export async function deleteKioskSpecialDay(date) {
  const { error } = await supabase.rpc("delete_kiosk_special_day", { p_date: date });
  if (error) throw error;
}
