import { NextResponse } from "next/server";
import { getAttendanceOverviewForDate, sendBulkAttendanceReminders } from "@/lib/attendanceService";
import { getCalendarEvents } from "@/lib/calendarService";
import { isWorkingDay } from "@/lib/attendanceRules";

// Runs daily via Vercel Cron (see vercel.json - scheduled for 07:00 UTC =
// 12:30pm IST, comfortably before the 1:00pm cutoff) and nags every class
// teacher who still hasn't marked attendance for today, the same way the
// Attendance > Overview tab's "Notify All" button does manually - both
// share sendBulkAttendanceReminders so the message shape and same-day dedup
// (in case a teacher was already manually reminded before this ran) stay
// identical between the automatic and manual paths.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Today" in the school's own timezone, not the cron server's (Vercel
  // runs in UTC) - matters right around midnight IST either way.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  try {
    const [rows, calendarEvents] = await Promise.all([
      getAttendanceOverviewForDate(today),
      getCalendarEvents(),
    ]);
    const workingRows = rows.filter(r => isWorkingDay(today, calendarEvents, r.className));
    const result = await sendBulkAttendanceReminders(workingRows, today);
    return NextResponse.json({ date: today, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
