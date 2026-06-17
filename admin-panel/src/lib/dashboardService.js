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
