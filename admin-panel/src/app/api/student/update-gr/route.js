import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { studentId, grNo } = body;

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const cleanGr = grNo ? String(grNo).trim().toUpperCase() : null;

    const { error } = await supabaseAdmin
      .from("students")
      .update({ grno: cleanGr, updated_at: new Date().toISOString() })
      .eq("id", studentId);

    if (error) throw error;

    return NextResponse.json({ success: true, grNo: cleanGr });
  } catch (err) {
    console.error("update-gr error:", err);
    return NextResponse.json({ error: err.message || "Failed to update GR" }, { status: 500 });
  }
}
