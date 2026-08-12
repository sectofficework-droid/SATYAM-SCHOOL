import supabase from "./supabase";

// leave_requests: a staff member's request to take leave, with a from/to
// date range and a reason, submitted before the date. Same request/approve/
// reject shape as attendance_edit_requests (attendanceService.js) - approving
// additionally writes the actual leave into employee_attendance (status 'L')
// for every date in the range, which is what makes it "auto marked" rather
// than just an approval record.
//
// employee_attendance: a real day-by-day P/A/L table for staff - previously
// there was none; Employee → Attendance was an Excel-import period summary
// for salary only (Zustand, no table). check_in_at/check_out_at/punch_method
// are written by the standalone Attendance Kiosk app's face-scan punches
// (SUPABASE_FACE_PUNCH.sql) - null for rows set by admin or by leave
// approval, exactly like marked_by already distinguishes those.

export async function getPendingLeaveRequests() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*, employee:employees(id, name)")
    .eq("status", "Pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// All dates from from_date to to_date inclusive, as 'YYYY-MM-DD' strings.
function dateRange(fromDate, toDate) {
  const dates = [];
  const cursor = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export async function approveLeaveRequest(request) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "Approved", responded_at: now })
    .eq("id", request.id);
  if (error) throw error;

  const leaveDays = dateRange(request.from_date, request.to_date).map(date => ({
    employee_id: request.employee_id,
    date,
    status: "L",
    marked_by: null, // system-marked via approval, not a manual mark
  }));
  const { error: attErr } = await supabase
    .from("employee_attendance")
    .upsert(leaveDays, { onConflict: "employee_id,date" });
  if (attErr) throw attErr;

  await supabase.from("teacher_alerts").insert({
    teacher_id: request.employee_id,
    title:      "Leave Request Approved",
    message:    `Your leave from ${request.from_date} to ${request.to_date} has been approved and marked on your attendance.`,
  });
}

export async function rejectLeaveRequest(requestId, adminNote) {
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "Rejected", admin_note: adminNote || null, responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

// ── Day-by-day staff attendance marking (P/A) - so employee_attendance
// isn't leave-only, mirrors getAttendanceForClassDate/saveAttendanceForClassDate
// in attendanceService.js for students. ──────────────────────────────────

export async function getEmployeeAttendanceForDate(date) {
  const { data, error } = await supabase
    .from("employee_attendance")
    .select("employee_id, status, check_in_at, check_out_at, punch_method")
    .eq("date", date);
  if (error) throw error;
  return data || [];
}

// records: [{ employee_id, date, status }]
export async function saveEmployeeAttendanceForDate(records) {
  if (!records.length) return;
  const { error } = await supabase
    .from("employee_attendance")
    .upsert(records, { onConflict: "employee_id,date" });
  if (error) throw error;
}

export async function getEmployeeAttendanceHistory(employeeId, fromDate, toDate) {
  let query = supabase
    .from("employee_attendance")
    .select("date, status, check_in_at, check_out_at, punch_method")
    .eq("employee_id", employeeId)
    .order("date", { ascending: false });
  if (fromDate) query = query.gte("date", fromDate);
  if (toDate) query = query.lte("date", toDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
