"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users, Plus, Search, X, Phone, Mail, MapPin,
  Calendar, IndianRupee, GraduationCap, Briefcase,
  User, FileText, Check, Eye, BookOpen,
  ChevronRight, ChevronLeft, Shield,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const DESIGNATIONS = {
  management:     ["Principal", "Vice Principal", "Director", "Coordinator"],
  teaching:       ["Class Teacher", "Subject Teacher", "HOD", "PGT", "TGT", "PRT"],
  "non-teaching": ["Accountant", "Admin", "Librarian", "Lab Assistant", "Peon", "Security", "Clerk", "Receptionist"],
};

const DEPARTMENTS = [
  "Administration", "Primary", "Secondary",
  "Higher Secondary", "Sports & Activity", "Arts & Craft", "Non-Teaching",
];

const EMPLOYMENT_TYPES = ["Permanent", "Contractual", "Part-time"];

const SUBJECTS_LIST = [
  "Mathematics", "Science", "English", "Hindi", "Social Studies",
  "Computer Science", "Accountancy", "Economics", "Business Studies",
  "Physical Education", "Drawing", "Sanskrit", "Gujarati", "EVS", "Odia",
];

const CLASS_LIST = [
  "JR.KG", "SR.KG", "Balvatika",
  "1st", "2nd", "3rd", "4th", "5th",
  "6th", "7th", "8th", "9th", "10th",
  "11th - Commerce", "12th - Commerce",
];

const SECTIONS = ["A", "B", "C", "D"];
const CLASSES_WITH_SECTIONS = CLASS_LIST.flatMap((c) => SECTIONS.map((s) => `${c}-${s}`));

const REQUIRED_DOCS = [
  "Aadhar Card", "PAN Card", "Degree Certificate",
  "Experience Letter", "Photo", "Address Proof",
];

const TYPE_COLOR = {
  management:     "bg-purple-100 text-purple-700",
  teaching:       "bg-blue-100 text-blue-700",
  "non-teaching": "bg-gray-100 text-gray-600",
};

const TYPE_LABEL = {
  management:     "Management",
  teaching:       "Teaching",
  "non-teaching": "Non-Teaching",
};

const AVATAR_BG = [
  "bg-school-navy", "bg-blue-600", "bg-purple-600", "bg-green-600",
  "bg-amber-600",   "bg-red-600",  "bg-teal-600",   "bg-indigo-600",
  "bg-pink-600",    "bg-orange-600",
];

const ADD_TABS = ["Personal", "Job", "Academic", "Documents"];

// ── Dummy Data ─────────────────────────────────────────────────────────────────
const INITIAL_EMPLOYEES = [
  {
    id: 1, empId: "EMP001", name: "Sunil Pradhan", photo: null,
    type: "management", designation: "Principal", department: "Administration",
    gender: "Male", dob: "1970-03-15", phone: "9876543210", altPhone: "",
    email: "sunil@satyamstars.edu.in", address: "12, Rander Road, Surat, Gujarat - 395009",
    aadhar: "1234 5678 9012", pan: "ABCDE1234F",
    joiningDate: "2015-06-01", employmentType: "Permanent", salary: 55000, status: "Active",
    classTeacherOf: null, subjects: [], teachesClasses: [],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 2, empId: "EMP002", name: "Rajesh Pradhan", photo: null,
    type: "management", designation: "Vice Principal", department: "Administration",
    gender: "Male", dob: "1975-07-22", phone: "9765432100", altPhone: "9876500011",
    email: "rajesh@satyamstars.edu.in", address: "45, City Light Road, Surat, Gujarat - 395007",
    aadhar: "2345 6789 0123", pan: "FGHIJ5678K",
    joiningDate: "2018-06-01", employmentType: "Permanent", salary: 45000, status: "Active",
    classTeacherOf: null, subjects: [], teachesClasses: [],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: false },
    ],
  },
  {
    id: 3, empId: "EMP003", name: "Anita Sharma", photo: null,
    type: "teaching", designation: "Class Teacher", department: "Primary",
    gender: "Female", dob: "1985-11-08", phone: "9654321098", altPhone: "",
    email: "anita@satyamstars.edu.in", address: "78, Adajan Patia, Surat, Gujarat - 395009",
    aadhar: "3456 7890 1234", pan: "KLMNO9012P",
    joiningDate: "2019-06-01", employmentType: "Permanent", salary: 22000, status: "Active",
    classTeacherOf: "1st-A", subjects: ["English", "EVS", "Drawing"], teachesClasses: ["1st", "2nd"],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: false },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 4, empId: "EMP004", name: "Ramesh Gupta", photo: null,
    type: "teaching", designation: "PGT", department: "Secondary",
    gender: "Male", dob: "1980-05-14", phone: "9543210987", altPhone: "",
    email: "ramesh@satyamstars.edu.in", address: "23, Vesu, Surat, Gujarat - 395007",
    aadhar: "4567 8901 2345", pan: "QRSTU3456V",
    joiningDate: "2017-06-01", employmentType: "Permanent", salary: 28000, status: "Active",
    classTeacherOf: "10th-A", subjects: ["Mathematics"], teachesClasses: ["8th", "9th", "10th"],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 5, empId: "EMP005", name: "Priyanka Mehta", photo: null,
    type: "teaching", designation: "TGT", department: "Secondary",
    gender: "Female", dob: "1988-09-30", phone: "9432109876", altPhone: "9120000055",
    email: "", address: "56, Pal Gam, Surat, Gujarat - 394510",
    aadhar: "5678 9012 3456", pan: "",
    joiningDate: "2020-06-01", employmentType: "Contractual", salary: 18000, status: "Active",
    classTeacherOf: "8th-B", subjects: ["Science"], teachesClasses: ["6th", "7th", "8th"],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: false },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: false },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 6, empId: "EMP006", name: "Kavita Desai", photo: null,
    type: "teaching", designation: "PRT", department: "Primary",
    gender: "Female", dob: "1990-02-18", phone: "9321098765", altPhone: "",
    email: "kavita@satyamstars.edu.in", address: "89, Katargam, Surat, Gujarat - 395004",
    aadhar: "6789 0123 4567", pan: "WXYZ78901A",
    joiningDate: "2021-06-01", employmentType: "Permanent", salary: 16000, status: "Active",
    classTeacherOf: "JR.KG-A", subjects: ["English", "Drawing", "EVS"], teachesClasses: ["JR.KG", "SR.KG"],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: false }, { name: "Experience Letter", uploaded: false },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 7, empId: "EMP007", name: "Harish Patel", photo: null,
    type: "non-teaching", designation: "Accountant", department: "Administration",
    gender: "Male", dob: "1983-12-05", phone: "9210987654", altPhone: "",
    email: "harish@satyamstars.edu.in", address: "34, Bhatar Road, Surat, Gujarat - 395007",
    aadhar: "7890 1234 5678", pan: "BCDE23456F",
    joiningDate: "2018-06-01", employmentType: "Permanent", salary: 20000, status: "Active",
    classTeacherOf: null, subjects: [], teachesClasses: [],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 8, empId: "EMP008", name: "Sanjay Rao", photo: null,
    type: "non-teaching", designation: "Peon", department: "Non-Teaching",
    gender: "Male", dob: "1992-06-25", phone: "9109876543", altPhone: "",
    email: "", address: "67, Limbayat, Surat, Gujarat - 395006",
    aadhar: "8901 2345 6789", pan: "",
    joiningDate: "2022-06-01", employmentType: "Permanent", salary: 10000, status: "Active",
    classTeacherOf: null, subjects: [], teachesClasses: [],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: false },
      { name: "Degree Certificate", uploaded: false }, { name: "Experience Letter", uploaded: false },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: true },
    ],
  },
  {
    id: 9, empId: "EMP009", name: "Ravi Singh", photo: null,
    type: "non-teaching", designation: "Security", department: "Non-Teaching",
    gender: "Male", dob: "1988-04-10", phone: "9098765432", altPhone: "9000000099",
    email: "", address: "90, Udhna, Surat, Gujarat - 394210",
    aadhar: "9012 3456 7890", pan: "",
    joiningDate: "2023-06-01", employmentType: "Contractual", salary: 12000, status: "Active",
    classTeacherOf: null, subjects: [], teachesClasses: [],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: false },
      { name: "Degree Certificate", uploaded: false }, { name: "Experience Letter", uploaded: false },
      { name: "Photo", uploaded: true }, { name: "Address Proof", uploaded: false },
    ],
  },
  {
    id: 10, empId: "EMP010", name: "Meena Joshi", photo: null,
    type: "teaching", designation: "Class Teacher", department: "Primary",
    gender: "Female", dob: "1987-08-12", phone: "9876001122", altPhone: "",
    email: "meena@satyamstars.edu.in", address: "12, Piplod, Surat, Gujarat - 395007",
    aadhar: "0123 4567 8901", pan: "GHIJK67890L",
    joiningDate: "2020-06-01", employmentType: "Permanent", salary: 19000, status: "Inactive",
    classTeacherOf: "2nd-A", subjects: ["Hindi", "English", "EVS"], teachesClasses: ["2nd", "3rd"],
    documents: [
      { name: "Aadhar Card", uploaded: true }, { name: "PAN Card", uploaded: true },
      { name: "Degree Certificate", uploaded: true }, { name: "Experience Letter", uploaded: true },
      { name: "Photo", uploaded: false }, { name: "Address Proof", uploaded: true },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

function calcAge(dob) {
  if (!dob) return null;
  try {
    const d = new Date(dob); const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  } catch { return null; }
}

function avatarBg(id) {
  return AVATAR_BG[Math.abs(id) % AVATAR_BG.length];
}

function docsDone(emp) {
  return emp.documents.filter((d) => d.uploaded).length;
}

function toggleArr(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";

// ── InfoRow ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── View Employee Modal ────────────────────────────────────────────────────────
function ViewEmployeeModal({ emp, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bg           = avatarBg(emp.id);
  const age          = calcAge(emp.dob);
  const done         = docsDone(emp);
  const allDocsOk    = done === emp.documents.length;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md`}>
              <span className="text-white font-bold text-xl">{initials(emp.name)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-gray-800">{emp.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_COLOR[emp.type]}`}>
                  {TYPE_LABEL[emp.type]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  {emp.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{emp.designation} · {emp.department}</p>
              <p className="text-xs text-gray-400 mt-0.5">{emp.empId} · Joined {fmtDate(emp.joiningDate)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Personal */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Information</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Phone" value={emp.phone} icon={Phone} />
              {emp.altPhone && <InfoRow label="Alt. Phone" value={emp.altPhone} icon={Phone} />}
              {emp.email   && <InfoRow label="Email"      value={emp.email}    icon={Mail}  />}
              <InfoRow label="Date of Birth"
                value={emp.dob ? `${fmtDate(emp.dob)}${age ? ` (${age} yrs)` : ""}` : "—"}
                icon={Calendar} />
              <InfoRow label="Gender"  value={emp.gender}  icon={User}     />
              <InfoRow label="Aadhar"  value={emp.aadhar}  icon={FileText} />
              {emp.pan && <InfoRow label="PAN" value={emp.pan} icon={FileText} />}
            </div>
            {emp.address && (
              <div className="mt-3 flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Address</p>
                  <p className="text-sm text-gray-800 font-medium">{emp.address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Job */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Job Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Salary"     value={`₹${emp.salary.toLocaleString("en-IN")} / month`} icon={IndianRupee} />
              <InfoRow label="Employment" value={emp.employmentType} icon={Briefcase} />
              <InfoRow label="Status"     value={emp.status}         icon={Shield}    />
            </div>
          </div>

          {/* Academic */}
          {emp.type === "teaching" && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Academic Assignment</p>
              <div className="space-y-3">
                {emp.classTeacherOf && (
                  <div className="flex items-start gap-2.5">
                    <GraduationCap className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Class Teacher Of</p>
                      <p className="text-sm font-bold text-school-navy">{emp.classTeacherOf}</p>
                    </div>
                  </div>
                )}
                {emp.subjects.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Subjects</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {emp.subjects.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {emp.teachesClasses.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Teaches In</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {emp.teachesClasses.map((c) => (
                          <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {!emp.classTeacherOf && emp.subjects.length === 0 && emp.teachesClasses.length === 0 && (
                  <p className="text-sm text-gray-400">No academic assignment recorded.</p>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Documents</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                allDocsOk ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>
                {done}/{emp.documents.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {emp.documents.map((d) => (
                <div key={d.name}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                    d.uploaded
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>
                  {d.uploaded
                    ? <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    : <X     className="w-3.5 h-3.5 flex-shrink-0" />
                  }
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Add Employee Modal ─────────────────────────────────────────────────────────
function AddEmployeeModal({ employees, onClose, onSave }) {
  const [tab, setTab]         = useState(0);

  // Personal
  const [name, setName]       = useState("");
  const [gender, setGender]   = useState("Male");
  const [dob, setDob]         = useState("");
  const [phone, setPhone]     = useState("");
  const [altPhone, setAlt]    = useState("");
  const [email, setEmail]     = useState("");
  const [address, setAddress] = useState("");
  const [aadhar, setAadhar]   = useState("");
  const [pan, setPan]         = useState("");

  // Job
  const [type, setType]         = useState("teaching");
  const [designation, setDesig] = useState("");
  const [department, setDept]   = useState("");
  const [empType, setEmpType]   = useState("Permanent");
  const [joining, setJoining]   = useState("");
  const [salary, setSalary]     = useState("");
  const [status, setStatus]     = useState("Active");

  // Academic
  const [ctOf, setCtOf]       = useState("");
  const [subjects, setSubj]   = useState([]);
  const [teaches, setTeaches] = useState([]);

  // Documents
  const [docs, setDocs] = useState(REQUIRED_DOCS.map((n) => ({ name: n, uploaded: false })));

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setDesig(""), [type]);

  const nextEmpId = `EMP${String(
    Math.max(0, ...employees.map((e) => parseInt(e.empId.replace("EMP", ""), 10))) + 1
  ).padStart(3, "0")}`;

  const tab0Valid = name.trim().length > 0 && phone.trim().length > 0;
  const tab1Valid = !!(type && designation && department && joining);

  const canGoNext = () => {
    if (tab === 0) return tab0Valid;
    if (tab === 1) return tab1Valid;
    return true;
  };

  const toggleDoc = (docName) =>
    setDocs((prev) => prev.map((d) => d.name === docName ? { ...d, uploaded: !d.uploaded } : d));

  const handleSave = () => {
    if (!tab0Valid || !tab1Valid) return;
    onSave({
      id: Date.now(),
      empId: nextEmpId,
      name: name.trim(), photo: null,
      type, designation, department,
      gender, dob, phone: phone.trim(), altPhone: altPhone.trim(),
      email: email.trim(), address: address.trim(),
      aadhar: aadhar.trim(), pan: pan.trim(),
      joiningDate: joining, employmentType: empType,
      salary: salary ? Number(salary) : 0, status,
      classTeacherOf: type === "teaching" ? ctOf || null : null,
      subjects: type === "teaching" ? subjects : [],
      teachesClasses: type === "teaching" ? teaches : [],
      documents: docs,
    });
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800">Add Employee</h3>
            <p className="text-xs text-gray-400 mt-0.5">{nextEmpId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {ADD_TABS.map((t, i) => (
            <button key={t}
              onClick={() => { if (i < tab || (i > tab && canGoNext())) setTab(i); }}
              className={`pb-3 pt-3.5 px-1 mr-5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1 ${
                tab === i
                  ? "border-school-navy text-school-navy"
                  : i < tab
                  ? "border-transparent text-green-600"
                  : "border-transparent text-gray-300 cursor-default"
              }`}>
              {i < tab && <Check className="w-3 h-3" />}
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Personal */}
          {tab === 0 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
                <input className={IPT} placeholder="e.g. Anita Sharma" value={name}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender *</label>
                  <select className={IPT} value={gender} onChange={(e) => setGender(e.target.value)}>
                    {["Male", "Female", "Other"].map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Birth</label>
                  <input type="date" className={IPT} value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
                  <input className={IPT} placeholder="10-digit mobile" value={phone}
                    onChange={(e) => setPhone(e.target.value)} maxLength={10} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alt. Phone</label>
                  <input className={IPT} placeholder="Optional" value={altPhone}
                    onChange={(e) => setAlt(e.target.value)} maxLength={10} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input type="email" className={IPT} placeholder="name@satyamstars.edu.in"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                <input className={IPT} placeholder="Full residential address"
                  value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Aadhar No.</label>
                  <input className={IPT} placeholder="XXXX XXXX XXXX"
                    value={aadhar} onChange={(e) => setAadhar(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">PAN No.</label>
                  <input className={IPT} placeholder="ABCDE1234F"
                    value={pan} onChange={(e) => setPan(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Job */}
          {tab === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Staff Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["management", "Management"], ["teaching", "Teaching"], ["non-teaching", "Non-Teaching"]].map(([k, l]) => (
                    <button key={k} onClick={() => setType(k)}
                      className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                        type === k
                          ? "border-school-navy bg-school-navy/5 text-school-navy"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation *</label>
                  <select className={IPT} value={designation} onChange={(e) => setDesig(e.target.value)}>
                    <option value="">Select...</option>
                    {(DESIGNATIONS[type] || []).map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department *</label>
                  <select className={IPT} value={department} onChange={(e) => setDept(e.target.value)}>
                    <option value="">Select...</option>
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Joining Date *</label>
                  <input type="date" className={IPT} value={joining}
                    onChange={(e) => setJoining(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employment Type</label>
                  <select className={IPT} value={empType} onChange={(e) => setEmpType(e.target.value)}>
                    {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Salary (₹ / month)</label>
                  <input type="number" min="0" className={IPT} placeholder="0"
                    value={salary} onChange={(e) => setSalary(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                  <select className={IPT} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {["Active", "Inactive"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Academic */}
          {tab === 2 && (
            type !== "teaching" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                  <BookOpen className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">Academic tab is for Teaching staff only.</p>
                <p className="text-xs text-gray-400 mt-1">Skip to Documents or go back to change Staff Type.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class Teacher Of</label>
                  <select className={IPT} value={ctOf} onChange={(e) => setCtOf(e.target.value)}>
                    <option value="">None / Not a class teacher</option>
                    {CLASSES_WITH_SECTIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Subjects Taught</label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS_LIST.map((s) => (
                      <button key={s} onClick={() => setSubj(toggleArr(subjects, s))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          subjects.includes(s)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Teaches In (Classes)</label>
                  <div className="flex flex-wrap gap-2">
                    {CLASS_LIST.map((c) => (
                      <button key={c} onClick={() => setTeaches(toggleArr(teaches, c))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          teaches.includes(c)
                            ? "bg-school-navy text-white border-school-navy"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )
          )}

          {/* Documents */}
          {tab === 3 && (
            <>
              <p className="text-xs text-gray-500">Mark which documents have been collected from this employee:</p>
              <div className="space-y-2">
                {docs.map((d) => (
                  <button key={d.name} onClick={() => toggleDoc(d.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors text-left ${
                      d.uploaded
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      d.uploaded ? "bg-green-500 border-green-500" : "border-gray-300"
                    }`}>
                      {d.uploaded && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {d.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {tab === 0 ? (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          ) : (
            <button onClick={() => setTab(tab - 1)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {tab < ADD_TABS.length - 1 ? (
            <button onClick={() => setTab(tab + 1)} disabled={!canGoNext()}
              className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={!tab0Valid || !tab1Valid}
              className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
              Add Employee
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmployeePage() {
  const [employees, setEmployees]   = useState(INITIAL_EMPLOYEES);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [viewEmp, setViewEmp]       = useState(null);
  const [addOpen, setAddOpen]       = useState(false);

  const total       = employees.length;
  const teaching    = employees.filter((e) => e.type === "teaching").length;
  const nonTeaching = employees.filter((e) => e.type === "non-teaching").length;
  const management  = employees.filter((e) => e.type === "management").length;

  const allDepts = [...new Set(employees.map((e) => e.department))].sort();

  const filtered = employees.filter((e) => {
    const ms = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.empId.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === "all" || e.type === typeFilter;
    const md = deptFilter === "all" || e.department === deptFilter;
    return ms && mt && md;
  });

  const handleAdd = (emp) => {
    setEmployees((prev) => [...prev, emp]);
    setAddOpen(false);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Employee Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Staff profiles, assignments & document tracking</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Staff",   value: total,       color: "text-blue-600",   bg: "bg-blue-50",   icon: Users       },
          { label: "Teaching",      value: teaching,    color: "text-green-600",  bg: "bg-green-50",  icon: GraduationCap },
          { label: "Non-Teaching",  value: nonTeaching, color: "text-gray-600",   bg: "bg-gray-100",  icon: Briefcase   },
          { label: "Management",    value: management,  color: "text-purple-600", bg: "bg-purple-50", icon: Shield      },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
              placeholder="Search by name, ID, designation..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ["all", "All"],
              ["management",   "Management"],
              ["teaching",     "Teaching"],
              ["non-teaching", "Non-Teaching"],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  typeFilter === k
                    ? "bg-school-navy text-white border-school-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>{l}</button>
            ))}
          </div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white cursor-pointer">
            <option value="all">All Departments</option>
            {allDepts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Salary</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Docs</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-gray-400 text-sm">
                    No employees match your filters
                  </td>
                </tr>
              )}
              {filtered.map((emp) => {
                const bg     = avatarBg(emp.id);
                const done   = docsDone(emp);
                const docsOk = done === emp.documents.length;
                return (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white font-bold text-xs">{initials(emp.name)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.empId} · {emp.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_COLOR[emp.type]}`}>
                        {TYPE_LABEL[emp.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3.5 text-gray-600">{emp.phone}</td>
                    <td className="px-4 py-3.5 text-gray-500">{fmtDate(emp.joiningDate)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-700">
                      ₹{emp.salary.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-bold ${docsOk ? "text-green-600" : "text-amber-600"}`}>
                        {done}/{emp.documents.length}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setViewEmp(emp)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
            Showing {filtered.length} of {total} employees
          </div>
        )}
      </div>

      {viewEmp && <ViewEmployeeModal emp={viewEmp} onClose={() => setViewEmp(null)} />}
      {addOpen  && <AddEmployeeModal employees={employees} onClose={() => setAddOpen(false)} onSave={handleAdd} />}
    </div>
  );
}
