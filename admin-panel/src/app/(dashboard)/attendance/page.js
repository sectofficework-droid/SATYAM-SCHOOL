"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarCheck, Search, Users, Check, X as XIcon, Clock,
  Save, History, GraduationCap, ChevronLeft, ChevronRight,
} from "lucide-react";
import { getStudents } from "@/lib/studentService";
import { getAttendanceForClassDate, saveAttendanceForClassDate, getStudentAttendanceHistory } from "@/lib/attendanceService";
import S3Image from "@/components/S3Image";
import DateInputDMY from "@/components/DateInputDMY";

// Classes worth listing first if present, before falling back to whatever
// else shows up in the real data - avoids hardcoding a class list that could
// drift from the actual `classes.name` values students are enrolled under.
const CLASS_ORDER = [
  "JR KG", "JR.KG", "SR KG", "SR.KG", "Balvatika",
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
  "11th Commerce", "11th - Commerce", "12th Commerce", "12th - Commerce",
];

const STATUS_STYLE = {
  P: { label: "Present", color: "green",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-500"  },
  A: { label: "Absent",  color: "red",    bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500"    },
};

const todayStr = new Date().toISOString().split("T")[0];

function fmtDateLabel(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AttendancePage() {
  const [students,   setStudents]   = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate,  setSelectedDate]  = useState(todayStr);
  const [statusMap,   setStatusMap]  = useState({});   // student_id -> 'P'|'A'
  const [wasMarked,   setWasMarked]  = useState(false); // any record already existed for this class+date
  const [attLoading,  setAttLoading] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [saved,        setSaved]      = useState(false);
  const [search,       setSearch]     = useState("");
  const [historyStudent, setHistoryStudent] = useState(null); // student object or null

  useEffect(() => {
    setLoading(true);
    getStudents().then(d => setStudents(d || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const classOptions = useMemo(() => {
    const present = [...new Set(students.map(s => s.std).filter(Boolean))];
    const ordered = CLASS_ORDER.filter(c => present.includes(c));
    const rest    = present.filter(c => !CLASS_ORDER.includes(c)).sort();
    return [...ordered, ...rest];
  }, [students]);

  useEffect(() => {
    if (!selectedClass && classOptions.length) setSelectedClass(classOptions[0]);
  }, [classOptions, selectedClass]);

  const classStudents = useMemo(
    () => students
      .filter(s => s.std === selectedClass)
      .sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0)),
    [students, selectedClass]
  );

  const loadAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) return;
    setAttLoading(true);
    try {
      const rows = await getAttendanceForClassDate(selectedClass, selectedDate);
      const map = {};
      for (const r of rows) map[r.student_id] = r.status;
      setWasMarked(rows.length > 0);
      // Anyone in the class with no row yet defaults to Present, same as the
      // teacher app - matches what a fresh Mark Attendance session shows.
      for (const s of classStudents) if (!map[s._studentId]) map[s._studentId] = "P";
      setStatusMap(map);
    } catch {
      setStatusMap({});
    } finally {
      setAttLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedDate, classStudents]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const filtered = classStudents.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.grno || "").toLowerCase().includes(q) || String(s.rollNo || "").includes(q);
  });

  const presentCount = classStudents.filter(s => statusMap[s._studentId] === "P").length;
  const absentCount  = classStudents.filter(s => statusMap[s._studentId] === "A").length;
  const percent      = classStudents.length ? Math.round((presentCount / classStudents.length) * 100) : 0;

  function setStatus(studentId, status) {
    setStatusMap(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const records = classStudents.map(s => ({
        student_id: s._studentId,
        date:       selectedDate,
        class:      selectedClass,
        status:     statusMap[s._studentId] || "P",
      }));
      await saveAttendanceForClassDate(records);
      setWasMarked(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Failed to save attendance: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Student Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View and correct daily attendance marked from the teacher app, or mark it directly from here.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-school-navy min-w-40"
        >
          {classOptions.length === 0 && <option value="">No classes found</option>}
          {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <DateInputDMY value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={todayStr}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name, roll no. or GR no." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy" />
        </div>

        <span className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap ml-auto">
          <Users className="w-4 h-4" />{classStudents.length} students
        </span>
      </div>

      {/* Summary */}
      {classStudents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Present" count={presentCount} color="green" />
          <SummaryCard label="Absent"  count={absentCount}  color="red" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col justify-center">
            <span className="text-xs text-gray-400 font-medium">% Present</span>
            <span className={`text-2xl font-bold ${percent >= 75 ? "text-green-600" : percent >= 50 ? "text-amber-600" : "text-red-600"}`}>{percent}%</span>
          </div>
        </div>
      )}

      {!wasMarked && classStudents.length > 0 && !attLoading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Attendance hasn&apos;t been marked for {fmtDateLabel(selectedDate)} yet — everyone defaults to Present below until saved.
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading || attLoading ? (
          <div className="flex items-center justify-center h-40 gap-3">
            <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        ) : classStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <GraduationCap className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-400">{classOptions.length === 0 ? "No students found" : "No students in this class"}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">No students match &quot;{search}&quot;</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-semibold">Roll</th>
                <th className="px-3 py-2.5 font-semibold">Student</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">GR No.</th>
                <th className="px-3 py-2.5 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => {
                const status = statusMap[s._studentId] || "P";
                return (
                  <tr key={s._studentId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{s.rollNo || "—"}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setHistoryStudent(s)} className="flex items-center gap-2.5 text-left hover:text-school-navy group">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400" /></div>}
                        </div>
                        <span className="font-medium text-gray-800 group-hover:underline">{s.name}</span>
                        <History className="w-3 h-3 text-gray-300 group-hover:text-school-navy" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell">{s.grno || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {["P", "A"].map(v => {
                          const st = STATUS_STYLE[v];
                          const active = status === v;
                          return (
                            <button key={v} onClick={() => setStatus(s._studentId, v)}
                              title={st.label}
                              className={`w-9 h-9 rounded-lg text-xs font-bold border transition-colors ${
                                active ? `${st.bg} ${st.text} ${st.border} border-2` : "border-gray-200 text-gray-400 hover:bg-gray-50"
                              }`}>
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Save bar */}
      {classStudents.length > 0 && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving || attLoading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 ${
              saved ? "bg-green-600 text-white" : "bg-school-navy text-white hover:bg-school-navy/90"
            }`}>
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
            ) : saved ? (
              <><Check className="w-4 h-4" />Saved</>
            ) : (
              <><Save className="w-4 h-4" />Save Attendance</>
            )}
          </button>
        </div>
      )}

      {historyStudent && (
        <HistoryModal student={historyStudent} onClose={() => setHistoryStudent(null)} />
      )}
    </div>
  );
}

function SummaryCard({ label, count, color }) {
  const styles = {
    green: "bg-green-50 text-green-700",
    red:   "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-2xl border border-gray-100 shadow-sm p-4 ${styles[color]}`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <div className="text-2xl font-bold mt-0.5">{count}</div>
    </div>
  );
}

// ── Per-student attendance history modal ──────────────────────────────────────
function HistoryModal({ student, onClose }) {
  const [rows, setRows] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, 1 = previous, ...

  const range = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthOffset);
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to   = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      from: from.toISOString().slice(0, 10),
      to:   to.toISOString().slice(0, 10),
      label: base.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  }, [monthOffset]);

  useEffect(() => {
    setRows(null);
    getStudentAttendanceHistory(student._studentId, range.from, range.to)
      .then(setRows)
      .catch(() => setRows([]));
  }, [student, range.from, range.to]);

  const present = (rows || []).filter(r => r.status === "P").length;
  const absent  = (rows || []).filter(r => r.status === "A").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
            {student.photo ? <S3Image s3Key={student.photo} alt={student.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-5 h-5 text-gray-400" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{student.name}</p>
            <p className="text-xs text-gray-400">{student.std}{student.section ? " - " + student.section : ""} · Roll {student.rollNo || "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XIcon className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={() => setMonthOffset(m => m + 1)} className="p-1 rounded hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <span className="text-sm font-semibold text-gray-700">{range.label}</span>
          <button onClick={() => setMonthOffset(m => Math.max(0, m - 1))} disabled={monthOffset === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
            <CalendarCheck className="w-8 h-8 text-gray-200" />
            <p className="text-sm">No attendance recorded this month</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 px-5 py-3 border-b border-gray-100">
              <div className="text-center"><div className="text-lg font-bold text-green-600">{present}</div><div className="text-[11px] text-gray-400">Present</div></div>
              <div className="text-center"><div className="text-lg font-bold text-red-600">{absent}</div><div className="text-[11px] text-gray-400">Absent</div></div>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {rows.map(r => {
                const st = STATUS_STYLE[r.status] || STATUS_STYLE.P;
                return (
                  <div key={r.date} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm text-gray-600">{fmtDateLabel(r.date)}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
