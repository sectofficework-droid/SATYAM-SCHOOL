import supabase from "./supabase";
import { getFeeStructure } from "./feesService";

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
        place_of_birth, birth_state, birth_district, birth_city, birth_village, mobile1, mobile2, status,
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
    .order("enrollment_no", { ascending: true });

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
      birthState:         s.birth_state || "",
      birthDistrict:      s.birth_district || "",
      birthCity:          s.birth_city || "",
      birthVillage:       s.birth_village || "",
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
      // student_id is student_previous_school's own primary key (one row per
      // student, not many), so Supabase nests this as a single object.
      lastSchoolName:     s.student_previous_school?.school_name || "",
      lastSchoolGrNo:     s.student_previous_school?.grno || "",
      prevAttendanceDays: s.student_previous_school?.attendance_days || "",
      lastExamGiven:      s.student_previous_school?.last_exam_given ? "Yes" : "No",
      prevPercentage:     s.student_previous_school?.percentage || "",
    };
  }).filter(Boolean);
}

// ── Transfer Certificates Issued ──────────────────────────────────────────────
export async function getTcIssuedForReport() {
  const { data, error } = await supabase
    .from("transfer_certificates")
    .select(`
      id, tc_number, issue_date, leaving_date, reason, conduct, dues_cleared, remarks,
      student:students(
        id, first_name, last_name, father_name, mother_name, grno, udise, pen, apaar,
        student_enrollments(
          enrollment_no, roll_no, deactivate_date,
          class:classes!student_enrollments_class_id_fkey(name),
          academic_year:academic_years(label)
        )
      )
    `)
    .order("leaving_date", { ascending: false });

  if (error) throw error;

  return (data || []).map(row => {
    const s = row.student;
    if (!s) return null;
    // A student can have one enrollment row per academic year (promotions);
    // the one this TC deactivated is the one with a deactivate_date set.
    const enrollments = s.student_enrollments || [];
    const leftEnrollment = enrollments.find(e => e.deactivate_date) || enrollments[enrollments.length - 1] || {};
    return {
      tcNumber:    row.tc_number,
      studentName: `${s.first_name} ${s.last_name}`.trim(),
      fatherName:  s.father_name || "",
      motherName:  s.mother_name || "",
      grNo:        s.grno || "",
      udise:       s.udise || "",
      pen:         s.pen || "",
      apaar:       s.apaar || "",
      enrollNo:    leftEnrollment.enrollment_no || "",
      roll:        String(leftEnrollment.roll_no || ""),
      cls:         normClass(leftEnrollment.class?.name),
      session:     leftEnrollment.academic_year?.label || "",
      issueDate:   row.issue_date || "",
      leavingDate: row.leaving_date || "",
      reason:      row.reason || "",
      conduct:     row.conduct || "",
      duesCleared: row.dues_cleared ? "Yes" : "No",
      remarks:     row.remarks || "",
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

  // REQ-BUG-001: classFees only serves as a fallback for legacy rows with
  // no fee_total recorded - the actual source of truth is the snapshot
  // taken at admission/promotion (row.fee_total below), same as
  // getFeesForReport just above. Previously this ignored fee_total
  // entirely and always used the live current-year structure, producing a
  // different "Total Fees" figure than every other page in the app.
  const classFees = await getFeeStructure(year.id);

  const { data, error } = await supabase
    .from("student_enrollments")
    .select(`
      id, enrollment_no, fee_total, fee_discount, discount_reason,
      student:students(first_name, last_name),
      class:classes!student_enrollments_class_id_fkey(name),
      fee_payments(id, amount, payment_date, due_amount, due_date, label)
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
        label:    p.label || `Payment ${i + 1}`,
        // due_amount/due_date/label are new columns (previously the "Amount"
        // field editable here just aliased the actual-received `amount`
        // column, so it could never show a real Partial/Unpaid balance).
        // Legacy rows with no due_amount recorded yet fall back to the
        // amount actually received, same as before this fix.
        amount:   p.due_amount != null ? Number(p.due_amount) : Number(p.amount) || 0,
        dueDate:  p.due_date || "",
        paid:     Number(p.amount) || 0,
        paidDate: p.payment_date || "",
      }));
    const cls = normClass(row.class?.name);
    return {
      id:       row.id,
      enrollNo: row.enrollment_no || "",
      name:     `${s.first_name} ${s.last_name}`.trim(),
      cls,
      totalFee:       Number(row.fee_total) || classFees[cls] || 0,
      discount:       Number(row.fee_discount) || 0,
      discountReason: row.discount_reason || "",
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
    const totalIn   = (item.inventory_batches || []).reduce((s, b) => s + (b.qty || 0), 0);
    const totalUsed = (item.inventory_usages  || []).reduce((s, u) => s + (u.qty || 0), 0);
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

// ── Staff Attendance (Kiosk) ────────────────────────────────────────────────
// One row per (employee, date) from employee_attendance - the day-level P/A/L
// status written either by the Kiosk's face/QR/code punches (see
// SUPABASE_QR_PUNCH.sql, SUPABASE_MULTI_SHIFT_MIGRATION.sql) or by admin's
// Mark Attendance / approved leave (staffLeaveService.js). employee_shifts is
// folded in per (employee, date) to surface first check-in, last check-out,
// how many separate punches made up the day, and total hours worked - a
// multi-shift day would otherwise only show through the day-level row's own
// single check_in_at/check_out_at, which record_face_punch/redeem_* leave
// null after the first punch.
const STAFF_ATTENDANCE_STATUS_LABELS = { P: "Present", A: "Absent", L: "Leave" };

// Standard working day, in hours. Everything overtime/shortfall is measured
// against this: worked = hoursWorked - STANDARD_DAY_HOURS, so a partial day
// reads as shortfall and a long day reads as overtime. Kept as a plain
// constant rather than a kiosk_settings column on purpose - there is no admin
// UI to edit a per-school shift length, and adding one would mean a DB
// migration plus a save path for a value this project has never had.
const STANDARD_DAY_HOURS = 8;

// Only the columns the report actually renders. employee_shifts is the widest
// table in the join (every punch ever) and this report never shows raw shift
// rows, so the open-shift flag is derived here rather than fetched.
const STAFF_ATTENDANCE_SHIFT_FIELDS =
  "employee_id, date, check_in_at, check_out_at, punch_method, is_late, late_minutes";

export async function getStaffAttendanceForReport() {
  const [attRes, shiftRes, empRes] = await Promise.all([
    supabase
      .from("employee_attendance")
      .select("employee_id, date, status, check_in_at, check_out_at, punch_method, is_late, late_minutes")
      .order("date", { ascending: false }),
    supabase
      .from("employee_shifts")
      .select(STAFF_ATTENDANCE_SHIFT_FIELDS),
    supabase
      .from("employees")
      .select("id, emp_code, name, designation, department, status"),
  ]);
  if (attRes.error) throw attRes.error;
  if (shiftRes.error) throw shiftRes.error;
  if (empRes.error) {
    console.warn("Could not load employee details for staff attendance report:", empRes.error.message);
  }

  const empMap = {};
  for (const e of (empRes.data || [])) empMap[e.id] = e;

  const shiftsByKey = {};
  for (const s of (shiftRes.data || [])) {
    (shiftsByKey[`${s.employee_id}|${s.date}`] ??= []).push(s);
  }

  return (attRes.data || []).map(row => {
    const emp = empMap[row.employee_id] || {};
    const shifts = (shiftsByKey[`${row.employee_id}|${row.date}`] || [])
      .slice()
      .sort((a, b) => (a.check_in_at || "").localeCompare(b.check_in_at || ""));
    const firstIn = shifts[0]?.check_in_at || row.check_in_at || "";
    const lastOut = shifts.length ? shifts[shifts.length - 1].check_out_at : row.check_out_at;
    const hoursWorked = shifts.reduce((sum, s) => {
      if (!s.check_in_at || !s.check_out_at) return sum;
      return sum + (new Date(s.check_out_at) - new Date(s.check_in_at)) / 3600000;
    }, 0);

    // A punch with no matching check-out: the staff member is currently on
    // shift, or they punched in and walked away without punching out. The
    // shift-end cron closes the second case after the cutoff, so what is left
    // here is either genuinely still-open work or a row the cron has not
    // reached yet - worth flagging rather than silently reporting 0 hours.
    const unclosedShifts = shifts.filter(s => !s.check_out_at).length;

    // The day row is the authority for lateness (is_late/late_minutes are
    // written once, against the day's first punch, by the kiosk RPCs). Fall
    // back to the shifts only when the day row carries no verdict at all.
    const isLate = row.is_late ?? shifts.some(s => s.is_late);
    const lateMinutes = isLate ? (row.late_minutes ?? shifts.find(s => s.is_late)?.late_minutes ?? 0) : 0;

    const balance = hoursWorked - STANDARD_DAY_HOURS;
    // Date-only strings are parsed as UTC midnight by the Date constructor,
    // which lands on the wrong weekday for IST; the explicit local parse is
    // what actually matches the school calendar.
    const dayIndex = weekdayIndex(row.date);

    return {
      employeeId:  row.employee_id,
      empCode:     emp.emp_code || "",
      name:        emp.name || "Unknown",
      designation: emp.designation || "",
      department:  emp.department || "",
      empStatus:   emp.status || "",
      date:        row.date,
      dayIndex,
      dayName:     STAFF_DAY_NAMES[dayIndex] || "",
      isWeekend:   dayIndex === 0 || dayIndex === 6,
      status:      STAFF_ATTENDANCE_STATUS_LABELS[row.status] || row.status,
      checkIn:     firstIn || "",
      checkOut:    lastOut || "",
      shiftCount:  shifts.length || (row.check_in_at ? 1 : 0),
      hoursWorked: hoursWorked ? Math.round(hoursWorked * 100) / 100 : "",
      // Signed hours against the standard day: positive is overtime, negative
      // is a shortfall. Empty (not 0) whenever the day has no measured hours,
      // so an absent/leave day never reads as a 0-hour shortfall.
      hoursBalance: hoursWorked ? round1(balance) : "",
      unclosedShifts,
      punchMethod: row.punch_method || shifts[0]?.punch_method || "",
      punctuality: row.is_late === true ? `Late by ${row.late_minutes} min` : row.is_late === false ? "On Time" : "",
      lateMinutes,
    };
  });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// -1 for a missing/unparseable date, so callers can drop the row's weekday
// rather than silently bucketing it under Sunday.
function weekdayIndex(isoDate) {
  if (!isoDate) return -1;
  const d = new Date(`${isoDate}T00:00:00`);
  return isNaN(d.getTime()) ? -1 : d.getDay();
}

const STAFF_DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Staff Attendance — per-employee rollup ───────────────────────────────────
// Collapses the day rows above into one row per employee for the rows that
// survived filtering, so a month is readable instead of 30xN lines. Overtime
// is summed from the signed per-day balance rather than recomputed from total
// hours - summing balances keeps a short day from cancelling out a long one
// inside the same month, which is what a payroll dispute is actually about.
export function rollupStaffAttendance(rows) {
  const byEmp = {};
  for (const r of (rows || [])) {
    (byEmp[r.employeeId] ??= []).push(r);
  }

  return Object.entries(byEmp).map(([employeeId, days]) => {
    const first = days[0];
    const sorted = days.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const present = days.filter(d => d.status === "Present").length;
    const absent  = days.filter(d => d.status === "Absent").length;
    const leave   = days.filter(d => d.status === "Leave").length;
    const lateDays = days.filter(d => d.lateMinutes > 0).length;
    const totalHours = days.reduce((s, d) => s + (Number(d.hoursWorked) || 0), 0);
    const totalBalance = days.reduce((s, d) => s + (d.hoursBalance === "" ? 0 : Number(d.hoursBalance) || 0), 0);
    // Attendance % counts only days the employee was actually expected to be
    // marked in - leave is excluded from the denominator so a sanctioned
    // absence is not reported as an attendance failure.
    const countable = present + absent;
    const unclosed = days.reduce((s, d) => s + (d.unclosedShifts || 0), 0);
    const hasWorkedDays = days.some(d => d.hoursBalance !== "");

    return {
      employeeId,
      empCode:      first.empCode,
      name:         first.name,
      designation:  first.designation,
      department:   first.department,
      period:       periodLabel(sorted),
      daysRecorded: days.length,
      present,
      absent,
      leave,
      lateDays,
      lateMinutes:  days.reduce((s, d) => s + (Number(d.lateMinutes) || 0), 0),
      attendancePct: countable ? Math.round((present / countable) * 1000) / 10 : "",
      totalHours:   round1(totalHours),
      // A period that nets to exactly zero still reads 0.0 - blank would be
      // wrong there, since it reads as "no hours worked" and hides a balanced
      // month. Blank is reserved for a period with no measured day at all
      // (leave-only, or a filter that matched no worked day).
      hoursBalance: hasWorkedDays ? round1(totalBalance) : "",
      shiftCount:   days.reduce((s, d) => s + (Number(d.shiftCount) || 0), 0),
      unclosedShifts: unclosed,
      punchMethods: [...new Set(days.map(d => d.punchMethod).filter(Boolean))].join(", "),
    };
  });
}

// "01 Jun - 30 Jun 2026" for a single month, "01 Jun - 15 Jul 2026" when the
// selected rows straddle a month boundary, so a rollup never implies a range
// the data does not actually cover.
function periodLabel(sorted) {
  if (!sorted.length) return "";
  const first = sorted[0].date;
  const last  = sorted[sorted.length - 1].date;
  if (!first || !last) return "";
  if (first === last) return fmtShort(first);
  const a = new Date(`${first}T00:00:00`);
  const b = new Date(`${last}T00:00:00`);
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (sameMonth) return `${fmtShort(first).replace(/ \d{4}$/, "")} - ${fmtShort(last)}`;
  return `${fmtShort(first)} - ${fmtShort(last)}`;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtShort(isoDate) {
  const [y, m, d] = String(isoDate).split("-");
  if (!y || !m || !d) return isoDate;
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
}
