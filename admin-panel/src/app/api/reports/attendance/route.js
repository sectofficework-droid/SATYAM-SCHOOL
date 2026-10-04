import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateTabularPdf } from "@/lib/pdfReportsServer";

export async function POST(request) {
  try {
    const { employeeId, sessionToken, fromDate, toDate } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, sessionToken, null);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!fromDate || !toDate) return NextResponse.json({ error: "fromDate and toDate required" }, { status: 400 });

    const supabase = supabaseServiceClient();
    if (!supabase) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
    const { data, error } = await supabase
      .from("employee_attendance")
      .select("date, status, is_late, employees(name, emp_code)")
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date");
    if (error) throw error;

    const rows = (data || []).map((r) => [
      r.employees?.emp_code || "—",
      r.employees?.name || "—",
      r.date,
      r.status,
      r.is_late ? "Late" : "",
    ]);

    const pdfBytes = await generateTabularPdf(
      `Staff Attendance Report (${fromDate} to ${toDate})`,
      ["Emp Code", "Name", "Date", "Status", "Note"],
      rows
    );
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=Attendance_Report.pdf" },
    });
  } catch (err) {
    console.error("attendance report error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate attendance report" }, { status: 500 });
  }
}
