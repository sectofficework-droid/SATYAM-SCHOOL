import supabase from "./supabase";
import { toIsoDateLocal } from "./utils";

// ── Monthly Test — default full marks (admin-configurable, still 25 by default) ──
// Stored on the single-row school_profile table. The teacher app reads this
// when creating a new Monthly Test instead of a hardcoded value, so
// management can change it here without an app release.

export async function getMonthlyTestMaxMarks() {
  const { data, error } = await supabase
    .from("school_profile")
    .select("monthly_test_max_marks")
    .limit(1)
    .single();
  if (error) throw error;
  return data?.monthly_test_max_marks ?? 25;
}

export async function saveMonthlyTestMaxMarks(maxMarks) {
  const { error } = await supabase
    .from("school_profile")
    .update({ monthly_test_max_marks: maxMarks, updated_at: new Date().toISOString() })
    .not("id", "is", null);
  if (error) throw error;
}

// ── Monthly Tests (freeform, created by subject teachers in the app) ──────
// Read-only for admin - teachers still create/manage these from the mobile
// app; this just gives management visibility into what's been scheduled
// and marked, matching what the "Official Exams" section below already
// gives for the admin-managed exams. exams.created_by -> employees(id) is
// an FK, so Supabase can embed the teacher's name in one query.

export async function getMonthlyTests() {
  const { data, error } = await supabase
    .from("exams")
    .select("id, name, class, subject, date, max_marks, employees:created_by(name)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(e => ({
    id: e.id,
    name: e.name,
    class: e.class,
    subject: e.subject,
    date: e.date,
    maxMarks: e.max_marks,
    teacherName: e.employees?.name || "—",
  }));
}

export async function getMonthlyTestMarks(examId) {
  const { data, error } = await supabase
    .from("exam_marks")
    .select("student_id, marks_obtained, students:student_id(first_name, last_name)")
    .eq("exam_id", examId);
  if (error) throw error;
  return (data || [])
    .map(m => ({
      studentId: m.student_id,
      name: `${m.students?.first_name || ""} ${m.students?.last_name || ""}`.trim(),
      marks: m.marks_obtained,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
  const today = toIsoDateLocal(new Date());
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

// Applies one "full marks" value to every class+subject at once (e.g. when
// a new exam is created) - a single bulk upsert rather than one call per
// subject. Individual subjects can still be edited afterward via
// saveExamSubjectMaxMarks, same as today.
export async function saveExamSubjectMaxMarksBulk(examId, rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("official_exam_subject_config")
    .upsert(
      rows.map(r => ({ exam_id: examId, class_name: r.className, subject_name: r.subjectName, max_marks: r.maxMarks })),
      { onConflict: "exam_id,class_name,subject_name" }
    );
  if (error) throw error;
}

// What's actually been entered so far for one official exam + class - same
// data the teacher app's "Class Overview" table shows, so admin doesn't have
// to ask a teacher whether marks are in yet. Only returns rows that have
// been marked (not a blank roster row per student).
export async function getOfficialExamMarksEntered(examId, className) {
  const { data, error } = await supabase
    .from("official_exam_marks")
    .select("student_id, subject_name, marks_obtained, students:student_id(first_name, last_name)")
    .eq("exam_id", examId)
    .eq("class_name", className);
  if (error) throw error;
  return (data || [])
    .map(m => ({
      studentId: m.student_id,
      name: `${m.students?.first_name || ""} ${m.students?.last_name || ""}`.trim(),
      subject: m.subject_name,
      marks: m.marks_obtained,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.subject.localeCompare(b.subject));
}

// REQ-FEAT-009: admin write access to official exam marks - previously the
// web was entirely read-only here (entry was Teacher-app-only, see the
// function above). Upserts on the same (exam_id, student_id, subject_name)
// unique constraint the table already enforces. isAbsent also zeroes
// marks_obtained, so a subject an admin marks absent never carries a stray
// leftover score if it's later unmarked.
export async function saveOfficialExamMark(examId, studentId, className, subjectName, marksObtained, isAbsent) {
  const { error } = await supabase
    .from("official_exam_marks")
    .upsert(
      {
        exam_id: examId, student_id: studentId, class_name: className, subject_name: subjectName,
        marks_obtained: isAbsent ? 0 : (Number(marksObtained) || 0), is_absent: !!isAbsent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "exam_id,student_id,subject_name" }
    );
  if (error) throw error;
}

// ── Student report-card remark (REQ-FEAT-009) ──────────────────────────────
// One admin-editable remark per student per academic year, shown on the
// marksheet in place of the auto-generated grade-tiered comment when set.

export async function getCurrentAcademicYearId() {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function saveStudentRemark(studentId, academicYearId, remark) {
  const { error } = await supabase
    .from("student_remarks")
    .upsert(
      { student_id: studentId, academic_year_id: academicYearId, remark, updated_at: new Date().toISOString() },
      { onConflict: "student_id,academic_year_id" }
    );
  if (error) throw error;
}
