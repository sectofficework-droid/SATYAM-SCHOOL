import supabase from "./supabase";

// SEF Employees (tutors/staff) - a separate roster from the school's
// employees table (decided in SEF Phase 1). No app writes attendance here
// (no SEF staff app), so attendance is admin-marked directly, and salary
// is direct-entry (same pattern as the school's own Super Admin Salary
// Panel), not the school's Excel-import period calculator.

// ── Employees ─────────────────────────────────────────────────────
export async function getEmployees() {
  const { data, error } = await supabase.from("sef_employees").select("*").order("name");
  if (error) throw error;
  return data || [];
}

function toRow(emp) {
  return {
    name:             emp.name,
    gender:           emp.gender || null,
    dob:              emp.dob || null,
    phone:            emp.phone,
    alt_phone:        emp.altPhone || null,
    email:            emp.email || null,
    address:          emp.address || null,
    aadhar:           emp.aadhar || null,
    pan:              emp.pan || null,
    role_type:        emp.roleType || "Tutor",
    designation:      emp.designation || null,
    joining_date:     emp.joiningDate,
    employment_type:  emp.employmentType || "Permanent",
    status:            emp.status || "Active",
    photo_key:        emp.photoKey || null,
    subject_mappings: emp.subjectMappings || [],
    documents:        emp.documents || [],
  };
}

export async function addEmployee(emp) {
  const { data, error } = await supabase.from("sef_employees").insert(toRow(emp)).select().single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id, emp) {
  const { error } = await supabase.from("sef_employees").update({ ...toRow(emp), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setEmployeeStatus(id, status) {
  const { error } = await supabase.from("sef_employees").update({ status }).eq("id", id);
  if (error) throw error;
}

// ── Attendance (day-by-day, admin-marked - no self-service leave queue,
// admin marks a day 'L' directly the same way as P/A) ────────────────
export async function getAttendanceForDate(date) {
  const { data, error } = await supabase.from("sef_employee_attendance").select("employee_id, status").eq("date", date);
  if (error) throw error;
  return data || [];
}

export async function saveAttendanceForDate(records) {
  if (!records.length) return;
  const { error } = await supabase.from("sef_employee_attendance").upsert(records, { onConflict: "employee_id,date" });
  if (error) throw error;
}

export async function getAttendanceHistory(employeeId, fromDate, toDate) {
  let query = supabase.from("sef_employee_attendance").select("date, status").eq("employee_id", employeeId).order("date", { ascending: false });
  if (fromDate) query = query.gte("date", fromDate);
  if (toDate) query = query.lte("date", toDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Salary (direct-entry, same as the school's Super Admin Salary Panel) ──
export async function getSalaryPayments(employeeId) {
  let query = supabase.from("sef_salary_payments").select("*").order("month", { ascending: false });
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addSalaryPayment({ employeeId, amount, month, paidOn, paidBy, note }) {
  const { error } = await supabase.from("sef_salary_payments").upsert({
    employee_id: employeeId, amount, month, paid_on: paidOn, paid_by: paidBy || null, note: note || null,
  }, { onConflict: "employee_id,month" });
  if (error) throw error;
}
