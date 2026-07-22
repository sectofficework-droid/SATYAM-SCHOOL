import supabase from "./supabase";

// student_attendance: student_id, date, status ('P'/'A'/'L'), class, marked_by
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
