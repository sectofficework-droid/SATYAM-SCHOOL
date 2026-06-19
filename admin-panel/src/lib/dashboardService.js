import supabase from "./supabase";

export async function getDashboardStats(selectedDate) {
  const curMonth = new Date().toISOString().slice(0, 7);

  const { data: year } = await supabase
    .from("academic_years")
    .select("id, label")
    .eq("is_current", true)
    .single();

  const yearId = year?.id;

  const [studentsRes, staffRes, feesRes, expRes] = await Promise.all([
    yearId
      ? supabase.from("student_enrollments").select("id", { count: "exact", head: true }).eq("academic_year_id", yearId)
      : Promise.resolve({ count: 0, error: null }),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "Active"),
    supabase.from("fee_payments").select("amount, payment_date").gte("payment_date", curMonth + "-01"),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", curMonth + "-01"),
  ]);

  const feeRows = (feesRes.data || []).map(p => ({
    amount: Number(p.amount),
    date:   p.payment_date,
  }));

  const expRows = (expRes.data || []).map(e => ({
    amount: Number(e.amount),
    date:   e.expense_date,
  }));

  return {
    totalStudents: studentsRes.count || 0,
    totalStaff:    staffRes.count    || 0,
    feePayments:   feeRows,
    expenses:      expRows,
    currentYear:   year?.label || "",
  };
}

export async function getRecentNotices(limit = 4) {
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, type, posted_date")
    .eq("archived", false)
    .order("posted_date", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return data;
}

export async function getInventoryAlerts(limit = 5) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, low_stock_at, inventory_batches(qty), inventory_usages(qty)");
  if (error || !data) return [];
  return data
    .map(item => {
      const totalIn   = (item.inventory_batches || []).reduce((s, b) => s + (b.qty || 0), 0);
      const totalUsed = (item.inventory_usages  || []).reduce((s, u) => s + (u.qty || 0), 0);
      const avail     = totalIn - totalUsed;
      const threshold = item.low_stock_at || 0;
      return { item: item.name, stock: avail, min: threshold };
    })
    .filter(a => a.min > 0 && a.stock <= a.min)
    .sort((a, b) => (a.stock / a.min) - (b.stock / b.min))
    .slice(0, limit);
}

export async function getRecentActivities(limit = 7) {
  const [feesRes, enrollRes] = await Promise.all([
    supabase
      .from("fee_payments")
      .select("id, amount, payment_date, student_enrollments(enrollment_no, student:students(first_name, last_name), class:classes!student_enrollments_class_id_fkey(name))")
      .order("payment_date", { ascending: false })
      .limit(limit),
    supabase
      .from("student_enrollments")
      .select("id, enrollment_no, date_of_join, created_at, student:students(first_name, last_name), class:classes!student_enrollments_class_id_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activities = [];

  for (const p of (feesRes.data || [])) {
    const enr  = p.student_enrollments;
    const s    = enr?.student;
    const name = s ? `${s.first_name} ${s.last_name}`.trim() : "Student";
    const cls  = enr?.class?.name || "";
    activities.push({
      type:   "fee",
      title:  "Fee Payment Received",
      detail: `${name}${cls ? " · " + cls : ""} · ₹${Number(p.amount).toLocaleString("en-IN")}`,
      date:   p.payment_date || "",
    });
  }

  for (const enr of (enrollRes.data || [])) {
    const s    = enr.student;
    const name = s ? `${s.first_name} ${s.last_name}`.trim() : "Student";
    const cls  = enr.class?.name || "";
    activities.push({
      type:   "admit",
      title:  "New Student Admitted",
      detail: `${name}${cls ? " · " + cls : ""} · Enr. ${enr.enrollment_no || ""}`,
      date:   enr.date_of_join || enr.created_at?.slice(0, 10) || "",
    });
  }

  activities.sort((a, b) => b.date.localeCompare(a.date));
  return activities.slice(0, limit);
}
