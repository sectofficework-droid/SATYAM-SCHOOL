import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";
import { getCalendarEvents } from "@/lib/calendarService";
import { isWorkingDay } from "@/lib/attendanceRules";
import { withDiagnostics } from "@/lib/apiDiagnostics";
import logger from "@/lib/logger";

// Runs once daily at 09:00 UTC / 2:30pm IST (see vercel.json) - Vercel's Hobby
// plan only allows daily crons, so this can no longer poll every 30 min through
// the working-hours window like it used to. The fixed time is set to fall after
// the school day's last period, since the actual cutoff (Settings -> Kiosk) is
// admin-configurable and a single fixed cron time isn't - auto_mark_absent_staff
// itself no-ops until that configured cutoff has passed and the feature is
// enabled, so firing after the latest plausible cutoff each day is what keeps
// this correct with only one run.
export const GET = withDiagnostics(async function GET(request) {
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
    // TODO.md REQ-SEC-010 item 2 (fixed 2026-09-19): auto_mark_absent_staff
    // used to be callable by anyone with the public anon key - the
    // CRON_SECRET check above only protects this HTTP route, not a direct
    // Supabase call. The RPC now requires its own shared secret
    // (MARK_ABSENT_CRON_SECRET, unrelated to CRON_SECRET - set this in
    // Vercel's env vars, see the value recorded in this session's
    // conversation/work log; not committed to git). Until that env var is
    // set, this call fails closed (RPC raises "Not authorized") rather
    // than silently running unauthenticated.
    const { data, error } = await supabase.rpc("auto_mark_absent_staff", {
      p_date: today,
      p_secret: process.env.MARK_ABSENT_CRON_SECRET,
    });
    if (error) throw error;
    return NextResponse.json({ date: today, marked: data ?? 0 });
  } catch (e) {
    logger.error("Mark staff absent cron failed", { stack: e?.stack, message: e?.message });
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
});
