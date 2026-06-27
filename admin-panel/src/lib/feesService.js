import supabase from "./supabase";

const CLASS_NAME_MAP = {
  "JR KG": "JR.KG",
  "SR KG": "SR.KG",
  "11th Commerce": "11th - Commerce",
  "12th Commerce": "12th - Commerce",
};
function normClass(name) {
  return CLASS_NAME_MAP[name] || name || "";
}

function mapFeeStudent(row) {
  const s = row.student;
  if (!s || s.status === "Left") return null;

  const paidAmount = (row.fee_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const discount   = Number(row.fee_discount) || 0;
  const className  = normClass(row.class?.name);

  return {
    _enrollmentId: row.id,
    _studentId:    s.id,
    enrollment:    row.enrollment_no,
    name:          `${s.first_name} ${s.last_name}`.trim(),
    fatherName:    s.father_name || "",
    mobile:        s.mobile1 || "",
    std:           className,
    section:       row.section?.name || "",
    rollNo:        String(row.roll_no || ""),
    session:       row.academic_year?.label || "",
    status:        s.status || "Active",

    discount: { amount: discount, reason: row.discount_reason || "" },

    fees: {
      total:          Number(row.fee_total) || 0,
      paid:           paidAmount,
      discount,
      discountReason: row.discount_reason || "",
    },

    payments: (row.fee_payments || [])
      .map(p => ({
        date:       p.payment_date || "",
        amount:     Number(p.amount) || 0,
        receivedBy: p.received_by || "",
        std:        className,
        _id:        p.id,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date)),

    inventory: (row.student_inventory_assignments || []).map(a => ({
      item:          a.inventory_items?.name || "",
      givenDate:     a.given_date
        ? new Date(a.given_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "",
      given:         a.status === "Given",
      _assignmentId: a.id,
    })),
  };
}

export async function getStudentsForFees(yearId) {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, roll_no,
      fee_total, fee_discount, discount_reason,
      student:students(id, first_name, last_name, mobile1, father_name, status),
      class:classes!student_enrollments_class_id_fkey(name),
      section:sections(name),
      academic_year:academic_years(label),
      fee_payments(id, amount, payment_date, received_by),
      student_inventory_assignments(id, status, given_date, inventory_items(name))
    `)
    .eq("academic_year_id", yearId)
    .order("roll_no", { ascending: true });

  if (error) throw error;
  return (data || []).map(mapFeeStudent).filter(Boolean);
}

// Returns { "JR.KG": 14500, "1st": 15500, ... }
export async function getFeeStructure(yearId) {
  const { data, error } = await supabase
    .from("fee_structures")
    .select(`tuition_amount, uniform_amount, classes(name)`)
    .eq("academic_year_id", yearId);

  if (error) throw error;

  const map = {};
  (data || []).forEach(row => {
    if (row.classes?.name) {
      map[normClass(row.classes.name)] =
        (Number(row.tuition_amount) || 0) + (Number(row.uniform_amount) || 0);
    }
  });
  return map;
}

export async function saveFeePayment(enrollmentId, studentId, { amount, paymentDate, receivedBy }) {
  const { error } = await supabase
    .from("fee_payments")
    .insert({
      enrollment_id: enrollmentId,
      student_id:    studentId,
      amount,
      payment_date:  paymentDate,
      received_by:   receivedBy,
    });
  if (error) throw error;
}

export async function updateFeesForEnrollment(enrollmentId, { discount, payments, originalPaymentIds }) {
  // 1. Update discount on enrollment
  const { error: discErr } = await supabase
    .from("student_enrollments")
    .update({ fee_discount: discount })
    .eq("id", enrollmentId);
  if (discErr) throw discErr;

  // 2. Get student_id for new payment inserts
  const { data: enrData } = await supabase
    .from("student_enrollments")
    .select("student_id")
    .eq("id", enrollmentId)
    .single();
  const studentId = enrData?.student_id;

  // 3. Update existing payments (UUID ids from DB)
  const existingPayments = payments.filter(p => typeof p.id === "string");
  for (const p of existingPayments) {
    await supabase
      .from("fee_payments")
      .update({ amount: p.paid, payment_date: p.paidDate || null })
      .eq("id", p.id);
  }

  // 4. Insert new payments (numeric ids from Date.now())
  const newPayments = payments.filter(p => typeof p.id === "number");
  if (newPayments.length > 0) {
    const rows = newPayments.map(p => ({
      enrollment_id: enrollmentId,
      student_id:    studentId,
      amount:        p.paid,
      payment_date:  p.paidDate || null,
    }));
    const { error: insErr } = await supabase.from("fee_payments").insert(rows);
    if (insErr) throw insErr;
  }

  // 5. Delete payments removed by the user
  const currentIds = existingPayments.map(p => p.id);
  const deletedIds = (originalPaymentIds || []).filter(id => !currentIds.includes(id));
  if (deletedIds.length > 0) {
    const { error: delErr } = await supabase.from("fee_payments").delete().in("id", deletedIds);
    if (delErr) throw delErr;
  }
}

export async function markInventoryPending(assignmentIds) {
  const { error } = await supabase
    .from("student_inventory_assignments")
    .update({ status: "Pending", given_date: null })
    .in("id", assignmentIds);
  if (error) throw error;
}

export async function markInventoryGiven(assignmentIds, givenDate) {
  // Fetch item_id + name for each assignment so we can deduct stock
  const { data: assignments, error: fetchErr } = await supabase
    .from("student_inventory_assignments")
    .select("id, item_id, inventory_items(name)")
    .in("id", assignmentIds);
  if (fetchErr) throw fetchErr;

  // Mark assignments as Given
  const { error } = await supabase
    .from("student_inventory_assignments")
    .update({ status: "Given", given_date: givenDate })
    .in("id", assignmentIds);
  if (error) throw error;

  // Books and notebooks are deducted manually via the Inventory module — skip them here
  const MANUAL_ITEMS = ["book set", "notebook set"];
  const deductible = (assignments || []).filter(a => {
    if (!a.item_id) return false;
    const name = (a.inventory_items?.name || "").toLowerCase().trim();
    return !name.includes("notebook") && !MANUAL_ITEMS.includes(name);
  });

  // Insert inventory_usages to deduct stock (group by item_id, qty = number of students)
  const qtyMap = {};
  deductible.forEach(a => {
    qtyMap[a.item_id] = (qtyMap[a.item_id] || 0) + 1;
  });
  const usageRows = Object.entries(qtyMap).map(([item_id, qty]) => ({
    item_id,
    qty,
    usage_date: givenDate,
    purpose:    "student",
  }));
  if (usageRows.length > 0) {
    const { error: usageErr } = await supabase
      .from("inventory_usages")
      .insert(usageRows);
    if (usageErr) throw usageErr;
  }
}
