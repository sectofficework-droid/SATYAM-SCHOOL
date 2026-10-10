"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Save, X } from "lucide-react";
import { getStudents } from "@/lib/studentService";
import { getCurrentOfficialExams, getExamMarksForEditing } from "@/lib/marksheetService";
import { saveOfficialExamMark, saveStudentRemark, getCurrentAcademicYearId } from "@/lib/examService";

// Same static list ExamsReportSection.js and documents/page.js already use -
// kept local rather than imported, same reasoning ExamsReportSection.js
// gives: a self-contained page shouldn't couple to another file's internals.
const CLASSES_LIST = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];

// REQ-FEAT-010: a real page (not a popup) for editing Official Exam marks,
// Absent, and the report-card remark - evolved from a modal that first
// showed one student at a time, then every cell of the whole class
// editable at once ("too popup-like"); this version shows the whole
// roster read-only (click a mark to edit that student) instead.
function MarksheetEditPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [classesWithStudents] = useState(CLASSES_LIST);
  const [className, setClassName] = useState(searchParams.get("class") || "");
  const [examId, setExamId] = useState(searchParams.get("exam") || "");
  const [exams, setExams] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);

  const [rows, setRows] = useState([]); // last-fetched (clean) state, for dirty-checking + read-only display
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [editingId, setEditingId] = useState(null); // studentId currently expanded into edit mode
  const [editSubjects, setEditSubjects] = useState([]); // in-progress edits for that one student
  const [editRemark, setEditRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCurrentOfficialExams(), getStudents()])
      .then(([ex, st]) => { if (!cancelled) { setExams(ex || []); setAllStudents(st || []); } })
      .catch(() => { if (!cancelled) { setExams([]); setAllStudents([]); } })
      .finally(() => { if (!cancelled) setLoadingBase(false); });
    return () => { cancelled = true; };
  }, []);

  const loadRows = useCallback(() => {
    if (!className || !examId) { setRows([]); return; }
    setLoadingRows(true);
    setLoadError("");
    const classmates = allStudents.filter(s => s.std === className);
    return getExamMarksForEditing(classmates, className, examId)
      .then(r => setRows(r))
      .catch(e => { setLoadError(e.message || "Failed to load marks."); setRows([]); })
      .finally(() => setLoadingRows(false));
  }, [className, examId, allStudents]);

  useEffect(() => { if (allStudents.length) loadRows(); }, [allStudents, loadRows]);

  const startEdit = (row) => {
    setEditingId(row.studentId);
    setEditSubjects(row.subjectRows.map(sr => ({
      ...sr,
      // Blank until actually entered, for every subject - a required
      // subject used to pre-fill "0" here, which looked identical to a
      // real zero score and meant leaving it untouched saved nothing.
      // Blank now reads as "not graded yet" and is auto-saved as Absent
      // below (see handleSave).
      text: sr.isAbsent ? "" : (!sr.isEntered ? "" : String(sr.obtained)),
    })));
    setEditRemark(row.adminRemark || "");
    setSaveError("");
  };
  const cancelEdit = () => { setEditingId(null); setSaveError(""); };

  const updateSubject = (idx, patch) => {
    setEditSubjects(prev => prev.map((s, i) => i !== idx ? s : { ...s, ...patch }));
  };

  // Only what actually changed gets written - a never-entered subject's "0"
  // is just the field's display default, not a real score (REQ-FEAT-009
  // caught this the hard way: saving every cell unconditionally silently
  // turned every still-pending mark into an affirmatively-entered zero).
  // Unentered optional subjects left empty are preserved as unentered - the
  // student just doesn't take that subject. A required subject left blank
  // on Save, though, is treated as Absent automatically: a blank box on a
  // row being saved means no mark was recorded for it, so it's written as
  // such rather than silently staying unentered forever.
  const handleSave = async (row) => {
    setSaving(true);
    setSaveError("");
    try {
      const writes = [];
      editSubjects.forEach((s, i) => {
        const base = row.subjectRows[i];

        if (s.text === "" && !s.isAbsent) {
          if (s.isOptional) return; // Blank optional subject: not their subject, not absent
          if (!base.isAbsent) writes.push(saveOfficialExamMark(examId, row.studentId, className, s.subject, 0, true));
          return;
        }

        const baseText = base.isAbsent ? "" : (!base.isEntered ? "" : String(base.obtained));
        if (s.isAbsent !== base.isAbsent || s.text !== baseText) {
          writes.push(saveOfficialExamMark(examId, row.studentId, className, s.subject, s.isAbsent ? 0 : (Number(s.text) || 0), s.isAbsent));
        }
      });
      if (editRemark.trim() !== (row.adminRemark || "")) {
        const yearId = await getCurrentAcademicYearId();
        if (yearId) writes.push(saveStudentRemark(row.studentId, yearId, editRemark.trim()));
      }
      await Promise.all(writes);
      await loadRows();
      setEditingId(null);
    } catch (e) {
      setSaveError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const subjectNames = rows[0]?.subjectRows.map(r => r.subject) || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg bg-school-navy/10 hover:bg-school-navy/20 text-school-navy transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Edit Class Marks</h1>
          <p className="text-xs text-gray-400">Mark a subject Absent, correct a mark, or set a student's report-card remark.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exam</label>
          <select value={examId} onChange={e => { setExamId(e.target.value); setEditingId(null); }} disabled={loadingBase}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-48">
            <option value="">Select an exam…</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</label>
          <select value={className} onChange={e => { setClassName(e.target.value); setEditingId(null); }} disabled={loadingBase}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-40">
            <option value="">Select a class…</option>
            {classesWithStudents.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {!className || !examId ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Select an exam and a class to view and edit marks.</div>
        ) : loadingRows ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : loadError ? (
          <div className="flex items-center justify-center py-20 text-sm text-red-500">{loadError}</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">No students found in {className}.</div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 sticky left-0 top-0 z-20 bg-gray-50 whitespace-nowrap">Student</th>
                  {subjectNames.map(sub => (
                    <th key={sub} className="px-3 py-2 text-center font-semibold text-gray-500 whitespace-nowrap sticky top-0 z-10 bg-gray-50">{sub}</th>
                  ))}
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap sticky top-0 z-10 bg-gray-50">Remark</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 w-10 sticky top-0 z-10 bg-gray-50"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isEditing = editingId === row.studentId;
                  return (
                    <tr key={row.studentId} className={`border-b border-gray-100 ${isEditing ? "bg-school-navy/5" : "hover:bg-gray-50"}`}>
                      <td className={`px-3 py-2 font-medium text-gray-700 sticky left-0 z-[5] whitespace-nowrap align-top ${isEditing ? "bg-school-navy/5" : "bg-white"}`}>{row.name}</td>
                      {row.subjectRows.map((sr, i) => (
                        <td key={sr.subject} className="px-2 py-2 text-center align-top">
                          {isEditing ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <input
                                type="number" min="0" max={sr.max} disabled={editSubjects[i]?.isAbsent}
                                placeholder={editSubjects[i]?.isOptional ? "—" : "AB"}
                                title={editSubjects[i]?.isOptional ? undefined : "Left blank, this will be saved as Absent"}
                                value={editSubjects[i]?.isAbsent ? "" : (editSubjects[i]?.text ?? "")}
                                onChange={e => updateSubject(i, { text: e.target.value })}
                                className="w-14 border border-gray-200 rounded px-1 py-1 text-xs text-center focus:outline-none focus:border-school-navy disabled:bg-gray-50 disabled:text-gray-300"
                              />
                              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer select-none whitespace-nowrap">
                                <input type="checkbox" checked={!!editSubjects[i]?.isAbsent} onChange={e => updateSubject(i, { isAbsent: e.target.checked })} className="w-3 h-3 accent-school-navy"/>
                                Abs
                              </label>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(row)} className="hover:underline decoration-dotted" title="Click to edit this student's marks">
                              {sr.isAbsent ? (
                                <span className="text-red-600 font-semibold">AB</span>
                              ) : !sr.isEntered && sr.isOptional ? (
                                <span className="text-gray-400 italic" title="Optional — not entered">—</span>
                              ) : (
                                <span className="text-gray-700">{sr.obtained}/{sr.max}</span>
                              )}
                            </button>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            type="text" value={editRemark} onChange={e => setEditRemark(e.target.value)}
                            placeholder="Auto-generated from grade"
                            className="w-48 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-school-navy"
                          />
                        ) : (
                          <button onClick={() => startEdit(row)} className="text-left text-gray-500 hover:underline decoration-dotted truncate max-w-[12rem] block">
                            {row.adminRemark || <span className="text-gray-300 italic">Auto-generated</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleSave(row)} disabled={saving} title="Save"
                              className="p-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 disabled:opacity-40">
                              {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save className="w-3.5 h-3.5"/>}
                            </button>
                            <button onClick={cancelEdit} disabled={saving} title="Cancel" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40">
                              <X className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(row)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-100">
                            <Pencil className="w-3.5 h-3.5"/>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
    </div>
  );
}

export default function MarksheetEditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>}>
      <MarksheetEditPageInner />
    </Suspense>
  );
}
