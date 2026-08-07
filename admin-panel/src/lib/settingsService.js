import supabase from "./supabase";

// ── School Profile ─────────────────────────────────────────────
export async function getSchoolProfile() {
  const { data, error } = await supabase
    .from("school_profile")
    .select("*")
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function saveSchoolProfile(form) {
  const { error } = await supabase
    .from("school_profile")
    .update({
      name:       form.name?.trim(),
      address:    form.address?.trim(),
      city:       form.city?.trim(),
      state:      form.state?.trim(),
      pincode:    form.pin?.trim(),
      phone:      form.phone?.trim(),
      email:      form.email?.trim(),
      website:    form.website?.trim() || null,
      board:      form.board,
      medium:     form.medium,
      udise:      form.udise?.trim(),
      updated_at: new Date().toISOString(),
    })
    .not("id", "is", null);
  if (error) throw error;
}

// ── Help Desk — Admin Numbers (Student app) ──────────────────────
export async function getHelpDeskAdminNumbers() {
  const { data, error } = await supabase
    .from("helpdesk_admin_numbers")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

// Wholesale replace — simplest correct approach for a small admin-managed
// list that already lives inside one form-level Save (no per-row diffing).
export async function saveHelpDeskAdminNumbers(numbers) {
  const { error: delErr } = await supabase
    .from("helpdesk_admin_numbers")
    .delete()
    .not("id", "is", null);
  if (delErr) throw delErr;
  if (!numbers.length) return;
  const { error: insErr } = await supabase
    .from("helpdesk_admin_numbers")
    .insert(numbers.map((n, i) => ({ label: n.label.trim(), phone: n.phone.trim(), sort_order: i })));
  if (insErr) throw insErr;
}

// ── Academic Years ─────────────────────────────────────────────
export async function getAcademicYears() {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, label, is_current, admission_date, readmission_date")
    .order("label");
  if (error) throw error;
  return data || [];
}

export async function addAcademicYear(label) {
  const { data, error } = await supabase
    .from("academic_years")
    .insert({ label, is_current: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAcademicYear(id) {
  const { error } = await supabase
    .from("academic_years")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function saveCurrentYear(yearId, { admissionDate, readmissionDate }) {
  await supabase
    .from("academic_years")
    .update({ is_current: false })
    .not("id", "is", null);
  const { error } = await supabase
    .from("academic_years")
    .update({
      is_current:       true,
      admission_date:   admissionDate || null,
      readmission_date: readmissionDate || null,
    })
    .eq("id", yearId);
  if (error) throw error;
}

// ── Fee Structures ─────────────────────────────────────────────
export async function getFeeStructuresForYear(yearId) {
  const { data, error } = await supabase
    .from("fee_structures")
    .select("class_id, tuition_amount, uniform_amount, old_student_discount, classes(id, name, sort_order)")
    .eq("academic_year_id", yearId);
  if (error) throw error;
  return (data || []).sort(
    (a, b) => (a.classes?.sort_order ?? 99) - (b.classes?.sort_order ?? 99)
  );
}

// { [className]: tuition+uniform } for the current academic year — used to
// auto-fill a student's fee total from their class instead of manual entry.
export async function getCurrentYearClassFees() {
  const { data: yr } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .single();
  if (!yr) return {};
  const { data, error } = await supabase
    .from("fee_structures")
    .select("tuition_amount, uniform_amount, classes(name)")
    .eq("academic_year_id", yr.id);
  if (error || !data) return {};
  return Object.fromEntries(
    data
      .filter(r => r.classes?.name)
      .map(r => [r.classes.name, (Number(r.tuition_amount) || 0) + (Number(r.uniform_amount) || 0)])
  );
}

export async function saveFeeStructuresForYear(yearId, rows, oldDiscount) {
  const { error } = await supabase
    .from("fee_structures")
    .upsert(
      rows.map(r => ({
        academic_year_id:     yearId,
        class_id:             r.classId,
        tuition_amount:       r.tuition,
        uniform_amount:       r.uniform,
        old_student_discount: oldDiscount,
        updated_at:           new Date().toISOString(),
      })),
      { onConflict: "academic_year_id,class_id" }
    );
  if (error) throw error;
}

// ── Active Classes (for dropdowns across the app) ─────────────
export async function getActiveClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("name, sort_order, sections(name)")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

// ── Classes & Sections ─────────────────────────────────────────
export async function getClassesWithSections() {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, sort_order, is_active, sections(id, name, class_teacher, section_supporting_teachers(employee_id, employees(id, name)))")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function setClassActiveInDB(classId, isActive) {
  const { error } = await supabase
    .from("classes")
    .update({ is_active: isActive })
    .eq("id", classId);
  if (error) throw error;
}

export async function insertSection(classId, name, classTeacherName = null, teacherId = null) {
  const { data, error } = await supabase
    .from("sections")
    .insert({ class_id: classId, name, class_teacher: classTeacherName || null })
    .select()
    .single();
  if (error) throw error;
  if (teacherId) await linkClassTeacher(data.id, teacherId);
  return data;
}

// Teaching staff, for the Classes & Sections "class teacher" picker.
export async function getTeachingEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("type", "teaching")
    .order("name");
  if (error) throw error;
  return data || [];
}

// Points employees.class_teacher_of_section_id at this section (and frees
// whichever employee previously held it) — this is the field the mobile
// app's teacher_login RPC actually reads.
async function linkClassTeacher(sectionId, teacherId) {
  const { error: clearErr } = await supabase
    .from("employees")
    .update({ class_teacher_of_section_id: null })
    .eq("class_teacher_of_section_id", sectionId);
  if (clearErr) throw clearErr;

  if (teacherId) {
    // If this teacher was class teacher of a DIFFERENT section, clear that
    // section's class_teacher text too — otherwise it keeps showing this
    // teacher's name in Settings even after they've moved sections, while
    // the mobile app (which reads the employee-side link) already sees them
    // as having no section.
    const { data: existing, error: fetchErr } = await supabase
      .from("employees")
      .select("class_teacher_of_section_id")
      .eq("id", teacherId)
      .single();
    if (fetchErr) throw fetchErr;
    if (existing?.class_teacher_of_section_id && existing.class_teacher_of_section_id !== sectionId) {
      const { error: staleErr } = await supabase
        .from("sections")
        .update({ class_teacher: null })
        .eq("id", existing.class_teacher_of_section_id);
      if (staleErr) throw staleErr;
    }

    const { error: linkErr } = await supabase
      .from("employees")
      .update({ class_teacher_of_section_id: sectionId })
      .eq("id", teacherId);
    if (linkErr) throw linkErr;
  }
}

export async function updateSectionTeacher(sectionId, teacherName, teacherId = null) {
  await linkClassTeacher(sectionId, teacherId);
  const { error } = await supabase
    .from("sections")
    .update({ class_teacher: teacherName || null })
    .eq("id", sectionId);
  if (error) throw error;
}

// Supporting teachers get the same mobile-app section access as the class
// teacher (see teacher_login RPC) — any number of them per section.
export async function addSupportingTeacher(sectionId, employeeId) {
  const { error } = await supabase
    .from("section_supporting_teachers")
    .insert({ section_id: sectionId, employee_id: employeeId });
  if (error) throw error;
}

export async function removeSupportingTeacher(sectionId, employeeId) {
  const { error } = await supabase
    .from("section_supporting_teachers")
    .delete()
    .eq("section_id", sectionId)
    .eq("employee_id", employeeId);
  if (error) throw error;
}

export async function deleteSectionFromDB(sectionId) {
  await linkClassTeacher(sectionId, null);
  const { error } = await supabase
    .from("sections")
    .delete()
    .eq("id", sectionId);
  if (error) throw error;
}

// ── Subjects per Class (used by the Marksheet report) ──────────
// Keyed by class NAME (matching classes.name's "JR.KG" / "11th - Commerce"
// format, not the Zustand-store "JR KG" format) — this is the same format
// the mobile app's exams.class column stores, which is what the marksheet
// report joins against.
export async function getAllClassSubjects() {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("class_name, subject_name, sort_order")
    .order("sort_order");
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => {
    if (!map[r.class_name]) map[r.class_name] = [];
    map[r.class_name].push(r.subject_name);
  });
  return map;
}

export async function saveClassSubjects(className, subjectNames) {
  const trimmed = subjectNames.map(s => s.trim()).filter(Boolean);

  const { data: existing, error: fetchErr } = await supabase
    .from("class_subjects")
    .select("id, subject_name")
    .eq("class_name", className);
  if (fetchErr) throw fetchErr;

  const toDelete = (existing || [])
    .filter(r => !trimmed.includes(r.subject_name))
    .map(r => r.id);
  if (toDelete.length) {
    const { error } = await supabase.from("class_subjects").delete().in("id", toDelete);
    if (error) throw error;
  }

  if (trimmed.length) {
    const { error } = await supabase
      .from("class_subjects")
      .upsert(
        trimmed.map((subject_name, i) => ({ class_name: className, subject_name, sort_order: i })),
        { onConflict: "class_name,subject_name" }
      );
    if (error) throw error;
  }
}

// ── Rules & Regulations (one row per audience, shown read-only in the app) ──
export async function getSchoolRules() {
  const { data, error } = await supabase
    .from("school_rules")
    .select("audience, content, updated_at");
  if (error) throw error;
  const byAudience = { teacher: "", student: "" };
  (data || []).forEach(r => { byAudience[r.audience] = r.content || ""; });
  return byAudience;
}

export async function saveSchoolRules(audience, content) {
  const { error } = await supabase
    .from("school_rules")
    .upsert({ audience, content, updated_at: new Date().toISOString() });
  if (error) throw error;
}
