"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award, Plus, Trash2, Pencil, Save, X, Check, ChevronDown, ChevronUp,
  Lock, LockOpen, CalendarDays, ClipboardList,
} from "lucide-react";
import { getAcademicYears, getClassesWithSections, getAllClassSubjects } from "@/lib/settingsService";
import {
  getOfficialExams, createOfficialExam, updateOfficialExam, deleteOfficialExam,
  isExamUnlocked, getExamSubjectConfig, saveExamSubjectMaxMarks, saveExamSubjectMaxMarksBulk,
  getMonthlyTestMaxMarks, saveMonthlyTestMaxMarks,
  getMonthlyTests, getMonthlyTestMarks, getOfficialExamMarksEntered,
} from "@/lib/examService";

const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full";
const sel = inp + " cursor-pointer";

function fmtDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

// Nested per-class max-marks editor, shown when an exam row is expanded.
// Each field auto-saves on blur (independent of the others) rather than a
// batch form, since these are unrelated per-subject values.
function ExamSubjectConfig({ examId, classesWithSections, classSubjectsMap }) {
  const [selectedClass, setSelectedClass] = useState(classesWithSections[0]?.name || "");
  const [config, setConfig] = useState({}); // { [subject]: max_marks }
  const [loading, setLoading] = useState(true);
  const [savedSubject, setSavedSubject] = useState(null);

  useEffect(() => {
    setLoading(true);
    getExamSubjectConfig(examId)
      .then(rows => {
        const map = {};
        rows.forEach(r => {
          if (r.class_name === selectedClass) map[r.subject_name] = r.max_marks;
        });
        setConfig(map);
      })
      .finally(() => setLoading(false));
  }, [examId, selectedClass]);

  const subjects = classSubjectsMap[selectedClass] || [];

  async function handleSave(subject, value) {
    const maxMarks = Number(value);
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) return;
    setConfig(prev => ({ ...prev, [subject]: maxMarks }));
    await saveExamSubjectMaxMarks(examId, selectedClass, subject, maxMarks);
    setSavedSubject(subject);
    setTimeout(() => setSavedSubject(s => (s === subject ? null : s)), 1500);
  }

  return (
    <div className="px-5 pb-4 pt-3 bg-gray-50/60 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">Max Marks per Subject</p>
      <select className={sel + " max-w-xs mb-3"} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
        {classesWithSections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
      </select>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="text-xs text-gray-400">
          No subjects configured for {selectedClass} yet — add them in Settings → Subjects first.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {subjects.map(subject => (
            <div key={subject} className="bg-white border border-gray-200 rounded-lg p-2.5">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 truncate" title={subject}>
                {subject}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  className={inp + " text-center"}
                  defaultValue={config[subject] ?? 100}
                  onBlur={e => handleSave(subject, e.target.value)}
                />
                {savedSubject === subject && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0"/>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExamMarksEntered examId={examId} className={selectedClass}/>
    </div>
  );
}

// What's actually been entered so far for this exam + the class currently
// selected above (config's own selectedClass, reused here so the admin
// doesn't have to pick a class twice) - read-only, teachers still enter
// marks from the app.
function ExamMarksEntered({ examId, className }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!className) { setRows([]); setLoading(false); return; }
    setLoading(true);
    getOfficialExamMarksEntered(examId, className)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [examId, className]);

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">Marks Entered — {className || "—"}</p>
      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">No marks entered yet for {className}.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {rows.map((r, i) => (
              <div key={`${r.studentId}-${r.subject}-${i}`} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-gray-700 font-medium">{r.name || "—"}</span>
                <span className="text-gray-400">{r.subject}</span>
                <span className="font-semibold text-school-navy">{r.marks ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Monthly Test's default full marks - a single admin-wide setting (not
// per-class/subject like Official Exams below), since a Monthly Test is a
// freeform test a subject teacher creates for their own class; date and
// subject stay teacher-chosen, this only controls the marks cap the app
// applies when a new one is created. Auto-saves on blur, same pattern as
// ExamSubjectConfig's per-subject fields.
function MonthlyTestSettings() {
  const [maxMarks, setMaxMarks] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMonthlyTestMaxMarks().then(setMaxMarks).finally(() => setLoading(false));
  }, []);

  async function handleSave(value) {
    const marks = Number(value);
    if (!Number.isFinite(marks) || marks <= 0) { setError("Enter a valid number."); return; }
    setError("");
    setMaxMarks(marks);
    await saveMonthlyTestMaxMarks(marks);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">Monthly Test</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Default full marks for a Monthly Test created by a subject teacher in the app.
          The teacher still picks the class, subject, and date - this only sets the marks cap.
        </p>
      </div>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50">
          <ClipboardList className="w-4 h-4 text-purple-600"/>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Full Marks</span>
            <input
              type="number"
              min="1"
              className={inp + " w-24 text-center"}
              defaultValue={maxMarks}
              onBlur={e => handleSave(e.target.value)}
            />
            {saved && <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0"/>}
          </div>
        )}
      </div>
      {error && <p className="px-5 pb-3 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Read-only visibility into Monthly Tests - teachers create these from the
// app (name, class, subject, date, marks) with no admin involvement, so
// this is the only place management can see what's been scheduled and
// what's been marked, matching the visibility "Official Exams" already has.
function MonthlyTestsList({ classesWithSections }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [marksByExam, setMarksByExam] = useState({});
  const [marksLoading, setMarksLoading] = useState(false);

  useEffect(() => {
    getMonthlyTests().then(setTests).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => classFilter === "All" ? tests : tests.filter(t => t.class === classFilter),
    [tests, classFilter]
  );

  async function toggleExpand(examId) {
    if (expanded === examId) { setExpanded(null); return; }
    setExpanded(examId);
    if (!marksByExam[examId]) {
      setMarksLoading(true);
      const marks = await getMonthlyTestMarks(examId);
      setMarksByExam(prev => ({ ...prev, [examId]: marks }));
      setMarksLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-700">Monthly Tests</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Tests subject teachers have scheduled from the app, with the date they picked and who created them.
            Expand a row to see the marks entered so far.
          </p>
        </div>
        <select className={sel + " max-w-[160px]"} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="All">All Classes</option>
          {classesWithSections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">
          {classFilter === "All" ? "No monthly tests created yet." : `No monthly tests for ${classFilter} yet.`}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map(test => {
            const isOpen = expanded === test.id;
            const marks = marksByExam[test.id] || [];
            return (
              <div key={test.id}>
                <button className="w-full flex items-center gap-3 px-5 py-3.5 text-left" onClick={() => toggleExpand(test.id)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50">
                    <ClipboardList className="w-4 h-4 text-purple-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{test.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">{test.class}</span>
                      <span>{test.subject}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3"/>{test.date ? fmtDMY(test.date) : "No date set"}</span>
                      <span>· Max {test.maxMarks}</span>
                      <span>· by {test.teacherName}</span>
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0"/> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0"/>}
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1 bg-gray-50/60 border-t border-gray-100">
                    {marksLoading && !marksByExam[test.id] ? (
                      <p className="text-xs text-gray-400 py-2">Loading marks…</p>
                    ) : marks.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No marks entered yet.</p>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-2">
                        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                          {marks.map(m => (
                            <div key={m.studentId} className="flex items-center justify-between px-3 py-2 text-xs">
                              <span className="text-gray-700 font-medium">{m.name || "—"}</span>
                              <span className="font-semibold text-school-navy">{m.marks ?? "—"} / {test.maxMarks}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExamsTab() {
  const [exams, setExams] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [classesWithSections, setClassesWithSections] = useState([]);
  const [classSubjectsMap, setClassSubjectsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newFullMarks, setNewFullMarks] = useState("100");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editError, setEditError] = useState("");

  function load() {
    setLoading(true);
    Promise.all([getAcademicYears(), getClassesWithSections(), getAllClassSubjects()])
      .then(async ([years, classes, subjMap]) => {
        const cur = years.find(y => y.is_current) || years[years.length - 1];
        setCurrentYear(cur || null);
        setClassesWithSections(classes.filter(c => c.is_active));
        setClassSubjectsMap(subjMap);
        if (cur) setExams(await getOfficialExams(cur.id));
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const sortedExams = useMemo(() => [...exams].sort((a, b) => a.sort_order - b.sort_order), [exams]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) { setAddError("Enter an exam name."); return; }
    if (!newStartDate) { setAddError("Pick a start date."); return; }
    if (!newEndDate) { setAddError("Pick an end date."); return; }
    if (newEndDate < newStartDate) { setAddError("End date can't be before the start date."); return; }
    const fullMarks = Number(newFullMarks);
    if (!Number.isFinite(fullMarks) || fullMarks <= 0) { setAddError("Enter valid full marks."); return; }
    setAddError("");
    setAdding(true);
    try {
      const exam = await createOfficialExam({
        name, startDate: newStartDate, endDate: newEndDate, academicYearId: currentYear?.id, sortOrder: exams.length,
      });
      // Pre-fill every class's every subject with this exam's full marks, so
      // nothing silently falls back to an invisible default - each one can
      // still be edited individually afterward below.
      const configRows = [];
      Object.entries(classSubjectsMap).forEach(([className, subjects]) => {
        subjects.forEach(subjectName => configRows.push({ className, subjectName, maxMarks: fullMarks }));
      });
      await saveExamSubjectMaxMarksBulk(exam.id, configRows);
      setExams(prev => [...prev, exam]);
      setNewName(""); setNewStartDate(""); setNewEndDate(""); setNewFullMarks("100");
    } catch (err) {
      setAddError(err?.message || "Failed to add exam.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(exam) {
    setEditingId(exam.id);
    setEditName(exam.name);
    setEditStartDate(exam.start_date || "");
    setEditEndDate(exam.end_date);
    setEditError("");
  }

  async function saveEdit(id) {
    const name = editName.trim();
    // Exams created before start_date existed may have no value here yet -
    // silently doing nothing when it's blank made Save look broken, so this
    // now tells the admin exactly what's missing instead of no-oping.
    if (!name) { setEditError("Enter an exam name."); return; }
    if (!editStartDate) { setEditError("Pick a start date."); return; }
    if (!editEndDate) { setEditError("Pick an end date."); return; }
    if (editEndDate < editStartDate) { setEditError("End date can't be before the start date."); return; }
    setEditError("");
    try {
      await updateOfficialExam(id, { name, startDate: editStartDate, endDate: editEndDate, sortOrder: exams.find(e => e.id === id)?.sort_order ?? 0 });
      setExams(prev => prev.map(e => (e.id === id ? { ...e, name, start_date: editStartDate, end_date: editEndDate } : e)));
      setEditingId(null);
    } catch (err) {
      setEditError(err?.message || "Failed to save changes.");
    }
  }

  async function handleDelete(exam) {
    if (!confirm(`Delete "${exam.name}"? This also deletes every mark entered for it. This cannot be undone.`)) return;
    await deleteOfficialExam(exam.id);
    setExams(prev => prev.filter(e => e.id !== exam.id));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading exams…</div>
  );

  return (
    <div className="space-y-4">
      <MonthlyTestSettings/>
      <MonthlyTestsList classesWithSections={classesWithSections}/>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">Official Exams{currentYear ? ` — ${currentYear.label}` : ""}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Add or remove the school's official exams (First Unit Test, Half Yearly, Annual, etc.).
            Marks entry automatically unlocks for teachers the day after each exam's end date.
            Exams that run over several days can be given a start and end date.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {sortedExams.map(exam => {
            const unlocked = isExamUnlocked(exam);
            const isEditingRow = editingId === exam.id;
            const isOpen = expanded === exam.id;
            return (
              <div key={exam.id}>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${unlocked ? "bg-green-50" : "bg-amber-50"}`}>
                    <Award className={`w-4 h-4 ${unlocked ? "text-green-600" : "text-amber-600"}`}/>
                  </div>

                  {isEditingRow ? (
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <input className={inp + " max-w-[220px]"} value={editName} onChange={e => setEditName(e.target.value)} />
                        <input type="date" className={inp + " max-w-[150px]"} value={editStartDate} onChange={e => setEditStartDate(e.target.value)} title="Start date" />
                        <span className="text-gray-400 text-xs">to</span>
                        <input type="date" className={inp + " max-w-[150px]"} value={editEndDate} onChange={e => setEditEndDate(e.target.value)} title="End date" />
                        <button onClick={() => saveEdit(exam.id)} className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"><Save className="w-4 h-4"/></button>
                        <button onClick={() => { setEditingId(null); setEditError(""); }} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                      {editError && <p className="text-xs text-red-500">{editError}</p>}
                    </div>
                  ) : (
                    <button className="flex-1 flex items-center justify-between text-left" onClick={() => setExpanded(isOpen ? null : exam.id)}>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{exam.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <CalendarDays className="w-3 h-3"/>
                          {exam.start_date ? `${fmtDMY(exam.start_date)} to ${fmtDMY(exam.end_date)}` : `Ends ${fmtDMY(exam.end_date)}`}
                          <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${unlocked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {unlocked ? <LockOpen className="w-2.5 h-2.5"/> : <Lock className="w-2.5 h-2.5"/>}
                            {unlocked ? "Marks entry open" : "Coming Soon"}
                          </span>
                        </p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                    </button>
                  )}

                  {!isEditingRow && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(exam)} className="p-2 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-100 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDelete(exam)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  )}
                </div>

                {isOpen && !isEditingRow && (
                  <ExamSubjectConfig examId={exam.id} classesWithSections={classesWithSections} classSubjectsMap={classSubjectsMap}/>
                )}
              </div>
            );
          })}
          {sortedExams.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No official exams added yet.</p>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50/60 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Add New Exam</p>
          <div className="flex flex-wrap items-center gap-2">
            <input className={inp + " max-w-[220px]"} placeholder="e.g. First Unit Test" value={newName} onChange={e => setNewName(e.target.value)} />
            <input type="date" className={inp + " max-w-[150px]"} value={newStartDate} onChange={e => setNewStartDate(e.target.value)} title="Start date" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" className={inp + " max-w-[150px]"} value={newEndDate} onChange={e => setNewEndDate(e.target.value)} title="End date" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">Full Marks</span>
              <input type="number" min="1" className={inp + " w-20"} value={newFullMarks} onChange={e => setNewFullMarks(e.target.value)} title="Full marks (applies to every subject, editable per-subject after)" />
            </div>
            <button onClick={handleAdd} disabled={adding}
              className="flex items-center gap-1.5 bg-school-navy text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg hover:bg-school-navy/90 disabled:opacity-50 transition-colors">
              <Plus className="w-3.5 h-3.5"/> {adding ? "Adding…" : "Add Exam"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Full Marks applies to every class and subject at once — you can still change it for a specific subject afterward by expanding the exam below.
          </p>
          {addError && <p className="text-xs text-red-500 mt-1.5">{addError}</p>}
        </div>
      </div>
    </div>
  );
}
