"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen, ShieldAlert, TrendingUp, ChevronDown, ChevronUp,
  Plus, Trash2, X as XIcon, Lock,
} from "lucide-react";
import { getClassesWithSections, getAllClassSubjects } from "@/lib/settingsService";
import {
  getAllSyllabus, getSubtopicsForChapters, getTeachingStaff,
  addChapters, updateChapterStatus, deleteChapter,
  addSubtopics, updateSubtopicStatus, deleteSubtopic,
  getPendingSyllabusEditRequests, approveSyllabusEditRequest, rejectSyllabusEditRequest,
  computeTeacherGrowth, computeClassGrowth,
} from "@/lib/syllabusService";
import ThresholdSlider from "@/components/ThresholdSlider";

const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full";
const sel = inp + " cursor-pointer";

const STATUSES = ["Not Started", "In Progress", "Completed"];
function nextStatus(s) { return STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length]; }
function statusStyle(s) {
  if (s === "Completed") return "bg-green-100 text-green-700";
  if (s === "In Progress") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-500";
}

// Groups a flat subtopics array by chapter_id, the shape every tab below
// needs for looking up "this chapter's subtopics".
function groupSubtopicsByChapter(subtopics) {
  const map = {};
  subtopics.forEach(s => { (map[s.chapter_id] ||= []).push(s); });
  return map;
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center h-40 gap-3">
      <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Loading...</span>
    </div>
  );
}

export default function SyllabusPage() {
  const [tab, setTab] = useState("browse"); // 'browse' | 'requests' | 'growth'
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    getPendingSyllabusEditRequests().then(rows => setPendingCount(rows.length)).catch(() => {});
  }, []);
  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount, tab]);

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Syllabus</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Browse and edit every class&apos;s syllabus, review teacher edit requests, and track completion growth.
        </p>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit">
        <TabButton active={tab === "browse"} onClick={() => setTab("browse")} icon={BookOpen} label="Browse & Edit" />
        <TabButton active={tab === "requests"} onClick={() => setTab("requests")} icon={ShieldAlert} label="Edit Requests" badge={pendingCount} />
        <TabButton active={tab === "growth"} onClick={() => setTab("growth")} icon={TrendingUp} label="Growth Analytics" />
      </div>

      {tab === "browse" && <BrowseEditTab />}
      {tab === "requests" && <EditRequestsTab onChange={refreshPendingCount} />}
      {tab === "growth" && <GrowthAnalyticsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"
      }`}>
      <Icon className="w-4 h-4" />{label}
      {badge > 0 && (
        <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-red-100 text-red-600"}`}>{badge}</span>
      )}
    </button>
  );
}

// ── Browse & Edit - every class's syllabus, editable regardless of lock ────
function BrowseEditTab() {
  const [classesWithSections, setClassesWithSections] = useState([]);
  const [classSubjectsMap, setClassSubjectsMap] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [allSyllabus, setAllSyllabus] = useState([]);
  const [subtopicsByChapter, setSubtopicsByChapter] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [newChapterText, setNewChapterText] = useState("");
  const [newChapterTeacher, setNewChapterTeacher] = useState("");
  const [adding, setAdding] = useState(false);
  const [subtopicText, setSubtopicText] = useState({}); // { [chapterId]: text }

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getClassesWithSections(), getAllClassSubjects(), getTeachingStaff(), getAllSyllabus()])
      .then(async ([classes, subjMap, staff, syllabus]) => {
        const active = classes.filter(c => c.is_active);
        setClassesWithSections(active);
        setClassSubjectsMap(subjMap);
        setTeachers(staff);
        setAllSyllabus(syllabus);
        setSelectedClass(prev => prev || active[0]?.name || "");
        setNewChapterTeacher(prev => prev || staff[0]?.id || "");
        const subs = await getSubtopicsForChapters(syllabus.map(s => s.id));
        setSubtopicsByChapter(groupSubtopicsByChapter(subs));
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const subjectsForClass = classSubjectsMap[selectedClass] || [];
  useEffect(() => {
    if (subjectsForClass.length && !subjectsForClass.includes(selectedSubject)) setSelectedSubject(subjectsForClass[0]);
  }, [selectedClass, subjectsForClass, selectedSubject]);

  const chapters = allSyllabus.filter(c => c.class === selectedClass && c.subject === selectedSubject);

  async function handleAddChapters() {
    const names = newChapterText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!names.length || !newChapterTeacher || !selectedSubject) return;
    setAdding(true);
    try {
      await addChapters(names.map((name, i) => ({
        class: selectedClass, subject: selectedSubject, chapter: name,
        status: "Not Started", teacher_id: newChapterTeacher, sort_order: i,
      })));
      setNewChapterText("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function handleCycleStatus(chapter) {
    await updateChapterStatus(chapter.id, nextStatus(chapter.status || "Not Started"));
    load();
  }

  async function handleDeleteChapter(chapter) {
    if (!confirm(`Delete "${chapter.chapter}"? This also deletes its subtopics.`)) return;
    await deleteChapter(chapter.id);
    load();
  }

  async function handleAddSubtopic(chapter) {
    const name = (subtopicText[chapter.id] || "").trim();
    if (!name) return;
    const existing = subtopicsByChapter[chapter.id] || [];
    await addSubtopics([{ chapter_id: chapter.id, name, status: "Not Started", sort_order: existing.length }]);
    setSubtopicText(prev => ({ ...prev, [chapter.id]: "" }));
    load();
  }

  async function handleCycleSubtopicStatus(subtopic) {
    await updateSubtopicStatus(subtopic.id, nextStatus(subtopic.status || "Not Started"));
    load();
  }

  async function handleDeleteSubtopic(subtopic) {
    await deleteSubtopic(subtopic.id);
    load();
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-2">
        <select className={sel + " max-w-[180px]"} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classesWithSections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select className={sel + " max-w-[180px]"} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          {subjectsForClass.length === 0
            ? <option value="">No subjects configured</option>
            : subjectsForClass.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">{selectedClass} · {selectedSubject || "—"}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Editable here regardless of a teacher&apos;s lock - admin changes are authoritative.</p>
        </div>

        {subjectsForClass.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">No subjects configured for {selectedClass} yet — add them in Settings → Subjects.</p>
        ) : chapters.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">No chapters yet for this class + subject.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {chapters.map(chapter => {
              const subs = subtopicsByChapter[chapter.id] || [];
              const isOpen = expanded === chapter.id;
              return (
                <div key={chapter.id}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    {chapter.locked && <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Locked by teacher" />}
                    <button className="flex-1 text-left min-w-0" onClick={() => setExpanded(isOpen ? null : chapter.id)}>
                      <p className="text-sm font-medium text-gray-800 truncate">{chapter.chapter}</p>
                      <p className="text-xs text-gray-400">by {chapter.teacherName}</p>
                    </button>
                    <button onClick={() => handleCycleStatus(chapter)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 ${statusStyle(chapter.status)}`}>
                      {chapter.status || "Not Started"}
                    </button>
                    <button onClick={() => handleDeleteChapter(chapter)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExpanded(isOpen ? null : chapter.id)} className="flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 bg-gray-50/60">
                      {subs.map(s => (
                        <div key={s.id} className="flex items-center gap-2 py-1.5">
                          <span className="flex-1 text-xs text-gray-600">{s.name}</span>
                          <button onClick={() => handleCycleSubtopicStatus(s)} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusStyle(s.status)}`}>
                            {s.status}
                          </button>
                          <button onClick={() => handleDeleteSubtopic(s)}><XIcon className="w-3.5 h-3.5 text-gray-400" /></button>
                        </div>
                      ))}
                      {subs.length === 0 && <p className="text-xs text-gray-400 py-1">No subtopics yet.</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          className={inp + " text-xs"}
                          placeholder="Add a subtopic"
                          value={subtopicText[chapter.id] || ""}
                          onChange={e => setSubtopicText(prev => ({ ...prev, [chapter.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") handleAddSubtopic(chapter); }}
                        />
                        <button onClick={() => handleAddSubtopic(chapter)} className="px-2.5 py-1.5 rounded-lg bg-school-navy text-white text-[11px] font-semibold flex-shrink-0">
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-4 bg-gray-50/60 border-t border-gray-100 flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500">Add Chapters</p>
          <div className="flex flex-wrap gap-2 items-start">
            <textarea className={inp + " flex-1 min-w-[220px]"} rows={2} placeholder="One chapter per line"
              value={newChapterText} onChange={e => setNewChapterText(e.target.value)} />
            <select className={sel + " max-w-[180px]"} value={newChapterTeacher} onChange={e => setNewChapterTeacher(e.target.value)}>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={handleAddChapters} disabled={adding || !selectedSubject}
              className="flex items-center gap-1.5 bg-school-navy text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg hover:bg-school-navy/90 disabled:opacity-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> {adding ? "Adding…" : "Add"}
            </button>
          </div>
          <p className="text-xs text-gray-400">Attributed to the selected teacher - matters for Teacher-wise Growth.</p>
        </div>
      </div>
    </div>
  );
}

// ── Pending teacher requests to unlock a class+subject's syllabus ──────────
function EditRequestsTab({ onChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getPendingSyllabusEditRequests().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleApprove(req) {
    setBusyId(req.id);
    try {
      await approveSyllabusEditRequest(req);
      await load();
      onChange?.();
    } catch (e) {
      alert("Failed to approve: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(req) {
    const note = window.prompt("Optional note for the teacher (why this is being rejected):", "") || null;
    setBusyId(req.id);
    try {
      await rejectSyllabusEditRequest(req.id, note);
      await load();
      onChange?.();
    } catch (e) {
      alert("Failed to reject: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <ShieldAlert className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">No pending edit requests</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(req => (
            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">
                  {req.teacher?.name || "Unknown teacher"} — {req.class_name} · {req.subject_name}
                </p>
                {req.reason && <p className="text-sm text-gray-600 mt-1.5 bg-gray-50 rounded-lg px-3 py-1.5">&quot;{req.reason}&quot;</p>}
                {req.requested_changes && (
                  <p className="text-xs text-gray-500 mt-1.5">Wants to add/update: {req.requested_changes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleReject(req)} disabled={busyId === req.id}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Reject
                </button>
                <button onClick={() => handleApprove(req)} disabled={busyId === req.id}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-school-navy text-white hover:bg-school-navy/90 disabled:opacity-50">
                  {busyId === req.id ? "Working..." : "Approve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Growth Analytics - teacher-wise and class-wise, each with a draggable
// threshold slider that splits the group live into below/above panels ──────
function GrowthAnalyticsTab() {
  const [allSyllabus, setAllSyllabus] = useState([]);
  const [subtopicsByChapter, setSubtopicsByChapter] = useState({});
  const [loading, setLoading] = useState(true);
  const [teacherThreshold, setTeacherThreshold] = useState(50);
  const [classThreshold, setClassThreshold] = useState(50);

  useEffect(() => {
    setLoading(true);
    getAllSyllabus()
      .then(async syllabus => {
        setAllSyllabus(syllabus);
        const subs = await getSubtopicsForChapters(syllabus.map(s => s.id));
        setSubtopicsByChapter(groupSubtopicsByChapter(subs));
      })
      .finally(() => setLoading(false));
  }, []);

  const teacherGrowth = useMemo(() => computeTeacherGrowth(allSyllabus, subtopicsByChapter), [allSyllabus, subtopicsByChapter]);
  const classGrowth   = useMemo(() => computeClassGrowth(allSyllabus, subtopicsByChapter), [allSyllabus, subtopicsByChapter]);

  if (loading) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-5">
      <GrowthSection title="Teacher-wise Growth" noun="teachers" rows={teacherGrowth} threshold={teacherThreshold} onThreshold={setTeacherThreshold} />
      <GrowthSection title="Class-wise Growth" noun="classes" rows={classGrowth} threshold={classThreshold} onThreshold={setClassThreshold} />
    </div>
  );
}

function GrowthSection({ title, noun, rows, threshold, onThreshold }) {
  const below = rows.filter(r => r.pct < threshold);
  const above = rows.filter(r => r.pct >= threshold);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">Drag to split {rows.length} {noun} by syllabus completion %.</p>
      <ThresholdSlider value={threshold} onChange={onThreshold} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <GrowthPanel label={`Below ${threshold}%`} rows={below} color="red" />
        <GrowthPanel label={`${threshold}% and above`} rows={above} color="green" />
      </div>
    </div>
  );
}

function GrowthPanel({ label, rows, color }) {
  const styles = { red: "text-red-600 bg-red-50", green: "text-green-600 bg-green-50" };
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className={`px-3 py-2 text-xs font-semibold ${styles[color]}`}>{label} ({rows.length})</div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-gray-400 text-center">None</p>
      ) : (
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-gray-700 truncate">{r.name}</span>
              <span className="font-semibold text-gray-800 flex-shrink-0 ml-2">{r.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
