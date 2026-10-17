"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, ListChecks } from "lucide-react";
import * as XLSX from "xlsx";
import supabase from "@/lib/supabase";
import { toIsoDateLocal } from "@/lib/utils";

// Same static class list used by the Marksheet feature (documents/page.js)
// and ExamsReportSection - kept local rather than imported from report/page.js
// to avoid coupling this self-contained section to that file's internals.
const CLASSES = [
  "JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
  "10th","11th - Commerce","12th - Commerce",
];

const ITEMS = [
  { key: "homework_done",  label: "Homework"      },
  { key: "classwork_done", label: "Classwork"     },
  { key: "attentive",      label: "Attentiveness" },
  { key: "diary_done",     label: "Diary"         },
];

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIsoDateLocal(d);
}

// REQ-FEAT-017 (2026-10-17) - reads the mobile Teacher app's new
// student_daily_log table directly (admin panel is `authenticated` + is_
// admin_user()-gated on that table, same RLS pattern as the other REQ-SEC-002
// tables) - a rollup/report view over the daily Homework/Classwork/
// Attentiveness/Diary entries teachers log per class-subject-date. "Weekly"
// is just this report's date range, not a separate stored grain - each row
// underneath is still one real calendar day.
export default function StudentDailyLogReportSection() {
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [dateFrom, setDateFrom] = useState(daysAgoIso(6));
  const [dateTo, setDateTo] = useState(daysAgoIso(0));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Subjects actually logged for the selected class, so the picker only ever
  // offers real options instead of a guessed/stale master list.
  useEffect(() => {
    setSubject("");
    setAvailableSubjects([]);
    if (!className) return;
    let cancelled = false;
    supabase.from("student_daily_log").select("subject").eq("class", className)
      .then(({ data, error: err }) => {
        if (cancelled || err) return;
        setAvailableSubjects([...new Set((data || []).map(r => r.subject))].sort());
      });
    return () => { cancelled = true; };
  }, [className]);

  useEffect(() => {
    if (!className || !subject || !dateFrom || !dateTo) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    setError("");
    supabase.from("student_daily_log")
      .select("student_id, date, homework_done, classwork_done, attentive, diary_done")
      .eq("class", className).eq("subject", subject)
      .gte("date", dateFrom).lte("date", dateTo)
      .then(async ({ data: logs, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message || "Failed to load report."); setRows([]); setLoading(false); return; }
        const studentIds = [...new Set((logs || []).map(l => l.student_id))];
        if (studentIds.length === 0) { setRows([]); setLoading(false); return; }
        const { data: students } = await supabase
          .from("students").select("id, first_name, last_name, grno").in("id", studentIds);
        if (cancelled) return;
        const byStudent = {};
        for (const l of (logs || [])) {
          const agg = byStudent[l.student_id] ||= { days: 0, homework_done: 0, classwork_done: 0, attentive: 0, diary_done: 0 };
          agg.days += 1;
          for (const { key } of ITEMS) if (l[key]) agg[key] += 1;
        }
        const built = (students || []).map(s => {
          const agg = byStudent[s.id] || { days: 0, homework_done: 0, classwork_done: 0, attentive: 0, diary_done: 0 };
          return {
            studentId: s.id,
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
            grno: s.grno || "",
            days: agg.days,
            ...Object.fromEntries(ITEMS.map(({ key }) => [key, agg[key]])),
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        setRows(built);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [className, subject, dateFrom, dateTo]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const totalDays = rows.reduce((s, r) => s + r.days, 0);
    return ITEMS.map(({ key, label }) => {
      const done = rows.reduce((s, r) => s + r[key], 0);
      const crossed = totalDays - done;
      return { label, done, crossed, pct: totalDays ? Math.round((done / totalDays) * 100) : 0 };
    });
  }, [rows]);

  function exportExcel() {
    const data = rows.map(r => ({
      "Student": r.name, "GR No": r.grno, "Days Logged": r.days,
      "Homework Done": r.homework_done, "Homework Crossed": r.days - r.homework_done,
      "Classwork Done": r.classwork_done, "Classwork Crossed": r.days - r.classwork_done,
      "Attentiveness Done": r.attentive, "Attentiveness Crossed": r.days - r.attentive,
      "Diary Done": r.diary_done, "Diary Crossed": r.days - r.diary_done,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Progress");
    XLSX.writeFile(wb, `Daily_Progress_${className}_${subject}_${dateFrom}_to_${dateTo}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class</label>
            <select value={className} onChange={e => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Select class</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} disabled={!className}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white disabled:bg-gray-100">
              <option value="">{className ? "Select subject" : "Select class first"}</option>
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
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
        {availableSubjects.length === 0 && className && (
          <p className="text-xs text-gray-400">No daily progress has been logged for {className} yet.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summary.map(s => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{s.label}</p>
              <p className="text-xl font-bold mt-0.5 text-school-navy">{s.pct}%</p>
              <p className="text-xs text-gray-400">{s.done} done · {s.crossed} crossed</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <ListChecks className="w-4 h-4 text-school-navy" /> {rows.length} students
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
                  <th className="text-center px-3 py-2">Days Logged</th>
                  {ITEMS.map(i => <th key={i.key} className="text-center px-3 py-2">{i.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.studentId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-500">{r.grno}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{r.days}</td>
                    {ITEMS.map(i => {
                      const done = r[i.key];
                      const crossed = r.days - done;
                      return (
                        <td key={i.key} className="px-3 py-2 text-center">
                          <span className="text-green-600 font-semibold">{done}</span>
                          <span className="text-gray-300"> / </span>
                          <span className={crossed > 0 ? "text-red-600 font-semibold" : "text-gray-300"}>{crossed}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && className && subject && rows.length === 0 && (
        <p className="text-sm text-gray-400">No entries logged for {className} - {subject} in this date range.</p>
      )}
    </div>
  );
}
