"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, Download } from "lucide-react";
import { getTeacherDocuments } from "@/lib/teacherDocumentsService";
import { getS3ViewUrl } from "@/lib/s3Upload";

const SECTIONS = [
  { key: "assignment", label: "Assignment" },
  { key: "exam_paper", label: "Exam Paper" },
  { key: "question_bank", label: "Question Bank" },
];

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Documents teachers upload from the app's Question Bank module (Assignment
// / Exam Paper / Question Bank) - replaces the old in-app question builder +
// paper generator this page used to drive, which stopped being reachable
// from the teacher app once it switched to plain document uploads.
export default function QuestionBankPage() {
  const [section, setSection] = useState("assignment");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    setLoading(true);
    setClassFilter(""); setSubjectFilter(""); setYearFilter(""); setSearch("");
    getTeacherDocuments(section).then(setDocs).catch(() => setDocs([])).finally(() => setLoading(false));
  }, [section]);

  const classes  = useMemo(() => [...new Set(docs.map(d => d.class))].sort(), [docs]);
  const subjects = useMemo(() => [...new Set(docs.filter(d => !classFilter || d.class === classFilter).map(d => d.subject))].sort(), [docs, classFilter]);
  const years    = useMemo(() => [...new Set(docs.map(d => d.academic_year))].sort().reverse(), [docs]);

  const filtered = docs.filter(d =>
    (!classFilter || d.class === classFilter) &&
    (!subjectFilter || d.subject === subjectFilter) &&
    (!yearFilter || d.academic_year === yearFilter) &&
    (!search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.teacher?.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  async function openDoc(doc) {
    setOpening(doc.id);
    try {
      const url = await getS3ViewUrl(doc.file_key, doc.file_name);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else alert("Could not open this document.");
    } finally {
      setOpening(null);
    }
  }

  const activeSection = SECTIONS.find(s => s.key === section);
  const titleField = section === "exam_paper" ? "Exam Name" : "Title";

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Question Bank</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Documents teachers have uploaded from the app - Assignments, Exam Papers, and Question Banks.
        </p>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              section === s.key ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSubjectFilter(""); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy">
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy">
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input type="text" placeholder={`Search ${titleField.toLowerCase()} or teacher...`} value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy" />
        <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
          {loading ? "" : `${filtered.length} document${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <FileText className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-400">
              No {activeSection.label.toLowerCase()} documents {docs.length ? "match these filters" : "uploaded yet"}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-semibold">{titleField}</th>
                  <th className="px-3 py-2.5 font-semibold">Teacher</th>
                  <th className="px-3 py-2.5 font-semibold">Class</th>
                  <th className="px-3 py-2.5 font-semibold">Subject</th>
                  <th className="px-3 py-2.5 font-semibold">Year</th>
                  <th className="px-3 py-2.5 font-semibold">Uploaded</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{d.title}</td>
                    <td className="px-3 py-2.5 text-gray-600">{d.teacher?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-school-navy font-semibold whitespace-nowrap">{d.class}</td>
                    <td className="px-3 py-2.5 text-gray-600">{d.subject}</td>
                    <td className="px-3 py-2.5 text-gray-500">{d.academic_year}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(d.created_at)} · {formatSize(d.file_size)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => openDoc(d)} disabled={opening === d.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 ml-auto">
                        <Download className="w-3.5 h-3.5" />{opening === d.id ? "Opening..." : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
