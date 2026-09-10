import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCalendarEvents } from "@/lib/calendarService";
import { isWorkingDay } from "@/lib/attendanceRules";

// Runs every 30 min through a working-hours window (see vercel.json) rather
// than once at a fixed time, since the actual cutoff (Settings -> Kiosk) is
// admin-configurable and a Vercel cron schedule isn't. auto_mark_absent_staff
// itself no-ops until that configured cutoff has passed and the feature is
// enabled, and only fills in employees with no attendance row yet today, so
// firing this repeatedly is safe.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Today" in the school's own timezone, not the cron server's (Vercel runs
  // in UTC) - same idiom as the attendance-reminders cron.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  try {
    const calendarEvents = await getCalendarEvents();
    if (!isWorkingDay(today, calendarEvents, null)) {
      return NextResponse.json({ date: today, marked: 0, reason: "non-working day" });
    }
    const { data, error } = await supabase.rpc("auto_mark_absent_staff", { p_date: today });
    if (error) throw error;
    return NextResponse.json({ date: today, marked: data ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
