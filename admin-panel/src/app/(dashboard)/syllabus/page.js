"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BookOpen, ShieldAlert, TrendingUp, ChevronDown, ChevronUp,
  Plus, Trash2, X as XIcon, Lock, Upload, Download, Check, AlertCircle, CheckCircle2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getClassesWithSections, getAllClassSubjects } from "@/lib/settingsService";
import {
  getAllSyllabus, getSubtopicsForChapters, getTeachingStaff,
  addChapters, updateChapterStatus, deleteChapter,
  addSubtopics, updateSubtopicStatus, deleteSubtopic,
  getPendingSyllabusEditRequests, approveSyllabusEditRequest, rejectSyllabusEditRequest,
  computeTeacherGrowth, computeClassGrowth, computeSubjectGrowth, computeStatusDistribution,
  getSubjectTeacherFromTimetable,
} from "@/lib/syllabusService";
import { getCurrentAcademicYear } from "@/lib/studentService";
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
  const [tab, setTab] = useState("browse"); // 'browse' | 'requests' | 'growth' | 'import'
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
        <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={Upload} label="Import" />
      </div>

      {tab === "browse" && <BrowseEditTab />}
      {tab === "requests" && <EditRequestsTab onChange={refreshPendingCount} />}
      {tab === "growth" && <GrowthAnalyticsTab />}
      {tab === "import" && <ImportTab />}
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
const STATUS_COLORS = { "Not Started": "#9ca3af", "In Progress": "#f59e0b", "Completed": "#22c55e" };
function pctColor(pct) { return pct >= 75 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444"; }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.payload?.fill }}>
          {p.name}: <span className="font-bold">{p.value}{typeof p.value === "number" && p.unit ? p.unit : ""}</span>
        </p>
      ))}
    </div>
  );
}

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
  const subjectGrowth = useMemo(() => computeSubjectGrowth(allSyllabus, subtopicsByChapter), [allSyllabus, subtopicsByChapter]);
  const statusDist    = useMemo(() => computeStatusDistribution(allSyllabus, subtopicsByChapter), [allSyllabus, subtopicsByChapter]);
  const statusPieData = useMemo(
    () => Object.entries(statusDist).map(([name, value]) => ({ name, value })).filter(d => d.value > 0),
    [statusDist]
  );

  if (loading) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Status Distribution" subtitle="Every chapter/subtopic school-wide, by status">
          {statusPieData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {statusPieData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Class-wise Completion" subtitle="% of leaf units (subtopic, else chapter) marked Completed">
          <HorizontalBarChart data={classGrowth} />
        </ChartCard>

        <ChartCard title="Subject-wise Completion" subtitle="Aggregated across every class + teacher for that subject">
          <HorizontalBarChart data={subjectGrowth} />
        </ChartCard>

        <ChartCard title="Teacher-wise Completion" subtitle="Aggregated across every class + subject that teacher owns" scrollable={teacherGrowth.length > 8}>
          <HorizontalBarChart data={teacherGrowth} />
        </ChartCard>
      </div>

      <GrowthSection title="Teacher-wise Growth" noun="teachers" rows={teacherGrowth} threshold={teacherThreshold} onThreshold={setTeacherThreshold} />
      <GrowthSection title="Class-wise Growth" noun="classes" rows={classGrowth} threshold={classThreshold} onThreshold={setClassThreshold} />
    </div>
  );
}

// Fixed-height card shell for a chart. When `scrollable` is set (long
// teacher lists), the chart itself grows taller than the card and scrolls
// inside it instead of squeezing every bar unreadably thin.
function ChartCard({ title, subtitle, scrollable, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-1">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      {scrollable ? (
        <div className="overflow-y-auto" style={{ maxHeight: 280 }}>{children}</div>
      ) : (
        <div style={{ height: 280 }}>{children}</div>
      )}
    </div>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-xs text-gray-400">No data yet</div>;
}

// Horizontal % Complete bar chart, one row per entry - shared by Class-wise/
// Subject-wise/Teacher-wise, since they're all the exact same shape (name +
// pct). Height grows with row count (min 200px) so long lists (e.g. 50+
// teachers) still read instead of compressing every bar to a sliver -
// ChartCard scrolls the overflow when that pushes past its own max height.
function HorizontalBarChart({ data: raw }) {
  if (raw.length === 0) return <EmptyChart />;
  const data = raw.map(d => ({ ...d, pct: Math.round(d.pct) }));
  const height = Math.max(200, data.length * 34);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="pct" name="Complete" unit="%" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d) => <Cell key={d.id} fill={pctColor(d.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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

// ── Import - bulk-add chapters from an Excel sheet, chapter-wise only (no
// subtopics - those stay a manual, per-chapter add in Browse & Edit). Class
// and Subject are picked once up front (not per-row in the sheet), and the
// subject teacher auto-fills from Settings → Timetable for that class+
// subject instead of being typed per row - the sheet itself only ever needs
// Chapter No + Chapter Name. A single bulk addChapters() call, not a
// sequential loop - unlike enrollment numbers, nothing here depends on a
// live-incrementing counter, so there's no race to serialize against.
const IMPORT_FIELDS = [
  { key: "chapterNo",   label: "Chapter No",   required: true },
  { key: "chapterName", label: "Chapter Name", required: true },
];
const EXAMPLE_ROW = ["1", "Fractions"];

function ImportTab() {
  const fileRef = useRef(null);
  const [classNames, setClassNames]   = useState([]);
  const [subjectsMap, setSubjectsMap] = useState({});
  const [teachers, setTeachers]       = useState([]);
  const [allSyllabus, setAllSyllabus] = useState([]);
  const [yearLabel, setYearLabel]     = useState(null);
  const [ready, setReady]             = useState(false);

  const [step, setStep] = useState("setup"); // 'setup' | 'idle' | 'preview' | 'done'

  // Setup - class/subject picked once; teacher auto-detected from the
  // Timetable for that pair, editable in case the timetable isn't set up
  // for it yet (or is wrong).
  const [impClass, setImpClass]     = useState("");
  const [impSubject, setImpSubject] = useState("");
  const [teacherLookup, setTeacherLookup]     = useState("idle"); // 'idle' | 'loading' | 'done'
  const [autoTeacherName, setAutoTeacherName] = useState(null);
  const [impTeacherId, setImpTeacherId]       = useState("");

  const [parsed, setParsed]       = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    Promise.all([getClassesWithSections(), getAllClassSubjects(), getTeachingStaff(), getAllSyllabus(), getCurrentAcademicYear()])
      .then(([classes, subjMap, staff, syllabus, year]) => {
        const active = classes.filter(c => c.is_active).map(c => c.name);
        setClassNames(active);
        setSubjectsMap(subjMap);
        setTeachers(staff);
        setAllSyllabus(syllabus);
        setYearLabel(year?.label || null);
        setImpClass(prev => prev || active[0] || "");
      })
      .finally(() => setReady(true));
  }, []);

  const subjectsForImpClass = subjectsMap[impClass] || [];
  useEffect(() => {
    if (subjectsForImpClass.length && !subjectsForImpClass.includes(impSubject)) setImpSubject(subjectsForImpClass[0]);
  }, [impClass, subjectsForImpClass, impSubject]);

  // Re-detect the subject teacher every time class or subject changes.
  useEffect(() => {
    if (!impClass || !impSubject || !yearLabel) return;
    let cancelled = false;
    setTeacherLookup("loading");
    getSubjectTeacherFromTimetable(yearLabel, impClass, impSubject)
      .then(name => {
        if (cancelled) return;
        setAutoTeacherName(name);
        const match = teachers.find(t => t.name === name);
        setImpTeacherId(match?.id || "");
        setTeacherLookup("done");
      })
      .catch(() => { if (!cancelled) { setAutoTeacherName(null); setImpTeacherId(""); setTeacherLookup("done"); } });
    return () => { cancelled = true; };
  }, [impClass, impSubject, yearLabel, teachers]);

  function downloadTemplate() {
    const headerRow = IMPORT_FIELDS.map(f => f.label);
    const reqRow     = IMPORT_FIELDS.map(f => f.required ? "Required *" : "Optional");
    const ws = XLSX.utils.aoa_to_sheet([headerRow, reqRow, EXAMPLE_ROW]);
    ws["!cols"] = IMPORT_FIELDS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Syllabus");
    XLSX.writeFile(wb, `Syllabus_Import_${impClass}_${impSubject}.xlsx`.replace(/\s+/g, "_"));
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 3) { alert("File has no data rows. Please use the downloaded template."); return; }
        const headerRow = rows[0];
        const colMap = {};
        const stripHint = (label) => String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
        IMPORT_FIELDS.forEach(f => {
          const idx = headerRow.findIndex(h => stripHint(h) === stripHint(f.label));
          if (idx >= 0) colMap[f.key] = idx;
        });
        const dataRows = rows.slice(2);
        const result = [];
        const errs   = [];
        dataRows.forEach((row, i) => {
          if (row.every(c => !c)) return;
          const s = { _row: i + 3, _errors: [] };
          IMPORT_FIELDS.forEach(f => {
            const raw = colMap[f.key] !== undefined ? (row[colMap[f.key]] ?? "") : "";
            s[f.key] = String(raw).trim();
          });

          if (!s.chapterNo) s._errors.push("Chapter No missing");
          else if (!Number.isFinite(Number(s.chapterNo))) s._errors.push(`Chapter No "${s.chapterNo}" is not a number`);

          if (!s.chapterName) s._errors.push("Chapter Name missing");

          result.push(s);
          if (s._errors.length) errs.push(`Row ${s._row}: ${s._errors.join(", ")}`);
        });
        setParsed(result);
        setRowErrors(errs);
        setStep("preview");
      } catch { alert("Could not read the file. Please use the downloaded template (.xlsx)."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function confirmImport() {
    const valid = parsed.filter(s => s._errors.length === 0)
      .slice().sort((a, b) => Number(a.chapterNo) - Number(b.chapterNo));
    setImporting(true);
    setImportError(null);
    try {
      // Chapters already on file for this class+subject, so imported rows
      // append after them (sort_order) instead of colliding back at 0 -
      // same per-group counting the manual "Add Chapters" box relies on.
      const key = `${impClass}|${impSubject}`;
      let sortOrder = allSyllabus.filter(c => `${c.class}|${c.subject}` === key).length;
      const rows = valid.map(s => ({
        class: impClass, subject: impSubject, chapter: s.chapterName,
        status: "Not Started", teacher_id: impTeacherId, sort_order: sortOrder++,
      }));
      await addChapters(rows);
      // Keep the local count in sync so importing again right away (same or
      // a different class+subject) computes sort_order against what was
      // just added, not a stale pre-import snapshot.
      setAllSyllabus(prev => [...prev, ...rows]);
      setImportedCount(rows.length);
      setStep("done");
    } catch (err) {
      setImportError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function resetFile() { setParsed([]); setRowErrors([]); setStep("idle"); setImportError(null); setImportedCount(0); }
  function backToSetup() { resetFile(); setStep("setup"); }

  const valid   = parsed.filter(s => s._errors.length === 0);
  const invalid = parsed.filter(s => s._errors.length  >  0);

  if (!ready) return <LoadingBlock />;

  const teacherName = teachers.find(t => t.id === impTeacherId)?.name || "";
  const contextBar = (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs">
      <span className="font-semibold text-school-navy">{impClass}</span>
      <span className="text-gray-300">·</span>
      <span className="font-semibold text-gray-700">{impSubject}</span>
      <span className="text-gray-300">·</span>
      <span className="text-gray-500">Teacher: <span className="font-semibold text-gray-700">{teacherName || "—"}</span></span>
      <button onClick={backToSetup} className="ml-auto text-school-navy font-semibold hover:underline">Change</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {step === "setup" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-lg">
          <div>
            <p className="text-sm font-bold text-gray-700">1. Choose Class &amp; Subject</p>
            <p className="text-xs text-gray-400 mt-0.5">Applies to every chapter in the sheet you upload next.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select className={sel} value={impClass} onChange={e => setImpClass(e.target.value)}>
                {classNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
              <select className={sel} value={impSubject} onChange={e => setImpSubject(e.target.value)} disabled={!subjectsForImpClass.length}>
                {subjectsForImpClass.length === 0
                  ? <option value="">No subjects configured</option>
                  : subjectsForImpClass.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Subject Teacher</p>
            {teacherLookup === "loading" ? (
              <p className="text-xs text-gray-400">Checking the Timetable…</p>
            ) : autoTeacherName ? (
              <p className="text-xs text-green-700 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Auto-detected from Timetable: <span className="font-semibold">{autoTeacherName}</span></p>
            ) : (
              <p className="text-xs text-amber-700 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> No teacher found in the Timetable for this class + subject — pick one below.</p>
            )}
            <select className={sel + " mt-2"} value={impTeacherId} onChange={e => setImpTeacherId(e.target.value)}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <button
            onClick={() => setStep("idle")}
            disabled={!impClass || !impSubject || !impTeacherId}
            className="w-full flex items-center justify-center gap-2 bg-school-navy text-white py-2.5 rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-50">
            Continue
          </button>
        </div>
      )}

      {step === "idle" && (
        <div className="space-y-4">
          {contextBar}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">Step 1 — Download Template</p>
                  <p className="text-xs text-blue-600 mt-0.5">Just Chapter No + Chapter Name — chapter-wise only, no subtopics</p>
                </div>
              </div>
              <ul className="text-xs text-blue-700 space-y-1 pl-1">
                {["Row 2 shows which fields are required", "Row 3 shows example data — replace with real data", "One chapter per row"].map(t => (
                  <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0" />{t}</li>
                ))}
              </ul>
              <button onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                <Download className="w-4 h-4" /> Download Template (.xlsx)
              </button>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-900">Step 2 — Upload Filled File</p>
                  <p className="text-xs text-green-600 mt-0.5">Upload the template after filling in chapters</p>
                </div>
              </div>
              <ul className="text-xs text-green-700 space-y-1 pl-1">
                {["Use only the downloaded template", "Chapter No decides the order", "Supports .xlsx and .xls files"].map(t => (
                  <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0" />{t}</li>
                ))}
              </ul>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                <Upload className="w-4 h-4" /> Select Excel File
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {contextBar}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> {valid.length} valid chapter{valid.length !== 1 ? "s" : ""}
            </div>
            {invalid.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                <AlertCircle className="w-4 h-4" /> {invalid.length} row{invalid.length !== 1 ? "s" : ""} with errors
              </div>
            )}
            <span className="text-xs text-gray-400">{parsed.length} total rows parsed</span>
          </div>
          {rowErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-36 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">Errors — these rows will be skipped</p>
              {rowErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-700">Preview — First 10 valid rows, in Chapter No order</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-school-navy text-white">
                    {["#", "Chapter No", "Chapter Name"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valid.slice().sort((a, b) => Number(a.chapterNo) - Number(b.chapterNo)).slice(0, 10).map((s, i) => (
                    <tr key={i} className={"border-b border-gray-50 " + (i % 2 === 0 ? "bg-white" : "bg-gray-50/40")}>
                      <td className="px-3 py-2 text-gray-400">{s._row}</td>
                      <td className="px-3 py-2 text-school-navy font-semibold">{s.chapterNo}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{s.chapterName}</td>
                    </tr>
                  ))}
                  {valid.length > 10 && (
                    <tr><td colSpan={3} className="px-3 py-2 text-center text-xs text-gray-400">... and {valid.length - 10} more chapters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {importError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600">{importError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={resetFile}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              ← Back
            </button>
            <button
              onClick={confirmImport}
              disabled={valid.length === 0 || importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-50">
              {importing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                : <><Upload className="w-4 h-4" /> Import {valid.length} Chapter{valid.length !== 1 ? "s" : ""}</>
              }
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-800">Import Complete!</p>
          <p className="text-sm text-gray-500">
            <span className="font-bold text-green-700">{importedCount} chapter{importedCount !== 1 ? "s" : ""}</span> added to {impClass} · {impSubject}.
          </p>
          <div className="flex gap-3">
            <button onClick={resetFile}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors">
              <Upload className="w-4 h-4" /> Import More for {impSubject}
            </button>
            <button onClick={backToSetup}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Change Class / Subject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
