import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateMarksheetPdf } from "@/lib/pdfReportsServer";
import { getMarksheetsForClass, getCurrentOfficialExams } from "@/lib/marksheetService";

export async function POST(request) {
  try {
    const { employeeId, studentId, className } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, null);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!studentId || !className) {
      return NextResponse.json({ error: "studentId and className required" }, { status: 400 });
    }

    const supabase = supabaseServiceClient();
    const { data: student, error } = await supabase.from("students").select("*").eq("id", studentId).single();
    if (error) throw error;
    student._studentId = student.id;

    const exams = await getCurrentOfficialExams();
    const examNames = (exams || []).map((e) => e.name);
    const sheets = await getMarksheetsForClass([student], className);
    const sheet = sheets?.find((sh) => sh.studentId === studentId) || null;

    const pdfBytes = await generateMarksheetPdf(student, sheet, examNames);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=Marksheet.pdf" },
    });
  } catch (err) {
    console.error("marksheet report error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate marksheet" }, { status: 500 });
  }
}
