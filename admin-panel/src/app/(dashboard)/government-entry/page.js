"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, IdCard, RefreshCw, CheckCircle2, AlertTriangle, X,
  Loader2, HelpCircle, Search, Maximize2, Minimize2, Download, BookOpen
} from "lucide-react";
import * as XLSX from "xlsx";
import { getStudentsForReport, getAcademicYearLabels } from "@/lib/reportService";
import { getPhases, getAllPhaseEntryEnrollments } from "@/lib/studentPhaseService";
import { updateStudentGovId } from "@/lib/studentService";
import { getOnlineGrData, updateOnlineGrRow } from "@/lib/onlineGrService";

// Government Entry — Complete center for government portal filing and state registers:
// 1. Online General Register (State Online GR / Primary & General — kept in separate records)
// 2. UDISE Entry (State Child Tracking System)
// 3. PEN Entry (National Portal)
// 4. Mismatch (UDISE vs PEN eligibility discrepancies)
//
// Every cell has automatic click-to-copy / Tab-to-copy to clipboard for fast,
// friction-free entry into the government portals.

const CLASSES = ["JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th - Commerce","12th - Commerce"];
const PRIMARY_CLASSES_OPTIONS = ["Balvatika", "JR.KG", "SR.KG"];
const GENERAL_CLASSES_OPTIONS = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th - Commerce","12th - Commerce"];
const ONLINE_GR_YEARS = ["All", "2026-27", "2025-26", "2024-25"];
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

  // TC Status: ISSUED / PENDING / -
  let tcStatus = "-";
  if (st.transferCertificates?.length > 0) {
    tcStatus = "ISSUED";
  } else if (st.status === "Left" || st.deactivateDate) {
    tcStatus = "PENDING";
  }

  // Documents Pending (Mandatory docs for GSEB/School)
  const uploaded = new Set((st.studentDocuments || []).filter(d => d.status === "Uploaded").map(d => d.document_types?.name));
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
    ...dobParts(st.dob),
    dobDMY:               fmtDateDMY(st.dob),
    dobSlash:             fmtDate(st.dob) || "-",
    doaSlash:             fmtDate(st.joinDate) || "-",
    doeSlash:             fmtDate(st.leavingDate || st.deactivateDate) || "-",
    fatherNameOnly,
    motherNameOnly,
    fatherName:           nameWithSurname(st.fatherName, st.surname),
    motherName:           nameWithSurname(st.motherName, st.surname),
    studentFatherSurname: `${st.firstName || ""} ${st.fatherName || ""} ${st.surname || ""}`.trim(),
    fullAddress:          [st.plotNo, st.society, st.landmark, st.area, "Surat", "Gujarat", st.pinCode].filter(Boolean).join(", "),
    udiseStatus:          st.udise && String(st.udise).trim() ? "Done" : "Pending",
    penStatus:            st.pen && String(st.pen).trim() && String(st.pen).trim() !== "Not Defined" ? "Done" : (st.pen && String(st.pen).trim() === "Not Defined" ? "Not Defined" : "Pending"),
    grStatus,
    tcStatus,
    documentsPending,
    remarks:              st.remarks || "-",
  };
}

// 16 columns matching official D:\Project\SSIS SCHOOL\ONLINE GENERAL REGISTER.xlsx exactly:
// Sheet 1: PRIMARY (JR,SR,BALVATIKA) with PR column
const ONLINE_GR_PRIMARY_COLUMNS = [
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

// Sheet 2: GENERAL(1ST+) with GR column
const ONLINE_GR_GENERAL_COLUMNS = [
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

async function copyCellToClipboard(value) {
  const text = value === undefined || value === null ? "" : String(value);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API fallback
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
  const router = useRouter();
  const [mainTab, setMainTab] = useState("onlineGr"); // "onlineGr" | "udise" | "pen" | "mismatch"
  const [grSubTab, setGrSubTab] = useState("primary"); // "primary" | "general"
  const [mismatchDir, setMismatchDir] = useState("udiseOnly"); // "udiseOnly" | "penOnly"
  const effectiveTab = mainTab === "onlineGr" ? "onlineGr" : (mainTab === "mismatch" ? (mismatchDir === "udiseOnly" ? "udise" : "pen") : mainTab);

  // Online GR separate dataset (seeded from ONLINE GENERAL REGISTER.xlsx, saved separately)
  const [onlineGrDataset, setOnlineGrDataset] = useState({ primary: [], general: [] });

  // Database students for UDISE / PEN / Mismatch
  const [dbStudents, setDbStudents] = useState([]);
  const [dbSessions, setDbSessions] = useState(SESSIONS_FALLBACK);
  const [dbPhases, setDbPhases] = useState([]);
  const [dbPhaseEntryEnrollments, setDbPhaseEntryEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ cls: "All", session: "All", batch: "All", status: "All" });
  const [search, setSearch] = useState("");
  const [showNotDefinedOnly, setShowNotDefinedOnly] = useState(false);
  const [eligTab, setEligTab] = useState("eligible"); // "eligible" | "ineligible"
  const [showRules, setShowRules] = useState(false);
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
      const results = await Promise.allSettled([
        getStudentsForReport(),
        getAcademicYearLabels(),
        getPhases(),
        getAllPhaseEntryEnrollments(),
        getOnlineGrData(),
      ]);
      const [students, sessions, phases, entries, grData] = results;
      if (students.status === "fulfilled") setDbStudents(students.value || []);
      if (sessions.status === "fulfilled" && sessions.value?.length) setDbSessions(sessions.value);
      if (phases.status === "fulfilled") setDbPhases(phases.value || []);
      if (entries.status === "fulfilled") setDbPhaseEntryEnrollments(entries.value || []);
      if (grData.status === "fulfilled" && grData.value) {
        setOnlineGrDataset(grData.value);
      }
    } catch (e) {
      console.error("Government Entry loadAll error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reset filters on tab switch
  useEffect(() => {
    setFilters(prev => ({ ...prev, status: "All", cls: "All" }));
  }, [mainTab, grSubTab, effectiveTab]);

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

  const classOptions = useMemo(() => {
    if (mainTab === "onlineGr") {
      return grSubTab === "primary" ? PRIMARY_CLASSES_OPTIONS : GENERAL_CLASSES_OPTIONS;
    }
    return CLASSES;
  }, [mainTab, grSubTab]);

  const columns = useMemo(() => {
    if (mainTab === "onlineGr") {
      return grSubTab === "primary" ? ONLINE_GR_PRIMARY_COLUMNS : ONLINE_GR_GENERAL_COLUMNS;
    }
    return effectiveTab === "udise" ? UDISE_ENTRY_COLUMNS : PEN_ENTRY_COLUMNS;
  }, [mainTab, grSubTab, effectiveTab]);

  const rows = useMemo(() => {
    // ── Online General Register (separate record, not touching student DB) ──
    if (mainTab === "onlineGr") {
      let list = grSubTab === "primary" ? (onlineGrDataset.primary || []) : (onlineGrDataset.general || []);

      if (filters.cls !== "All") list = list.filter(x => x.cls === filters.cls);
      if (filters.session !== "All") list = list.filter(x => x.session === filters.session);

      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter(x =>
          String(x.name || "").toLowerCase().includes(q) ||
          String(x.grNo || "").toLowerCase().includes(q) ||
          String(x.mobile1 || "").toLowerCase().includes(q) ||
          String(x.mobile2 || "").toLowerCase().includes(q) ||
          String(x.aadharNo || "").toLowerCase().includes(q) ||
          String(x.udise || "").toLowerCase().includes(q) ||
          String(x.pen || "").toLowerCase().includes(q) ||
          String(x.apaar || "").toLowerCase().includes(q)
        );
      }

      if (filters.status !== "All") list = list.filter(x => x.status === filters.status);

      return list.slice().sort((a, b) => {
        const rank = { Done: 0, Pending: 1 };
        const diff = (rank[a.status] ?? 1) - (rank[b.status] ?? 1);
        if (diff !== 0) return diff;
        return String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true });
      });
    }

    // ── Database Students (UDISE / PEN / Mismatch portal filings) ────────────
    let d = dbStudents.map(decorate);

    if (filters.cls !== "All") d = d.filter(x => x.cls === filters.cls);
    if (filters.session !== "All") d = d.filter(x => x.session === filters.session);

    const q = search.trim().toLowerCase();
    if (q) d = d.filter(x =>
      String(x.name || "").toLowerCase().includes(q) ||
      String(x.enrollNo || "").toLowerCase().includes(q) ||
      String(x.grNo || "").toLowerCase().includes(q) ||
      String(x.mobile1 || "").toLowerCase().includes(q) ||
      String(x.aadharNo || "").toLowerCase().includes(q) ||
      String(x.udise || "").toLowerCase().includes(q)
    );

    const inAnyBatch = x => !!enrollToBatches.get(x.enrollNo)?.size;
    const birthDetailsFilled = x => !!(
      String(x.birthCertRegNo || "").trim() &&
      String(x.birthState || "").trim() &&
      String(x.birthDistrict || "").trim() &&
      String(x.birthCity || "").trim()
    );
    const aadharAvailable = x => !!String(x.aadharNo || "").trim();

    const udiseEligible = x => x.udiseStatus === "Done" || (inAnyBatch(x) && birthDetailsFilled(x));
    const penEligible = x => x.penStatus === "Done" || x.penStatus === "Not Defined" ||
      (inAnyBatch(x) && birthDetailsFilled(x) && aadharAvailable(x));

    if (mainTab === "mismatch") {
      d = mismatchDir === "udiseOnly"
        ? d.filter(x => udiseEligible(x) && !penEligible(x))
        : d.filter(x => penEligible(x) && !udiseEligible(x));
    } else {
      const eligibleFn = effectiveTab === "udise" ? udiseEligible : penEligible;
      if (eligTab === "ineligible") {
        d = d.filter(x => !eligibleFn(x));
      } else {
        d = d.filter(eligibleFn);
        if (filters.batch !== "All") {
          const n = Number(String(filters.batch).match(/\d+/)?.[0]);
          d = d.filter(x => enrollToBatches.get(x.enrollNo)?.has(n));
        }
      }
    }

    if (mainTab === "pen" && showNotDefinedOnly) d = d.filter(x => x.penStatus === "Not Defined");

    const statusKey = effectiveTab === "udise" ? "udiseStatus" : "penStatus";
    if (filters.status !== "All") d = d.filter(x => x[statusKey] === filters.status);

    const rank = { Done: 0, "Not Defined": 1, Pending: 2 };
    return d.slice().sort((a, b) => {
      const diff = rank[a[statusKey]] - rank[b[statusKey]];
      if (diff !== 0) return diff;
      return String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true });
    });
  }, [mainTab, grSubTab, onlineGrDataset, dbStudents, filters, search, enrollToBatches, mismatchDir, effectiveTab, showNotDefinedOnly, eligTab]);

  const pendingNotDefinedCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Not Defined").length,
    [dbStudents]
  );

  // Frozen count:
  // For onlineGr: Action(0), #(1), Status(2), AY(3), TC(4), STD(5), PR/GR(6), NAME(7) -> 8 columns
  // For UDISE: Action, #, Status, Class -> 4 columns
  // For PEN: Action, #, Status, Class, Student Father Surname -> 5 columns
  const frozenCount = mainTab === "onlineGr" ? 8 : (effectiveTab === "udise" ? 4 : 5);
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
  }, [frozenCount, rows, columns]);

  // ── Entry Done modal ────────────────────────────────────────────────────
  const [modalRow, setModalRow] = useState(null);
  const [formGrNo, setFormGrNo] = useState("");
  const [formUdise, setFormUdise] = useState("");
  const [formPen, setFormPen] = useState("");
  const [formPenNotDefined, setFormPenNotDefined] = useState(false);
  const [formApaar, setFormApaar] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function openStudentProfile(row) {
    if (mainTab === "onlineGr") return;
    if (row.enrollNo) router.push(`/student/${row.enrollNo}/edit`);
  }

  function openEntryModal(row) {
    setModalRow(row);
    setFormGrNo(row.grNo && row.grNo !== "-" ? row.grNo : "");
    setFormUdise(row.udise && row.udise !== "-" ? row.udise : "");
    setFormPen(row.pen && row.pen !== "-" && row.pen !== "Not Defined" ? row.pen : "");
    setFormPenNotDefined(row.pen === "Not Defined");
    setFormApaar(row.apaar && row.apaar !== "-" ? row.apaar : "");
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

    // 1. Online General Register — update SEPARATE record, do NOT insert into students table!
    if (mainTab === "onlineGr") {
      const regLabel = grSubTab === "primary" ? "PR No" : "GR No";
      if (!formGrNo.trim()) {
        setFormError(`${regLabel} is required.`);
        return;
      }
      setSaving(true);
      try {
        const updated = await updateOnlineGrRow(modalRow.id, grSubTab, {
          grNo: formGrNo.trim(),
          udise: formUdise.trim() || "-",
          pen: formPenNotDefined ? "Not Defined" : (formPen.trim() || "-"),
          apaar: formApaar.trim() || "-",
          remarks: formRemarks.trim() || "-",
        });
        setOnlineGrDataset(prev => ({
          ...prev,
          [grSubTab]: (prev[grSubTab] || []).map(r => r.id === updated.id ? updated : r),
        }));
        setModalRow(null);
      } catch (e) {
        setFormError(e.message || "Failed to update record.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // 2. Database students: UDISE Entry
    if (effectiveTab === "udise") {
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
      return;
    }

    // 3. Database students: PEN Entry
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

  // ── Excel Export ────────────────────────────────────────────────────────
  function exportExcel() {
    const today = new Date().toISOString().slice(0, 10);

    if (mainTab === "onlineGr") {
      const primaryList = (onlineGrDataset.primary || []).slice()
        .sort((a, b) => String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true }));
      const generalList = (onlineGrDataset.general || []).slice()
        .sort((a, b) => String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true }));

      const wb = XLSX.utils.book_new();

      const primaryAoa = [
        ONLINE_GR_PRIMARY_COLUMNS.map(c => c.label),
        ...primaryList.map(r => ONLINE_GR_PRIMARY_COLUMNS.map(c => r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : "-"))
      ];
      const wsPrimary = XLSX.utils.aoa_to_sheet(primaryAoa);
      wsPrimary["!cols"] = ONLINE_GR_PRIMARY_COLUMNS.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsPrimary, "PRIMARY (JR,SR,BALVATIKA)");

      const generalAoa = [
        ONLINE_GR_GENERAL_COLUMNS.map(c => c.label),
        ...generalList.map(r => ONLINE_GR_GENERAL_COLUMNS.map(c => r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : "-"))
      ];
      const wsGeneral = XLSX.utils.aoa_to_sheet(generalAoa);
      wsGeneral["!cols"] = ONLINE_GR_GENERAL_COLUMNS.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsGeneral, "GENERAL(1ST+)");

      XLSX.writeFile(wb, `ONLINE_GENERAL_REGISTER_${today}.xlsx`);
    } else {
      const headerRow = columns.map(c => c.label);
      const rowsAoa = [
        headerRow,
        ...rows.map(r => columns.map(c => formatCellValue(c, r[c.key])))
      ];
      const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
      ws["!cols"] = columns.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      const sheetName = effectiveTab === "udise" ? "UDISE Entry" : "PEN Entry";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${sheetName.replace(/\s+/g, "_")}_${today}.xlsx`);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">
      Loading government entry data…
    </div>
  );

  return (
    <div className={fullscreen ? "fixed inset-0 z-[100] bg-white overflow-y-auto p-5 space-y-3" : "space-y-3"}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Government Entry</h2>
          <p className="text-sm text-gray-500 mt-0.5">File Online General Register, UDISE &amp; PEN entries into government portals and record results</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            title="Download Excel export"
            className="flex items-center gap-1.5 text-xs border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100 transition-colors">
            <Download className="w-3.5 h-3.5 text-emerald-700"/> Export Excel
          </button>
          <button onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors">
            <HelpCircle className="w-3.5 h-3.5"/> Rules
          </button>
          <button onClick={loadAll} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors disabled:opacity-60">
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-school-navy" : ""}`}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={() => setFullscreen(v => !v)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5"/> : <Maximize2 className="w-3.5 h-3.5"/>}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
          <button onClick={() => setMainTab("onlineGr")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mainTab === "onlineGr" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <BookOpen className="w-3.5 h-3.5"/> Online General Register
          </button>
          <button onClick={() => setMainTab("udise")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mainTab === "udise" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <Landmark className="w-3.5 h-3.5"/> UDISE Entry (State)
          </button>
          <button onClick={() => setMainTab("pen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mainTab === "pen" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <IdCard className="w-3.5 h-3.5"/> PEN Entry (National)
          </button>
          <button onClick={() => setMainTab("mismatch")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mainTab === "mismatch" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
            <AlertTriangle className="w-3.5 h-3.5"/> Mismatch
          </button>
        </div>

        <span className="hidden sm:block w-px h-6 bg-gray-200"/>

        {mainTab === "onlineGr" ? (
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
            <button onClick={() => setGrSubTab("primary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${grSubTab === "primary" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              Primary (JR, SR, Balvatika)
            </button>
            <button onClick={() => setGrSubTab("general")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${grSubTab === "general" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              General (1st+)
            </button>
          </div>
        ) : mainTab === "mismatch" ? (
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
            <button onClick={() => setMismatchDir("udiseOnly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mismatchDir === "udiseOnly" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              UDISE Eligible, PEN Not
            </button>
            <button onClick={() => setMismatchDir("penOnly")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mismatchDir === "penOnly" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              PEN Eligible, UDISE Not
            </button>
          </div>
        ) : (
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
            <button onClick={() => setEligTab("eligible")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${eligTab === "eligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              Eligible for Entry
            </button>
            <button onClick={() => setEligTab("ineligible")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${eligTab === "ineligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              Not Eligible for Entry
            </button>
          </div>
        )}
      </div>

      {mainTab === "onlineGr" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
          <BookOpen className="w-4 h-4 flex-shrink-0 text-school-navy"/>
          <span>
            {grSubTab === "primary"
              ? "Online General Register — Pre-Primary section (JR.KG, SR.KG, Balvatika). Assigned Primary Register (PR) numbers."
              : "Online General Register — Standard 1st and above. Assigned General Register (GR) numbers."}
            {" Saved separately for government state record keeping (not inserted into student database). Click any cell to copy to clipboard."}
          </span>
        </div>
      )}

      {mainTab === "mismatch" && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500">
          {mismatchDir === "udiseOnly"
            ? "These students qualify for UDISE Entry but not yet for PEN Entry (missing Aadhar and/or not in any batch/already filed)."
            : "These students qualify for PEN Entry but not yet for UDISE Entry (missing birth details and/or not in any batch/already filed)."}
        </div>
      )}

      {mainTab !== "mismatch" && mainTab !== "onlineGr" && eligTab === "ineligible" && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500">
          These students aren&apos;t mentioned in any Entry Batch yet, so they&apos;re kept separate from the eligible list above.
        </div>
      )}

      {/* PEN "Not Defined" reminder */}
      {mainTab === "pen" && pendingNotDefinedCount > 0 && (
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

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name, Reg No, Mobile, Aadhar, UID"
              className="border border-gray-200 rounded-lg pl-8 pr-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-48"/>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Class</label>
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-24"
              value={filters.cls} onChange={e => setFilters(prev => ({ ...prev, cls: e.target.value }))}>
              {["All", ...classOptions].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Year</label>
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-24"
              value={filters.session} onChange={e => setFilters(prev => ({ ...prev, session: e.target.value }))}>
              {(mainTab === "onlineGr" ? ONLINE_GR_YEARS : ["All", ...dbSessions]).map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Batch</label>
            <select disabled={mainTab === "onlineGr" || mainTab === "mismatch" || (mainTab !== "onlineGr" && eligTab === "ineligible")}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-24 disabled:opacity-50 disabled:cursor-not-allowed"
              value={filters.batch} onChange={e => setFilters(prev => ({ ...prev, batch: e.target.value }))}>
              {["All", ...batchOptions].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</label>
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-24"
              value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
              {(effectiveTab === "pen" ? ["All", "Done", "Not Defined", "Pending"] : ["All", "Done", "Pending"]).map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`overflow-auto rounded-xl border border-gray-200 shadow-sm ${fullscreen ? "max-h-[calc(100vh-220px)]" : "max-h-[70vh]"}`}>
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-school-navy text-white">
              <th ref={el => { frozenHeaderRefs.current[0] = el; }}
                style={{ position: "sticky", top: 0, left: stickyLeft[0], zIndex: 30 }}
                className="bg-school-navy px-3 py-2.5 text-center font-semibold whitespace-nowrap">Action</th>
              <th ref={el => { frozenHeaderRefs.current[1] = el; }}
                style={{ position: "sticky", top: 0, left: stickyLeft[1], zIndex: 30 }}
                className="bg-school-navy px-3 py-2.5 text-left font-semibold whitespace-nowrap w-8">#</th>
              <th ref={el => { frozenHeaderRefs.current[2] = el; }}
                style={{ position: "sticky", top: 0, left: stickyLeft[2], zIndex: 30 }}
                className="bg-school-navy px-3 py-2.5 text-left font-semibold whitespace-nowrap">Status</th>
              {columns.map((c, i) => {
                const frozenIdx = i + 3;
                const isFrozen = frozenIdx < frozenCount;
                return (
                  <th key={c.key}
                    ref={isFrozen ? (el => { frozenHeaderRefs.current[frozenIdx] = el; }) : undefined}
                    style={isFrozen ? { position: "sticky", top: 0, left: stickyLeft[frozenIdx], zIndex: 30 } : { position: "sticky", top: 0, zIndex: 20 }}
                    className="bg-school-navy px-3 py-2.5 text-left font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const status = mainTab === "onlineGr" ? row.status : (effectiveTab === "udise" ? row.udiseStatus : row.penStatus);
              const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";
              const rowBgSolid = idx % 2 === 0 ? "bg-white" : "bg-gray-100";
              return (
                <tr key={`${row.id || row.studentId || row.enrollNo || idx}-${row.session}-${idx}`}
                  onDoubleClick={() => openStudentProfile(row)}
                  title={mainTab === "onlineGr" ? "Online General Register entry" : "Double-click to edit this student"}
                  className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${rowBg}`}>
                  <td style={{ position: "sticky", left: stickyLeft[0], zIndex: 10 }} className={`${rowBgSolid} px-3 py-2 text-center whitespace-nowrap`}>
                    <button onClick={() => openEntryModal(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors">
                      <CheckCircle2 className="w-3 h-3"/> Entry Done
                    </button>
                  </td>
                  <td style={{ position: "sticky", left: stickyLeft[1], zIndex: 10 }} className={`${rowBgSolid} px-3 py-2 text-gray-400 font-medium`}>{idx + 1}</td>
                  <td style={{ position: "sticky", left: stickyLeft[2], zIndex: 10 }} className={`${rowBgSolid} px-3 py-2`}><StatusPill status={status}/></td>
                  {columns.map((c, i) => {
                    const rawValue = formatCellValue(c, row[c.key]);
                    const frozenIdx = i + 3;
                    const isFrozen = frozenIdx < frozenCount;
                    return (
                      <td key={c.key}
                        tabIndex={0}
                        onFocus={() => copyCellToClipboard(rawValue)}
                        style={isFrozen ? { position: "sticky", left: stickyLeft[frozenIdx], zIndex: 10 } : undefined}
                        className={`${isFrozen ? rowBgSolid : ""} px-3 py-2 text-gray-700 whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-navy focus:bg-blue-50`}>
                        {rawValue !== "" && rawValue !== "-" ? String(rawValue) : <span className="text-gray-300">-</span>}
                      </td>
                    );
                  })}
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
                  {mainTab === "onlineGr"
                    ? (grSubTab === "primary" ? "Complete Primary Register Entry (PR)" : "Complete General Register Entry (GR)")
                    : (effectiveTab === "udise" ? "Complete UDISE Entry" : "Complete PEN Entry")}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{modalRow.name || "Student"} - {modalRow.cls || ""} - Reg No {modalRow.grNo || "-"}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {mainTab === "onlineGr" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {grSubTab === "primary" ? "PR No (Primary Register No)" : "GR No (General Register No)"}
                    </label>
                    <input type="text" value={formGrNo} onChange={e => setFormGrNo(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder={grSubTab === "primary" ? "e.g. P001" : "e.g. 101"}/>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UID (UDISE No)</label>
                    <input type="text" value={formUdise} onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={18}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="18-digit state UID"/>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PEN No</label>
                    <input type="text" value={formPen} disabled={formPenNotDefined}
                      onChange={e => setFormPen(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy disabled:bg-gray-100 disabled:text-gray-400"
                      placeholder="Permanent Education Number"/>
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-1">
                      <input type="checkbox" checked={formPenNotDefined}
                        onChange={e => { setFormPenNotDefined(e.target.checked); if (e.target.checked) setFormPen(""); }}
                        className="w-3.5 h-3.5 accent-school-navy"/>
                      PEN not generated yet by portal (mark "Not Defined")
                    </label>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">APAAR ID</label>
                    <input type="text" value={formApaar} onChange={e => setFormApaar(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="APAAR ID"/>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remark</label>
                    <input type="text" value={formRemarks} onChange={e => setFormRemarks(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="Optional remarks"/>
                  </div>
                </>
              ) : effectiveTab === "udise" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GR No</label>
                    <input type="text" value={formGrNo} onChange={e => setFormGrNo(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="GR No"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UDISE No (18 digits)</label>
                    <input type="text" value={formUdise} onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={18}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="e.g. 242215044262310036"/>
                    <span className="text-[10px] text-gray-400">{formUdise.length}/18 digits</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GR No</label>
                    <input type="text" value={formGrNo} onChange={e => setFormGrNo(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="GR No"/>
                  </div>
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
                    PEN not generated yet by the portal - mark as &quot;Not Defined&quot; for now
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

      {/* Rules modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-base font-bold text-gray-800">Government Entry Rules</h3>
              <button onClick={() => setShowRules(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 text-xs text-gray-600">
              <div>
                <p className="font-bold text-gray-800 mb-1">Online General Register</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><b>Primary Section:</b> Pre-Primary (Balvatika, JR.KG, SR.KG) records with Primary Register (PR) numbers.</li>
                  <li><b>General Section:</b> Class 1st to 12th records with General Register (GR) numbers.</li>
                  <li><b>Dedicated Record:</b> Kept separately for official state register tracking without inserting or modifying live student database records.</li>
                  <li><b>Export:</b> Generates a clean 2-sheet Excel workbook with both primary and general sheets matching the state template.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-gray-800 mb-1">UDISE Entry - Eligible if:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>UDISE is already marked <b>Done</b>, <u>or</u></li>
                  <li>The student is in <b>any Entry Batch</b> <u>AND</u> all of Birth Cert Reg No, Birth State, Birth District and Birth City are filled in</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-gray-800 mb-1">PEN Entry - Eligible if:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>PEN is already marked <b>Done</b> or <b>Not Defined</b>, <u>or</u></li>
                  <li>The student is in <b>any Entry Batch</b> <u>AND</u> all of Birth Cert Reg No, Birth State, Birth District and Birth City are filled in <u>AND</u> Aadhar Number is filled in</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-gray-800 mb-1">Mismatch Tab</p>
                <p>
                  <b>UDISE Eligible, PEN Not:</b> Meets the UDISE rule but not the PEN rule.<br/>
                  <b>PEN Eligible, UDISE Not:</b> Meets the PEN rule but not the UDISE rule.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800">
                <span className="font-semibold">Frictionless Workflow:</span> Click any cell in the table, then press
                Tab to move field-by-field — each cell value is copied to your clipboard automatically,
                ready to paste directly into the government portal.
              </div>
            </div>

            <div className="flex items-center justify-end px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowRules(false)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
