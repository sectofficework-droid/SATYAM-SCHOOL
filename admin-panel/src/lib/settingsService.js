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
    .select("id, name, sort_order, is_active, sections(id, name, class_teacher)")
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

export async function insertSection(classId, name, classTeacher = null) {
  const { data, error } = await supabase
    .from("sections")
    .insert({ class_id: classId, name, class_teacher: classTeacher || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSectionTeacher(sectionId, teacher) {
  const { error } = await supabase
    .from("sections")
    .update({ class_teacher: teacher || null })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function deleteSectionFromDB(sectionId) {
  const { error } = await supabase
    .from("sections")
    .delete()
    .eq("id", sectionId);
  if (error) throw error;
}
