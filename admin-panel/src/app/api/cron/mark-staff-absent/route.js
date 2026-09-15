import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCalendarEvents } from "@/lib/calendarService";
import { isWorkingDay } from "@/lib/attendanceRules";

// Runs once daily at 09:00 UTC / 2:30pm IST (see vercel.json) - Vercel's Hobby
// plan only allows daily crons, so this can no longer poll every 30 min through
// the working-hours window like it used to. The fixed time is set to fall after
// the school day's last period, since the actual cutoff (Settings -> Kiosk) is
// admin-configurable and a single fixed cron time isn't - auto_mark_absent_staff
// itself no-ops until that configured cutoff has passed and the feature is
// enabled, so firing after the latest plausible cutoff each day is what keeps
// this correct with only one run.
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
