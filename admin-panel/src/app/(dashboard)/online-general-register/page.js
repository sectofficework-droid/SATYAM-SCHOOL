"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked, RefreshCw, CheckCircle2, AlertTriangle, X,
  Loader2, Search, Maximize2, Minimize2, Download
} from "lucide-react";
import * as XLSX from "xlsx";
import { getStudentsForReport, getAcademicYearLabels } from "@/lib/reportService";
import { updateStudentGovId } from "@/lib/studentService";

// Online General Register — Standalone module matching official state register:
// Matches D:\Project\SSIS SCHOOL\ONLINE GENERAL REGISTER.xlsx exactly:
// Tab 1: PRIMARY (JR,SR,BALVATIKA) with PR column
// Tab 2: GENERAL(1ST+) with GR column

const PRIMARY_CLASSES = new Set(["JR.KG", "SR.KG", "Balvatika", "JR KG", "SR KG"]);
const PRIMARY_CLASS_OPTIONS = ["JR.KG", "SR.KG", "Balvatika"];
const GENERAL_CLASS_OPTIONS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th - Commerce", "12th - Commerce"];
const SESSIONS_FALLBACK = ["2026-27", "2025-26", "2024-25", "2023-24"];

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function nameWithSurname(name, surname) {
  return [name, surname].filter(Boolean).join(" ").trim();
}

function decorate(st) {
  let tcStatus = "-";
  if (st.transferCertificates?.length > 0) {
    tcStatus = "ISSUED";
  } else if (st.status === "Left" || st.deactivateDate) {
    tcStatus = "PENDING";
  }

  const uploaded = new Set(
    (st.studentDocuments || [])
      .filter((d) => d.status === "Uploaded")
      .map((d) => d.document_types?.name)
  );
  const missing = [];
  if (!uploaded.has("Birth Certificate")) missing.push("Birth Cert");
  if (!uploaded.has("Student Aadhar Card")) missing.push("Student Aadhar");
  if (!uploaded.has("Father's Aadhar Card")) missing.push("Father Aadhar");
  if (!uploaded.has("Mother's Aadhar Card")) missing.push("Mother Aadhar");
  if (st.lastSchoolName && !uploaded.has("Leaving Certificate")) missing.push("Previous TC");
  const documentsPending = missing.length > 0 ? missing.join(", ") : "-";

  const grStatus = st.grNo && String(st.grNo).trim() ? "Done" : "Pending";

  return {
    ...st,
    dobSlash:             fmtDate(st.dob) || "-",
    doaSlash:             fmtDate(st.joinDate) || "-",
    doeSlash:             fmtDate(st.leavingDate || st.deactivateDate) || "-",
    fatherName:           nameWithSurname(st.fatherName, st.surname),
    motherName:           nameWithSurname(st.motherName, st.surname),
    grStatus,
    tcStatus,
    documentsPending,
    remarks:              st.remarks || "-",
  };
}

// 16 columns matching official Excel sheet 1:
const PRIMARY_COLUMNS = [
  { key: "session",          label: "AY" },
  { key: "tcStatus",         label: "TC" },
  { key: "cls",              label: "STD" },
  { key: "grNo",             label: "PR" },
  { key: "name",             label: "NAME" },
  { key: "mobile1",          label: "MOBILE 1" },
  { key: "mobile2",          label: "MOBILE 2" },
  { key: "dobSlash",         label: "DOB" },
  { key: "doaSlash",         label: "DOA" },
  { key: "doeSlash",         label: "DOE" },
  { key: "aadharNo",         label: "AADHAR" },
  { key: "udise",            label: "UID" },
  { key: "pen",              label: "PEN" },
  { key: "apaar",            label: "APAAR" },
  { key: "remarks",          label: "REMARK" },
  { key: "documentsPending", label: "DOCUMENTS PENDING" },
];

// 16 columns matching official Excel sheet 2:
const GENERAL_COLUMNS = [
  { key: "session",          label: "AY" },
  { key: "tcStatus",         label: "TC" },
  { key: "cls",              label: "STD" },
  { key: "grNo",             label: "GR" },
  { key: "name",             label: "NAME" },
  { key: "mobile1",          label: "MOBILE 1" },
  { key: "mobile2",          label: "MOBILE 2" },
  { key: "dobSlash",         label: "DOB" },
  { key: "doaSlash",         label: "DOA" },
  { key: "doeSlash",         label: "DOE" },
  { key: "aadharNo",         label: "AADHAR" },
  { key: "udise",            label: "UID" },
  { key: "pen",              label: "PEN" },
  { key: "apaar",            label: "APAAR" },
  { key: "remarks",          label: "REMARK" },
  { key: "documentsPending", label: "DOCUMENTS PENDING" },
];

async function copyCellToClipboard(value) {
  const text = value === undefined || value === null ? "" : String(value);
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
}

function StatusPill({ status }) {
  const cls = status === "Done" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}>{status}</span>;
}

export default function OnlineGeneralRegisterPage() {
  const router = useRouter();
  const [subTab, setSubTab] = useState("primary"); // "primary" | "general"
  const [dbStudents, setDbStudents] = useState([]);
  const [dbSessions, setDbSessions] = useState(SESSIONS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ cls: "All", session: "All", status: "All" });
  const [search, setSearch] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e) { if (e.key === "Escape") setFullscreen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [students, sessions] = await Promise.all([
        getStudentsForReport(),
        getAcademicYearLabels(),
      ]);
      setDbStudents(students || []);
      if (sessions?.length) setDbSessions(sessions);
    } catch (e) {
      console.error("Online General Register loadAll error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reset class/status filter when switching sub-tab
  useEffect(() => {
    setFilters((prev) => ({ ...prev, cls: "All", status: "All" }));
  }, [subTab]);

  const classOptions = useMemo(() => {
    return subTab === "primary" ? PRIMARY_CLASS_OPTIONS : GENERAL_CLASS_OPTIONS;
  }, [subTab]);

  const columns = useMemo(() => {
    return subTab === "primary" ? PRIMARY_COLUMNS : GENERAL_COLUMNS;
  }, [subTab]);

  const rows = useMemo(() => {
    let d = dbStudents.map(decorate);

    d = subTab === "primary"
      ? d.filter((x) => PRIMARY_CLASSES.has(x.cls))
      : d.filter((x) => !PRIMARY_CLASSES.has(x.cls));

    if (filters.cls !== "All") d = d.filter((x) => x.cls === filters.cls);
    if (filters.session !== "All") d = d.filter((x) => x.session === filters.session);

    const q = search.trim().toLowerCase();
    if (q) {
      d = d.filter((x) =>
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.enrollNo || "").toLowerCase().includes(q) ||
        String(x.grNo || "").toLowerCase().includes(q) ||
        String(x.mobile1 || "").toLowerCase().includes(q) ||
        String(x.mobile2 || "").toLowerCase().includes(q) ||
        String(x.aadharNo || "").toLowerCase().includes(q) ||
        String(x.udise || "").toLowerCase().includes(q) ||
        String(x.pen || "").toLowerCase().includes(q) ||
        String(x.apaar || "").toLowerCase().includes(q)
      );
    }

    if (filters.status !== "All") d = d.filter((x) => x.grStatus === filters.status);

    return d.slice().sort((a, b) => {
      const rank = { Done: 0, Pending: 1 };
      const diff = (rank[a.grStatus] ?? 1) - (rank[b.grStatus] ?? 1);
      if (diff !== 0) return diff;
      return String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true });
    });
  }, [dbStudents, filters, search, subTab]);

  // 8 sticky frozen columns: Action(0), #(1), Status(2), AY(3), TC(4), STD(5), PR/GR(6), NAME(7)
  const frozenCount = 8;
  const frozenHeaderRefs = useRef([]);
  const [stickyLeft, setStickyLeft] = useState([0, 0, 0, 0, 0, 0, 0, 0]);

  useLayoutEffect(() => {
    function measure() {
      const offsets = [];
      let acc = 0;
      for (let i = 0; i < frozenCount; i++) {
        offsets.push(acc);
        acc += frozenHeaderRefs.current[i]?.offsetWidth || 0;
      }
      setStickyLeft(offsets);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rows, columns]);

  // ── Entry Done Modal ──────────────────────────────────────────────────
  const [modalRow, setModalRow] = useState(null);
  const [formGrNo, setFormGrNo] = useState("");
  const [formUdise, setFormUdise] = useState("");
  const [formPen, setFormPen] = useState("");
  const [formPenNotDefined, setFormPenNotDefined] = useState(false);
  const [formApaar, setFormApaar] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function openEntryModal(row) {
    setModalRow(row);
    setFormGrNo(row.grNo || "");
    setFormUdise(row.udise || "");
    setFormPen(row.pen && row.pen !== "Not Defined" ? row.pen : "");
    setFormPenNotDefined(row.pen === "Not Defined");
    setFormApaar(row.apaar || "");
    setFormRemarks(row.remarks && row.remarks !== "-" ? row.remarks : "");
    setFormError("");
  }

  function closeModal() {
    if (saving) return;
    setModalRow(null);
  }

  async function handleSave() {
    if (!modalRow) return;
    setFormError("");

    const isPrimary = PRIMARY_CLASSES.has(modalRow.cls);
    const regLabel = isPrimary ? "PR No" : "GR No";
    if (!formGrNo.trim()) {
      setFormError(`${regLabel} is required.`);
      return;
    }

    setSaving(true);
    try {
      await updateStudentGovId(modalRow.studentId, {
        grNo: formGrNo.trim(),
        udise: formUdise.trim() || undefined,
        pen: formPenNotDefined ? "Not Defined" : (formPen.trim() || undefined),
        apaar: formApaar.trim() || undefined,
        remarks: formRemarks.trim() || undefined,
        enrollmentId: modalRow.enrollmentId,
      });
      await loadAll();
      setModalRow(null);
    } catch (e) {
      setFormError(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // ── 2-Sheet Excel Export ──────────────────────────────────────────────
  function exportExcel() {
    const today = new Date().toISOString().slice(0, 10);
    const allDecorated = dbStudents.map(decorate);

    const primaryList = allDecorated
      .filter((x) => PRIMARY_CLASSES.has(x.cls))
      .sort((a, b) => String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true }));

    const generalList = allDecorated
      .filter((x) => !PRIMARY_CLASSES.has(x.cls))
      .sort((a, b) => String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true }));

    const wb = XLSX.utils.book_new();

    const primaryAoa = [
      PRIMARY_COLUMNS.map((c) => c.label),
      ...primaryList.map((r) =>
        PRIMARY_COLUMNS.map((c) => (r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : "-"))
      ),
    ];
    const wsPrimary = XLSX.utils.aoa_to_sheet(primaryAoa);
    wsPrimary["!cols"] = PRIMARY_COLUMNS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsPrimary, "PRIMARY (JR,SR,BALVATIKA)");

    const generalAoa = [
      GENERAL_COLUMNS.map((c) => c.label),
      ...generalList.map((r) =>
        GENERAL_COLUMNS.map((c) => (r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : "-"))
      ),
    ];
    const wsGeneral = XLSX.utils.aoa_to_sheet(generalAoa);
    wsGeneral["!cols"] = GENERAL_COLUMNS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsGeneral, "GENERAL(1ST+)");

    XLSX.writeFile(wb, `ONLINE_GENERAL_REGISTER_${today}.xlsx`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        Loading Online General Register data…
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[100] bg-white overflow-y-auto p-5 space-y-3" : "space-y-3"}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-school-navy" />
            Online General Register
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Official State Online General Register · Primary &amp; General classes matching the state template
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            title="Download complete 2-sheet Excel workbook"
            className="flex items-center gap-1.5 text-xs border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100 transition-colors font-medium shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" /> Export Excel (.xlsx)
          </button>
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-school-navy" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Sub-Tabs: PRIMARY vs GENERAL */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setSubTab("primary")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === "primary"
              ? "bg-school-navy text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          PRIMARY (JR, SR, BALVATIKA)
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === "primary" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"}`}>
            {dbStudents.filter((x) => PRIMARY_CLASSES.has(x.cls)).length}
          </span>
        </button>
        <button
          onClick={() => setSubTab("general")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === "general"
              ? "bg-school-navy text-white shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          GENERAL (1ST+)
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${subTab === "general" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-700"}`}>
            {dbStudents.filter((x) => !PRIMARY_CLASSES.has(x.cls)).length}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-2.5 flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, PR/GR, mobile, aadhar, UID, PEN..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-school-navy"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Session:</span>
          <select
            value={filters.session}
            onChange={(e) => setFilters((p) => ({ ...p, session: e.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-school-navy"
          >
            <option value="All">All Sessions</option>
            {dbSessions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Class:</span>
          <select
            value={filters.cls}
            onChange={(e) => setFilters((p) => ({ ...p, cls: e.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-school-navy"
          >
            <option value="All">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 font-medium">Status:</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-school-navy"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
        </div>

        <div className="ml-auto text-gray-400 text-xs font-medium">
          Showing <span className="text-gray-700 font-bold">{rows.length}</span> student{rows.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Grid with 8 Sticky Frozen Columns */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0 z-30 border-b border-gray-200 select-none">
              <tr>
                <th
                  ref={(el) => (frozenHeaderRefs.current[0] = el)}
                  style={{ left: stickyLeft[0], minWidth: "110px", width: "110px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 text-center shadow-[1px_0_0_0_#e5e7eb]"
                >
                  Action
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[1] = el)}
                  style={{ left: stickyLeft[1], minWidth: "40px", width: "40px" }}
                  className="sticky z-40 bg-gray-100 px-1.5 py-2 text-center shadow-[1px_0_0_0_#e5e7eb]"
                >
                  #
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[2] = el)}
                  style={{ left: stickyLeft[2], minWidth: "65px", width: "65px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 text-center shadow-[1px_0_0_0_#e5e7eb]"
                >
                  Status
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[3] = el)}
                  style={{ left: stickyLeft[3], minWidth: "75px", width: "75px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 text-center shadow-[1px_0_0_0_#e5e7eb]"
                >
                  AY
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[4] = el)}
                  style={{ left: stickyLeft[4], minWidth: "70px", width: "70px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 text-center shadow-[1px_0_0_0_#e5e7eb]"
                >
                  TC
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[5] = el)}
                  style={{ left: stickyLeft[5], minWidth: "85px", width: "85px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 shadow-[1px_0_0_0_#e5e7eb]"
                >
                  STD
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[6] = el)}
                  style={{ left: stickyLeft[6], minWidth: "75px", width: "75px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 shadow-[1px_0_0_0_#e5e7eb]"
                >
                  {subTab === "primary" ? "PR" : "GR"}
                </th>
                <th
                  ref={(el) => (frozenHeaderRefs.current[7] = el)}
                  style={{ left: stickyLeft[7], minWidth: "180px", width: "180px" }}
                  className="sticky z-40 bg-gray-100 px-2 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]"
                >
                  NAME
                </th>
                {columns.slice(5).map((col) => (
                  <th key={col.key} className="px-2 py-2 whitespace-nowrap text-gray-700">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 3} className="text-center py-12 text-gray-400">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.enrollNo || idx}
                    onDoubleClick={() => router.push(`/student/${row.enrollNo}/edit`)}
                    className="hover:bg-blue-50/40 group transition-colors cursor-pointer"
                    title="Double-click to open edit profile"
                  >
                    {/* Sticky Column 0: Action */}
                    <td
                      style={{ left: stickyLeft[0] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 text-center shadow-[1px_0_0_0_#e5e7eb]"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEntryModal(row);
                        }}
                        className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                          row.grStatus === "Done"
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            : "bg-school-navy text-white hover:bg-school-navy/90"
                        }`}
                      >
                        {row.grStatus === "Done" ? "Edit Entry" : "Entry Done"}
                      </button>
                    </td>

                    {/* Sticky Column 1: Index */}
                    <td
                      style={{ left: stickyLeft[1] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-1.5 py-1.5 text-center text-gray-400 shadow-[1px_0_0_0_#e5e7eb]"
                    >
                      {idx + 1}
                    </td>

                    {/* Sticky Column 2: Status */}
                    <td
                      style={{ left: stickyLeft[2] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 text-center shadow-[1px_0_0_0_#e5e7eb]"
                    >
                      <StatusPill status={row.grStatus} />
                    </td>

                    {/* Sticky Column 3: AY */}
                    <td
                      style={{ left: stickyLeft[3] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 text-center font-medium text-gray-700 shadow-[1px_0_0_0_#e5e7eb]"
                      tabIndex={0}
                      onFocus={() => copyCellToClipboard(row.session)}
                    >
                      {row.session || "-"}
                    </td>

                    {/* Sticky Column 4: TC */}
                    <td
                      style={{ left: stickyLeft[4] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 text-center shadow-[1px_0_0_0_#e5e7eb]"
                      tabIndex={0}
                      onFocus={() => copyCellToClipboard(row.tcStatus)}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        row.tcStatus === "ISSUED" ? "bg-amber-100 text-amber-800" :
                        row.tcStatus === "PENDING" ? "bg-red-100 text-red-700" : "text-gray-400"
                      }`}>
                        {row.tcStatus}
                      </span>
                    </td>

                    {/* Sticky Column 5: STD */}
                    <td
                      style={{ left: stickyLeft[5] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 font-medium text-gray-700 shadow-[1px_0_0_0_#e5e7eb]"
                      tabIndex={0}
                      onFocus={() => copyCellToClipboard(row.cls)}
                    >
                      {row.cls}
                    </td>

                    {/* Sticky Column 6: PR / GR */}
                    <td
                      style={{ left: stickyLeft[6] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 font-bold text-school-navy shadow-[1px_0_0_0_#e5e7eb]"
                      tabIndex={0}
                      onFocus={() => copyCellToClipboard(row.grNo)}
                    >
                      {row.grNo || "-"}
                    </td>

                    {/* Sticky Column 7: NAME */}
                    <td
                      style={{ left: stickyLeft[7] }}
                      className="sticky z-20 bg-white group-hover:bg-blue-50/80 px-2 py-1.5 font-semibold text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] truncate max-w-[200px]"
                      tabIndex={0}
                      onFocus={() => copyCellToClipboard(row.name)}
                      title={row.name}
                    >
                      {row.name}
                    </td>

                    {/* Remaining Scrollable Columns */}
                    {columns.slice(5).map((col) => {
                      const val = row[col.key];
                      const displayVal = val !== undefined && val !== null && String(val).trim() ? String(val) : "-";
                      return (
                        <td
                          key={col.key}
                          tabIndex={0}
                          onFocus={() => copyCellToClipboard(val)}
                          className="px-2 py-1.5 text-gray-700 whitespace-nowrap focus:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-school-navy"
                        >
                          {col.key === "documentsPending" && displayVal !== "-" ? (
                            <span className="text-amber-700 font-medium">{displayVal}</span>
                          ) : (
                            displayVal
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Done / Edit Entry Modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">
                  {modalRow.grStatus === "Done" ? "Edit Register Entry" : "Record Register Entry"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  #{modalRow.enrollNo} · {modalRow.name} · {modalRow.cls}
                </p>
              </div>
              <button onClick={closeModal} disabled={saving} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  {PRIMARY_CLASSES.has(modalRow.cls) ? "PR No (Primary Register Number)" : "GR No (General Register Number)"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formGrNo}
                  onChange={(e) => setFormGrNo(e.target.value)}
                  placeholder={PRIMARY_CLASSES.has(modalRow.cls) ? "e.g. P040" : "e.g. 124"}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-school-navy font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">UID / UDISE No (18 digits)</label>
                <input
                  type="text"
                  value={formUdise}
                  onChange={(e) => setFormUdise(e.target.value.replace(/\D/g, "").slice(0, 18))}
                  placeholder="18-digit UDISE child code"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-school-navy"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">PEN No (11 digits)</label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    disabled={formPenNotDefined}
                    value={formPenNotDefined ? "Not Defined" : formPen}
                    onChange={(e) => setFormPen(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="11-digit national PEN code"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-school-navy disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPenNotDefined}
                      onChange={(e) => {
                        setFormPenNotDefined(e.target.checked);
                        if (e.target.checked) setFormPen("");
                      }}
                      className="rounded border-gray-300 text-school-navy focus:ring-school-navy"
                    />
                    <span>Mark as &quot;Not Defined&quot; (portal has not generated PEN yet)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">APAAR ID (12 digits)</label>
                <input
                  type="text"
                  value={formApaar}
                  onChange={(e) => setFormApaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="12-digit APAAR ID"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-school-navy"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Remarks e.g. ND, documents pending notes..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-school-navy"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50/60">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-school-navy text-white text-xs font-semibold hover:bg-school-navy/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {saving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
