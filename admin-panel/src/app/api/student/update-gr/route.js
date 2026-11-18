import { NextResponse } from "next/server";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";

// REQ-SEC-024: this route used a bare service_role client with no caller
// check at all - anyone who could reach the deployed URL could overwrite
// any student's GR number, no login required. Same bug class as
// REQ-SEC-012/013, just added after that 2026-10-04 sweep so it was never
// caught. No mobile caller (grepped mobile-app/lib for "update-gr" -
// none), so gating this is safe.
export async function POST(req) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { errorResponse } = await requireAdminSession(req, supabaseAdmin);
  if (errorResponse) return errorResponse;

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
