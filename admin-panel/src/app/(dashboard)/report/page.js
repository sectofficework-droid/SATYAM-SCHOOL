"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap, IndianRupee, Users, Package, Search,
  RefreshCw, Download, FileText, ShieldCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES   = ["JR KG","SR KG","Balvatika","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th Commerce","12th Commerce"];
const GENDERS   = ["Male","Female","Other"];
const RELIGIONS = ["Hindu","Muslim","Christian","Jain","Sikh","Buddhist","Parsi","Other"];
const CASTES    = ["General","OBC","SC","ST","EWS","SEBC","Other"];
const SESSIONS  = ["2026-27","2025-26","2024-25","2023-24"];
const STU_STATUSES = ["Active","Leave","Inactive"];
const EMP_ROLES    = ["Teacher","Admin Staff","Principal","Vice Principal","Lab Assistant","Librarian","Peon","Guard","Cook","Driver"];
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
  return {
    hasBirthCert, hasAadhar, nameMatch,
    udiseElig, penElig, apaarElig,
    udiseDone: udiseElig && !!(st.udise && st.udise.trim()),
    penDone:   penElig   && !!(st.pen   && st.pen.trim()),
    apaarDone: apaarElig && !!(st.apaar && st.apaar.trim()),
  };
}

// ── Dummy Students ────────────────────────────────────────────────────────────
let _sid = 0;
function mkSt(cls, roll, fn, ln, gender, opts) {
  _sid++;
  const o  = opts || {};
  const fa = o.fatherName || `${ln}bhai Kumar`;
  const mo = o.motherName || `Smt. ${fn}ben`;
  const an = o.aadharNo   !== undefined ? o.aadharNo   : `${2000+_sid} ${3000+_sid} ${4000+_sid}`;
  const am = o.aadharName !== undefined ? o.aadharName : `${fn} ${fa} ${ln}`;
  return {
    id:_sid, enrollNo:`SS-${String(_sid).padStart(4,"0")}`,
    firstName:fn, lastName:ln, surname:ln, name:`${fn} ${ln}`,
    cls, roll, gender, joinClass: o.joinClass || cls,
    joinDate:      o.joinDate      || "2024-06-01",
    dob:           o.dob           || `201${3+(_sid%5)}-${String(1+(_sid%9)).padStart(2,"0")}-${String(10+(_sid%20)).padStart(2,"0")}`,
    religion:      o.religion      || RELIGIONS[_sid % RELIGIONS.length],
    caste:         o.caste         || CASTES[_sid % CASTES.length],
    fatherName:fa, motherName:mo,
    mobile1:       o.mobile1       || `9${8-(_sid%2)}${String(76540000+_sid*1137).slice(-8)}`,
    mobile2:       o.mobile2       || "",
    placeOfBirth:  o.placeOfBirth  || "Surat",
    hasBirthCert:  o.hasBirthCert  !== undefined ? o.hasBirthCert : true,
    aadharNo:an, aadharName:am,
    udise: o.udise || "", pen: o.pen || "", apaar: o.apaar || "",
    grNo:`GR${2000+_sid}`,
    lastSchoolName: o.lastSchoolName || "City Primary School",
    remarks:  o.remarks  || "",
    followUp: o.followUp || "",
    status:  o.status  || "Active",
    session: o.session || "2025-26",
  };
}

const DUMMY_STUDENTS = [
  // ── Active students — 2025-26 ─────────────────────────────────
  mkSt("JR KG","1","Arjun","Patel","Male",{dob:"2018-03-15",religion:"Hindu",caste:"General",mobile2:"9876540002"}),
  mkSt("SR KG","1","Diya","Shah","Female",{dob:"2017-07-22",religion:"Hindu",caste:"General",
    udise:"GJ220101234567"}),
  mkSt("Balvatika","1","Vivaan","Mehta","Male",{dob:"2016-11-08",religion:"Hindu",caste:"OBC",
    udise:"GJ220101234568",pen:"PEN10012345678"}),
  mkSt("1st","1","Anaya","Desai","Female",{dob:"2016-04-25",religion:"Hindu",caste:"General",
    udise:"GJ220101234569",pen:"PEN10012345679",apaar:"APAAR12345678901"}),
  mkSt("8th","1","Pooja","Singh","Female",{dob:"2011-09-18",religion:"Hindu",caste:"General"}),
  mkSt("9th","1","Rahul","Kumar","Male",{dob:"2010-12-05",religion:"Hindu",caste:"OBC",
    udise:"GJ220101234570",pen:"PEN10012345680"}),
  mkSt("12th Commerce","1","Neha","Pandey","Female",{dob:"2007-05-22",religion:"Hindu",caste:"General",
    udise:"GJ220101234571",pen:"PEN10012345681",apaar:"APAAR12345678902"}),
  mkSt("SR KG","2","Dev","Shah","Male",{dob:"2017-08-14",religion:"Hindu",caste:"General",
    udise:"GJ220101234572"}),
  mkSt("3rd","2","Yash","Desai","Male",{dob:"2015-02-17",religion:"Hindu",caste:"SC"}),
  mkSt("5th","2","Om","Rao","Male",{dob:"2013-10-30",religion:"Hindu",caste:"General"}),
  mkSt("7th","2","Jay","Nair","Male",{dob:"2011-06-09",religion:"Hindu",caste:"General",
    udise:"GJ220101234573",pen:"PEN10012345682",apaar:"APAAR12345678903"}),
  mkSt("2nd","1","Rohan","Joshi","Male",{dob:"2016-01-12",religion:"Hindu",caste:"General",
    aadharName:"Rohan Joshi",udise:"GJ220101234574"}),
  mkSt("10th","1","Anjali","Mishra","Female",{dob:"2009-03-14",religion:"Hindu",caste:"General",
    aadharName:"Anjali Mishra",udise:"GJ220101234575",pen:"PEN10012345683"}),
  mkSt("4th","1","Priya","Verma","Female",{dob:"2014-05-19",religion:"Hindu",caste:"General",aadharNo:""}),
  mkSt("5th","1","Aditya","Rao","Male",{dob:"2013-09-07",religion:"Hindu",caste:"OBC",
    aadharNo:"",udise:"GJ220101234577"}),

  // ── Leave (left school) — 2025-26 ────────────────────────────
  mkSt("3rd","1","Ishaan","Trivedi","Male",{dob:"2015-06-28",religion:"Jain",caste:"General",
    aadharName:"Ishaan Trivedi",status:"Leave",remarks:"TC issued - family shifted to Ahmedabad"}),
  mkSt("6th","2","Nisha","Gupta","Female",{dob:"2012-08-05",religion:"Hindu",caste:"General",
    aadharName:"Nisha Gupta",status:"Leave",remarks:"Left school - admitted to another school"}),
  mkSt("11th Commerce","1","Varun","Pillai","Male",{dob:"2007-12-15",religion:"Hindu",caste:"General",
    aadharNo:"",status:"Leave",remarks:"TC issued - transferred out"}),

  // ── Inactive — 2025-26 ────────────────────────────────────────
  mkSt("6th","1","Sneha","Gupta","Female",{dob:"2012-02-14",religion:"Hindu",caste:"General",
    hasBirthCert:false,aadharNo:"",status:"Inactive",
    remarks:"Left school — TC issued",followUp:""}),
  mkSt("JR KG","2","Riya","Patel","Female",{dob:"2018-10-05",religion:"Hindu",caste:"General",
    hasBirthCert:false,aadharNo:"",status:"Inactive",remarks:"Admission cancelled"}),

  // ── Active — 2024-25 ─────────────────────────────────────────
  mkSt("1st","2","Aarav","Joshi","Male",{dob:"2016-11-22",religion:"Hindu",caste:"OBC",
    aadharName:"Aarav Joshi",udise:"GJ220101234576",session:"2024-25"}),
  mkSt("2nd","2","Shreya","Mehta","Female",{dob:"2016-04-01",religion:"Hindu",caste:"General",
    aadharNo:"",udise:"GJ220101234578",session:"2024-25"}),
  mkSt("8th","2","Tanu","Singh","Female",{dob:"2010-07-23",religion:"Hindu",caste:"SC",
    aadharNo:"",session:"2024-25"}),

  // ── Inactive — 2024-25 ───────────────────────────────────────
  mkSt("7th","1","Karan","Nair","Male",{dob:"2011-08-30",religion:"Hindu",caste:"General",
    hasBirthCert:false,aadharNo:"",status:"Inactive",session:"2024-25",
    remarks:"TC issued - transferred to another school"}),
  mkSt("4th","2","Kavya","Trivedi","Female",{dob:"2014-08-11",religion:"Hindu",caste:"General",
    hasBirthCert:false,aadharNo:"",status:"Inactive",session:"2024-25",
    remarks:"Left mid-year"}),

  // ── Active — 2023-24 ─────────────────────────────────────────
  mkSt("9th","2","Manav","Sharma","Male",{dob:"2009-04-12",religion:"Hindu",caste:"General",
    session:"2023-24"}),
  mkSt("10th","2","Pooja","Rao","Female",{dob:"2008-09-25",religion:"Hindu",caste:"OBC",
    session:"2023-24"}),
];

let _payId = 1;
const mkPay = (label, amount, dueDate, paid, paidDate) => ({ id:_payId++, label, amount, dueDate, paid, paidDate });
const mkFee = (id, enrollNo, name, cls, totalFee, discount, payments) => ({ id, enrollNo, name, cls, totalFee, discount, payments });

const DUMMY_FEE_RECORDS = [
  mkFee(1,"SS-0001","Arjun Patel",   "JR KG",         16200,0,   [mkPay("Term 1",5400,"2026-04-15",5400,"2026-04-10"),mkPay("Term 2",5400,"2026-07-15",5400,"2026-07-08"),mkPay("Term 3",5400,"2026-10-15",0,"")]),
  mkFee(2,"SS-0002","Diya Shah",     "SR KG",         16200,500, [mkPay("Full Payment",15700,"2026-04-15",15700,"2026-04-05")]),
  mkFee(3,"SS-0003","Vivaan Mehta",  "Balvatika",     17000,0,   [mkPay("Term 1",5666,"2026-04-15",5666,"2026-04-12"),mkPay("Term 2",5667,"2026-07-15",0,""),mkPay("Term 3",5667,"2026-10-15",0,"")]),
  mkFee(4,"SS-0004","Anaya Desai",   "1st",           18000,1000,[mkPay("Half Yearly 1",8500,"2026-04-15",8500,"2026-04-08"),mkPay("Half Yearly 2",8500,"2026-10-15",8500,"2026-10-10")]),
  mkFee(5,"SS-0005","Rohan Joshi",   "2nd",           18200,0,   [mkPay("Term 1",6066,"2026-04-15",6066,"2026-04-15"),mkPay("Term 2",6067,"2026-07-15",0,""),mkPay("Term 3",6067,"2026-10-15",0,"")]),
  mkFee(6,"SS-0006","Ishaan Trivedi","3rd",           18500,0,   [mkPay("Full Payment",18500,"2026-04-15",18500,"2026-04-02")]),
  mkFee(7,"SS-0007","Priya Verma",   "4th",           18800,500, [mkPay("Term 1",6100,"2026-04-15",6100,"2026-04-20"),mkPay("Term 2",6100,"2026-07-15",6100,"2026-07-15"),mkPay("Term 3",6100,"2026-10-15",0,"")]),
  mkFee(8,"SS-0008","Aditya Rao",    "5th",           19500,0,   [mkPay("Term 1",6500,"2026-04-15",6500,"2026-04-18"),mkPay("Term 2",6500,"2026-07-15",0,""),mkPay("Term 3",6500,"2026-10-15",0,"")]),
];

const DUMMY_EMPLOYEES = [
  { id:1,  name:"Rajesh Patel",    role:"Teacher",     subject:"Mathematics", qualification:"B.Ed, M.Sc", mobile:"9876541001", email:"rajesh@satyam.in",  salary:28000, joinDate:"2020-06-01", status:"Active"   },
  { id:2,  name:"Meena Desai",     role:"Teacher",     subject:"English",     qualification:"B.Ed, M.A",  mobile:"9876541002", email:"meena@satyam.in",   salary:26000, joinDate:"2019-04-15", status:"Active"   },
  { id:3,  name:"Suresh Shah",     role:"Teacher",     subject:"Science",     qualification:"B.Ed, B.Sc", mobile:"9876541003", email:"suresh@satyam.in",  salary:27000, joinDate:"2021-07-01", status:"Active"   },
  { id:4,  name:"Priya Trivedi",   role:"Teacher",     subject:"Social Sc",   qualification:"B.Ed",       mobile:"9876541004", email:"priya@satyam.in",   salary:25000, joinDate:"2022-06-15", status:"Active"   },
  { id:5,  name:"Amit Kumar",      role:"Teacher",     subject:"Hindi",       qualification:"B.Ed, M.A",  mobile:"9876541005", email:"amit@satyam.in",    salary:24000, joinDate:"2020-08-01", status:"Active"   },
  { id:6,  name:"Kavita Joshi",    role:"Teacher",     subject:"Gujarati",    qualification:"B.Ed",       mobile:"9876541006", email:"kavita@satyam.in",  salary:24000, joinDate:"2021-06-01", status:"Active"   },
  { id:7,  name:"Ramesh Verma",    role:"Admin Staff", subject:"-",           qualification:"B.Com",      mobile:"9876541007", email:"ramesh@satyam.in",  salary:22000, joinDate:"2018-03-01", status:"Active"   },
  { id:8,  name:"Sunita Rao",      role:"Teacher",     subject:"Computer",    qualification:"MCA",        mobile:"9876541008", email:"sunita@satyam.in",  salary:25000, joinDate:"2023-06-01", status:"Active"   },
  { id:9,  name:"Dinesh Mehta",    role:"Peon",        subject:"-",           qualification:"10th",       mobile:"9876541009", email:"",                  salary:15000, joinDate:"2017-06-01", status:"Active"   },
  { id:10, name:"Aarti Sharma",    role:"Teacher",     subject:"Drawing",     qualification:"B.F.A",      mobile:"9876541010", email:"aarti@satyam.in",   salary:20000, joinDate:"2022-01-15", status:"Active"   },
  { id:11, name:"Vinod Prajapati", role:"Guard",       subject:"-",           qualification:"10th",       mobile:"9876541011", email:"",                  salary:14000, joinDate:"2019-06-01", status:"Active"   },
  { id:12, name:"Savita Nair",     role:"Teacher",     subject:"Music",       qualification:"B.Mus",      mobile:"9876541012", email:"savita@satyam.in",  salary:20000, joinDate:"2021-06-15", status:"Active"   },
];

const DUMMY_ASSETS = [
  { id:1, name:"HP LaserJet Printer",    category:"Electronics", location:"Office",        status:"Active",      assignedTo:"Admin",     purchaseDate:"2023-01-15", value:18500 },
  { id:2, name:"Dell Laptop",            category:"Electronics", location:"Lab",           status:"Active",      assignedTo:"Lab Staff", purchaseDate:"2022-06-10", value:55000 },
  { id:3, name:"Projector Epson X41+",   category:"Electronics", location:"Hall",          status:"Active",      assignedTo:"AV Team",   purchaseDate:"2021-08-20", value:42000 },
  { id:4, name:"Classroom Chairs (30)",  category:"Furniture",   location:"Classroom 4",   status:"Active",      assignedTo:"Class 4",   purchaseDate:"2020-04-01", value:24000 },
  { id:5, name:"Science Lab Kit",        category:"Lab Equip",   location:"Science Lab",   status:"Maintenance", assignedTo:"Lab Asst",  purchaseDate:"2023-03-12", value:32000 },
  { id:6, name:"Sports Equipment Set",   category:"Sports",      location:"Ground",        status:"Active",      assignedTo:"PE Teacher",purchaseDate:"2024-01-05", value:15000 },
  { id:7, name:"Water Purifier",         category:"Appliance",   location:"Canteen",       status:"Active",      assignedTo:"Cook",      purchaseDate:"2022-11-30", value:12500 },
  { id:8, name:"CCTV Camera Set",        category:"Security",    location:"Entire School", status:"Active",      assignedTo:"Admin",     purchaseDate:"2023-07-01", value:38000 },
];

// ── Report Configs ─────────────────────────────────────────────────────────────
const REPORT_CONFIGS = {
  student: {
    label:"Student Report", icon:GraduationCap,
    quickFilters:[
      {key:"cls",      label:"Class",         options:["All",...CLASSES]      },
      {key:"status",   label:"Status",        options:["All",...STU_STATUSES] },
      {key:"session",  label:"Academic Year", options:["All",...SESSIONS]     },
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
      {key:"dob",            label:"DOB",             dflt:true  },
      {key:"joinDate",       label:"DOJ",             dflt:false },
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
    getData(f, df, dt, s) {
      let d = DUMMY_STUDENTS.map(st => ({ ...st, dobInWords: dobToWords(st.dob) }));
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
    label:"Fees Report", icon:IndianRupee,
    quickFilters:[
      {key:"cls",    label:"Class",  options:["All",...CLASSES]                       },
      {key:"status", label:"Status", options:["All","Fully Paid","Partial","Pending"] },
    ],
    dateField:null, dateLabel:null,
    columns:[
      {key:"enrollNo",  label:"Enroll No",      dflt:true },
      {key:"name",      label:"Student Name",   dflt:true },
      {key:"cls",       label:"Class",          dflt:true },
      {key:"totalFee",  label:"Annual Fee (Rs)", dflt:true },
      {key:"discount",  label:"Discount (Rs)",   dflt:false},
      {key:"totalPaid", label:"Paid (Rs)",       dflt:true },
      {key:"pending",   label:"Pending (Rs)",    dflt:true },
      {key:"status",    label:"Status",         dflt:true },
    ],
    getData(f, df, dt, s) {
      let d = DUMMY_FEE_RECORDS.map(r => {
        const totalPaid = r.payments.reduce((sum,p)=>sum+p.paid,0);
        const pending   = r.totalFee - r.discount - totalPaid;
        const status    = pending<=0?"Fully Paid":totalPaid===0?"Pending":"Partial";
        return {...r, totalPaid, pending, status};
      });
      if (f.cls    && f.cls    !== "All") d = d.filter(x => x.cls    === f.cls);
      if (f.status && f.status !== "All") d = d.filter(x => x.status === f.status);
      if (s) d = d.filter(x => x.name.toLowerCase().includes(s.toLowerCase()));
      return d;
    },
    getSummary(d) {
      const coll = d.reduce((s,x)=>s+x.totalPaid,0);
      const pend = d.reduce((s,x)=>s+x.pending,0);
      return [
        {label:"Students",   value:d.length,                                                          color:"emerald"},
        {label:"Total Fees", value:`Rs ${d.reduce((s,x)=>s+x.totalFee-x.discount,0).toLocaleString("en-IN")}`, color:"blue"},
        {label:"Collected",  value:`Rs ${coll.toLocaleString("en-IN")}`,                               color:"green" },
        {label:"Pending",    value:`Rs ${pend.toLocaleString("en-IN")}`,                               color:"red"   },
      ];
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
      {key:"joinDate",      label:"Join Date",      dflt:false},
      {key:"status",        label:"Status",         dflt:true },
    ],
    getData(f, df, dt, s) {
      let d = [...DUMMY_EMPLOYEES];
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
      {key:"category", label:"Category", options:["All","Electronics","Furniture","Lab Equip","Sports","Appliance","Security"]},
      {key:"status",   label:"Status",   options:["All","Active","Maintenance","Disposed"]},
    ],
    dateField:"purchaseDate", dateLabel:"Purchase Date",
    columns:[
      {key:"name",         label:"Asset Name",    dflt:true },
      {key:"category",     label:"Category",      dflt:true },
      {key:"location",     label:"Location",      dflt:true },
      {key:"status",       label:"Status",        dflt:true },
      {key:"assignedTo",   label:"Assigned To",   dflt:false},
      {key:"purchaseDate", label:"Purchase Date", dflt:false},
      {key:"value",        label:"Value (Rs)",    dflt:true },
    ],
    getData(f, df, dt, s) {
      let d = [...DUMMY_ASSETS];
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
      {label:"Total Value",  value:`Rs ${d.reduce((s,x)=>s+x.value,0).toLocaleString("en-IN")}`,color:"blue" },
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
    getData(f, df, dt, s) {
      let d = DUMMY_STUDENTS.map(st => ({ ...st, elig: computeElig(st) }));
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
  if (!eligible) return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">Not Eligible</span>;
  if (done)      return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Completed</span>;
  return             <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Eligible</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [rType,    setRType]    = useState("student");
  const [filters,  setFilters]  = useState({});
  const [selCols,  setSelCols]  = useState({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [search,   setSearch]   = useState("");

  const cfg = REPORT_CONFIGS[rType];

  useEffect(() => {
    const init = {};
    cfg.columns.forEach(c => { init[c.key] = c.dflt; });
    setSelCols(init);
    setFilters({});
    setDateFrom(""); setDateTo(""); setSearch("");
  }, [rType]);

  const data    = cfg.getData(filters, dateFrom, dateTo, search);
  const actCols = cfg.columns.filter(c => selCols[c.key]);
  const summary = cfg.getSummary(data);

  function eligStatusText(eligible, done) {
    if (!eligible) return "Not Eligible";
    if (done)      return "Completed";
    return "Eligible-Pending";
  }

  function doExportExcel() {
    const today = new Date().toLocaleDateString("en-IN");
    let rows;
    if (cfg.isEligibility) {
      rows = [
        ["Satyam Stars International School"],
        ["Surat, Gujarat  |  GSEB Board  |  English Medium"],
        ["ID Eligibility Report"],
        [`Generated: ${today}`, "", `Total Records: ${data.length}`],
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
        [cfg.label],
        [`Generated: ${today}`, "", `Total Records: ${data.length}`],
        filterStr ? [`Filters Applied: ${filterStr}`] : null,
        (dateFrom||dateTo) ? [`Date Range: ${dateFrom||"-"} to ${dateTo||"-"}`] : null,
        [],
        actCols.map(c => c.label),
        ...data.map(row => actCols.map(c => { const v=row[c.key]; return (v===undefined||v===null||v==="")? "-" : v; })),
        [],
        ["SUMMARY:", ...summary.map(s=>`${s.label}: ${s.value}`)],
      ].filter(r => r !== null);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colCount = cfg.isEligibility ? 12 : actCols.length;
    ws["!cols"] = Array.from({length:colCount}, () => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.label.slice(0,31));
    XLSX.writeFile(wb, `${cfg.label.replace(/[\s/]+/g,"_")}_${today}.xlsx`);
  }

  function doExportPDF() {
    const today = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
    const isElig = cfg.isEligibility;
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
    doc.text(cfg.label.toUpperCase(), w/2, 27, {align:"center"});

    doc.setTextColor(60,60,60); doc.setFontSize(8); doc.setFont("helvetica","normal");
    let y = 36;
    doc.text(`Generated: ${today}`, 14, y); y += 5;
    doc.text(`Total Records: ${data.length}`, 14, y); y += 5;
    if (!isElig) {
      const activeFilters = Object.entries(filters).filter(([,v])=>v&&v!=="All").map(([k,v])=>`${k}: ${v}`).join("  |  ");
      if (activeFilters) { doc.text(`Filters: ${activeFilters}`, 14, y); y += 5; }
      if (dateFrom||dateTo) { doc.text(`Date Range: ${dateFrom||"-"}  to  ${dateTo||"-"}`, 14, y); y += 5; }
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
      : data.map(row => actCols.map(c => { const v=row[c.key]; return (v===undefined||v===null||v==="")? "-" : String(v); }));

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
        doc.text(`Page ${pn}  |  Generated: ${today}`, pw-14, ph-7, {align:"right"});
      },
    });

    doc.save(`${cfg.label.replace(/[\s/]+/g,"_")}_${today}.pdf`);
  }

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Reports & Export</h2>
        <p className="text-sm text-gray-500 mt-0.5">Generate, filter and export reports for any module</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
        <div className="flex flex-wrap gap-3 items-end">
          {cfg.quickFilters.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</label>
              <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy min-w-28"
                value={filters[f.key]||"All"}
                onChange={e => setFilters(prev=>({...prev,[f.key]:e.target.value}))}>
                {f.options.map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {cfg.dateField && (<>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{cfg.dateLabel} From</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-school-navy"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{cfg.dateLabel} To</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
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
          <button onClick={()=>{setFilters({});setDateFrom("");setDateTo("");setSearch("");}}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors self-end">
            <RefreshCw className="w-3 h-3"/>Reset
          </button>
        </div>

        {/* Column selector — hidden for eligibility */}
        {!cfg.isEligibility && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Columns to Include in Report</p>
            <div className="flex flex-wrap gap-2">
              {cfg.columns.map(col => (
                <button key={col.key} onClick={()=>setSelCols(prev=>({...prev,[col.key]:!prev[col.key]}))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${selCols[col.key]?"bg-school-navy border-school-navy text-white":"border-gray-200 text-gray-500 hover:border-gray-400"}`}>
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Eligibility criteria info */}
        {cfg.isEligibility && (
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
          {!cfg.isEligibility && (<>&nbsp;&nbsp;·&nbsp;&nbsp;<span className="font-semibold text-school-navy">{actCols.length}</span> columns selected</>)}
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
      {!cfg.isEligibility && (
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
                        : (row[c.key]!==undefined&&row[c.key]!=="")
                          ? String(row[c.key])
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
      {cfg.isEligibility && (
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
