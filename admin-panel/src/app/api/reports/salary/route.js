import { NextResponse } from "next/server";
import { requireStaffAdminTier, supabaseServiceClient } from "@/lib/reportsServerAuth";
import { generateTabularPdf } from "@/lib/pdfReportsServer";

// Mirrors the admin-panel's own gap-closure intent for Salary (TODO.md
// REQ-SEC-007 item 2 flagged the web Salary tab as having no role check at
// all) — this mobile report route is management-only from the start.
export async function POST(request) {
  try {
    const { employeeId, month } = await request.json();
    const auth = await requireStaffAdminTier(employeeId, ["management"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = supabaseServiceClient();
    let query = supabase.from("salary_payments").select("amount, paid_on, paid_by, employees(name, emp_code)").order("paid_on");
    if (month) query = query.eq("month", month);
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((r) => [
      r.employees?.emp_code || "—",
      r.employees?.name || "—",
      r.amount,
      r.paid_on,
      r.paid_by || "—",
    ]);

    const pdfBytes = await generateTabularPdf(
      month ? `Salary Payments (${month})` : "Salary Payments",
      ["Emp Code", "Name", "Amount", "Paid On", "Paid By"],
      rows
    );
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=Salary_Report.pdf" },
    });
  } catch (err) {
    console.error("salary report error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate salary report" }, { status: 500 });
  }
}
