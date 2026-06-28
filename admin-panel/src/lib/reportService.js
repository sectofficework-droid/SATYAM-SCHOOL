import supabase from "./supabase";

const CLASS_NAME_MAP = {
  "JR KG": "JR.KG", "SR KG": "SR.KG",
  "11th Commerce": "11th - Commerce", "12th Commerce": "12th - Commerce",
};
function normClass(n) { return CLASS_NAME_MAP[n] || n || ""; }

// ── Students (all academic years) ─────────────────────────────────────────────
export async function getStudentsForReport() {
  const { data: years } = await supabase
    .from("academic_years")
    .select("id, label")
    .order("label", { ascending: false });

  if (!years?.length) return [];

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, roll_no, date_of_join,
      fee_total, fee_discount, deactivate_reason,
      student:students(
        id, first_name, last_name, grno, dob, gender,
        place_of_birth, mobile1, mobile2, status,
        religion, caste, sub_caste, mother_tongue,
        height_cm, weight_kg,
        father_name, mother_name,
        room_plot_no, society, landmark, area, pincode,
        aadhar, aadhar_name,
        father_aadhar, father_aadhar_name, mother_aadhar, mother_aadhar_name,
        udise, pen, apaar,
        birth_cert_reg_no, birth_cert_reg_date,
        student_previous_school(school_name, grno, attendance_days, last_exam_given, percentage),
        student_documents(status, document_types(name))
      ),
      class:classes!student_enrollments_class_id_fkey(name),
      academic_year:academic_years(label),
      admission_class:classes!student_enrollments_admission_class_id_fkey(name)
    `)
    .in("academic_year_id", years.map(y => y.id))
    .order("roll_no", { ascending: true });

  if (error) throw error;

  return (data || []).map(row => {
    const s = row.student;
    if (!s) return null;
    const hasBirthCert = (s.student_documents || [])
      .some(d => d.document_types?.name === "Birth Certificate" && d.status === "Uploaded");

    return {
      enrollNo:           row.enrollment_no,
      name:               `${s.first_name} ${s.last_name}`.trim(),
      firstName:          s.first_name,
      lastName:           s.last_name,
      surname:            s.last_name,
      fatherName:         s.father_name || "",
      motherName:         s.mother_name || "",
      mobile1:            s.mobile1 || "",
      mobile2:            s.mobile2 || "",
      dob:                s.dob || "",
      joinDate:           row.date_of_join || "",
      joinClass:          normClass(row.admission_class?.name),
      cls:                normClass(row.class?.name),
      roll:               String(row.roll_no || ""),
      status:             s.status || "Active",
      session:            row.academic_year?.label || "",
      gender:             s.gender || "",
      religion:           s.religion || "",
      caste:              s.caste || "",
      subCaste:           s.sub_caste || "",
      motherTongue:       s.mother_tongue || "",
      placeOfBirth:       s.place_of_birth || "",
      height:             s.height_cm || "",
      weight:             s.weight_kg || "",
      plotNo:             s.room_plot_no || "",
      society:            s.society || "",
      landmark:           s.landmark || "",
      area:               s.area || "",
      pinCode:            s.pincode || "",
      aadharNo:           s.aadhar || "",
      aadharName:         s.aadhar_name || "",
      fatherAadhar:       s.father_aadhar || "",
      fatherAadharName:   s.father_aadhar_name || "",
      motherAadhar:       s.mother_aadhar || "",
      motherAadharName:   s.mother_aadhar_name || "",
      udise:              s.udise || "",
      pen:                s.pen || "",
      apaar:              s.apaar || "",
      birthCertRegNo:     s.birth_cert_reg_no || "",
      birthCertRegDate:   s.birth_cert_reg_date || "",
      grNo:               s.grno || "",
      hasBirthCert,
      remarks:            row.deactivate_reason || "",
      followUp:           "",
      lastSchoolName:     s.student_previous_school?.[0]?.school_name || "",
      lastSchoolGrNo:     s.student_previous_school?.[0]?.grno || "",
      prevAttendanceDays: s.student_previous_school?.[0]?.attendance_days || "",
      lastExamGiven:      s.student_previous_school?.[0]?.last_exam_given ? "Yes" : "No",
      prevPercentage:     s.student_previous_school?.[0]?.percentage || "",
    };
  }).filter(Boolean);
}

// ── Fee Payments (all time — for collection report) ───────────────────────────
export async function getPaymentsForReport() {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      enrollment_no,
      academic_year:academic_years(label),
      student:students(first_name, last_name),
      class:classes!student_enrollments_class_id_fkey(name),
      fee_payments(id, amount, payment_date)
    `)
    .order("enrollment_no");

  if (error) throw error;

  const rows = [];
  for (const enr of (data || [])) {
    const s    = enr.student;
    const name = s ? `${s.first_name} ${s.last_name}`.trim() : "";
    for (const p of (enr.fee_payments || [])) {
      rows.push({
        id:          p.id,
        date:        p.payment_date || "",
        amount:      Number(p.amount) || 0,
        studentName: name,
        enrollNo:    enr.enrollment_no || "",
        cls:         normClass(enr.class?.name),
        session:     enr.academic_year?.label || "",
      });
    }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

// ── Fees (current academic year) ──────────────────────────────────────────────
export async function getFeesForReport() {
  const { data: year } = await supabase
    .from("academic_years").select("id").eq("is_current", true).single();
  if (!year) return [];

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, roll_no, fee_total, fee_discount,
      student:students(id, first_name, last_name, status),
      class:classes!student_enrollments_class_id_fkey(name),
      fee_payments(id, amount, payment_date)
    `)
    .eq("academic_year_id", year.id)
    .order("roll_no");

  if (error) throw error;

  return (data || []).map(row => {
    const s = row.student;
    if (!s) return null;
    const totalFee  = Number(row.fee_total) || 0;
    const discount  = Number(row.fee_discount) || 0;
    const totalPaid = (row.fee_payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pending   = Math.max(totalFee - discount - totalPaid, 0);
    const feeStatus = pending <= 0 ? "Fully Paid" : totalPaid === 0 ? "Pending" : "Partial";
    return {
      enrollNo:  row.enrollment_no,
      name:      `${s.first_name} ${s.last_name}`.trim(),
      cls:       normClass(row.class?.name),
      totalFee,
      discount,
      totalPaid,
      pending,
      status:    feeStatus,
      payments:  (row.fee_payments || []).map(p => ({ paid: Number(p.amount) || 0 })),
    };
  }).filter(Boolean);
}

// ── Employees ──────────────────────────────────────────────────────────────────
export async function getEmployeesForReport() {
  const [empRes, salRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, type, designation, department, phone, email, joining_date, status, subject_mappings")
      .order("name"),
    supabase
      .from("salary_payments")
      .select("employee_id, amount, month")
      .order("month", { ascending: false }),
  ]);
  if (empRes.error) throw empRes.error;

  // Latest salary amount per employee
  const salMap = {};
  for (const s of (salRes.data || [])) {
    if (!salMap[s.employee_id]) salMap[s.employee_id] = Number(s.amount) || 0;
  }

  return (empRes.data || []).map(row => ({
    id:        row.id,
    name:      row.name,
    role:      row.designation || row.type || "",
    subject:   Array.isArray(row.subject_mappings) && row.subject_mappings.length
               ? row.subject_mappings.map(m => m.subject || m).join(", ")
               : row.department || "-",
    qualification: "",
    mobile:    row.phone || "",
    email:     row.email || "",
    salary:    salMap[row.id] || 0,
    joinDate:  row.joining_date || "",
    status:    row.status || "Active",
    type:      row.type || "",
  }));
}

export async function getAcademicYearLabels() {
  const { data } = await supabase
    .from("academic_years")
    .select("label")
    .order("label", { ascending: false });
  return (data || []).map(r => r.label);
}

// ── Fees for Super-Admin panel (current year, with full payment records) ─────
export async function getFeesForSuperAdmin() {
  const { data: year } = await supabase
    .from("academic_years").select("id").eq("is_current", true).single();
  if (!year) return [];

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, fee_total, fee_discount,
      student:students(first_name, last_name),
      class:classes!student_enrollments_class_id_fkey(name),
      fee_payments(id, amount, payment_date)
    `)
    .eq("academic_year_id", year.id)
    .order("roll_no");

  if (error) throw error;

  return (data || []).map(row => {
    const s = row.student;
    if (!s) return null;
    const payments = (row.fee_payments || [])
      .sort((a, b) => (a.payment_date || "").localeCompare(b.payment_date || ""))
      .map((p, i) => ({
        id:       p.id,
        label:    `Payment ${i + 1}`,
        amount:   Number(p.amount) || 0,
        dueDate:  "",
        paid:     Number(p.amount) || 0,
        paidDate: p.payment_date || "",
      }));
    return {
      id:       row.id,
      enrollNo: row.enrollment_no || "",
      name:     `${s.first_name} ${s.last_name}`.trim(),
      cls:      normClass(row.class?.name),
      totalFee: Number(row.fee_total) || 0,
      discount: Number(row.fee_discount) || 0,
      payments,
    };
  }).filter(Boolean);
}

// ── Inventory (items + assets combined for report) ────────────────────────────
export async function getInventoryForReport() {
  const [itemsRes, assetsRes] = await Promise.all([
    supabase.from("inventory_items").select("*, inventory_batches(*), inventory_usages(*)").order("name"),
    supabase.from("assets").select("*, asset_checkouts(*)").order("name"),
  ]);

  const rows = [];

  for (const item of (itemsRes.data || [])) {
    const totalIn   = (item.inventory_batches || []).reduce((s, b) => s + b.qty, 0);
    const totalUsed = (item.inventory_usages  || []).reduce((s, u) => s + u.qty, 0);
    const avail     = totalIn - totalUsed;
    const stockStatus = avail <= 0 ? "Out of Stock" : avail <= item.low_stock_at ? "Low Stock" : "In Stock";
    rows.push({
      name:         item.name,
      category:     item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : "Other",
      location:     item.storage_address || "-",
      status:       stockStatus,
      assignedTo:   "-",
      purchaseDate: item.created_at?.slice(0, 10) || "",
      totalIn,
      totalUsed,
      available:    avail,
      value:        avail,
      _type:        "stock",
    });
  }

  for (const asset of (assetsRes.data || [])) {
    const currentCheckout = (asset.asset_checkouts || []).find(c => !c.return_date);
    rows.push({
      name:         asset.name + (asset.brand ? ` (${asset.brand})` : ""),
      category:     "Asset",
      location:     asset.storage_address || "-",
      status:       currentCheckout ? "In Use" : "Available",
      assignedTo:   currentCheckout ? currentCheckout.taken_by : "-",
      purchaseDate: asset.created_at?.slice(0, 10) || "",
      value:        0,
      _type:        "asset",
    });
  }

  return rows;
}
