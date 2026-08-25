import supabase from "./supabase";

// syllabus: one row per chapter, owned by the teacher who added it (teacher_id
// -> employees). locked/locked_at freeze a (teacher,class,subject)'s chapters
// together - see lockSyllabus in the mobile app's supabase_service.dart.
// syllabus_subtopics: optional children of a chapter, own independent status.
// Both tables have RLS disabled (same convention as exams/exam_marks), so no
// extra grants are needed for the admin panel's authenticated session.

export async function getAllSyllabus() {
  const { data, error } = await supabase
    .from("syllabus")
    .select("*, employees:teacher_id(id, name)")
    .order("class")
    .order("subject")
    .order("sort_order");
  if (error) throw error;
  return (data || []).map(r => ({ ...r, teacherName: r.employees?.name || "—" }));
}

export async function getSubtopicsForChapters(chapterIds) {
  if (!chapterIds.length) return [];
  const { data, error } = await supabase
    .from("syllabus_subtopics")
    .select("*")
    .in("chapter_id", chapterIds)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

// Teaching staff to attribute an admin-added chapter to - syllabus.teacher_id
// is NOT NULL, so adding a chapter from the admin panel still needs a real
// owner (also keeps Teacher-wise growth meaningful instead of an "—" bucket).
export async function getTeachingStaff() {
  const { data, error } = await supabase.from("employees").select("id, name").eq("type", "teaching").order("name");
  if (error) throw error;
  return data || [];
}

// ── Timetable lookup - auto-fills the syllabus importer's subject teacher ──
// Settings → Timetable stores its own class-name spellings ("JR KG",
// "11th Commerce") rather than classes.name ("JR.KG", "11th - Commerce") -
// same drift the mobile app already maps around in supabase_service.dart's
// _timetableClassNameOverrides - and teacher is free text there (no FK), so
// this resolves to a name; the caller matches that against real teaching
// staff to get an id.
const TIMETABLE_CLASS_OVERRIDES = {
  "JR.KG": "JR KG",
  "SR.KG": "SR KG",
  "11th - Commerce": "11th Commerce",
  "12th - Commerce": "12th Commerce",
};

export async function getSubjectTeacherFromTimetable(academicYear, className, subjectName) {
  if (!academicYear || !className || !subjectName) return null;
  const ttClassName = TIMETABLE_CLASS_OVERRIDES[className] || className;
  const { data, error } = await supabase
    .from("timetables")
    .select("teacher")
    .eq("academic_year", academicYear)
    .eq("class_name", ttClassName)
    .eq("subject", subjectName);
  if (error) throw error;
  // Most-frequent non-empty teacher across that class+subject's slots (there
  // can be more than one period a week) - a single subject should only ever
  // have one teacher, but this is defensive against inconsistent data.
  const counts = {};
  (data || []).forEach(r => { if (r.teacher) counts[r.teacher] = (counts[r.teacher] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

// ── Admin CRUD - bypasses the lock entirely, admin edits are authoritative ──

export async function addChapters(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("syllabus").insert(rows);
  if (error) throw error;
}

export async function updateChapterStatus(id, status) {
  const { error } = await supabase.from("syllabus").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteChapter(id) {
  const { error } = await supabase.from("syllabus").delete().eq("id", id);
  if (error) throw error;
}

export async function addSubtopics(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("syllabus_subtopics").insert(rows);
  if (error) throw error;
}

export async function updateSubtopicStatus(id, status) {
  const { error } = await supabase.from("syllabus_subtopics").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteSubtopic(id) {
  const { error } = await supabase.from("syllabus_subtopics").delete().eq("id", id);
  if (error) throw error;
}

// ── Edit requests - same shape as attendance_edit_requests/attendanceService.js ──

export async function getPendingSyllabusEditRequests() {
  const { data, error } = await supabase
    .from("syllabus_edit_requests")
    .select("*, teacher:employees(id, name)")
    .eq("status", "Pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function approveSyllabusEditRequest(request) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("syllabus_edit_requests")
    .update({ status: "Approved", approved_at: now, responded_at: now })
    .eq("id", request.id);
  if (error) throw error;

  await supabase.from("teacher_alerts").insert({
    teacher_id: request.teacher_id,
    title:      "Syllabus Edit Approved",
    message:    `You can now edit the ${request.subject_name} syllabus for ${request.class_name} — this window closes in 24 hours.`,
  });
}

export async function rejectSyllabusEditRequest(requestId, adminNote) {
  const { error } = await supabase
    .from("syllabus_edit_requests")
    .update({ status: "Rejected", admin_note: adminNote || null, responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

// ── Growth analytics ─────────────────────────────────────────────────────
// % = completed leaf units / total leaf units, where a leaf unit is a
// subtopic if the chapter has any, else the chapter itself - same rule the
// mobile app uses for its own growth chips, so the numbers agree everywhere.

function leafCounts(chapters, subtopicsByChapter) {
  let total = 0, completed = 0;
  chapters.forEach(c => {
    const subs = subtopicsByChapter[c.id] || [];
    if (subs.length === 0) {
      total += 1;
      if (c.status === "Completed") completed += 1;
    } else {
      total += subs.length;
      completed += subs.filter(s => s.status === "Completed").length;
    }
  });
  return { total, completed, pct: total ? (completed / total) * 100 : 0 };
}

function groupBy(rows, keyFn) {
  const map = {};
  rows.forEach(r => {
    const key = keyFn(r);
    (map[key] ||= []).push(r);
  });
  return map;
}

// One entry per teacher, aggregating every class+subject they own.
export function computeTeacherGrowth(allSyllabus, subtopicsByChapter) {
  const byTeacher = groupBy(allSyllabus, c => c.teacher_id);
  return Object.entries(byTeacher).map(([teacherId, chapters]) => ({
    id: teacherId,
    name: chapters[0]?.teacherName || "—",
    ...leafCounts(chapters, subtopicsByChapter),
  })).sort((a, b) => b.pct - a.pct);
}

// One entry per class, aggregating every subject/teacher for that class.
export function computeClassGrowth(allSyllabus, subtopicsByChapter) {
  const byClass = groupBy(allSyllabus, c => c.class);
  return Object.entries(byClass).map(([className, chapters]) => ({
    id: className,
    name: className,
    ...leafCounts(chapters, subtopicsByChapter),
  })).sort((a, b) => b.pct - a.pct);
}
