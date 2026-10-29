"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark, IdCard, RefreshCw, CheckCircle2, AlertTriangle, X,
  Loader2, HelpCircle, Search, Maximize2, Minimize2, Download, BookOpen,
  ChevronUp, ChevronDown, Trash2, UserPlus, Upload, FileText, Calendar, Pencil,
  School, Clock, RotateCcw, ArrowLeft
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

function classSection(cls) {
  if (PRIMARY_CLASSES_OPTIONS.includes(cls)) return "primary";
  if (GENERAL_CLASSES_OPTIONS.includes(cls)) return "general";
  return null;
}

function parseDateParts(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  const str = String(dateStr).trim();
  const clean = str.includes("T") ? str.split("T")[0] : str;
  const delim = clean.includes("-") ? "-" : (clean.includes("/") ? "/" : null);
  if (!delim) return null;
  const parts = clean.split(delim);
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    // YYYY-MM-DD or YYYY/MM/DD
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    return { y: String(y), m: String(m).padStart(2, "0"), d: String(d).padStart(2, "0") };
  } else {
    // DD-MM-YYYY or DD/MM/YYYY
    const [d, m, y] = parts;
    if (!y || !m || !d) return null;
    return { y: String(y), m: String(m).padStart(2, "0"), d: String(d).padStart(2, "0") };
  }
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const p = parseDateParts(dateStr);
  if (!p) return dateStr;
  return `${p.d}/${p.m}/${p.y}`;
}

function fmtDateDMY(dateStr) {
  if (!dateStr) return "";
  const p = parseDateParts(dateStr);
  if (!p) return "";
  return `${p.d}-${p.m}-${p.y}`;
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
  const p = parseDateParts(slash);
  if (p) return `${p.y}-${p.m}-${p.d}`;
  return "";
}

function isoToSlash(iso) {
  if (!iso) return "";
  const p = parseDateParts(iso);
  if (p) return `${p.d}/${p.m}/${p.y}`;
  return iso;
}

function normSlashDate(str) {
  if (!str) return "";
  const p = parseDateParts(str);
  if (p) return `${p.d}/${p.m}/${p.y}`;
  return String(str).trim();
}

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dobParts(dateStr) {
  if (!dateStr) return { birthYear: "", birthMonth: "", birthDate: "" };
  const p = parseDateParts(dateStr);
  if (!p) return { birthYear: "", birthMonth: "", birthDate: "" };
  const mi = parseInt(p.m, 10), di = parseInt(p.d, 10);
  return {
    birthYear:  p.y || "",
    birthMonth: mi && mi >= 1 && mi <= 12 ? `${mi}-${MONTH_ABBR[mi - 1]}` : "",
    birthDate:  di ? String(di) : "",
  };
}

function nameWithSurname(name, surname) {
  return [name, surname].filter(Boolean).join(" ").trim();
}

const OTHER_SCHOOL_TAG_REGEX = /<!--OTHER_SCHOOL:({[\s\S]*?})-->/;

function serializeOtherSchoolData(data) {
  if (!data) return "";
  const payload = {
    portal: data.portal || "",
    udiseActive: data.udiseActive || false,
    penActive: data.penActive || false,

    // UDISE Import specific (State Portal: ssgujarat.org)
    udiseSchoolName: data.udiseSchoolName || (data.udiseActive ? data.schoolName : "") || "",
    udisePrincipalName: data.udisePrincipalName || (data.udiseActive ? data.headmaster : "") || "",
    udisePrincipalMobile: data.udisePrincipalMobile || (data.udiseActive ? data.contactNo : "") || "",
    udiseUid: data.udiseUid || data.uid || "",
    udiseRequestSentDate: data.udiseRequestSentDate || data.requestSentDate || "",
    udiseTcUploaded: data.udiseTcUploaded || data.tcUploaded || "",
    udiseStatus: data.udiseStatus || (data.udiseActive ? data.status : "") || "",
    udiseRemark: data.udiseRemark || (data.udiseActive ? data.remark : "") || "",

    // PEN Import specific (National Portal: udiseplus.gov.in)
    penSchoolName: data.penSchoolName || (data.penActive ? data.schoolName : "") || "",
    penSchoolUdise: data.penSchoolUdise || data.schoolUdise || "",
    penState: data.penState || data.state || "",
    penDistrict: data.penDistrict || data.district || "",
    penBlock: data.penBlock || data.block || "",
    penHeadmaster: data.penHeadmaster || (data.penActive ? data.headmaster : "") || "",
    penContactNo: data.penContactNo || (data.penActive ? data.contactNo : "") || "",
    penStatus: data.penStatus || (data.penActive ? data.status : "") || "",
    penRemark: data.penRemark || (data.penActive ? data.remark : "") || "",

    // Fallbacks for backward compatibility
    schoolName: data.schoolName || data.udiseSchoolName || data.penSchoolName || "",
    schoolUdise: data.schoolUdise || data.penSchoolUdise || "",
    state: data.state || data.penState || "",
    district: data.district || data.penDistrict || "",
    block: data.block || data.penBlock || "",
    headmaster: data.headmaster || data.udisePrincipalName || data.penHeadmaster || "",
    contactNo: data.contactNo || data.udisePrincipalMobile || data.penContactNo || "",
    status: data.status || data.udiseStatus || data.penStatus || "",
    remark: data.remark || data.udiseRemark || data.penRemark || "",
  };
  return `<!--OTHER_SCHOOL:${JSON.stringify(payload)}-->`;
}

function cleanPortalAlertText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // strip zero-width chars
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, " ") // normalize whitespace
    .replace(/\r\n|\r/g, "\n");
}

function parsePortalAlertText(text) {
  if (!text || typeof text !== "string") return null;
  const clean = cleanPortalAlertText(text);
  const res = {};

  // 1. DISTRICT
  const districtMatch = clean.match(
    /(?:DISTRICT|જીલ્લો)\s*[:：\-]\s*(.+?)(?=\s*[,;]\s*(?:BLOCK|SCHOOL|PRINCIP|UID|તાલુકો|શાળા)|[\r\n]|\s+(?:BLOCK|SCHOOL|PRINCIP|UID|તાલુકો|શાળા)\b|$)/i
  );
  if (districtMatch) {
    const d = districtMatch[1].trim().replace(/^["'`]|["'`]$/g, "").replace(/[,;:\-]+$/, "").trim();
    if (d) res.district = d;
  }

  // 2. BLOCK
  const blockMatch = clean.match(
    /(?:BLOCK|તાલુકો)\s*[:：\-]\s*(.+?)(?=\s*[,;]\s*(?:DISTRICT|SCHOOL|PRINCIP|UID|જીલ્લો|શાળા)|[\r\n]|\s+(?:SCHOOL|PRINCIP|UID|શાળા)\b|$)/i
  );
  if (blockMatch) {
    const b = blockMatch[1].trim().replace(/^["'`]|["'`]$/g, "").replace(/[,;:\-]+$/, "").trim();
    if (b) res.block = b;
  }

  // 3. SCHOOL NAME
  // Strategy A: Match explicit SCHOOL / SCHOOL NAME / શાળા label (handles colons, full-width colons, hyphens, and whitespace)
  const schoolLabelMatch = clean.match(
    /(?:SCHOOL(?:\s*NAME)?|શાળા(?:\s*નું\s*નામ)?)\s*[:：\-]\s*(.+?)(?=\s+માં(?:\s*છે)?|\s*[,;]\s*(?:PRINCIP|HEADMASTER|HM|MOBILE|CONTACT|UID|DISTRICT|BLOCK|આચાર્ય|મોબાઈલ|\d{10})|\s+(?:PRINCIP(?:LE|AL)|HEADMASTER|HM|MOBILE|CONTACT|UID|આચાર્ય)\b|[\r\n]|$)/i
  );
  if (schoolLabelMatch) {
    let sc = schoolLabelMatch[1].trim();
    sc = sc.replace(/\s*માં(?:\s*છે)?\s*$/i, "").replace(/\s*મા(?:\s*છે)?\s*$/i, "");
    sc = sc.replace(/^["'`]|["'`]$/g, "").replace(/[,;:\-]+$/, "").trim();
    if (sc) res.schoolName = sc;
  }

  // Strategy B: If no explicit label, look for Gujarati alert line "... માં છે" / "... મા છે"
  if (!res.schoolName) {
    const trailingMaMatch = clean.match(/(?:^|[\r\n])\s*(?:તે\s*રેકોર્ડ\s*)?([^\r\n]+?)\s+માં(?:\s*છે)?(?:\s*[\r\n]|$)/i);
    if (trailingMaMatch) {
      let sc = trailingMaMatch[1].trim();
      sc = sc.replace(/^(?:SCHOOL(?:\s*NAME)?|શાળા(?:\s*નું\s*નામ)?)\s*[:：\-]\s*/i, "");
      sc = sc.replace(/^["'`]|["'`]$/g, "").replace(/[,;:\-]+$/, "").trim();
      if (sc && sc.length > 2 && !/^(?:DISTRICT|BLOCK|UID|જીલ્લો|તાલુકો)/i.test(sc)) {
        res.schoolName = sc;
      }
    }
  }

  // Strategy C: Check if line starts with "SCHOOL" without colon or separated by space
  if (!res.schoolName) {
    const bareSchoolMatch = clean.match(/(?:^|[\r\n])\s*SCHOOL\s+([^\r\n]+?)(?=\s+માં|\s+(?:PRINCIP|HM|HEADMASTER)|[\r\n]|$)/i);
    if (bareSchoolMatch) {
      let sc = bareSchoolMatch[1].trim();
      sc = sc.replace(/\s*માં(?:\s*છે)?\s*$/i, "").replace(/[,;:\-]+$/, "").trim();
      if (sc) res.schoolName = sc;
    }
  }

  // Extract School 11-digit UDISE code if present (e.g. 24221504426)
  const schoolUdiseMatch = clean.match(/\b(24\d{9})\b/);
  if (schoolUdiseMatch) {
    res.schoolUdise = schoolUdiseMatch[1].trim();
  }

  // 4. PRINCIPAL NAME
  const principleMatch = clean.match(
    /(?:PRINCIP(?:LE|AL)(?:\s*NAME)?|HEADMASTER(?:\s*NAME)?|HM(?:\s*NAME)?|આચાર્ય(?:\s*નું\s*નામ)?)\s*[:：\-]\s*(.+?)(?=\s*[,;]\s*(?:PRINCIP|HEADMASTER|HM|MOBILE|CONTACT|UID|\d{10}|તમારી|મોબાઈલ)|[\r\n]|\s+(?:PRINCIP(?:LE|AL)|HEADMASTER|HM|MOBILE|CONTACT|UID)\b|$)/i
  );
  if (principleMatch) {
    let hm = principleMatch[1].trim();
    hm = hm.replace(/^["'`]|["'`]$/g, "").replace(/[,;:\-]+$/, "").trim();
    if (hm) res.headmaster = hm;
  }

  // 5. PRINCIPAL MOBILE NO (10 digits starting with 6,7,8,9, with optional +91 prefix)
  const mobileLabelMatch = clean.match(
    /(?:PRINCIP(?:LE|AL)\s+(?:MOBILE|CONTACT)(?:\s*NO)?|MOBILE(?:\s*NO)?|CONTACT(?:\s*NO)?|ફોન(?:\s*નંબર)?|મોબાઈલ(?:\s*નંબર)?)\s*[:：\-]?\s*(?:\+?91[\s\-]*)?([6-9]\d{9})\b/i
  );
  if (mobileLabelMatch) {
    res.contactNo = mobileLabelMatch[1].trim();
  } else {
    // Fallback: search for 10 digit Indian mobile
    const anyMobile = clean.match(/(?:(?:\+?91[\s\-]*)|\b)([6-9]\d{9})\b/);
    if (anyMobile) res.contactNo = anyMobile[1].trim();
  }

  // 6. STUDENT UID (18 digits, in Gujarat typically starts with 24)
  const uidGujaratMatch = clean.match(/\b(24\d{16})\b/);
  if (uidGujaratMatch) {
    res.uid = uidGujaratMatch[1].trim();
  } else {
    const any18Digits = clean.match(/\b(\d{18})\b/);
    if (any18Digits) res.uid = any18Digits[1].trim();
  }

  return res;
}

function parseOtherSchoolRemarks(remarksStr) {
  if (!remarksStr || typeof remarksStr !== "string") return null;
  const match = remarksStr.match(OTHER_SCHOOL_TAG_REGEX);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function stripOtherSchoolTag(remarksStr) {
  if (!remarksStr || typeof remarksStr !== "string") return "";
  return remarksStr.replace(OTHER_SCHOOL_TAG_REGEX, "").trim();
}

function buildCombinedRemarks(baseRemarks, otherSchoolObj) {
  const cleanBase = stripOtherSchoolTag(baseRemarks);
  if (!otherSchoolObj) return cleanBase;
  const tag = serializeOtherSchoolData(otherSchoolObj);
  return cleanBase ? `${cleanBase} ${tag}` : tag;
}

function decorate(st) {
  if (!st) return null;
  const fatherNameOnly = st.fatherNameOnly || st.fatherName || "";
  const motherNameOnly = st.motherNameOnly || st.motherName || "";

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
  const effectiveDob = st.dob || (st.dobSlash && st.dobSlash !== "-" ? slashToIso(st.dobSlash) : "") || (st.dob_slash && st.dob_slash !== "-" ? slashToIso(st.dob_slash) : "");
  const dobP = dobParts(effectiveDob || st.dob || st.dobSlash || st.dob_slash);

  const otherSchoolData = parseOtherSchoolRemarks(st.remarks);
  const isUdiseOtherSchool = Boolean(
    (st.udise && String(st.udise).trim().toLowerCase().includes("active in other school")) ||
    (otherSchoolData && (otherSchoolData.portal === "udise" || otherSchoolData.portal === "both" || otherSchoolData.udiseActive))
  );

  let udiseStatus = "Pending";
  if (isUdiseOtherSchool) {
    udiseStatus = "Active in other school";
  } else if (st.udise && String(st.udise).trim() && String(st.udise).trim() !== "-") {
    udiseStatus = "Done";
  }

  const isPenOtherSchool = Boolean(
    (st.pen && String(st.pen).trim().toLowerCase().includes("active in other school")) ||
    (otherSchoolData && (otherSchoolData.portal === "pen" || otherSchoolData.portal === "both" || otherSchoolData.penActive || (!otherSchoolData.portal && (!st.pen || st.pen === "-"))))
  );

  let penStatus = "Pending";
  if (isPenOtherSchool) {
    penStatus = "Active in other school";
  } else if (st.pen && String(st.pen).trim() && String(st.pen).trim() !== "Not Defined") {
    penStatus = "Done";
  } else if (st.pen && String(st.pen).trim() === "Not Defined") {
    penStatus = "Not Defined";
  }

  const tcDoc = (st.studentDocuments || st.student_documents || []).find(
    d => (d.document_types?.name === "Leaving Certificate" || d.document_types?.name === "Transfer Certificate") &&
         (d.status === "Uploaded" || Boolean(d.file_url))
  );
  const hasTcDoc = Boolean(tcDoc);

  // UDISE Import specific (State Portal: ssgujarat.org)
  const udiseImportSchoolName = otherSchoolData?.udiseSchoolName || (isUdiseOtherSchool ? otherSchoolData?.schoolName : "") || (isUdiseOtherSchool ? st.lastSchoolName : "") || "-";
  const udiseImportPrincipalName = otherSchoolData?.udisePrincipalName || (isUdiseOtherSchool ? otherSchoolData?.headmaster : "") || "-";
  const udiseImportPrincipalMobile = otherSchoolData?.udisePrincipalMobile || (isUdiseOtherSchool ? otherSchoolData?.contactNo : "") || "-";
  const udiseImportStudentUid = otherSchoolData?.udiseUid || (st.udise && st.udise !== "Active in other school" && st.udise !== "-" ? st.udise : "") || "-";
  const udiseImportRequestSentDate = otherSchoolData?.udiseRequestSentDate || "-";
  // Auto-detected from student documents: "Uploaded" if document exists, otherwise "Not Uploaded" (no manual dropdown)
  const udiseImportTcUploaded = hasTcDoc ? "Uploaded" : "Not Uploaded";
  const udiseImportStatus = otherSchoolData?.udiseStatus || (isUdiseOtherSchool ? "Active in other school" : "-");
  const udiseImportRemark = otherSchoolData?.udiseRemark || (isUdiseOtherSchool ? otherSchoolData?.remark : "") || "-";

  // PEN Import specific (National Portal: udiseplus.gov.in)
  const penImportSchoolName = otherSchoolData?.penSchoolName || (isPenOtherSchool ? otherSchoolData?.schoolName : "") || (isPenOtherSchool ? st.lastSchoolName : "") || "-";
  const penImportSchoolUdise = otherSchoolData?.penSchoolUdise || otherSchoolData?.schoolUdise || "-";
  const penImportState = otherSchoolData?.penState || otherSchoolData?.state || "-";
  const penImportDistrict = otherSchoolData?.penDistrict || otherSchoolData?.district || "-";
  const penImportBlock = otherSchoolData?.penBlock || otherSchoolData?.block || "-";
  const penImportHeadmaster = otherSchoolData?.penHeadmaster || (isPenOtherSchool ? otherSchoolData?.headmaster : "") || "-";
  const penImportContactNo = otherSchoolData?.penContactNo || (isPenOtherSchool ? otherSchoolData?.contactNo : "") || "-";
  const penImportStatus = otherSchoolData?.penStatus || (isPenOtherSchool ? "Active in other school" : "-");
  const penImportRemark = otherSchoolData?.penRemark || (isPenOtherSchool ? otherSchoolData?.remark : "") || "-";

  // Combined import fields for "All" view
  const importIdentifier = udiseImportStudentUid !== "-" ? udiseImportStudentUid : (st.pen && st.pen !== "-" ? st.pen : "-");
  const importSchoolName = udiseImportSchoolName !== "-" ? udiseImportSchoolName : penImportSchoolName;
  const importContactPerson = udiseImportPrincipalName !== "-" ? udiseImportPrincipalName : penImportHeadmaster;
  const importContactNo = udiseImportPrincipalMobile !== "-" ? udiseImportPrincipalMobile : penImportContactNo;
  const importStatus = (isUdiseOtherSchool && isPenOtherSchool) ? "Active in both portals" : (isUdiseOtherSchool ? udiseImportStatus : (isPenOtherSchool ? penImportStatus : "-"));
  const importRemark = udiseImportRemark !== "-" ? udiseImportRemark : penImportRemark;

  return {
    ...st,
    dob:                  effectiveDob || st.dob || "",
    ...dobP,
    dobDMY:               fmtDateDMY(effectiveDob || st.dob || st.dobSlash || st.dob_slash),
    dobSlash:             fmtDate(effectiveDob || st.dob || st.dobSlash || st.dob_slash) || "-",
    doaSlash:             fmtDate(st.joinDate || st.doaSlash) || "-",
    doeSlash:             (st.doeSlash && st.doeSlash !== "-") ? st.doeSlash : (st.dateOfEntry ? fmtDate(st.dateOfEntry) : getTodaySlash()),
    fatherNameOnly,
    motherNameOnly,
    fatherName:           nameWithSurname(fatherNameOnly, st.surname),
    motherName:           nameWithSurname(motherNameOnly, st.surname),
    studentFatherSurname: `${st.firstName || ""} ${fatherNameOnly} ${st.surname || ""}`.trim(),
    fullAddress:          [st.plotNo, st.society, st.landmark, st.area, "Surat", "Gujarat", st.pinCode].filter(Boolean).join(", "),
    udiseStatus,
    penStatus,
    otherSchoolData,

    // UDISE Import fields
    udiseImportSchoolName,
    udiseImportPrincipalName,
    udiseImportPrincipalMobile,
    udiseImportStudentUid,
    udiseImportRequestSentDate,
    udiseImportTcUploaded,
    udiseImportStatus,
    udiseImportRemark,

    // PEN Import fields
    penImportSchoolName,
    penImportSchoolUdise,
    penImportState,
    penImportDistrict,
    penImportBlock,
    penImportHeadmaster,
    penImportContactNo,
    penImportStatus,
    penImportRemark,

    // Combined fields
    importIdentifier,
    importSchoolName,
    importContactPerson,
    importContactNo,
    importStatus,
    importRemark,

    otherSchoolName:      otherSchoolData?.schoolName || st.lastSchoolName || "-",
    otherSchoolUdise:     otherSchoolData?.schoolUdise || "-",
    otherSchoolLocation:  [otherSchoolData?.district, otherSchoolData?.block].filter(Boolean).join(" - ") || otherSchoolData?.state || "-",
    otherSchoolHm:        otherSchoolData?.headmaster || "-",
    otherSchoolContact:   otherSchoolData?.contactNo || "-",
    otherSchoolStatus:    otherSchoolData?.status || (isUdiseOtherSchool || isPenOtherSchool ? "Active in School" : "-"),
    importPortal:         (isUdiseOtherSchool && isPenOtherSchool) ? "UDISE & PEN" : (isUdiseOtherSchool ? "UDISE (State)" : (isPenOtherSchool ? "PEN (National)" : (otherSchoolData?.portal || "-"))),
    otherSchoolRemark:    otherSchoolData?.remark || "-",
    grStatus,
    tcStatus,
    documentsPending,
    remarks:              st.remarks || "-",
  };
}

const STATUS_FILTER_OPTIONS = [
  "All",
  "UDISE & PEN Pending",
  "UDISE Pending",
  "PEN Pending",
  "UDISE & PEN Done",
];

const IMPORT_STATUS_OPTIONS = [
  "Active in other school",
  "Request sent to other school",
  "Request approved by other school",
];

const IMPORT_STATUS_FILTER_OPTIONS = [
  "All",
  ...IMPORT_STATUS_OPTIONS,
];

function matchesGovStatusFilter(row, filterVal) {
  if (!filterVal || filterVal === "All") return true;

  const u = String(row.udise || "").trim();
  const udiseStatus = row.udiseStatus || (
    u.toLowerCase().includes("active in other school") ? "Active in other school" :
    (Boolean(u) && u !== "-") ? "Done" : "Pending"
  );
  const udiseDone = udiseStatus === "Done" || udiseStatus === "Active in other school";
  const udisePending = udiseStatus === "Pending";

  const p = String(row.pen || "").trim();
  const penStatus = row.penStatus || (
    p.toLowerCase().includes("active in other school") ? "Active in other school" :
    p === "Not Defined" ? "Not Defined" :
    (Boolean(p) && p !== "-") ? "Done" : "Pending"
  );
  const penDone = penStatus === "Done" || penStatus === "Not Defined" || penStatus === "Active in other school";
  const penPending = penStatus === "Pending";

  const norm = filterVal.toLowerCase().trim();
  if (norm === "udise & pen pending" || norm === "both pending") {
    return udisePending && penPending;
  }
  if (norm === "udise pending") {
    return udisePending;
  }
  if (norm === "pen pending") {
    return penPending;
  }
  if (norm === "udise & pen done" || norm === "both done") {
    return udiseDone && penDone;
  }
  return true;
}

function getNextGrNo(grNo) {
  if (!grNo || typeof grNo !== "string") return "";
  const trimmed = grNo.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return trimmed;
  const prefix = match[1];
  const digits = match[2];
  const nextNum = parseInt(digits, 10) + 1;
  const padded = String(nextNum).padStart(digits.length, "0");
  return `${prefix}${padded}`;
}

function parseGrNum(val) {
  if (!val) return 0;
  const m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function getLastSavedGrInfo(section, dataset, dbStudents = []) {
  const targetSec = section || "general";
  // 1. Check register rows in dataset for this section
  const rows = Array.isArray(dataset?.[targetSec]) ? dataset[targetSec] : [];
  const validRows = rows.filter(r => {
    if (!r) return false;
    const gr = r?.grNo ? String(r.grNo).trim() : "";
    const name = r?.name ? String(r.name).trim() : "";
    return gr && gr !== "-" && name && name !== "-";
  });

  if (validRows.length > 0) {
    // REQ: "last saved should always show last row"
    // The register is ordered sequentially by GR/PR number.
    // Sort valid rows sequentially so the last row is ALWAYS the highest/last sequential row in this register.
    const sorted = [...validRows].sort((a, b) => {
      const numA = parseGrNum(a?.grNo);
      const numB = parseGrNum(b?.grNo);
      if (numA !== numB) return numA - numB;
      return String(a?.grNo || "").localeCompare(String(b?.grNo || ""), undefined, { numeric: true });
    });
    const lastRow = sorted[sorted.length - 1];
    return {
      grNo: String(lastRow.grNo).trim(),
      name: String(lastRow.name).trim(),
      cls: lastRow.cls || "",
      source: "register",
      row: lastRow,
      student: lastRow,
      enrollNo: lastRow.enrollNo || "",
      studentId: lastRow.studentId || lastRow.id || "",
      section: targetSec,
      updatedAt: lastRow.updatedAt || lastRow.updated_at || null,
    };
  }

  // 2. Fallback to dbStudents only if register has no valid rows at all
  const cleanDbStudents = (dbStudents || []).filter(Boolean);
  const sectionStudents = cleanDbStudents.filter(st => {
    if (!st) return false;
    const s = classSection(st.cls || st.class || st.standard || "");
    const gr = st.grNo ? String(st.grNo).trim() : (st.grno ? String(st.grno).trim() : "");
    const name = `${st.firstName || st.first_name || ""} ${st.surname || st.last_name || ""}`.trim() || st.name || "";
    return s === targetSec && gr && gr !== "-" && name && name !== "-";
  });

  if (sectionStudents.length > 0) {
    const sortedDb = [...sectionStudents].sort((a, b) => {
      const numA = parseGrNum(a?.grNo || a?.grno);
      const numB = parseGrNum(b?.grNo || b?.grno);
      if (numB !== numA) return numB - numA;
      return String(b?.grNo || b?.grno || "").localeCompare(String(a?.grNo || a?.grno || ""), undefined, { numeric: true });
    });
    const last = sortedDb[0];
    const fullName = `${last.firstName || last.first_name || ""} ${last.surname || last.last_name || ""}`.trim() || last.name || "";
    return {
      grNo: String(last.grNo || last.grno).trim(),
      name: fullName,
      cls: last.cls || last.class || last.standard || "",
      source: "database",
      student: last,
      row: null,
      enrollNo: last.enrollNo || last.enrollment_no || "",
      studentId: last.studentId || last.id || "",
      section: targetSec,
    };
  }

  return null;
}

// UDISE Import columns (Gujarat State Portal: ssgujarat.org)
// Distinct required details: School Name, Principal Name, Principal Mobile No, Student UID, Request Sent Date, TC Uploaded or Not, Status, Remark
const UDISE_IMPORT_COLUMNS = [
  { key: "cls",                         label: "STD" },
  { key: "grNo",                        label: "GR / PR" },
  { key: "name",                        label: "STUDENT NAME" },
  { key: "mobile1",                     label: "STUDENT MOBILE" },
  { key: "udiseImportSchoolName",       label: "SCHOOL NAME" },
  { key: "udiseImportPrincipalName",    label: "PRINCIPAL NAME" },
  { key: "udiseImportPrincipalMobile",  label: "PRINCIPAL MOBILE NO" },
  { key: "udiseImportStudentUid",       label: "STUDENT UID" },
  { key: "udiseImportRequestSentDate",  label: "REQUEST SENT DATE" },
  { key: "udiseImportTcUploaded",       label: "TC UPLOADED OR NOT" },
  { key: "udiseImportStatus",           label: "STATUS" },
  { key: "udiseImportRemark",           label: "REMARK" },
];

// PEN Import columns (National Portal: udiseplus.gov.in)
// Distinct required details: School Name, School UDISE, State, District, Block, Headmaster, Contact No, Status, Remark
const PEN_IMPORT_COLUMNS = [
  { key: "cls",                   label: "STD" },
  { key: "grNo",                  label: "GR / PR" },
  { key: "name",                  label: "STUDENT NAME" },
  { key: "mobile1",               label: "STUDENT MOBILE" },
  { key: "pen",                   label: "PEN NO" },
  { key: "penImportSchoolName",   label: "SCHOOL NAME" },
  { key: "penImportSchoolUdise",  label: "SCHOOL UDISE" },
  { key: "penImportState",        label: "STATE" },
  { key: "penImportDistrict",     label: "DISTRICT" },
  { key: "penImportBlock",        label: "BLOCK" },
  { key: "penImportHeadmaster",   label: "HEADMASTER" },
  { key: "penImportContactNo",    label: "CONTACT NO" },
  { key: "penImportStatus",       label: "STATUS" },
  { key: "penImportRemark",       label: "REMARK" },
];

// All Imports combined columns
const ALL_IMPORT_COLUMNS = [
  { key: "cls",                         label: "STD" },
  { key: "grNo",                        label: "GR / PR" },
  { key: "name",                        label: "STUDENT NAME" },
  { key: "importPortal",                label: "PORTAL" },
  { key: "importIdentifier",            label: "UID / PEN NO" },
  { key: "importSchoolName",            label: "SCHOOL NAME" },
  { key: "importContactPerson",         label: "PRINCIPAL / HM" },
  { key: "importContactNo",             label: "CONTACT NO" },
  { key: "udiseImportRequestSentDate",  label: "REQ SENT DATE" },
  { key: "udiseImportTcUploaded",       label: "TC UPLOADED" },
  { key: "importStatus",                label: "STATUS" },
  { key: "importRemark",                label: "REMARK" },
];

const IMPORT_COLUMNS = UDISE_IMPORT_COLUMNS;

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

function formatCellValue(col, value, row) {
  let v = value;
  if ((v === undefined || v === null || v === "" || v === "-") && row) {
    const dobSrc = row.dob || (row.dobSlash && row.dobSlash !== "-" ? row.dobSlash : "") || (row.dob_slash && row.dob_slash !== "-" ? row.dob_slash : "");
    if (col.key === "dobDMY") v = fmtDateDMY(dobSrc);
    else if (col.key === "birthYear") v = dobParts(dobSrc).birthYear;
    else if (col.key === "birthMonth") v = dobParts(dobSrc).birthMonth;
    else if (col.key === "birthDate") v = dobParts(dobSrc).birthDate;
    else if (col.key === "fatherNameOnly") v = row.fatherNameOnly || row.fatherName || "";
    else if (col.key === "motherNameOnly") v = row.motherNameOnly || row.motherName || "";
    else if (col.key === "dobSlash") v = fmtDate(dobSrc) || "-";
    else if (col.key === "dob") v = dobSrc;
  }
  if (v === undefined || v === null || v === "") return "";
  if (col.key === "remarks" && typeof v === "string") {
    const os = parseOtherSchoolRemarks(v);
    const clean = stripOtherSchoolTag(v);
    if (os) {
      const summary = `[Active: ${os.schoolName || "Other School"}${os.status ? ` - ${os.status}` : ""}]`;
      return clean ? `${summary} ${clean}` : summary;
    }
    return clean || "-";
  }
  return col.isDate ? fmtDate(v) : v;
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
    status === "Done"                   ? "bg-green-100 text-green-700" :
    status === "Not Defined"            ? "bg-amber-100 text-amber-700" :
    status === "Active in other school" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                                          "bg-red-100 text-red-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}>{status}</span>;
}

export default function GovernmentEntryPage() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState("onlineGr"); // "onlineGr" | "udise" | "pen" | "import" | "mismatch"
  const [grSubTab, setGrSubTab] = useState("primary"); // "primary" | "general"
  const [importSubTab, setImportSubTab] = useState("udise"); // "udise" | "pen" | "all"
  const [importModalMode, setImportModalMode] = useState("udise"); // "udise" | "pen"
  const [onlineGrSort, setOnlineGrSort] = useState({ key: null, dir: "asc" }); // Excel-like click-to-sort, Online GR only
  const [mismatchDir, setMismatchDir] = useState("udiseOnly"); // "udiseOnly" | "penOnly"
  const effectiveTab = mainTab === "onlineGr"
    ? "onlineGr"
    : mainTab === "import"
    ? importModalMode
    : (mainTab === "mismatch" ? (mismatchDir === "udiseOnly" ? "udise" : "pen") : mainTab);

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
      if (students.status === "fulfilled") setDbStudents((students.value || []).filter(Boolean));
      if (sessions.status === "fulfilled" && sessions.value?.length) setDbSessions(sessions.value);
      if (phases.status === "fulfilled") setDbPhases(phases.value || []);
      if (entries.status === "fulfilled") setDbPhaseEntryEnrollments(entries.value || []);
      if (grData.status === "fulfilled" && grData.value) {
        const sortGrList = (list) => [...(list || [])].sort((a, b) => {
          const na = parseGrNum(a?.grNo);
          const nb = parseGrNum(b?.grNo);
          if (na !== nb) return na - nb;
          return String(a?.grNo || "").localeCompare(String(b?.grNo || ""), undefined, { numeric: true });
        });
        setOnlineGrDataset({
          primary: sortGrList(grData.value.primary),
          general: sortGrList(grData.value.general),
        });
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
      if (x.udiseStatus === "Done" || x.udiseStatus === "Active in other school") return { eligible: true, reason: "" };
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
      if (x.penStatus === "Done" || x.penStatus === "Not Defined" || x.penStatus === "Active in other school") return { eligible: true, reason: "" };
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
    if (mainTab === "import") {
      return importSubTab === "udise"
        ? UDISE_IMPORT_COLUMNS
        : (importSubTab === "pen" ? PEN_IMPORT_COLUMNS : ALL_IMPORT_COLUMNS);
    }
    return effectiveTab === "udise" ? UDISE_ENTRY_COLUMNS : PEN_ENTRY_COLUMNS;
  }, [mainTab, grSubTab, importSubTab, effectiveTab]);

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

      if (filters.status !== "All") list = list.filter(x => matchesGovStatusFilter(x, filters.status));

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

    // ── Import tab (students active in other school / previous school tracking) ──
    if (mainTab === "import") {
      const dbImports = dbStudents.map(decorate).filter(x =>
        x.udiseStatus === "Active in other school" ||
        x.penStatus === "Active in other school" ||
        Boolean(x.otherSchoolData) ||
        String(x.udise || "").toLowerCase().includes("active in other school") ||
        String(x.pen || "").toLowerCase().includes("active in other school")
      );

      const grImports = [...(onlineGrDataset.primary || []), ...(onlineGrDataset.general || [])]
        .filter(r => {
          const os = parseOtherSchoolRemarks(r.remarks);
          const isOther = Boolean(os) ||
            String(r.udise || "").toLowerCase().includes("active in other school") ||
            String(r.pen || "").toLowerCase().includes("active in other school");
          return isOther && !dbImports.some(d => (r.enrollNo && d.enrollNo === r.enrollNo) || (r.grNo && d.grNo === r.grNo));
        })
        .map(r => decorate(r));

      let list = [...dbImports, ...grImports];

      if (importSubTab === "udise") {
        list = list.filter(x =>
          x.udiseStatus === "Active in other school" ||
          String(x.udise || "").toLowerCase().includes("active in other school") ||
          (x.otherSchoolData && (x.otherSchoolData.portal === "udise" || x.otherSchoolData.portal === "both" || x.otherSchoolData.udiseActive)) ||
          x.importPortal === "UDISE (State)" ||
          x.importPortal === "UDISE & PEN"
        );
      } else if (importSubTab === "pen") {
        list = list.filter(x =>
          x.penStatus === "Active in other school" ||
          String(x.pen || "").toLowerCase().includes("active in other school") ||
          (x.otherSchoolData && (x.otherSchoolData.portal === "pen" || x.otherSchoolData.portal === "both" || x.otherSchoolData.penActive)) ||
          x.importPortal === "PEN (National)" ||
          x.importPortal === "UDISE & PEN"
        );
      }

      if (filters.cls !== "All") list = list.filter(x => x.cls === filters.cls);
      if (filters.session !== "All") list = list.filter(x => x.session === filters.session);
      if (filters.status !== "All") {
        list = list.filter(x => {
          const st = importSubTab === "pen" ? x.penImportStatus : (importSubTab === "udise" ? x.udiseImportStatus : x.importStatus);
          return String(st || "").trim().toLowerCase() === filters.status.trim().toLowerCase();
        });
      }

      const q = search.trim().toLowerCase();
      if (q) {
        list = list.filter(x =>
          String(x.name || "").toLowerCase().includes(q) ||
          String(x.grNo || "").toLowerCase().includes(q) ||
          String(x.mobile1 || "").toLowerCase().includes(q) ||
          String(x.udise || "").toLowerCase().includes(q) ||
          String(x.pen || "").toLowerCase().includes(q) ||
          String(x.otherSchoolName || "").toLowerCase().includes(q) ||
          String(x.otherSchoolHm || "").toLowerCase().includes(q) ||
          String(x.otherSchoolContact || "").toLowerCase().includes(q) ||
          String(x.otherSchoolLocation || "").toLowerCase().includes(q)
        );
      }

      return list;
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
    if (filters.status !== "All") d = d.filter(x => matchesGovStatusFilter(x, filters.status));

    const rank = { Done: 0, "Not Defined": 1, "Active in other school": 2, Pending: 3 };
    return d.slice().sort((a, b) => {
      const diff = rank[a[statusKey]] - rank[b[statusKey]];
      if (diff !== 0) return diff;
      return String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true });
    });
  }, [mainTab, grSubTab, importSubTab, onlineGrDataset, dbStudents, filters, search, enrollToBatches, eligibilityFns, mismatchDir, effectiveTab, showNotDefinedOnly, eligTab, onlineGrSort, addPinnedEnrollNo]);

  const pendingNotDefinedCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Not Defined").length,
    [dbStudents]
  );
  const allImportList = useMemo(() => {
    const dbImports = dbStudents.map(decorate).filter(x =>
      x.udiseStatus === "Active in other school" ||
      x.penStatus === "Active in other school" ||
      Boolean(x.otherSchoolData) ||
      String(x.udise || "").toLowerCase().includes("active in other school") ||
      String(x.pen || "").toLowerCase().includes("active in other school")
    );

    const grImports = [...(onlineGrDataset.primary || []), ...(onlineGrDataset.general || [])].filter(r => {
      const os = parseOtherSchoolRemarks(r.remarks);
      const isOther = Boolean(os) ||
        String(r.udise || "").toLowerCase().includes("active in other school") ||
        String(r.pen || "").toLowerCase().includes("active in other school");
      return isOther && !dbImports.some(d => (r.enrollNo && d.enrollNo === r.enrollNo) || (r.grNo && d.grNo === r.grNo));
    }).map(r => decorate(r));

    return [...dbImports, ...grImports];
  }, [dbStudents, onlineGrDataset]);

  const importAllCount = allImportList.length;
  const importCount = importAllCount;

  const importUdiseCount = useMemo(() => {
    return allImportList.filter(x =>
      x.udiseStatus === "Active in other school" ||
      String(x.udise || "").toLowerCase().includes("active in other school") ||
      (x.otherSchoolData && (x.otherSchoolData.portal === "udise" || x.otherSchoolData.portal === "both" || x.otherSchoolData.udiseActive)) ||
      x.importPortal === "UDISE (State)" ||
      x.importPortal === "UDISE & PEN"
    ).length;
  }, [allImportList]);

  const importPenCount = useMemo(() => {
    return allImportList.filter(x =>
      x.penStatus === "Active in other school" ||
      String(x.pen || "").toLowerCase().includes("active in other school") ||
      (x.otherSchoolData && (x.otherSchoolData.portal === "pen" || x.otherSchoolData.portal === "both" || x.otherSchoolData.penActive)) ||
      x.importPortal === "PEN (National)" ||
      x.importPortal === "UDISE & PEN"
    ).length;
  }, [allImportList]);

  const activeOtherSchoolCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Active in other school" || x.udiseStatus === "Active in other school").length,
    [dbStudents]
  );
  const udiseActiveOtherSchoolCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.udiseStatus === "Active in other school").length,
    [dbStudents]
  );
  const penActiveOtherSchoolCount = useMemo(
    () => dbStudents.map(decorate).filter(x => x.penStatus === "Active in other school").length,
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
  const frozenCount = mainTab === "onlineGr" ? 8 : (mainTab === "import" ? 5 : (effectiveTab === "udise" ? 4 : 5));
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

  // ── Auto-scroll dynamically to end of table by default ──────────────────
  const tableContainerRef = useRef(null);
  const tableEndRef = useRef(null);
  const userScrolledUpRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 10000;
    if (tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ block: "end", inline: "nearest" });
    }
  }, []);

  // Reset userScrolledUpRef on tab/subtab/filter changes so it always scrolls to bottom
  useEffect(() => {
    userScrolledUpRef.current = false;
  }, [mainTab, grSubTab, filters]);

  // Dynamic ResizeObserver ensures as table rows layout, it follows dynamically to the end
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    scrollToEnd();

    // ResizeObserver tracks dynamic table expansion as rows are rendered
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (!userScrolledUpRef.current) {
          scrollToEnd();
        }
      });
      ro.observe(el);
      const tableEl = el.querySelector("table");
      if (tableEl) ro.observe(tableEl);
    }

    // Multi-frame backup ticks to guarantee 100% layout completion across all browsers
    const t1 = setTimeout(scrollToEnd, 60);
    const t2 = setTimeout(scrollToEnd, 160);
    const t3 = setTimeout(scrollToEnd, 350);
    const t4 = setTimeout(scrollToEnd, 650);

    return () => {
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [rows, mainTab, grSubTab, filters, scrollToEnd]);

  const handleTableScroll = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
    if (!isNearBottom) {
      userScrolledUpRef.current = true;
    } else {
      userScrolledUpRef.current = false;
    }
  }, []);

  // ── Entry Done modal ────────────────────────────────────────────────────
  const [modalRow, setModalRow] = useState(null);
  const modalIsDone = useMemo(() => {
    if (!modalRow) return false;
    if (mainTab === "onlineGr") {
      return modalRow.status === "Done" || Boolean(modalRow.grNo && modalRow.grNo !== "-");
    }
    if (effectiveTab === "udise") {
      return (
        modalRow.udiseStatus === "Done" ||
        modalRow.udiseStatus === "Active in other school" ||
        Boolean(modalRow.udise && String(modalRow.udise).trim() && String(modalRow.udise).trim() !== "-")
      );
    }
    return (
      modalRow.penStatus === "Done" ||
      modalRow.penStatus === "Not Defined" ||
      modalRow.penStatus === "Active in other school" ||
      Boolean(modalRow.pen && String(modalRow.pen).trim() && String(modalRow.pen).trim() !== "-")
    );
  }, [modalRow, mainTab, effectiveTab]);
  const [formGrNo, setFormGrNo] = useState("");
  const [formDoeSlash, setFormDoeSlash] = useState("");
  const [formUdise, setFormUdise] = useState("");
  const [formPen, setFormPen] = useState("");
  const [formPenNotDefined, setFormPenNotDefined] = useState(false);
  const [formActiveOtherSchool, setFormActiveOtherSchool] = useState(false);
  const [showPasteAlert, setShowPasteAlert] = useState(false);
  const [pasteAlertInput, setPasteAlertInput] = useState("");
  // UDISE Import specific fields (Gujarat State Portal: ssgujarat.org)
  const [formUdiseSchoolName, setFormUdiseSchoolName] = useState("");
  const [formUdisePrincipalName, setFormUdisePrincipalName] = useState("");
  const [formUdisePrincipalMobile, setFormUdisePrincipalMobile] = useState("");
  const [formUdiseRequestSentDate, setFormUdiseRequestSentDate] = useState("");
  const [formUdiseTcUploaded, setFormUdiseTcUploaded] = useState("Pending"); // "Uploaded" | "Pending" | "Not Required"
  const [formUdiseStatus, setFormUdiseStatus] = useState("Active in other school");
  const [formUdiseRemark, setFormUdiseRemark] = useState("");

  // PEN Import specific fields (National Portal: udiseplus.gov.in)
  const [formPenSchoolName, setFormPenSchoolName] = useState("");
  const [formPenSchoolUdise, setFormPenSchoolUdise] = useState("");
  const [formPenState, setFormPenState] = useState("");
  const [formPenDistrict, setFormPenDistrict] = useState("");
  const [formPenBlock, setFormPenBlock] = useState("");
  const [formPenHeadmaster, setFormPenHeadmaster] = useState("");
  const [formPenContactNo, setFormPenContactNo] = useState("");
  const [formPenStatus, setFormPenStatus] = useState("Active in other school");
  const [formPenRemark, setFormPenRemark] = useState("");

  // Backward compatibility common fields
  const [formOtherSchoolName, setFormOtherSchoolName] = useState("");
  const [formOtherSchoolUdise, setFormOtherSchoolUdise] = useState("");
  const [formOtherSchoolState, setFormOtherSchoolState] = useState("");
  const [formOtherSchoolDistrict, setFormOtherSchoolDistrict] = useState("");
  const [formOtherSchoolBlock, setFormOtherSchoolBlock] = useState("");
  const [formOtherSchoolHeadmaster, setFormOtherSchoolHeadmaster] = useState("");
  const [formOtherSchoolContactNo, setFormOtherSchoolContactNo] = useState("");
  const [formOtherSchoolStatus, setFormOtherSchoolStatus] = useState("");
  const [formOtherSchoolRemark, setFormOtherSchoolRemark] = useState("");
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
  const [addRemarks, setAddRemarks] = useState("");
  const [addCustomSection, setAddCustomSection] = useState(null);
  const addSection = (addSelectedStudent ? classSection(addSelectedStudent.cls) : null) || addCustomSection || grSubTab || "general";
  const setAddSection = useCallback((sec) => {
    setAddCustomSection(sec);
    if (sec) setGrSubTab(sec);
  }, []);
  const addReview = addSelectedStudent ? decorate(addSelectedStudent) : null;

  // Keep addRemarks synced when entering final confirmation (Step 4)
  useEffect(() => {
    if (addStep === 4 && !addRemarks && addReview?.remarks && addReview.remarks !== "-") {
      setAddRemarks(addReview.remarks);
    }
  }, [addStep, addReview?.remarks, addRemarks]);
  // GR/PR No was already asked in stage 1 — lock it during the UDISE/PEN
  // entry modals so it can't drift from what was just registered.
  const isWizardEntry = Boolean(addWizardActive && (addStep === 2 || addStep === 3));

  // ── Persistent In-Progress Wizard State (Resume Progress) ───────────────
  const [inProgressSession, setInProgressSession] = useState(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("ssis_gov_entry_wizard_progress") : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.completed) {
          clearProgressFromStorage();
        } else if (parsed?.enrollNo || parsed?.grNo || parsed?.studentName || parsed?.name) {
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

  // REQ: "if there is no active entry then no need to show resume button"
  // Determines if an in-progress session represents a genuinely pending/active entry.
  // NOTE: In online_general_register table, row.status represents GR registration.
  // A government entry is only fully completed when BOTH UDISE and PEN are done.
  const hasActiveSession = useMemo(() => {
    if (!inProgressSession || inProgressSession.completed) return false;

    const gr = inProgressSession.grNo ? String(inProgressSession.grNo).trim() : "";
    const name = inProgressSession.studentName || inProgressSession.name;
    const enrollNo = inProgressSession.enrollNo;

    if (!gr && !name && !enrollNo) return false;

    // If this student is already present in the register and BOTH UDISE and PEN are completed,
    // they are not an active entry.
    const allRows = [
      ...(onlineGrDataset?.primary || []),
      ...(onlineGrDataset?.general || []),
    ].filter(Boolean);

    const normName = name ? String(name).trim().toUpperCase() : "";
    const match = allRows.find(r => {
      if (!r) return false;
      if (enrollNo && enrollNo !== "-" && r.enrollNo && r.enrollNo === enrollNo) return true;
      if (inProgressSession.createdRowId && r.id && r.id === inProgressSession.createdRowId) return true;
      if (gr && gr !== "-" && r.grNo && (r.grNo === gr || parseGrNum(r.grNo) === parseGrNum(gr))) {
        if (!normName) return true;
        const rName = String(r.name || "").trim().toUpperCase();
        if (rName === normName) return true;
      }
      if (normName && inProgressSession.cls) {
        const rName = String(r.name || "").trim().toUpperCase();
        if (rName === normName && r.cls === inProgressSession.cls) return true;
      }
      return false;
    });

    if (match) {
      const u = String(match.udise || "").trim();
      const hasU = match.udiseStatus === "Done" ||
        match.udiseStatus === "Active in other school" ||
        (u !== "" && u !== "-" && u !== "Pending");

      const p = String(match.pen || "").trim();
      const hasP = match.penStatus === "Done" ||
        match.penStatus === "Not Defined" ||
        match.penStatus === "Active in other school" ||
        p === "Not Defined" ||
        (p !== "" && p !== "-" && p !== "Pending");

      // Only if BOTH UDISE and PEN are completed is this student finished
      if (hasU && hasP) {
        return false;
      }
    }

    return true;
  }, [inProgressSession, onlineGrDataset]);

  // Clean up completed session from localStorage ONLY if already fully Done (both UDISE & PEN)
  useEffect(() => {
    if (inProgressSession && !inProgressSession.completed) {
      const allRows = [
        ...(onlineGrDataset?.primary || []),
        ...(onlineGrDataset?.general || []),
      ].filter(Boolean);
      if (allRows.length === 0) return;

      const gr = inProgressSession.grNo ? String(inProgressSession.grNo).trim() : "";
      const name = inProgressSession.studentName || inProgressSession.name;
      const enrollNo = inProgressSession.enrollNo;
      const normName = name ? String(name).trim().toUpperCase() : "";

      const match = allRows.find(r => {
        if (!r) return false;
        if (enrollNo && enrollNo !== "-" && r.enrollNo && r.enrollNo === enrollNo) return true;
        if (inProgressSession.createdRowId && r.id && r.id === inProgressSession.createdRowId) return true;
        if (gr && gr !== "-" && r.grNo && (r.grNo === gr || parseGrNum(r.grNo) === parseGrNum(gr))) {
          if (!normName) return true;
          const rName = String(r.name || "").trim().toUpperCase();
          if (rName === normName) return true;
        }
        if (normName && inProgressSession.cls) {
          const rName = String(r.name || "").trim().toUpperCase();
          if (rName === normName && r.cls === inProgressSession.cls) return true;
        }
        return false;
      });

      if (match) {
        const u = String(match.udise || "").trim();
        const hasU = match.udiseStatus === "Done" ||
          match.udiseStatus === "Active in other school" ||
          (u !== "" && u !== "-" && u !== "Pending");

        const p = String(match.pen || "").trim();
        const hasP = match.penStatus === "Done" ||
          match.penStatus === "Not Defined" ||
          match.penStatus === "Active in other school" ||
          p === "Not Defined" ||
          (p !== "" && p !== "-" && p !== "Pending");

        if (hasU && hasP) {
          clearProgressFromStorage();
        }
      }
    }
  }, [inProgressSession, onlineGrDataset]);

  function resumeProgress(saved) {
    try {
      let session = saved || inProgressSession;
      if (!session && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("ssis_gov_entry_wizard_progress");
          if (raw) session = JSON.parse(raw);
        } catch {}
      }

      if (!session) {
        return;
      }

      const sSessEnroll = String(session.enrollNo || "").trim();
      const sSessId = String(session.studentId || session.id || "").trim();
      const sSessCreatedId = String(session.createdRowId || "").trim();
      const sSessGr = String(session.grNo || "").trim();
      const sSessGrNum = parseGrNum(sSessGr);
      const sSessName = String(session.studentName || session.name || "").trim().toUpperCase();

      const matchStudent = (s) => {
        if (!s) return false;
        const sEnroll = String(s.enrollNo || s.enrollment_no || "").trim();
        if (sSessEnroll && sSessEnroll !== "-" && sEnroll && sEnroll === sSessEnroll) return true;

        const sId = String(s.studentId || s.id || "").trim();
        if (sSessId && sId && sId === sSessId) return true;
        if (sSessCreatedId && sId && sId === sSessCreatedId) return true;

        const sGr = String(s.grNo || s.grno || "").trim();
        if (sSessGr && sSessGr !== "-" && sGr && sGr !== "-") {
          if (sGr === sSessGr) return true;
          if (sSessGrNum > 0 && parseGrNum(sGr) === sSessGrNum) {
            if (!sSessName) return true;
            const curName = String(s.name || `${s.firstName || s.first_name || ""} ${s.surname || s.last_name || ""}`).trim().toUpperCase();
            if (curName === sSessName) return true;
          }
        }

        if (sSessName) {
          const curName = String(s.name || `${s.firstName || s.first_name || ""} ${s.surname || s.last_name || ""}`).trim().toUpperCase();
          if (curName && curName === sSessName) return true;
        }

        return false;
      };

      // 1. Search in dbStudents
      let rawStudent = (dbStudents || []).filter(Boolean).find(matchStudent);

      // 2. If not found in dbStudents, search onlineGrDataset (both Primary and General Registers)
      if (!rawStudent) {
        const allGrRows = [
          ...(onlineGrDataset?.primary || []),
          ...(onlineGrDataset?.general || []),
        ].filter(Boolean);
        rawStudent = allGrRows.find(matchStudent);
      }

      // 3. Fallback to session.student or session itself
      if (!rawStudent && session.student) rawStudent = session.student;
      if (!rawStudent && (sSessName || sSessGr || sSessEnroll)) rawStudent = { ...session };

      if (!rawStudent) {
        alert(`Could not locate student record for ${session.studentName || session.name || session.grNo || "student"}.`);
        return;
      }

      // Ensure rawStudent has name, grNo, cls
      if (!rawStudent.name && (session.studentName || session.name)) {
        rawStudent.name = session.studentName || session.name;
      }
      if (!rawStudent.studentName && rawStudent.name) {
        rawStudent.studentName = rawStudent.name;
      }
      if (!rawStudent.grNo && sSessGr) rawStudent.grNo = sSessGr;
      if (!rawStudent.cls && session.cls) rawStudent.cls = session.cls;
      if (!rawStudent.session && session.session) rawStudent.session = session.session;
      if (!rawStudent.enrollNo && sSessEnroll) rawStudent.enrollNo = sSessEnroll;

      const student = decorate(rawStudent) || rawStudent;
      const grNo = sSessGr || student.grNo || "";
      const createdRowId = session.createdRowId || rawStudent.id || null;
      const sec = session.section || (student.cls ? classSection(student.cls) : null) || grSubTab || "general";

      const hasGr = Boolean(grNo && grNo !== "-");

      setGrSubTab(sec);
      setAddSection(sec);
      setAddSelectedStudent(student);
      setAddGrNo(grNo);
      if (session.doeSlash || student.doeSlash) setAddDoeSlash(session.doeSlash || student.doeSlash);
      const savedRemarks = session.remarks || student.remarks || "";
      setAddRemarks(savedRemarks && savedRemarks !== "-" ? savedRemarks : "");
      setAddCreatedRowId(createdRowId);
      setAddStep(1);
      setAddSubPhase("details");
      setAddWizardActive(true);

      // REQ: Resuming ALWAYS opens Step 1 (student details & Reg No) so the operator
      // can review details and proceed cleanly, rather than jumping straight to PEN form or Step 4.
      setModalRow(null);
      setMainTab("onlineGr");
      setAddPinnedEnrollNo(null);
      setAddModalOpen(true);
      setAddGrEditing(!hasGr);
      setAddDoeEditing(false);

      saveProgressToStorage({
        ...session,
        enrollNo: student.enrollNo || sSessEnroll || "",
        studentId: student.studentId || student.id || sSessId,
        grNo,
        step: 1,
        subPhase: "details",
        createdRowId,
        section: sec,
        studentName: student.name,
        name: student.name,
        cls: student.cls,
        session: student.session || "",
        doeSlash: session.doeSlash || student.doeSlash || getTodaySlash(),
        remarks: savedRemarks,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Error in resumeProgress:", err);
      alert("Failed to resume session: " + (err?.message || "Unknown error"));
    }
  }

  // Resume entry workflow for the last row or any student row from Online GR
  function resumeFromOnlineGrRow(row, sectionHint) {
    if (!row) return;
    try {
      const cleanDbStudents = (dbStudents || []).filter(Boolean);
      const rowName = String(row.name || "").trim().toUpperCase();
      let rawStudent = cleanDbStudents.find(
        s => (row.enrollNo && s.enrollNo === row.enrollNo) ||
             (row.aadharNo && row.aadharNo !== "-" && s.aadharNo === row.aadharNo) ||
             (row.mobile1 && row.mobile1 !== "-" && s.mobile1 === row.mobile1) ||
             (rowName && s.name && String(s.name).trim().toUpperCase() === rowName && s.cls === row.cls) ||
             (rowName && `${s.firstName || s.first_name || ""} ${s.surname || s.last_name || ""}`.trim().toUpperCase() === rowName)
      );

      if (!rawStudent) {
        const allGr = [...(onlineGrDataset?.primary || []), ...(onlineGrDataset?.general || [])].filter(Boolean);
        rawStudent = allGr.find(r => r.id === row.id || (row.grNo && r.grNo === row.grNo)) || row;
      }

      const student = decorate(rawStudent) || rawStudent;
      const grNo = row.grNo || student.grNo || "";
      const createdRowId = row.id || student.id || null;
      const sec = sectionHint || row.section || (student.cls ? classSection(student.cls) : null) || grSubTab || "general";

      // ALWAYS start from Step 1 of the Add New Student wizard
      const step = 1;

      const sessionData = {
        enrollNo: student.enrollNo || row.enrollNo || "",
        studentId: student.studentId || student.id || row.studentId || row.id,
        grNo,
        step: 1,
        subPhase: "details",
        createdRowId,
        section: sec,
        studentName: student.name || row.name,
        name: student.name || row.name,
        cls: student.cls || row.cls,
        session: student.session || row.session || "",
        doeSlash: row.doeSlash || student.doeSlash || getTodaySlash(),
        remarks: row.remarks || student.remarks || "",
        timestamp: Date.now(),
      };

      saveProgressToStorage(sessionData);
      resumeProgress(sessionData);
    } catch (err) {
      console.error("Error in resumeFromOnlineGrRow:", err);
      alert("Failed to resume from row: " + (err?.message || "Unknown error"));
    }
  }

  // Opens entry workflow for the last student row (Primary or 1st+)
  function openLastStudentForm(lastInfo, section) {
    if (!lastInfo) return;
    const targetRow = lastInfo.row || lastInfo.student || lastInfo;
    if (!targetRow) return;
    resumeFromOnlineGrRow(targetRow, section);
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
    setAddRemarks("");
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

  // Navigate back to Step 1 (Select Student & Reg No) from Step 2 (UDISE) or anytime
  function goBackToAddStep1() {
    setAddStep(1);
    setAddSubPhase("details");
    setMainTab("onlineGr");
    const sec = addSection || (addSelectedStudent ? classSection(addSelectedStudent.cls) : grSubTab) || "general";
    if (sec) {
      setGrSubTab(sec);
      setAddSection(sec);
    }
    setAddPinnedEnrollNo(null);
    setAddModalOpen(true);
    setAddGrEditing(false);
    setAddDoeEditing(false);
    setAddError("");
    if (addSelectedStudent) {
      saveProgressToStorage({
        enrollNo: addSelectedStudent.enrollNo,
        studentId: addSelectedStudent.studentId || addSelectedStudent.id,
        grNo: addGrNo ? addGrNo.trim() : "",
        doeSlash: addDoeSlash,
        remarks: addRemarks,
        step: 1,
        subPhase: "details",
        createdRowId: addCreatedRowId,
        section: sec,
        studentName: addSelectedStudent.name,
        cls: addSelectedStudent.cls,
        session: addSelectedStudent.session || "",
        timestamp: Date.now(),
      });
    }
  }

  // Navigate back to Step 2 (UDISE Entry) from Step 3 (PEN Entry)
  function goBackToAddStep2() {
    setAddStep(2);
    setMainTab("udise");
    setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
    if (addSelectedStudent) {
      setEligTab(eligibilityFns.udiseEligible(addSelectedStudent) ? "eligible" : "ineligible");
      setAddPinnedEnrollNo(addSelectedStudent.enrollNo);
    }
    setSearch("");
    setAddModalOpen(false);
    setAddWizardActive(true);
    const sec = addSection || (addSelectedStudent ? classSection(addSelectedStudent.cls) : grSubTab) || "general";
    if (sec) setAddSection(sec);
    setModalRow(null);
    setAddSubPhase("details");
    if (addSelectedStudent) {
      saveProgressToStorage({
        enrollNo: addSelectedStudent.enrollNo,
        studentId: addSelectedStudent.studentId || addSelectedStudent.id,
        grNo: addGrNo ? addGrNo.trim() : "",
        doeSlash: addDoeSlash,
        remarks: addRemarks,
        step: 2,
        subPhase: "details",
        createdRowId: addCreatedRowId,
        section: sec,
        studentName: addSelectedStudent.name,
        cls: addSelectedStudent.cls,
        session: addSelectedStudent.session || "",
        timestamp: Date.now(),
      });
    }
  }

  // Navigate back to Step 3 (PEN Entry) from Step 4 (Final Confirmation)
  function goBackToAddStep3() {
    setAddStep(3);
    setMainTab("pen");
    setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
    if (addSelectedStudent) {
      setEligTab(eligibilityFns.penEligible(addSelectedStudent) ? "eligible" : "ineligible");
      setAddPinnedEnrollNo(addSelectedStudent.enrollNo);
    }
    setSearch("");
    setAddModalOpen(false);
    setAddWizardActive(true);
    const sec = addSection || (addSelectedStudent ? classSection(addSelectedStudent.cls) : grSubTab) || "general";
    if (sec) setAddSection(sec);
    setModalRow(null);
    setAddSubPhase("details");
    if (addSelectedStudent) {
      saveProgressToStorage({
        enrollNo: addSelectedStudent.enrollNo,
        studentId: addSelectedStudent.studentId || addSelectedStudent.id,
        grNo: addGrNo ? addGrNo.trim() : "",
        doeSlash: addDoeSlash,
        remarks: addRemarks,
        step: 3,
        subPhase: "details",
        createdRowId: addCreatedRowId,
        section: sec,
        studentName: addSelectedStudent.name,
        cls: addSelectedStudent.cls,
        session: addSelectedStudent.session || "",
        timestamp: Date.now(),
      });
    }
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

  function getTcDoc(st) {
    if (!st) return null;
    const docs = st.studentDocuments || st.student_documents || [];
    return docs.find(
      d => (d.document_types?.name === "Leaving Certificate" || d.document_types?.name === "Transfer Certificate") &&
           (d.status === "Uploaded" || Boolean(d.file_url))
    ) || null;
  }

  async function handleDownloadTcDoc(st) {
    if (!st) return;
    try {
      const studentId = st.studentId || st.id;
      let tcDoc = getTcDoc(st);
      let fileKey = tcDoc?.file_url;

      if (!fileKey && studentId) {
        const { data } = await supabase
          .from("student_documents")
          .select("file_url, status, document_types!inner(name)")
          .eq("student_id", studentId)
          .eq("document_types.name", "Leaving Certificate")
          .maybeSingle();

        if (data?.status === "Uploaded" && data?.file_url) {
          fileKey = data.file_url;
        }
      }

      if (!fileKey) {
        alert("No Leaving Certificate / TC file found to download. Please upload it in Documents.");
        return;
      }

      const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
      const downloadName = buildDocDownloadName(st.enrollNo, st.name, "Leaving_Certificate", fileKey);
      const url = await getS3ViewUrl(fileKey, downloadName);

      if (url) {
        if (win) {
          win.location.href = url;
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.download = downloadName || "Leaving_Certificate";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        if (win) win.close();
        alert("Failed to generate download URL for Leaving Certificate.");
      }
    } catch (err) {
      console.error("Download Leaving Certificate error:", err);
      alert(err.message || "Failed to download Leaving Certificate.");
    }
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

  function applyParsedAlert(parsed, targetMode = "udise") {
    if (!parsed) return false;
    let filledCount = 0;
    if (parsed.schoolName) {
      if (targetMode === "udise") setFormUdiseSchoolName(parsed.schoolName);
      if (targetMode === "pen") setFormPenSchoolName(parsed.schoolName);
      setFormOtherSchoolName(parsed.schoolName);
      filledCount++;
    }
    if (parsed.headmaster) {
      if (targetMode === "udise") setFormUdisePrincipalName(parsed.headmaster);
      if (targetMode === "pen") setFormPenHeadmaster(parsed.headmaster);
      setFormOtherSchoolHeadmaster(parsed.headmaster);
      filledCount++;
    }
    if (parsed.contactNo) {
      if (targetMode === "udise") setFormUdisePrincipalMobile(parsed.contactNo);
      if (targetMode === "pen") setFormPenContactNo(parsed.contactNo);
      setFormOtherSchoolContactNo(parsed.contactNo);
      filledCount++;
    }
    if (parsed.uid) {
      if (targetMode === "udise") {
        setFormUdise(parsed.uid);
      } else {
        setFormPen(parsed.uid);
        setFormPenNotDefined(false);
      }
      filledCount++;
    }
    if (parsed.district) {
      setFormPenDistrict(parsed.district);
      setFormOtherSchoolDistrict(parsed.district);
    }
    if (parsed.block) {
      setFormPenBlock(parsed.block);
      setFormOtherSchoolBlock(parsed.block);
    }
    if (parsed.schoolUdise) {
      setFormPenSchoolUdise(parsed.schoolUdise);
      setFormOtherSchoolUdise(parsed.schoolUdise);
    }
    if (targetMode === "udise" && !formUdiseRequestSentDate) {
      setFormUdiseRequestSentDate(getTodaySlash());
    }
    if (formError) setFormError("");
    return filledCount > 0;
  }

  function renderActiveOtherSchoolFields() {
    if (!formActiveOtherSchool) return null;
    const isUdiseView = (effectiveTab === "udise");

    if (isUdiseView) {
      return (
        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-3 mt-2 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-purple-200/70 pb-2">
            <div className="flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                UDISE Import Details (State Portal)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPasteAlert(v => !v)}
              className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2.5 py-0.5 rounded-md border border-purple-200 transition-colors"
            >
              📋 {showPasteAlert ? "Hide Quick Paste" : "Paste Portal Alert"}
            </button>
          </div>

          {showPasteAlert && (
            <div className="bg-white border border-purple-200 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                  Paste portal alert message (from ssgujarat.org):
                </label>
                <span className="text-[9px] text-gray-400">Auto-extracts school, HM, contact, UID</span>
              </div>
              <textarea
                rows={3}
                value={pasteAlertInput}
                onChange={e => setPasteAlertInput(e.target.value)}
                placeholder="Paste alert text (e.g. 'DISTRICT: SURAT, BLOCK: SURAT CORPO., SCHOOL: SUNFLOWER ENGLISH SCHOOL, PRINCIPLE NAME: ...')"
                className="w-full text-xs border border-purple-200 rounded-md p-2 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500">
                  Tip: Supports Gujarati/English alert text, single-line or multi-line
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parsePortalAlertText(pasteAlertInput);
                    const success = applyParsedAlert(parsed, "udise");
                    if (success) {
                      setShowPasteAlert(false);
                      setPasteAlertInput("");
                    } else {
                      setFormError("Could not detect School Name or details from the pasted alert. Please verify format.");
                    }
                  }}
                  disabled={!pasteAlertInput.trim()}
                  className="text-xs font-semibold px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  Auto-fill UDISE Fields
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. SCHOOL NAME */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                School Name (Active In) *
              </label>
              <input
                type="text"
                value={formUdiseSchoolName}
                onPaste={e => {
                  const pasteText = e.clipboardData?.getData("text") || "";
                  if (/DISTRICT|BLOCK|PRINCIP|ssgujarat|UID|માં\s*છે|SCHOOL\s*[:：\-]/i.test(pasteText)) {
                    const parsed = parsePortalAlertText(pasteText);
                    if (parsed && (parsed.schoolName || parsed.headmaster || parsed.contactNo || parsed.uid)) {
                      e.preventDefault();
                      applyParsedAlert(parsed, "udise");
                    }
                  }
                }}
                onChange={e => {
                  const val = e.target.value;
                  if (/DISTRICT:|BLOCK:|PRINCIP|ssgujarat|UID:|માં\s*છે/i.test(val)) {
                    const parsed = parsePortalAlertText(val);
                    if (parsed && (parsed.schoolName || parsed.headmaster || parsed.contactNo || parsed.uid)) {
                      applyParsedAlert(parsed, "udise");
                      return;
                    }
                  }
                  setFormUdiseSchoolName(val);
                  setFormOtherSchoolName(val);
                  if (formError) setFormError("");
                }}
                placeholder="e.g. SUNFLOWER ENGLISH SCHOOL"
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            {/* 2. PRINCIPAL NAME */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Principal Name
              </label>
              <input
                type="text"
                value={formUdisePrincipalName}
                onChange={e => setFormUdisePrincipalName(e.target.value)}
                placeholder="e.g. Singh Brijesh Deviprasad"
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            {/* 3. PRINCIPAL MOBILE NO */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Principal Mobile No
              </label>
              <input
                type="text"
                value={formUdisePrincipalMobile}
                onChange={e => setFormUdisePrincipalMobile(e.target.value.replace(/[^\d]/g, ""))}
                maxLength={10}
                placeholder="e.g. 9913010277"
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            {/* 4. STUDENT UID */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider flex items-center justify-between">
                <span>Student UID (18 Digits)</span>
                <span className="text-[9px] text-gray-500 font-normal">State portal UID from alert</span>
              </label>
              <input
                type="text"
                value={formUdise}
                onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                maxLength={18}
                placeholder="e.g. 242215313052520157"
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            {/* 5. REQUEST SENT DATE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                  Request Sent Date
                </label>
                <button
                  type="button"
                  onClick={() => setFormUdiseRequestSentDate(getTodaySlash())}
                  className="text-[9px] font-semibold text-purple-700 hover:underline"
                >
                  Today ({getTodaySlash()})
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={formUdiseRequestSentDate}
                  onChange={e => setFormUdiseRequestSentDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="flex-1 border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
                <input
                  type="date"
                  value={slashToIso(formUdiseRequestSentDate)}
                  onChange={e => {
                    if (e.target.value) setFormUdiseRequestSentDate(isoToSlash(e.target.value));
                  }}
                  className="w-8 border border-purple-200 rounded-lg p-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                  title="Pick date"
                />
              </div>
            </div>

            {/* 6. TC UPLOADED OR NOT (Auto-detected from student documents - no dropdown) */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                TC Uploaded or Not
              </label>
              <div className="flex items-center justify-between gap-2 border border-purple-200 rounded-lg px-3 py-2 bg-white min-h-[38px]">
                {getTcDoc(modalRow) ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Uploaded
                    </span>
                    <span className="text-[10px] text-gray-500 hidden sm:inline">Auto-verified in Documents</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Not Uploaded
                    </span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">No Leaving Certificate file found</span>
                  </div>
                )}
                {getTcDoc(modalRow) && (
                  <button
                    type="button"
                    onClick={() => handleDownloadTcDoc(modalRow)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex-shrink-0 cursor-pointer"
                    title="View / Download Leaving Certificate (TC)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View / Download TC</span>
                  </button>
                )}
              </div>
            </div>

            {/* 7. STATUS */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Status
              </label>
              <select
                value={formUdiseStatus || "Active in other school"}
                onChange={e => setFormUdiseStatus(e.target.value)}
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium"
              >
                {IMPORT_STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                {formUdiseStatus && !IMPORT_STATUS_OPTIONS.includes(formUdiseStatus) && (
                  <option value={formUdiseStatus}>{formUdiseStatus}</option>
                )}
              </select>
            </div>

            {/* 8. REMARK */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Remark
              </label>
              <input
                type="text"
                value={formUdiseRemark}
                onChange={e => setFormUdiseRemark(e.target.value)}
                placeholder="e.g. Spoke with HM, will release tomorrow"
                className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>
          </div>
        </div>
      );
    }

    // PEN Import View (National Portal: udiseplus.gov.in)
    return (
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-3 mt-2 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-purple-200/70 pb-2">
          <div className="flex items-center gap-1.5">
            <IdCard className="w-4 h-4 text-purple-700" />
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
              PEN Import Details (National Portal)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPasteAlert(v => !v)}
            className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-2.5 py-0.5 rounded-md border border-purple-200 transition-colors"
          >
            📋 {showPasteAlert ? "Hide Quick Paste" : "Paste Portal Alert"}
          </button>
        </div>

        {showPasteAlert && (
          <div className="bg-white border border-purple-200 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                Paste portal alert or details text:
              </label>
              <span className="text-[9px] text-gray-400">Auto-extracts school, UDISE code, HM, contact</span>
            </div>
            <textarea
              rows={3}
              value={pasteAlertInput}
              onChange={e => setPasteAlertInput(e.target.value)}
              placeholder="Paste alert or school details (e.g. 'DISTRICT: SURAT, SCHOOL: SUNFLOWER ENGLISH SCHOOL (24221504426)...')"
              className="w-full text-xs border border-purple-200 rounded-md p-2 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500">
                Tip: Supports Gujarati/English text with school name, UDISE code, HM, mobile
              </span>
              <button
                type="button"
                onClick={() => {
                  const parsed = parsePortalAlertText(pasteAlertInput);
                  const success = applyParsedAlert(parsed, "pen");
                  if (success) {
                    setShowPasteAlert(false);
                    setPasteAlertInput("");
                  } else {
                    setFormError("Could not detect School Name or details from the pasted text. Please verify format.");
                  }
                }}
                disabled={!pasteAlertInput.trim()}
                className="text-xs font-semibold px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-md transition-colors disabled:opacity-50"
              >
                Auto-fill PEN Fields
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. SCHOOL NAME */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              School Name *
            </label>
            <input
              type="text"
              value={formPenSchoolName}
              onPaste={e => {
                const pasteText = e.clipboardData?.getData("text") || "";
                if (/DISTRICT|BLOCK|PRINCIP|ssgujarat|UID|udiseplus|SCHOOL\s*[:：\-]/i.test(pasteText)) {
                  const parsed = parsePortalAlertText(pasteText);
                  if (parsed && (parsed.schoolName || parsed.headmaster || parsed.contactNo || parsed.schoolUdise)) {
                    e.preventDefault();
                    applyParsedAlert(parsed, "pen");
                  }
                }
              }}
              onChange={e => {
                const val = e.target.value;
                if (/DISTRICT:|BLOCK:|PRINCIP|ssgujarat|udiseplus/i.test(val)) {
                  const parsed = parsePortalAlertText(val);
                  if (parsed && (parsed.schoolName || parsed.headmaster || parsed.contactNo || parsed.schoolUdise)) {
                    applyParsedAlert(parsed, "pen");
                    return;
                  }
                }
                setFormPenSchoolName(val);
                setFormOtherSchoolName(val);
                if (formError) setFormError("");
              }}
              placeholder="e.g. Shree Swaminarayan Gurukul"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 2. SCHOOL UDISE */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              School UDISE
            </label>
            <input
              type="text"
              value={formPenSchoolUdise}
              onChange={e => { setFormPenSchoolUdise(e.target.value.replace(/[^\d]/g, "")); if (formError) setFormError(""); }}
              maxLength={18}
              placeholder="e.g. 24221504426"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 3. STATE */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              State
            </label>
            <input
              type="text"
              value={formPenState}
              onChange={e => setFormPenState(e.target.value)}
              placeholder="e.g. Gujarat"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 4. DISTRICT */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              District
            </label>
            <input
              type="text"
              value={formPenDistrict}
              onChange={e => setFormPenDistrict(e.target.value)}
              placeholder="e.g. Surat"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 5. BLOCK */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              Block
            </label>
            <input
              type="text"
              value={formPenBlock}
              onChange={e => setFormPenBlock(e.target.value)}
              placeholder="e.g. Choryasi"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 6. HEADMASTER */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              Headmaster
            </label>
            <input
              type="text"
              value={formPenHeadmaster}
              onChange={e => setFormPenHeadmaster(e.target.value)}
              placeholder="Principal / HM Name"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 7. CONTACT NO */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              Contact No
            </label>
            <input
              type="text"
              value={formPenContactNo}
              onChange={e => setFormPenContactNo(e.target.value.replace(/[^\d]/g, ""))}
              maxLength={10}
              placeholder="e.g. 9825100000"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* 8. STATUS */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              Status
            </label>
            <select
              value={formPenStatus || "Active in other school"}
              onChange={e => setFormPenStatus(e.target.value)}
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-medium"
            >
              {IMPORT_STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              {formPenStatus && !IMPORT_STATUS_OPTIONS.includes(formPenStatus) && (
                <option value={formPenStatus}>{formPenStatus}</option>
              )}
            </select>
          </div>

          {/* 9. REMARK */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
              Remark
            </label>
            <input
              type="text"
              value={formPenRemark}
              onChange={e => setFormPenRemark(e.target.value)}
              placeholder="Remark regarding other school record"
              className="border border-purple-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
        </div>
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
    const existingRemarks = existingRow?.remarks && existingRow.remarks !== "-"
      ? String(existingRow.remarks).trim()
      : (st.remarks && st.remarks !== "-" ? String(st.remarks).trim() : "");

    const lastInfo = getLastSavedGrInfo(sec, onlineGrDataset, dbStudents);
    const nextGr = lastInfo ? getNextGrNo(lastInfo.grNo) : "";

    setAddSelectedStudent(st);
    setAddCreatedRowId(existingRow ? existingRow.id : null);
    setAddGrNo(existingGr || nextGr || "");
    setAddGrEditing(!existingGr && !nextGr);
    setAddDoeSlash(existingDoe);
    setAddDoeEditing(false);
    setAddRemarks(existingRemarks);
    setAddError("");

    saveProgressToStorage({
      enrollNo: st.enrollNo,
      studentId: st.studentId || st.id,
      name: st.name,
      studentName: st.name,
      cls: st.cls,
      session: st.session || "",
      section: sec,
      step: 1,
      grNo: existingGr || nextGr || "",
      doeSlash: existingDoe,
      subPhase: "details",
      createdRowId: existingRow ? existingRow.id : null,
      remarks: existingRemarks,
      timestamp: Date.now(),
    });
  }

  function changeAddStudent() {
    setAddSelectedStudent(null);
    setAddCreatedRowId(null);
    setAddGrNo("");
    setAddGrEditing(false);
    setAddDoeSlash(getTodaySlash());
    setAddDoeEditing(false);
    setAddRemarks("");
    setAddError("");
    setAddWizardActive(false);
    clearProgressFromStorage();
  }

  // Stage 1 — create/update the Online GR row right away, then hand off to
  // the real UDISE Entry tab's own Entry Done modal for this student.
  async function saveStep1AndContinue(forceTarget) {
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

      const baseRemarks = addRemarks.trim() || (dec.remarks && dec.remarks !== "-" ? dec.remarks : "");
      const remarksToSave = ineligRemark
        ? (baseRemarks && baseRemarks !== "-" ? `${baseRemarks} | ${ineligRemark}` : ineligRemark)
        : (baseRemarks || "-");

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
      setAddRemarks(remarksToSave !== "-" ? remarksToSave : "");
      setAddSelectedStudent(prev => prev ? { ...prev, ...dec, grNo: addGrNo.trim(), remarks: remarksToSave } : prev);
      setOnlineGrDataset(prev => {
        const list = prev[addSection] || [];
        const idx = list.findIndex(r => r.id === finalId);
        const nextList = idx >= 0 ? list.map(r => r.id === finalId ? created : r) : [...list, created];
        return { ...prev, [addSection]: nextList };
      });

      const hasUdise = Boolean(
        (addSelectedStudent.udise && addSelectedStudent.udise !== "-" && addSelectedStudent.udise !== "Active in other school" && addSelectedStudent.udise !== "Pending") ||
        addSelectedStudent.udiseStatus === "Done"
      );

      const targetStep = forceTarget === "pen"
        ? "pen"
        : forceTarget === "udise"
        ? "udise"
        : (udiseInfo.eligible ? (hasUdise && penInfo.eligible ? "pen" : "udise") : (penInfo.eligible ? "pen" : "ineligible"));

      // Hand off depending on target step & eligibility:
      if (targetStep === "udise") {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo.trim(),
          doeSlash: normSlashDate(addDoeSlash) || getTodaySlash(),
          remarks: remarksToSave !== "-" ? remarksToSave : "",
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
      } else if (targetStep === "pen") {
        saveProgressToStorage({
          enrollNo: addSelectedStudent.enrollNo,
          studentId: addSelectedStudent.studentId || addSelectedStudent.id,
          grNo: addGrNo.trim(),
          doeSlash: normSlashDate(addDoeSlash) || getTodaySlash(),
          remarks: remarksToSave !== "-" ? remarksToSave : "",
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
    const currRemarks = addRemarks.trim() || (addSelectedStudent.remarks && addSelectedStudent.remarks !== "-" ? addSelectedStudent.remarks : "");
    const nextRemarks = currRemarks.includes("Ineligible for UDISE") ? currRemarks : (currRemarks ? `${currRemarks} | ${remarkToAdd}` : remarkToAdd);

    try {
      const created = await updateOnlineGrRow(addCreatedRowId, addSection, {
        remarks: nextRemarks,
      });
      setAddRemarks(nextRemarks);
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
          remarks: nextRemarks,
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
          remarks: nextRemarks,
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

      // Silent background sync
      loadAll();
    } catch (e) {
      alert("Failed to update remarks: " + e.message);
    }
  }

  // Skip PEN entry when student is not eligible — updates remarks with reason and moves to finalize
  async function skipPenStep() {
    if (!addCreatedRowId || !addSection || !addSelectedStudent) return;
    const penInfo = eligibilityFns.getPenEligibility(addSelectedStudent);
    const remarkToAdd = `Ineligible for PEN: ${penInfo.reason}`;
    const currRemarks = addRemarks.trim() || (addSelectedStudent.remarks && addSelectedStudent.remarks !== "-" ? addSelectedStudent.remarks : "");
    const nextRemarks = currRemarks.includes("Ineligible for PEN") ? currRemarks : (currRemarks ? `${currRemarks} | ${remarkToAdd}` : remarkToAdd);

    try {
      const created = await updateOnlineGrRow(addCreatedRowId, addSection, {
        remarks: nextRemarks,
      });
      setAddRemarks(nextRemarks);
      setAddSelectedStudent(prev => prev ? { ...prev, remarks: nextRemarks } : prev);
      setOnlineGrDataset(prev => ({
        ...prev,
        [addSection]: (prev[addSection] || []).map(r => r.id === created.id ? created : r),
      }));

      saveProgressToStorage({
        enrollNo: addSelectedStudent.enrollNo,
        studentId: addSelectedStudent.studentId || addSelectedStudent.id,
        grNo: addGrNo,
        remarks: nextRemarks,
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

  // Stage 4 — final confirmation: push the (now-filled) UDISE/PEN values,
  // editable remarks, and recomputed Documents Pending back onto the Online GR row.
  async function finalizeAdd() {
    const targetId = addCreatedRowId || addSelectedStudent?.id;
    const targetSection = addSection || (addSelectedStudent ? classSection(addSelectedStudent.cls) : null) || grSubTab || "general";
    if (!targetId || !targetSection) {
      setAddModalOpen(false);
      setAddWizardActive(false);
      clearProgressFromStorage();
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      const dec = decorate(addSelectedStudent);
      const chosenDoe = normSlashDate(addDoeSlash) || getTodaySlash();
      const cleanRemarks = stripOtherSchoolTag(addRemarks);
      const otherSchoolData = parseOtherSchoolRemarks(addSelectedStudent?.remarks || dec.remarks) || addReview?.otherSchoolData;
      const finalRemarks = otherSchoolData
        ? buildCombinedRemarks(cleanRemarks, otherSchoolData)
        : (cleanRemarks || addSelectedStudent.remarks || dec.remarks || "-");

      const updatePromises = [
        updateOnlineGrRow(targetId, targetSection, {
          doeSlash:         chosenDoe,
          udise:            addSelectedStudent.udise || "-",
          pen:              addSelectedStudent.pen || "-",
          remarks:          finalRemarks,
          documentsPending: dec.documentsPending,
        })
      ];

      const studentId = addSelectedStudent.studentId || addSelectedStudent.id;
      if (studentId) {
        updatePromises.push(
          updateStudentGovId(studentId, {
            remarks: finalRemarks !== "-" ? finalRemarks : null,
            enrollmentId: addSelectedStudent.enrollmentId,
          }).catch(govErr => console.warn("Could not sync remark to student table:", govErr))
        );
      }

      const [created] = await Promise.all(updatePromises);

      if (created) {
        setOnlineGrDataset(prev => ({
          ...prev,
          [targetSection]: (prev[targetSection] || []).map(r => r.id === created.id ? created : r),
        }));
      }

      // Entry is fully completed and saved to register — clear in-progress wizard session
      clearProgressFromStorage();
      setAddModalOpen(false);
      setAddWizardActive(false);

      // Background sync without blocking the UI
      loadAll();
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
      list = list.filter(x => matchesGovStatusFilter(x, addStatusFilter));
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
    if (!row) return;
    const fullRow = row.birthYear !== undefined ? row : (decorate(row) || row);
    setModalRow(fullRow);
    if (mainTab === "import") {
      const mode = importSubTab === "pen"
        ? "pen"
        : (importSubTab === "udise" ? "udise" : (fullRow.importPortal === "PEN (National)" ? "pen" : "udise"));
      setImportModalMode(mode);
    }
    setFormGrNo(fullRow.grNo && fullRow.grNo !== "-" ? fullRow.grNo : "");
    setFormDoeSlash(fullRow.doeSlash && fullRow.doeSlash !== "-" ? fullRow.doeSlash : getTodaySlash());

    // REQ: Track this student as in-progress session if entry is not already fully completed
    const hasU = Boolean(
      (fullRow.udise && fullRow.udise !== "-" && fullRow.udise !== "Pending" && fullRow.udise !== "Active in other school") ||
      fullRow.udiseStatus === "Done"
    );
    const hasP = Boolean(
      (fullRow.pen && fullRow.pen !== "-" && fullRow.pen !== "Pending" && fullRow.pen !== "Not Defined" && fullRow.pen !== "Active in other school") ||
      fullRow.penStatus === "Done"
    );
    const penNotDef = fullRow.pen === "Not Defined" || fullRow.penStatus === "Not Defined";
    const isCompleted = fullRow.status === "Done" || (hasU && (hasP || penNotDef));

    if (!isCompleted && !addWizardActive) {
      saveProgressToStorage({
        enrollNo: fullRow.enrollNo || "",
        studentId: fullRow.studentId || fullRow.id,
        grNo: fullRow.grNo && fullRow.grNo !== "-" ? fullRow.grNo : "",
        step: 1,
        subPhase: "details",
        createdRowId: fullRow.id || null,
        section: fullRow.section || (fullRow.cls ? classSection(fullRow.cls) : null) || grSubTab || "general",
        studentName: fullRow.name,
        name: fullRow.name,
        cls: fullRow.cls,
        session: fullRow.session || "",
        doeSlash: fullRow.doeSlash || getTodaySlash(),
        remarks: fullRow.remarks || "",
        timestamp: Date.now(),
      });
    }

    const isUdiseOtherSchool = fullRow.udise === "Active in other school" || fullRow.udiseStatus === "Active in other school";
    setFormUdise(
      fullRow.udise && fullRow.udise !== "-" && fullRow.udise !== "Active in other school"
        ? fullRow.udise
        : ""
    );

    const isPenOtherSchool = fullRow.pen === "Active in other school" || fullRow.penStatus === "Active in other school";
    setFormPen(
      fullRow.pen && fullRow.pen !== "-" && fullRow.pen !== "Not Defined" && fullRow.pen !== "Active in other school"
        ? fullRow.pen
        : ""
    );
    setFormPenNotDefined(fullRow.pen === "Not Defined" || fullRow.penStatus === "Not Defined");
    setFormApaar(fullRow.apaar && fullRow.apaar !== "-" ? fullRow.apaar : "");

    const rawRemarks = (fullRow.remarks && fullRow.remarks !== "-")
      ? fullRow.remarks
      : (addRemarks && addRemarks !== "-" ? addRemarks : "");
    const otherSchoolData = parseOtherSchoolRemarks(rawRemarks) || fullRow.otherSchoolData;

    const shouldOpenOtherSchool = Boolean(
      otherSchoolData ||
      (effectiveTab === "udise" && isUdiseOtherSchool) ||
      (effectiveTab === "pen" && isPenOtherSchool) ||
      (mainTab === "onlineGr" && (isUdiseOtherSchool || isPenOtherSchool)) ||
      (mainTab === "import")
    );

    const hasTcDoc = Boolean(getTcDoc(fullRow));

    if (shouldOpenOtherSchool) {
      setFormActiveOtherSchool(true);
      if (effectiveTab === "pen") setFormPenNotDefined(false);

      // UDISE Import specific fields (Gujarat State Portal: ssgujarat.org)
      setFormUdiseSchoolName(otherSchoolData?.udiseSchoolName || (otherSchoolData?.udiseActive ? otherSchoolData?.schoolName : "") || fullRow.lastSchoolName || "");
      setFormUdisePrincipalName(otherSchoolData?.udisePrincipalName || (otherSchoolData?.udiseActive ? otherSchoolData?.headmaster : "") || "");
      setFormUdisePrincipalMobile(otherSchoolData?.udisePrincipalMobile || (otherSchoolData?.udiseActive ? otherSchoolData?.contactNo : "") || "");
      if (otherSchoolData?.udiseUid && !fullRow.udise) {
        setFormUdise(otherSchoolData.udiseUid);
      }
      setFormUdiseRequestSentDate(otherSchoolData?.udiseRequestSentDate || "");
      setFormUdiseTcUploaded(hasTcDoc ? "Uploaded" : "Not Uploaded");
      setFormUdiseStatus(otherSchoolData?.udiseStatus || (otherSchoolData?.udiseActive ? otherSchoolData?.status : "") || "Active in other school");
      setFormUdiseRemark(otherSchoolData?.udiseRemark || (otherSchoolData?.udiseActive ? otherSchoolData?.remark : "") || "");

      // PEN Import specific fields (National Portal: udiseplus.gov.in)
      setFormPenSchoolName(otherSchoolData?.penSchoolName || (otherSchoolData?.penActive ? otherSchoolData?.schoolName : "") || fullRow.lastSchoolName || "");
      setFormPenSchoolUdise(otherSchoolData?.penSchoolUdise || otherSchoolData?.schoolUdise || "");
      setFormPenState(otherSchoolData?.penState || otherSchoolData?.state || "");
      setFormPenDistrict(otherSchoolData?.penDistrict || otherSchoolData?.district || "");
      setFormPenBlock(otherSchoolData?.penBlock || otherSchoolData?.block || "");
      setFormPenHeadmaster(otherSchoolData?.penHeadmaster || (otherSchoolData?.penActive ? otherSchoolData?.headmaster : "") || "");
      setFormPenContactNo(otherSchoolData?.penContactNo || (otherSchoolData?.penActive ? otherSchoolData?.contactNo : "") || "");
      setFormPenStatus(otherSchoolData?.penStatus || (otherSchoolData?.penActive ? otherSchoolData?.status : "") || "Active in other school");
      setFormPenRemark(otherSchoolData?.penRemark || (otherSchoolData?.penActive ? otherSchoolData?.remark : "") || "");

      // Common / backward compatibility fields
      setFormOtherSchoolName(otherSchoolData?.schoolName || fullRow.lastSchoolName || "");
      setFormOtherSchoolUdise(otherSchoolData?.schoolUdise || "");
      setFormOtherSchoolState(otherSchoolData?.state || "");
      setFormOtherSchoolDistrict(otherSchoolData?.district || "");
      setFormOtherSchoolBlock(otherSchoolData?.block || "");
      setFormOtherSchoolHeadmaster(otherSchoolData?.headmaster || "");
      setFormOtherSchoolContactNo(otherSchoolData?.contactNo || "");
      setFormOtherSchoolStatus(otherSchoolData?.status || "Active in School");
      setFormOtherSchoolRemark(otherSchoolData?.remark || "");
    } else {
      setFormActiveOtherSchool(false);
      setFormUdiseSchoolName("");
      setFormUdisePrincipalName("");
      setFormUdisePrincipalMobile("");
      setFormUdiseRequestSentDate("");
      setFormUdiseTcUploaded(hasTcDoc ? "Uploaded" : "Not Uploaded");
      setFormUdiseStatus("Active in other school");
      setFormUdiseRemark("");

      setFormPenSchoolName("");
      setFormPenSchoolUdise("");
      setFormPenState("");
      setFormPenDistrict("");
      setFormPenBlock("");
      setFormPenHeadmaster("");
      setFormPenContactNo("");
      setFormPenStatus("Active in other school");
      setFormPenRemark("");

      setFormOtherSchoolName("");
      setFormOtherSchoolUdise("");
      setFormOtherSchoolState("");
      setFormOtherSchoolDistrict("");
      setFormOtherSchoolBlock("");
      setFormOtherSchoolHeadmaster("");
      setFormOtherSchoolContactNo("");
      setFormOtherSchoolStatus("");
      setFormOtherSchoolRemark("");
    }

    setFormRemarks(stripOtherSchoolTag(rawRemarks));
    setFormError("");
  }

  function closeModal() {
    if (saving) return;
    setModalRow(null);
    if (addWizardActive) {
      setAddSubPhase("details");
    }
    setFormPenNotDefined(false);
    setFormActiveOtherSchool(false);
    setShowPasteAlert(false);
    setPasteAlertInput("");

    setFormUdiseSchoolName("");
    setFormUdisePrincipalName("");
    setFormUdisePrincipalMobile("");
    setFormUdiseRequestSentDate("");
    setFormUdiseTcUploaded("Not Uploaded");
    setFormUdiseStatus("Active in other school");
    setFormUdiseRemark("");

    setFormPenSchoolName("");
    setFormPenSchoolUdise("");
    setFormPenState("");
    setFormPenDistrict("");
    setFormPenBlock("");
    setFormPenHeadmaster("");
    setFormPenContactNo("");
    setFormPenStatus("Active in other school");
    setFormPenRemark("");

    setFormOtherSchoolName("");
    setFormOtherSchoolUdise("");
    setFormOtherSchoolState("");
    setFormOtherSchoolDistrict("");
    setFormOtherSchoolBlock("");
    setFormOtherSchoolHeadmaster("");
    setFormOtherSchoolContactNo("");
    setFormOtherSchoolStatus("");
    setFormOtherSchoolRemark("");
    // If inside the Add-New-Student wizard entry modal, closing returns to details review phase
    if (addWizardActive && addSubPhase === "entry") {
      setAddSubPhase("details");
    }
  }

  async function handleSave() {
    if (!modalRow) return;
    setFormError("");

    if (formGrConflict) {
      setFormError(getConflictWarning(formGrConflict, formGrSection));
      return;
    }

    if (formActiveOtherSchool) {
      if (effectiveTab === "udise" && !formUdiseSchoolName.trim() && !formOtherSchoolName.trim()) {
        setFormError("Please enter the School Name for UDISE Active in other school.");
        return;
      }
      if (effectiveTab === "pen" && !formPenSchoolName.trim() && !formPenSchoolUdise.trim() && !formOtherSchoolName.trim() && !formOtherSchoolUdise.trim()) {
        setFormError("Please enter the School Name or School UDISE for PEN Active in other school.");
        return;
      }
    }

    const prevOtherSchool = parseOtherSchoolRemarks(modalRow.remarks) || modalRow.otherSchoolData || {};

    let otherSchoolObj = null;
    if (formActiveOtherSchool) {
      const isUdise = (effectiveTab === "udise");
      const isPen = (effectiveTab === "pen");

      const udiseActive = isUdise || prevOtherSchool.udiseActive || modalRow?.udiseStatus === "Active in other school";
      const penActive = isPen || prevOtherSchool.penActive || modalRow?.penStatus === "Active in other school";
      const portal = (udiseActive && penActive) ? "both" : (udiseActive ? "udise" : (penActive ? "pen" : ""));

      otherSchoolObj = {
        ...prevOtherSchool,
        portal,
        udiseActive,
        penActive,

        // UDISE specific (State Portal: ssgujarat.org)
        udiseSchoolName: isUdise ? formUdiseSchoolName.trim() : (prevOtherSchool.udiseSchoolName || formUdiseSchoolName.trim() || ""),
        udisePrincipalName: isUdise ? formUdisePrincipalName.trim() : (prevOtherSchool.udisePrincipalName || formUdisePrincipalName.trim() || ""),
        udisePrincipalMobile: isUdise ? formUdisePrincipalMobile.trim() : (prevOtherSchool.udisePrincipalMobile || formUdisePrincipalMobile.trim() || ""),
        udiseUid: formUdise.trim() || prevOtherSchool.udiseUid || "",
        udiseRequestSentDate: isUdise ? formUdiseRequestSentDate.trim() : (prevOtherSchool.udiseRequestSentDate || formUdiseRequestSentDate.trim() || ""),
        udiseTcUploaded: getTcDoc(modalRow) ? "Uploaded" : "Not Uploaded",
        udiseStatus: isUdise ? formUdiseStatus.trim() : (prevOtherSchool.udiseStatus || formUdiseStatus.trim() || "Active in other school"),
        udiseRemark: isUdise ? formUdiseRemark.trim() : (prevOtherSchool.udiseRemark || formUdiseRemark.trim() || ""),

        // PEN specific (National Portal: udiseplus.gov.in)
        penSchoolName: isPen ? formPenSchoolName.trim() : (prevOtherSchool.penSchoolName || formPenSchoolName.trim() || ""),
        penSchoolUdise: isPen ? formPenSchoolUdise.trim() : (prevOtherSchool.penSchoolUdise || formPenSchoolUdise.trim() || ""),
        penState: isPen ? formPenState.trim() : (prevOtherSchool.penState || formPenState.trim() || ""),
        penDistrict: isPen ? formPenDistrict.trim() : (prevOtherSchool.penDistrict || formPenDistrict.trim() || ""),
        penBlock: isPen ? formPenBlock.trim() : (prevOtherSchool.penBlock || formPenBlock.trim() || ""),
        penHeadmaster: isPen ? formPenHeadmaster.trim() : (prevOtherSchool.penHeadmaster || formPenHeadmaster.trim() || ""),
        penContactNo: isPen ? formPenContactNo.trim() : (prevOtherSchool.penContactNo || formPenContactNo.trim() || ""),
        penStatus: isPen ? formPenStatus.trim() : (prevOtherSchool.penStatus || formPenStatus.trim() || "Active in other school"),
        penRemark: isPen ? formPenRemark.trim() : (prevOtherSchool.penRemark || formPenRemark.trim() || ""),

        // Common / fallback for backward compatibility
        schoolName: isUdise ? (formUdiseSchoolName.trim() || formOtherSchoolName.trim()) : (formPenSchoolName.trim() || formOtherSchoolName.trim()),
        schoolUdise: formPenSchoolUdise.trim() || formOtherSchoolUdise.trim(),
        state: formPenState.trim() || formOtherSchoolState.trim(),
        district: formPenDistrict.trim() || formOtherSchoolDistrict.trim(),
        block: formPenBlock.trim() || formOtherSchoolBlock.trim(),
        headmaster: isUdise ? (formUdisePrincipalName.trim() || formOtherSchoolHeadmaster.trim()) : (formPenHeadmaster.trim() || formOtherSchoolHeadmaster.trim()),
        contactNo: isUdise ? (formUdisePrincipalMobile.trim() || formOtherSchoolContactNo.trim()) : (formPenContactNo.trim() || formOtherSchoolContactNo.trim()),
        status: isUdise ? (formUdiseStatus.trim() || formOtherSchoolStatus.trim()) : (formPenStatus.trim() || formOtherSchoolStatus.trim()),
        remark: isUdise ? (formUdiseRemark.trim() || formOtherSchoolRemark.trim()) : (formPenRemark.trim() || formOtherSchoolRemark.trim()),
      };
    } else if (prevOtherSchool && (prevOtherSchool.udiseActive || prevOtherSchool.penActive)) {
      const isUdise = (effectiveTab === "udise");
      const isPen = (effectiveTab === "pen");
      const udiseActive = isUdise ? false : prevOtherSchool.udiseActive;
      const penActive = isPen ? false : prevOtherSchool.penActive;
      if (udiseActive || penActive) {
        otherSchoolObj = {
          ...prevOtherSchool,
          udiseActive,
          penActive,
          portal: (udiseActive && penActive) ? "both" : (udiseActive ? "udise" : "pen"),
        };
      }
    }

    const combinedRemarks = buildCombinedRemarks(formRemarks, otherSchoolObj);

    let udiseValue = "-";
    if (formActiveOtherSchool && (effectiveTab === "udise" || otherSchoolObj?.udiseActive)) {
      udiseValue = formUdise.trim() || "Active in other school";
    } else {
      udiseValue = formUdise.trim() || "-";
    }

    let penValue = "-";
    if (formActiveOtherSchool && (effectiveTab === "pen" || otherSchoolObj?.penActive)) {
      penValue = formPen.trim() || "Active in other school";
    } else if (formPenNotDefined) {
      penValue = "Not Defined";
    } else {
      penValue = formPen.trim() || "-";
    }

    // Save for onlineGr row without db studentId (e.g. from Online GR or Import list)
    if (!modalRow.studentId && modalRow.id && !isWizardEntry) {
      const sec = modalRow.section || classSection(modalRow.cls) || "general";
      const patch = {
        udise: udiseValue,
        pen: penValue,
        remarks: combinedRemarks || modalRow.remarks || "-",
      };
      if (formGrNo.trim()) patch.grNo = formGrNo.trim();
      setSaving(true);
      try {
        await updateOnlineGrRow(modalRow.id, sec, patch);
        setOnlineGrDataset(prev => ({
          ...prev,
          [sec]: (prev[sec] || []).map(r => r.id === modalRow.id ? { ...r, ...patch } : r),
        }));
        setModalRow(null);
      } catch (e) {
        setFormError(e.message || "Failed to update record.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // 1. Online General Register — update SEPARATE record, do NOT insert into students table!
    if (mainTab === "onlineGr" && !isWizardEntry) {
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
          udise: udiseValue,
          pen: penValue,
          apaar: formApaar.trim() || "-",
          remarks: combinedRemarks || "-",
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
    if (isWizardEntry ? addStep === 2 : effectiveTab === "udise") {
      const digits = formUdise.trim();
      if (!formActiveOtherSchool) {
        if (!/^\d{18}$/.test(digits)) {
          setFormError("UDISE No must be exactly 18 digits.");
          return;
        }
      }
      if (formActiveOtherSchool && digits && !/^\d{18}$/.test(digits)) {
        setFormError("If entering a UDISE No, it must be exactly 18 digits.");
        return;
      }
      if (!formGrNo.trim()) {
        setFormError("GR No is required.");
        return;
      }
      setSaving(true);
      try {
        const chosenRemarks = combinedRemarks || modalRow.remarks || "";

        const updatePromises = [];
        if (modalRow.studentId) {
          updatePromises.push(
            updateStudentGovId(modalRow.studentId, {
              grNo: formGrNo.trim(),
              udise: udiseValue,
              apaar: formApaar.trim() || null,
              remarks: combinedRemarks || null,
              enrollmentId: modalRow.enrollmentId,
            })
          );
        }

        let targetOnlineGrId = null;
        let targetOnlineGrSec = null;
        if (addWizardActive && addCreatedRowId && addSection) {
          targetOnlineGrId = addCreatedRowId;
          targetOnlineGrSec = addSection;
          updatePromises.push(
            updateOnlineGrRow(addCreatedRowId, addSection, {
              udise: udiseValue,
              remarks: chosenRemarks || "-",
            }).catch(e => console.warn("Could not sync UDISE to online register row:", e))
          );
        } else if (modalRow.id) {
          const sec = addSection || modalRow.section || classSection(modalRow.cls) || grSubTab || "general";
          targetOnlineGrId = modalRow.id;
          targetOnlineGrSec = sec;
          updatePromises.push(
            updateOnlineGrRow(modalRow.id, sec, {
              udise: udiseValue,
              ...(combinedRemarks ? { remarks: combinedRemarks } : {}),
            }).catch(e => console.warn("Could not sync UDISE to online register row:", e))
          );
        } else {
          const sec = addSection || classSection(modalRow.cls) || grSubTab || "general";
          const existingRow = findExistingOnlineGrRow(modalRow, sec);
          if (existingRow && sec) {
            targetOnlineGrId = existingRow.id;
            targetOnlineGrSec = sec;
            updatePromises.push(
              updateOnlineGrRow(existingRow.id, sec, {
                udise: udiseValue,
                ...(combinedRemarks ? { remarks: combinedRemarks } : {}),
              }).catch(e => console.warn("Could not sync UDISE to online register row:", e))
            );
          }
        }

        await Promise.all(updatePromises);

        // Optimistically update dbStudents in memory so UI reflects changes instantly
        setDbStudents(prev => prev.map(s => {
          if (s.student?.id === modalRow.studentId || s.enrollment_no === modalRow.enrollNo) {
            return {
              ...s,
              student: {
                ...s.student,
                grno: formGrNo.trim() || s.student?.grno,
                udise: udiseValue,
                apaar: formApaar.trim() || s.student?.apaar,
              },
              deactivate_reason: chosenRemarks || s.deactivate_reason,
            };
          }
          return s;
        }));

        if (targetOnlineGrId && targetOnlineGrSec) {
          setOnlineGrDataset(prev => ({
            ...prev,
            [targetOnlineGrSec]: (prev[targetOnlineGrSec] || []).map(r =>
              r.id === targetOnlineGrId ? { ...r, udise: udiseValue, remarks: chosenRemarks || r.remarks } : r
            ),
          }));
        }

        // Close modal immediately without waiting for full database reload
        setModalRow(null);
        // Add-New-Student wizard, stage 2 done — hand off to PEN Entry
        // Opens the PEN Entry table view ("ENTRY") with click-to-copy cells so the operator
        // can view/copy student details for the national portal, then click "Next: Enter PEN No →"
        if (addWizardActive && addStep === 2) {
          const nextRow = { ...modalRow, udise: udiseValue, remarks: chosenRemarks };
          saveProgressToStorage({
            enrollNo: nextRow.enrollNo,
            studentId: modalRow.studentId || modalRow.id,
            grNo: formGrNo.trim(),
            step: 3,
            subPhase: "details",
            createdRowId: addCreatedRowId || targetOnlineGrId,
            section: addSection,
            studentName: nextRow.name,
            cls: nextRow.cls,
            session: nextRow.session,
            remarks: chosenRemarks,
            otherSchool: otherSchoolObj,
            timestamp: Date.now(),
          });
          setAddSelectedStudent(nextRow);
          setAddRemarks(chosenRemarks);
          setAddStep(3);
          setAddSubPhase("details");
          setMainTab("pen");
          setFilters({ cls: "All", session: "All", batch: "All", status: "All" });
          setEligTab(eligibilityFns.penEligible(nextRow) ? "eligible" : "ineligible");
          setSearch("");
          setAddPinnedEnrollNo(nextRow.enrollNo);
          setModalRow(null);
        } else if (!addWizardActive && modalRow) {
          const hasRealPen = Boolean(
            (modalRow.pen && modalRow.pen !== "-" && modalRow.pen !== "Not Defined" && modalRow.pen !== "Active in other school") ||
            modalRow.penStatus === "Done"
          );
          const penNotDef = modalRow.pen === "Not Defined" || modalRow.penStatus === "Not Defined";
          if (!hasRealPen && !penNotDef) {
            saveProgressToStorage({
              enrollNo: modalRow.enrollNo || "",
              studentId: modalRow.studentId || modalRow.id,
              grNo: formGrNo.trim() || modalRow.grNo || "",
              step: 1,
              subPhase: "details",
              createdRowId: modalRow.id || targetOnlineGrId || null,
              section: modalRow.section || (modalRow.cls ? classSection(modalRow.cls) : null) || grSubTab || "general",
              studentName: modalRow.name,
              name: modalRow.name,
              cls: modalRow.cls,
              session: modalRow.session || "",
              doeSlash: modalRow.doeSlash || getTodaySlash(),
              remarks: chosenRemarks || modalRow.remarks || "",
              timestamp: Date.now(),
            });
          } else {
            clearProgressFromStorage();
          }
        }

        // Silent background sync
        loadAll();
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
    if (!formActiveOtherSchool && !formPenNotDefined && !formPen.trim()) {
      setFormError("Enter the PEN No, mark it as not generated yet, or select Active in other school.");
      return;
    }
    setSaving(true);
    try {
      const chosenRemarks = combinedRemarks || modalRow.remarks || "";

      const updatePromises = [];
      if (modalRow.studentId) {
        updatePromises.push(
          updateStudentGovId(modalRow.studentId, {
            grNo: formGrNo.trim(),
            pen: penValue,
            apaar: formApaar.trim() || null,
            remarks: combinedRemarks || null,
            enrollmentId: modalRow.enrollmentId,
          })
        );
      }

      let targetOnlineGrId = null;
      let targetOnlineGrSec = null;
      if (addWizardActive && addCreatedRowId && addSection) {
        targetOnlineGrId = addCreatedRowId;
        targetOnlineGrSec = addSection;
        updatePromises.push(
          updateOnlineGrRow(addCreatedRowId, addSection, {
            pen: penValue,
            remarks: chosenRemarks || "-",
          }).catch(e => console.warn("Could not sync PEN to online register row:", e))
        );
      } else if (modalRow.id) {
        const sec = addSection || modalRow.section || classSection(modalRow.cls) || grSubTab || "general";
        targetOnlineGrId = modalRow.id;
        targetOnlineGrSec = sec;
        updatePromises.push(
          updateOnlineGrRow(modalRow.id, sec, {
            pen: penValue,
            ...(combinedRemarks ? { remarks: combinedRemarks } : {}),
          }).catch(e => console.warn("Could not sync PEN to online register row:", e))
        );
      } else {
        const sec = addSection || classSection(modalRow.cls) || grSubTab || "general";
        const existingRow = findExistingOnlineGrRow(modalRow, sec);
        if (existingRow && sec) {
          targetOnlineGrId = existingRow.id;
          targetOnlineGrSec = sec;
          updatePromises.push(
            updateOnlineGrRow(existingRow.id, sec, {
              pen: penValue,
              ...(combinedRemarks ? { remarks: combinedRemarks } : {}),
            }).catch(e => console.warn("Could not sync PEN to online register row:", e))
          );
        }
      }

      await Promise.all(updatePromises);

      // Optimistically update dbStudents in memory so UI reflects changes instantly
      setDbStudents(prev => prev.map(s => {
        if (s.student?.id === modalRow.studentId || s.enrollment_no === modalRow.enrollNo) {
          return {
            ...s,
            student: {
              ...s.student,
              grno: formGrNo.trim() || s.student?.grno,
              pen: penValue,
              apaar: formApaar.trim() || s.student?.apaar,
            },
            deactivate_reason: chosenRemarks || s.deactivate_reason,
          };
        }
        return s;
      }));

      if (targetOnlineGrId && targetOnlineGrSec) {
        setOnlineGrDataset(prev => ({
          ...prev,
          [targetOnlineGrSec]: (prev[targetOnlineGrSec] || []).map(r =>
            r.id === targetOnlineGrId ? { ...r, pen: penValue, remarks: chosenRemarks || r.remarks } : r
          ),
        }));
      }

      // Close modal immediately without waiting for full database reload
      setModalRow(null);
      // Add-New-Student wizard, stage 3 done — back to Online GR for the
      // final confirmation review (stage 4).
      if (addWizardActive && addStep === 3) {
        const nextRemarks = chosenRemarks || addSelectedStudent?.remarks || "";
        const nextStudent = addSelectedStudent || modalRow;
        saveProgressToStorage({
          enrollNo: nextStudent?.enrollNo || modalRow?.enrollNo || "",
          studentId: modalRow.studentId || modalRow.id,
          grNo: addGrNo || formGrNo.trim(),
          step: 4,
          subPhase: "details",
          createdRowId: addCreatedRowId || targetOnlineGrId,
          section: addSection,
          studentName: nextStudent?.name || modalRow?.name,
          cls: nextStudent?.cls || modalRow?.cls,
          session: nextStudent?.session || modalRow?.session,
          remarks: nextRemarks,
          otherSchool: otherSchoolObj,
          timestamp: Date.now(),
        });
        setAddSelectedStudent(prev => prev ? { ...prev, pen: penValue, remarks: nextRemarks } : { ...modalRow, pen: penValue, remarks: nextRemarks });
        setAddRemarks(nextRemarks);
        setAddStep(4);
        setAddSubPhase("details");
        setMainTab("onlineGr");
        if (addSection) setGrSubTab(addSection);
        setAddPinnedEnrollNo(null);
        setAddModalOpen(true);
      } else if (!addWizardActive && modalRow) {
        const hasUdise = Boolean(
          (modalRow.udise && modalRow.udise !== "-" && modalRow.udise !== "Active in other school") ||
          modalRow.udiseStatus === "Done"
        );
        if (hasUdise) {
          clearProgressFromStorage();
        }
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

    if (mainTab === "import") {
      const activeExportCols = importSubTab === "udise"
        ? UDISE_IMPORT_COLUMNS
        : (importSubTab === "pen" ? PEN_IMPORT_COLUMNS : ALL_IMPORT_COLUMNS);

      const aoa = [
        activeExportCols.map(c => c.label),
        ...rows.map(r => activeExportCols.map(c => {
          const val = formatCellValue(c, r[c.key], r);
          return val !== undefined && val !== null && val !== "" ? val : "-";
        }))
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      const sheetName = importSubTab === "udise" ? "UDISE_Import" : (importSubTab === "pen" ? "PEN_Import" : "All_Imports");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${sheetName}_${today}.xlsx`);
      return;
    }

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
        ...rows.map(r => columns.map(c => formatCellValue(c, r[c.key], r)))
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
    <div className={fullscreen ? "fixed inset-0 z-[100] bg-white overflow-y-auto p-4 space-y-2" : "space-y-2"}>
      {/* REQ-BUG-078 (3): failed data loads used to render as a silent
          empty table - show an explicit banner with what failed. */}
      {loadError && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 text-red-800 px-3 py-1.5 rounded-lg text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600"/>
          <span>{loadError}</span>
        </div>
      )}
      {/* In Progress Resume Banner - Slim single-line strip (for non-Online-GR tabs) */}
      {hasActiveSession && inProgressSession && !addModalOpen && !modalRow && mainTab !== "onlineGr" && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-lg px-2.5 py-1 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div className="flex items-center gap-1.5 truncate text-[11px] text-amber-900">
              <span className="font-semibold text-amber-800">In Progress:</span>
              <span className="font-mono bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded font-bold text-[10px]">{inProgressSession.grNo || "Student"}</span>
              <span className="font-medium truncate">{inProgressSession.studentName || inProgressSession.name} ({inProgressSession.cls})</span>
              <span className="text-amber-700 hidden md:inline">· Step {inProgressSession.step || 1}/4 ({
                inProgressSession.step === 2 ? "UDISE" :
                inProgressSession.step === 3 ? "PEN" :
                inProgressSession.step === 4 ? "Confirm" : "Select"
              })</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => resumeProgress(inProgressSession)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-md shadow-xs transition-all cursor-pointer"
            >
              ▶ Resume
            </button>
            <button
              type="button"
              onClick={dismissInProgress}
              title="Discard this in-progress entry"
              className="text-[11px] font-medium px-2 py-1 text-gray-500 hover:text-gray-800 hover:bg-amber-100/60 rounded-md transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs & Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit shadow-xs">
            <button onClick={() => setMainTab("onlineGr")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mainTab === "onlineGr" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              <BookOpen className="w-3.5 h-3.5"/> Online General Register
            </button>
            <button onClick={() => setMainTab("udise")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mainTab === "udise" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              <Landmark className="w-3.5 h-3.5"/> UDISE Entry (State)
            </button>
            <button onClick={() => setMainTab("pen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mainTab === "pen" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              <IdCard className="w-3.5 h-3.5"/> PEN Entry (National)
            </button>
            <button onClick={() => setMainTab("import")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mainTab === "import" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              <School className="w-3.5 h-3.5"/> Import
              {importCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${mainTab === "import" ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-700 border border-purple-200"}`}>
                  {importCount}
                </span>
              )}
            </button>
            <button onClick={() => setMainTab("mismatch")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mainTab === "mismatch" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              <AlertTriangle className="w-3.5 h-3.5"/> Mismatch
            </button>
          </div>

          {mainTab === "onlineGr" ? (
            <>
              <span className="hidden sm:block w-px h-6 bg-gray-200"/>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit shadow-xs">
                  <button
                    type="button"
                    onClick={() => setGrSubTab("primary")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      grSubTab === "primary" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5"/>
                    <span>Primary (JR, SR, Balvatika)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      grSubTab === "primary" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 border border-purple-200"
                    }`}>
                      {(onlineGrDataset.primary || []).length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrSubTab("general")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      grSubTab === "general" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5"/>
                    <span>General (1st+)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      grSubTab === "general" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 border border-purple-200"
                    }`}>
                      {(onlineGrDataset.general || []).length}
                    </span>
                  </button>
                </div>

                {/* REQ: "instead last saved at top of the page ; resume last entry (suppose i need to work on previous entry (not last entry)) it will simply show that resume for that student on which i was working last time not the last row" */}
                {/* REQ: "if there is no active entry then no need to show resume button" */}
                {hasActiveSession && inProgressSession && !addModalOpen && !modalRow && (() => {
                  const sGr = inProgressSession.grNo ? String(inProgressSession.grNo).trim() : "";
                  const sName = inProgressSession.studentName || inProgressSession.name || "Student";
                  const sCls = inProgressSession.cls;
                  const sStep = inProgressSession.step || 1;
                  const stepLabel = sStep === 2 ? "UDISE" : sStep === 3 ? "PEN" : sStep === 4 ? "Confirm" : "Reg No";

                  return (
                    <div className="flex items-center gap-2 text-xs bg-amber-50/90 border border-amber-300 rounded-xl px-2.5 py-1 shadow-2xs animate-fadeIn flex-wrap">
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                        Resume Last Entry:
                      </span>
                      {sGr && (
                        <span className="font-mono font-bold text-amber-950 bg-amber-200/90 border border-amber-300 px-1.5 py-0.5 rounded text-xs">
                          {sGr}
                        </span>
                      )}
                      <span className="font-semibold text-amber-950 truncate max-w-[180px]" title={sName}>
                        {sName}
                      </span>
                      {sCls && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-medium">
                          {sCls}
                        </span>
                      )}
                      <span className="text-[11px] text-amber-800 hidden sm:inline">
                        · Step {sStep}/4 ({stepLabel})
                      </span>
                      <button
                        type="button"
                        onClick={() => resumeProgress(inProgressSession)}
                        title={`Resume government entry for ${sName} (${sGr || sCls || ""})`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-md shadow-xs transition-all cursor-pointer ml-1"
                      >
                        ▶ Resume
                      </button>
                      <button
                        type="button"
                        onClick={dismissInProgress}
                        title="Dismiss in-progress resume"
                        className="text-amber-700 hover:text-amber-950 hover:bg-amber-200/60 p-1 rounded-md transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : mainTab === "import" ? (
            <>
              <span className="hidden sm:block w-px h-6 bg-gray-200"/>
              <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit shadow-xs">
                <button
                  type="button"
                  onClick={() => setImportSubTab("udise")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    importSubTab === "udise" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5"/>
                  <span>UDISE Import (State)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    importSubTab === "udise" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 border border-purple-200"
                  }`}>
                    {importUdiseCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSubTab("pen")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    importSubTab === "pen" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <IdCard className="w-3.5 h-3.5"/>
                  <span>PEN Import (National)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    importSubTab === "pen" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 border border-purple-200"
                  }`}>
                    {importPenCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSubTab("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    importSubTab === "all" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>All ({importAllCount})</span>
                </button>
              </div>
            </>
          ) : mainTab === "mismatch" ? (
            <>
              <span className="hidden sm:block w-px h-6 bg-gray-200"/>
              <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit shadow-xs">
                <button onClick={() => setMismatchDir("udiseOnly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mismatchDir === "udiseOnly" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                  UDISE Eligible, PEN Not
                </button>
                <button onClick={() => setMismatchDir("penOnly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${mismatchDir === "penOnly" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                  PEN Eligible, UDISE Not
                </button>
              </div>
            </>
          ) : mainTab !== "onlineGr" && mainTab !== "import" ? (
            <>
              <span className="hidden sm:block w-px h-6 bg-gray-200"/>
              <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit shadow-xs">
                <button onClick={() => setEligTab("eligible")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${eligTab === "eligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                  Eligible for Entry
                </button>
                <button onClick={() => setEligTab("ineligible")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${eligTab === "ineligible" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
                  Not Eligible for Entry
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={exportExcel}
            title="Download Excel export"
            className="flex items-center gap-1.5 text-xs border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer shadow-xs font-medium">
            <Download className="w-3.5 h-3.5 text-emerald-700"/> Export Excel
          </button>
          <button onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors cursor-pointer shadow-xs font-medium">
            <HelpCircle className="w-3.5 h-3.5"/> Rules
          </button>
          <button onClick={loadAll} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors disabled:opacity-60 cursor-pointer shadow-xs font-medium">
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin text-school-navy" : ""}`}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={() => setFullscreen(v => !v)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-2.5 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors cursor-pointer shadow-xs font-medium">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5"/> : <Maximize2 className="w-3.5 h-3.5"/>}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
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
                <button
                  type="button"
                  onClick={isUdiseStep ? goBackToAddStep1 : goBackToAddStep2}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer shadow-xs"
                  title={isUdiseStep ? "Go back to Step 1: Select Student & Reg No" : "Go back to Step 2: UDISE Entry"}
                >
                  <ArrowLeft className="w-3.5 h-3.5"/>
                  <span>{isUdiseStep ? "Back to Step 1 (Reg No)" : "Back to Step 2 (UDISE)"}</span>
                </button>
                <button onClick={cancelAddWizard}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
                  Cancel
                </button>
                {eligInfo.eligible ? (
                  <button onClick={isUdiseStep ? proceedToUdiseEntryForm : proceedToPenEntryForm}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors cursor-pointer shadow-xs">
                    Next: Enter {isUdiseStep ? "UDISE" : "PEN"} No →
                  </button>
                ) : (
                  <button onClick={isUdiseStep ? skipUdiseStep : skipPenStep}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer shadow-xs">
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

      {/* UDISE "Active in other school" reminder */}
      {mainTab === "udise" && udiseActiveOtherSchoolCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-purple-700 flex-shrink-0"/>
            <span><span className="font-semibold">{udiseActiveOtherSchoolCount} student{udiseActiveOtherSchoolCount === 1 ? "" : "s"}</span> marked as <span className="font-semibold text-purple-800">Active in other school</span> in UDISE. Track or request transfer from previous school once available.</span>
          </div>
        </div>
      )}

      {/* PEN "Active in other school" reminder */}
      {mainTab === "pen" && penActiveOtherSchoolCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-purple-700 flex-shrink-0"/>
            <span><span className="font-semibold">{penActiveOtherSchoolCount} student{penActiveOtherSchoolCount === 1 ? "" : "s"}</span> marked as <span className="font-semibold text-purple-800">Active in other school</span> on the PEN portal.</span>
          </div>
        </div>
      )}

      {/* Import tab top summary banner */}
      {mainTab === "import" && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50/40 to-purple-50 border border-purple-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <School className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                  Student Import &amp; Previous School Tracking
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800 border border-purple-300">
                  {rows.length} {rows.length === 1 ? "student" : "students"} listed
                </span>
              </div>
              <p className="text-[11px] text-purple-800 mt-0.5">
                Students actively enrolled in other schools on UDISE (ssgujarat.org) or National PEN portal. Use principal contact details below for tracking and TC release.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-purple-700" /> Export Import List
            </button>
          </div>
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
              const currentObj = addReview || addSelectedStudent;
              const rawValue = formatCellValue(c, currentObj?.[c.key], currentObj);
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
          <div className="bg-gray-50/80 border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={mainTab === "onlineGr" ? "Search name, PR/GR, mobile, aadhar, UID…" : "Name, Reg No, Mobile, Aadhar, UID"}
                    className="border border-gray-200 rounded-lg pl-8 pr-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-44 sm:w-56"/>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Class</label>
                  <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-20 cursor-pointer"
                    value={filters.cls} onChange={e => setFilters(prev => ({ ...prev, cls: e.target.value }))}>
                    {["All", ...classOptions].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Year</label>
                  <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-20 cursor-pointer"
                    value={filters.session} onChange={e => setFilters(prev => ({ ...prev, session: e.target.value }))}>
                    {(mainTab === "onlineGr" ? ONLINE_GR_YEARS : ["All", ...dbSessions]).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                {mainTab !== "onlineGr" && mainTab !== "import" && mainTab !== "mismatch" && (
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Batch</label>
                    <select disabled={eligTab === "ineligible"}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      value={filters.batch} onChange={e => setFilters(prev => ({ ...prev, batch: e.target.value }))}>
                      {["All", ...batchOptions].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</label>
                  <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-32 cursor-pointer"
                    value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                    {(mainTab === "import" ? IMPORT_STATUS_FILTER_OPTIONS : STATUS_FILTER_OPTIONS).map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons directly above the table */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500 font-medium">
                  <span className="font-semibold text-gray-800">{rows.length}</span> {rows.length === 1 ? "student" : "students"}
                </span>

                {mainTab === "onlineGr" && (
                  <div className="flex items-center gap-2">
                    {hasActiveSession && inProgressSession && !addModalOpen && !modalRow && (
                      <button
                        type="button"
                        onClick={() => resumeProgress(inProgressSession)}
                        title={`Resume last worked student: ${inProgressSession.studentName || inProgressSession.name} (${inProgressSession.grNo ? '#' + inProgressSession.grNo : 'Step ' + (inProgressSession.step || 1)})`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-200" />
                        <span>Resume: {inProgressSession.studentName || inProgressSession.name}</span>
                        {inProgressSession.grNo && (
                          <span className="font-mono font-bold bg-amber-700/80 px-1.5 py-0.2 rounded text-[10px]">
                            #{inProgressSession.grNo}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openAddModal}
                      title="Add a new student into this register"
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 shadow-sm transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5"/> Add New Student
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className={`overflow-auto rounded-xl border border-gray-200 shadow-sm ${
              fullscreen
                ? "max-h-[calc(100vh-130px)]"
                : "max-h-[calc(100vh-195px)] min-h-[400px]"
            }`}
          >
              <table className="text-xs w-full">
              <thead>
                <tr className="bg-school-navy text-white">
                  <th ref={el => { frozenHeaderRefs.current[0] = el; }}
                    style={{ position: "sticky", top: 0, left: stickyLeft[0], zIndex: 30 }}
                    className="bg-school-navy px-2 py-1.5 text-center font-semibold whitespace-nowrap text-xs">Action</th>
                  <th ref={el => { frozenHeaderRefs.current[1] = el; }}
                    style={{ position: "sticky", top: 0, left: stickyLeft[1], zIndex: 30 }}
                    className="bg-school-navy px-1.5 py-1.5 text-center font-semibold whitespace-nowrap w-7 text-xs">#</th>
                  <th ref={el => { frozenHeaderRefs.current[2] = el; }}
                    onClick={mainTab === "onlineGr" ? () => toggleOnlineGrSort("status") : undefined}
                    style={{ position: "sticky", top: 0, left: stickyLeft[2], zIndex: 30 }}
                    className={`bg-school-navy px-2 py-1.5 text-left font-semibold whitespace-nowrap text-xs ${mainTab === "onlineGr" ? "cursor-pointer hover:bg-school-navy/80 select-none" : ""}`}>
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
                        className={`bg-school-navy px-2 py-1.5 text-left font-semibold whitespace-nowrap text-xs ${sortable ? "cursor-pointer hover:bg-school-navy/80 select-none" : ""}`}>
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
                  const status = mainTab === "onlineGr"
                    ? row.status
                    : mainTab === "import"
                    ? (importSubTab === "pen" ? row.penStatus : (importSubTab === "udise" ? row.udiseStatus : "Active in other school"))
                    : (effectiveTab === "udise" ? row.udiseStatus : row.penStatus);
                  const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";
                  const rowBgSolid = idx % 2 === 0 ? "bg-white" : "bg-gray-100";
                  return (
                    <tr key={`${row.id || row.studentId || row.enrollNo || idx}-${row.session}-${idx}`}
                      onDoubleClick={() => openStudentProfile(row)}
                      title={mainTab === "onlineGr" ? "Double-click to edit this entry" : "Double-click to edit this student"}
                      className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${rowBg}`}>
                      <td style={{ position: "sticky", left: stickyLeft[0], zIndex: 10 }} className={`${rowBgSolid} px-2 py-1 text-center whitespace-nowrap`}>
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
                            ? (row.udiseStatus === "Done" || row.udiseStatus === "Active in other school" || Boolean(row.udise && String(row.udise).trim() && String(row.udise).trim() !== "-"))
                            : (row.penStatus === "Done" || row.penStatus === "Not Defined" || row.penStatus === "Active in other school" || Boolean(row.pen && String(row.pen).trim() && String(row.pen).trim() !== "-"));

                          return (
                            <div className="inline-flex items-center gap-1">
                              {mainTab === "import" ? (
                                <button
                                  onClick={() => openEntryModal(row)}
                                  title="Edit details or update tracking status"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-300 hover:bg-purple-700 hover:text-white transition-colors shadow-xs cursor-pointer"
                                >
                                  <Pencil className="w-2.5 h-2.5"/> Update
                                </button>
                              ) : isDone ? (
                                <button
                                  onClick={() => isElig && openEntryModal(row)}
                                  disabled={!isElig}
                                  title={
                                    !isElig
                                      ? `Not eligible for ${isUdise ? "UDISE" : "PEN"} Entry: ${eligInfo.reason}`
                                      : (isOnlineGr ? "Edit General Register entry" : `Edit ${isUdise ? "UDISE" : "PEN"} details`)
                                  }
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                    isElig
                                      ? "bg-blue-50 text-school-navy border border-blue-300 hover:bg-school-navy hover:text-white shadow-xs"
                                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                                  }`}>
                                  <Pencil className="w-2.5 h-2.5"/> Edit
                                </button>
                              ) : (
                                <button
                                  onClick={() => isElig && openEntryModal(row)}
                                  disabled={!isElig}
                                  title={!isElig ? `Not eligible for ${isUdise ? "UDISE" : "PEN"} Entry: ${eligInfo.reason}` : "Entry Done"}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                    isElig
                                      ? "bg-school-navy text-white hover:bg-school-navy/90 shadow-xs"
                                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                                  }`}>
                                  <CheckCircle2 className="w-2.5 h-2.5"/> Done
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
                                  className={`inline-flex items-center justify-center p-1 rounded border transition-colors cursor-pointer ${
                                    getBcDoc(row)
                                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                      : "text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100"
                                  }`}
                                >
                                  {getBcDoc(row) ? <Download className="w-2.5 h-2.5" /> : <Upload className="w-2.5 h-2.5" />}
                                </button>
                              )}
                              {isOnlineGr && status === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() => resumeFromOnlineGrRow(row)}
                                  title={`Resume progress for ${row.grNo || row.name}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors shadow-xs cursor-pointer"
                                >
                                  ▶ Resume
                                </button>
                              )}
                              {isOnlineGr && (
                                <button onClick={() => openDeleteConfirm(row)}
                                  title="Delete this record"
                                  className="inline-flex items-center justify-center p-1 rounded text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer">
                                  <Trash2 className="w-2.5 h-2.5"/>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ position: "sticky", left: stickyLeft[1], zIndex: 10 }} className={`${rowBgSolid} px-1.5 py-1 text-gray-400 font-mono text-[11px] text-center w-7`}>{idx + 1}</td>
                      <td style={{ position: "sticky", left: stickyLeft[2], zIndex: 10 }} className={`${rowBgSolid} px-2 py-1`}><StatusPill status={status}/></td>
                      {columns.map((c, i) => {
                        const rawValue = formatCellValue(c, row[c.key], row);
                        const frozenIdx = i + 3;
                        const isFrozen = frozenIdx < frozenCount;
                        return (
                          <td key={c.key}
                            tabIndex={0}
                            onFocus={() => copyCellToClipboard(rawValue)}
                            style={isFrozen ? { position: "sticky", left: stickyLeft[frozenIdx], zIndex: 10 } : undefined}
                            className={`${isFrozen ? rowBgSolid : ""} px-2 py-1 text-gray-700 whitespace-nowrap cursor-pointer text-xs focus:outline-none focus:ring-2 focus:ring-school-navy focus:bg-blue-50`}>
                            {c.key === "importPortal" && rawValue && rawValue !== "-" ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rawValue.includes("Both") || rawValue.includes("&")
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : rawValue.includes("UDISE") || rawValue.includes("State")
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {String(rawValue)}
                              </span>
                            ) : c.key === "udiseImportTcUploaded" && rawValue && rawValue !== "-" ? (
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                rawValue === "Uploaded"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}>
                                {rawValue === "Uploaded" ? (
                                  <>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                                    <span>Uploaded</span>
                                    {getTcDoc(row)?.file_url && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDownloadTcDoc(row); }}
                                        title="View / Download Leaving Certificate (TC)"
                                        className="ml-1 text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-0.5 bg-emerald-200/80 hover:bg-emerald-300 px-1 py-0.2 rounded transition-colors"
                                      >
                                        <Download className="w-2.5 h-2.5 inline" />
                                        <span className="text-[9px]">View</span>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-2.5 h-2.5 text-red-600 flex-shrink-0" />
                                    <span>Not Uploaded</span>
                                  </>
                                )}
                              </span>
                            ) : (c.key === "udiseImportStatus" || c.key === "penImportStatus" || c.key === "importStatus") && rawValue && rawValue !== "-" ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                String(rawValue).toLowerCase().includes("approved")
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : String(rawValue).toLowerCase().includes("sent")
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : "bg-purple-100 text-purple-800 border-purple-300"
                              }`}>
                                {String(rawValue).toLowerCase().includes("approved") ? (
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                                ) : String(rawValue).toLowerCase().includes("sent") ? (
                                  <Clock className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                                )}
                                <span>{String(rawValue)}</span>
                              </span>
                            ) : (c.key === "udiseImportPrincipalMobile" || c.key === "penImportContactNo" || c.key === "importContactNo" || c.key === "otherSchoolContact") && rawValue && rawValue !== "-" ? (
                              <span className="inline-flex items-center gap-1.5 font-mono">
                                <span>{String(rawValue)}</span>
                                <a href={`tel:${rawValue}`} title={`Call ${rawValue}`} onClick={e => e.stopPropagation()} className="text-purple-600 hover:text-purple-900 font-sans text-xs">
                                  📞
                                </a>
                              </span>
                            ) : c.key === "remarks" || c.key === "documentsPending" ? (
                              <span className="block max-w-[160px] truncate" title={rawValue && rawValue !== "-" ? String(rawValue) : ""}>
                                {rawValue !== "" && rawValue !== "-" ? String(rawValue) : <span className="text-gray-300">-</span>}
                              </span>
                            ) : c.key === "name" ? (
                              <span className="font-medium text-gray-900 block max-w-[160px] truncate" title={String(rawValue)}>
                                {String(rawValue)}
                              </span>
                            ) : c.key === "grNo" ? (
                              <span className="font-mono font-bold text-school-navy">
                                {String(rawValue)}
                              </span>
                            ) : c.key === "session" ? (
                              <span className="font-mono text-gray-600">
                                {String(rawValue)}
                              </span>
                            ) : rawValue !== "" && rawValue !== "-" ? (
                              String(rawValue)
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {rows.length > 0 && (
                  <tr ref={tableEndRef} className="h-6 select-none pointer-events-none">
                    <td colSpan={columns.length + 3} className="p-0 border-0 h-6 bg-transparent"></td>
                  </tr>
                )}
                {rows.length === 0 && (
                  <tr><td colSpan={columns.length + 3} className="px-4 py-8 text-center text-gray-400 text-sm">No students match the selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sub-tabs frozen below table for Import (UDISE vs PEN vs All) */}
          {mainTab === "import" && (
            <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-purple-200 rounded-xl px-3.5 py-2 shadow-md flex flex-wrap items-center justify-between gap-3 mt-1.5">
              <div className="flex gap-1 bg-purple-50/70 p-1 rounded-xl border border-purple-200 w-fit">
                <button
                  type="button"
                  onClick={() => setImportSubTab("udise")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    importSubTab === "udise"
                      ? "bg-school-navy text-white shadow-sm"
                      : "text-purple-900 hover:text-purple-950 hover:bg-white/60"
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5"/>
                  <span>UDISE Import (State Portal)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    importSubTab === "udise" ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900"
                  }`}>
                    {importUdiseCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSubTab("pen")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    importSubTab === "pen"
                      ? "bg-school-navy text-white shadow-sm"
                      : "text-purple-900 hover:text-purple-950 hover:bg-white/60"
                  }`}
                >
                  <IdCard className="w-3.5 h-3.5"/>
                  <span>PEN Import (National Portal)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    importSubTab === "pen" ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900"
                  }`}>
                    {importPenCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportSubTab("all")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    importSubTab === "all"
                      ? "bg-school-navy text-white shadow-sm"
                      : "text-purple-900 hover:text-purple-950 hover:bg-white/60"
                  }`}
                >
                  <span>All ({importAllCount})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-purple-800 font-medium">
                <span className="hidden sm:inline">Active Import View:</span>
                <span className="font-bold text-purple-900 bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200">
                  {importSubTab === "udise" ? "UDISE State Portal" : importSubTab === "pen" ? "PEN National Portal" : "All Portals"}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Entry Done modal */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`bg-white rounded-2xl shadow-2xl w-full transition-all duration-200 ${formActiveOtherSchool ? "max-w-xl" : "max-w-md"} max-h-[92vh] flex flex-col`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  {isWizardEntry ? (
                    `Add New Student — Step ${addStep} of 4: ${addStep === 2 ? "UDISE Entry" : "PEN Entry"}`
                  ) : mainTab === "import" ? (
                    `Update Import Tracking — ${effectiveTab === "pen" ? "PEN (National Portal)" : "UDISE (State Portal)"}`
                  ) : modalIsDone ? (
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

            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {mainTab === "import" && (
                <div className="flex gap-1 bg-purple-50 p-1 rounded-xl border border-purple-200">
                  <button
                    type="button"
                    onClick={() => setImportModalMode("udise")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      importModalMode === "udise"
                        ? "bg-school-navy text-white shadow-xs"
                        : "text-purple-900 hover:bg-white/60"
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5"/>
                    UDISE (State Portal)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportModalMode("pen")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      importModalMode === "pen"
                        ? "bg-school-navy text-white shadow-xs"
                        : "text-purple-900 hover:bg-white/60"
                    }`}
                  >
                    <IdCard className="w-3.5 h-3.5"/>
                    PEN (National Portal)
                  </button>
                </div>
              )}
              {isWizardEntry ? (
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
              {mainTab === "onlineGr" && !isWizardEntry ? (
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
                    <input type="text" value={formUdise}
                      onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={18}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder={formActiveOtherSchool ? "e.g. 242215313052520157 (optional if known)" : "18-digit state UID"}/>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 pt-1 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs font-semibold text-purple-700 cursor-pointer select-none">
                        <input type="checkbox" checked={formActiveOtherSchool}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormActiveOtherSchool(checked);
                            if (checked) {
                              if (!formUdiseSchoolName && modalRow?.lastSchoolName) {
                                setFormUdiseSchoolName(modalRow.lastSchoolName);
                              }
                              if (!formOtherSchoolName && modalRow?.lastSchoolName) {
                                setFormOtherSchoolName(modalRow.lastSchoolName);
                              }
                            }
                          }}
                          className="w-3.5 h-3.5 accent-purple-600"/>
                        Active in other school
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PEN No</label>
                    <input type="text" value={formPen} disabled={formPenNotDefined}
                      onChange={e => setFormPen(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy disabled:bg-gray-100 disabled:text-gray-400"
                      placeholder={formActiveOtherSchool ? "e.g. 20400713830 (optional if known)" : "Permanent Education Number"}/>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 pt-1 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" checked={formPenNotDefined}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormPenNotDefined(checked);
                            if (checked) {
                              setFormActiveOtherSchool(false);
                              setFormPen("");
                            }
                          }}
                          className="w-3.5 h-3.5 accent-school-navy"/>
                        PEN not generated yet by portal (mark &quot;Not Defined&quot;)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-purple-700 cursor-pointer select-none">
                        <input type="checkbox" checked={formActiveOtherSchool}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormActiveOtherSchool(checked);
                            if (checked) {
                              setFormPenNotDefined(false);
                              if (!formPenSchoolName && modalRow?.lastSchoolName) {
                                setFormPenSchoolName(modalRow.lastSchoolName);
                              }
                              if (!formOtherSchoolName && modalRow?.lastSchoolName) {
                                setFormOtherSchoolName(modalRow.lastSchoolName);
                              }
                            }
                          }}
                          className="w-3.5 h-3.5 accent-purple-600"/>
                        Active in other school
                      </label>
                    </div>
                    {renderActiveOtherSchoolFields()}
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
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      UDISE No {formActiveOtherSchool ? "(Optional if known, e.g. from portal alert)" : "(18 digits)"}
                    </label>
                    <input type="text" value={formUdise}
                      onChange={e => setFormUdise(e.target.value.replace(/[^\d]/g, ""))}
                      maxLength={18}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder={formActiveOtherSchool ? "e.g. 242215313052520157 (optional if known)" : "e.g. 242215044262310036"}/>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{formUdise.length}/18 digits</span>
                      {formActiveOtherSchool && formUdise.length === 18 && (
                        <span className="text-green-600 font-semibold">✓ 18-digit State UID entered</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 pt-1 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs font-semibold text-purple-700 cursor-pointer select-none">
                        <input type="checkbox" checked={formActiveOtherSchool}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormActiveOtherSchool(checked);
                            if (checked) {
                              if (!formUdiseSchoolName && modalRow?.lastSchoolName) {
                                setFormUdiseSchoolName(modalRow.lastSchoolName);
                              }
                              if (!formOtherSchoolName && modalRow?.lastSchoolName) {
                                setFormOtherSchoolName(modalRow.lastSchoolName);
                              }
                            }
                          }}
                          className="w-3.5 h-3.5 accent-purple-600"/>
                        Active in other school
                      </label>
                    </div>
                    {renderActiveOtherSchoolFields()}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">APAAR ID (Optional)</label>
                    <input type="text" value={formApaar} onChange={e => setFormApaar(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="APAAR ID"/>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remark (Optional)</label>
                    <input type="text" value={formRemarks} onChange={e => setFormRemarks(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="Optional remarks"/>
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
                      placeholder={formActiveOtherSchool ? "e.g. 20400713830 (optional if known)" : "e.g. 20400713830"}/>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 pt-1 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" checked={formPenNotDefined}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormPenNotDefined(checked);
                            if (checked) {
                              setFormActiveOtherSchool(false);
                              setFormPen("");
                            }
                          }}
                          className="w-3.5 h-3.5 accent-school-navy"/>
                        PEN not generated yet by the portal - mark as &quot;Not Defined&quot; for now
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-purple-700 cursor-pointer select-none">
                        <input type="checkbox" checked={formActiveOtherSchool}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormActiveOtherSchool(checked);
                            if (checked) {
                              setFormPenNotDefined(false);
                              if (!formPenSchoolName && modalRow?.lastSchoolName) {
                                setFormPenSchoolName(modalRow.lastSchoolName);
                              }
                              if (!formOtherSchoolName && modalRow?.lastSchoolName) {
                                setFormOtherSchoolName(modalRow.lastSchoolName);
                              }
                            }
                          }}
                          className="w-3.5 h-3.5 accent-purple-600"/>
                        Active in other school
                      </label>
                    </div>
                    {renderActiveOtherSchoolFields()}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">APAAR ID (Optional)</label>
                    <input type="text" value={formApaar} onChange={e => setFormApaar(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="APAAR ID"/>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remark (Optional)</label>
                    <input type="text" value={formRemarks} onChange={e => setFormRemarks(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                      placeholder="Optional remarks"/>
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
              {isWizardEntry && (
                <button
                  type="button"
                  onClick={() => {
                    setModalRow(null);
                    setAddSubPhase("details");
                    if (addStep === 2) goBackToAddStep1();
                    else if (addStep === 3) goBackToAddStep2();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer mr-auto shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5"/>
                  <span>{addStep === 2 ? "Back to Step 1 (Reg No)" : "Back to Step 2 (UDISE)"}</span>
                </button>
              )}
              <button onClick={closeModal} disabled={saving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !!formGrConflict}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                {saving
                  ? "Saving..."
                  : isWizardEntry
                  ? (addStep === 2 ? "Save & Continue to PEN Entry →" : "Save & Continue to Final Review →")
                  : (modalIsDone ? "Save Changes" : "Save")}
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
                  {(addSection || grSubTab) && (
                    <span className="text-gray-400 font-semibold">
                      {" "}— {(addSection || grSubTab) === "primary" ? "Primary Register (PR)" : "General Register (GR)"}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Step {addStep} of 4 — {
                    addStep === 1 ? "Select student & enter Reg No" :
                    addStep === 2 ? "UDISE Entry" :
                    addStep === 3 ? "PEN Entry" : "Final confirmation"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {addStep === 1 && !addSelectedStudent && hasActiveSession && inProgressSession && (
                  <button
                    type="button"
                    onClick={() => resumeProgress(inProgressSession)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                    title={`Resume last worked student: ${inProgressSession.studentName || inProgressSession.name} (${inProgressSession.grNo ? '#' + inProgressSession.grNo : 'Step ' + (inProgressSession.step || 1)})`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span>Resume: {inProgressSession.studentName || inProgressSession.name} {inProgressSession.grNo ? `(#${inProgressSession.grNo})` : `(Step ${inProgressSession.step || 1}/4)`}</span>
                  </button>
                )}
                <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5"/>
                </button>
              </div>
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

                  {/* Last Saved Register Reference Cards — Both Primary & 1st+ Registers */}
                  {(() => {
                    const primaryLast = getLastSavedGrInfo("primary", onlineGrDataset, dbStudents);
                    const generalLast = getLastSavedGrInfo("general", onlineGrDataset, dbStudents);
                    const primaryNext = primaryLast ? getNextGrNo(primaryLast.grNo) : "";
                    const generalNext = generalLast ? getNextGrNo(generalLast.grNo) : "";

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
                        {/* 1. Primary Register (Balvatika - KG) */}
                        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-blue-50/90 border border-blue-200 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 inline-block"></span>
                              Primary Last Row (Balvatika - KG)
                            </span>
                            {primaryNext && (
                              <span className="text-[10px] text-gray-500 font-medium">
                                Next: <strong className="font-mono text-blue-700 font-bold">{primaryNext}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono font-bold text-xs bg-white border border-blue-300 text-blue-950 px-2 py-0.5 rounded shadow-2xs">
                                {primaryLast?.grNo || "-"}
                              </span>
                              <span className="text-xs font-semibold text-gray-800 truncate" title={primaryLast?.name}>
                                {primaryLast?.name || "-"}
                              </span>
                              {primaryLast?.cls && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-white text-gray-600 rounded border border-gray-200 flex-shrink-0">
                                  {primaryLast.cls}
                                </span>
                              )}
                            </div>
                            {primaryLast && (primaryLast.row || primaryLast.student) && (
                              <button
                                type="button"
                                onClick={() => openLastStudentForm(primaryLast, "primary")}
                                title={`Resume government entry for ${primaryLast.name} (${primaryLast.grNo})`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer flex-shrink-0"
                              >
                                <RotateCcw className="w-3 h-3 text-blue-200" />
                                <span>Resume</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. 1st+ (General Register, Class 1st to 12th) */}
                        <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-indigo-50/90 border border-indigo-200 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 inline-block"></span>
                              1st+ Last Row (Class 1st to 12th)
                            </span>
                            {generalNext && (
                              <span className="text-[10px] text-gray-500 font-medium">
                                Next: <strong className="font-mono text-indigo-700 font-bold">{generalNext}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono font-bold text-xs bg-white border border-indigo-300 text-indigo-950 px-2 py-0.5 rounded shadow-2xs">
                                {generalLast?.grNo || "-"}
                              </span>
                              <span className="text-xs font-semibold text-gray-800 truncate" title={generalLast?.name}>
                                {generalLast?.name || "-"}
                              </span>
                              {generalLast?.cls && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-white text-gray-600 rounded border border-gray-200 flex-shrink-0">
                                  {generalLast.cls}
                                </span>
                              )}
                            </div>
                            {generalLast && (generalLast.row || generalLast.student) && (
                              <button
                                type="button"
                                onClick={() => openLastStudentForm(generalLast, "general")}
                                title={`Resume government entry for ${generalLast.name} (${generalLast.grNo})`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer flex-shrink-0"
                              >
                                <RotateCcw className="w-3 h-3 text-indigo-200" />
                                <span>Resume</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                      {STATUS_FILTER_OPTIONS.map(o => (
                        <option key={o} value={o}>{o === "All" ? "All Statuses" : o}</option>
                      ))}
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
                    <button type="button" onClick={changeAddStudent} className="text-[10px] font-semibold text-school-navy hover:underline cursor-pointer">
                      Change student
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">AY</span><div className="font-semibold text-gray-700">{addSelectedStudent.session || "-"}</div></div>
                    <div><span className="text-gray-400">TC</span><div className="font-semibold text-gray-700">{addReview?.tcStatus}</div></div>
                    <div><span className="text-gray-400">STD</span><div className="font-semibold text-gray-700">{addSelectedStudent.cls}</div></div>
                    <div><span className="text-gray-400">NAME</span><div className="font-semibold text-gray-700">{addSelectedStudent.name}</div></div>
                    <div><span className="text-gray-400">DOB</span><div className="font-semibold text-gray-700">{addReview?.dobDMY || addReview?.dobSlash || fmtDate(addSelectedStudent.dob) || "-"}</div></div>
                    <div><span className="text-gray-400">AADHAR</span><div className="font-semibold text-gray-700">{addSelectedStudent.aadharNo || "-"}</div></div>
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
                    const lastInfo = getLastSavedGrInfo(addSection, onlineGrDataset, dbStudents);
                    const nextGr = lastInfo ? getNextGrNo(lastInfo.grNo) : "";

                    const lastSavedBanner = lastInfo ? (
                      <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-blue-50/80 border border-blue-200 rounded-lg text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-blue-900 uppercase tracking-wide text-[10px]">
                            Last Saved in {isPrimary ? "Primary Register (PR)" : "General Register (GR)"}:
                          </span>
                          <span className="font-mono font-bold text-blue-950 bg-white border border-blue-300 px-2 py-0.5 rounded shadow-2xs">
                            {lastInfo.grNo}
                          </span>
                          <span className="font-semibold text-gray-800">
                            — {lastInfo.name}
                          </span>
                          {lastInfo.cls && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-white text-gray-600 rounded border border-gray-200">
                              {lastInfo.cls}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          {nextGr && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[11px] text-gray-500 font-medium">Suggested Next:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddGrNo(nextGr);
                                  setAddGrEditing(true);
                                  if (addError) setAddError("");
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                title={`Click to fill ${nextGr}`}
                              >
                                {nextGr}
                                <span className="text-[10px] font-normal opacity-90">(Use)</span>
                              </button>
                            </div>
                          )}
                          {lastInfo && (lastInfo.row || lastInfo.student) && (
                            <button
                              type="button"
                              onClick={() => openLastStudentForm(lastInfo, addSection)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-school-navy hover:bg-blue-900 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                              title={`Resume government entry for ${lastInfo.name} (${lastInfo.grNo})`}
                            >
                              <RotateCcw className="w-3 h-3 text-blue-200" />
                              <span>Resume</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null;

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
                      <div className="flex flex-col gap-2">
                        {lastSavedBanner}
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
                            <span className="text-[11px] text-gray-600 flex items-center gap-1">
                              {addGrNo && nextGr && addGrNo.trim() === nextGr.trim() ? (
                                <span className="text-green-700 font-medium">✓ Pre-filled with next sequential {isPrimary ? "PR" : "GR"} number.</span>
                              ) : (
                                <span className="text-amber-700">ℹ️ Student currently does not have a {isPrimary ? "PR No" : "GR No"} assigned. Enter or adjust it here to save.</span>
                              )}
                            </span>
                          )}
                        </div>
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
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Review and confirm {addSelectedStudent?.name}&apos;s details before finalizing entry. You can enter or update the Remark below.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div><span className="text-gray-400">DOB</span><div className="font-semibold text-gray-700">{addReview?.dobSlash || "-"}</div></div>
                    <div><span className="text-gray-400">DOA</span><div className="font-semibold text-gray-700">{addReview?.doaSlash || "-"}</div></div>
                    <div><span className="text-gray-400">DOE</span><div className="font-semibold text-gray-700">{addDoeSlash || addReview?.doeSlash || getTodaySlash()}</div></div>
                    <div><span className="text-gray-400">AADHAR</span><div className="font-semibold text-gray-700">{addSelectedStudent?.aadharNo || "-"}</div></div>
                    <div><span className="text-gray-400">UID</span><div className="font-semibold text-gray-700">{addSelectedStudent?.udise || "-"}</div></div>
                    <div><span className="text-gray-400">PEN</span><div className="font-semibold text-gray-700">{addSelectedStudent?.pen || "-"}</div></div>
                    <div><span className="text-gray-400">APAAR</span><div className="font-semibold text-gray-700">{addSelectedStudent?.apaar || "-"}</div></div>
                    <div><span className="text-gray-400">DOCUMENTS PENDING</span><div className="font-semibold text-gray-700 truncate">{addReview?.documentsPending || "-"}</div></div>
                  </div>

                  {(() => {
                    const os = parseOtherSchoolRemarks(addRemarks) || parseOtherSchoolRemarks(addSelectedStudent?.remarks) || addReview?.otherSchoolData;
                    if (!os) return null;
                    return (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-purple-900">
                          <School className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
                          <span>Active in Other School</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700 mt-1">
                          <div><span className="text-gray-400">School: </span><span className="font-medium">{os.schoolName || "-"}</span></div>
                          <div><span className="text-gray-400">UDISE: </span><span className="font-mono font-medium">{os.schoolUdise || "-"}</span></div>
                          <div><span className="text-gray-400">Location: </span><span>{[os.block, os.district, os.state].filter(Boolean).join(", ") || "-"}</span></div>
                          <div><span className="text-gray-400">HM / Contact: </span><span>{[os.headmaster, os.contactNo].filter(Boolean).join(" - ") || "-"}</span></div>
                          <div><span className="text-gray-400">Status: </span><span className="font-semibold text-purple-800">{os.status || "Active in School"}</span></div>
                          {os.remark && <div className="col-span-2"><span className="text-gray-400">Other School Remark: </span><span>{os.remark}</span></div>}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remark</label>
                    <input
                      type="text"
                      value={stripOtherSchoolTag(addRemarks)}
                      onChange={e => {
                        const os = parseOtherSchoolRemarks(addRemarks) || parseOtherSchoolRemarks(addSelectedStudent?.remarks) || addReview?.otherSchoolData;
                        setAddRemarks(buildCombinedRemarks(e.target.value, os));
                      }}
                      placeholder="Optional remarks"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                    />
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
              {addStep === 4 && (() => {
                const udiseInfo = addSelectedStudent ? eligibilityFns.getUdiseEligibility(addSelectedStudent) : { eligible: false };
                const penInfo = addSelectedStudent ? eligibilityFns.getPenEligibility(addSelectedStudent) : { eligible: false };

                let backFn = goBackToAddStep3;
                let backLabel = "Back to Step 3 (PEN Entry)";

                if (!penInfo.eligible) {
                  if (!udiseInfo.eligible) {
                    backFn = goBackToAddStep1;
                    backLabel = "Back to Step 1 (Reg No)";
                  } else {
                    backFn = goBackToAddStep2;
                    backLabel = "Back to Step 2 (UDISE)";
                  }
                }

                return (
                  <button
                    type="button"
                    onClick={backFn}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer mr-auto shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5"/>
                    <span>{backLabel}</span>
                  </button>
                );
              })()}
              <button onClick={closeAddModal} disabled={addSaving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              {addStep === 1 && (
                (() => {
                  const udiseInfo = addSelectedStudent ? eligibilityFns.getUdiseEligibility(addSelectedStudent) : { eligible: false };
                  const penInfo = addSelectedStudent ? eligibilityFns.getPenEligibility(addSelectedStudent) : { eligible: false };
                  const bothIneligible = addSelectedStudent && !udiseInfo.eligible && !penInfo.eligible;
                  const hasUdise = Boolean(
                    (addSelectedStudent?.udise && addSelectedStudent.udise !== "-" && addSelectedStudent.udise !== "Active in other school" && addSelectedStudent.udise !== "Pending") ||
                    addSelectedStudent?.udiseStatus === "Done"
                  );

                  if (bothIneligible) {
                    return (
                      <button onClick={() => saveStep1AndContinue()} disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-60 cursor-pointer">
                        {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                        {addSaving ? "Saving..." : "Save & Mark Ineligible (Next Steps Disabled)"}
                      </button>
                    );
                  }

                  if (!udiseInfo.eligible) {
                    return (
                      <button onClick={() => saveStep1AndContinue("pen")} disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer">
                        {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                        {addSaving ? "Saving..." : "Save & Skip to PEN Entry (UDISE Ineligible) →"}
                      </button>
                    );
                  }

                  if (hasUdise && penInfo.eligible) {
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveStep1AndContinue("udise")}
                          disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60 cursor-pointer"
                          title="Review or edit UDISE number in Step 2"
                        >
                          Review UDISE (Step 2)
                        </button>
                        <button
                          type="button"
                          onClick={() => saveStep1AndContinue("pen")}
                          disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60 shadow-xs cursor-pointer"
                        >
                          {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                          {addSaving ? "Saving..." : "Save & Continue to PEN Entry (UDISE Done) →"}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button onClick={() => saveStep1AndContinue("udise")} disabled={addSaving || !addSelectedStudent || !!addGrConflict}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-60 cursor-pointer">
                      {addSaving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                      {addSaving ? "Saving..." : "Save & Continue to UDISE Entry"}
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
