import supabase from "./supabase";

// SEF Reports — simpler than the school's (no GR Register/UDISE/PEN/APAAR
// compliance reports, which exist for government reporting a school must
// do, not a tuition center).

export async function getStudentsForReport() {
  const { data, error } = await supabase.from("sef_students").select("*").order("name");
  if (error) throw error;
  return data || [];
}

export async function getFeesForReport() {
  const { data, error } = await supabase
    .from("sef_fee_payments")
    .select("*, student:sef_students(name, std)")
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getEmployeesForReport() {
  const { data: employees, error } = await supabase.from("sef_employees").select("*").order("name");
  if (error) throw error;
  const { data: payments } = await supabase.from("sef_salary_payments").select("employee_id, amount, month").order("month", { ascending: false });
  const latestByEmp = {};
  (payments || []).forEach(p => { if (!latestByEmp[p.employee_id]) latestByEmp[p.employee_id] = p; });
  return (employees || []).map(e => ({ ...e, latestSalary: latestByEmp[e.id] || null }));
}

export async function getInventoryForReport() {
  const { data, error } = await supabase
    .from("sef_inventory_items")
    .select("*, sef_inventory_batches(qty), sef_inventory_usages(qty)")
    .order("name");
  if (error) throw error;
  return (data || []).map(item => {
    const totalIn = (item.sef_inventory_batches || []).reduce((s, b) => s + (b.qty || 0), 0);
    const totalUsed = (item.sef_inventory_usages || []).reduce((s, u) => s + (u.qty || 0), 0);
    const available = totalIn - totalUsed;
    return { name: item.name, unit: item.unit, totalIn, totalUsed, available, status: available <= item.low_stock_at ? "Low Stock" : "OK" };
  });
}
