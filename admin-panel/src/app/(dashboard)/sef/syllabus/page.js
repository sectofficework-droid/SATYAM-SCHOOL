"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Trash2, ChevronDown, ChevronUp, BookOpen, TrendingUp } from "lucide-react";
import {
  getSyllabus, getSubtopicsForChapters, addChapters, updateChapterStatus,
  deleteChapter, addSubtopics, updateSubtopicStatus, deleteSubtopic,
} from "@/lib/sefSyllabusService";
import { getSefClasses, getSefStdSubjects } from "@/lib/sefSettingsService";
import { getEmployees } from "@/lib/sefEmployeeService";

const STATUSES = ["Not Started", "In Progress", "Completed"];
const STATUS_COLOR = { "Not Started": "bg-gray-100 text-gray-500", "In Progress": "bg-amber-100 text-amber-700", "Completed": "bg-green-100 text-green-700" };

function cycle(status) { return STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length]; }

export default function SefSyllabusPage() {
  const [tab, setTab] = useState("browse"); // browse | growth
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Syllabus</h1>
        <p className="text-sm text-gray-500 mt-0.5">Chapter and subtopic progress per Std &amp; Subject</p>
      </div>
      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit">
        <button onClick={() => setTab("browse")} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "browse" ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <BookOpen className="w-4 h-4" /> Browse &amp; Edit
        </button>
        <button onClick={() => setTab("growth")} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "growth" ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <TrendingUp className="w-4 h-4" /> Growth
        </button>
      </div>
      {tab === "browse" ? <BrowseTab /> : <GrowthTab />}
    </div>
  );
}

function BrowseTab() {
  const [classes, setClasses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [std, setStd] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState([]);
  const [subtopics, setSubtopics] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { getSefClasses().then(setClasses).catch(() => {}); getEmployees().then(setEmployees).catch(() => {}); }, []);
  useEffect(() => {
    setSubject(""); setSubjects([]); setChapters([]);
    if (!std) return;
    getSefStdSubjects(std).then(setSubjects).catch(() => {});
  }, [std]);

  const loadChapters = useCallback(() => {
    if (!std || !subject) { setChapters([]); return; }
    getSyllabus(std, subject).then(async rows => {
      setChapters(rows);
      const subs = await getSubtopicsForChapters(rows.map(r => r.id));
      const map = {};
      subs.forEach(s => (map[s.chapter_id] ||= []).push(s));
      setSubtopics(map);
    }).catch(() => {});
  }, [std, subject]);
  useEffect(loadChapters, [loadChapters]);

  async function handleToggleChapterStatus(c) { await updateChapterStatus(c.id, cycle(c.status)); loadChapters(); }
  async function handleDeleteChapter(id) { if (confirm("Delete this chapter and its subtopics?")) { await deleteChapter(id); loadChapters(); } }
  async function handleToggleSubtopicStatus(s) { await updateSubtopicStatus(s.id, cycle(s.status)); loadChapters(); }
  async function handleDeleteSubtopic(id) { await deleteSubtopic(id); loadChapters(); }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-3 flex-wrap">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-40" value={std} onChange={e => setStd(e.target.value)}>
          <option value="">Std...</option>
          {classes.map(c => <option key={c.std} value={c.std}>{c.std}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-40" value={subject} onChange={e => setSubject(e.target.value)} disabled={!std}>
          <option value="">Subject...</option>
          {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
        </select>
        {std && subject && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-school-navy text-white rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors ml-auto">
            <Plus className="w-4 h-4" /> Add Chapters
          </button>
        )}
      </div>

      {std && subject && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {chapters.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">No chapters added yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {chapters.map(c => {
                const subs = subtopics[c.id] || [];
                const isOpen = expanded.has(c.id);
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                      <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.chapter}</p>
                          {c.tutor?.name && <p className="text-xs text-gray-400">{c.tutor.name}</p>}
                        </div>
                      </button>
                      <button onClick={() => handleToggleChapterStatus(c)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${STATUS_COLOR[c.status]}`}>{c.status}</button>
                      <button onClick={() => handleDeleteChapter(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {isOpen && (
                      <div className="px-12 pb-3 space-y-2">
                        {subs.map(s => (
                          <div key={s.id} className="flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-600">{s.name}</p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleToggleSubtopicStatus(s)} className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_COLOR[s.status]}`}>{s.status}</button>
                              <button onClick={() => handleDeleteSubtopic(s.id)} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                        <AddSubtopics chapterId={c.id} onAdded={loadChapters} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddChaptersModal std={std} subject={subject} employees={employees} onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadChapters(); }} />
      )}
    </div>
  );
}

function AddSubtopics({ chapterId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  async function handleAdd() {
    const names = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (!names.length) return;
    await addSubtopics(chapterId, names);
    setText(""); setOpen(false); onAdded();
  }
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-semibold text-school-navy hover:underline">+ Add Subtopics</button>;
  return (
    <div className="flex items-start gap-2">
      <textarea rows={2} className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" placeholder="One per line" value={text} onChange={e => setText(e.target.value)} />
      <button onClick={handleAdd} className="px-2.5 py-1.5 bg-school-navy text-white rounded-lg text-xs font-semibold">Add</button>
    </div>
  );
}

function AddChaptersModal({ std, subject, employees, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const names = [...new Set(text.split("\n").map(l => l.trim()).filter(Boolean))];
    if (!names.length) return;
    setSaving(true);
    try { await addChapters(std, subject, names, tutorId || null); onSaved(); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Add Chapters — {std} · {subject}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tutor (optional)</label>
            <select className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm" value={tutorId} onChange={e => setTutorId(e.target.value)}>
              <option value="">Unassigned</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Chapters (one per line)</label>
            <textarea rows={5} className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm" value={text} onChange={e => setText(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Add Chapters"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GrowthTab() {
  const [classes, setClasses] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSefClasses().then(async cls => {
      setClasses(cls);
      const all = await getSyllabus();
      const subs = await getSubtopicsForChapters(all.map(c => c.id));
      const subsByChapter = {};
      subs.forEach(s => (subsByChapter[s.chapter_id] ||= []).push(s));

      const byStd = {};
      for (const c of all) {
        const key = c.std;
        (byStd[key] ||= { total: 0, completed: 0 });
        const chSubs = subsByChapter[c.id] || [];
        if (chSubs.length === 0) {
          byStd[key].total += 1;
          if (c.status === "Completed") byStd[key].completed += 1;
        } else {
          byStd[key].total += chSubs.length;
          byStd[key].completed += chSubs.filter(s => s.status === "Completed").length;
        }
      }
      setRows(Object.entries(byStd).map(([std, v]) => ({ std, ...v, pct: v.total ? Math.round((v.completed / v.total) * 100) : 0 })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">No syllabus data yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(r => (
            <div key={r.std} className="flex items-center justify-between px-5 py-3.5">
              <p className="text-sm font-semibold text-gray-800">Std {r.std}</p>
              <div className="flex items-center gap-3 w-1/2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-school-navy rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-600 w-10 text-right">{r.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
