import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateTcPdf } from "@/lib/pdfReportsServer";

// TC issuance has zero role gating on the admin-panel web side (TODO.md
// REQ-SEC-008, still open there) — this mobile path doesn't inherit that
// gap: management/senior_admin only.
export async function POST(request) {
  try {
    const { employeeId, studentId } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, ["management", "senior_admin"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const supabase = supabaseServiceClient();
    const { data: student, error } = await supabase.from("students").select("*").eq("id", studentId).single();
    if (error) throw error;

    const row = {
      "Student Name": student.name,
      "Class": student.std,
      "Father's Name": student.fatherName,
      "Date of Birth": student.dob,
      "Date of Admission": student.admissionDate || student.doa,
      "Date of Leaving": new Date().toISOString().slice(0, 10),
      "Reason for Leaving": "Transfer",
    };

    const pdfBytes = await generateTcPdf(row);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=Transfer_Certificate.pdf" },
    });
  } catch (err) {
    console.error("tc report error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate TC" }, { status: 500 });
  }
}
