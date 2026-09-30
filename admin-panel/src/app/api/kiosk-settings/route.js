import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { expectedStartTime, lateGraceMinutes, absentCutoffTime, shiftEndTime } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a293ZGF1Z2trdW12enlmc2FpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY0NjQwOSwiZXhwIjoyMDk3MjIyNDA5fQ.pdr16s6KS1qeH0KzlUXRLF7BoLm8otOO7JxF8ESPbiY";

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing service key" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const updatePayload = {
      expected_start_time: expectedStartTime || "09:00",
      late_grace_minutes: Number(lateGraceMinutes) || 0,
      absent_cutoff_time: absentCutoffTime || null,
      shift_end_time: shiftEndTime || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("kiosk_settings")
      .update(updatePayload)
      .not("id", "is", null)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Automatically recalculate today's attendance & shifts with the updated timings
    try {
      const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const newExpectedTime = expectedStartTime || "09:00";
      const newGrace = Number(lateGraceMinutes) || 0;
      const [expH, expM] = newExpectedTime.split(":").map(Number);
      const expTotalMins = (expH || 0) * 60 + (expM || 0);
      const cutoffTotalMins = expTotalMins + newGrace;

      const [{ data: todayAtt }, { data: todayShifts }] = await Promise.all([
        supabaseAdmin
          .from("employee_attendance")
          .select("id, check_in_at")
          .eq("date", todayDate)
          .not("check_in_at", "is", null),
        supabaseAdmin
          .from("employee_shifts")
          .select("id, check_in_at")
          .eq("date", todayDate)
          .not("check_in_at", "is", null),
      ]);

      const computeLateness = (checkInAt) => {
        const d = new Date(checkInAt);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: false,
        }).formatToParts(d);
        const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
        const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
        const s = Number(parts.find((p) => p.type === "second")?.value || 0);
        const checkInTotalMins = h * 60 + m + s / 60;
        const lateMins = Math.max(0, Math.floor(checkInTotalMins - expTotalMins));
        const isLate = checkInTotalMins > cutoffTotalMins;
        return { lateMins, isLate };
      };

      if (todayAtt?.length) {
        await Promise.all(
          todayAtt.map((row) => {
            const { lateMins, isLate } = computeLateness(row.check_in_at);
            return supabaseAdmin
              .from("employee_attendance")
              .update({ late_minutes: lateMins, is_late: isLate })
              .eq("id", row.id);
          })
        );
      }

      if (todayShifts?.length) {
        await Promise.all(
          todayShifts.map((row) => {
            const { lateMins, isLate } = computeLateness(row.check_in_at);
            return supabaseAdmin
              .from("employee_shifts")
              .update({ late_minutes: lateMins, is_late: isLate })
              .eq("id", row.id);
          })
        );
      }
    } catch (recalcErr) {
      console.warn("Failed to auto-recalculate today's punches:", recalcErr);
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to update kiosk settings" },
      { status: 500 }
    );
  }
}
