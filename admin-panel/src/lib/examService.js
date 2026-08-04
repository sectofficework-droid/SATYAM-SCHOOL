import supabase from "./supabase";

// ── Official Exams (First Unit Test / Half Yearly / Annual, admin-managed) ──
// Separate from the freeform teacher-created exams/exam_marks tables - these
// are the school-wide official exams management can add/remove, with marks
// entry auto-unlocking once each exam's end_date passes.

export async function getOfficialExams(academicYearId) {
  let query = supabase.from("official_exams").select("*").order("sort_order");
  if (academicYearId) query = query.eq("academic_year_id", academicYearId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createOfficialExam({ name, startDate, endDate, academicYearId, sortOrder = 0 }) {
  const { data, error } = await supabase
    .from("official_exams")
    .insert({ name, start_date: startDate, end_date: endDate, academic_year_id: academicYearId, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOfficialExam(id, { name, startDate, endDate, sortOrder }) {
  const { error } = await supabase
    .from("official_exams")
    .update({ name, start_date: startDate, end_date: endDate, sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteOfficialExam(id) {
  const { error } = await supabase.from("official_exams").delete().eq("id", id);
  if (error) throw error;
}

// Marks entry unlocks the day the exam ends - no separate stored status.
export function isExamUnlocked(exam) {
  const today = new Date().toISOString().slice(0, 10);
  return today >= exam.end_date;
}

export async function getExamSubjectConfig(examId) {
  const { data, error } = await supabase
    .from("official_exam_subject_config")
    .select("class_name, subject_name, max_marks")
    .eq("exam_id", examId);
  if (error) throw error;
  return data || [];
}

export async function saveExamSubjectMaxMarks(examId, className, subjectName, maxMarks) {
  const { error } = await supabase
    .from("official_exam_subject_config")
    .upsert(
      { exam_id: examId, class_name: className, subject_name: subjectName, max_marks: maxMarks },
      { onConflict: "exam_id,class_name,subject_name" }
    );
  if (error) throw error;
}
