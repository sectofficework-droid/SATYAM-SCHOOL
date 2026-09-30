import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  return handleSyncAbsent();
}

export async function GET(request) {
  return handleSyncAbsent();
}

async function handleSyncAbsent() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a293ZGF1Z2trdW12enlmc2FpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY0NjQwOSwiZXhwIjoyMDk3MjIyNDA5fQ.pdr16s6KS1qeH0KzlUXRLF7BoLm8otOO7JxF8ESPbiY";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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
      .select("category")
      .eq("event_date", todayDate);

    const isWorkingOverride = events?.some((e) => e.category === "working_day");
    const isHoliday = events?.some((e) => e.category === "holiday" || e.category === "govt");
    const weekday = new Date(`${todayDate}T00:00:00`).getDay(); // 0 = Sunday

    if (!isWorkingOverride) {
      if (weekday === 0 || isHoliday) {
        return NextResponse.json({ marked: 0, reason: "Non-working day or holiday" });
      }
    }

    // 4. Find all active employees who haven't punched yet
    const [{ data: emps }, { data: existingAtt }] = await Promise.all([
      supabaseAdmin.from("employees").select("id").eq("status", "Active"),
      supabaseAdmin.from("employee_attendance").select("employee_id").eq("date", todayDate),
    ]);

    const existingSet = new Set((existingAtt || []).map((a) => a.employee_id));
    const missingEmps = (emps || []).filter((e) => !existingSet.has(e.id));

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
