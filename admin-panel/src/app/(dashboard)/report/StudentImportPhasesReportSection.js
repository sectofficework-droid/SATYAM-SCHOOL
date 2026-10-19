"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Layers, AlertTriangle, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { getPhases, getPhaseEntries, getReplacedStudentPhases, PHASE_EXPORT_FIELDS } from "@/lib/studentPhaseService";

const SOURCE_LABELS = {
  add_student_form:      "Add Student (single)",
  edit_student_form:     "Edit Student (single)",
  single_student_update: "Super Admin - Update Student",
  import_students:       "Super Admin - Import Students",
  replace_full_details:  "Super Admin - Replace Full Details",
  basic_details_import:  "Import Basic Details",
};

const TYPE_FILTERS = [
  { key: "all",      label: "All" },
  { key: "Added",    label: "Added" },
  { key: "Replaced", label: "Replaced" },
];

// REQ-FEAT-019 (2026-10-18) - every student Add/Replace save (single or
// bulk import) is automatically recorded as a locked "phase" - one batch
// of students submitted together to the state (UDISE) / national (PEN)
// registries. This lists every phase and lets the admin download any one
// of them in the same column layout as the Import Students/Replace Full
// Details templates, replacing the offline "WEBSITE FD REPLACEMENT.xlsx"
// workbook (one sheet per phase) this was built to match.
export default function StudentImportPhasesReportSection() {
  const [view,        setView]       = useState("phases"); // "phases" | "students"
  const [typeFilter,  setTypeFilter] = useState("all");
  const [phases,      setPhases]     = useState([]);
  const [studentRows, setStudentRows]= useState([]);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState("");
  const [downloading, setDownloading]= useState(null);

  const loadPhases = useCallback(() => {
    setLoading(true);
    setError("");
    getPhases()
      .then(setPhases)
      .catch(e => setError(e.message || "Failed to load phases."))
      .finally(() => setLoading(false));
  }, []);

  const loadStudents = useCallback(() => {
    setLoading(true);
    setError("");
    getReplacedStudentPhases()
      .then(setStudentRows)
      .catch(e => setError(e.message || "Failed to load students."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view === "phases") loadPhases(); else loadStudents();
  }, [view, loadPhases, loadStudents]);

  const visible = typeFilter === "all" ? phases : phases.filter(p => p.phase_type === typeFilter);

  async function downloadPhase(phase) {
    setDownloading(phase.id);
    setError("");
    try {
      const entries = await getPhaseEntries(phase.id);
      const headerRow = PHASE_EXPORT_FIELDS.map(f => f.label);
      const dataRows = entries.map(e => PHASE_EXPORT_FIELDS.map(f => e.snapshot?.[f.key] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      ws["!cols"] = PHASE_EXPORT_FIELDS.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Batch ${phase.phase_number}`);
      const dateStr = new Date(phase.created_at).toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Batch_${phase.phase_number}_${phase.phase_type}_${dateStr}.xlsx`);
    } catch (e) {
      setError(e.message || "Failed to download phase.");
    } finally {
      setDownloading(null);
    }
  }

  const dupeCount = studentRows.filter(r => r.phases.length > 1).length;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
        <button onClick={() => setView("phases")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === "phases" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          By Batch
        </button>
        <button onClick={() => setView("students")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === "students" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          By Student
          {view !== "students" && dupeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{dupeCount}</span>
          )}
        </button>
      </div>

      {view === "phases" && (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                typeFilter === f.key ? "bg-school-navy text-white border-school-navy" : "bg-white text-gray-600 border-gray-200 hover:border-school-navy/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Each batch is a locked snapshot of the students added/replaced together - download it to submit to UDISE/PEN.
        </p>
      </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {view === "students" && (
        <>
          <p className="text-xs text-gray-400">
            Every student whose full details have been replaced, and which Replaced batch(es) they were done in.
            Anyone appearing in <span className="font-semibold text-red-600">more than one batch</span> is flagged - that usually means they were redone by mistake.
          </p>
          {!loading && studentRows.length === 0 && !error && (
            <p className="text-sm text-gray-400">No students have had their full details replaced yet.</p>
          )}
          {studentRows.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
                <Users className="w-4 h-4 text-school-navy" /> {studentRows.length} student{studentRows.length !== 1 ? "s" : ""} replaced
                {dupeCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600 text-xs font-semibold ml-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> {dupeCount} replaced more than once
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Student</th>
                      <th className="text-left px-3 py-2">Enrollment No</th>
                      <th className="text-left px-3 py-2">Class</th>
                      <th className="text-left px-3 py-2">Batches</th>
                      <th className="text-left px-3 py-2">Times Replaced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentRows.map(r => {
                      const dupe = r.phases.length > 1;
                      return (
                        <tr key={r.studentId || r.enrollmentNo} className={`border-t border-gray-100 ${dupe ? "bg-red-50/60" : ""}`}>
                          <td className="px-3 py-2 font-medium text-gray-800">{r.name || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.enrollmentNo || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.cls || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.phases.map(p => `Batch ${p.phaseNumber}`).join(", ")}</td>
                          <td className="px-3 py-2">
                            {dupe
                              ? <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> {r.phases.length}</span>
                              : <span className="text-gray-500">{r.phases.length}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {view === "phases" && !loading && visible.length === 0 && !error && (
        <p className="text-sm text-gray-400">No batches recorded yet. One is created automatically the next time a student is added or has their full details replaced.</p>
      )}

      {view === "phases" && visible.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            <Layers className="w-4 h-4 text-school-navy" /> {visible.length} batch{visible.length !== 1 ? "es" : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Batch</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">Students</th>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">By</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-semibold text-gray-800">Batch {p.phase_number}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.phase_type === "Added" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      }`}>{p.phase_type}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{SOURCE_LABELS[p.source] || p.source}</td>
                    <td className="px-3 py-2 text-gray-600">{p.student_count}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-500">{p.created_by?.name || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => downloadPhase(p)} disabled={downloading === p.id}
                        className="flex items-center gap-1 text-xs text-school-navy hover:underline disabled:opacity-50 ml-auto">
                        <Download className="w-3.5 h-3.5" /> {downloading === p.id ? "Preparing..." : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
