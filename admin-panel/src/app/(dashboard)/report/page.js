"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap, IndianRupee, Users, Package, Search,
  RefreshCw, Download, FileText, ShieldCheck, BookOpen, Landmark, IdCard,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getStudentsForReport, getFeesForReport,
  getEmployeesForReport, getInventoryForReport,
  getPaymentsForReport, getAcademicYearLabels,
} from "@/lib/reportService";
import DateInputDMY from "@/components/DateInputDMY";

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES   = ["JR.KG","SR.KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th - Commerce","12th - Commerce"];
const GENDERS   = ["Male","Female","Other"];
const RELIGIONS = ["Hindu","Muslim","Christian","Jain","Sikh","Buddhist","Parsi","Other"];
const CASTES    = ["General","OBC","SC","ST","EWS","SEBC","Other"];
const SESSIONS_FALLBACK = ["2026-27","2025-26","2024-25","2023-24"];
const STU_STATUSES = ["Active","Leave","Inactive"];
const EMP_ROLES    = ["Principal","Vice Principal","Director","Coordinator","Class Teacher","Subject Teacher","HOD","PGT","TGT","PRT","Accountant","Admin","Librarian","Lab Assistant","Peon","Security","Clerk","Receptionist","Care Taker","Social Media Manager","Editor","Content Creator","Photographer","Videographer"];
const EMP_STATUSES = ["Active","On Leave","Resigned"];

// ── DOB to Words ──────────────────────────────────────────────────────────────
function dobToWords(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return "";
  const yr = parseInt(parts[0]), mo = parseInt(parts[1]), dy = parseInt(parts[2]);
  if (!yr || !mo || !dy) return "";
  const dN = ["","First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth",
    "Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth",
    "Nineteenth","Twentieth","Twenty-First","Twenty-Second","Twenty-Third","Twenty-Fourth","Twenty-Fifth",
    "Twenty-Sixth","Twenty-Seventh","Twenty-Eighth","Twenty-Ninth","Thirtieth","Thirty-First"];
  const mN = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function n2w(n) { return n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : ""); }
  const rem = yr - 2000;
  const yStr = rem === 0 ? "Two Thousand" : "Two Thousand " + n2w(rem);
  return `${dN[dy]||dy} ${mN[mo]||mo} ${yStr}`;
}

// ── Date Formatting (DD/MM/YYYY everywhere) ──────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return dateStr;
  return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
}

function formatCellValue(col, value) {
  if (value === undefined || value === null || value === "") return "";
  return col.isDate ? fmtDate(value) : value;
}

// ── Father/Mother Name with Surname ──────────────────────────────────────────
function nameWithSurname(name, surname) {
  return [name, surname].filter(Boolean).join(" ").trim();
}

// ── DOB as DD-MM-YYYY ─────────────────────────────────────────────────────────
function fmtDateDMY(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d.padStart(2,"0")}-${m.padStart(2,"0")}-${y}`;
}

// ── DOB split into Year / Month ("1-Jan") / Date ─────────────────────────────
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

// ── Eligibility Logic ─────────────────────────────────────────────────────────
function computeElig(st) {
  const hasAadhar    = !!(st.aadharNo && st.aadharNo.trim());
  const hasBirthCert = !!st.hasBirthCert;
  const expected     = `${st.firstName} ${st.fatherName} ${st.lastName}`.toLowerCase().replace(/\s+/g," ").trim();
  const nameMatch    = hasAadhar && !!st.aadharName &&
    st.aadharName.toLowerCase().replace(/\s+/g," ").trim() === expected;
  const udiseElig = hasBirthCert;
  const penElig   = hasBirthCert && hasAadhar;
  const apaarElig = hasBirthCert && hasAadhar && nameMatch;
  // "Done" reflects whether the student actually has the number on file —
  // independent of eligibility. A student can already have a UDISE/PEN number
  // (e.g. entered from a previous school) even if their birth certificate
  // upload isn't marked done in this system; eligibility shouldn't hide that.
  return {
    hasBirthCert, hasAadhar, nameMatch,
    udiseElig, penElig, apaarElig,
    udiseDone: !!(st.udise && st.udise.trim()),
    penDone:   !!(st.pen   && st.pen.trim()),
    apaarDone: !!(st.apaar && st.apaar.trim()),
  };
}


// ── Fee Collection Period Summaries ──────────────────────────────────────────
function computeCollectionSummary(payments) {
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Start of this week (Monday)
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const monthStartStr = todayStr.slice(0, 7) + "-01";
  const yearStartStr  = todayStr.slice(0, 4) + "-01-01";

  function sumFrom(from) {
    return (payments || [])
      .filter(p => p.date >= from && p.date <= todayStr)
      .reduce((s, p) => s + p.amount, 0);
  }

  return [
    { label: "Today",      period: todayStr,      value: sumFrom(todayStr),      color: "blue"    },
    { label: "This Week",  period: weekStartStr,  value: sumFrom(weekStartStr),  color: "indigo"  },
    { label: "This Month", period: monthStartStr, value: sumFrom(monthStartStr), color: "emerald" },
    { label: "This Year",  period: yearStartStr,  value: sumFrom(yearStartStr),  color: "green"   },
  ];
}

// ── Fixed-Structure Register Entries (GR / UDISE / PEN) ───────────────────────
const RED_BAG_CLASSES = new Set(["JR.KG", "SR.KG", "Balvatika", "1st", "2nd"]);
function getBagColor(cls) {
  return RED_BAG_CLASSES.has(cls) ? "Red" : "Blue";
}

function decorateStudentForEntry(st) {
  return {
    ...st,
    dobInWords:           dobToWords(st.dob),
    dobDMY:               fmtDateDMY(st.dob),
    ...dobParts(st.dob),
    religionCaste:        `${st.religion || "-"}${st.caste ? " - " + st.caste : ""}`,
    lastSchoolGrSchool:   `${st.lastSchoolGrNo || "-"} - ${st.lastSchoolName || "-"}`,
    firstAdmissionStd:    st.joinClass,
    studentFatherSurname: `${st.firstName || ""} ${st.fatherName || ""} ${st.surname || ""}`.trim(),
    fatherNameOnly:       st.fatherName || "",
    motherNameOnly:       st.motherName || "",
    fatherName:           nameWithSurname(st.fatherName, st.surname),
    motherName:           nameWithSurname(st.motherName, st.surname),
    fullAddress:          [st.plotNo, st.society, st.landmark, st.area, "Surat", "Gujarat", st.pinCode].filter(Boolean).join(", "),
    bagColor:             getBagColor(st.cls),
  };
}

function entryGetData(sourceData, f, df, dt, s) {
  let d = (sourceData || []).map(decorateStudentForEntry);
  if (f.cls     && f.cls     !== "All") d = d.filter(x => x.cls     === f.cls);
  if (f.session && f.session !== "All") d = d.filter(x => x.session === f.session);
  if (s) d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()) || x.enrollNo.toLowerCase().includes(s.toLowerCase()));
  return d;
}

function entryCompleteness(row, cols) {
  return cols.every(c => {
    const v = row[c.key];
    return v !== undefined && v !== null && String(v).trim() !== "" && String(v) !== "-";
  });
}

function entryGetSummary(cols) {
  return d => {
    const complete = d.filter(r => entryCompleteness(r, cols)).length;
    return [
      {label:"Total Students",     value:d.length,          color:"blue"  },
      {label:"Complete Records",   value:complete,          color:"green" },
      {label:"Incomplete Records", value:d.length-complete, color:"red"   },
    ];
  };
}

const ENTRY_QUICK_FILTERS = [
  {key:"cls",     label:"Class",         options:["All",...CLASSES] },
  {key:"session", label:"Academic Year", options:["All",...SESSIONS_FALLBACK]},
];

// pool of optional fields that can be inserted as a one-off "extra field" into a fixed register
const STUDENT_FIELD_POOL = [
  { key:"enrollNo",       label:"Enroll No" },
  { key:"status",         label:"Status" },
  { key:"session",        label:"Academic Year" },
  { key:"religion",       label:"Religion" },
  { key:"caste",          label:"Category/Caste" },
  { key:"gender",         label:"Gender" },
  { key:"mobile1",        label:"Mobile No 1" },
  { key:"mobile2",        label:"Mobile No 2" },
  { key:"remarks",        label:"Remarks" },
  { key:"followUp",       label:"Follow Up" },
  { key:"placeOfBirth",      label:"Place of Birth" },
  { key:"birthState",        label:"Birth State" },
  { key:"birthDistrict",     label:"Birth District" },
  { key:"birthCity",         label:"Birth City" },
  { key:"lastSchoolName",    label:"Last School Name" },
  { key:"roll",              label:"Roll No" },
  { key:"joinDate",          label:"Date of Admission",      isDate:true },
  { key:"dob",               label:"Date of Birth",          isDate:true },
  { key:"fatherAadhar",      label:"Father's Aadhar No" },
  { key:"fatherAadharName",  label:"Father's Name as per Aadhar" },
  { key:"motherAadhar",      label:"Mother's Aadhar No" },
  { key:"motherAadharName",  label:"Mother's Name as per Aadhar" },
  { key:"birthCertRegNo",    label:"Birth Cert Reg No" },
  { key:"birthCertRegDate",  label:"Birth Cert Reg Date",    isDate:true },
  { key:"fullAddress",       label:"Full Address" },
  { key:"bagColor",          label:"Bag Color" },
  { key:"subCaste",          label:"Sub Caste" },
  { key:"prevAttendanceDays",label:"Previous Year Attendance Days" },
  { key:"lastExamGiven",     label:"Last Exam Given or Not" },
  { key:"prevPercentage",    label:"If Given Percentage" },
];

const GR_REGISTER_COLUMNS = [
  { key:"grNo",              label:"GR No" },
  { key:"surname",           label:"Surname" },
  { key:"name",              label:"Student Name" },
  { key:"fatherName",        label:"Father's Name" },
  { key:"motherName",        label:"Mother's Name" },
  { key:"religionCaste",     label:"Religion & Caste" },
  { key:"placeOfBirth",      label:"Place of Birth" },
  { key:"dob",               label:"Date of Birth (in Number)", isDate:true },
  { key:"dobInWords",        label:"Date of Birth (in Word)" },
  { key:"lastSchoolGrSchool",label:"Last School GR No & School Name" },
  { key:"joinDate",          label:"Date of Admission", isDate:true },
  { key:"firstAdmissionStd", label:"First Admission in STD" },
  { key:"aadharNo",          label:"Aadhar No" },
  { key:"udise",             label:"UDISE No" },
  { key:"apaar",             label:"APAAR ID" },
  { key:"pen",               label:"PEN No" },
];

const PEN_ENTRY_COLUMNS = [
  { key:"cls",                  label:"Class" },
  { key:"studentFatherSurname", label:"Student Father Surname" },
  { key:"gender",                label:"Gender" },
  { key:"dob",                   label:"Date of Birth", isDate:true },
  { key:"udise",                 label:"Student State Code (UDISE No)" },
  { key:"motherName",            label:"Mother's Name" },
  { key:"fatherName",            label:"Father's Name" },
  { key:"aadharNo",              label:"Aadhar Number of Student" },
  { key:"aadharName",            label:"Name of Student as per Aadhar Card" },
  { key:"joinDate",               label:"Admission Date", isDate:true },
  { key:"fullAddress",            label:"Full Address" },
  { key:"pinCode",                label:"Pincode" },
  { key:"mobile1",                label:"Mobile No 1" },
  { key:"mobile2",                label:"Mobile No 2" },
  { key:"motherTongue",           label:"Mother Tongue" },
  { key:"grNo",                   label:"Admission Number in Present School (GR No)" },
  { key:"roll",                   label:"Roll No" },
  { key:"prevPercentage",         label:"Previous Class Percentage" },
  { key:"prevAttendanceDays",     label:"Previous Class Attendance Days" },
  { key:"height",                 label:"Height (cm)" },
  { key:"weight",                 label:"Weight (kg)" },
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
  { key:"birthCity",         label:"Birth City" },
  { key:"firstName",         label:"Student Name" },
  { key:"fatherNameOnly",    label:"Father's Name" },
  { key:"motherNameOnly",    label:"Mother's Name" },
  { key:"surname",           label:"Surname" },
  { key:"dobDMY",             label:"Date of Birth" },
  { key:"grNo",               label:"GR No" },
  { key:"roll",               label:"Roll No" },
  { key:"plotNo",             label:"Plot Number" },
  { key:"society",            label:"Society" },
  { key:"landmark",           label:"Landmark" },
  { key:"area",               label:"Area" },
  { key:"pinCode",            label:"Pin Code" },
  { key:"motherTongue",       label:"Mother Tongue" },
  { key:"joinDate",           label:"Date of Join", isDate:true },
  { key:"aadharNo",           label:"Aadhar Card No" },
  { key:"aadharName",         label:"Name as per Aadhar" },
  { key:"mobile1",             label:"Mobile No 1" },
  { key:"mobile2",             label:"Mobile No 2" },
];

const ID_CARD_COLUMNS = [
  { key:"name",        label:"Student Name" },
  { key:"cls",         label:"Class" },
  { key:"fatherName",  label:"Father's Name" },
  { key:"motherName",  label:"Mother's Name" },
  { key:"dob",         label:"Date of Birth", isDate:true },
  { key:"mobile1",     label:"Mobile No. 1" },
  { key:"mobile2",     label:"Mobile No. 2" },
  { key:"fullAddress", label:"Full Address" },
  { key:"bagColor",    label:"Bag Color" },
];

// insert the optional "extra field"(s) into the fixed column order at the chosen position
function buildFixedCols(fixedCols, extras) {
  let list = [...fixedCols];
  extras.forEach(ef => {
    const idx = Math.min(Math.max(ef.position - 1, 0), list.length);
    list.splice(idx, 0, { key: ef.key, label: ef.label, isExtra: true, isDate: ef.isDate });
  });
  return list;
}

// ── Report Configs ─────────────────────────────────────────────────────────────
const REPORT_CONFIGS = {
  student: {
    label:"Student Report", icon:GraduationCap,
    quickFilters:[
      {key:"cls",      label:"Class",         options:["All",...CLASSES]      },
      {key:"status",   label:"Status",        options:["All",...STU_STATUSES] },
      {key:"session",  label:"Academic Year", options:["All",...SESSIONS_FALLBACK]     },
      {key:"gender",   label:"Gender",        options:["All",...GENDERS]      },
      {key:"religion", label:"Religion",      options:["All",...RELIGIONS]    },
      {key:"caste",    label:"Category",      options:["All",...CASTES]       },
    ],
    dateField:"joinDate", dateLabel:"Admission Date",
    columns:[
      {key:"enrollNo",       label:"Enroll No",       dflt:true  },
      {key:"name",           label:"Student Name",    dflt:true  },
      {key:"fatherName",     label:"Father Name",     dflt:true  },
      {key:"motherName",     label:"Mother Name",     dflt:false },
      {key:"surname",        label:"Surname",         dflt:false },
      {key:"mobile1",        label:"Mobile No 1",     dflt:true  },
      {key:"mobile2",        label:"Mobile No 2",     dflt:false },
      {key:"dob",            label:"DOB",             dflt:true,  isDate:true },
      {key:"joinDate",       label:"DOJ",             dflt:false, isDate:true },
      {key:"joinClass",      label:"Class of Join",   dflt:false },
      {key:"cls",            label:"Current Class",   dflt:true  },
      {key:"status",         label:"Status",          dflt:true  },
      {key:"session",        label:"Academic Year",   dflt:true  },
      {key:"religion",       label:"Religion",        dflt:false },
      {key:"caste",          label:"Category",        dflt:false },
      {key:"aadharNo",       label:"Aadhar",          dflt:false },
      {key:"udise",          label:"UDISE No",        dflt:false },
      {key:"pen",            label:"PEN",             dflt:true  },
      {key:"apaar",          label:"APAAR",           dflt:true  },
      {key:"grNo",           label:"GR No",           dflt:true  },
      {key:"roll",           label:"Roll No",         dflt:true  },
      {key:"placeOfBirth",   label:"Place of Birth",  dflt:false },
      {key:"dobInWords",     label:"DOB in Words",    dflt:false },
      {key:"lastSchoolName", label:"Last School",     dflt:false },
      {key:"gender",         label:"Gender",          dflt:true  },
      {key:"remarks",        label:"Issue/Remarks",   dflt:false },
      {key:"followUp",       label:"Follow Up",       dflt:false },
    ],
    getData(sourceData, f, df, dt, s) {
      let d = (sourceData || []).map(st => ({
        ...st,
        dobInWords: dobToWords(st.dob),
        fatherName: nameWithSurname(st.fatherName, st.surname),
        motherName: nameWithSurname(st.motherName, st.surname),
      }));
      if (f.cls      && f.cls      !== "All") d = d.filter(x => x.cls      === f.cls);
      if (f.status   && f.status   !== "All") d = d.filter(x => x.status   === f.status);
      if (f.session  && f.session  !== "All") d = d.filter(x => x.session  === f.session);
      if (f.gender   && f.gender   !== "All") d = d.filter(x => x.gender   === f.gender);
      if (f.religion && f.religion !== "All") d = d.filter(x => x.religion === f.religion);
      if (f.caste    && f.caste    !== "All") d = d.filter(x => x.caste    === f.caste);
      if (df) d = d.filter(x => x.joinDate >= df);
      if (dt) d = d.filter(x => x.joinDate <= dt);
      if (s)  d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()) || x.enrollNo.toLowerCase().includes(s.toLowerCase()));
      return d;
    },
    getSummary(d) { return [
      {label:"Total Students", value:d.length,                                color:"blue"  },
      {label:"Active",         value:d.filter(x=>x.status==="Active").length, color:"green" },
      {label:"Leave",          value:d.filter(x=>x.status==="Leave").length,  color:"orange"},
      {label:"Inactive",       value:d.filter(x=>x.status==="Inactive").length,color:"red"   },
    ];},
  },
  fees: {
    label:"Fees", icon:IndianRupee,
    isFeesModule:true,
    collectionConfig: {
      label:"Fee Collection",
      isCollection:true,
      quickFilters:[
        {key:"cls",     label:"Class",         options:["All",...CLASSES]  },
        {key:"session", label:"Academic Year",  options:["All",...SESSIONS_FALLBACK] },
      ],
      dateField:"date", dateLabel:"Payment Date",
      columns:[
        {key:"date",        label:"Payment Date",  dflt:true, isDate:true },
        {key:"enrollNo",    label:"Enroll No",     dflt:true              },
        {key:"studentName", label:"Student Name",  dflt:true              },
        {key:"cls",         label:"Class",         dflt:true              },
        {key:"session",     label:"Academic Year", dflt:false             },
        {key:"amount",      label:"Amount (Rs)",   dflt:true              },
      ],
      getData(sourceData, f, df, dt, s) {
        let d = (sourceData || []);
        if (f.cls     && f.cls     !== "All") d = d.filter(x => x.cls     === f.cls);
        if (f.session && f.session !== "All") d = d.filter(x => x.session === f.session);
        if (df) d = d.filter(x => x.date >= df);
        if (dt) d = d.filter(x => x.date <= dt);
        if (s)  d = d.filter(x => x.studentName.toLowerCase().includes(s.toLowerCase()) || x.enrollNo.toLowerCase().includes(s.toLowerCase()));
        return d;
      },
      getSummary(d) {
        const total = d.reduce((s,x) => s + x.amount, 0);
        return [
          {label:"Transactions",    value:d.length,                                     color:"blue"   },
          {label:"Total Collected", value:`Rs ${total.toLocaleString("en-IN")}`,         color:"emerald"},
        ];
      },
    },
    statusConfig: {
      label:"Fee Status",
      quickFilters:[
        {key:"cls",    label:"Class",  options:["All",...CLASSES]                       },
        {key:"status", label:"Status", options:["All","Fully Paid","Partial","Pending"] },
      ],
      dateField:null, dateLabel:null,
      columns:[
        {key:"enrollNo",  label:"Enroll No",       dflt:true },
        {key:"name",      label:"Student Name",    dflt:true },
        {key:"cls",       label:"Class",           dflt:true },
        {key:"totalFee",  label:"Annual Fee (Rs)", dflt:true },
        {key:"discount",  label:"Discount (Rs)",   dflt:false},
        {key:"totalPaid", label:"Paid (Rs)",        dflt:true },
        {key:"pending",   label:"Pending (Rs)",     dflt:true },
        {key:"status",    label:"Status",          dflt:true },
      ],
      getData(sourceData, f, df, dt, s) {
        let d = (sourceData || []);
        if (f.cls    && f.cls    !== "All") d = d.filter(x => x.cls    === f.cls);
        if (f.status && f.status !== "All") d = d.filter(x => x.status === f.status);
        if (s) d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()));
        return d;
      },
      getSummary(d) {
        const coll = d.reduce((s,x)=>s+x.totalPaid,0);
        const pend = d.reduce((s,x)=>s+x.pending,0);
        return [
          {label:"Students",   value:d.length,                                                                   color:"emerald"},
          {label:"Total Fees", value:`Rs ${d.reduce((s,x)=>s+x.totalFee-x.discount,0).toLocaleString("en-IN")}`, color:"blue"   },
          {label:"Collected",  value:`Rs ${coll.toLocaleString("en-IN")}`,                                        color:"green"  },
          {label:"Pending",    value:`Rs ${pend.toLocaleString("en-IN")}`,                                        color:"red"    },
        ];
      },
    },
  },
  employee: {
    label:"Employee Report", icon:Users,
    quickFilters:[
      {key:"role",   label:"Role",   options:["All",...EMP_ROLES]    },
      {key:"status", label:"Status", options:["All",...EMP_STATUSES] },
    ],
    dateField:"joinDate", dateLabel:"Join Date",
    columns:[
      {key:"name",          label:"Employee Name",  dflt:true },
      {key:"role",          label:"Role",           dflt:true },
      {key:"subject",       label:"Subject",        dflt:true },
      {key:"qualification", label:"Qualification",  dflt:false},
      {key:"mobile",        label:"Mobile",         dflt:true },
      {key:"email",         label:"Email",          dflt:false},
      {key:"salary",        label:"Salary (Rs)",    dflt:true },
      {key:"joinDate",      label:"Join Date",      dflt:false, isDate:true},
      {key:"status",        label:"Status",         dflt:true },
    ],
    getData(sourceData, f, df, dt, s) {
      let d = (sourceData || []);
      if (f.role   && f.role   !== "All") d = d.filter(x => x.role   === f.role);
      if (f.status && f.status !== "All") d = d.filter(x => x.status === f.status);
      if (df) d = d.filter(x => x.joinDate >= df);
      if (dt) d = d.filter(x => x.joinDate <= dt);
      if (s)  d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()));
      return d;
    },
    getSummary(d) { return [
      {label:"Total Staff",  value:d.length,                                                    color:"purple"},
      {label:"Active",       value:d.filter(x=>x.status==="Active").length,                    color:"green" },
      {label:"Teachers",     value:d.filter(x=>x.role==="Teacher").length,                     color:"blue"  },
      {label:"Total Salary", value:`Rs ${d.reduce((s,x)=>s+x.salary,0).toLocaleString("en-IN")}`,color:"amber" },
    ];},
  },
  inventory: {
    label:"Inventory & Asset Report", icon:Package,
    quickFilters:[
      {key:"category", label:"Category", options:["All","student","stock","office","other"]},
      {key:"status",   label:"Status",   options:["All","Active","Maintenance","Disposed"]},
    ],
    dateField:"purchaseDate", dateLabel:"Purchase Date",
    columns:[
      {key:"name",         label:"Asset Name",    dflt:true },
      {key:"category",     label:"Category",      dflt:true },
      {key:"location",     label:"Location",      dflt:true },
      {key:"status",       label:"Status",        dflt:true },
      {key:"assignedTo",   label:"Assigned To",   dflt:false},
      {key:"purchaseDate", label:"Purchase Date", dflt:false, isDate:true},
      {key:"value",        label:"Available Qty", dflt:true },
    ],
    getData(sourceData, f, df, dt, s) {
      let d = (sourceData || []);
      if (f.category && f.category !== "All") d = d.filter(x => x.category === f.category);
      if (f.status   && f.status   !== "All") d = d.filter(x => x.status   === f.status);
      if (df) d = d.filter(x => x.purchaseDate >= df);
      if (dt) d = d.filter(x => x.purchaseDate <= dt);
      if (s)  d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()));
      return d;
    },
    getSummary(d) { return [
      {label:"Total Assets", value:d.length,                                                  color:"amber" },
      {label:"Active",       value:d.filter(x=>x.status==="Active").length,                  color:"green" },
      {label:"Maintenance",  value:d.filter(x=>x.status==="Maintenance").length,             color:"orange"},
      {label:"Total Available", value:d.filter(x=>x._type==="stock").reduce((s,x)=>s+x.value,0), color:"blue" },
    ];},
  },
  eligibility: {
    label:"ID Eligibility", icon:ShieldCheck,
    isEligibility:true,
    quickFilters:[
      {key:"cls",        label:"Class",  options:["All",...CLASSES]},
      {key:"eligFilter", label:"Status", options:["All","Eligible-Pending","Completed","Not Eligible"]},
    ],
    dateField:null, dateLabel:null,
    columns:[],
    getData(sourceData, f, df, dt, s) {
      let d = (sourceData || []).map(st => ({ ...st, elig: computeElig(st) }));
      if (f.cls && f.cls !== "All") d = d.filter(x => x.cls === f.cls);
      if (s) d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()) || x.enrollNo.toLowerCase().includes(s.toLowerCase()));
      if (f.eligFilter && f.eligFilter !== "All") {
        d = d.filter(x => {
          const e = x.elig;
          const anyElig = e.udiseElig || e.penElig || e.apaarElig;
          const anyDone = e.udiseDone || e.penDone || e.apaarDone;
          if (f.eligFilter === "Not Eligible")    return !anyElig;
          if (f.eligFilter === "Completed")       return anyDone;
          if (f.eligFilter === "Eligible-Pending") return anyElig && !anyDone;
          return true;
        });
      }
      return d;
    },
    getSummary(d) {
      const el = d.map(x => x.elig || computeElig(x));
      return [
        {label:"Total Students", value:d.length,                                color:"blue"  },
        {label:"UDISE Eligible", value:el.filter(e=>e.udiseElig).length,        color:"indigo"},
        {label:"PEN Eligible",   value:el.filter(e=>e.penElig).length,          color:"amber" },
        {label:"APAAR Eligible", value:el.filter(e=>e.apaarElig).length,        color:"purple"},
      ];
    },
  },
  grRegister: {
    label:"GR Register Entry", icon:BookOpen,
    isFixedEntry:true,
    fixedColumns: GR_REGISTER_COLUMNS,
    extraFieldPool: STUDENT_FIELD_POOL.filter(f => !GR_REGISTER_COLUMNS.some(c => c.key === f.key)),
    quickFilters: ENTRY_QUICK_FILTERS,
    dateField:null, dateLabel:null,
    columns: GR_REGISTER_COLUMNS,
    getData: entryGetData,
    getSummary: entryGetSummary(GR_REGISTER_COLUMNS),
  },
  udiseEntry: {
    label:"UDISE Entry (State)", icon:Landmark,
    isFixedEntry:true,
    fixedColumns: UDISE_ENTRY_COLUMNS,
    extraFieldPool: STUDENT_FIELD_POOL.filter(f => !UDISE_ENTRY_COLUMNS.some(c => c.key === f.key)),
    quickFilters: ENTRY_QUICK_FILTERS,
    dateField:null, dateLabel:null,
    columns: UDISE_ENTRY_COLUMNS,
    getData: entryGetData,
    getSummary: entryGetSummary(UDISE_ENTRY_COLUMNS),
  },
  penEntry: {
    label:"PEN Entry (National)", icon:IdCard,
    isFixedEntry:true,
    fixedColumns: PEN_ENTRY_COLUMNS,
    extraFieldPool: STUDENT_FIELD_POOL.filter(f => !PEN_ENTRY_COLUMNS.some(c => c.key === f.key)),
    quickFilters: ENTRY_QUICK_FILTERS,
    dateField:null, dateLabel:null,
    columns: PEN_ENTRY_COLUMNS,
    getData: entryGetData,
    getSummary: entryGetSummary(PEN_ENTRY_COLUMNS),
  },
  idCard: {
    label:"ID Card Data", icon:FileText,
    isFixedEntry:true,
    fixedColumns: ID_CARD_COLUMNS,
    extraFieldPool: STUDENT_FIELD_POOL.filter(f => !ID_CARD_COLUMNS.some(c => c.key === f.key)),
    quickFilters: ENTRY_QUICK_FILTERS,
    dateField:null, dateLabel:null,
    columns: ID_CARD_COLUMNS,
    getData: entryGetData,
    getSummary: entryGetSummary(ID_CARD_COLUMNS),
  },
};

// ── Color Map ─────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   {bg:"bg-blue-50",    border:"border-blue-200",    label:"text-blue-600",   val:"text-blue-700"  },
  indigo: {bg:"bg-indigo-50",  border:"border-indigo-200",  label:"text-indigo-600", val:"text-indigo-700"},
  pink:   {bg:"bg-pink-50",    border:"border-pink-200",    label:"text-pink-600",   val:"text-pink-700"  },
  purple: {bg:"bg-purple-50",  border:"border-purple-200",  label:"text-purple-600", val:"text-purple-700"},
  green:  {bg:"bg-green-50",   border:"border-green-200",   label:"text-green-600",  val:"text-green-700" },
  emerald:{bg:"bg-emerald-50", border:"border-emerald-200", label:"text-emerald-600",val:"text-emerald-700"},
  red:    {bg:"bg-red-50",     border:"border-red-200",     label:"text-red-600",    val:"text-red-700"   },
  amber:  {bg:"bg-amber-50",   border:"border-amber-200",   label:"text-amber-600",  val:"text-amber-700" },
  orange: {bg:"bg-orange-50",  border:"border-orange-200",  label:"text-orange-600", val:"text-orange-700"},
};

function StatusBadge({ value }) {
  if (!value) return <span className="text-gray-300">-</span>;
  const cls =
    ["Active","Fully Paid"].includes(value)                         ? "bg-green-100 text-green-700"  :
    value === "Partial"                                             ? "bg-amber-100 text-amber-700"  :
    value === "On Leave"                                            ? "bg-amber-100 text-amber-700"  :
    value === "Leave"                                               ? "bg-orange-100 text-orange-700":
    ["Pending","Maintenance","Resigned","Inactive"].includes(value) ? "bg-red-100 text-red-700"      :
    "bg-gray-100 text-gray-600";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{value}</span>;
}

function DocBadge({ yes }) {
  return yes
    ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Yes</span>
    : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">No</span>;
}

function EligBadge({ eligible, done }) {
  if (done)      return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Completed</span>;
  if (!eligible) return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">Not Eligible</span>;
  return             <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Eligible</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [rType,    setRType]    = useState("student");
  const [filters,  setFilters]  = useState({});
  const [selCols,  setSelCols]  = useState([]); // ordered array of selected column keys
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [search,   setSearch]   = useState("");

  // fixed-entry (GR/UDISE/PEN) — optional one-off extra field(s) inserted into the fixed order
  const [extraFields,    setExtraFields]    = useState([]); // [{key, label, position, isDate}]
  const [showAddExtra,   setShowAddExtra]   = useState(false);
  const [extraFieldKey,  setExtraFieldKey]  = useState("");
  const [extraFieldPos,  setExtraFieldPos]  = useState(1);
  const [hiddenFixedCols,setHiddenFixedCols] = useState([]); // keys of fixed cols user has hidden

  // DB data
  const [dbStudents,  setDbStudents]  = useState([]);
  const [dbFees,      setDbFees]      = useState([]);
  const [dbPayments,  setDbPayments]  = useState([]);
  const [dbEmployees, setDbEmployees] = useState([]);
  const [dbInventory, setDbInventory] = useState([]);
  const [dbLoading,   setDbLoading]   = useState(true);
  const [dbSessions,  setDbSessions]  = useState(SESSIONS_FALLBACK);

  const loadAll = useCallback(async () => {
    setDbLoading(true);
    try {
      const [students, fees, payments, employees, inventory, sessions] = await Promise.all([
        getStudentsForReport(),
        getFeesForReport(),
        getPaymentsForReport(),
        getEmployeesForReport(),
        getInventoryForReport(),
        getAcademicYearLabels(),
      ]);
      setDbStudents(students);
      setDbFees(fees);
      setDbPayments(payments);
      setDbEmployees(employees);
      setDbInventory(inventory);
      if (sessions.length) setDbSessions(sessions);
    } catch (e) {
      console.error("Report loadAll error:", e);
    } finally {
      setDbLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const [feesView, setFeesView] = useState("status"); // "collection" | "status"
  const [partialMaxAmount, setPartialMaxAmount] = useState("");

  const cfg  = REPORT_CONFIGS[rType];
  const ecfg = cfg.isFeesModule
    ? (feesView === "collection" ? cfg.collectionConfig : cfg.statusConfig)
    : cfg;

  // Patch session filter options with live DB years (module-level config uses SESSIONS_FALLBACK as static placeholder)
  const activeQuickFilters = useMemo(() =>
    (ecfg.quickFilters || []).map(f =>
      f.key === "session" ? { ...f, options: ["All", ...dbSessions] } : f
    ), [ecfg.quickFilters, dbSessions]);

  useEffect(() => {
    const activeCols = cfg.isFeesModule
      ? (feesView === "collection" ? cfg.collectionConfig.columns : cfg.statusConfig.columns)
      : cfg.columns;
    const init = activeCols.filter(c => c.dflt).map(c => c.key);
    setSelCols(init);
    setExtraFields([]);
    setHiddenFixedCols([]);
    setShowAddExtra(false);
    setExtraFieldKey(""); setExtraFieldPos(1);
    setFilters({});
    setDateFrom(""); setDateTo(""); setSearch(""); setPartialMaxAmount("");
    if (!cfg.isFeesModule) setFeesView("status");
  }, [rType, feesView]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceData =
    rType === "fees" && feesView === "collection" ? dbPayments  :
    rType === "fees"                              ? dbFees      :
    rType === "employee"                          ? dbEmployees :
    rType === "inventory"                         ? dbInventory :
    /* student, eligibility, grRegister, udiseEntry, penEntry */ dbStudents;

  let data = ecfg.getData(sourceData, filters, dateFrom, dateTo, search);
  if (rType === "fees" && feesView === "status" && filters.status === "Partial" && partialMaxAmount !== "") {
    const maxAmt = Number(partialMaxAmount);
    if (!isNaN(maxAmt) && maxAmt >= 0) {
      data = data.filter(x => x.totalPaid <= maxAmt).sort((a, b) => b.totalPaid - a.totalPaid);
    }
  }
  // actCols follows selection order; fixed-entry types use locked order + inserted extra fields
  const actCols = ecfg.isFixedEntry
    ? buildFixedCols(ecfg.fixedColumns, extraFields).filter(c => !hiddenFixedCols.includes(c.key))
    : selCols.map(key => ecfg.columns.find(c => c.key === key)).filter(Boolean);
  const summary = ecfg.getSummary(data);

  function eligStatusText(eligible, done) {
    if (!eligible) return "Not Eligible";
    if (done)      return "Completed";
    return "Eligible-Pending";
  }

  function doExportExcel() {
    const isoToday     = new Date().toISOString().slice(0,10);
    const todayDisplay = fmtDate(isoToday);
    let rows;
    if (ecfg.isEligibility) {
      rows = [
        ["Satyam Stars International School"],
        ["Surat, Gujarat  |  GSEB Board  |  English Medium"],
        ["ID Eligibility Report"],
        [`Generated: ${todayDisplay}`, "", `Total Records: ${data.length}`],
        [],
        ["#","Enroll No","Student Name","Class","Birth Cert","Aadhar","Name Match","UDISE","PEN","APAAR","Remarks","Follow Up"],
        ...data.map((st, i) => {
          const e = st.elig || computeElig(st);
          return [
            i+1, st.enrollNo, st.name, st.cls,
            e.hasBirthCert ? "Yes" : "No",
            e.hasAadhar ? "Yes" : "No",
            !e.hasAadhar ? "N/A" : e.nameMatch ? "Yes" : "No",
            eligStatusText(e.udiseElig, e.udiseDone),
            eligStatusText(e.penElig,   e.penDone),
            eligStatusText(e.apaarElig, e.apaarDone),
            st.remarks || "",
            st.followUp || "",
          ];
        }),
        [],
        ["SUMMARY:", ...summary.map(s=>`${s.label}: ${s.value}`)],
      ];
    } else {
      const filterStr = Object.entries(filters).filter(([,v])=>v&&v!=="All").map(([k,v])=>`${k}: ${v}`).join(" | ");
      rows = [
        ["Satyam Stars International School"],
        ["Surat, Gujarat  |  GSEB Board  |  English Medium"],
        [ecfg.label],
        [`Generated: ${todayDisplay}`, "", `Total Records: ${data.length}`],
        filterStr ? [`Filters Applied: ${filterStr}`] : null,
        (dateFrom||dateTo) ? [`Date Range: ${dateFrom?fmtDate(dateFrom):"-"} to ${dateTo?fmtDate(dateTo):"-"}`] : null,
        [],
        actCols.map(c => c.label),
        ...data.map(row => actCols.map(c => { const v=formatCellValue(c, row[c.key]); return v===""? "-" : v; })),
        [],
        ["SUMMARY:", ...summary.map(s=>`${s.label}: ${s.value}`)],
      ].filter(r => r !== null);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colCount = ecfg.isEligibility ? 12 : actCols.length;
    ws["!cols"] = Array.from({length:colCount}, () => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ecfg.label.slice(0,31));
    XLSX.writeFile(wb, `${ecfg.label.replace(/[\s/]+/g,"_")}_${isoToday}.xlsx`);
  }

  function doExportPDF() {
    const isoToday     = new Date().toISOString().slice(0,10);
    const todayDisplay = fmtDate(isoToday);
    const isElig = ecfg.isEligibility;
    const doc = new jsPDF({ orientation: isElig || actCols.length > 6 ? "landscape" : "portrait" });
    const w   = doc.internal.pageSize.getWidth();

    doc.setFillColor(30,58,95);
    doc.rect(0, 0, w, 28, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("Satyam Stars International School", w/2, 10, {align:"center"});
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text("Surat, Gujarat  |  GSEB Board  |  English Medium", w/2, 17, {align:"center"});
    doc.setFillColor(245,158,11);
    doc.rect(0, 22, w, 7, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text(ecfg.label.toUpperCase(), w/2, 27, {align:"center"});

    doc.setTextColor(60,60,60); doc.setFontSize(8); doc.setFont("helvetica","normal");
    let y = 36;
    doc.text(`Generated: ${todayDisplay}`, 14, y); y += 5;
    doc.text(`Total Records: ${data.length}`, 14, y); y += 5;
    if (!isElig) {
      const activeFilters = Object.entries(filters).filter(([,v])=>v&&v!=="All").map(([k,v])=>`${k}: ${v}`).join("  |  ");
      if (activeFilters) { doc.text(`Filters: ${activeFilters}`, 14, y); y += 5; }
      if (dateFrom||dateTo) { doc.text(`Date Range: ${dateFrom?fmtDate(dateFrom):"-"}  to  ${dateTo?fmtDate(dateTo):"-"}`, 14, y); y += 5; }
    }
    doc.setFont("helvetica","bold"); doc.setTextColor(30,58,95);
    doc.text(summary.map(s=>`${s.label}: ${s.value}`).join("   |   "), 14, y); y += 4;

    const head = isElig
      ? [["#","Enroll No","Student Name","Class","Birth Cert","Aadhar","Name Match","UDISE","PEN","APAAR","Remarks"]]
      : [actCols.map(c => c.label)];
    const body = isElig
      ? data.map((st, i) => {
          const e = st.elig || computeElig(st);
          return [
            i+1, st.enrollNo, st.name, st.cls,
            e.hasBirthCert ? "Yes" : "No",
            e.hasAadhar ? "Yes" : "No",
            !e.hasAadhar ? "N/A" : e.nameMatch ? "Yes" : "No",
            eligStatusText(e.udiseElig, e.udiseDone),
            eligStatusText(e.penElig,   e.penDone),
            eligStatusText(e.apaarElig, e.apaarDone),
            st.remarks || "",
          ];
        })
      : data.map(row => actCols.map(c => { const v=formatCellValue(c, row[c.key]); return v===""? "-" : String(v); }));

    autoTable(doc, {
      startY: y + 2,
      head, body,
      headStyles: { fillColor:[30,58,95], textColor:[255,255,255], fontStyle:"bold", fontSize:7, cellPadding:2 },
      bodyStyles: { fontSize:6.5, cellPadding:2 },
      alternateRowStyles: { fillColor:[248,250,252] },
      styles: { overflow:"linebreak" },
      didDrawPage: () => {
        const ph = doc.internal.pageSize.getHeight();
        const pw = doc.internal.pageSize.getWidth();
        const pn = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setDrawColor(210,210,210);
        doc.line(14, ph-12, pw-14, ph-12);
        doc.setFontSize(7); doc.setTextColor(140,140,140); doc.setFont("helvetica","normal");
        doc.text("Satyam Stars International School  |  Surat, Gujarat  |  Confidential", 14, ph-7);
        doc.text(`Page ${pn}  |  Generated: ${todayDisplay}`, pw-14, ph-7, {align:"right"});
      },
    });

    doc.save(`${ecfg.label.replace(/[\s/]+/g,"_")}_${isoToday}.pdf`);
  }

  if (dbLoading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">
      Loading report data…
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Reports & Export</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate, filter and export reports for any module</p>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors">
          <RefreshCw className="w-3 h-3"/>Refresh
        </button>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Object.entries(REPORT_CONFIGS).map(([key, c]) => {
          const Icon = c.icon; const isA = rType === key;
          return (
            <button key={key} onClick={() => setRType(key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${isA ? "border-school-navy bg-school-navy text-white shadow-lg" : "border-gray-200 bg-white text-gray-600 hover:border-school-navy/40"}`}>
              <Icon className="w-6 h-6"/>
              <span className="text-xs font-semibold leading-tight text-center">{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">

        {/* Fees module sub-tabs */}
        {cfg.isFeesModule && (
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 self-start w-fit">
            <button onClick={() => setFeesView("status")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${feesView === "status" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              Fee Status
            </button>
            <button onClick={() => setFeesView("collection")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${feesView === "collection" ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"}`}>
              Collection
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          {activeQuickFilters.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</label>
              <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-28"
                value={filters[f.key]||"All"}
                onChange={e => setFilters(prev=>({...prev,[f.key]:e.target.value}))}>
                {f.options.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {rType === "fees" && feesView === "status" && filters.status === "Partial" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid ≤ Amount (Rs)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 8000"
                value={partialMaxAmount}
                onChange={e => setPartialMaxAmount(e.target.value)}
                className="border-2 border-amber-400 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 w-32"
              />
            </div>
          )}
          {ecfg.isCollection && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exact Date</label>
              <DateInputDMY
                value={dateFrom === dateTo && dateFrom ? dateFrom : ""}
                onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value); }}
                className="border-2 border-school-navy rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy"/>
            </div>
          )}
          {ecfg.dateField && (<>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{ecfg.dateLabel} From</label>
              <DateInputDMY value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{ecfg.dateLabel} To</label>
              <DateInputDMY value={dateTo} onChange={e=>setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy"/>
            </div>
          </>)}
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
              <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy"
                placeholder="Search by name or enroll no" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
          <button onClick={()=>{setFilters({});setDateFrom("");setDateTo("");setSearch("");setPartialMaxAmount("");}}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors self-end">
            <RefreshCw className="w-3 h-3"/>Reset
          </button>
        </div>

        {/* Column selector — hidden for eligibility and fixed-entry registers */}
        {!ecfg.isEligibility && !ecfg.isFixedEntry && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Columns to Include in Report</p>
            <div className="flex flex-wrap gap-2">
              {ecfg.columns.map(col => {
                const orderIdx = selCols.indexOf(col.key);
                const isSelected = orderIdx !== -1;
                return (
                  <button
                    key={col.key}
                    onClick={() => setSelCols(prev =>
                      isSelected ? prev.filter(k => k !== col.key) : [...prev, col.key]
                    )}
                    className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                      isSelected
                        ? "bg-school-navy border-school-navy text-white"
                        : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {col.label}
                    {isSelected && (
                      <span className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 text-school-navy text-[9px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
                        {orderIdx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fixed-entry registers (GR / UDISE / PEN / ID Card) — fields selectable, extra fields insertable */}
        {ecfg.isFixedEntry && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Fixed Fields — {actCols.length} of {buildFixedCols(ecfg.fixedColumns, extraFields).length} selected &nbsp;
                {hiddenFixedCols.length > 0 && (
                  <button onClick={() => setHiddenFixedCols([])}
                    className="text-school-navy underline font-semibold normal-case">
                    Restore all
                  </button>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {buildFixedCols(ecfg.fixedColumns, extraFields).map((col, i) => {
                  const isHidden = hiddenFixedCols.includes(col.key);
                  const activePos = actCols.findIndex(c => c.key === col.key);
                  return (
                    <span key={`${col.key}-${i}`}
                      className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                        isHidden   ? "bg-gray-100 text-gray-400" :
                        col.isExtra ? "bg-amber-500 text-white"  : "bg-school-navy text-white"
                      }`}>
                      {!isHidden && (
                        <span className="absolute -top-2 -left-1 w-4 h-4 bg-yellow-400 text-school-navy text-[9px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
                          {activePos + 1}
                        </span>
                      )}
                      <span className={isHidden ? "line-through" : ""}>{col.label}{col.isExtra && !isHidden && " (extra)"}</span>
                      <button
                        onClick={() => {
                          if (isHidden) {
                            setHiddenFixedCols(prev => prev.filter(k => k !== col.key));
                          } else if (col.isExtra) {
                            setExtraFields(prev => prev.filter(ef => ef.key !== col.key));
                          } else {
                            setHiddenFixedCols(prev => [...prev, col.key]);
                          }
                        }}
                        className={`font-bold leading-none ${isHidden ? "text-gray-400 hover:text-gray-700" : "text-white/70 hover:text-white"}`}
                      >{isHidden ? "+" : "×"}</button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-white">
              {!showAddExtra ? (
                <button onClick={() => setShowAddExtra(true)}
                  className="text-xs font-semibold text-school-navy hover:underline">
                  + Want to add an extra field to this register?
                </button>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Extra Field</label>
                    <select value={extraFieldKey} onChange={e => setExtraFieldKey(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white min-w-44 focus:outline-none focus:ring-2 focus:ring-school-navy">
                      <option value="">Select field...</option>
                      {ecfg.extraFieldPool
                        .filter(f => !extraFields.some(ef => ef.key === f.key))
                        .map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">At Position</label>
                    <input type="number" min={1} max={actCols.length + 1} value={extraFieldPos}
                      onChange={e => setExtraFieldPos(Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white w-20 focus:outline-none focus:ring-2 focus:ring-school-navy"/>
                  </div>
                  <button
                    onClick={() => {
                      const field = ecfg.extraFieldPool.find(f => f.key === extraFieldKey);
                      if (!field) { alert("Please select a field to add."); return; }
                      setExtraFields(prev => [...prev, { ...field, position: extraFieldPos }]);
                      setExtraFieldKey(""); setExtraFieldPos(1); setShowAddExtra(false);
                    }}
                    className="bg-school-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-school-navy/90"
                  >
                    Add Field
                  </button>
                  <button onClick={() => { setShowAddExtra(false); setExtraFieldKey(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Eligibility criteria info */}
        {ecfg.isEligibility && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <span className="mt-0.5 text-base">📄</span>
              <div>
                <p className="text-xs font-bold text-indigo-700">UDISE Eligible</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">Birth Certificate submitted</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="mt-0.5 text-base">💳</span>
              <div>
                <p className="text-xs font-bold text-amber-700">PEN Eligible</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Birth Certificate + Aadhar Card</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <span className="mt-0.5 text-base">✅</span>
              <div>
                <p className="text-xs font-bold text-purple-700">APAAR Eligible</p>
                <p className="text-[11px] text-purple-600 mt-0.5">Birth Cert + Aadhar with name as: Student + Father + Surname</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collection period cards — only for Fee Collection view */}
      {ecfg.isCollection && (() => {
        const cols = computeCollectionSummary(sourceData);
        return (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Collection Overview</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cols.map((c, i) => {
                const cm = COLOR_MAP[c.color] || COLOR_MAP.blue;
                return (
                  <div key={i} className={`${cm.bg} border-2 ${cm.border} rounded-xl p-4`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${cm.label}`}>{c.label}</p>
                    <p className={`text-2xl font-extrabold mt-1 ${cm.val}`}>
                      Rs {c.value.toLocaleString("en-IN")}
                    </p>
                    <p className={`text-[10px] mt-1 ${cm.label} opacity-70`}>
                      {(sourceData || []).filter(p => p.date >= c.period && p.date <= new Date().toISOString().slice(0,10)).length} transactions
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summary.map((s,i) => {
          const cm = COLOR_MAP[s.color]||COLOR_MAP.blue;
          return (
            <div key={i} className={`${cm.bg} border ${cm.border} rounded-xl p-3`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${cm.label}`}>{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${cm.val}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Export bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{data.length}</span> records
          {!ecfg.isEligibility && (<>&nbsp;&nbsp;·&nbsp;&nbsp;<span className="font-semibold text-school-navy">{actCols.length}</span> columns selected</>)}
        </p>
        <div className="flex gap-2">
          <button onClick={doExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Download className="w-4 h-4"/>Export Excel
          </button>
          <button onClick={doExportPDF}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <FileText className="w-4 h-4"/>Export PDF
          </button>
        </div>
      </div>

      {/* Standard table */}
      {!ecfg.isEligibility && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-school-navy text-white">
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap w-8">#</th>
                {actCols.map(c=>(
                  <th key={c.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row,idx)=>(
                <tr key={idx} className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${idx%2===0?"bg-white":"bg-gray-50/40"}`}>
                  <td className="px-3 py-2 text-gray-400 font-medium">{idx+1}</td>
                  {actCols.map(c=>(
                    <td key={c.key} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {c.key==="status"
                        ? <StatusBadge value={row[c.key]}/>
                        : formatCellValue(c, row[c.key]) !== ""
                          ? String(formatCellValue(c, row[c.key]))
                          : <span className="text-gray-300">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length===0 && (
                <tr><td colSpan={actCols.length+1} className="px-4 py-10 text-center text-gray-400 text-sm">No records match the selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Eligibility table */}
      {ecfg.isEligibility && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-school-navy text-white">
                <th className="px-3 py-2.5 text-left font-semibold w-8">#</th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Enroll No</th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Student Name</th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Class</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Birth Cert</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Aadhar</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Name Match</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap bg-indigo-700">UDISE</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap bg-amber-600">PEN</th>
                <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap bg-purple-700">APAAR</th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Remarks</th>
                <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Follow Up</th>
              </tr>
            </thead>
            <tbody>
              {data.map((st, idx) => {
                const e = st.elig || computeElig(st);
                return (
                  <tr key={idx} className={`border-b border-gray-100 hover:bg-blue-50/20 transition-colors ${idx%2===0?"bg-white":"bg-gray-50/40"}`}>
                    <td className="px-3 py-2.5 text-gray-400 font-medium">{idx+1}</td>
                    <td className="px-3 py-2.5 text-gray-500 font-mono">{st.enrollNo}</td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{st.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{st.cls}</td>
                    <td className="px-3 py-2.5 text-center"><DocBadge yes={e.hasBirthCert}/></td>
                    <td className="px-3 py-2.5 text-center"><DocBadge yes={e.hasAadhar}/></td>
                    <td className="px-3 py-2.5 text-center">
                      {!e.hasAadhar
                        ? <span className="text-gray-300 text-[10px]">N/A</span>
                        : <DocBadge yes={e.nameMatch}/>}
                    </td>
                    <td className="px-3 py-2.5 text-center"><EligBadge eligible={e.udiseElig} done={e.udiseDone}/></td>
                    <td className="px-3 py-2.5 text-center"><EligBadge eligible={e.penElig}   done={e.penDone}/></td>
                    <td className="px-3 py-2.5 text-center"><EligBadge eligible={e.apaarElig} done={e.apaarDone}/></td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{st.remarks || <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{st.followUp || <span className="text-gray-300">-</span>}</td>
                  </tr>
                );
              })}
              {data.length===0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400 text-sm">No records match the selected filters</td></tr>
              )}
            </tbody>
          </table>
          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Legend:</span>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Completed</span>
              ID has been generated
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Eligible</span>
              Has required docs, ID not yet generated
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">Not Eligible</span>
              Missing required documents
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
