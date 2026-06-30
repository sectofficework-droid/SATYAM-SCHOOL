"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useStore from "@/lib/store";
import supabase from "@/lib/supabase";
import { addExpense } from "@/lib/expensesService";
import * as XLSX from "xlsx";
import {
  isValidName, isValidPhone, isValidEmail, isValidAadhar,
  isNonEmpty, isPastOrTodayDate, isValidUploadFile,
} from "@/lib/validators";
import { getActiveClasses } from "@/lib/settingsService";
import { getEmployees, addEmployee, updateEmployee } from "@/lib/employeeService";
import { uploadFileToS3, slugify, fileExt } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";
import S3Image from "@/components/S3Image";
import {
  Users, Plus, Search, X, Phone, Mail, MapPin,
  Calendar, GraduationCap, Briefcase, Pencil,
  User, FileText, Check, Eye, BookOpen,
  ChevronRight, ChevronLeft, Shield, Upload,
  ClipboardList, IndianRupee, AlertCircle, Download,
  CheckCircle2, TrendingDown, FileSpreadsheet,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const DESIGNATIONS = {
  management:     ["Principal", "Vice Principal", "Director", "Coordinator"],
  teaching:       ["Class Teacher", "Subject Teacher", "HOD", "PGT", "TGT", "PRT"],
  "non-teaching": ["Accountant", "Admin", "Librarian", "Lab Assistant", "Peon", "Security", "Clerk", "Receptionist", "Care Taker"],
  media:          ["Social Media Manager", "Editor", "Content Creator", "Photographer", "Videographer"],
};

const DEPARTMENTS = [
  "Administration", "Primary", "Secondary",
  "Higher Secondary", "Sports & Activity", "Arts & Craft", "Non-Teaching",
  "Media & Communications",
];

const EMPLOYMENT_TYPES = ["Permanent", "Contractual", "Part-time"];

const SUBJECTS_LIST = [
  "Mathematics", "Science", "English", "Hindi", "Social Studies",
  "Computer Science", "Accountancy", "Economics", "Business Studies",
  "Physical Education", "Drawing", "Sanskrit", "Gujarati", "EVS", "Odia",
];

const SECTIONS = ["A", "B", "C", "D"];

const REQUIRED_DOCS = [
  "Aadhar Card", "PAN Card", "Degree Certificate",
  "Experience Letter", "Photo", "Address Proof",
];

const TYPE_COLOR = {
  management:     "bg-purple-100 text-purple-700",
  teaching:       "bg-blue-100 text-blue-700",
  "non-teaching": "bg-gray-100 text-gray-600",
  media:          "bg-rose-100 text-rose-700",
};

const TYPE_LABEL = {
  management:     "Management",
  teaching:       "Teaching",
  "non-teaching": "Non-Teaching",
  media:          "Media",
};

const AVATAR_BG = [
  "bg-school-navy", "bg-blue-600", "bg-purple-600", "bg-green-600",
  "bg-amber-600",   "bg-red-600",  "bg-teal-600",   "bg-indigo-600",
  "bg-pink-600",    "bg-orange-600",
];

const ADD_TABS = ["Personal", "Job", "Academic", "Documents"];

// PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
function isValidPan(v) {
  if (!isNonEmpty(v)) return false;
  return PAN_RE.test(String(v).trim().toUpperCase());
}


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

function avatarBg(empId) { const n = parseInt(String(empId).replace(/\D/g,""),10)||0; return AVATAR_BG[n % AVATAR_BG.length]; }
function docsDone(emp) { return (emp.documents || []).filter((d) => d.uploaded).length; }
function fmtAadhar(val) {
  const digits = val.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
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

  const bg        = avatarBg(emp.empId);
  const age       = calcAge(emp.dob);
  const done      = docsDone(emp);
  const allDocsOk = done === (emp.documents || []).length;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden`}>
              <S3Image
                s3Key={emp.photo}
                alt={emp.name}
                className="w-full h-full object-cover"
                fallback={<span className="text-white font-bold text-xl">{initials(emp.name)}</span>}
              />
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
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Employment Type" value={emp.employmentType} icon={Briefcase} />
              <InfoRow label="Status"          value={emp.status}         icon={Shield}    />
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
                {emp.subjectMappings && emp.subjectMappings.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Subjects & Classes</p>
                      <div className="space-y-2">
                        {emp.subjectMappings.map((m, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-xs font-bold text-blue-700 w-28 flex-shrink-0 pt-0.5">{m.subject}</span>
                            <div className="flex flex-wrap gap-1">
                              {m.classes.map((c) => (
                                <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">{c}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {!emp.classTeacherOf && (!emp.subjectMappings || emp.subjectMappings.length === 0) && (
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
                {done}/{(emp.documents || []).length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(emp.documents || []).map((d) => (
                <div key={d.name}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${
                    d.uploaded
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {d.uploaded
                      ? <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      : <X     className="w-3.5 h-3.5 flex-shrink-0" />
                    }
                    <span className="truncate">{d.name}</span>
                  </div>
                  {d.uploaded && d.fileName && (
                    <span className="text-[10px] font-normal text-green-600 truncate max-w-[130px] flex-shrink-0">
                      {d.fileName}
                    </span>
                  )}
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
// docs state: { name, selected, file, fileName }
// "selected" = checkbox toggled; a doc is only "uploaded" when fileName is set
function AddEmployeeModal({ employees, onClose, onSave }) {
  const [tab, setTab]         = useState(0);
  const [sessionId] = useState(() => crypto.randomUUID());

  const [classList,          setClassList]          = useState([]);
  const [classesWithSections, setClassesWithSections] = useState([]);

  useEffect(() => {
    getActiveClasses().then(cls => {
      const names = cls.map(c => c.name);
      setClassList(names);
      const withSec = cls.flatMap(c => {
        const secs = (c.sections || []).map(s => s.name);
        return secs.length > 0 ? secs.map(s => `${c.name}-${s}`) : [c.name];
      });
      setClassesWithSections(withSec);
    }).catch(() => {});
  }, []);

  // Personal
  const [name, setName]         = useState("");
  const [gender, setGender]     = useState("Male");
  const [dob, setDob]           = useState("");
  const [phone, setPhone]       = useState("");
  const [altPhone, setAlt]      = useState("");
  const [email, setEmail]       = useState("");
  const [address, setAddress]   = useState("");
  const [aadharDisplay, setAadharDisplay] = useState("");
  const [pan, setPan]           = useState("");
  const [photo, setPhoto]             = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoKey, setPhotoKey]       = useState(null);
  const [photoSize, setPhotoSize]     = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]   = useState("");
  const photoRef = useRef(null);

  // Job
  const [type, setType]         = useState("teaching");
  const [designation, setDesig] = useState("");
  const [department, setDept]   = useState("");
  const [empType, setEmpType]   = useState("Permanent");
  const [joining, setJoining]   = useState("");
  const [status, setStatus]     = useState("Active");

  // Academic — class teacher + subject→class mappings
  const [ctOf, setCtOf]         = useState("");
  const [mappings, setMappings] = useState([]); // [{subject:"", classes:[]}]

  // Documents — selected: checkbox toggled; file uploaded only when fileName set
  const [docs, setDocs] = useState(
    REQUIRED_DOCS.map((n) => ({ name: n, selected: false, file: null, fileName: "", key: null, size: 0, uploading: false, error: "" }))
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setDesig(""), [type]);

  const nextEmpId = `EMP${String(
    Math.max(0, ...employees.map((e) => parseInt(e.empId.replace("EMP", ""), 10))) + 1
  ).padStart(3, "0")}`;

  // Personal tab — field-level format validation
  const nameValid     = isValidName(name);
  const phoneValid    = isValidPhone(phone);
  const altPhoneValid = !isNonEmpty(altPhone) || isValidPhone(altPhone);
  const emailValid    = !isNonEmpty(email) || isValidEmail(email);
  const aadharValid   = !isNonEmpty(aadharDisplay) || isValidAadhar(aadharDisplay);
  const panValid      = !isNonEmpty(pan) || isValidPan(pan);

  const tab0Valid = nameValid && phoneValid && altPhoneValid && emailValid && aadharValid && panValid;

  // Job tab — joining date must not be in the future
  const joiningValid = !!joining && isPastOrTodayDate(joining);
  const tab1Valid = !!(type && designation && department) && joiningValid;

  // Documents tab — every uploaded file must pass type/size checks
  const docsValid = docs.every((d) => isValidUploadFile(d.file));

  const canGoNext = () => {
    if (tab === 0) return tab0Valid;
    if (tab === 1) return tab1Valid;
    if (tab === 3) return docsValid;
    return true;
  };

  // Aadhar: format as XXXX XXXX XXXX
  const handleAadhar = (e) => setAadharDisplay(fmtAadhar(e.target.value));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isValidUploadFile(file)) {
      setPhotoError("Invalid file — only JPG/PNG up to 5MB allowed.");
      e.target.value = "";
      return;
    }
    setPhotoError("");
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoKey(null);
    setPhotoSize(0);
    setPhotoUploading(true);
    compressFile(file)
      .then((compressed) => {
        const key = `employees/pending/${sessionId}/photo.${fileExt(compressed)}`;
        setPhotoSize(compressed.size);
        return uploadFileToS3(compressed, key).then(() => setPhotoKey(key));
      })
      .catch(() => setPhotoError("Photo upload failed — please try again."))
      .finally(() => setPhotoUploading(false));
  };

  // Documents
  const toggleDoc = (docName) =>
    setDocs((prev) => prev.map((d) => {
      if (d.name !== docName) return d;
      const next = !d.selected;
      return { ...d, selected: next, ...(next ? {} : { file: null, fileName: "", error: "" }) };
    }));

  const handleFileSelect = (docName, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isValidUploadFile(file)) {
      setDocs((prev) => prev.map((d) =>
        d.name === docName ? { ...d, file: null, fileName: "", key: null, error: "Only JPG/PNG/PDF up to 5MB allowed" } : d
      ));
      e.target.value = "";
      return;
    }
    setDocs((prev) => prev.map((d) =>
      d.name === docName ? { ...d, file, fileName: file.name, key: null, size: 0, uploading: true, error: "" } : d
    ));
    e.target.value = "";
    compressFile(file)
      .then((compressed) => {
        const key = `employees/pending/${sessionId}/documents/${slugify(docName)}.${fileExt(compressed)}`;
        return uploadFileToS3(compressed, key).then(() =>
          setDocs((prev) => prev.map((d) => d.name === docName ? { ...d, key, size: compressed.size, uploading: false } : d))
        );
      })
      .catch(() => setDocs((prev) => prev.map((d) =>
        d.name === docName ? { ...d, uploading: false, error: "Upload failed — please try again." } : d
      )));
  };

  const removeFile = (docName) =>
    setDocs((prev) => prev.map((d) =>
      d.name === docName ? { ...d, file: null, fileName: "", key: null, size: 0, error: "" } : d
    ));

  // Subject-class mappings
  const addMapping    = () => setMappings((prev) => [...prev, { subject: "", classes: [] }]);
  const removeMapping = (i) => setMappings((prev) => prev.filter((_, idx) => idx !== i));
  const updateSubject = (i, val) =>
    setMappings((prev) => prev.map((m, idx) => idx === i ? { ...m, subject: val } : m));
  const toggleClass = (i, cls) =>
    setMappings((prev) => prev.map((m, idx) => {
      if (idx !== i) return m;
      const classes = m.classes.includes(cls) ? m.classes.filter((c) => c !== cls) : [...m.classes, cls];
      return { ...m, classes };
    }));

  const handleSave = () => {
    if (!tab0Valid || !tab1Valid || !docsValid) return;
    if (docs.some((d) => d.uploading) || photoUploading) {
      alert("Please wait for file uploads to finish before submitting.");
      return;
    }
    onSave({
      id: Date.now(),
      empId: nextEmpId,
      name: name.trim(), photo: photoKey,
      type, designation, department,
      gender, dob,
      phone: phone.trim(), altPhone: altPhone.trim(),
      email: email.trim(), address: address.trim(),
      aadhar: aadharDisplay, pan: pan.trim(),
      joiningDate: joining, employmentType: empType, status,
      classTeacherOf: type === "teaching" ? ctOf || null : null,
      subjectMappings: type === "teaching"
        ? mappings.filter((m) => m.subject && m.classes.length > 0)
        : [],
      // doc is "uploaded" only when a file was actually selected and finished uploading
      documents: docs.map(({ name: n, fileName, key }) => ({
        name: n,
        uploaded: !!key,
        fileName,
        fileUrl: key || null,
      })),
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
                tab === i ? "border-school-navy text-school-navy"
                : i < tab  ? "border-transparent text-green-600"
                :             "border-transparent text-gray-300 cursor-default"
              }`}>
              {i < tab && <Check className="w-3 h-3" />}{t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ── Personal ── */}
          {tab === 0 && (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <User className="w-7 h-7 text-gray-300" />}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Photo</label>
                  <input ref={photoRef} type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
                  <button type="button" onClick={() => photoRef.current.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {photoUploading ? "Uploading…" : photoPreview ? "Change Photo" : "Upload Photo"}
                  </button>
                  {!photoUploading && photoSize > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1">✓ {formatFileSize(photoSize)}</p>
                  )}
                  {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
                <input className={IPT} placeholder="e.g. Anita Sharma" value={name}
                  onChange={(e) => setName(e.target.value)} />
                {name.length > 0 && !nameValid && (
                  <p className="text-xs text-red-500 mt-1">Enter a valid name (letters only, 2-60 chars)</p>
                )}
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
                  {phone.length > 0 && !phoneValid && (
                    <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alt. Phone</label>
                  <input className={IPT} placeholder="Optional" value={altPhone}
                    onChange={(e) => setAlt(e.target.value)} maxLength={10} />
                  {altPhone.length > 0 && !altPhoneValid && (
                    <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input type="email" className={IPT} placeholder="name@satyamstars.edu.in"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                {email.length > 0 && !emailValid && (
                  <p className="text-xs text-red-500 mt-1">Enter a valid email address</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                <input className={IPT} placeholder="Full residential address"
                  value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Aadhar No.</label>
                  <input className={`${IPT} tracking-widest font-mono`}
                    placeholder="XXXX XXXX XXXX"
                    value={aadharDisplay}
                    onChange={handleAadhar}
                    maxLength={14} />
                  {aadharDisplay.length > 0 && !aadharValid && (
                    <p className="text-xs text-red-500 mt-1">Enter a valid 12-digit Aadhar number</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">PAN No.</label>
                  <input className={IPT} placeholder="ABCDE1234F"
                    value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} />
                  {pan.length > 0 && !panValid && (
                    <p className="text-xs text-red-500 mt-1">Enter a valid PAN (e.g. ABCDE1234F)</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Job ── */}
          {tab === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Staff Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["management","Management"],["teaching","Teaching"],["non-teaching","Non-Teaching"],["media","Media"]].map(([k,l]) => (
                    <button key={k} onClick={() => setType(k)}
                      className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                        type === k ? "border-school-navy bg-school-navy/5 text-school-navy"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>{l}</button>
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
                  {joining.length > 0 && !joiningValid && (
                    <p className="text-xs text-red-500 mt-1">Joining date cannot be in the future</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employment Type</label>
                  <select className={IPT} value={empType} onChange={(e) => setEmpType(e.target.value)}>
                    {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                <select className={IPT} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["Active", "Inactive"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── Academic ── */}
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
                {/* Class teacher */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Class Teacher Of</label>
                  <select className={IPT} value={ctOf} onChange={(e) => setCtOf(e.target.value)}>
                    <option value="">None / Not a class teacher</option>
                    {classesWithSections.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Subject-class mappings */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Subject &amp; Classes Taught
                    </label>
                    <button onClick={addMapping}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                      <Plus className="w-3 h-3" /> Add Subject
                    </button>
                  </div>

                  {mappings.length === 0 && (
                    <div className="text-center py-5 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
                      No subjects added yet. Click &ldquo;Add Subject&rdquo; above.
                    </div>
                  )}

                  <div className="space-y-3">
                    {mappings.map((m, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3.5 space-y-3">
                        {/* Subject selector + remove */}
                        <div className="flex items-center gap-2">
                          <select value={m.subject} onChange={(e) => updateSubject(i, e.target.value)}
                            className={`flex-1 ${IPT}`}>
                            <option value="">Select Subject...</option>
                            {SUBJECTS_LIST
                              .filter((s) => !mappings.some((mm, ii) => ii !== i && mm.subject === s))
                              .map((s) => <option key={s}>{s}</option>)
                            }
                          </select>
                          <button onClick={() => removeMapping(i)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Class toggles */}
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">Teaches this subject in:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {classList.map((c) => (
                              <button key={c} onClick={() => toggleClass(i, c)}
                                className={`px-2 py-0.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  m.classes.includes(c)
                                    ? "bg-school-navy text-white border-school-navy"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                                }`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          )}

          {/* ── Documents ── */}
          {tab === 3 && (
            <>
              <p className="text-xs text-gray-500">
                Check each document collected, then upload the file. Only documents with a file uploaded will be marked as submitted.
              </p>
              <div className="space-y-2.5">
                {docs.map((d) => {
                  const isUploaded = !!d.key;
                  return (
                    <div key={d.name}
                      className={`rounded-xl border transition-colors ${
                        isUploaded  ? "border-green-200 bg-green-50"
                        : d.selected ? "border-amber-200 bg-amber-50"
                        :              "border-gray-200 bg-white"
                      }`}>
                      {/* Checkbox row */}
                      <button onClick={() => toggleDoc(d.name)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isUploaded  ? "bg-green-500 border-green-500"
                          : d.selected ? "bg-amber-400 border-amber-400"
                          :              "border-gray-300"
                        }`}>
                          {(isUploaded || d.selected) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={
                          isUploaded  ? "text-green-700"
                          : d.selected ? "text-amber-700"
                          :              "text-gray-600"
                        }>
                          {d.name}
                        </span>
                        {d.selected && !isUploaded && (
                          <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            {d.uploading ? "Uploading…" : "File pending"}
                          </span>
                        )}
                      </button>

                      {/* File upload — shown only when selected */}
                      {d.selected && (
                        <div className="px-4 pb-3">
                          {isUploaded ? (
                            <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                              <FileText className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-gray-700 flex-1 truncate">
                                {d.fileName}{d.size ? ` (${formatFileSize(d.size)})` : ""}
                              </span>
                              <button onClick={() => removeFile(d.name)}
                                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-dashed border-amber-300 rounded-lg px-3 py-2 hover:border-amber-400 transition-colors">
                              <Upload className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span className="text-xs text-amber-600 font-medium">Upload file to confirm submission</span>
                              <input type="file" className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => handleFileSelect(d.name, e)} />
                            </label>
                          )}
                          {d.error && (
                            <p className="text-xs text-red-500 mt-1">{d.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <button onClick={handleSave} disabled={!tab0Valid || !tab1Valid || !docsValid}
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

// ── Edit Employee Modal ────────────────────────────────────────────────────────
function EditEmployeeModal({ emp, onClose, onSave }) {
  const baseInput = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy";
  const baseSel   = baseInput + " appearance-none bg-white";

  const [name,      setName]      = useState(emp.name || "");
  const [phone,     setPhone]     = useState(emp.phone || "");
  const [altPhone,  setAltPhone]  = useState(emp.altPhone || "");
  const [email,     setEmail]     = useState(emp.email || "");
  const [type,      setType]      = useState(emp.type || "teaching");
  const [desig,     setDesig]     = useState(emp.designation || "");
  const [dept,      setDept]      = useState(emp.department || "");
  const [empType,   setEmpType]   = useState(emp.employmentType || "Permanent");
  const [status,    setStatus]    = useState(emp.status || "Active");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const typeInitialized = useRef(false);
  useEffect(() => {
    if (!typeInitialized.current) { typeInitialized.current = true; return; }
    setDesig("");
  }, [type]);

  async function handleSave() {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!desig)       { setErr("Designation is required."); return; }
    if (!dept)        { setErr("Department is required."); return; }
    setSaving(true); setErr("");
    await onSave({ ...emp, name: name.trim(), phone, altPhone, email, type, designation: desig, department: dept, employmentType: empType, status });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800">Edit Employee</h3>
            <p className="text-xs text-gray-400 mt-0.5">{emp.empId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500"/>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
              <input className={baseInput} value={name} onChange={e => setName(e.target.value)} placeholder="Employee name"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
              <input className={baseInput} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Alt Phone</label>
              <input className={baseInput} value={altPhone} onChange={e => setAltPhone(e.target.value)} placeholder="Optional"/>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input className={baseInput} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@school.in"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type *</label>
              <select className={baseSel} value={type} onChange={e => setType(e.target.value)}>
                <option value="management">Management</option>
                <option value="teaching">Teaching</option>
                <option value="non-teaching">Non-Teaching</option>
                <option value="media">Media</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation *</label>
              <select className={baseSel} value={desig} onChange={e => setDesig(e.target.value)}>
                <option value="">Select</option>
                {(DESIGNATIONS[type] || []).map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department *</label>
              <select className={baseSel} value={dept} onChange={e => setDept(e.target.value)}>
                <option value="">Select</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employment Type</label>
              <select className={baseSel} value={empType} onChange={e => setEmpType(e.target.value)}>
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
              <select className={baseSel} value={status} onChange={e => setStatus(e.target.value)}>
                <option>Active</option>
                <option>On Leave</option>
                <option>Resigned</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attendance Section ─────────────────────────────────────────────────────────
function AttendanceSection({ employees, salaries, setAttendanceSummary }) {
  const today = new Date().toISOString().split("T")[0];
  const [periodType, setPeriodType] = useState("fullmonth");
  const [fromDate,   setFromDate]   = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [toDate,     setToDate]     = useState(today);
  const [records,    setRecords]    = useState([]);
  const [status,     setStatus]     = useState(null);
  const [statusMsg,  setStatusMsg]  = useState("");
  const [savedKey,   setSavedKey]   = useState(null);
  const fileRef = useRef(null);

  function fmtAmt(n) { return "\u20b9" + Number(n).toLocaleString("en-IN"); }
  function fmtD(d)   { try { return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } }
  function daysInRange(f, t) {
    if (!f || !t) return 0;
    const ms = new Date(t) - new Date(f);
    return ms < 0 ? 0 : Math.round(ms / 86400000) + 1;
  }

  const periodDays = daysInRange(fromDate, toDate);
  const periodKey  = fromDate + "_" + toDate;

  function applyPreset(type) {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const d    = now.getDate();
    let f, t;
    if      (type === "7days")     { t = today; f = new Date(+now - 6*86400000).toISOString().split("T")[0]; }
    else if (type === "15days")    {
      if (d <= 15) { f = new Date(y,m,1).toISOString().split("T")[0];  t = new Date(y,m,15).toISOString().split("T")[0]; }
      else         { f = new Date(y,m,16).toISOString().split("T")[0]; t = new Date(y,m,last).toISOString().split("T")[0]; }
    }
    else if (type === "fullmonth") { f = new Date(y,m,1).toISOString().split("T")[0]; t = new Date(y,m,last).toISOString().split("T")[0]; }
    else { setPeriodType("custom"); return; }
    setPeriodType(type); setFromDate(f); setToDate(t); setRecords([]); setStatus(null);
  }

  function findCol(headers, cands) {
    for (const c of cands) { const i = headers.findIndex(h => h.includes(c)); if (i !== -1) return i; }
    return -1;
  }
  function getEmp(empId, name) {
    return employees.find(e =>
      (empId && e.empId.toLowerCase() === String(empId).toLowerCase()) ||
      (name  && e.name.toLowerCase()  === String(name).trim().toLowerCase())
    ) || null;
  }
  function getSal(emp) { return emp ? ((salaries||{})[emp.empId] ?? 15000) : 15000; }

  function handleFile(file) {
    if (!file || periodDays === 0) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (data.length < 2) { setStatus("error"); setStatusMsg("File has no data rows."); return; }

        const headers   = data[0].map(h => String(h || "").trim().toLowerCase());
        const colEmpId  = findCol(headers, ["emp id","empid","employee id","emp_id","id"]);
        const colName   = findCol(headers, ["name","employee name","staff name","emp name"]);
        const colPres   = findCol(headers, ["present days","present","days present","p days","attended"]);
        const colAbsent = findCol(headers, ["absent days","absent","lop","loss of pay","a days"]);
        const colLeave  = findCol(headers, ["leave days","leave","leaves","cl","pl","leave taken"]);

        const rows = data.slice(1).filter(r => r.some(c => c !== ""));
        const parsed = rows.map(row => {
          const empId   = colEmpId  !== -1 ? String(row[colEmpId]  || "").trim() : "";
          const name    = colName   !== -1 ? String(row[colName]   || "").trim() : "";
          const present = colPres   !== -1 ? Number(row[colPres]   || 0)         : 0;
          const absent  = colAbsent !== -1 ? Number(row[colAbsent] || 0)         : Math.max(0, periodDays - present);
          const leave   = colLeave  !== -1 ? Number(row[colLeave]  || 0)         : 0;
          const emp     = getEmp(empId, name);
          const salary  = getSal(emp);
          const perDay  = periodDays > 0 ? Math.round(salary / periodDays) : 0;
          const deduction = Math.round(Math.max(0, absent) * perDay);
          const net       = Math.max(0, present * perDay);
          return { empId, name, present, absent, leave, emp, salary, perDay, deduction, net };
        }).filter(r => r.empId || r.name);

        if (parsed.length === 0) { setStatus("error"); setStatusMsg("No valid rows found. Check that Emp ID or Name column exists."); return; }
        setRecords(parsed);
        if (setAttendanceSummary) {
          const grouped = {};
          parsed.forEach(r => {
            const t = r.emp && r.emp.type ? r.emp.type : "other";
            if (!grouped[t]) grouped[t] = { Present: 0, Absent: 0, count: 0 };
            grouped[t].Present += r.present || 0;
            grouped[t].Absent  += r.absent  || 0;
            grouped[t].count++;
          });
          const fmtPeriod = d => { try { return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } };
          setAttendanceSummary({
            period:     fmtPeriod(fromDate) + " – " + fmtPeriod(toDate),
            periodDays,
            records:    parsed.map(r => ({ empId: r.empId, name: r.name, type: r.emp && r.emp.type ? r.emp.type : "other", present: r.present || 0, absent: r.absent || 0 })),
            grouped,
          });
        }
        setStatus("success");
        setStatusMsg(parsed.length + " record" + (parsed.length !== 1 ? "s" : "") + " imported from \"" + wb.SheetNames[0] + "\". Review the calculation below.");
        setSavedKey(null);
      } catch(err) { setStatus("error"); setStatusMsg("Failed to read file: " + err.message); }
    };
    reader.readAsBinaryString(file);
  }

  async function handleGenerate() {
    const date      = today;
    const label     = fmtD(fromDate) + " to " + fmtD(toDate);
    const monthStr  = fromDate.slice(0, 7);
    const monthDate = monthStr + "-01";
    const paid = records.filter(r => r.emp);
    const rows = paid.map(r => ({
      employee_id: r.emp.id,
      month:       monthDate,
      amount:      r.net,
      paid_on:     date,
      paid_by:     "Sunil Pradhan",
    }));
    if (rows.length) {
      await supabase.from("salary_payments").insert(rows);
      await Promise.allSettled(paid.map(r =>
        addExpense({
          title:   "Salary \u2014 " + label + " \u2014 " + r.emp.name,
          category: "Salary",
          amount:   r.net,
          date,
          paidBy:  "Sunil Pradhan",
          note:    (r.emp.designation||"") + " \u00b7 " + r.emp.empId + " \u00b7 Present: " + r.present + "/" + periodDays,
        })
      ));
    }
    setSavedKey(periodKey);
  }

  function exportCalc() {
    const rows = records.map(r => ({
      "Emp ID":          r.emp?.empId || r.empId || "\u2014",
      "Name":            r.emp?.name  || r.name  || "\u2014",
      "Period Days":     periodDays,
      "Present Days":    r.present,
      "Absent Days":     r.absent,
      "Leave Days":      r.leave || 0,
      "Monthly Salary":  r.salary,
      "Per Day (Rs)":    r.perDay,
      "Deduction (Rs)":  r.deduction,
      "Net Salary (Rs)": r.net,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, "Salary Calculation");
    XLSX.writeFile(wb2, "Salary_" + fromDate + "_to_" + toDate + ".xlsx");
  }

  const totalDeduction = records.reduce((s,r) => s+r.deduction, 0);
  const totalNet       = records.reduce((s,r) => s+r.net,       0);
  const totalPayroll   = records.reduce((s,r) => s+r.salary,    0);
  const unmatched      = records.filter(r => !r.emp).length;
  const INP = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy";

  return (
    <div className="space-y-5">

      {/* Step 1 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-school-navy text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
          <p className="text-sm font-bold text-gray-800">Select Attendance Period</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[["7days","7 Days"],["15days","15 Days"],["fullmonth","Full Month"],["custom","Custom"]].map(([k,l]) => (
            <button key={k} onClick={() => applyPreset(k)}
              className={"px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " +
                (periodType===k ? "bg-school-navy text-white border-school-navy shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-school-navy/40 hover:text-school-navy")}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Date</label>
            <input type="date" value={fromDate} max={toDate || today}
              onChange={e => { setFromDate(e.target.value); setPeriodType("custom"); setRecords([]); setStatus(null); }}
              className={INP}/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To Date</label>
            <input type="date" value={toDate} min={fromDate} max={today}
              onChange={e => { setToDate(e.target.value); setPeriodType("custom"); setRecords([]); setStatus(null); }}
              className={INP}/>
          </div>
          <div className="bg-school-navy rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Total Period Days</p>
            <p className="text-3xl font-bold text-white">{periodDays}</p>
            <p className="text-[10px] text-white/50 mt-0.5">{fmtD(fromDate)} &ndash; {fmtD(toDate)}</p>
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-school-navy text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
          <p className="text-sm font-bold text-gray-800">Import Attendance Excel</p>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-gray-400">Upload the attendance sheet for the selected {periodDays}-day period</p>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value=""; }}/>
            <button onClick={() => { if (periodDays > 0) fileRef.current?.click(); }}
              disabled={periodDays === 0}
              className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-40">
              <Upload className="w-4 h-4"/> Import Excel
            </button>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
          <p className="text-xs font-bold text-blue-700 mb-2">Expected Excel Column Headers (any order):</p>
          <div className="flex flex-wrap gap-1.5">
            {["Emp ID","Name","Present Days","Absent Days","Leave Days"].map(c => (
              <code key={c} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-mono">{c}</code>
            ))}
          </div>
          <p className="text-[11px] text-blue-500 mt-2">
            <strong>Total Days</strong> is taken from your period selection ({periodDays} days) — no need to add it in Excel.
            If Absent Days is missing it is auto-calculated as {periodDays} minus Present Days.
          </p>
        </div>
        {status && (
          <div className={"flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium " +
            (status==="success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700")}>
            {status==="success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5"/> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>}
            {statusMsg}
          </div>
        )}
      </div>

      {/* Results */}
      {records.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label:"Employees",       value: records.length,        bg:"bg-blue-50",  color:"text-blue-700"  },
              { label:"Total Payroll",   value: fmtAmt(totalPayroll),  bg:"bg-gray-50",  color:"text-gray-700"  },
              { label:"Total Deduction", value: fmtAmt(totalDeduction),bg:"bg-red-50",   color:"text-red-700"   },
              { label:"Net Payroll",     value: fmtAmt(totalNet),      bg:"bg-green-50", color:"text-green-700" },
            ].map(({label,value,bg,color}) => (
              <div key={label} className={bg+" rounded-2xl px-4 py-3 border border-gray-100"}>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={"text-lg font-bold "+color}>{value}</p>
              </div>
            ))}
          </div>

          {unmatched > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0"/>
              {unmatched} row{unmatched!==1?"s":""} could not be matched to an employee. Check Emp ID or Name in your Excel.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-gray-800">Salary Calculation</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtD(fromDate)} to {fmtD(toDate)} &nbsp;·&nbsp; {periodDays} days &nbsp;·&nbsp; Per day = Monthly ÷ {periodDays}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportCalc}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 text-xs font-bold hover:bg-green-100 transition-colors">
                  <FileSpreadsheet className="w-3.5 h-3.5"/> Export
                </button>
                {savedKey === periodKey ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5"/> Saved to Salary
                  </span>
                ) : (
                  <button onClick={handleGenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-school-navy hover:bg-school-navy-dark text-white text-xs font-bold transition-colors">
                    <IndianRupee className="w-3.5 h-3.5"/> Generate Salary
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{minWidth:"800px"}}>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Emp ID","Name","Period Days","Present","Absent","Leave","Monthly Salary","Per Day","Deduction","Net Salary"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((r,i) => (
                    <tr key={i} className={r.emp ? "hover:bg-gray-50/60" : "bg-amber-50/50"}>
                      <td className="px-3 py-2.5 font-mono text-gray-500">{r.emp?.empId || r.empId || "—"}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">
                        {r.emp?.name || r.name || "—"}
                        {!r.emp && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Unmatched</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{periodDays}</td>
                      <td className="px-3 py-2.5 text-center text-green-700 font-semibold">{r.present}</td>
                      <td className="px-3 py-2.5 text-center text-red-600 font-semibold">{r.absent}</td>
                      <td className="px-3 py-2.5 text-center text-amber-600">{r.leave||0}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-semibold">{fmtAmt(r.salary)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{fmtAmt(r.perDay)}</td>
                      <td className="px-3 py-2.5 text-red-600 font-semibold">{r.deduction>0?"−"+fmtAmt(r.deduction):"—"}</td>
                      <td className="px-3 py-2.5 font-bold text-green-700">{fmtAmt(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={6} className="px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Total ({records.length} employees)</td>
                    <td className="px-3 py-2.5 font-bold text-gray-700">{fmtAmt(totalPayroll)}</td>
                    <td/>
                    <td className="px-3 py-2.5 font-bold text-red-600">{totalDeduction>0?"−"+fmtAmt(totalDeduction):"—"}</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{fmtAmt(totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {records.length === 0 && !status && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7 text-gray-300"/>
          </div>
          <p className="text-gray-500 font-semibold">No attendance data imported yet</p>
          <p className="text-xs text-gray-400 max-w-xs">Complete Step 1 to set the period, then upload your attendance Excel in Step 2</p>
        </div>
      )}
    </div>
  );
}


// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmployeePage() {
  const setStoreEmployees = useStore(s => s.setEmployees);

  const [employees, setEmployeesLocal] = useState([]);
  const [empLoading, setEmpLoading]    = useState(true);

  function setEmployees(updated) {
    setEmployeesLocal(updated);
    setStoreEmployees(updated); // keep Zustand in sync for Super Admin salary panel
  }

  useEffect(() => {
    getEmployees()
      .then(data => { setEmployees(data); setEmpLoading(false); })
      .catch(() => setEmpLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [view, setView]             = useState("staff"); // "staff" | "attendance"
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [viewEmp, setViewEmp]       = useState(null);
  const [addOpen, setAddOpen]       = useState(false);

  const salaries       = useStore(s => s.employeeSalaries);
  const setAttendanceSummary = useStore(s => s.setAttendanceSummary);

  const total       = employees.length;
  const teaching    = employees.filter((e) => e.type === "teaching").length;
  const nonTeaching = employees.filter((e) => e.type === "non-teaching").length;
  const management  = employees.filter((e) => e.type === "management").length;
  const media       = employees.filter((e) => e.type === "media").length;
  const allDepts    = [...new Set(employees.map((e) => e.department))].sort();

  const filtered = employees.filter((e) => {
    const ms = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.empId.toLowerCase().includes(search.toLowerCase()) ||
      (e.designation || "").toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === "all" || e.type === typeFilter;
    const md = deptFilter === "all" || e.department === deptFilter;
    return ms && mt && md;
  });

  const [editEmp, setEditEmp] = useState(null);

  const handleAdd = async (emp) => {
    try {
      const saved = await addEmployee(emp);
      setEmployees(prev => [...prev, saved]);
      setAddOpen(false);
    } catch (err) {
      alert("Failed to save employee: " + (err.message || "Unknown error"));
    }
  };

  const handleEdit = async (updatedEmp) => {
    try {
      await updateEmployee(updatedEmp.id, updatedEmp);
      setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? { ...e, ...updatedEmp } : e));
    } catch { }
    setEditEmp(null);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Employee Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Staff profiles, assignments & document tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[["staff","Staff List",Users],["attendance","Attendance",ClipboardList]].map(([v,l,Icon]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${view===v?"bg-white shadow text-school-navy":"text-gray-500 hover:text-gray-700"}`}>
                <Icon className="w-3.5 h-3.5"/>{l}
              </button>
            ))}
          </div>
          {view === "staff" && (
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <Plus className="w-4 h-4"/> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Attendance view */}
      {view === "attendance" && (
        <AttendanceSection
          employees={employees}
          salaries={salaries || {}}
          setAttendanceSummary={setAttendanceSummary}
        />
      )}

      {/* Staff list view */}
      {view === "staff" && empLoading && (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading employees…</div>
      )}
      {view === "staff" && !empLoading && <>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Staff",  value: total,       color: "text-blue-600",   bg: "bg-blue-50",   icon: Users         },
          { label: "Teaching",     value: teaching,    color: "text-green-600",  bg: "bg-green-50",  icon: GraduationCap },
          { label: "Non-Teaching", value: nonTeaching, color: "text-gray-600",   bg: "bg-gray-100",  icon: Briefcase     },
          { label: "Management",   value: management,  color: "text-purple-600", bg: "bg-purple-50", icon: Shield        },
          { label: "Media",        value: media,       color: "text-rose-600",   bg: "bg-rose-50",   icon: Users         },
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
            {[["all","All"],["management","Management"],["teaching","Teaching"],["non-teaching","Non-Teaching"],["media","Media"]].map(([k,l]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  typeFilter === k ? "bg-school-navy text-white border-school-navy"
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
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Docs</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-gray-400 text-sm">
                    No employees match your filters
                  </td>
                </tr>
              )}
              {filtered.map((emp) => {
                const bg     = avatarBg(emp.empId);
                const done   = docsDone(emp);
                const docsOk = done === (emp.documents || []).length;
                return (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                          <S3Image
                            s3Key={emp.photo}
                            alt={emp.name}
                            className="w-full h-full object-cover"
                            fallback={<span className="text-white font-bold text-xs">{initials(emp.name)}</span>}
                          />
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
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-bold ${docsOk ? "text-green-600" : "text-amber-600"}`}>
                        {done}/{(emp.documents || []).length}
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
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewEmp(emp)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditEmp(emp)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-gray-400 hover:text-school-navy">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
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

      {/* End staff list view */}
      </>}

      {viewEmp  && <ViewEmployeeModal emp={viewEmp} onClose={() => setViewEmp(null)} />}
      {editEmp  && <EditEmployeeModal emp={editEmp} onClose={() => setEditEmp(null)} onSave={handleEdit} />}
      {addOpen  && <AddEmployeeModal employees={employees} onClose={() => setAddOpen(false)} onSave={handleAdd} />}
    </div>
  );
}
