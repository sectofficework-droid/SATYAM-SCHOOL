import supabase from "./supabase";
import { getOfficialExams } from "./examService";

// Returns [{name, isOptional}] - an optional subject (e.g. MIL (Odia), which
// only some students in a class take) is excluded entirely from a student's
// marksheet whenever no mark was ever entered for it, instead of counting
// as a 0 against them. See each marksheet builder below for where this is
// applied.
export async function getClassSubjects(className) {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("subject_name, is_optional")
    .eq("class_name", className)
    .order("sort_order");
  if (error) throw error;
  return (data || []).map(r => ({ name: r.subject_name, isOptional: !!r.is_optional }));
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
  const enteredByExamStudentSubject = {};
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
      const key = `${m.exam_id}:${m.student_id}:${m.subject_name}`;
      marksByExamStudentSubject[key] = Number(m.marks_obtained) || 0;
      enteredByExamStudentSubject[key] = true;
    });
  }

  const attendanceByStudent = await fetchAttendanceByStudent(students, year);

  const sheets = students.map(s => {
    let totalObtained = 0, totalMax = 0;
    const subjectRows = subjects.map(subject => {
      let subjObtained = 0, subjMax = 0, anyEntered = false;
      const marks = exams.map(exam => {
        const key = `${exam.id}:${s._studentId}:${subject.name}`;
        const entered = !!enteredByExamStudentSubject[key];
        if (entered) anyEntered = true;
        // Optional subject (e.g. MIL (Odia)) with no mark entered for this
        // exam: exclude it from this student's totals entirely instead of
        // counting it as a 0 - it isn't their subject.
        const included = !subject.isOptional || entered;
        const max = included ? (configByExamSubject[`${exam.id}:${subject.name}`] ?? 100) : 0;
        const obtained = included ? (marksByExamStudentSubject[key] || 0) : 0;
        subjObtained += obtained;
        subjMax += max;
        return { obtained, max };
      });
      // Optional subject never entered for this student at all: drop the
      // row from the marksheet completely (not shown, not counted).
      if (subject.isOptional && !anyEntered) return null;
      totalObtained += subjObtained;
      totalMax += subjMax;
      const pct = subjMax ? (subjObtained / subjMax) * 100 : 0;
      return { subject: subject.name, marks, obtained: subjObtained, total: subjMax, grade: gradeFor(pct) };
    }).filter(Boolean);

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

// Same shape as getSingleExamMarksheet, but for the Exams report (Documents
// → Report, not the Marksheet PDF) - keeps the distinction between "not
// entered yet" and a genuine 0 instead of collapsing both to 0, since the
// report needs to flag incomplete entry rather than silently show a false
// zero. Totals/percentage/grade/rank still treat a missing mark as 0 in the
// arithmetic, same numbers the Marksheet PDF would show for this student -
// only the per-subject cell and the new marksEntered/subjectsTotal count
// distinguish "pending" from "scored zero".
export async function getExamReportForClass(students, className, examId) {
  if (!students.length) return [];

  const subjects = await getClassSubjects(className);

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

  const sheets = students.map(s => {
    let totalObtained = 0, totalMax = 0, marksEntered = 0, subjectsTotal = 0;
    const subjectRows = subjects.map(subject => {
      const key = `${s._studentId}:${subject.name}`;
      const entered = Object.prototype.hasOwnProperty.call(marksByStudentSubject, key);
      // Optional subject never entered for this student: not their subject -
      // exclude it entirely instead of showing it as "pending".
      if (subject.isOptional && !entered) return null;
      const max = maxBySubject[subject.name] ?? 100;
      const obtained = entered ? marksByStudentSubject[key] : null;
      if (entered) marksEntered += 1;
      subjectsTotal += 1;
      totalObtained += obtained || 0;
      totalMax += max;
      const pct = max ? ((obtained || 0) / max) * 100 : 0;
      return { subject: subject.name, obtained, max, grade: entered ? gradeFor(pct) : null };
    }).filter(Boolean);

    const percentage = totalMax ? (totalObtained / totalMax) * 100 : 0;

    return {
      studentId:     s._studentId,
      name:          s.name,
      subjectRows,
      totalObtained,
      totalMax,
      percentage,
      grade:         gradeFor(percentage),
      result:        percentage >= 33 ? "Pass" : "Fail",
      marksEntered,
      subjectsTotal,
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
      const key = `${s._studentId}:${subject.name}`;
      const entered = Object.prototype.hasOwnProperty.call(marksByStudentSubject, key);
      // Optional subject never entered for this student: not their subject -
      // exclude it entirely instead of counting it as a 0.
      if (subject.isOptional && !entered) return null;
      const max = maxBySubject[subject.name] ?? 100;
      const obtained = entered ? marksByStudentSubject[key] : 0;
      totalObtained += obtained;
      totalMax += max;
      const pct = max ? (obtained / max) * 100 : 0;
      return { subject: subject.name, obtained, max, grade: gradeFor(pct) };
    }).filter(Boolean);

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
