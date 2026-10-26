"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, IdCard, RefreshCw, CheckCircle2, AlertTriangle, X,
  Loader2, HelpCircle, Search, Maximize2, Minimize2, Download, BookOpen,
  ChevronUp, ChevronDown, Trash2, UserPlus, Upload, FileText, Calendar, Pencil
} from "lucide-react";
import * as XLSX from "xlsx";
import supabase from "@/lib/supabase";
import { getStudentsForReport, getAcademicYearLabels } from "@/lib/reportService";
import { getPhases, getAllPhaseEntryEnrollments } from "@/lib/studentPhaseService";
import { updateStudentGovId } from "@/lib/studentService";
import { getOnlineGrData, updateOnlineGrRow, deleteOnlineGrRow } from "@/lib/onlineGrService";
import { uploadFileToS3, getS3ViewUrl, buildDocDownloadName, fileExt } from "@/lib/s3Upload";
import { compressFile } from "@/lib/fileCompression";

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

function getTodaySlash() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

function slashToIso(slash) {
  if (!slash || slash === "-") return "";
  const parts = String(slash).replace(/-/g, "/").split("/");
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function isoToSlash(iso) {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return iso;
}

function normSlashDate(str) {
  if (!str) return "";
  const cleaned = String(str).trim().replace(/-/g, "/");
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    const [d, m, y] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return cleaned;
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
    doeSlash:             (st.doeSlash && st.doeSlash !== "-") ? st.doeSlash : (st.dateOfEntry ? fmtDate(st.dateOfEntry) : getTodaySlash()),
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
  const [onlineGrSort, setOnlineGrSort] = useState({ key: null, dir: "asc" }); // Excel-like click-to-sort, Online GR only
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
  // REQ-BUG-078 (3): loadAll's individual Promise.allSettled rejections
  // were silently swallowed before, rendering as an empty table with "no
  // students match" instead of an error. loadError names what failed.
  const [loadError, setLoadError] = useState(null);
  const [filters, setFilters] = useState({ cls: "All", session: "All", batch: "All", status: "All" });
  const [search, setSearch] = useState("");
  const [showNotDefinedOnly, setShowNotDefinedOnly] = useState(false);
  const [eligTab, setEligTab] = useState("eligible"); // "eligible" | "ineligible"
  const [addPinnedEnrollNo, setAddPinnedEnrollNo] = useState(null); // Add New Student wizard: pin table to exactly one student
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
      const namedLoads = [
        ["student roster", getStudentsForReport()],
        ["academic sessions", getAcademicYearLabels()],
        ["entry batches", getPhases()],
        ["batch entries", getAllPhaseEntryEnrollments()],
        ["online register", getOnlineGrData()],
      ];
      const results = await Promise.allSettled(namedLoads.map(([, p]) => p));
      const [students, sessions, phases, entries, grData] = results;
      if (students.status === "fulfilled") setDbStudents(students.value || []);
      if (sessions.status === "fulfilled" && sessions.value?.length) setDbSessions(sessions.value);
      if (phases.status === "fulfilled") setDbPhases(phases.value || []);
      if (entries.status === "fulfilled") setDbPhaseEntryEnrollments(entries.value || []);
      if (grData.status === "fulfilled" && grData.value) {
        setOnlineGrDataset(grData.value);
      }
      // REQ-BUG-078 (3): surface any failed load instead of showing an
      // empty table that looks like "no data". First failure's own error
      // message is kept for the actual cause (promise keeps it in .reason).
      const failures = namedLoads
        .map(([name], i) => ({ name, result: results[i] }))
        .filter(({ result }) => result.status === "rejected");
      if (failures.length) {
        setLoadError(
          "Failed to load: " +
            failures.map(({ name, result }) => `${name} (${result.reason?.message || "unknown error"})`).join("; ")
        );
      } else {
        setLoadError(null);
      }
    } catch (e) {
      console.error("Government Entry loadAll error:", e);
      setLoadError(e?.message || "Failed to load government entry data");
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

  // UDISE/PEN eligibility rules, shared between the rows table and the
  // "Add New Student" picker (REQ: Online GR additions draw from the same pool).
  const eligibilityFns = useMemo(() => {
    const inAnyBatch = x => !!enrollToBatches.get(x.enrollNo)?.size;
    const birthDetailsFilled = x => !!(
      String(x.birthCertRegNo || "").trim() &&
      String(x.birthState || "").trim() &&
      String(x.birthDistrict || "").trim() &&
      String(x.birthCity || "").trim()
    );
    const aadharAvailable = x => !!String(x.aadharNo || "").trim();

    const getUdiseEligibility = x => {
      if (!x) return { eligible: false, reason: "No student record" };
      if (x.udiseStatus === "Done") return { eligible: true, reason: "" };
      if (!inAnyBatch(x)) return { eligible: false, reason: "Not in any Entry Batch" };
      const missing = [];
      if (!String(x.birthCertRegNo || "").trim()) missing.push("Birth Cert Reg No");
      if (!String(x.birthState || "").trim()) missing.push("Birth State");
      if (!String(x.birthDistrict || "").trim()) missing.push("Birth District");
      if (!String(x.birthCity || "").trim()) missing.push("Birth City");
      if (missing.length > 0) return { eligible: false, reason: `Missing ${missing.join(", ")}` };
      return { eligible: true, reason: "" };
    };

    const getPenEligibility = x => {
      if (!x) return { eligible: false, reason: "No student record" };
      if (x.penStatus === "Done" || x.penStatus === "Not Defined") return { eligible: true, reason: "" };
      if (!inAnyBatch(x)) return { eligible: false, reason: "Not in any Entry Batch" };
      const missing = [];
      if (!String(x.birthCertRegNo || "").trim()) missing.push("Birth Cert Reg No");
      if (!String(x.birthState || "").trim()) missing.push("Birth State");
      if (!String(x.birthDistrict || "").trim()) missing.push("Birth District");
      if (!String(x.birthCity || "").trim()) missing.push("Birth City");
      if (!aadharAvailable(x)) missing.push("Aadhar Card No");
      if (missing.length > 0) return { eligible: false, reason: `Missing ${missing.join(", ")}` };
      return { eligible: true, reason: "" };
    };

    const udiseEligible = x => getUdiseEligibility(x).eligible;
    const penEligible = x => getPenEligibility(x).eligible;

    return { udiseEligible, penEligible, getUdiseEligibility, getPenEligibility };
  }, [enrollToBatches]);

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

      if (onlineGrSort.key) {
        const { key, dir } = onlineGrSort;
        return list.slice().sort((a, b) => {
          const av = a[key], bv = b[key];
          const aEmpty = av === undefined || av === null || String(av).trim() === "";
          const bEmpty = bv === undefined || bv === null || String(bv).trim() === "";
          if (aEmpty && bEmpty) return 0;
          if (aEmpty) return 1;
          if (bEmpty) return -1;
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
          return dir === "desc" ? -cmp : cmp;
        });
      }

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

    // Add New Student wizard pins the table to exactly one student (by exact
    // enrollNo, not substring search — a short enrollNo can otherwise
    // false-match inside unrelated long UDISE/Aadhar numbers).
    if (addPinnedEnrollNo) d = d.filter(x => x.enrollNo === addPinnedEnrollNo);

    const { udiseEligible, penEligible } = eligibilityFns;

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
  }, [mainTab, grSubTab, onlineGrDataset, dbStudents, filters, search, enrollToBatches, eligibilityFns, mismatchDir, effectiveTab, showNotDefinedOnly, eligTab, onlineGrSort, addPinnedEnrollNo]);

  const pendingNotDefinedCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Not Defined").length,
    [dbStudents]
  );

  // ── "Add New Student" eligible pool (Online GR only) ────────────────────
  // Eligible = qualifies for UDISE or PEN entry (same rule as those tabs) and
  // isn't already in the register section that matches the student's own
  // class (Primary vs General is derived per-student, not from whichever
  // subtab happens to be open — the picker spans both and a Class filter
  // narrows it down). Rows added via this feature carry enrollNo, so those
  // match directly — but rows seeded from the original sheet import predate
  // that linkage, so those are matched, in order, by: mobile1, aadharNo,
  // then name+class+DOB. Audited against live data (416 legacy rows, 429
  // current students): mobile1/aadharNo alone catch 168 real duplicates,
  // but 316 legacy rows have no mobile1 at all (mostly General-section rows
  // from the 2024-25/2025-26 sheet import) and 186 have no aadharNo either.
  // The name+class+DOB fallback (DOB compared loosely — the legacy sheet
  // mixes DD/MM and MM/DD formatting, e.g. "07/11/2020" for a student whose
  // real DOB is 11 July 2020 — so both orderings are tried) closes 54 more
  // without the risk plain name+class would carry: 4 real same-name-
  // same-class pairs exist among current students (e.g. two different
  // "GANESH PRADHAN" in 1st), and only DOB tells them apart. A handful of
  // residual cases have a real DOB mismatch too large to be a format swap
  // (e.g. "AASHIKA YADAV" — 05/12/2016 vs. register's 11/07/2016) — those
  // are left unmatched rather than guessed at (safer to risk showing an
  // already-registered student than to wrongly hide one who still needs an
  // entry). NOT name+mobile: the sheet import has names like "AYUSHMATI
  // BASANTA DAKUA" for a student whose real record is "AYUSHMATI DAKUA"
  // (no middle name) — same mobile, different name string.
  const normKey = v => String(v || "").trim().toUpperCase();
  function classSection(cls) {
    if (PRIMARY_CLASSES_OPTIONS.includes(cls)) return "primary";
    if (GENERAL_CLASSES_OPTIONS.includes(cls)) return "general";
    return null;
  }
  function dobLooselyMatches(a, b) {
    if (!a || a === "-" || !b || b === "-") return true; // missing data can't contradict a match
    if (a === b) return true;
    const [d1, m1, y1] = a.split("/");
    const [d2, m2, y2] = b.split("/");
    if (!d1 || !m1 || !y1 || !d2 || !m2 || !y2) return false;
    return y1 === y2 && ((d1 === d2 && m1 === m2) || (d1 === m2 && m1 === d2));
  }

  const sectionAlreadyAdded = useMemo(() => {
    const buildFor = section => {
      const list = onlineGrDataset[section] || [];
      const enrollNos = new Set(list.map(r => r.enrollNo).filter(Boolean));
      const mobileKeys = new Set(
        list
          .map(r => normKey(r.mobile1))
          .filter(v => v && v !== "-")
      );
      const aadharKeys = new Set(
        list
          .map(r => normKey(r.aadharNo))
          .filter(v => v && v !== "-")
      );
      const byNameClass = new Map();
      for (const r of list) {
        const k = `${normKey(r.name)}|${normKey(r.cls)}`;
        if (!byNameClass.has(k)) byNameClass.set(k, []);
        byNameClass.get(k).push(r.dobSlash);
      }
      return { enrollNos, mobileKeys, aadharKeys, byNameClass };
    };
    return { primary: buildFor("primary"), general: buildFor("general") };
  }, [onlineGrDataset]);

  const addableStudents = useMemo(() => {
    return dbStudents
      .map(decorate)
      .filter(x => classSection(x.cls));
  }, [dbStudents]);

  // REQ-VIEW-001: eligibility status badge for the Add New Student picker.
  // Shows a compact colored badge indicating whether the student is Done,
  // Eligible, or Ineligible with reason for both UDISE and PEN.
  const eligibilityBadge = (st) => {
    const udiseDone  = st.udiseStatus  === "Done";
    const penDone    = st.penStatus    === "Done";
    const penDefined = st.penStatus    === "Not Defined"; // allowed to skip PEN

    const udiseInfo = eligibilityFns.getUdiseEligibility(st);
    const penInfo   = eligibilityFns.getPenEligibility(st);

    if (udiseDone && (penDone || penDefined)) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-100 text-green-800">✅ UDISE Done · PEN {penDefined ? "Not Defined" : "Done"}</span>;
    }
    if (udiseDone && !penInfo.eligible) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800" title={`PEN Ineligible: ${penInfo.reason}`}>⏳ UDISE Done · ❌ PEN Ineligible</span>;
    }
    if (udiseDone && penInfo.eligible) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800">⏳ UDISE Done · 📝 PEN Eligible</span>;
    }
    if (!udiseInfo.eligible && (penDone || penDefined)) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800" title={`UDISE Ineligible: ${udiseInfo.reason}`}>❌ UDISE Ineligible · PEN Done</span>;
    }
    if (udiseInfo.eligible && (penDone || penDefined)) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800">📝 UDISE Eligible · PEN Done</span>;
    }
    if (!udiseInfo.eligible && !penInfo.eligible) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-800" title={`UDISE: ${udiseInfo.reason}; PEN: ${penInfo.reason}`}>❌ Ineligible (UDISE &amp; PEN)</span>;
    }
    if (!udiseInfo.eligible && penInfo.eligible) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800" title={`UDISE Ineligible: ${udiseInfo.reason}`}>❌ UDISE Inelig · 📝 PEN Elig</span>;
    }
    if (udiseInfo.eligible && !penInfo.eligible) {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800" title={`PEN Ineligible: ${penInfo.reason}`}>📝 UDISE Elig · ❌ PEN Inelig</span>;
    }
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-800">📝 UDISE Elig · 📝 PEN Elig</span>;
  };

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

  // ── Auto-scroll to end of table by default ──────────────────────────────
  const tableContainerRef = useRef(null);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const scrollToEnd = () => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
      }
    };
    requestAnimationFrame(scrollToEnd);
    const timer = setTimeout(scrollToEnd, 60);
    return () => clearTimeout(timer);
  }, [rows, mainTab, grSubTab, filters]);

  // ── Entry Done modal ────────────────────────────────────────────────────
  const [modalRow, setModalRow] = useState(null);
  const modalIsDone = useMemo(() => {
    if (!modalRow) return false;
    if (mainTab === "onlineGr") {
      return modalRow.status === "Done" || Boolean(modalRow.grNo && modalRow.grNo !== "-");
    }
    if (effectiveTab === "udise") {
      return modalRow.udiseStatus === "Done" || Boolean(modalRow.udise && String(modalRow.udise).trim() && String(modalRow.udise).trim() !== "-");
    }
    return modalRow.penStatus === "Done" || modalRow.penStatus === "Not Defined" || Boolean(modalRow.pen && String(modalRow.pen).trim() && String(modalRow.pen).trim() !== "-");
  }, [modalRow, mainTab, effectiveTab]);
  const [formGrNo, setFormGrNo] = useState("");
  const [formDoeSlash, setFormDoeSlash] = useState("");
  const [formUdise, setFormUdise] = useState("");
  const [formPen, setFormPen] = useState("");
  const [formPenNotDefined, setFormPenNotDefined] = useState(false);
  const [formApaar, setFormApaar] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Delete confirmation (Online GR only) ────────────────────────────────
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function openDeleteConfirm(row) {
    setDeleteRow(row);
    setDeleteError("");
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    setDeleteRow(null);
  }

  async function handleDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteOnlineGrRow(deleteRow.id, grSubTab);
      setOnlineGrDataset(prev => ({
        ...prev,
        [grSubTab]: (prev[grSubTab] || []).filter(r => r.id !== deleteRow.id),
      }));
      setDeleteRow(null);
    } catch (e) {
      setDeleteError(e.message || "Failed to delete record.");
    } finally {
      setDeleting(false);
    }
  }

  function toggleOnlineGrSort(key) {
    setOnlineGrSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  // ── Add New Student (Online GR only) — 4-stage wizard ───────────────────
  // Stage 1: pick from the eligible pool (any class, filterable), type the
  //          Reg No — SAVED immediately into the Primary/General section
  //          determined by the student's own class. Own modal UI.
  // Stage 2: switches to the real UDISE Entry (State) tab, filtered down to
  //          just this student, so their full details are visible to copy —
  //          same as normal admin workflow. A banner (not a modal, so the
  //          table stays click-to-copy-able) offers "Next" once details are
  //          copied, which THEN opens that tab's own "Complete UDISE Entry"
  //          modal — the exact same modal/validation/save path used for any
  //          other row.
  // Stage 3: same two-phase dance (details → entry modal), on the real PEN
  //          Entry (National) tab.
  // Stage 4: back on Online GR — own modal again, final confirmation review
  //          (DOB/DOA/DOE/AADHAR/UID/PEN/APAAR/REMARK/DOCUMENTS PENDING),
  //          now reflecting whatever was just entered in stages 2–3.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addWizardActive, setAddWizardActive] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [addSubPhase, setAddSubPhase] = useState("details"); // "details" | "entry" — within stage 2/3
  const [addSearch, setAddSearch] = useState("");
  const [addClassFilter, setAddClassFilter] = useState("All");
  const [addStatusFilter, setAddStatusFilter] = useState("All"); // "All" | "UDISE Eligible" | "PEN Eligible" | "Both Pending" | "UDISE Pending" | "PEN Pending" | "Both Done"
  const [addEligFilter, setAddEligFilter] = useState("eligible"); // "eligible" | "ineligible" | "all"
  const [addSelectedStudent, setAddSelectedStudent] = useState(null);
  const [addGrNo, setAddGrNo] = useState("");
  const [addGrEditing, setAddGrEditing] = useState(false);
  const [addDoeSlash, setAddDoeSlash] = useState("");
  const [addDoeEditing, setAddDoeEditing] = useState(false);
  const [addCreatedRowId, setAddCreatedRowId] = useState(null);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const addSection = addSelectedStudent ? classSection(addSelectedStudent.cls) : null;
  const addReview = addSelectedStudent ? decorate(addSelectedStudent) : null;
  // GR/PR No was already asked in stage 1 — lock it during the UDISE/PEN
  // entry modals so it can't drift from what was just registered.
  const isWizardEntry = addWizardActive && addSubPhase === "entry";

  // ── Persistent In-Progress Wizard State (Resume Progress) ───────────────
  const [inProgressSession, setInProgressSession] = useState(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("ssis_gov_entry_wizard_progress") : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.enrollNo || parsed?.grNo) {
          setInProgressSession(parsed);
        }
      }
    } catch {}
  }, []);

  function saveProgressToStorage(data) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("ssis_gov_entry_wizard_progress", JSON.stringify(data));
      }
      setInProgressSession(data);
    } catch {}
  }

  function clearProgressFromStorage() {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("ssis_gov_entry_wizard_progress");
      }
      setInProgressSession(null);
    } catch {}
  }

  function dismissInProgress() {
    clearProgressFromStorage();
  }

  function resumeProgress(saved) {
    if (!saved) return;
    const student = dbStudents.find(
      s => (saved.enrollNo && s.enrollNo === saved.enrollNo) ||
           (saved.studentId && (s.studentId === saved.studentId || s.id === saved.studentId)) ||
           (saved.grNo && s.grNo === saved.grNo)
    ) || (saved.student ? decorate(saved.student) : null);

    if (!student) {
      alert("Could not locate the student record in database.");
      return;
    }

    const step = saved.step || 2;
    const subPhase = saved.subPhase || "details";
    const grNo = saved.grNo || student.grNo || "";
    const createdRowId = saved.createdRowId || null;

    setAddSelectedStudent(student);
    setAddGrNo(grNo);
    if (saved.doeSlash) setAddDoeSlash(saved.doeSlash);
    setAddCreatedRowId(createdRowId);
    setAddStep(step);
    setAddSubPhase(subPhase);
    setAddWizardActive(true);

    if (step === 2) {
      setMainTab("udise");
      setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
      setEligTab(eligibilityFns.udiseEligible(student) ? "eligible" : "ineligible");
      setSearch("");
      setAddPinnedEnrollNo(student.enrollNo);
      setAddModalOpen(false);
      if (subPhase === "entry") {
        openEntryModal(student);
        setFormGrNo(grNo);
      }
    } else if (step === 3) {
      setMainTab("pen");
      setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
      setEligTab(eligibilityFns.penEligible(student) ? "eligible" : "ineligible");
      setSearch("");
      setAddPinnedEnrollNo(student.enrollNo);
      setAddModalOpen(false);
      if (subPhase === "entry") {
        openEntryModal(student);
        setFormGrNo(grNo);
      }
    } else if (step === 4) {
      setMainTab("onlineGr");
      const sec = classSection(student.cls);
      if (sec) setGrSubTab(sec);
      setAddPinnedEnrollNo(null);
      setAddModalOpen(true);
    } else {
      setMainTab("onlineGr");
      setAddModalOpen(true);
    }
  }

  function resumeFromOnlineGrRow(row) {
    if (!row) return;
    const student = dbStudents.find(
      s => (row.enrollNo && s.enrollNo === row.enrollNo) ||
           (row.aadharNo && row.aadharNo !== "-" && s.aadharNo === row.aadharNo) ||
           (row.mobile1 && row.mobile1 !== "-" && s.mobile1 === row.mobile1) ||
           (row.name && s.name && s.name.toUpperCase() === row.name.toUpperCase() && s.cls === row.cls)
    );

    if (!student) {
      alert(`Could not link ${row.name || "this row"} to a database student record.`);
      return;
    }

    const grNo = row.grNo || student.grNo || "";
    const createdRowId = row.id;

    const hasUdise = (student.udise && student.udise !== "-") || (row.udise && row.udise !== "-");
    const hasPen = (student.pen && student.pen !== "-" && student.pen !== "Not Defined") || (row.pen && row.pen !== "-" && row.pen !== "Not Defined");
    const penNotDefined = student.pen === "Not Defined" || row.pen === "Not Defined";

    let step = 2;
    if (hasUdise && !(hasPen || penNotDefined)) {
      step = 3;
    } else if (hasUdise && (hasPen || penNotDefined)) {
      step = 4;
    }

    const sessionData = {
      enrollNo: student.enrollNo,
      studentId: student.studentId || student.id,
      grNo,
      step,
      subPhase: "details",
      createdRowId,
      section: row.section || classSection(student.cls),
      studentName: student.name,
      cls: student.cls,
      session: student.session || row.session,
      timestamp: Date.now(),
    };

    saveProgressToStorage(sessionData);
    resumeProgress(sessionData);
  }

  // ── GR / PR Number Conflict Checking ─────────────────────────────────────
  // Ensures one GR No (General) or PR No (Primary) cannot be assigned to another
  // student if already taken by someone else in the database or Online GR register.
  const checkGrConflict = useCallback((candidateGrNo, currentStudent, section, currentRowId) => {
    const normVal = normKey(candidateGrNo);
    if (!normVal || normVal === "-") return null;

    const currentEnrollNo = currentStudent?.enrollNo ? normKey(currentStudent.enrollNo) : (currentStudent?.enroll_no ? normKey(currentStudent.enroll_no) : null);
    const currentStudentId = currentStudent?.studentId || currentStudent?.id || null;
    const currentAadhar = currentStudent?.aadharNo && currentStudent.aadharNo !== "-"
      ? normKey(currentStudent.aadharNo)
      : (currentStudent?.aadhar_no && currentStudent.aadhar_no !== "-" ? normKey(currentStudent.aadhar_no) : null);
    const currentName = currentStudent?.name ? normKey(currentStudent.name) : null;
    const currentCls = currentStudent?.cls ? normKey(currentStudent.cls) : null;

    const isSameStudent = (candidate) => {
      const candEnroll = candidate?.enrollNo ? normKey(candidate.enrollNo) : (candidate?.enroll_no ? normKey(candidate.enroll_no) : null);
      if (currentEnrollNo && candEnroll && currentEnrollNo === candEnroll) return true;

      const candStudentId = candidate?.studentId || candidate?.id || null;
      if (currentStudentId && candStudentId && currentStudentId === candStudentId) return true;

      const candAadhar = candidate?.aadharNo && candidate.aadharNo !== "-"
        ? normKey(candidate.aadharNo)
        : (candidate?.aadhar_no && candidate.aadhar_no !== "-" ? normKey(candidate.aadhar_no) : null);
      if (currentAadhar && candAadhar && currentAadhar === candAadhar) return true;

      const candName = candidate?.name ? normKey(candidate.name) : null;
      const candCls = candidate?.cls ? normKey(candidate.cls) : null;
      if (currentName && candName && currentName === candName) {
        if (!currentCls || !candCls || currentCls === candCls) return true;
      }

      return false;
    };

    const sec = section || (currentStudent?.cls ? classSection(currentStudent.cls) : null);

    // 1. Check in dbStudents
    for (const s of dbStudents) {
      const sGr = normKey(s.grNo);
      if (!sGr || sGr === "-") continue;
      if (sGr === normVal) {
        if (isSameStudent(s)) continue;
        if (sec) {
          const sSec = classSection(s.cls);
          if (sSec && sSec !== sec) continue;
        }
        return {
          source: "database",
          name: s.name,
          cls: s.cls,
          enrollNo: s.enrollNo,
          grNo: s.grNo,
        };
      }
    }

    // 2. Check in onlineGrDataset
    const sectionsToCheck = sec ? [sec] : ["primary", "general"];
    for (const sName of sectionsToCheck) {
      const list = onlineGrDataset[sName] || [];
      for (const r of list) {
        const rGr = normKey(r.grNo || r.gr_no);
        if (!rGr || rGr === "-") continue;
        if (rGr === normVal) {
          if (currentRowId && r.id === currentRowId) continue;
          if (isSameStudent({
            enrollNo: r.enrollNo || r.enroll_no,
            studentId: r.studentId,
            id: r.id,
            aadharNo: r.aadharNo || r.aadhar_no,
            name: r.name,
            cls: r.cls,
          })) {
            continue;
          }
          return {
            source: "onlineGr",
            name: r.name,
            cls: r.cls,
            enrollNo: r.enrollNo || r.enroll_no,
            grNo: r.grNo || r.gr_no,
          };
        }
      }
    }

    return null;
  }, [dbStudents, onlineGrDataset]);

  const getConflictWarning = useCallback((conflict, section) => {
    if (!conflict) return "";
    const regLabel = section === "primary" ? "PR No" : "GR No";
    const details = [];
    if (conflict.cls) details.push(conflict.cls);
    if (conflict.enrollNo && conflict.enrollNo !== "-") details.push(`Enroll: ${conflict.enrollNo}`);
    const studentDesc = `${conflict.name}${details.length ? ` (${details.join(" · ")})` : ""}`;
    return `This ${regLabel} (${conflict.grNo}) is already assigned to ${studentDesc}. You first need to change that student's ${regLabel} to assign this ${regLabel} to this student.`;
  }, []);

  const findExistingOnlineGrRow = useCallback((st, section) => {
    if (!st || !section) return null;
    const list = onlineGrDataset[section] || [];
    const stEnroll = st.enrollNo ? normKey(st.enrollNo) : null;
    const stAadhar = st.aadharNo && st.aadharNo !== "-" ? normKey(st.aadharNo) : null;
    const stMobile = st.mobile1 && st.mobile1 !== "-" ? normKey(st.mobile1) : null;
    const stName = st.name ? normKey(st.name) : null;
    const stCls = st.cls ? normKey(st.cls) : null;

    return list.find(r => {
      const rEnroll = r.enrollNo || r.enroll_no ? normKey(r.enrollNo || r.enroll_no) : null;
      if (stEnroll && rEnroll && rEnroll === stEnroll) return true;

      const rAadhar = r.aadhar_no || r.aadharNo;
      if (stAadhar && rAadhar && rAadhar !== "-" && normKey(rAadhar) === stAadhar) return true;

      const rName = r.name ? normKey(r.name) : null;
      const rCls = r.cls ? normKey(r.cls) : null;
      if (stName && rName && rName === stName) {
        if (!stCls || !rCls || rCls === stCls) return true;
      }

      const rMobile = r.mobile1;
      if (stMobile && rMobile && rMobile !== "-" && normKey(rMobile) === stMobile && stName && rName && rName === stName) {
        return true;
      }

      return false;
    }) || null;
  }, [onlineGrDataset]);

  const addExistingRow = useMemo(
    () => findExistingOnlineGrRow(addSelectedStudent, addSection),
    [findExistingOnlineGrRow, addSelectedStudent, addSection]
  );

  const addGrConflict = useMemo(
    () => checkGrConflict(addGrNo, addSelectedStudent, addSection, addCreatedRowId || addExistingRow?.id),
    [checkGrConflict, addGrNo, addSelectedStudent, addSection, addCreatedRowId, addExistingRow]
  );

  const formGrSection = mainTab === "onlineGr" ? grSubTab : classSection(modalRow?.cls);
  const formGrConflict = useMemo(
    () => checkGrConflict(formGrNo, modalRow, formGrSection, modalRow?.id),
    [checkGrConflict, formGrNo, modalRow, formGrSection]
  );

  function openAddModal() {
    setAddModalOpen(true);
    setAddWizardActive(false);
    setAddStep(1);
    setAddSubPhase("details");
    setAddSearch("");
    setAddClassFilter("All");
    setAddStatusFilter("All");
    setAddEligFilter("eligible");
    setAddSelectedStudent(null);
    setAddGrNo("");
    setAddGrEditing(false);
    setAddDoeSlash(getTodaySlash());
    setAddDoeEditing(false);
    setAddCreatedRowId(null);
    setAddPinnedEnrollNo(null);
    setAddError("");
  }

  function closeAddModal() {
    if (addSaving) return;
    setAddModalOpen(false);
    setAddWizardActive(false);
  }

  // Abort the wizard from the details-review banner (no modal open there).
  function cancelAddWizard() {
    setAddWizardActive(false);
    setAddSubPhase("details");
    setAddPinnedEnrollNo(null);
  }

  // Stage 2/3, phase "details" → "entry": the admin has copied what they need
  // from the (now filtered-to-just-this-student) table, open the real tab's
  // own Entry Done modal to type in the number.
  // GR/PR No is asked once, in stage 1 — carry that same value into the
  // UDISE and PEN steps instead of pulling the student's old (possibly
  // different) GR No from their DB record, which risked a mismatch between
  // what was just registered and what got saved to the student.
  function proceedToUdiseEntryForm() {
    setAddSubPhase("entry");
    openEntryModal(addSelectedStudent);
    setFormGrNo(addGrNo);
  }
  function proceedToPenEntryForm() {
    setAddSubPhase("entry");
    openEntryModal(addSelectedStudent);
    setFormGrNo(addGrNo);
  }

  // ── Birth Certificate Upload / Download (UDISE Entry Flow) ─────────────
  const [bcUploading, setBcUploading] = useState(false);
  const [bcDownloading, setBcDownloading] = useState(false);
  const [bcMessage, setBcMessage] = useState(null);
  const bcFileInputRef = useRef(null);
  const [bcUploadTarget, setBcUploadTarget] = useState(null);

  function getBcDoc(st) {
    if (!st) return null;
    return (st.studentDocuments || []).find(
      d => d.document_types?.name === "Birth Certificate" && d.status === "Uploaded"
    ) || null;
  }

  function triggerBcUpload(st) {
    setBcUploadTarget(st);
    setBcMessage(null);
    if (bcFileInputRef.current) {
      bcFileInputRef.current.value = "";
      bcFileInputRef.current.click();
    }
  }

  async function handleDownloadBirthCert(st) {
    if (!st) return;
    setBcDownloading(true);
    setBcMessage(null);
    try {
      const studentId = st.studentId || st.id;
      let bcDoc = getBcDoc(st);
      let fileKey = bcDoc?.file_url;

      if (!fileKey && studentId) {
        const { data } = await supabase
          .from("student_documents")
          .select("file_url, status, document_types!inner(name)")
          .eq("student_id", studentId)
          .eq("document_types.name", "Birth Certificate")
          .maybeSingle();

        if (data?.status === "Uploaded" && data?.file_url) {
          fileKey = data.file_url;
        }
      }

      if (!fileKey) {
        setBcMessage({ type: "error", text: "No Birth Certificate document file found to download. Please upload one." });
        return;
      }

      const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
      const downloadName = buildDocDownloadName(st.enrollNo, st.name, "Birth_Certificate", fileKey);
      const url = await getS3ViewUrl(fileKey, downloadName);

      if (url) {
        if (win) {
          win.location.href = url;
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.download = downloadName || "Birth_Certificate";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        if (win) win.close();
        setBcMessage({ type: "error", text: "Failed to generate download URL from storage." });
      }
    } catch (err) {
      console.error("Download Birth Certificate error:", err);
      setBcMessage({ type: "error", text: err.message || "Failed to download Birth Certificate." });
    } finally {
      setBcDownloading(false);
    }
  }

  async function handleBcFileSelected(e) {
    const file = e.target?.files?.[0];
    const target = bcUploadTarget;
    if (!file || !target) return;

    e.target.value = "";

    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!allowed.includes(ext) || file.size > 5 * 1024 * 1024) {
      setBcMessage({ type: "error", text: "Invalid file. Only JPG, PNG, or PDF up to 5MB allowed." });
      return;
    }

    const studentId = target.studentId || target.id;
    if (!studentId) {
      setBcMessage({ type: "error", text: "Could not find student ID to associate document." });
      return;
    }

    setBcUploading(true);
    setBcMessage(null);

    try {
      let typeId = "9a440da1-3e42-4d3f-a2c2-6ae4e5c0f12b";
      const { data: dt } = await supabase
        .from("document_types")
        .select("id")
        .eq("name", "Birth Certificate")
        .maybeSingle();
      if (dt?.id) typeId = dt.id;

      const compressed = await compressFile(file);
      const key = `students/${studentId}/documents/birth-certificate.${fileExt(compressed)}`;
      await uploadFileToS3(compressed, key);

      const { data: upsertedDoc, error: docErr } = await supabase
        .from("student_documents")
        .upsert({
          student_id: studentId,
          document_type_id: typeId,
          status: "Uploaded",
          file_url: key,
          uploaded_at: new Date().toISOString(),
          reason: null,
        }, { onConflict: "student_id,document_type_id" })
        .select("id, status, file_url, uploaded_at")
        .single();

      if (docErr) throw docErr;

      const updatedDocItem = {
        id: upsertedDoc?.id || Date.now().toString(),
        status: "Uploaded",
        file_url: key,
        document_types: { id: typeId, name: "Birth Certificate" },
      };

      const updateStudentDocs = (prevStudent) => {
        if (!prevStudent) return prevStudent;
        const existingDocs = prevStudent.studentDocuments || [];
        const hasIdx = existingDocs.findIndex(d => d.document_types?.name === "Birth Certificate");
        let nextDocs;
        if (hasIdx >= 0) {
          nextDocs = existingDocs.map((d, i) => i === hasIdx ? { ...d, ...updatedDocItem } : d);
        } else {
          nextDocs = [...existingDocs, updatedDocItem];
        }
        return {
          ...prevStudent,
          studentDocuments: nextDocs,
        };
      };

      setDbStudents(prev => prev.map(s => (s.studentId === studentId || s.enrollNo === target.enrollNo) ? updateStudentDocs(s) : s));

      if (addSelectedStudent && (addSelectedStudent.studentId === studentId || addSelectedStudent.enrollNo === target.enrollNo)) {
        setAddSelectedStudent(prev => updateStudentDocs(prev));
      }

      if (modalRow && (modalRow.studentId === studentId || modalRow.enrollNo === target.enrollNo)) {
        setModalRow(prev => updateStudentDocs(prev));
      }

      setBcMessage({ type: "success", text: "Birth Certificate uploaded successfully!" });
    } catch (err) {
      console.error("Upload Birth Certificate error:", err);
      setBcMessage({ type: "error", text: err.message || "Failed to upload Birth Certificate." });
    } finally {
      setBcUploading(false);
    }
  }

  function renderBirthCertCard(student) {
    if (!student) return null;
    const bcDoc = getBcDoc(student);
    const isUploaded = !!bcDoc;
    const hasFile = !!bcDoc?.file_url;

    return (
      <div className={`rounded-xl border transition-all ${
        isUploaded
          ? "bg-emerald-50/70 border-emerald-200"
          : "bg-amber-50/80 border-amber-300"
      } p-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
              isUploaded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-800">Birth Certificate</span>
                {isUploaded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> Not Uploaded
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-600 truncate mt-0.5">
                {isUploaded
                  ? (hasFile ? `File: ${bcDoc.file_url.split("/").pop()}` : "Document verified in database")
                  : "No certificate uploaded — required for Gujarat state UDISE portal filing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isUploaded && (
              <button
                type="button"
                onClick={() => handleDownloadBirthCert(student)}
                disabled={bcDownloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-emerald-300 hover:border-emerald-500 text-emerald-800 shadow-sm transition-all hover:bg-emerald-50 disabled:opacity-50"
              >
                {bcDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <Download className="w-3.5 h-3.5 text-emerald-700" />}
                Download BC
              </button>
            )}

            <button
              type="button"
              onClick={() => triggerBcUpload(student)}
              disabled={bcUploading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 ${
                isUploaded
                  ? "bg-white border border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50"
                  : "bg-school-navy hover:bg-school-navy/90 text-white"
              }`}
            >
              {bcUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isUploaded ? "Re-upload" : "Upload Birth Certificate"}
            </button>
          </div>
        </div>

        {bcMessage && (
          <div className={`mt-2.5 text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5 ${
            bcMessage.type === "success"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}>
            {bcMessage.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />}
            <span>{bcMessage.text}</span>
          </div>
        )}
      </div>
    );
  }

  function getSavedGrNo(st) {
    if (!st) return "";
    if (st.grNo && st.grNo !== "-") return String(st.grNo).trim();
    const sec = classSection(st.cls);
    if (sec && onlineGrDataset[sec]) {
      const found = onlineGrDataset[sec].find(r =>
        (r.enrollNo && r.enrollNo === st.enrollNo) ||
        (st.aadharNo && r.aadharNo && r.aadharNo !== "-" && r.aadharNo === st.aadharNo) ||
        (st.mobile1 && r.mobile1 && r.mobile1 !== "-" && r.mobile1 === st.mobile1)
      );
      if (found?.grNo && found.grNo !== "-") return String(found.grNo).trim();
    }
    return "";
  }

  function selectAddStudent(st) {
    const sec = classSection(st.cls);
    const existingRow = findExistingOnlineGrRow(st, sec);
    const existingGr = existingRow?.grNo && existingRow.grNo !== "-"
      ? String(existingRow.grNo).trim()
      : getSavedGrNo(st);
    const existingDoe = existingRow?.doeSlash && existingRow.doeSlash !== "-"
      ? String(existingRow.doeSlash).trim()
      : getTodaySlash();

    setAddSelectedStudent(st);
    setAddCreatedRowId(existingRow ? existingRow.id : null);
    setAddGrNo(existingGr);
    setAddGrEditing(!existingGr);
    setAddDoeSlash(existingDoe);
    setAddDoeEditing(false);
    setAddError("");
  }

  function changeAddStudent() {
    if (addWizardActive) return; // already proceeded past stage 1 in wizard — can't swap
    setAddSelectedStudent(null);
    setAddCreatedRowId(null);
    setAddGrNo("");
    setAddGrEditing(false);
    setAddDoeSlash(getTodaySlash());
    setAddDoeEditing(false);
    setAddError("");
  }

  // Stage 1 — create/update the Online GR row right away, then hand off to
  // the real UDISE Entry tab's own Entry Done modal for this student.
  async function saveStep1AndContinue() {
    if (!addSelectedStudent || !addSection) { setAddError("Select a student first."); return; }
    if (!addGrNo.trim()) { setAddError(`${addSection === "primary" ? "PR" : "GR"} No is required.`); return; }
    if (addGrConflict) {
      setAddError(getConflictWarning(addGrConflict, addSection));
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      // If GR No was changed or newly set, also sync to students table
      const studentId = addSelectedStudent.studentId || addSelectedStudent.id;
      if (studentId && addGrNo.trim() !== String(addSelectedStudent.grNo || "").trim()) {
        try {
          await updateStudentGovId(studentId, { grNo: addGrNo.trim() });
          setDbStudents(prev => prev.map(s => s.enrollNo === addSelectedStudent.enrollNo ? { ...s, grNo: addGrNo.trim() } : s));
        } catch (err) {
          console.warn("Could not sync GR No to student record:", err);
        }
      }

      const dec = decorate({ ...addSelectedStudent, grNo: addGrNo.trim() });
      const existingRow = findExistingOnlineGrRow(addSelectedStudent, addSection);
      const targetId = addCreatedRowId || existingRow?.id;
      const id = targetId || (
        (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `gr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      );

      const udiseInfo = eligibilityFns.getUdiseEligibility(addSelectedStudent);
      const penInfo = eligibilityFns.getPenEligibility(addSelectedStudent);

      const ineligParts = [];
      if (!udiseInfo.eligible) ineligParts.push(`Ineligible for UDISE: ${udiseInfo.reason}`);
      if (!penInfo.eligible) ineligParts.push(`Ineligible for PEN: ${penInfo.reason}`);
      const ineligRemark = ineligParts.join(" | ");

      const remarksToSave = ineligRemark
        ? (dec.remarks && dec.remarks !== "-" ? `${dec.remarks} | ${ineligRemark}` : ineligRemark)
        : dec.remarks;

      const created = await updateOnlineGrRow(id, addSection, {
        enrollNo:         addSelectedStudent.enrollNo,
        session:          addSelectedStudent.session || "",
        tcStatus:         dec.tcStatus,
        cls:              addSelectedStudent.cls || "",
        grNo:             addGrNo.trim(),
        name:             addSelectedStudent.name || "",
        mobile1:          addSelectedStudent.mobile1 || "-",
        mobile2:          addSelectedStudent.mobile2 || "-",
        dobSlash:         dec.dobSlash,
        doaSlash:         dec.doaSlash,
        doeSlash:         normSlashDate(addDoeSlash) || getTodaySlash(),
        aadharNo:         addSelectedStudent.aadharNo || "-",
        udise:            addSelectedStudent.udise || "-",
        pen:              addSelectedStudent.pen || "-",
        apaar:            addSelectedStudent.apaar || "-",
        remarks:          remarksToSave,
        documentsPending: dec.documentsPending,
      });

      const finalId = created.id || id;
      setAddCreatedRowId(finalId);
      setAddSelectedStudent(prev => prev ? { ...prev, grNo: addGrNo.trim(), remarks: remarksToSave } : prev);
      setOnlineGrDataset(prev => {
        const list = prev[addSection] || [];
        const idx = list.findIndex(r => r.id === finalId);
        const nextList = idx >= 0 ? list.map(r => r.id === finalId ? created : r) : [...list, created];
        return { ...prev, [addSection]: nextList };
      });

      // Hand off depending on eligibility:
      if (udiseInfo.eligible) {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo.trim(),
          doeSlash: normSlashDate(addDoeSlash) || getTodaySlash(),
          step: 2,
          subPhase: "details",
          createdRowId: finalId,
          section: addSection,
          studentName: addSelectedStudent.name,
          cls: addSelectedStudent.cls,
          session: addSelectedStudent.session,
          timestamp: Date.now(),
        });
        setAddModalOpen(false);
        setAddWizardActive(true);
        setAddStep(2);
        setAddSubPhase("details");
        setMainTab("udise");
        setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
        setEligTab("eligible");
        setSearch("");
        setAddPinnedEnrollNo(addSelectedStudent.enrollNo);
      } else if (penInfo.eligible) {
        // UDISE ineligible — skip UDISE step and go to PEN
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo.trim(),
          doeSlash: normSlashDate(addDoeSlash) || getTodaySlash(),
          step: 3,
          subPhase: "details",
          createdRowId: finalId,
          section: addSection,
          studentName: addSelectedStudent.name,
          cls: addSelectedStudent.cls,
          session: addSelectedStudent.session,
          timestamp: Date.now(),
        });
        setAddModalOpen(false);
        setAddWizardActive(true);
        setAddStep(3);
        setAddSubPhase("details");
        setMainTab("pen");
        setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
        setEligTab("eligible");
        setSearch("");
        setAddPinnedEnrollNo(addSelectedStudent.enrollNo);
      } else {
        // Both ineligible — next steps are disabled, saved directly to register with remarks
        clearProgressFromStorage();
        setAddModalOpen(false);
        setAddWizardActive(false);
        setAddPinnedEnrollNo(null);
      }
    } catch (e) {
      setAddSaving(false);
      setAddError(e.message || "Failed to save.");
      return;
    }
    setAddSaving(false);
  }

  // Skip UDISE entry when student is not eligible — updates remarks with reason and moves to PEN or finalize
  async function skipUdiseStep() {
    if (!addCreatedRowId || !addSection || !addSelectedStudent) return;
    const udiseInfo = eligibilityFns.getUdiseEligibility(addSelectedStudent);
    const penInfo = eligibilityFns.getPenEligibility(addSelectedStudent);
    const remarkToAdd = `Ineligible for UDISE: ${udiseInfo.reason}`;
    const currRemarks = addSelectedStudent.remarks && addSelectedStudent.remarks !== "-" ? addSelectedStudent.remarks : "";
    const nextRemarks = currRemarks.includes("Ineligible for UDISE") ? currRemarks : (currRemarks ? `${currRemarks} | ${remarkToAdd}` : remarkToAdd);

    try {
      const created = await updateOnlineGrRow(addCreatedRowId, addSection, {
        remarks: nextRemarks,
      });
      setAddSelectedStudent(prev => prev ? { ...prev, remarks: nextRemarks } : prev);
      setOnlineGrDataset(prev => ({
        ...prev,
        [addSection]: (prev[addSection] || []).map(r => r.id === created.id ? created : r),
      }));

      if (penInfo.eligible) {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo,
          step: 3,
          subPhase: "details",
          createdRowId: addCreatedRowId,
          section: addSection,
          studentName: addSelectedStudent.name,
          cls: addSelectedStudent.cls,
          session: addSelectedStudent.session,
          timestamp: Date.now(),
        });
        setAddStep(3);
        setAddSubPhase("details");
        setMainTab("pen");
        setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
        setEligTab("eligible");
        setSearch("");
        setAddPinnedEnrollNo(addSelectedStudent.enrollNo);
      } else {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo,
          step: 4,
          subPhase: "details",
          createdRowId: addCreatedRowId,
          section: addSection,
          studentName: addSelectedStudent.name,
          cls: addSelectedStudent.cls,
          session: addSelectedStudent.session,
          timestamp: Date.now(),
        });
        setAddStep(4);
        setAddSubPhase("details");
        setMainTab("onlineGr");
        if (addSection) setGrSubTab(addSection);
        setAddPinnedEnrollNo(null);
        setAddModalOpen(true);
      }
    } catch (e) {
      alert("Failed to update remarks: " + e.message);
    }
  }

  // Skip PEN entry when student is not eligible — updates remarks with reason and moves to finalize
  async function skipPenStep() {
    if (!addCreatedRowId || !addSection || !addSelectedStudent) return;
    const penInfo = eligibilityFns.getPenEligibility(addSelectedStudent);
    const remarkToAdd = `Ineligible for PEN: ${penInfo.reason}`;
    const currRemarks = addSelectedStudent.remarks && addSelectedStudent.remarks !== "-" ? addSelectedStudent.remarks : "";
    const nextRemarks = currRemarks.includes("Ineligible for PEN") ? currRemarks : (currRemarks ? `${currRemarks} | ${remarkToAdd}` : remarkToAdd);

    try {
      const created = await updateOnlineGrRow(addCreatedRowId, addSection, {
        remarks: nextRemarks,
      });
      setAddSelectedStudent(prev => prev ? { ...prev, remarks: nextRemarks } : prev);
      setOnlineGrDataset(prev => ({
        ...prev,
        [addSection]: (prev[addSection] || []).map(r => r.id === created.id ? created : r),
      }));

      saveProgressToStorage({
        enrollNo: addSelectedStudent.enrollNo,
        studentId: addSelectedStudent.studentId || addSelectedStudent.id,
        grNo: addGrNo,
        step: 4,
        subPhase: "details",
        createdRowId: addCreatedRowId,
        section: addSection,
        studentName: addSelectedStudent.name,
        cls: addSelectedStudent.cls,
        session: addSelectedStudent.session,
        timestamp: Date.now(),
      });
      setAddStep(4);
      setAddSubPhase("details");
      setMainTab("onlineGr");
      if (addSection) setGrSubTab(addSection);
      setAddPinnedEnrollNo(null);
      setAddModalOpen(true);
    } catch (e) {
      alert("Failed to update remarks: " + e.message);
    }
  }

  // Stage 4 — final confirmation: push the (now-filled) UDISE/PEN values and
  // recomputed Documents Pending back onto the Online GR row.
  async function finalizeAdd() {
    if (!addCreatedRowId || !addSection) { setAddModalOpen(false); setAddWizardActive(false); return; }
    setAddSaving(true);
    setAddError("");
    try {
      const dec = decorate(addSelectedStudent);
      const chosenDoe = normSlashDate(addDoeSlash) || getTodaySlash();
      const created = await updateOnlineGrRow(addCreatedRowId, addSection, {
        doeSlash:         chosenDoe,
        udise:            addSelectedStudent.udise || "-",
        pen:              addSelectedStudent.pen || "-",
        remarks:          addSelectedStudent.remarks || dec.remarks || "-",
        documentsPending: dec.documentsPending,
      });
      setOnlineGrDataset(prev => ({
        ...prev,
        [addSection]: (prev[addSection] || []).map(r => r.id === created.id ? created : r),
      }));
      clearProgressFromStorage();
      setAddModalOpen(false);
      setAddWizardActive(false);
    } catch (e) {
      setAddError(e.message || "Failed to finalize entry.");
    } finally {
      setAddSaving(false);
    }
  }

  const addEligCounts = useMemo(() => {
    let eligible = 0;
    let ineligible = 0;
    for (const st of addableStudents) {
      if (eligibilityFns.udiseEligible(st) || eligibilityFns.penEligible(st)) {
        eligible++;
      } else {
        ineligible++;
      }
    }
    return { eligible, ineligible, all: addableStudents.length };
  }, [addableStudents, eligibilityFns]);

  const filteredAddableStudents = useMemo(() => {
    let list = addableStudents;
    if (addEligFilter === "eligible") {
      list = list.filter(x => eligibilityFns.udiseEligible(x) || eligibilityFns.penEligible(x));
    } else if (addEligFilter === "ineligible") {
      list = list.filter(x => !eligibilityFns.udiseEligible(x) && !eligibilityFns.penEligible(x));
    }
    if (addClassFilter !== "All") list = list.filter(x => x.cls === addClassFilter);
    if (addStatusFilter !== "All") {
      list = list.filter(x => {
        const udiseDone = x.udiseStatus === "Done";
        const penDone = x.penStatus === "Done";
        const penDefined = x.penStatus === "Not Defined";
        switch (addStatusFilter) {
          case "UDISE Eligible":   return eligibilityFns.udiseEligible(x);
          case "PEN Eligible":     return eligibilityFns.penEligible(x);
          case "Both Pending":     return !udiseDone && x.penStatus === "Pending";
          case "UDISE Pending":    return !udiseDone;
          case "PEN Pending":      return x.penStatus === "Pending";
          case "Both Done":        return udiseDone && penDone;
          case "UDISE Done":       return udiseDone;
          case "PEN Done":         return penDone || penDefined;
          default:                 return true;
        }
      });
    }
    const q = addSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(x =>
        String(x.name || "").toLowerCase().includes(q) ||
        String(x.enrollNo || "").toLowerCase().includes(q) ||
        String(x.grNo || "").toLowerCase().includes(q) ||
        String(x.cls || "").toLowerCase().includes(q) ||
        String(x.mobile1 || "").toLowerCase().includes(q) ||
        String(x.aadharNo || "").toLowerCase().includes(q) ||
        String(x.udise || "").toLowerCase().includes(q) ||
        String(x.pen || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [addableStudents, addEligFilter, addClassFilter, addStatusFilter, addSearch, eligibilityFns]);

  function openStudentProfile(row) {
    if (mainTab === "onlineGr") {
      openEntryModal(row);
      return;
    }
    if (row.enrollNo) router.push(`/student/${row.enrollNo}/edit`);
  }

  function openEntryModal(row) {
    setModalRow(row);
    setFormGrNo(row.grNo && row.grNo !== "-" ? row.grNo : "");
    setFormDoeSlash(row.doeSlash && row.doeSlash !== "-" ? row.doeSlash : getTodaySlash());
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
    // Cancelling mid Add-New-Student wizard just ends the wizard here —
    // whatever was already saved (the GR row, and UDISE if this was the PEN
    // step) stays saved; only the remaining hand-off stops.
    if (addWizardActive) { setAddWizardActive(false); setAddPinnedEnrollNo(null); }
  }

  async function handleSave() {
    if (!modalRow) return;
    setFormError("");

    if (formGrConflict) {
      setFormError(getConflictWarning(formGrConflict, formGrSection));
      return;
    }

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
          doeSlash: normSlashDate(formDoeSlash) || getTodaySlash(),
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
        await updateStudentGovId(modalRow.studentId, {
          grNo: formGrNo.trim(),
          udise: digits,
          apaar: formApaar.trim() || null,
        });
        await loadAll();
        setModalRow(null);
        // Add-New-Student wizard, stage 2 done — hand off to the real PEN
        // Entry tab, filtered down to this student's details again, before
        // its own Entry Done modal opens.
        if (addWizardActive && addStep === 2) {
          const nextRow = { ...modalRow, udise: digits };
          saveProgressToStorage({
            enrollNo: nextRow.enrollNo,
            studentId: modalRow.studentId,
            grNo: formGrNo.trim(),
            step: 3,
            subPhase: "details",
            createdRowId: addCreatedRowId,
            section: addSection,
            studentName: nextRow.name,
            cls: nextRow.cls,
            session: nextRow.session,
            timestamp: Date.now(),
          });
          setAddSelectedStudent(nextRow);
          setAddStep(3);
          setAddSubPhase("details");
          setMainTab("pen");
          setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
          setEligTab(eligibilityFns.penEligible(nextRow) ? "eligible" : "ineligible");
          setSearch("");
          setAddPinnedEnrollNo(nextRow.enrollNo);
        }
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
      const penValue = formPenNotDefined ? "Not Defined" : formPen.trim();
      await updateStudentGovId(modalRow.studentId, {
        grNo: formGrNo.trim(),
        pen: penValue,
        apaar: formApaar.trim() || null,
      });
      await loadAll();
      setModalRow(null);
      // Add-New-Student wizard, stage 3 done — back to Online GR for the
      // final confirmation review (stage 4).
      if (addWizardActive && addStep === 3) {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: modalRow.studentId,
          grNo: addGrNo,
          step: 4,
          subPhase: "details",
          createdRowId: addCreatedRowId,
          section: addSection,
          studentName: addSelectedStudent.name,
          cls: addSelectedStudent.cls,
          session: addSelectedStudent.session,
          timestamp: Date.now(),
        });
        setAddSelectedStudent(prev => prev ? { ...prev, pen: penValue } : prev);
        setAddStep(4);
        setAddSubPhase("details");
        setMainTab("onlineGr");
        if (addSection) setGrSubTab(addSection);
        setAddPinnedEnrollNo(null);
        setAddModalOpen(true);
      }
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
      {/* REQ-BUG-078 (3): failed data loads used to render as a silent
          empty table - show an explicit banner with what failed. */}
      {loadError && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-800 px-3 py-2 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600"/>
          <span>{loadError}</span>
        </div>
      )}
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Government Entry</h2>
          <p className="text-sm text-gray-500 mt-0.5">File Online General Register, UDISE &amp; PEN entries into government portals and record results</p>
        </div>
        <div className="flex items-center gap-2">
          {inProgressSession && !addWizardActive && (
            <button
              type="button"
              onClick={() => resumeProgress(inProgressSession)}
              title={`Resume entry for ${inProgressSession.grNo || inProgressSession.studentName}`}
              className="flex items-center gap-1.5 text-xs border border-amber-400 bg-amber-100 px-3 py-1.5 rounded-lg text-amber-900 hover:bg-amber-200 transition-all shadow-sm font-semibold animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Resume {inProgressSession.grNo || "Progress"}
            </button>
          )}
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

      {/* In Progress Resume Banner */}
      {inProgressSession && !addWizardActive && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 flex-wrap">
                <span>Entry in Progress:</span>
                <span className="font-mono bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">{inProgressSession.grNo || "Student"}</span>
                <span>· {inProgressSession.studentName} ({inProgressSession.cls})</span>
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                You left off at <b>Step {inProgressSession.step} of 4: {
                  inProgressSession.step === 2 ? "UDISE Entry" :
                  inProgressSession.step === 3 ? "PEN Entry" :
                  inProgressSession.step === 4 ? "Final Confirmation" : "Select Student"
                }</b>. Click Resume to continue right where you left off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => resumeProgress(inProgressSession)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all"
            >
              ▶ Resume {inProgressSession.grNo ? `${inProgressSession.grNo} ` : ""}Progress
            </button>
            <button
              type="button"
              onClick={dismissInProgress}
              title="Discard this in-progress entry"
              className="text-xs font-semibold px-2.5 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-amber-100 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {/* Add New Student wizard — details-review phase (table stays click-to-copy-able, no modal) */}
      {addWizardActive && addSubPhase === "details" && (mainTab === "udise" || mainTab === "pen") && (
        (() => {
          const isUdiseStep = mainTab === "udise";
          const eligInfo = isUdiseStep
            ? eligibilityFns.getUdiseEligibility(addSelectedStudent)
            : eligibilityFns.getPenEligibility(addSelectedStudent);

          return (
            <div className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-xs ${
              eligInfo.eligible ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-300 text-amber-900"
            }`}>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 flex-shrink-0 text-school-navy"/>
                <span>
                  <span className="font-semibold">Add New Student — Step {isUdiseStep ? 2 : 3} of 4: {isUdiseStep ? "UDISE" : "PEN"} Entry.</span>
                  {" "}
                  {eligInfo.eligible ? (
                    <>Copy {addSelectedStudent?.name || "this student"}&apos;s details below (click any cell to copy), then continue to enter the {isUdiseStep ? "UDISE" : "PEN"} No.</>
                  ) : (
                    <span className="font-semibold text-red-700">
                      ⚠️ Student is NOT ELIGIBLE for {isUdiseStep ? "UDISE" : "PEN"} Entry ({eligInfo.reason}). Next step is disabled.
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={cancelAddWizard}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                {eligInfo.eligible ? (
                  <button onClick={isUdiseStep ? proceedToUdiseEntryForm : proceedToPenEntryForm}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors">
                    Next: Enter {isUdiseStep ? "UDISE" : "PEN"} No →
                  </button>
                ) : (
                  <button onClick={isUdiseStep ? skipUdiseStep : skipPenStep}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                    Mark Ineligible &amp; {isUdiseStep ? "Skip to PEN Entry →" : "Finalize →"}
                  </button>
                )}
              </div>
            </div>
          );
        })()
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

      {addWizardActive && addSubPhase === "details" && (mainTab === "udise" || mainTab === "pen") ? (
        /* Add New Student wizard — full details page for this one student, not a table row */
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-800">{addSelectedStudent?.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {addSelectedStudent?.cls} · Reg No {addGrNo || "-"} · Click any field below to copy its value
            </p>
          </div>

          {/* Birth Certificate Action Section (UDISE Entry Flow) */}
          {mainTab === "udise" && (
            <div className="mb-4">
              {renderBirthCertCard(addSelectedStudent)}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {columns.map(c => {
              const rawValue = formatCellValue(c, addSelectedStudent?.[c.key]);
              return (
                <div key={c.key}
                  tabIndex={0}
                  onFocus={() => copyCellToClipboard(rawValue)}
                  className="border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-school-navy focus:bg-blue-50 transition-colors">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</div>
                  <div className="text-sm text-gray-800 font-medium mt-0.5 break-words">
                    {rawValue !== "" && rawValue !== "-" ? String(rawValue) : <span className="text-gray-300">-</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Filters & Actions directly above table */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
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

              {/* Action buttons directly above the table */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="text-xs text-gray-500 font-medium">
                  {rows.length} {rows.length === 1 ? "student" : "students"}
                </span>

                {mainTab === "onlineGr" && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    title="Add a new student into this register"
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 shadow-sm transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5"/> Add New Student
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div
            ref={tableContainerRef}
            className={`overflow-auto rounded-xl border border-gray-200 shadow-sm ${fullscreen ? "max-h-[calc(100vh-220px)]" : "max-h-[70vh]"}`}
          >
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
                    onClick={mainTab === "onlineGr" ? () => toggleOnlineGrSort("status") : undefined}
                    style={{ position: "sticky", top: 0, left: stickyLeft[2], zIndex: 30 }}
                    className={`bg-school-navy px-3 py-2.5 text-left font-semibold whitespace-nowrap ${mainTab === "onlineGr" ? "cursor-pointer hover:bg-school-navy/80 select-none" : ""}`}>
                    <span className="inline-flex items-center gap-0.5">
                      Status
                      {mainTab === "onlineGr" && onlineGrSort.key === "status" && (onlineGrSort.dir === "asc" ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                    </span>
                  </th>
                  {columns.map((c, i) => {
                    const frozenIdx = i + 3;
                    const isFrozen = frozenIdx < frozenCount;
                    const sortable = mainTab === "onlineGr";
                    const isSorted = sortable && onlineGrSort.key === c.key;
                    return (
                      <th key={c.key}
                        ref={isFrozen ? (el => { frozenHeaderRefs.current[frozenIdx] = el; }) : undefined}
                        onClick={sortable ? () => toggleOnlineGrSort(c.key) : undefined}
                        style={isFrozen ? { position: "sticky", top: 0, left: stickyLeft[frozenIdx], zIndex: 30 } : { position: "sticky", top: 0, zIndex: 20 }}
                        className={`bg-school-navy px-3 py-2.5 text-left font-semibold whitespace-nowrap ${sortable ? "cursor-pointer hover:bg-school-navy/80 select-none" : ""}`}>
                        <span className="inline-flex items-center gap-0.5">
                          {c.label}
                          {isSorted && (onlineGrSort.dir === "asc" ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}
                        </span>
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
                      title={mainTab === "onlineGr" ? "Double-click to edit this entry" : "Double-click to edit this student"}
                      className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${rowBg}`}>
                      <td style={{ position: "sticky", left: stickyLeft[0], zIndex: 10 }} className={`${rowBgSolid} px-3 py-2 text-center whitespace-nowrap`}>
                        {(() => {
                          const isOnlineGr = mainTab === "onlineGr";
                          const isUdise = effectiveTab === "udise";
                          const eligInfo = isOnlineGr
                            ? { eligible: true }
                            : (isUdise ? eligibilityFns.getUdiseEligibility(row) : eligibilityFns.getPenEligibility(row));
                          const isElig = eligInfo.eligible;

                          const isDone = isOnlineGr
                            ? (row.status === "Done" || Boolean(row.grNo && row.grNo !== "-"))
                            : isUdise
                            ? (row.udiseStatus === "Done" || Boolean(row.udise && String(row.udise).trim() && String(row.udise).trim() !== "-"))
                            : (row.penStatus === "Done" || row.penStatus === "Not Defined" || Boolean(row.pen && String(row.pen).trim() && String(row.pen).trim() !== "-"));

                          return (
                            <div className="inline-flex items-center gap-1">
                              {isDone ? (
                                <button
                                  onClick={() => isElig && openEntryModal(row)}
                                  disabled={!isElig}
                                  title={
                                    !isElig
                                      ? `Not eligible for ${isUdise ? "UDISE" : "PEN"} Entry: ${eligInfo.reason}`
                                      : (isOnlineGr ? "Edit General Register entry" : `Edit ${isUdise ? "UDISE" : "PEN"} details`)
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                    isElig
                                      ? "bg-blue-50 text-school-navy border border-blue-300 hover:bg-school-navy hover:text-white shadow-xs"
                                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                                  }`}>
                                  <Pencil className="w-3 h-3"/> Edit
                                </button>
                              ) : (
                                <button
                                  onClick={() => isElig && openEntryModal(row)}
                                  disabled={!isElig}
                                  title={!isElig ? `Not eligible for ${isUdise ? "UDISE" : "PEN"} Entry: ${eligInfo.reason}` : "Entry Done"}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                    isElig
                                      ? "bg-school-navy text-white hover:bg-school-navy/90 shadow-xs"
                                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                                  }`}>
                                  <CheckCircle2 className="w-3 h-3"/> Entry Done
                                </button>
                              )}
                              {isUdise && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (getBcDoc(row)) handleDownloadBirthCert(row);
                                    else triggerBcUpload(row);
                                  }}
                                  title={getBcDoc(row) ? "Download / View Birth Certificate" : "Upload Birth Certificate (Missing)"}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors ${
                                    getBcDoc(row)
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                      : "text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100"
                                  }`}
                                >
                                  {getBcDoc(row) ? <Download className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                                </button>
                              )}
                              {isOnlineGr && status === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() => resumeFromOnlineGrRow(row)}
                                  title={`Resume progress for ${row.grNo || row.name}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors shadow-xs"
                                >
                                  ▶ Resume
                                </button>
                              )}
                              {isOnlineGr && (
                                <button onClick={() => openDeleteConfirm(row)}
                                  title="Delete this record"
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                                  <Trash2 className="w-3 h-3"/>
                                </button>
                              )}
                            </div>
                          );
                        })()}
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
        </>
      )}

      {/* Entry Done modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {modalIsDone ? (
                    mainTab === "onlineGr"
                      ? (grSubTab === "primary" ? "Edit Primary Register Entry (PR)" : "Edit General Register Entry (GR)")
                      : (effectiveTab === "udise" ? "Edit UDISE Entry" : "Edit PEN Entry")
                  ) : (
                    mainTab === "onlineGr"
                      ? (grSubTab === "primary" ? "Complete Primary Register Entry (PR)" : "Complete General Register Entry (GR)")
                      : (effectiveTab === "udise" ? "Complete UDISE Entry" : "Complete PEN Entry")
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{modalRow.name || "Student"} - {modalRow.cls || ""} - Reg No {modalRow.grNo || "-"}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {addWizardActive && addSubPhase === "entry" && (addStep === 2 || addStep === 3) ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-school-navy bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                  <UserPlus className="w-3.5 h-3.5 flex-shrink-0"/>
                  Add New Student — Step {addStep} of 4: enter the {addStep === 2 ? "UDISE" : "PEN"} No below for {modalRow?.name}.
                </div>
              ) : modalIsDone ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                  <Pencil className="w-3.5 h-3.5 flex-shrink-0 text-school-navy"/>
                  Editing saved details for {modalRow?.name}. Update any fields below and click Save Changes.
                </div>
              ) : null}
              {mainTab === "onlineGr" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {grSubTab === "primary" ? "PR No (Primary Register No)" : "GR No (General Register No)"}
                    </label>
                    <input type="text" value={formGrNo}
                      onChange={e => { setFormGrNo(e.target.value); if (formError) setFormError(""); }}
                      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        formGrConflict
                          ? "border-red-400 focus:ring-red-400 bg-red-50/30"
                          : "border-gray-200 focus:ring-school-navy"
                      }`}
                      placeholder={grSubTab === "primary" ? "e.g. P001" : "e.g. 101"}/>
                    {formGrConflict && (
                      <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 mt-0.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                        <span className="font-medium">{getConflictWarning(formGrConflict, formGrSection)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Date of Entry (DOE)
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormDoeSlash(getTodaySlash())}
                        className="text-[10px] font-semibold text-school-navy hover:underline"
                      >
                        Set to Today ({getTodaySlash()})
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formDoeSlash}
                        onChange={e => setFormDoeSlash(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      />
                      <input
                        type="date"
                        value={slashToIso(formDoeSlash)}
                        onChange={e => {
                          if (e.target.value) setFormDoeSlash(isoToSlash(e.target.value));
                        }}
                        className="w-10 border border-gray-200 rounded-lg p-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-school-navy cursor-pointer bg-white"
                        title="Pick from calendar"
                      />
                    </div>
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
                  {/* Birth Certificate Action Section (UDISE Entry Modal) */}
                  {renderBirthCertCard(modalRow)}

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GR No</label>
                    <input type="text" value={formGrNo} readOnly={isWizardEntry}
                      onChange={e => { if (!isWizardEntry) { setFormGrNo(e.target.value); if (formError) setFormError(""); } }}
                      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        formGrConflict && !isWizardEntry
                          ? "border-red-400 focus:ring-red-400 bg-red-50/30"
                          : "border-gray-200 focus:ring-school-navy"
                      } ${isWizardEntry ? "bg-gray-100 text-gray-500" : ""}`}
                      placeholder="GR No"/>
                    {formGrConflict && !isWizardEntry && (
                      <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 mt-0.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                        <span className="font-medium">{getConflictWarning(formGrConflict, formGrSection)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UDISE No (18 digits)</label>
                    <input type="text" value={formUdise} onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={18}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="e.g. 242215044262310036"/>
                    <span className="text-[10px] text-gray-400">{formUdise.length}/18 digits</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">APAAR ID (Optional)</label>
                    <input type="text" value={formApaar} onChange={e => setFormApaar(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="APAAR ID"/>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GR No</label>
                    <input type="text" value={formGrNo} readOnly={isWizardEntry}
                      onChange={e => { if (!isWizardEntry) { setFormGrNo(e.target.value); if (formError) setFormError(""); } }}
                      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        formGrConflict && !isWizardEntry
                          ? "border-red-400 focus:ring-red-400 bg-red-50/30"
                          : "border-gray-200 focus:ring-school-navy"
                      } ${isWizardEntry ? "bg-gray-100 text-gray-500" : ""}`}
                      placeholder="GR No"/>
                    {formGrConflict && !isWizardEntry && (
                      <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 mt-0.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                        <span className="font-medium">{getConflictWarning(formGrConflict, formGrSection)}</span>
                      </div>
                    )}
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

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">APAAR ID (Optional)</label>
                    <input type="text" value={formApaar} onChange={e => setFormApaar(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="APAAR ID"/>
                  </div>
                </>
              )}

              {formError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/> {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={closeModal} disabled={saving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !!formGrConflict}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                {saving ? "Saving..." : (modalIsDone ? "Save Changes" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Student modal (Online GR only) — 4-step wizard */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] max-h-[850px] min-h-[550px] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Add New Student
                  {addSection && <span className="text-gray-400 font-semibold"> — {addSection === "primary" ? "Primary Register (PR)" : "General Register (GR)"}</span>}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Step {addStep} of 4 — {
                    addStep === 1 ? "Select student & enter Reg No" :
                    addStep === 2 ? "UDISE Entry" :
                    addStep === 3 ? "PEN Entry" : "Final confirmation"
                  }
                </p>
              </div>
              <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1 flex flex-col min-h-0">
              {addStep === 1 && !addSelectedStudent && (
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  {/* Eligibility filter pills */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs flex-shrink-0">
                      <button type="button" onClick={() => setAddEligFilter("eligible")}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${addEligFilter === "eligible" ? "bg-school-navy text-white shadow" : "text-gray-600 hover:text-gray-900"}`}>
                        Eligible Only ({addEligCounts.eligible})
                      </button>
                      <button type="button" onClick={() => setAddEligFilter("ineligible")}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${addEligFilter === "ineligible" ? "bg-school-navy text-white shadow" : "text-gray-600 hover:text-gray-900"}`}>
                        Ineligible Only ({addEligCounts.ineligible})
                      </button>
                      <button type="button" onClick={() => setAddEligFilter("all")}
                        className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${addEligFilter === "all" ? "bg-school-navy text-white shadow" : "text-gray-600 hover:text-gray-900"}`}>
                        All Students ({addEligCounts.all})
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {addEligFilter === "eligible" && "Ready for UDISE or PEN portal entry"}
                      {addEligFilter === "ineligible" && "Missing batch assignment / birth / Aadhar details"}
                      {addEligFilter === "all" && "All enrolled students in database"}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
                      <input type="text" value={addSearch} onChange={e => setAddSearch(e.target.value)}
                        placeholder="Search by name, class, enroll no, GR no, mobile, aadhar..."
                        className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"/>
                    </div>
                    <select value={addClassFilter} onChange={e => setAddClassFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy">
                      {["All", ...CLASSES].map(o => <option key={o}>{o}</option>)}
                    </select>
                    <select value={addStatusFilter} onChange={e => setAddStatusFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy">
                      <option value="All">All Statuses</option>
                      <option value="UDISE Eligible">UDISE Eligible</option>
                      <option value="PEN Eligible">PEN Eligible</option>
                      <option value="Both Pending">UDISE &amp; PEN Both Pending</option>
                      <option value="UDISE Pending">UDISE Pending</option>
                      <option value="PEN Pending">PEN Pending</option>
                      <option value="UDISE Done">UDISE Done</option>
                      <option value="PEN Done">PEN Done</option>
                      <option value="Both Done">UDISE &amp; PEN Both Done</option>
                    </select>
                  </div>

                  <div className="border border-gray-200 rounded-lg flex-1 min-h-[320px] overflow-y-auto divide-y divide-gray-100">
                    {filteredAddableStudents.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-gray-400">
                        No {addEligFilter === "eligible" ? "eligible" : addEligFilter === "ineligible" ? "ineligible" : ""} students found matching your filters.<br/>
                        {addEligFilter === "eligible" && "Eligible = qualifies for UDISE or PEN entry."}
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-2 text-[10px] text-gray-500 bg-gray-50 border-b flex items-center justify-between">
                          <span>
                            Showing <strong className="text-gray-700">{filteredAddableStudents.length}</strong> of{" "}
                            <strong className="text-gray-700">
                              {addEligFilter === "eligible" ? addEligCounts.eligible : addEligFilter === "ineligible" ? addEligCounts.ineligible : addEligCounts.all}
                            </strong>{" "}
                            {addEligFilter === "eligible" ? "eligible" : addEligFilter === "ineligible" ? "ineligible" : ""} student{filteredAddableStudents.length !== 1 ? "s" : ""}
                            {(addSearch || addClassFilter !== "All" || addStatusFilter !== "All") && " (filtered)"}
                          </span>
                          <span className="text-gray-400">
                            Total in database: {addEligCounts.all}
                          </span>
                        </div>
                        {filteredAddableStudents.map(st => (
                          <button key={st.enrollNo} type="button" onClick={() => selectAddStudent(st)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                <span className="font-semibold text-gray-800">{st.name}</span>
                                <span className="text-gray-400"> · {st.cls} · {st.session}</span>
                              </span>
                              <span className="flex-shrink-0">{eligibilityBadge(st)}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {addStep === 1 && addSelectedStudent && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Student</span>
                    {!addCreatedRowId && (
                      <button type="button" onClick={changeAddStudent} className="text-[10px] font-semibold text-school-navy hover:underline">
                        Change student
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">AY</span><div className="font-semibold text-gray-700">{addSelectedStudent.session || "-"}</div></div>
                    <div><span className="text-gray-400">TC</span><div className="font-semibold text-gray-700">{addReview?.tcStatus}</div></div>
                    <div><span className="text-gray-400">STD</span><div className="font-semibold text-gray-700">{addSelectedStudent.cls}</div></div>
                    <div><span className="text-gray-400">NAME</span><div className="font-semibold text-gray-700">{addSelectedStudent.name}</div></div>
                    <div><span className="text-gray-400">MOBILE 1</span><div className="font-semibold text-gray-700">{addSelectedStudent.mobile1 || "-"}</div></div>
                    <div><span className="text-gray-400">MOBILE 2</span><div className="font-semibold text-gray-700">{addSelectedStudent.mobile2 || "-"}</div></div>
                    <div className="col-span-2 pt-1">{eligibilityBadge(addReview)}</div>
                  </div>

                  {/* UDISE & PEN Eligibility Breakdown */}
                  {(() => {
                    const udiseInfo = eligibilityFns.getUdiseEligibility(addSelectedStudent);
                    const penInfo = eligibilityFns.getPenEligibility(addSelectedStudent);
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">UDISE Eligibility:</span>
                          {udiseInfo.eligible ? (
                            <span className="text-green-700 font-semibold flex items-center gap-1">✅ Eligible</span>
                          ) : (
                            <span className="text-red-600 font-semibold flex items-center gap-1" title={udiseInfo.reason}>
                              ❌ Ineligible ({udiseInfo.reason})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">PEN Eligibility:</span>
                          {penInfo.eligible ? (
                            <span className="text-green-700 font-semibold flex items-center gap-1">✅ Eligible</span>
                          ) : (
                            <span className="text-red-600 font-semibold flex items-center gap-1" title={penInfo.reason}>
                              ❌ Ineligible ({penInfo.reason})
                            </span>
                          )}
                        </div>
                        {(!udiseInfo.eligible || !penInfo.eligible) && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1 border border-amber-200">
                            ℹ️ Ineligible next steps will be disabled. The Online GR row will be marked with remark:{" "}
                            <span className="font-medium">
                              {[
                                !udiseInfo.eligible ? `UDISE (${udiseInfo.reason})` : null,
                                !penInfo.eligible ? `PEN (${penInfo.reason})` : null,
                              ].filter(Boolean).join("; ")}
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* GR / PR Number Section */}
                  {(() => {
                    const existingGr = getSavedGrNo(addSelectedStudent);
                    const isPrimary = addSection === "primary";
                    const labelTitle = isPrimary ? "PR No (Primary Register No)" : "GR No (General Register No)";

                    if (existingGr && !addGrEditing) {
                      return (
                        <div className="flex flex-col gap-2">
                          {addExistingRow && (
                            <div className="flex items-center gap-2 p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-blue-600" />
                              <span>
                                Already registered in {isPrimary ? "Primary Register" : "Online General Register"} · Saving updates existing record in-place (no duplicate created)
                              </span>
                            </div>
                          )}
                          <div className={`flex items-center justify-between p-3 rounded-lg border ${
                            addGrConflict
                              ? "bg-red-50/80 border-red-300"
                              : "bg-green-50/80 border-green-200"
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${
                                addGrConflict ? "bg-red-500" : "bg-green-500"
                              }`}></span>
                              <div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                  addGrConflict ? "text-red-800" : "text-green-800"
                                }`}>
                                  <span>{labelTitle}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    addGrConflict ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                                  }`}>
                                    {addGrConflict ? "Conflict with another student" : "Already Saved in Record"}
                                  </span>
                                </div>
                                <div className="text-base font-bold text-gray-900 tracking-wide font-mono mt-0.5">
                                  {addGrNo || existingGr}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAddGrEditing(true)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-school-navy hover:text-blue-900 bg-white border border-gray-300 hover:border-school-navy px-3 py-1.5 rounded-md shadow-sm transition-all"
                            >
                              ✏️ Edit {isPrimary ? "PR No" : "GR No"}
                            </button>
                          </div>
                          {addGrConflict && (
                            <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                              <span className="font-medium">{getConflictWarning(addGrConflict, addSection)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        {addExistingRow && (
                          <div className="flex items-center gap-1.5 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-blue-600" />
                            <span>Already in {isPrimary ? "Primary Register" : "Online General Register"} · Saving updates existing record in-place</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                            {existingGr ? `Edit ${labelTitle}` : `${labelTitle} *`}
                          </label>
                          {existingGr && (
                            <button
                              type="button"
                              onClick={() => {
                                setAddGrNo(existingGr);
                                setAddGrEditing(false);
                                if (addError) setAddError("");
                              }}
                              className="text-[11px] font-medium text-gray-500 hover:text-gray-700 underline"
                            >
                              Cancel edit (keep {existingGr})
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={addGrNo}
                            onChange={e => {
                              setAddGrNo(e.target.value);
                              if (addError) setAddError("");
                            }}
                            placeholder={isPrimary ? "e.g. P101" : "e.g. 201"}
                            className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 bg-white ${
                              addGrConflict
                                ? "border-red-400 focus:ring-red-400 bg-red-50/30"
                                : "border-gray-300 focus:ring-school-navy"
                            }`}
                            autoFocus={addGrEditing}
                          />
                          {existingGr && (
                            <button
                              type="button"
                              onClick={() => setAddGrEditing(false)}
                              disabled={!addGrNo.trim() || !!addGrConflict}
                              className="text-xs font-semibold px-3 py-2 bg-school-navy text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50"
                            >
                              Done
                            </button>
                          )}
                        </div>
                        {addGrConflict && (
                          <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
                            <span className="font-medium">{getConflictWarning(addGrConflict, addSection)}</span>
                          </div>
                        )}
                        {!existingGr && !addGrConflict && (
                          <span className="text-[11px] text-amber-700">
                            ℹ️ Student currently does not have a {isPrimary ? "PR No" : "GR No"} assigned. Enter it here to save.
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Date of Entry (DOE) Section */}
                  {(() => {
                    const today = getTodaySlash();
                    const currentDoe = addDoeSlash || today;
                    const isToday = currentDoe === today;

                    if (!addDoeEditing) {
                      return (
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/60 border-blue-200">
                          <div className="flex items-center gap-2.5">
                            <Calendar className="w-4 h-4 text-school-navy flex-shrink-0" />
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-school-navy flex items-center gap-1.5">
                                <span>Date of Entry (DOE)</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                  isToday ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                }`}>
                                  {isToday ? "Today (Default)" : "Custom Date"}
                                </span>
                              </div>
                              <div className="text-base font-bold text-gray-900 tracking-wide font-mono mt-0.5">
                                {currentDoe}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddDoeEditing(true)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-school-navy hover:text-blue-900 bg-white border border-gray-300 hover:border-school-navy px-3 py-1.5 rounded-md shadow-sm transition-all"
                          >
                            ✏️ Edit Date
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-school-navy" />
                            Date of Entry (DOE)
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAddDoeSlash(today);
                                if (addError) setAddError("");
                              }}
                              className="text-[11px] font-medium text-school-navy hover:underline"
                            >
                              Set to Today ({today})
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => setAddDoeEditing(false)}
                              className="text-[11px] font-medium text-gray-500 hover:text-gray-700 underline"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={addDoeSlash}
                            onChange={e => {
                              setAddDoeSlash(e.target.value);
                              if (addError) setAddError("");
                            }}
                            placeholder="DD/MM/YYYY"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy bg-white"
                          />
                          <input
                            type="date"
                            value={slashToIso(addDoeSlash)}
                            onChange={e => {
                              if (e.target.value) {
                                setAddDoeSlash(isoToSlash(e.target.value));
                                if (addError) setAddError("");
                              }
                            }}
                            className="w-10 border border-gray-300 rounded-lg p-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-school-navy cursor-pointer bg-white"
                            title="Pick from calendar"
                          />
                          <button
                            type="button"
                            onClick={() => setAddDoeEditing(false)}
                            className="text-xs font-semibold px-3 py-2 bg-school-navy text-white rounded-lg hover:bg-blue-900 transition-colors"
                          >
                            Done
                          </button>
                        </div>
                        <span className="text-[11px] text-gray-500">
                          Format: DD/MM/YYYY. Defaults to today&apos;s date, but can be changed if back-dating or entering prior date.
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {addStep === 4 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Auto-filled from {addSelectedStudent?.name}&apos;s student record — nothing to type here, just confirm and save.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div><span className="text-gray-400">DOB</span><div className="font-semibold text-gray-700">{addReview?.dobSlash || "-"}</div></div>
                    <div><span className="text-gray-400">DOA</span><div className="font-semibold text-gray-700">{addReview?.doaSlash || "-"}</div></div>
                    <div><span className="text-gray-400">DOE</span><div className="font-semibold text-gray-700">{addDoeSlash || addReview?.doeSlash || getTodaySlash()}</div></div>
                    <div><span className="text-gray-400">AADHAR</span><div className="font-semibold text-gray-700">{addSelectedStudent?.aadharNo || "-"}</div></div>
                    <div><span className="text-gray-400">UID</span><div className="font-semibold text-gray-700">{addSelectedStudent?.udise || "-"}</div></div>
                    <div><span className="text-gray-400">PEN</span><div className="font-semibold text-gray-700">{addSelectedStudent?.pen || "-"}</div></div>
                    <div><span className="text-gray-400">APAAR</span><div className="font-semibold text-gray-700">{addSelectedStudent?.apaar || "-"}</div></div>
                    <div><span className="text-gray-400">REMARK</span><div className="font-semibold text-gray-700">{addReview?.remarks || "-"}</div></div>
                    <div className="col-span-2"><span className="text-gray-400">DOCUMENTS PENDING</span><div className="font-semibold text-gray-700">{addReview?.documentsPending || "-"}</div></div>
                  </div>
                </div>
              )}

              {addError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/> {addError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={closeAddModal} disabled={addSaving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              {addStep === 1 && (
                (() => {
                  const udiseInfo = addSelectedStudent ? eligibilityFns.getUdiseEligibility(addSelectedStudent) : { eligible: false };
                  const penInfo = addSelectedStudent ? eligibilityFns.getPenEligibility(addSelectedStudent) : { eligible: false };
                  const bothIneligible = addSelectedStudent && !udiseInfo.eligible && !penInfo.eligible;

                  return (
                    <button onClick={saveStep1AndContinue} disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                        bothIneligible
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : !udiseInfo.eligible
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-school-navy text-white hover:bg-school-navy/90"
                      }`}>
                      {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                      {addSaving
                        ? "Saving..."
                        : bothIneligible
                        ? "Save & Mark Ineligible (Next Steps Disabled)"
                        : !udiseInfo.eligible
                        ? "Save & Skip to PEN Entry (UDISE Ineligible) →"
                        : "Save & Continue to UDISE Entry"}
                    </button>
                  );
                })()
              )}
              {addStep === 4 && (
                <button onClick={finalizeAdd} disabled={addSaving}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60">
                  {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                  {addSaving ? "Saving..." : "Entry Done"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800">Delete Record</h3>
              <button onClick={closeDeleteConfirm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Permanently delete <span className="font-semibold text-gray-800">{deleteRow.name || "this record"}</span>
                {" "}({grSubTab === "primary" ? "PR" : "GR"} {deleteRow.grNo || "-"}) from the Online General Register?
                This cannot be undone.
              </p>
              {deleteError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/> {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={closeDeleteConfirm} disabled={deleting}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                {deleting ? "Deleting..." : "Delete"}
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

      {/* Hidden file input for Birth Certificate upload / re-upload */}
      <input
        type="file"
        ref={bcFileInputRef}
        onChange={handleBcFileSelected}
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
      />
    </div>
  );
}
