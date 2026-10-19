"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Landmark, IdCard, RefreshCw, CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { getStudentsForReport, getAcademicYearLabels } from "@/lib/reportService";
import { getPhases, getAllPhaseEntryEnrollments } from "@/lib/studentPhaseService";
import { updateStudentGovId } from "@/lib/studentService";

// Government Entry (2026-10-19) - a dedicated, action-oriented companion to
// Report > UDISE Entry / PEN Entry. The Report versions are for reading data
// INTO the government portals (export/copy); this module is for recording
// that an entry was actually FILED - "Entry Done" asks for the number the
// portal gave back (UDISE/PEN) and saves it to the student record, so the
// Report side's Entry Status (Done/Pending) reflects reality.
//
// Kept as an independent copy of the column layout/decoration logic from
// report/page.js's UDISE_ENTRY_COLUMNS/PEN_ENTRY_COLUMNS rather than a
// shared import - this page is read-only + action buttons, the Report page
// is export/column-picker machinery; if the government template's field
// order ever changes, both copies need updating (see report/page.js).

const CLASSES = ["JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th - Commerce","12th - Commerce"];
const SESSIONS_FALLBACK = ["2026-27","2025-26","2024-25","2023-24"];

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
}
function fmtDateDMY(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2,"0")}-${m.padStart(2,"0")}-${y}`;
}
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dobParts(dateStr) {
  if (!dateStr) return { birthYear: "", birthMonth: "", birthDate: "" };
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return { birthYear: "", birthMonth: "", birthDate: "" };
  const [y, m, d] = parts;
  const mi = parseInt(m, 10), di = parseInt(d, 10);
  return {
    birthYear:  y || "",
    birthMonth: mi ? `${mi}-${MONTH_ABBR[mi - 1]}` : "",
    birthDate:  di ? String(di) : "",
  };
}
function nameWithSurname(name, surname) {
  return [name, surname].filter(Boolean).join(" ").trim();
}

function decorate(st) {
  const fatherNameOnly = st.fatherName || "";
  const motherNameOnly = st.motherName || "";
  return {
    ...st,
    ...dobParts(st.dob),
    dobDMY:               fmtDateDMY(st.dob),
    fatherNameOnly,
    motherNameOnly,
    fatherName:           nameWithSurname(st.fatherName, st.surname),
    motherName:           nameWithSurname(st.motherName, st.surname),
    studentFatherSurname: `${st.firstName || ""} ${st.fatherName || ""} ${st.surname || ""}`.trim(),
    fullAddress:          [st.plotNo, st.society, st.landmark, st.area, "Surat", "Gujarat", st.pinCode].filter(Boolean).join(", "),
    udiseStatus:          st.udise && st.udise.trim() ? "Done" : "Pending",
    penStatus:            st.pen && st.pen.trim() && st.pen.trim() !== "Not Defined" ? "Done" : (st.pen && st.pen.trim() === "Not Defined" ? "Not Defined" : "Pending"),
  };
}

const UDISE_ENTRY_COLUMNS = [
  { key:"cls",               label:"Class" },
  { key:"udise",             label:"UDISE No" },
  { key:"birthCertRegNo",    label:"Birth Cert Reg No" },
  { key:"birthYear",         label:"Birth Year" },
  { key:"birthMonth",        label:"Birth Month" },
  { key:"birthDate",         label:"Birth Date" },
  { key:"gender",            label:"Gender" },
  { key:"birthState",        label:"Birth State" },
  { key:"birthDistrict",     label:"Birth District" },
  { key:"birthVillage",      label:"Birth Village" },
  { key:"birthCity",         label:"Birth City" },
  { key:"firstName",         label:"Student Name" },
  { key:"fatherNameOnly",    label:"Father's Name" },
  { key:"motherNameOnly",    label:"Mother's Name" },
  { key:"surname",           label:"Surname" },
  { key:"dobDMY",            label:"Date of Birth" },
  { key:"grNo",              label:"GR No" },
  { key:"roll",              label:"Roll No" },
  { key:"plotNo",            label:"Plot Number" },
  { key:"society",           label:"Society" },
  { key:"landmark",          label:"Landmark" },
  { key:"area",              label:"Area" },
  { key:"pinCode",           label:"Pin Code" },
  { key:"motherTongue",      label:"Mother Tongue" },
  { key:"joinDate",          label:"Date of Join", isDate:true },
  { key:"aadharNo",          label:"Aadhar Card No" },
  { key:"aadharName",        label:"Name as per Aadhar" },
  { key:"mobile1",           label:"Mobile No 1" },
  { key:"mobile2",           label:"Mobile No 2" },
];

const PEN_ENTRY_COLUMNS = [
  { key:"cls",                  label:"Class" },
  { key:"studentFatherSurname", label:"Student Father Surname" },
  { key:"gender",               label:"Gender" },
  { key:"dob",                  label:"Date of Birth", isDate:true },
  { key:"udise",                label:"Student State Code (UDISE No)" },
  { key:"motherName",           label:"Mother's Name" },
  { key:"fatherName",           label:"Father's Name" },
  { key:"aadharNo",             label:"Aadhar Number of Student" },
  { key:"aadharName",           label:"Name of Student as per Aadhar Card" },
  { key:"joinDate",             label:"Admission Date", isDate:true },
  { key:"fullAddress",          label:"Full Address" },
  { key:"pinCode",              label:"Pincode" },
  { key:"mobile1",              label:"Mobile No 1" },
  { key:"mobile2",              label:"Mobile No 2" },
  { key:"motherTongue",         label:"Mother Tongue" },
  { key:"grNo",                 label:"Admission Number in Present School (GR No)" },
  { key:"roll",                 label:"Roll No" },
  { key:"prevPercentage",       label:"Previous Class Percentage" },
  { key:"prevAttendanceDays",   label:"Previous Class Attendance Days" },
  { key:"height",               label:"Height (cm)" },
  { key:"weight",               label:"Weight (kg)" },
];

function formatCellValue(col, value) {
  if (value === undefined || value === null || value === "") return "";
  return col.isDate ? fmtDate(value) : value;
}

// Focusing a cell (click, or Tab into it) copies its value, so the admin can
// Tab across a row - alt-tabbing to the government portal and pasting after
// each Tab - without re-selecting text each time. Read-only: nothing here
// edits the table itself, only the clipboard.
async function copyCellToClipboard(value) {
  const text = value === undefined || value === null ? "" : String(value);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API can be blocked (insecure context, permission denied) -
    // the cell is still focused/highlighted so the admin can still Ctrl+C it.
  }
}

function StatusPill({ status }) {
  const cls =
    status === "Done"        ? "bg-green-100 text-green-700" :
    status === "Not Defined" ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}>{status}</span>;
}

export default function GovernmentEntryPage() {
  const [tab, setTab] = useState("udise"); // "udise" | "pen"
  const [dbStudents, setDbStudents] = useState([]);
  const [dbSessions, setDbSessions] = useState(SESSIONS_FALLBACK);
  const [dbPhases, setDbPhases] = useState([]);
  const [dbPhaseEntryEnrollments, setDbPhaseEntryEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ cls: "All", session: "All", batch: "All" });
  const [showNotDefinedOnly, setShowNotDefinedOnly] = useState(false);
  // eligTab (2026-10-19, user request: "only whose names are mentioned in
  // batch are eligible for entry, rest should stay separately under
  // uneligible for entry in a separate tab") - "eligible" means the student
  // has at least one entry in ANY batch/phase (enrollToBatches below), not
  // just the one currently picked in the Entry Batch dropdown. Kept as its
  // own sub-tab under both UDISE and PEN rather than a single shared tab,
  // since eligibility is the same fact either way but the two entry types
  // are reviewed separately.
  const [eligTab, setEligTab] = useState("eligible"); // "eligible" | "ineligible"

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        getStudentsForReport(),
        getAcademicYearLabels(),
        getPhases(),
        getAllPhaseEntryEnrollments(),
      ]);
      const [students, sessions, phases, entries] = results;
      if (students.status === "fulfilled") setDbStudents(students.value);
      if (sessions.status === "fulfilled" && sessions.value?.length) setDbSessions(sessions.value);
      if (phases.status === "fulfilled") setDbPhases(phases.value);
      if (entries.status === "fulfilled") setDbPhaseEntryEnrollments(entries.value);
    } catch (e) {
      console.error("Government Entry loadAll error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const batchOptions = useMemo(
    () => dbPhases.slice().sort((a, b) => a.phase_number - b.phase_number).map(p => `Batch ${p.phase_number}`),
    [dbPhases]
  );
  const enrollToBatches = useMemo(() => {
    const m = new Map();
    for (const e of dbPhaseEntryEnrollments) {
      if (!m.has(e.enrollmentNo)) m.set(e.enrollmentNo, new Set());
      m.get(e.enrollmentNo).add(e.phaseNumber);
    }
    return m;
  }, [dbPhaseEntryEnrollments]);

  const rows = useMemo(() => {
    let d = dbStudents.map(decorate);
    if (filters.cls !== "All") d = d.filter(x => x.cls === filters.cls);
    if (filters.session !== "All") d = d.filter(x => x.session === filters.session);
    if (eligTab === "ineligible") {
      // Not in any batch at all - the Entry Batch dropdown doesn't apply here.
      d = d.filter(x => !enrollToBatches.get(x.enrollNo)?.size);
    } else {
      d = d.filter(x => enrollToBatches.get(x.enrollNo)?.size);
      if (filters.batch !== "All") {
        const n = Number(String(filters.batch).match(/\d+/)?.[0]);
        d = d.filter(x => enrollToBatches.get(x.enrollNo)?.has(n));
      }
    }
    if (tab === "pen" && showNotDefinedOnly) d = d.filter(x => x.penStatus === "Not Defined");
    // Done first, then Not Defined (pen only), then Pending - so filed
    // entries don't get lost among the ones still waiting.
    const rank = { Done: 0, "Not Defined": 1, Pending: 2 };
    const statusKey = tab === "udise" ? "udiseStatus" : "penStatus";
    return d.slice().sort((a, b) => rank[a[statusKey]] - rank[b[statusKey]]);
  }, [dbStudents, filters, enrollToBatches, tab, showNotDefinedOnly, eligTab]);

  const pendingNotDefinedCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Not Defined").length,
    [dbStudents]
  );

  const columns = tab === "udise" ? UDISE_ENTRY_COLUMNS : PEN_ENTRY_COLUMNS;

  // ── Entry Done modal ────────────────────────────────────────────────────
  const [modalRow, setModalRow] = useState(null);
  const [formGrNo, setFormGrNo] = useState("");
  const [formUdise, setFormUdise] = useState("");
  const [formPen, setFormPen] = useState("");
  const [formPenNotDefined, setFormPenNotDefined] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function openEntryModal(row) {
    setModalRow(row);
    setFormGrNo(row.grNo || "");
    setFormUdise(row.udise || "");
    setFormPen(row.pen && row.pen !== "Not Defined" ? row.pen : "");
    setFormPenNotDefined(row.pen === "Not Defined");
    setFormError("");
  }
  function closeModal() {
    if (saving) return;
    setModalRow(null);
  }

  async function handleSave() {
    if (!modalRow) return;
    setFormError("");

    if (tab === "udise") {
      const digits = formUdise.trim();
      if (!/^\d{18}$/.test(digits)) {
        setFormError("UDISE No must be exactly 18 digits.");
        return;
      }
      if (!formGrNo.trim()) {
        setFormError("GR No is required.");
        return;
      }
      setSaving(true);
      try {
        await updateStudentGovId(modalRow.studentId, { grNo: formGrNo.trim(), udise: digits });
        await loadAll();
        setModalRow(null);
      } catch (e) {
        setFormError(e.message || "Failed to save.");
      } finally {
        setSaving(false);
      }
    } else {
      if (!formGrNo.trim()) {
        setFormError("GR No is required.");
        return;
      }
      if (!formPenNotDefined && !formPen.trim()) {
        setFormError("Enter the PEN No, or mark it as not generated yet.");
        return;
      }
      setSaving(true);
      try {
        await updateStudentGovId(modalRow.studentId, { grNo: formGrNo.trim(), pen: formPenNotDefined ? "Not Defined" : formPen.trim() });
        await loadAll();
        setModalRow(null);
      } catch (e) {
        setFormError(e.message || "Failed to save.");
      } finally {
        setSaving(false);
      }
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">
      Loading government entry data…
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Government Entry</h2>
          <p className="text-sm text-gray-500 mt-0.5">File UDISE / PEN entries into the government portals and record the result</p>
        </div>
        <button onClick={loadAll} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors disabled:opacity-60">
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-school-navy" : ""}`}/>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
        <button onClick={() => setTab("udise")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === "udise" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          <Landmark className="w-3.5 h-3.5"/> UDISE Entry (State)
        </button>
        <button onClick={() => setTab("pen")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === "pen" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          <IdCard className="w-3.5 h-3.5"/> PEN Entry (National)
        </button>
      </div>

      {/* Eligibility sub-tabs - eligible (in any batch) vs not eligible (in no batch) */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
        <button onClick={() => setEligTab("eligible")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${eligTab === "eligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          Eligible for Entry
        </button>
        <button onClick={() => setEligTab("ineligible")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${eligTab === "ineligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
          Not Eligible for Entry
        </button>
      </div>

      {eligTab === "ineligible" && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500">
          These students aren&apos;t mentioned in any Entry Batch yet, so they&apos;re kept separate from the eligible list above.
        </div>
      )}

      {/* PEN "Not Defined" reminder */}
      {tab === "pen" && pendingNotDefinedCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
            <span><span className="font-semibold">{pendingNotDefinedCount} student{pendingNotDefinedCount === 1 ? "" : "s"}</span> {pendingNotDefinedCount === 1 ? "has" : "have"} a placeholder PEN ("Not Defined") - the real number hasn't been saved yet. Visit the PEN portal and update them via Entry Done once it's generated.</span>
          </div>
          <button onClick={() => setShowNotDefinedOnly(v => !v)}
            className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${showNotDefinedOnly ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-100"}`}>
            {showNotDefinedOnly ? "Showing: Not Defined only" : "Show only these"}
          </button>
        </div>
      )}

      {/* Copy-to-portal hint */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
        <span className="font-semibold">Tip:</span>
        click any cell below, then press Tab to move field-by-field - each cell is copied to your clipboard automatically, ready to paste into the government portal. This table is read-only; use "Entry Done" once the portal gives you a number.
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-28"
              value={filters.cls} onChange={e => setFilters(prev => ({ ...prev, cls: e.target.value }))}>
              {["All", ...CLASSES].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Academic Year</label>
            <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-28"
              value={filters.session} onChange={e => setFilters(prev => ({ ...prev, session: e.target.value }))}>
              {["All", ...dbSessions].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entry Batch</label>
            <select disabled={eligTab === "ineligible"}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-28 disabled:opacity-50 disabled:cursor-not-allowed"
              value={filters.batch} onChange={e => setFilters(prev => ({ ...prev, batch: e.target.value }))}>
              {["All", ...batchOptions].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-school-navy text-white">
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap w-8">#</th>
              <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Status</th>
              {columns.map(c => (
                <th key={c.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{c.label}</th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const status = tab === "udise" ? row.udiseStatus : row.penStatus;
              return (
                <tr key={row.enrollNo || idx} className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="px-3 py-2 text-gray-400 font-medium">{idx + 1}</td>
                  <td className="px-3 py-2"><StatusPill status={status}/></td>
                  {columns.map(c => {
                    const rawValue = formatCellValue(c, row[c.key]);
                    return (
                      <td key={c.key}
                        tabIndex={0}
                        onFocus={() => copyCellToClipboard(rawValue)}
                        className="px-3 py-2 text-gray-700 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-navy focus:bg-blue-50">
                        {rawValue !== "" ? String(rawValue) : <span className="text-gray-300">-</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button onClick={() => openEntryModal(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors">
                      <CheckCircle2 className="w-3 h-3"/> Entry Done
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 3} className="px-4 py-10 text-center text-gray-400 text-sm">No students match the selected filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Entry Done modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {tab === "udise" ? "Complete UDISE Entry" : "Complete PEN Entry"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{modalRow.name} - {modalRow.cls} - Enroll No {modalRow.enrollNo}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GR No</label>
                <input type="text" value={formGrNo} onChange={e => setFormGrNo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                  placeholder="GR No"/>
              </div>

              {tab === "udise" ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UDISE No (18 digits)</label>
                  <input type="text" value={formUdise} onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                    maxLength={18}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                    placeholder="e.g. 242215044262310036"/>
                  <span className="text-[10px] text-gray-400">{formUdise.length}/18 digits</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PEN No</label>
                    <input type="text" value={formPen} disabled={formPenNotDefined}
                      onChange={e => setFormPen(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy disabled:bg-gray-100 disabled:text-gray-400"
                      placeholder="e.g. 20400713830"/>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={formPenNotDefined}
                      onChange={e => { setFormPenNotDefined(e.target.checked); if (e.target.checked) setFormPen(""); }}
                      className="w-3.5 h-3.5 accent-school-navy"/>
                    PEN not generated yet by the portal - mark as "Not Defined" for now
                  </label>
                </>
              )}

              {formError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/> {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={closeModal} disabled={saving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
