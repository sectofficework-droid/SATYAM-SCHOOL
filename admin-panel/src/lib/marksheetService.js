import supabase from "./supabase";

// The school's 3 fixed exams. The mobile app's "Create Exam" form is still
// free text (out of scope to change), so matching an exam to one of these
// slots is a case-insensitive exact match against exams.name - anything
// named differently just won't show up for that slot (renders as 0/100).
export const EXAM_TYPES = ["First Unit Exam", "Half Yearly Exam", "Annual Exam"];

export async function getClassSubjects(className) {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_name")
    .eq("class_name", className)
    .order("sort_order");
  if (error) throw error;
  return (data || []).map(r => r.subject_name);
}

// Standard 8-point CBSE-style scale - our default choice, easy to change
// later if the school uses a different one.
// 91-100 A1 · 81-90 A2 · 71-80 B1 · 61-70 B2 · 51-60 C1 · 41-50 C2 · 33-40 D · <33 E
export function gradeFor(percentage) {
  if (percentage >= 91) return "A1";
  if (percentage >= 81) return "A2";
  if (percentage >= 71) return "B1";
  if (percentage >= 61) return "B2";
  if (percentage >= 51) return "C1";
  if (percentage >= 41) return "C2";
  if (percentage >= 33) return "D";
  return "E";
}

async function getCurrentAcademicYear() {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, label, start_date")
    .eq("is_current", true)
    .single();
  if (error) throw error;
  return data;
}

// Every student passed in should be from the SAME class, so Rank can be
// computed against the whole group. Returns one marksheet object per
// student: per-subject marks for each of the 3 exams (0/100 when an exam
// hasn't been created or a mark hasn't been entered yet), totals,
// percentage, grade, result, rank within the group, and present/total
// attendance days for the current academic year.
export async function getMarksheetsForClass(students, className) {
  if (!students.length) return [];

  const subjects = await getClassSubjects(className);
  const year = await getCurrentAcademicYear().catch(() => null);

  const { data: examRows, error: examErr } = await supabase
    .from("exams")
    .select("id, name, subject, max_marks")
    .ilike("class", className)
    .order("created_at");
  if (examErr) throw examErr;

  // subject (lowercased) -> exam type -> exam row. Iterating in created_at
  // order and overwriting means a duplicate exam for the same
  // class/subject/type keeps the most recently created one.
  const examBySubjectType = {};
  (examRows || []).forEach(e => {
    const subjKey = (e.subject || "").trim().toLowerCase();
    const typeMatch = EXAM_TYPES.find(
      t => t.toLowerCase() === (e.name || "").trim().toLowerCase()
    );
    if (!typeMatch) return;
    if (!examBySubjectType[subjKey]) examBySubjectType[subjKey] = {};
    examBySubjectType[subjKey][typeMatch] = e;
  });

  const examIds = (examRows || []).map(e => e.id);
  const marksByExamStudent = {};
  if (examIds.length) {
    const { data: markRows, error: markErr } = await supabase
      .from("exam_marks")
      .select("exam_id, student_id, marks_obtained")
      .in("exam_id", examIds);
    if (markErr) throw markErr;
    (markRows || []).forEach(m => {
      marksByExamStudent[`${m.exam_id}:${m.student_id}`] = Number(m.marks_obtained) || 0;
    });
  }

  const attendanceByStudent = {};
  if (year) {
    const studentIds = students.map(s => s._studentId);
    const { data: attRows, error: attErr } = await supabase
      .from("student_attendance")
      .select("student_id, status")
      .in("student_id", studentIds)
      .gte("date", year.start_date || "1900-01-01");
    if (attErr) throw attErr;
    (attRows || []).forEach(a => {
      const bucket = attendanceByStudent[a.student_id] || { present: 0, total: 0 };
      bucket.total += 1;
      if (a.status === "P") bucket.present += 1;
      attendanceByStudent[a.student_id] = bucket;
    });
  }

  const sheets = students.map(s => {
    let totalObtained = 0, totalMax = 0;
    const subjectRows = subjects.map(subject => {
      const subjKey = subject.trim().toLowerCase();
      const examTypes = examBySubjectType[subjKey] || {};
      let subjObtained = 0, subjMax = 0;
      const marks = EXAM_TYPES.map(type => {
        const exam = examTypes[type];
        const max = exam ? (Number(exam.max_marks) || 100) : 100;
        const obtained = exam ? (marksByExamStudent[`${exam.id}:${s._studentId}`] || 0) : 0;
        subjObtained += obtained;
        subjMax += max;
        return { obtained, max };
      });
      totalObtained += subjObtained;
      totalMax += subjMax;
      const pct = subjMax ? (subjObtained / subjMax) * 100 : 0;
      return { subject, marks, obtained: subjObtained, total: subjMax, grade: gradeFor(pct) };
    });

    const percentage = totalMax ? (totalObtained / totalMax) * 100 : 0;
    const attendance = attendanceByStudent[s._studentId] || { present: 0, total: 0 };

    return {
      studentId:    s._studentId,
      name:         s.name,
      subjectRows,
      totalObtained,
      totalMax,
      percentage,
      grade:        gradeFor(percentage),
      result:       percentage >= 33 ? "Pass" : "Fail",
      present:      attendance.present,
      totalDays:    attendance.total,
    };
  });

  // Rank by total obtained, descending; ties share the same rank.
  const sorted = [...sheets].sort((a, b) => b.totalObtained - a.totalObtained);
  const rankByStudent = {};
  sorted.forEach((sheet, i) => {
    rankByStudent[sheet.studentId] = (i > 0 && sheet.totalObtained === sorted[i - 1].totalObtained)
      ? rankByStudent[sorted[i - 1].studentId]
      : i + 1;
  });

  return sheets.map(sheet => ({ ...sheet, rank: rankByStudent[sheet.studentId] }));
}
