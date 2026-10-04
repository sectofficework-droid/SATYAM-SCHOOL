import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateIdCardPdf } from "@/lib/pdfReportsServer";

export async function POST(request) {
  try {
    const { employeeId, sessionToken, studentIds } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, sessionToken, null);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!Array.isArray(studentIds) || !studentIds.length) {
      return NextResponse.json({ error: "studentIds required" }, { status: 400 });
    }

    const supabase = supabaseServiceClient();
    if (!supabase) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
    const { data, error } = await supabase.from("students").select("*").in("id", studentIds);
    if (error) throw error;

    const pdfBytes = await generateIdCardPdf(data || []);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=ID_Cards.pdf" },
    });
  } catch (err) {
    console.error("id-card report error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate ID cards" }, { status: 500 });
  }
}
