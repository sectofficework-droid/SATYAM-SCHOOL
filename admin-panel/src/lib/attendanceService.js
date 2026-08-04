import supabase from "./supabase";
import { getStudents } from "./studentService";
import { getClassesWithSections } from "./settingsService";

// student_attendance: student_id, date, status ('P'/'A'), class, marked_by
// - populated from the teacher app's Mark Attendance screen. No FK/join is
// set up between it and students/classes (it just stores the class name as
// plain text), so this stays a simple standalone table read/write here too.

export async function getAttendanceForClassDate(className, date) {
  if (!className || !date) return [];
  const { data, error } = await supabase
    .from("student_attendance")
    .select("student_id, status")
    .eq("class", className)
    .eq("date", date);
  if (error) throw error;
  return data || [];
}

// records: [{ student_id, date, class, status }] - marked_by is left null for
// admin-made corrections so it's distinguishable from a teacher's own entry.
export async function saveAttendanceForClassDate(records) {
  if (!records.length) return;
  const { error } = await supabase
    .from("student_attendance")
    .upsert(records, { onConflict: "student_id,date" });
  if (error) throw error;
}

// A student's attendance history for a date range, most recent first - used
// for the per-student monthly summary view.
export async function getStudentAttendanceHistory(studentId, fromDate, toDate) {
  let query = supabase
    .from("student_attendance")
    .select("date, status")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  if (fromDate) query = query.gte("date", fromDate);
  if (toDate) query = query.lte("date", toDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Attendance Overview (which sections have/haven't marked today) ──────────

// One row per (class, section): how many of that section's students have an
// attendance row for `date`, and who to alert if it's missing. Resolves the
// class teacher via employees.class_teacher_of_section_id - the only id-based
// lookup that actually works; sections.class_teacher is a display name only,
// not joinable back to an employee id (same idiom settingsService.js's
// linkClassTeacher() uses for the reverse direction).
export async function getAttendanceOverviewForDate(date) {
  const [classes, students] = await Promise.all([getClassesWithSections(), getStudents()]);

  const activeSections = [];
  classes.filter(c => c.is_active).forEach(c => {
    (c.sections || []).forEach(s => activeSections.push({
      className: c.name, sectionId: s.id, sectionName: s.name, teacherName: s.class_teacher || "",
    }));
  });
  if (!activeSections.length) return [];

  const rosterBySection = {};
  students.forEach(s => {
    const key = `${s.std}|${s.section}`;
    (rosterBySection[key] ||= []).push(s._studentId);
  });

  const studentIds = students.map(s => s._studentId);
  const { data: attRows, error: attErr } = await supabase
    .from("student_attendance")
    .select("student_id")
    .eq("date", date)
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  if (attErr) throw attErr;
  const markedIds = new Set((attRows || []).map(r => r.student_id));

  const sectionIds = activeSections.map(s => s.sectionId);
  const { data: teacherRows, error: teacherErr } = await supabase
    .from("employees")
    .select("id, name, class_teacher_of_section_id")
    .in("class_teacher_of_section_id", sectionIds.length ? sectionIds : ["00000000-0000-0000-0000-000000000000"]);
  if (teacherErr) throw teacherErr;
  const teacherBySection = {};
  (teacherRows || []).forEach(t => { teacherBySection[t.class_teacher_of_section_id] = t; });

  return activeSections.map(sec => {
    const roster = rosterBySection[`${sec.className}|${sec.sectionName}`] || [];
    const markedCount = roster.filter(id => markedIds.has(id)).length;
    const teacher = teacherBySection[sec.sectionId];
    const status = markedCount === 0 ? "Not Marked" : markedCount === roster.length ? "Marked" : "Partial";
    return {
      className:     sec.className,
      sectionName:   sec.sectionName,
      sectionId:     sec.sectionId,
      teacherId:     teacher?.id || null,
      teacherName:   teacher?.name || sec.teacherName || "",
      totalStudents: roster.length,
      markedCount,
      status,
    };
  }).filter(row => row.totalStudents > 0);
}

export async function sendAttendanceReminder(teacherId, className, sectionName, message) {
  const { error } = await supabase.from("teacher_alerts").insert({
    teacher_id: teacherId,
    title:      `Mark Attendance — ${className}${sectionName ? " - " + sectionName : ""}`,
    message,
  });
  if (error) throw error;
}

// ── Teacher edit requests ────────────────────────────────────────────────────

export async function getPendingEditRequests() {
  const { data, error } = await supabase
    .from("attendance_edit_requests")
    .select("*, teacher:employees(id, name)")
    .eq("status", "Pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function approveEditRequest(request) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("attendance_edit_requests")
    .update({ status: "Approved", approved_at: now, responded_at: now })
    .eq("id", request.id);
  if (error) throw error;

  await supabase.from("teacher_alerts").insert({
    teacher_id: request.teacher_id,
    title:      "Attendance Edit Approved",
    message:    `You can now edit attendance for ${request.class_name}${request.section_name ? " - " + request.section_name : ""} on ${request.date} — this window closes in 10 minutes.`,
  });
}

export async function rejectEditRequest(requestId, adminNote) {
  const { error } = await supabase
    .from("attendance_edit_requests")
    .update({ status: "Rejected", admin_note: adminNote || null, responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}
