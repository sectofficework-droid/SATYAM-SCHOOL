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

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to update kiosk settings" },
      { status: 500 }
    );
  }
}
