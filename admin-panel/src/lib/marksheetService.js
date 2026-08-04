import supabase from "./supabase";
import { getOfficialExams } from "./examService";

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

// The admin-managed official exams for the current academic year, in display
// order - the dynamic replacement for the old hardcoded EXAM_TYPES constant.
export async function getCurrentOfficialExams() {
  const year = await getCurrentAcademicYear().catch(() => null);
  if (!year) return [];
  return getOfficialExams(year.id);
}

async function fetchAttendanceByStudent(students, year) {
  const attendanceByStudent = {};
  if (!year) return attendanceByStudent;
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
  return attendanceByStudent;
}

// Ranks a set of already-computed sheets (each needs studentId + totalObtained)
// by totalObtained descending; ties share the same rank.
function withRank(sheets) {
  const sorted = [...sheets].sort((a, b) => b.totalObtained - a.totalObtained);
  const rankByStudent = {};
  sorted.forEach((sheet, i) => {
    rankByStudent[sheet.studentId] = (i > 0 && sheet.totalObtained === sorted[i - 1].totalObtained)
      ? rankByStudent[sorted[i - 1].studentId]
      : i + 1;
  });
  return sheets.map(sheet => ({ ...sheet, rank: rankByStudent[sheet.studentId] }));
}

// Every student passed in should be from the SAME class, so Rank can be
// computed against the whole group. Returns one marksheet object per
// student: per-subject marks for each official exam (0/max when a mark
// hasn't been entered yet), totals, percentage, grade, result, rank within
// the group, and present/total attendance days for the current academic year.
export async function getMarksheetsForClass(students, className) {
  if (!students.length) return [];

  const subjects = await getClassSubjects(className);
  const year = await getCurrentAcademicYear().catch(() => null);
  const exams = await getCurrentOfficialExams();
  const examIds = exams.map(e => e.id);

  const configByExamSubject = {};
  const marksByExamStudentSubject = {};
  if (examIds.length) {
    const { data: configRows, error: configErr } = await supabase
      .from("official_exam_subject_config")
      .select("exam_id, subject_name, max_marks")
      .in("exam_id", examIds)
      .eq("class_name", className);
    if (configErr) throw configErr;
    (configRows || []).forEach(c => {
      configByExamSubject[`${c.exam_id}:${c.subject_name}`] = Number(c.max_marks) || 100;
    });

    const { data: markRows, error: markErr } = await supabase
      .from("official_exam_marks")
      .select("exam_id, student_id, subject_name, marks_obtained")
      .in("exam_id", examIds)
      .eq("class_name", className);
    if (markErr) throw markErr;
    (markRows || []).forEach(m => {
      marksByExamStudentSubject[`${m.exam_id}:${m.student_id}:${m.subject_name}`] = Number(m.marks_obtained) || 0;
    });
  }

  const attendanceByStudent = await fetchAttendanceByStudent(students, year);

  const sheets = students.map(s => {
    let totalObtained = 0, totalMax = 0;
    const subjectRows = subjects.map(subject => {
      let subjObtained = 0, subjMax = 0;
      const marks = exams.map(exam => {
        const max = configByExamSubject[`${exam.id}:${subject}`] ?? 100;
        const obtained = marksByExamStudentSubject[`${exam.id}:${s._studentId}:${subject}`] || 0;
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

  return withRank(sheets);
}

// Same as getMarksheetsForClass but for a single official exam - subjectRows
// has one {obtained,max,grade} entry per subject instead of a per-exam array.
export async function getSingleExamMarksheet(students, className, examId) {
  if (!students.length) return [];

  const subjects = await getClassSubjects(className);
  const year = await getCurrentAcademicYear().catch(() => null);

  const { data: configRows, error: configErr } = await supabase
    .from("official_exam_subject_config")
    .select("subject_name, max_marks")
    .eq("exam_id", examId)
    .eq("class_name", className);
  if (configErr) throw configErr;
  const maxBySubject = {};
  (configRows || []).forEach(c => { maxBySubject[c.subject_name] = Number(c.max_marks) || 100; });

  const { data: markRows, error: markErr } = await supabase
    .from("official_exam_marks")
    .select("student_id, subject_name, marks_obtained")
    .eq("exam_id", examId)
    .eq("class_name", className);
  if (markErr) throw markErr;
  const marksByStudentSubject = {};
  (markRows || []).forEach(m => {
    marksByStudentSubject[`${m.student_id}:${m.subject_name}`] = Number(m.marks_obtained) || 0;
  });

  const attendanceByStudent = await fetchAttendanceByStudent(students, year);

  const sheets = students.map(s => {
    let totalObtained = 0, totalMax = 0;
    const subjectRows = subjects.map(subject => {
      const max = maxBySubject[subject] ?? 100;
      const obtained = marksByStudentSubject[`${s._studentId}:${subject}`] || 0;
      totalObtained += obtained;
      totalMax += max;
      const pct = max ? (obtained / max) * 100 : 0;
      return { subject, obtained, max, grade: gradeFor(pct) };
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

  return withRank(sheets);
}
