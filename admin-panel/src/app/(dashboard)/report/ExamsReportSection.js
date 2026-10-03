"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Award } from "lucide-react";
import * as XLSX from "xlsx";
import { getStudents } from "@/lib/studentService";
import { getCurrentOfficialExams, getExamReportForClass } from "@/lib/marksheetService";
import { toIsoDateLocal } from "@/lib/utils";

// Same static class list used by the Marksheet feature (documents/page.js)
// and the rest of the Reports module - kept local rather than imported from
// report/page.js to avoid coupling this self-contained section to that
// file's internals.
const CLASSES = [
  "JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
  "10th","11th - Commerce","12th - Commerce",
];

const COLOR_MAP = {
  blue:   {bg:"bg-blue-50",   border:"border-blue-200",   label:"text-blue-600",   val:"text-blue-700"  },
  green:  {bg:"bg-green-50",  border:"border-green-200",  label:"text-green-600",  val:"text-green-700" },
  red:    {bg:"bg-red-50",    border:"border-red-200",    label:"text-red-600",    val:"text-red-700"   },
  amber:  {bg:"bg-amber-50",  border:"border-amber-200",  label:"text-amber-600",  val:"text-amber-700" },
};

function SummaryTile({ label, value, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${c.label}`}>{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${c.val}`}>{value}</p>
    </div>
  );
}

// This report's shape (one dynamic subject column per class, tracking
// "not entered yet" distinctly from a real zero) doesn't fit the generic
// flat columns/FIELD_POOL engine the other 6 report types in this page
// share (static, pre-declared column lists) - so it's a fully self-
// contained section instead, reusing the exact same grading/rank logic
// (marksheetService.js) the Marksheet PDF already ships, just surfaced as
// a browsable/exportable table instead of a printed sheet.
export default function ExamsReportSection() {
  const [exams, setExams] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);

  const [examId, setExamId] = useState("");
  const [className, setClassName] = useState("");
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingBase(true);
    Promise.all([getCurrentOfficialExams(), getStudents()])
      .then(([ex, students]) => {
        if (cancelled) return;
        setExams(ex || []);
        setAllStudents(students || []);
      })
      .catch(() => { if (!cancelled) { setExams([]); setAllStudents([]); } })
      .finally(() => { if (!cancelled) setLoadingBase(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!examId || !className) { setRows([]); return; }
    let cancelled = false;
    setLoadingRows(true);
    setError("");
    const classmates = allStudents.filter(s => s.std === className);
    getExamReportForClass(classmates, className, examId)
      .then(r => { if (!cancelled) setRows(r); })
      .catch(e => { if (!cancelled) { setError(e.message || "Failed to load exam report."); setRows([]); } })
      .finally(() => { if (!cancelled) setLoadingRows(false); });
    return () => { cancelled = true; };
  }, [examId, className, allStudents]);

  const subjectNames = useMemo(() => rows[0]?.subjectRows.map(r => r.subject) || [], [rows]);
  const selectedExam = exams.find(e => e.id === examId);

  const summary = useMemo(() => {
    if (!rows.length) return [];
    const avgPct = rows.reduce((s, r) => s + r.percentage, 0) / rows.length;
    const passCount = rows.filter(r => r.result === "Pass").length;
    const fullyEntered = rows.filter(r => r.marksEntered === r.subjectsTotal).length;
    return [
      { label: "Students",       value: rows.length,                         color: "blue"  },
      { label: "Class Average",  value: `${avgPct.toFixed(1)}%`,              color: "green" },
      { label: "Pass Rate",      value: `${((passCount / rows.length) * 100).toFixed(1)}%`, color: "amber" },
      { label: "Fully Entered",  value: `${fullyEntered} / ${rows.length}`,   color: fullyEntered === rows.length ? "green" : "red" },
    ];
  }, [rows]);

  function exportCsv() {
    if (!rows.length) return;
    const header = ["Student Name", ...subjectNames, "Total", "Percentage", "Grade", "Rank", "Result", "Marks Entered"];
    const body = rows.map(r => [
      r.name,
      ...r.subjectRows.map(sr => sr.obtained === null ? "Pending" : `${sr.obtained}/${sr.max}`),
      r.totalObtained,
      `${r.percentage.toFixed(2)}%`,
      r.grade,
      r.rank,
      r.result,
      `${r.marksEntered}/${r.subjectsTotal}`,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam Report".slice(0, 31));
    const examLabel = (selectedExam?.name || "Exam").replace(/[\s/]+/g, "_");
    XLSX.writeFile(wb, `${examLabel}_${className.replace(/[\s/]+/g,"_")}_${toIsoDateLocal(new Date())}.xlsx`);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exam</label>
          <select value={examId} onChange={e => setExamId(e.target.value)} disabled={loadingBase}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-48">
            <option value="">Select an exam…</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</label>
          <select value={className} onChange={e => setClassName(e.target.value)} disabled={loadingBase}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-40">
            <option value="">Select a class…</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {rows.length > 0 && (
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 ml-auto px-4 py-2 rounded-lg bg-school-navy text-white text-xs font-semibold hover:bg-school-navy/90 transition-colors">
            <Download className="w-3.5 h-3.5"/> Export
          </button>
        )}
      </div>

      {/* Body */}
      {loadingBase ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
      ) : !examId || !className ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
          <Award className="w-10 h-10 text-gray-300"/>
          <p className="text-sm">Select an exam and a class to view results.</p>
        </div>
      ) : loadingRows ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading results…</div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-sm text-red-500">{error}</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">No students found in {className}.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.map(s => <SummaryTile key={s.label} {...s} />)}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50">Student</th>
                  {subjectNames.map(sub => (
                    <th key={sub} className="px-3 py-2 text-center font-semibold text-gray-500 whitespace-nowrap">{sub}</th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Total</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">%</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Grade</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Rank</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">Result</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 whitespace-nowrap">Marks Entered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.studentId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white whitespace-nowrap">{r.name}</td>
                    {r.subjectRows.map(sr => (
                      <td key={sr.subject} className="px-3 py-2 text-center whitespace-nowrap">
                        {sr.obtained === null
                          ? <span className="text-amber-500 font-medium">Pending</span>
                          : <span className="text-gray-700">{sr.obtained}/{sr.max}</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-gray-700">{r.totalObtained}/{r.totalMax}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{r.percentage.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center text-gray-700">{r.grade}</td>
                    <td className="px-3 py-2 text-center text-gray-700">{r.rank}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.result === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {r.result}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={r.marksEntered === r.subjectsTotal ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                        {r.marksEntered}/{r.subjectsTotal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
