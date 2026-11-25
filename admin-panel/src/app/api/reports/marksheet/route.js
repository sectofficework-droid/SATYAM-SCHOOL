import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateMarksheetPdf } from "@/lib/pdfReportsServer";
import { getMarksheetsForClass, getCurrentOfficialExams } from "@/lib/marksheetService";
import { getStudentsForReportByIds } from "@/lib/studentService";

export async function POST(request) {
  try {
    const { employeeId, sessionToken, studentId, className } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, sessionToken, null);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!studentId || !className) {
      return NextResponse.json({ error: "studentId and className required" }, { status: 400 });
    }

    const supabase = supabaseServiceClient();
    if (!supabase) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
    // REQ-BUG-085: was a raw `students.select("*")` with a manually bolted-on
    // `_studentId` - getMarksheetsForClass()/generateMarksheetPdf() both
    // expect mapToStudent()'s full shape (`name`, `std`, `section`, ...),
    // none of which exist on the raw row.
    const [student] = await getStudentsForReportByIds(supabase, [studentId]);
    if (!student) return NextResponse.json({ error: "Student not found or not enrolled in the current academic year" }, { status: 404 });

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
