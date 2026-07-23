"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, Users, ChevronRight, CheckSquare, Square, Download, Save,
} from "lucide-react";
import { getTeachingEmployees } from "@/lib/settingsService";
import { getQuestionFilters, getChapters, getQuestions, saveQuestionPaper } from "@/lib/questionBankService";

const TRUST = "Satyam Education Charitable Trust ( E-8941 )";
const ADDR1 = "Swaminarayan Nagar - Bhidbhanjan Society";
const ADDR2 = "Pandesara, Surat - 394210";

function fmtIssueDateDMY(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── PDF generation ─────────────────────────────────────────────────────────
async function generatePaperPDF(paper, questions, logoB64) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, marginX = 18;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, PW - 20, 277, "S");

  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", marginX, 16, 20, 22.2); } catch {}
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SATYAM STARS INTERNATIONAL SCHOOL", PW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${ADDR1}, ${ADDR2}`, PW / 2, 27.5, { align: "center" });

  doc.setLineWidth(0.4);
  doc.line(marginX, 32, PW - marginX, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(paper.title.toUpperCase(), PW / 2, 41, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(paper.paperType === "Exam" ? "Question Paper" : "Assignment", PW / 2, 46.5, { align: "center" });

  // Info bar: class / subject / time / full marks
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, 51, PW - marginX * 2, 10, "S");
  doc.setFontSize(9.5);
  doc.text(`Class: ${paper.class}`, marginX + 4, 57.5);
  doc.text(`Subject: ${paper.subject}`, marginX + 55, 57.5);
  if (paper.durationMinutes) doc.text(`Time: ${paper.durationMinutes} min`, marginX + 105, 57.5);
  doc.text(`Full Marks: ${paper.fullMarks}`, PW - marginX - 4, 57.5, { align: "right" });

  let y = 68;
  const maxWidth = PW - marginX * 2 - 4;

  const mcq = questions.filter(q => q.question_format === "MCQ");
  const written = questions.filter(q => q.question_format !== "MCQ")
    .sort((a, b) => a.marks - b.marks);

  let qNum = 1;
  const ensureSpace = (needed) => {
    if (y + needed > 280) { doc.addPage(); doc.rect(10, 10, PW - 20, 277, "S"); y = 20; }
  };

  if (mcq.length) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Section A - Multiple Choice Questions (${mcq[0].marks} mark each)`, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const q of mcq) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text}`, maxWidth);
      ensureSpace(lines.length * 5.5 + (q.options?.length || 0) * 5.5 + 4);
      doc.text(lines, marginX, y);
      y += lines.length * 5.5 + 1;
      for (const opt of (q.options || [])) {
        doc.text(`   ${opt.label}. ${opt.text}`, marginX + 4, y);
        y += 5.5;
      }
      y += 2;
      qNum++;
    }
    y += 4;
  }

  const writtenByMarks = {};
  for (const q of written) (writtenByMarks[q.marks] ||= []).push(q);

  for (const marks of Object.keys(writtenByMarks).sort((a, b) => a - b)) {
    const group = writtenByMarks[marks];
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const sectionLetter = String.fromCharCode(65 + (mcq.length ? 1 : 0) + Object.keys(writtenByMarks).sort((a, b) => a - b).indexOf(marks));
    doc.text(`Section ${sectionLetter} - ${marks} Mark${marks == 1 ? "" : "s"} Questions`, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const q of group) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text}`, maxWidth);
      ensureSpace(lines.length * 5.5 + 4);
      doc.text(lines, marginX, y);
      y += lines.length * 5.5 + 4;
      qNum++;
    }
    y += 4;
  }

  ensureSpace(10);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("* * * All the Best * * *", PW / 2, y + 4, { align: "center" });

  doc.save(`${paper.title.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
}

async function fetchLogoBase64() {
  try {
    const res = await fetch(window.location.origin + "/school-logo.jpg");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function QuestionPapersPage() {
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selClass, setSelClass] = useState("");
  const [selSubject, setSelSubject] = useState("");
  const [chapters, setChapters] = useState([]);
  const [selChapters, setSelChapters] = useState(new Set());
  const [questions, setQuestions] = useState([]);
  const [selQuestionIds, setSelQuestionIds] = useState(new Set());

  const [paperType, setPaperType] = useState("Exam");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [fullMarksOverride, setFullMarksOverride] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getTeachingEmployees().then(setTeachers).catch(() => {}); }, []);

  useEffect(() => {
    setSelClass(""); setSelSubject(""); setClasses([]); setSubjects([]);
    setChapters([]); setSelChapters(new Set()); setQuestions([]); setSelQuestionIds(new Set());
    if (!teacherId) return;
    getQuestionFilters(teacherId).then(({ classes, subjects }) => { setClasses(classes); setSubjects(subjects); }).catch(() => {});
  }, [teacherId]);

  const loadChapters = useCallback(() => {
    setChapters([]); setSelChapters(new Set()); setQuestions([]); setSelQuestionIds(new Set());
    if (!teacherId || !selClass || !selSubject) return;
    getChapters(teacherId, selClass, selSubject).then(setChapters).catch(() => {});
  }, [teacherId, selClass, selSubject]);

  useEffect(() => { loadChapters(); }, [loadChapters]);

  const loadQuestions = useCallback(() => {
    if (!selChapters.size) { setQuestions([]); setSelQuestionIds(new Set()); return; }
    getQuestions(teacherId, selClass, selSubject, [...selChapters]).then(qs => {
      setQuestions(qs);
      setSelQuestionIds(new Set(qs.map(q => q.id))); // default: all selected
    }).catch(() => {});
  }, [teacherId, selClass, selSubject, selChapters]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

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

  function toggleChapter(c) {
    setSelChapters(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  function toggleQuestion(id) {
    setSelQuestionIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleGenerate() {
    if (!title.trim()) { alert("Enter a title for the paper."); return; }
    if (!selectedQuestions.length) { alert("Select at least one question."); return; }
    setGenerating(true);
    try {
      const paper = {
        teacherId, paperType, title: title.trim(), class: selClass, subject: selSubject,
        durationMinutes: paperType === "Exam" ? parseInt(duration) || null : null,
        fullMarks,
      };
      await saveQuestionPaper(paper, selectedQuestions.map(q => q.id));
      const logoB64 = await fetchLogoBase64();
      await generatePaperPDF(paper, selectedQuestions, logoB64);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Failed to generate paper: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Question Papers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate an exam paper or assignment from a teacher&apos;s question bank.
        </p>
      </div>

      {/* Step 1: Teacher */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-school-navy" /> Select Teacher
        </h2>
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy">
          <option value="">Choose a teacher...</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Step 2: Class + Subject */}
      {teacherId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-school-navy" /> Class &amp; Subject
          </h2>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400">This teacher hasn&apos;t added any questions yet.</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <select value={selClass} onChange={e => setSelClass(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-40">
                <option value="">Class...</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={selSubject} onChange={e => setSelSubject(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-40">
                <option value="">Subject...</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Chapters */}
      {selClass && selSubject && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-school-navy" /> Chapters
          </h2>
          {chapters.length === 0 ? (
            <p className="text-sm text-gray-400">No chapters found for this class/subject.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {chapters.map(c => {
                const active = selChapters.has(c);
                return (
                  <button key={c} onClick={() => toggleChapter(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Questions */}
      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-school-navy" /> Questions ({selQuestionIds.size}/{questions.length} selected)
            </h2>
            <span className="text-xs font-semibold text-school-navy bg-school-navy/10 px-3 py-1 rounded-full">
              {computedFullMarks} marks selected
            </span>
          </div>
          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-bold text-school-navy uppercase tracking-wide mb-2">{label} ({items.length})</p>
                <div className="flex flex-col gap-2">
                  {items.map(q => {
                    const checked = selQuestionIds.has(q.id);
                    return (
                      <button key={q.id} onClick={() => toggleQuestion(q.id)}
                        className={`flex items-start gap-2.5 text-left p-3 rounded-xl border transition-colors ${
                          checked ? "border-school-navy/30 bg-school-navy/5" : "border-gray-100 hover:bg-gray-50"
                        }`}>
                        {checked ? <CheckSquare className="w-4 h-4 text-school-navy flex-shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                        <span className="text-sm text-gray-700">{q.question_text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Paper details + generate */}
      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-school-navy" /> Paper Details
          </h2>
          <div className="flex gap-2">
            {["Exam", "Assignment"].map(t => (
              <button key={t} onClick={() => setPaperType(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                  paperType === t ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600"
                }`}>
                {t}
              </button>
            ))}
          </div>
          <input type="text" placeholder={paperType === "Exam" ? "e.g. Mid Term Examination" : "e.g. Chapter 5 Assignment"}
            value={title} onChange={e => setTitle(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
          <div className="flex gap-3">
            {paperType === "Exam" && (
              <input type="number" placeholder="Duration (minutes)" value={duration} onChange={e => setDuration(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
            )}
            <input type="number" placeholder={`Full Marks (auto: ${computedFullMarks})`} value={fullMarksOverride}
              onChange={e => setFullMarksOverride(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              saved ? "bg-green-600 text-white" : "bg-school-navy text-white hover:bg-school-navy/90"
            }`}>
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating...</>
            ) : saved ? (
              <><Save className="w-4 h-4" />Saved &amp; Downloaded</>
            ) : (
              <><Download className="w-4 h-4" />Generate PDF (Full Marks: {fullMarks})</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
