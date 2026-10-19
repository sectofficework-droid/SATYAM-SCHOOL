"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, BookOpen } from "lucide-react";
import * as XLSX from "xlsx";
import supabase from "@/lib/supabase";
import { toIsoDateLocal } from "@/lib/utils";

// Same static class list used by Marksheet/ExamsReportSection/StudentDailyLogReportSection.
const CLASSES = [
  "JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
  "10th","11th - Commerce","12th - Commerce",
];

const MARKS_PER_CHECK = 10;

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDateLocal(d);
}

// REQ-FEAT-020 follow-up (2026-10-19) - reads the mobile Teacher app's
// notebook_log table directly (admin panel is `authenticated` +
// is_admin_user()-gated on that table, same RLS pattern as student_daily_log)
// - per student per subject, how many dates in range were checked complete
// out of how many were checked at all, marks = checks_done * MARKS_PER_CHECK
// computed here, never stored.
export default function NotebookReportSection() {
  const [className, setClassName] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6));
  const [dateTo, setDateTo] = useState(daysAgoIso(0));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Subjects actually logged for the selected class, so the table only ever
  // shows real columns instead of a guessed/stale master list.
  useEffect(() => {
    setAvailableSubjects([]);
    if (!className) return;
    let cancelled = false;
    supabase.from("notebook_log").select("subject").eq("class", className)
      .then(({ data, error: err }) => {
        if (cancelled || err) return;
        setAvailableSubjects([...new Set((data || []).map(r => r.subject))].sort());
      });
    return () => { cancelled = true; };
  }, [className]);

  useEffect(() => {
    if (!className || !dateFrom || !dateTo) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    setError("");
    supabase.from("notebook_log")
      .select("student_id, subject, complete")
      .eq("class", className)
      .gte("date", dateFrom).lte("date", dateTo)
      .then(async ({ data: logs, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message || "Failed to load report."); setRows([]); setLoading(false); return; }
        const studentIds = [...new Set((logs || []).map(l => l.student_id))];
        if (studentIds.length === 0) { setRows([]); setLoading(false); return; }
        const { data: students } = await supabase
          .from("students").select("id, first_name, last_name, grno").in("id", studentIds);
        if (cancelled) return;
        const bySubjectList = [...new Set((logs || []).map(l => l.subject))].sort();
        const byStudent = {};
        for (const l of (logs || [])) {
          const agg = byStudent[l.student_id] ||= {};
          const s = agg[l.subject] ||= { done: 0, total: 0 };
          s.total += 1;
          if (l.complete) s.done += 1;
        }
        const built = (students || []).map(s => {
          const bySubject = byStudent[s.id] || {};
          let overallDone = 0, overallTotal = 0;
          for (const subj of bySubjectList) {
            const c = bySubject[subj] || { done: 0, total: 0 };
            overallDone += c.done; overallTotal += c.total;
          }
          return {
            studentId: s.id,
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
            grno: s.grno || "",
            bySubject,
            overallDone, overallTotal,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setAvailableSubjects(bySubjectList);
        setRows(built);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [className, dateFrom, dateTo]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const totalMarks = rows.reduce((s, r) => s + r.overallDone * MARKS_PER_CHECK, 0);
    const maxMarks = rows.reduce((s, r) => s + r.overallTotal * MARKS_PER_CHECK, 0);
    return { totalMarks, maxMarks, pct: maxMarks ? Math.round((totalMarks / maxMarks) * 100) : 0 };
  }, [rows]);

  function exportExcel() {
    const data = rows.map(r => {
      const row = { "Student": r.name, "GR No": r.grno };
      for (const subj of availableSubjects) {
        const c = r.bySubject[subj] || { done: 0, total: 0 };
        row[`${subj} Marks`] = c.done * MARKS_PER_CHECK;
        row[`${subj} Max`] = c.total * MARKS_PER_CHECK;
      }
      row["Overall Marks"] = r.overallDone * MARKS_PER_CHECK;
      row["Overall Max"] = r.overallTotal * MARKS_PER_CHECK;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notebook");
    XLSX.writeFile(wb, `Notebook_${className}_${dateFrom}_to_${dateTo}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class</label>
            <select value={className} onChange={e => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Select class</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">From</label>
            <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">To</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
        </div>
        {availableSubjects.length === 0 && className && !loading && (
          <p className="text-xs text-gray-400">No notebook checks logged for {className} in this date range.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Class Total</p>
            <p className="text-xl font-bold mt-0.5 text-school-navy">{summary.pct}%</p>
            <p className="text-xs text-gray-400">{summary.totalMarks} / {summary.maxMarks} marks</p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <BookOpen className="w-4 h-4 text-school-navy" /> {rows.length} students
            </div>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-600 hover:border-school-navy hover:text-school-navy transition-colors">
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Student</th>
                  <th className="text-left px-3 py-2">GR No</th>
                  {availableSubjects.map(subj => <th key={subj} className="text-center px-3 py-2">{subj}</th>)}
                  <th className="text-center px-3 py-2">Overall</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.studentId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-500">{r.grno}</td>
                    {availableSubjects.map(subj => {
                      const c = r.bySubject[subj] || { done: 0, total: 0 };
                      return (
                        <td key={subj} className="px-3 py-2 text-center text-gray-600">
                          {c.done * MARKS_PER_CHECK}
                          <span className="text-gray-300"> / {c.total * MARKS_PER_CHECK}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-semibold text-school-navy">
                      {r.overallDone * MARKS_PER_CHECK}
                      <span className="text-gray-300 font-normal"> / {r.overallTotal * MARKS_PER_CHECK}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && className && rows.length === 0 && (
        <p className="text-sm text-gray-400">No entries logged for {className} in this date range.</p>
      )}
    </div>
  );
}
