import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateTcPdf } from "@/lib/pdfReportsServer";
import { getStudentsForReportByIds } from "@/lib/studentService";

// TC issuance's own role gate (REQ-SEC-030, fixed on web + REQ-SEC-033,
// matched on mobile's staff_admin_issue_tc RPC) is separate from this
// route, which only renders a PDF after that RPC already succeeded —
// management/senior_admin only here too, for consistency.
export async function POST(request) {
  try {
    const { employeeId, sessionToken, studentId } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, sessionToken, ["management", "senior_admin"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

    const supabase = supabaseServiceClient();
    if (!supabase) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
    // REQ-BUG-085: was a raw `students.select("*")` then `student.name`/
    // `student.std`/`student.fatherName`/`student.admissionDate` — none of
    // those columns exist on `students`; every field rendered blank on a
    // legally significant document. Reuse the same mapToStudent()-backed
    // helper as the id-card/bonafide routes.
    const [student] = await getStudentsForReportByIds(supabase, [studentId]);
    if (!student) return NextResponse.json({ error: "Student not found or not enrolled in the current academic year" }, { status: 404 });

    const row = {
      "Student Name": student.name,
      "Class": student.std,
      "Father's Name": student.fatherName,
      "Date of Birth": student.dob,
      "Date of Admission": student.dateOfJoin,
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
