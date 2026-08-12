import supabase from "./supabase";

// SEF fee payments — one tuition rate per student (sef_students.monthly_fee),
// payments recorded against it. No session/class fee-structure matrix like
// the school's feesService.js has; see database/sef_schema.sql.

export async function getPaymentsForStudent(studentId) {
  const { data, error } = await supabase
    .from("sef_fee_payments")
    .select("*")
    .eq("student_id", studentId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addPayment({ studentId, amount, paymentDate, receivedBy, note }) {
  const { error } = await supabase
    .from("sef_fee_payments")
    .insert({
      student_id:   studentId,
      amount,
      payment_date: paymentDate,
      received_by:  receivedBy || null,
      note:         note || null,
    });
  if (error) throw error;
}

// This month's total collection across all students, for the SEF dashboard.
export async function getThisMonthCollection() {
  const curMonth = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from("sef_fee_payments")
    .select("amount")
    .gte("payment_date", curMonth + "-01");
  if (error) throw error;
  return (data || []).reduce((sum, p) => sum + Number(p.amount), 0);
}

// Recent payments across all students, joined with student name - for the
// SEF dashboard's recent-activity list.
export async function getRecentPayments(limit = 5) {
  const { data, error } = await supabase
    .from("sef_fee_payments")
    .select("id, amount, payment_date, student:sef_students(name)")
    .order("payment_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
