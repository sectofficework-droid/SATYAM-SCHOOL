// REQ-FEAT-019 (2026-10-18) - Student Import Phases.
//
// Every student Add/Replace write (single Add Student, single Edit
// Student, and the three bulk import tools - Import Students, Replace
// Full Details, Basic Details Import) records a "phase": one locked,
// permanent snapshot of the student rows touched in that save/import run,
// in the same column layout as the admin panel's own Import Students /
// Replace Full Details templates - so a phase can be downloaded and
// submitted to the state (UDISE) / national (PEN) student registries
// exactly the way the offline "WEBSITE FD REPLACEMENT.xlsx" workbook
// (one sheet per phase) was being maintained by hand before this existed.
//
// "Locked" means the snapshot is a point-in-time JSONB copy, never a live
// join back to students/student_enrollments - re-downloading an old phase
// must always show what was actually submitted at the time, even if that
// student's data has since changed again in a later phase.
import supabase from "./supabase";

// Same key/label pairs as the super-admin page's own IMPORT_FIELDS +
// enrollmentNo (REPLACE_FIELDS) - kept as an independent copy here rather
// than imported from that page, since this is a plain component file, not
// a module other files import from.
export const PHASE_EXPORT_FIELDS = [
  { key: "enrollmentNo",      label: "Enrollment No" },
  { key: "grNo",               label: "GR Number" },
  { key: "cls",                 label: "Class" },
  { key: "admissionClass",      label: "Admission Class" },
  { key: "section",             label: "Section (A/B/C)" },
  { key: "rollNo",              label: "Roll No" },
  { key: "joinDate",            label: "Date of Joining (DD-MM-YYYY)" },
  { key: "feeTotal",            label: "Fee Total (Rs)" },
  { key: "discountAmount",      label: "Discount Amount (Rs)" },
  { key: "discountReason",      label: "Discount Reason" },
  { key: "firstName",           label: "First Name" },
  { key: "lastName",            label: "Last Name" },
  { key: "fatherName",          label: "Father Name" },
  { key: "motherName",          label: "Mother Name" },
  { key: "dob",                 label: "Date of Birth (DD-MM-YYYY)" },
  { key: "birthCertRegNo",      label: "Birth Cert Reg No" },
  { key: "birthCertRegDate",    label: "Birth Cert Reg Date (DD-MM-YYYY)" },
  { key: "gender",              label: "Gender (Male/Female/Other)" },
  { key: "birthVillage",        label: "Birth Village" },
  { key: "birthCity",           label: "Birth City" },
  { key: "birthDistrict",       label: "Birth District" },
  { key: "birthState",          label: "Birth State" },
  { key: "motherTongue",        label: "Mother Tongue" },
  { key: "religion",            label: "Religion" },
  { key: "caste",               label: "Category / Caste" },
  { key: "subCaste",            label: "Sub Caste" },
  { key: "height",              label: "Height (cm)" },
  { key: "weight",              label: "Weight (kg)" },
  { key: "mobile1",             label: "Mobile 1" },
  { key: "mobile2",             label: "Mobile 2" },
  { key: "roomPlotNo",          label: "Room / Plot No" },
  { key: "society",             label: "Society / Colony" },
  { key: "landmark",            label: "Landmark" },
  { key: "area",                label: "Area / Locality" },
  { key: "pinCode",             label: "Pin Code" },
  { key: "address",             label: "Full Address" },
  { key: "aadharNo",            label: "Aadhar Number" },
  { key: "aadharName",          label: "Aadhar Name" },
  { key: "fatherAadhar",        label: "Father's Aadhar Number" },
  { key: "fatherAadharName",    label: "Father's Name as per Aadhar" },
  { key: "motherAadhar",        label: "Mother's Aadhar Number" },
  { key: "motherAadharName",    label: "Mother's Name as per Aadhar" },
  { key: "udise",               label: "UDISE Number" },
  { key: "pen",                 label: "PEN Number" },
  { key: "apaar",               label: "APAAR ID" },
  { key: "lastSchoolName",      label: "Last School Name" },
  { key: "lastSchoolClass",     label: "Last School Class" },
  { key: "lastSchoolGrNo",      label: "Last School GR No" },
  { key: "lastSchoolMedium",    label: "Last School Medium" },
  { key: "lastSchoolPlace",     label: "Last School Place" },
  { key: "prevAttendanceDays",  label: "Previous Attendance Days" },
  { key: "lastExamGiven",       label: "Last Exam Given (Yes/No)" },
  { key: "prevPercentage",      label: "Previous Percentage" },
];

// Builds one phase-entry snapshot from the same formData shape every
// addStudent()/updateStudent() caller already builds (see studentService.js's
// own field names) - works whether the caller has every field (Import
// Students / Replace Full Details / single Add/Edit) or only the 8 Basic
// Details Import ones (everything else is left blank, which is correct -
// those genuinely aren't known yet until a later "Replaced" phase backfills
// them).
export function buildPhaseSnapshot(payload, enrollmentNo) {
  return {
    enrollmentNo:       enrollmentNo || "",
    grNo:                payload.grNo || "",
    cls:                  payload.std || "",
    admissionClass:       payload.admissionClass || payload.std || "",
    section:              payload.section || "",
    rollNo:               payload.rollNo ?? "",
    joinDate:             payload.joinDate || payload.dateOfJoin || "",
    feeTotal:             payload.feeTotal ?? "",
    discountAmount:       payload.discountAmount ?? "",
    discountReason:       payload.discountReason || "",
    firstName:            payload.firstName || "",
    lastName:             payload.lastName || "",
    fatherName:           payload.fatherName || "",
    motherName:           payload.motherName || "",
    dob:                  payload.dob || "",
    birthCertRegNo:       payload.birthCertRegNo || "",
    birthCertRegDate:     payload.birthCertRegDate || "",
    gender:               payload.gender || "",
    birthVillage:         payload.birthVillage || "",
    birthCity:            payload.birthCity || "",
    birthDistrict:        payload.birthDistrict || "",
    birthState:           payload.birthState || "",
    motherTongue:         payload.motherTongue || "",
    religion:             payload.religion || "",
    caste:                payload.caste || "",
    subCaste:             payload.subCaste || "",
    height:               payload.height ?? "",
    weight:               payload.weight ?? "",
    mobile1:              payload.mobile || "",
    mobile2:              payload.mobile2 || "",
    roomPlotNo:           payload.roomPlotNo || "",
    society:              payload.society || "",
    landmark:             payload.landmark || "",
    area:                 payload.area || "",
    pinCode:              payload.pinCode || "",
    address:              payload.address || "",
    aadharNo:             payload.aadhar || "",
    aadharName:           payload.aadharName || "",
    fatherAadhar:         payload.fatherAadhar || "",
    fatherAadharName:     payload.fatherAadharName || "",
    motherAadhar:         payload.motherAadhar || "",
    motherAadharName:     payload.motherAadharName || "",
    udise:                payload.udise || "",
    pen:                  payload.pen || "",
    apaar:                payload.apaar || "",
    lastSchoolName:       payload.lastSchoolName || "",
    lastSchoolClass:      payload.lastSchoolClass || "",
    lastSchoolGrNo:       payload.lastSchoolGrNo || "",
    lastSchoolMedium:     payload.lastSchoolMedium || "",
    lastSchoolPlace:      payload.lastSchoolPlace || "",
    prevAttendanceDays:   payload.prevAttendanceDays || "",
    lastExamGiven:        payload.lastExamGiven || "",
    prevPercentage:       payload.prevPercentage || "",
  };
}

// type: "Added" | "Replaced". source: a short machine tag identifying
// which tool wrote this phase (shown in the Phases list) - e.g.
// "add_student_form", "edit_student_form", "single_student_update",
// "import_students", "replace_full_details", "basic_details_import".
// entries: [{ studentId, enrollmentNo, snapshot }], one per student row
// actually written in this save/import run. No-ops (returns null) if
// entries is empty - never records an empty phase.
export async function recordPhase({ type, source, createdBy, entries }) {
  if (!entries?.length) return null;
  const { data: phase, error: phaseErr } = await supabase
    .from("student_import_phases")
    .insert({ phase_type: type, source, created_by: createdBy || null, student_count: entries.length })
    .select()
    .single();
  if (phaseErr) throw phaseErr;

  const rows = entries.map(e => ({
    phase_id:      phase.id,
    student_id:    e.studentId || null,
    enrollment_no: e.enrollmentNo || null,
    snapshot:      e.snapshot,
  }));
  const { error: entriesErr } = await supabase.from("student_import_phase_entries").insert(rows);
  if (entriesErr) throw entriesErr;
  return phase;
}

export async function getPhases() {
  const { data, error } = await supabase
    .from("student_import_phases")
    .select("id, phase_number, phase_type, source, student_count, created_at, created_by:admin_users(name)")
    .order("phase_number", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPhaseEntries(phaseId) {
  const { data, error } = await supabase
    .from("student_import_phase_entries")
    .select("id, student_id, enrollment_no, snapshot, created_at")
    .eq("phase_id", phaseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
