import supabase from "./supabase";

// SEF Settings — mirrors settingsService.js's shape (getX/saveX pairs) but
// scoped to SEF's own, much simpler tables (database/sef_settings_schema.sql).
// Users & Roles has no functions here - it reuses admin_users via the
// school's existing UsersRolesTab component (see settings/page.js).

// ── Institute Profile ──────────────────────────────────────────
export async function getSefProfile() {
  const { data, error } = await supabase.from("sef_profile").select("*").limit(1).single();
  if (error) throw error;
  return data;
}

export async function saveSefProfile(form) {
  const { error } = await supabase
    .from("sef_profile")
    .update({
      name:       form.name?.trim(),
      address:    form.address?.trim(),
      city:       form.city?.trim(),
      state:      form.state?.trim(),
      pincode:    form.pincode?.trim(),
      phone:      form.phone?.trim(),
      email:      form.email?.trim(),
      website:    form.website?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw error;
}

// ── Academic Year ──────────────────────────────────────────────
export async function getSefAcademicYears() {
  const { data, error } = await supabase
    .from("sef_academic_years")
    .select("id, label, is_current")
    .order("label");
  if (error) throw error;
  return data || [];
}

export async function addSefAcademicYear(label) {
  const { data, error } = await supabase
    .from("sef_academic_years")
    .insert({ label, is_current: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSefAcademicYear(id) {
  const { error } = await supabase.from("sef_academic_years").delete().eq("id", id);
  if (error) throw error;
}

export async function setSefCurrentYear(id) {
  await supabase.from("sef_academic_years").update({ is_current: false }).not("id", "is", null);
  const { error } = await supabase.from("sef_academic_years").update({ is_current: true }).eq("id", id);
  if (error) throw error;
}

// ── Classes & Section (Std list) ───────────────────────────────
export async function getSefClasses() {
  const { data, error } = await supabase.from("sef_classes").select("std, sort_order").order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function addSefClass(std) {
  const { data: existing } = await supabase.from("sef_classes").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("sef_classes").insert({ std, sort_order: nextOrder });
  if (error) throw error;
}

export async function removeSefClass(std) {
  const { error } = await supabase.from("sef_classes").delete().eq("std", std);
  if (error) throw error;
}

// ── Per-Std Subjects (feeds Employee's subject-mapping picker, Syllabus,
// and Question Bank's Subject dropdown - see sef_phase2_schema.sql) ─────
export async function getSefStdSubjects(std) {
  let query = supabase.from("sef_std_subjects").select("std, subject, sort_order").order("sort_order");
  if (std) query = query.eq("std", std);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addSefStdSubject(std, subject) {
  const { data: existing } = await supabase
    .from("sef_std_subjects").select("sort_order").eq("std", std)
    .order("sort_order", { ascending: false }).limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("sef_std_subjects").insert({ std, subject, sort_order: nextOrder });
  if (error) throw error;
}

export async function removeSefStdSubject(std, subject) {
  const { error } = await supabase.from("sef_std_subjects").delete().eq("std", std).eq("subject", subject);
  if (error) throw error;
}

// ── Fee Structure ───────────────────────────────────────────────
export async function getSefFeeStructure() {
  const { data, error } = await supabase.from("sef_fee_structure").select("std, default_fee");
  if (error) throw error;
  return data || [];
}

export async function saveSefFeeStructure(std, defaultFee) {
  const { error } = await supabase
    .from("sef_fee_structure")
    .upsert({ std, default_fee: defaultFee }, { onConflict: "std" });
  if (error) throw error;
}

// ── Fee Reminder ────────────────────────────────────────────────
export async function getSefFeeReminderTemplate() {
  const { data, error } = await supabase.from("sef_fee_reminder_template").select("content").eq("id", 1).single();
  if (error) throw error;
  return data?.content || "";
}

export async function saveSefFeeReminderTemplate(content) {
  const { error } = await supabase.from("sef_fee_reminder_template").update({ content }).eq("id", 1);
  if (error) throw error;
}

// ── Rules & Regulations ────────────────────────────────────────
export async function getSefRules() {
  const { data, error } = await supabase.from("sef_rules").select("content").eq("id", 1).single();
  if (error) throw error;
  return data?.content || "";
}

export async function saveSefRules(content) {
  const { error } = await supabase.from("sef_rules").update({ content }).eq("id", 1);
  if (error) throw error;
}
