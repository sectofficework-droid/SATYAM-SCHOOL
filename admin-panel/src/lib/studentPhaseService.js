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
// "add_student_form", "import_students", "replace_full_details",
// "basic_details_import", or "manual" for a batch created ahead of time
// via Settings > Entry Batches. entries: [{ studentId, enrollmentNo,
// snapshot }], one per student row actually written in this save/import
// run. No-ops (returns null) if entries is empty - never records an empty
// phase.
//
// existingBatchId (2026-10-19, user request: "while doing new entry, new
// import, new replacement, i should be able to select batch") - pass an
// existing student_import_phases.id to add these entries into that batch
// instead of starting a new one (student_count incremented, not
// overwritten), matching the real workflow of processing 5-10 students'
// documents across more than one save/import session but wanting them
// counted as the same batch.
//
// REQ-FEAT-021 (2026-10-22) - callers must not call recordPhase() at all
// when the admin picked "No Batch" in BatchSelector (the new default);
// there is no "skip" value accepted here, the decision is the caller's.
// Single-student Edit/Update tools (edit_student_form,
// single_student_update) dropped this call entirely - they no longer
// record phases under any circumstance, see BatchSelector.js.
export async function recordPhase({ type, source, createdBy, entries, existingBatchId }) {
  if (!entries?.length) return null;
  let phase;
  if (existingBatchId) {
    const { data: current, error: fetchErr } = await supabase
      .from("student_import_phases").select("id, student_count").eq("id", existingBatchId).single();
    if (fetchErr) throw fetchErr;
    const { data: updated, error: updateErr } = await supabase
      .from("student_import_phases")
      .update({ student_count: (current.student_count || 0) + entries.length })
      .eq("id", existingBatchId)
      .select()
      .single();
    if (updateErr) throw updateErr;
    phase = updated;
  } else {
    const { data: created, error: phaseErr } = await supabase
      .from("student_import_phases")
      .insert({ phase_type: type, source, created_by: createdBy || null, student_count: entries.length })
      .select()
      .single();
    if (phaseErr) throw phaseErr;
    phase = created;
  }

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
    .select("id, phase_number, phase_type, source, label, student_count, created_at, created_by:admin_users(name)")
    .order("phase_number", { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── REQ-FEAT-021 (2026-10-22) — Batch Management (Settings) ────────────────
// Lets senior_admin/management create an empty batch ahead of time, rename
// it, delete it outright, or move/remove individual student entries after
// the fact - the follow-up to making batch selection manual-only (see
// BatchSelector.js) so an admin isn't stuck with whatever recordPhase()
// auto-created.

// Creates an empty batch with no entries yet (student_count 0) so it shows
// up in BatchSelector immediately, ready to be picked while entering
// students. source is "manual" to distinguish it in the Entry Batches
// report from the auto-recorded sources (add_student_form, import_students,
// etc.) - `source` is a free-text column with no CHECK constraint, so this
// needed no migration beyond adding `label`.
export async function createEmptyBatch({ type, label, createdBy }) {
  const { data, error } = await supabase
    .from("student_import_phases")
    .insert({ phase_type: type, source: "manual", label: label || null, created_by: createdBy || null, student_count: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameBatch(phaseId, label) {
  const { error } = await supabase
    .from("student_import_phases")
    .update({ label: label || null })
    .eq("id", phaseId);
  if (error) throw error;
}

// Deletes a batch and (via the table's ON DELETE CASCADE) every entry
// snapshot recorded under it. Permanent - the caller must disclose this per
// §J4 before calling.
export async function deleteBatch(phaseId) {
  const { error } = await supabase.from("student_import_phases").delete().eq("id", phaseId);
  if (error) throw error;
}

// Removes one student's entry from a batch (e.g. they were added to the
// wrong one) and recomputes that batch's student_count from what's
// actually left, rather than leaving the old incremented value stale.
export async function deletePhaseEntry(entryId, phaseId) {
  const { error } = await supabase.from("student_import_phase_entries").delete().eq("id", entryId);
  if (error) throw error;
  if (phaseId) await recomputeBatchCount(phaseId);
}

// Re-assigns one entry to a different batch (fixes a student put in the
// wrong batch without re-entering their data) and recomputes both the
// source and destination batch counts afterward.
export async function moveEntryToBatch({ entryId, fromPhaseId, toPhaseId }) {
  const { error } = await supabase
    .from("student_import_phase_entries")
    .update({ phase_id: toPhaseId })
    .eq("id", entryId);
  if (error) throw error;
  await Promise.all([
    fromPhaseId ? recomputeBatchCount(fromPhaseId) : Promise.resolve(),
    recomputeBatchCount(toPhaseId),
  ]);
}

// student_count is a counter recordPhase() increments on write - it was
// never derived from the entries table, so it already over-counts a
// student saved twice into the same batch, and will drift further now
// that entries can be removed/moved after the fact. Recomputes it from a
// real count of student_import_phase_entries for that phase.
export async function recomputeBatchCount(phaseId) {
  const { count, error: countErr } = await supabase
    .from("student_import_phase_entries")
    .select("id", { count: "exact", head: true })
    .eq("phase_id", phaseId);
  if (countErr) throw countErr;
  const { error } = await supabase
    .from("student_import_phases")
    .update({ student_count: count || 0 })
    .eq("id", phaseId);
  if (error) throw error;
  return count || 0;
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

// REQ-FEAT-019 follow-up (2026-10-19) - 428 students were given basic
// details up front; since then, full details are being completed in small
// batches (5-10 students, whenever their documents physically arrive in
// the office) - each batch is one "Replaced" phase. The user wants to know,
// per student, which phase(s) they were completed in, specifically to
// catch a student accidentally included in a second batch (redone twice).
// Grouped client-side rather than via a DB aggregate - same pattern this
// file already uses elsewhere, and keeps the "locked" per-phase detail
// (name/class as recorded at that time) directly from each entry's own
// snapshot, no extra join back to the live students table needed.
export async function getReplacedStudentPhases() {
  const { data, error } = await supabase
    .from("student_import_phase_entries")
    .select("student_id, enrollment_no, snapshot, created_at, phase:student_import_phases!inner(phase_number, phase_type, created_at)")
    .eq("phase.phase_type", "Replaced")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byStudent = new Map();
  for (const row of data || []) {
    // Fall back to enrollment_no when student_id is null (a permanently
    // deleted student whose historical entries still exist) so that case
    // still groups sensibly instead of colliding under a single "null" key.
    const key = row.student_id || `enr:${row.enrollment_no}`;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        studentId:    row.student_id,
        enrollmentNo: row.enrollment_no,
        name:         `${row.snapshot?.firstName || ""} ${row.snapshot?.lastName || ""}`.trim(),
        cls:          row.snapshot?.cls || "",
        phases:       [],
      });
    }
    byStudent.get(key).phases.push({ phaseNumber: row.phase.phase_number, createdAt: row.created_at });
  }
  return Array.from(byStudent.values()).sort((a, b) => b.phases.length - a.phases.length || a.name.localeCompare(b.name));
}

// REQ-FEAT-019 follow-up (2026-10-19, user request: "in report udise entry
// and pen entry add a filter of batch") - the original motivation for the
// whole Phases/Batch feature: let the user filter the UDISE (State) / PEN
// (National) Entry reports down to just the students touched by one chosen
// batch, so they can submit only the latest added/replaced students to the
// registries instead of re-submitting everyone each time. Returns every
// entry's enrollment_no + phase_number (no enrollment_no = nothing to match
// against a student row, so those are skipped).
export async function getAllPhaseEntryEnrollments() {
  const { data, error } = await supabase
    .from("student_import_phase_entries")
    .select("enrollment_no, phase:student_import_phases!inner(phase_number)")
    .not("enrollment_no", "is", null);
  if (error) throw error;
  return (data || []).map(r => ({ enrollmentNo: r.enrollment_no, phaseNumber: r.phase.phase_number }));
}
