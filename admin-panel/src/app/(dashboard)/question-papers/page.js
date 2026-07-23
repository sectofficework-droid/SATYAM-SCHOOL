"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, Users, ChevronRight, CheckSquare, Square, Download, Save, ClipboardEdit,
} from "lucide-react";
import { getTeachingEmployees } from "@/lib/settingsService";
import { getQuestionFilters, getChapters, getQuestions, saveQuestionPaper } from "@/lib/questionBankService";
import DateInputDMY from "@/components/DateInputDMY";

const TRUST_ADDR1 = "Swaminarayan Nagar - Bhidbhanjan Society";
const TRUST_ADDR2 = "Pandesara, Surat - 394210";
const PHONE = "8200069671";

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fmtDuration(totalMinutes) {
  if (!totalMinutes) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

function fmtExamDate(iso) {
  if (!iso) return { date: "", day: "" };
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { date: `${dd}/${mm}/${d.getFullYear()}`, day: d.toLocaleDateString("en-US", { weekday: "long" }) };
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

// ── PDF generation ─────────────────────────────────────────────────────────
// Masthead mirrors the Bonafide Certificate's letterhead (documents/page.js) -
// top-anchored logo, Times New Roman school name sized to fit, a rule that
// matches the name's own width (not the full page), and a guard so the gold
// title rule can never sit above the logo's bottom edge.
function drawPaperHeader(doc, paper, logoB64) {
  const PW = 210, marginX = 16;
  const [nr, ng, nb] = rgb("#1a2b6b");
  const [gr, gg, gb] = rgb("#f59e0b");

  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(0.7);
  doc.rect(9, 9, PW - 18, 279 - 9, "S");

  const logoY = 14, logoH = 26, logoW = logoH * (1080 / 1200);
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", marginX, logoY, logoW, logoH); } catch {}
  }
  const textX = marginX + logoW + 8;
  const nameMaxWidth = PW - marginX - textX;

  function fitFontSize(text, startSize, minSize, maxWidth = nameMaxWidth) {
    let size = startSize;
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxWidth) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    return size;
  }

  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 0);
  const size1 = fitFontSize("SATYAM STARS", 22, 13);
  const size2 = fitFontSize("INTERNATIONAL SCHOOL", 13, 8);
  const baseline1 = logoY + 8;
  const baseline2 = baseline1 + 6.5;

  doc.setFontSize(size1);
  doc.text("SATYAM STARS", textX, baseline1);
  const width1 = doc.getTextWidth("SATYAM STARS");
  doc.setFontSize(size2);
  doc.text("INTERNATIONAL SCHOOL", textX, baseline2);
  const width2 = doc.getTextWidth("INTERNATIONAL SCHOOL");

  const ruleY = baseline2 + 3;
  const nameWidth = Math.max(width1, width2);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(textX, ruleY, textX + nameWidth, ruleY);

  doc.setFont("helvetica", "normal");
  const addrLine = `${TRUST_ADDR1}, ${TRUST_ADDR2}`;
  const phoneLine = `Ph: ${PHONE}`;
  fitFontSize(addrLine, 7.5, 5.5, nameWidth);
  doc.text(addrLine, textX, ruleY + 4);
  fitFontSize(phoneLine, 7.5, 5.5, nameWidth);
  doc.text(phoneLine, textX + nameWidth / 2, ruleY + 8, { align: "center" });

  // Gold rule never sits above the logo's own bottom edge, regardless of
  // how tall the name/address block ends up being.
  const preTitleRuleY = Math.max(ruleY + 12, logoY + logoH + 4);
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.6);
  doc.line(marginX, preTitleRuleY, PW - marginX, preTitleRuleY);

  doc.setTextColor(nr, ng, nb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titleY = preTitleRuleY + 7;
  doc.text(paper.title.toUpperCase(), PW / 2, titleY, { align: "center" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(paper.paperType === "Exam" ? "Question Paper" : "Assignment", PW / 2, titleY + 5, { align: "center" });

  const afterTitleRuleY = titleY + 8.5;
  doc.setDrawColor(gr, gg, gb);
  doc.line(marginX, afterTitleRuleY, PW - marginX, afterTitleRuleY);

  // Info bar: Class / Subject on row 1, Date+Day / Time / Full Marks on row 2.
  const { date, day } = fmtExamDate(paper.examDate);
  const infoTop = afterTitleRuleY + 4;
  const infoH = paper.paperType === "Exam" ? 15 : 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, infoTop, PW - marginX * 2, infoH, "S");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  const row1Y = infoTop + 6;
  doc.text(`Class: ${paper.class}`, marginX + 4, row1Y);
  doc.text(`Subject: ${paper.subject}`, marginX + 65, row1Y);
  doc.text(`Full Marks: ${paper.fullMarks}`, PW - marginX - 4, row1Y, { align: "right" });
  if (paper.paperType === "Exam") {
    const row2Y = infoTop + 12;
    if (date) doc.text(`Date: ${date}${day ? ` (${day})` : ""}`, marginX + 4, row2Y);
    if (paper.durationMinutes) doc.text(`Time: ${fmtDuration(paper.durationMinutes)}`, PW - marginX - 4, row2Y, { align: "right" });
  }

  return infoTop + infoH + 8;
}

async function generatePaperPDF(paper, questions, logoB64) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, marginX = 16;

  let y = drawPaperHeader(doc, paper, logoB64);
  const maxWidth = PW - marginX * 2 - 4;

  const mcq = questions.filter(q => q.question_format === "MCQ");
  const written = questions.filter(q => q.question_format !== "MCQ").sort((a, b) => a.marks - b.marks);

  let qNum = 1;
  const ensureSpace = (needed) => {
    if (y + needed > 280) {
      doc.addPage();
      doc.setDrawColor(...rgb("#1a2b6b"));
      doc.setLineWidth(0.7);
      doc.rect(9, 9, PW - 18, 279 - 9, "S");
      y = 20;
    }
  };
  const marksLabel = (m) => `(${m} Mark${m == 1 ? "" : "s"})`;

  if (mcq.length) {
    ensureSpace(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Section A - Multiple Choice Questions", marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const q of mcq) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} ${marksLabel(q.marks)}`, maxWidth);
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
  const marksKeys = Object.keys(writtenByMarks).sort((a, b) => a - b);

  for (const marks of marksKeys) {
    const group = writtenByMarks[marks];
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const sectionLetter = String.fromCharCode(65 + (mcq.length ? 1 : 0) + marksKeys.indexOf(marks));
    doc.text(`Section ${sectionLetter} - ${marks} Mark${marks == 1 ? "" : "s"} Questions`, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const q of group) {
      const lines = doc.splitTextToSize(`${qNum}. ${q.question_text} ${marksLabel(q.marks)}`, maxWidth);
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function QuestionPapersPage() {
  const [paperType, setPaperType] = useState("Exam");

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

  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState("1");
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [examDate, setExamDate] = useState("");
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
      setSelQuestionIds(new Set()); // default: none selected - admin ticks what they want
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
  const examDay = examDate ? fmtExamDate(examDate).day : "";

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
      const totalMinutes = paperType === "Exam"
        ? (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0)
        : null;
      const paper = {
        teacherId, paperType, title: title.trim(), class: selClass, subject: selSubject,
        durationMinutes: totalMinutes || null,
        examDate: paperType === "Exam" ? (examDate || null) : null,
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

      {/* Step 1: Exam or Assignment */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ClipboardEdit className="w-4 h-4 text-school-navy" /> What do you want to create?
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
      </div>

      {/* Step 2: Teacher */}
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

      {/* Step 3: Class + Subject */}
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

      {/* Step 4: Chapters */}
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

      {/* Step 5: Questions */}
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

      {/* Step 6: Paper details + generate */}
      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-school-navy" /> Paper Details
          </h2>
          <input type="text" placeholder={paperType === "Exam" ? "e.g. Mid Term Examination" : "e.g. Chapter 5 Assignment"}
            value={title} onChange={e => setTitle(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />

          {paperType === "Exam" && (
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <DateInputDMY value={examDate} onChange={e => setExamDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
              </div>
              <div className="min-w-28">
                <label className="text-xs text-gray-500 mb-1 block">Day</label>
                <div className="border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-500 h-[42px] flex items-center">
                  {examDay || "—"}
                </div>
              </div>
            </div>
          )}

          {paperType === "Exam" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Duration</label>
              <div className="flex gap-3">
                <select value={durationHours} onChange={e => setDurationHours(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy">
                  {Array.from({ length: 7 }, (_, i) => i).map(h => (
                    <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>
                  ))}
                </select>
                <select value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy">
                  {[0, 10, 15, 20, 30, 40, 45, 50].map(m => (
                    <option key={m} value={m}>{m} minutes</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <input type="number" placeholder={`Full Marks (auto: ${computedFullMarks})`} value={fullMarksOverride}
            onChange={e => setFullMarksOverride(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />

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
