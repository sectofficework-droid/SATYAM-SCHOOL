import { NextResponse } from "next/server";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";

// REQ-SEC-012 (2026-10-04): this route had no authentication at all -
// anyone who could reach the deployed URL could trigger bulk
// auto-mark-absent for every active employee with no login. Confirmed
// mobile never calls this route (grepped mobile-app/lib; the only caller
// is reportService.js's client-side `fetch`, gated on `typeof window !==
// "undefined"`) so a real Supabase Auth session check can't break any
// mobile or server-to-server caller.
export async function POST(request) {
  return handleSyncAbsent(request);
}

export async function GET(request) {
  return handleSyncAbsent(request);
}

async function handleSyncAbsent(request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }
    const { errorResponse } = await requireAdminSession(request, supabaseAdmin);
    if (errorResponse) return errorResponse;

    // 1. Fetch kiosk settings
    const { data: settings } = await supabaseAdmin
      .from("kiosk_settings")
      .select("absent_cutoff_time")
      .limit(1)
      .single();

    if (!settings?.absent_cutoff_time) {
      return NextResponse.json({ marked: 0, reason: "No absent_cutoff_time set" });
    }

    // 2. Check current time in IST
    const now = new Date();
    const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(now);

    const nowH = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const nowM = Number(parts.find((p) => p.type === "minute")?.value || 0);
    const nowTotalMins = nowH * 60 + nowM;

    const [cutoffH, cutoffM] = settings.absent_cutoff_time.split(":").map(Number);
    const cutoffTotalMins = (cutoffH || 0) * 60 + (cutoffM || 0);

    if (nowTotalMins < cutoffTotalMins) {
      return NextResponse.json({
        marked: 0,
        reason: `Current time (${nowH}:${nowM}) has not reached absent cutoff (${settings.absent_cutoff_time})`,
      });
    }

    // 3. Check if today is a working day (calendar events)
    const { data: events } = await supabaseAdmin
      .from("school_calendar_events")
      .select("category, applies_to_classes")
      .eq("event_date", todayDate);

    // Staff have no "class", so only a school-wide event (applies_to_classes
    // null/empty) can affect them - a working_day/holiday scoped to specific
    // classes (e.g. a Sunday makeup class for one grade) must not turn that
    // Sunday into a staff working day or exempt staff from it.
    const isGlobal = (e) => !e.applies_to_classes || e.applies_to_classes.length === 0;
    const isWorkingOverride = events?.some((e) => e.category === "working_day" && isGlobal(e));
    const isHoliday = events?.some((e) => (e.category === "holiday" || e.category === "govt") && isGlobal(e));
    const weekday = new Date(`${todayDate}T00:00:00`).getDay(); // 0 = Sunday

    if (!isWorkingOverride) {
      if (weekday === 0 || isHoliday) {
        return NextResponse.json({ marked: 0, reason: "Non-working day or holiday" });
      }
    }

    // 4. Find all active employees who haven't punched yet - excluding anyone
    // an admin has already explicitly deleted today's record for (see
    // SUPABASE_STAFF_ATTENDANCE_SYNC_EXCLUSIONS.sql): without this, deleting
    // today's auto-marked "Absent" row just gets it re-inserted on the very
    // next report load, making the delete look like it did nothing.
    const [{ data: emps }, { data: existingAtt }, { data: excluded }] = await Promise.all([
      supabaseAdmin.from("employees").select("id").eq("status", "Active"),
      supabaseAdmin.from("employee_attendance").select("employee_id").eq("date", todayDate),
      supabaseAdmin.from("employee_attendance_sync_exclusions").select("employee_id").eq("date", todayDate),
    ]);

    const existingSet = new Set((existingAtt || []).map((a) => a.employee_id));
    const excludedSet = new Set((excluded || []).map((e) => e.employee_id));
    const missingEmps = (emps || []).filter((e) => !existingSet.has(e.id) && !excludedSet.has(e.id));

    if (!missingEmps.length) {
      return NextResponse.json({ marked: 0, message: "All active employees already recorded" });
    }

    const rowsToInsert = missingEmps.map((e) => ({
      employee_id: e.id,
      date: todayDate,
      status: "A",
    }));

    const { error: insertError } = await supabaseAdmin
      .from("employee_attendance")
      .insert(rowsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, marked: rowsToInsert.length });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to sync absent staff" },
      { status: 500 }
    );
  }
}
