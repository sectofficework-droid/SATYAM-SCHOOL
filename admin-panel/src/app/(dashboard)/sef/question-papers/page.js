"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, ChevronRight, CheckSquare, Square, Download, Save, ClipboardEdit,
  GraduationCap, BookOpen, Plus, Trash2, Database,
} from "lucide-react";
import {
  addQuestion, deleteQuestion, getQuestionsForChapter,
  getStdsWithQuestions, getSubjectsForStd, getChapters, getQuestions, saveQuestionPaper,
} from "@/lib/sefQuestionBankService";
import { getSefClasses, getSefStdSubjects } from "@/lib/sefSettingsService";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

function fmtExamDate(iso) {
  if (!iso) return { date: "", day: "" };
  const d = new Date(iso + "T00:00:00");
  return { date: d.toLocaleDateString("en-IN"), day: d.toLocaleDateString("en-US", { weekday: "long" }) };
}

async function generatePaperPDF(paper, questions) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, marginX = 16;
  doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.7); doc.rect(9, 9, PW - 18, 279 - 9, "S");

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(30, 58, 95);
  doc.text("SATYAM EDUCATION FOUNDATION", PW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
  doc.text(paper.paperType === "Exam" ? "Question Paper" : "Assignment", PW / 2, 28, { align: "center" });

  doc.setDrawColor(245, 158, 11); doc.setLineWidth(0.6); doc.line(marginX, 32, PW - marginX, 32);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 58, 95);
  doc.text(paper.title.toUpperCase(), PW / 2, 40, { align: "center" });
  doc.setDrawColor(245, 158, 11); doc.line(marginX, 44, PW - marginX, 44);

  const { date, day } = fmtExamDate(paper.examDate);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  const infoH = paper.paperType === "Exam" ? 15 : 8;
  doc.rect(marginX, 48, PW - marginX * 2, infoH, "S");
  doc.setTextColor(0, 0, 0); doc.setFontSize(9.5); doc.setFont("helvetica", "bold");
  doc.text(`Std: ${paper.std}`, marginX + 4, 54);
  doc.text(`Subject: ${paper.subject}`, marginX + 65, 54);
  doc.text(`Full Marks: ${paper.fullMarks}`, PW - marginX - 4, 54, { align: "right" });
  if (paper.paperType === "Exam") {
    if (date) doc.text(`Date: ${date}${day ? ` (${day})` : ""}`, marginX + 4, 60);
    if (paper.durationMinutes) doc.text(`Time: ${paper.durationMinutes} min`, PW - marginX - 4, 60, { align: "right" });
  }

  let y = 48 + infoH + 10;
  const maxWidth = PW - marginX * 2 - 4;
  const mcq = questions.filter(q => q.question_format === "MCQ");
  const written = questions.filter(q => q.question_format !== "MCQ").sort((a, b) => a.marks - b.marks);
  let qNum = 1;
  const ensureSpace = (needed) => {
    if (y + needed > 280) {
      doc.addPage(); doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.7); doc.rect(9, 9, PW - 18, 279 - 9, "S"); y = 20;
    }
  };
  const marksLabel = (m) => `(${m} Mark${m == 1 ? "" : "s"})`;

  if (mcq.length) {
    ensureSpace(12); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
    doc.text("Section A — Multiple Choice Questions", marginX, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const q of mcq) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} ${marksLabel(q.marks)}`, maxWidth);
      ensureSpace(lines.length * 5.5 + (q.options?.length || 0) * 5.5 + 4);
      doc.text(lines, marginX, y); y += lines.length * 5.5 + 1;
      for (const opt of (q.options || [])) { doc.text(`   ${opt.label}. ${opt.text}`, marginX + 4, y); y += 5.5; }
      y += 2; qNum++;
    }
    y += 4;
  }

  const byMarks = {};
  for (const q of written) (byMarks[q.marks] ||= []).push(q);
  const marksKeys = Object.keys(byMarks).sort((a, b) => a - b);
  for (const marks of marksKeys) {
    const group = byMarks[marks];
    ensureSpace(12); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    const sectionLetter = String.fromCharCode(65 + (mcq.length ? 1 : 0) + marksKeys.indexOf(marks));
    doc.text(`Section ${sectionLetter} — ${marks} Mark${marks == 1 ? "" : "s"} Questions`, marginX, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const q of group) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} ${marksLabel(q.marks)}`, maxWidth);
      ensureSpace(lines.length * 5.5 + 4);
      doc.text(lines, marginX, y); y += lines.length * 5.5 + 4; qNum++;
    }
    y += 4;
  }

  ensureSpace(10); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
  doc.text("* * * All the Best * * *", PW / 2, y + 4, { align: "center" });
  doc.save(`${paper.title.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
}

export default function SefQuestionPapersPage() {
  const [tab, setTab] = useState("generate"); // bank | generate
  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Question Papers</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage the question bank and generate exam papers/assignments</p>
      </div>
      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit">
        <button onClick={() => setTab("bank")} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "bank" ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <Database className="w-4 h-4" /> Question Bank
        </button>
        <button onClick={() => setTab("generate")} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "generate" ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <FileText className="w-4 h-4" /> Generate Paper
        </button>
      </div>
      {tab === "bank" ? <QuestionBankTab /> : <GeneratePaperTab />}
    </div>
  );
}

// ── Question Bank management ──────────────────────────────────────
function QuestionBankTab() {
  const [classes, setClasses] = useState([]);
  const [std, setStd] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [questions, setQuestions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { getSefClasses().then(setClasses).catch(() => {}); }, []);
  useEffect(() => { setSubject(""); setSubjects([]); if (std) getSefStdSubjects(std).then(setSubjects).catch(() => {}); }, [std]);

  const load = useCallback(() => {
    if (!std || !subject || !chapter.trim()) { setQuestions([]); return; }
    getQuestionsForChapter(std, subject, chapter.trim()).then(setQuestions).catch(() => {});
  }, [std, subject, chapter]);
  useEffect(load, [load]);

  async function handleDelete(id) { await deleteQuestion(id); load(); }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-3 flex-wrap">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-32" value={std} onChange={e => setStd(e.target.value)}>
          <option value="">Std...</option>
          {classes.map(c => <option key={c.std} value={c.std}>{c.std}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-40" value={subject} onChange={e => setSubject(e.target.value)} disabled={!std}>
          <option value="">Subject...</option>
          {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
        </select>
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-40" placeholder="Chapter name" value={chapter} onChange={e => setChapter(e.target.value)} disabled={!subject} />
        {std && subject && chapter.trim() && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-school-navy text-white rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors ml-auto">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        )}
      </div>

      {std && subject && chapter.trim() && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {questions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-gray-400">No questions added for this chapter yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {questions.map(q => (
                <div key={q.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700">{q.question_text} <span className="text-gray-400">({q.marks} Mark{q.marks === 1 ? "" : "s"} · {q.question_format})</span></p>
                    {q.options?.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">{q.options.map(o => `${o.label}. ${o.text}`).join("  ")}</div>
                    )}
                  </div>
                  <button onClick={() => handleDelete(q.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddQuestionModal std={std} subject={subject} chapter={chapter.trim()} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

function AddQuestionModal({ std, subject, chapter, onClose, onSaved }) {
  const [format, setFormat] = useState("Written");
  const [marks, setMarks] = useState("1");
  const [text, setText] = useState("");
  const [options, setOptions] = useState([{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]);
  const [correctOption, setCorrectOption] = useState("A");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!text.trim()) { setError("Enter the question text"); return; }
    setError(""); setSaving(true);
    try {
      await addQuestion({
        std, subject, chapter, questionFormat: format, marks: Number(marks) || 1, questionText: text.trim(),
        options: format === "MCQ" ? options.filter(o => o.text.trim()) : null,
        correctOption: format === "MCQ" ? correctOption : null,
      });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Add Question — {std} · {subject} · {chapter}</h3>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Format</label>
              <select className={IPT} value={format} onChange={e => setFormat(e.target.value)}>
                <option>Written</option><option>MCQ</option>
              </select>
            </div>
            <div>
              <label className={LBL}>Marks</label>
              <input type="number" className={IPT} value={marks} onChange={e => setMarks(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LBL}>Question Text *</label>
            <textarea rows={3} className={IPT} value={text} onChange={e => setText(e.target.value)} />
          </div>
          {format === "MCQ" && (
            <div className="space-y-2">
              <label className={LBL}>Options</label>
              {options.map((o, i) => (
                <div key={o.label} className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500 w-5">{o.label}.</span>
                  <input className={IPT} value={o.text} onChange={e => setOptions(prev => prev.map((p, idx) => idx === i ? { ...p, text: e.target.value } : p))} />
                </div>
              ))}
              <div>
                <label className={LBL}>Correct Option</label>
                <select className={IPT} value={correctOption} onChange={e => setCorrectOption(e.target.value)}>
                  {options.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Add Question"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Paper ────────────────────────────────────────────────
function GeneratePaperTab() {
  const [paperType, setPaperType] = useState("Exam");
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selStd, setSelStd] = useState("");
  const [selSubject, setSelSubject] = useState("");
  const [chapters, setChapters] = useState([]);
  const [selChapters, setSelChapters] = useState(new Set());
  const [questions, setQuestions] = useState([]);
  const [selQuestionIds, setSelQuestionIds] = useState(new Set());

  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [examDate, setExamDate] = useState("");
  const [fullMarksOverride, setFullMarksOverride] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getStdsWithQuestions().then(setClasses).catch(() => {}); }, []);
  useEffect(() => {
    setSelSubject(""); setSubjects([]); setChapters([]); setSelChapters(new Set()); setQuestions([]); setSelQuestionIds(new Set());
    if (!selStd) return;
    getSubjectsForStd(selStd).then(setSubjects).catch(() => {});
  }, [selStd]);

  const loadChapters = useCallback(() => {
    setChapters([]); setSelChapters(new Set()); setQuestions([]); setSelQuestionIds(new Set());
    if (!selStd || !selSubject) return;
    getChapters(selStd, selSubject).then(setChapters).catch(() => {});
  }, [selStd, selSubject]);
  useEffect(loadChapters, [loadChapters]);

  const loadQuestions = useCallback(() => {
    if (!selChapters.size) { setQuestions([]); setSelQuestionIds(new Set()); return; }
    getQuestions(selStd, selSubject, [...selChapters]).then(qs => { setQuestions(qs); setSelQuestionIds(new Set()); }).catch(() => {});
  }, [selStd, selSubject, selChapters]);
  useEffect(loadQuestions, [loadQuestions]);

  const grouped = useMemo(() => {
    const map = {};
    for (const q of questions) {
      const key = q.question_format === "MCQ" ? "MCQ" : `${q.marks} Mark${q.marks === 1 ? "" : "s"}`;
      (map[key] ||= []).push(q);
    }
    return map;
  }, [questions]);

  const selectedQuestions = questions.filter(q => selQuestionIds.has(q.id));
  const computedFullMarks = selectedQuestions.reduce((s, q) => s + q.marks, 0);
  const fullMarks = fullMarksOverride ? parseInt(fullMarksOverride) : computedFullMarks;
  const examDay = examDate ? fmtExamDate(examDate).day : "";

  function toggleChapter(c) { setSelChapters(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; }); }
  function toggleQuestion(id) { setSelQuestionIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function handleGenerate() {
    if (!title.trim()) { alert("Enter a title for the paper."); return; }
    if (!selectedQuestions.length) { alert("Select at least one question."); return; }
    setGenerating(true);
    try {
      const totalMinutes = paperType === "Exam" ? (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0) : null;
      const paper = { paperType, title: title.trim(), std: selStd, subject: selSubject, durationMinutes: totalMinutes || null, examDate: paperType === "Exam" ? (examDate || null) : null, fullMarks };
      await saveQuestionPaper(paper, selectedQuestions.map(q => q.id));
      await generatePaperPDF(paper, selectedQuestions);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Failed to generate paper: " + e.message);
    } finally { setGenerating(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><ClipboardEdit className="w-4 h-4 text-school-navy" /> What do you want to create?</h2>
        <div className="flex gap-2">
          {["Exam", "Assignment"].map(t => (
            <button key={t} onClick={() => setPaperType(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${paperType === t ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-school-navy" /> Select Std</h2>
        {classes.length === 0 ? <p className="text-sm text-gray-400">No questions have been added to the question bank yet.</p> : (
          <select value={selStd} onChange={e => setSelStd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
            <option value="">Choose a std...</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {selStd && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-school-navy" /> Select Subject</h2>
          {subjects.length === 0 ? <p className="text-sm text-gray-400">No questions found for this std.</p> : (
            <select value={selSubject} onChange={e => setSelSubject(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
              <option value="">Choose a subject...</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      )}

      {selStd && selSubject && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><ChevronRight className="w-4 h-4 text-school-navy" /> Chapters</h2>
          {chapters.length === 0 ? <p className="text-sm text-gray-400">No chapters found.</p> : (
            <div className="flex gap-2 flex-wrap">
              {chapters.map(c => (
                <button key={c} onClick={() => toggleChapter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selChapters.has(c) ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{c}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FileText className="w-4 h-4 text-school-navy" /> Questions ({selQuestionIds.size}/{questions.length} selected)</h2>
            <span className="text-xs font-semibold text-school-navy bg-school-navy/10 px-3 py-1 rounded-full">{computedFullMarks} marks selected</span>
          </div>
          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-bold text-school-navy uppercase tracking-wide mb-2">{label} ({items.length})</p>
                <div className="flex flex-col gap-2">
                  {items.map(q => {
                    const checked = selQuestionIds.has(q.id);
                    return (
                      <button key={q.id} onClick={() => toggleQuestion(q.id)} className={`flex items-start gap-2.5 text-left p-3 rounded-xl border transition-colors ${checked ? "border-school-navy/30 bg-school-navy/5" : "border-gray-100 hover:bg-gray-50"}`}>
                        {checked ? <CheckSquare className="w-4 h-4 text-school-navy flex-shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                        <span className="text-sm text-gray-700">{q.question_text} <span className="text-gray-400">({q.marks} Mark{q.marks === 1 ? "" : "s"})</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><ChevronRight className="w-4 h-4 text-school-navy" /> Paper Details</h2>
          <input type="text" placeholder={paperType === "Exam" ? "e.g. Mid Term Examination" : "e.g. Chapter 5 Assignment"} value={title} onChange={e => setTitle(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
          {paperType === "Exam" && (
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <DateInputDMY value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
              </div>
              <div className="min-w-28">
                <label className="text-xs text-gray-500 mb-1 block">Day</label>
                <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-500 h-[42px] flex items-center">{examDay || "—"}</div>
              </div>
            </div>
          )}
          {paperType === "Exam" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Duration</label>
              <div className="flex gap-3">
                <select value={durationHours} onChange={e => setDurationHours(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                  {Array.from({ length: 7 }, (_, i) => i).map(h => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
                </select>
                <select value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                  {[0, 10, 15, 20, 30, 40, 45, 50].map(m => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </div>
            </div>
          )}
          <input type="number" placeholder={`Full Marks (auto: ${computedFullMarks})`} value={fullMarksOverride} onChange={e => setFullMarksOverride(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm" />
          <button onClick={handleGenerate} disabled={generating} className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${saved ? "bg-green-600 text-white" : "bg-school-navy text-white hover:bg-school-navy/90"}`}>
            {generating ? (<><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating...</>) : saved ? (<><Save className="w-4 h-4" />Saved &amp; Downloaded</>) : (<><Download className="w-4 h-4" />Generate PDF (Full Marks: {fullMarks})</>)}
          </button>
        </div>
      )}
    </div>
  );
}
