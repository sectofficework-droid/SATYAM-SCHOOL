"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown, Upload, X, Plus, FileText, ArrowLeft,
  Check, Camera, Lock, GraduationCap, AlertTriangle,
} from "lucide-react";
import {
  isValidName, isValidPhone, isValidPincode, isValidAadhar,
  isValidPercentage, isNonNegativeNumber, isValidUploadFile,
} from "@/lib/validators";
import { getStudentByEnrollment, updateStudent as svcUpdate } from "@/lib/studentService";
import { fmtDMY } from "@/lib/utils";
import { getActiveClasses } from "@/lib/settingsService";
import { uploadFileToS3, getS3ViewUrl, slugify, fileExt } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";
import supabase from "@/lib/supabase";
import DateInputDMY from "@/components/DateInputDMY";

// ── Options ────────────────────────────────────────────────────
function getCurrentSession() {
  const now = new Date(); const yr = now.getFullYear(); const month = now.getMonth() + 1;
  const start = month >= 4 ? yr : yr - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
const CURRENT_SESSION = getCurrentSession();
const prevStandards = [
  "Nursery / KG", "1st", "2nd", "3rd", "4th", "5th",
  "6th", "7th", "8th", "9th", "10th", "11th", "12th",
];
const genders   = ["Male", "Female", "Other"];
const religions = ["Hindu", "Muslim", "Christian", "Jain", "Sikh", "Buddhist", "Parsi", "Other"];
const castes    = ["General", "OBC", "SC", "ST", "EWS", "SEBC", "Other"];
const mediums   = ["English", "Gujarati", "Hindi", "Odia", "Other"];
const todayStr  = new Date().toISOString().split("T")[0];

const defaultDocTypes = [
  "Birth Certificate",
  "Student Aadhar Card",
  "Father's Aadhar Card",
  "Mother's Aadhar Card",
  "Leaving Certificate",
  "Marksheet",
];

// ── Map DB student to EditForm format ─────────────────────────
function mapToEditForm(student) {
  const uploadedDocs = {};
  (student.documents || []).filter(d => d.uploaded).forEach(d => {
    uploadedDocs[d.name] = d.file || d.name;
  });
  return {
    _studentId:    student._studentId,
    _enrollmentId: student._enrollmentId,
    enrollment:    student.enrollment,
    joinDate:      student.dateOfJoin || "",
    std:           student.std || "",
    section:       student.section || "",
    rollNo:        student.rollNo || "",
    firstName:     student.firstName || "",
    lastName:      student.lastName || "",
    fatherName:    student.fatherName || "",
    motherName:    student.motherName || "",
    dob:           student.dob || "",
    gender:        student.gender || "",
    religion:      student.religion || "Hindu",
    caste:         student.caste || "General",
    motherTongue:  student.motherTongue || "",
    subCaste:      student.subCaste || "",
    height:        student.height || "",
    weight:        student.weight || "",
    roomPlotNo:    student.roomPlotNo || "",
    society:       student.society || "",
    landmark:      student.landmark || "",
    area:          student.area || "",
    pinCode:       student.pinCode || "",
    address:       student.address || "",
    mobile1:       student.mobile || "",
    mobile2:       student.mobile2 || "",
    placeOfBirth:  student.placeOfBirth || "",
    birthState:    student.birthState || "",
    birthDistrict: student.birthDistrict || "",
    birthCity:     student.birthCity || "",
    lastSchoolName:   student.lastSchoolName || "",
    lastSchoolGrNo:   student.lastSchoolGrNo || "",
    lastSchoolClass:  student.lastSchoolClass || "",
    lastSchoolMedium: student.lastSchoolMedium || "",
    lastSchoolPlace:  student.lastSchoolPlace || "",
    prevPercentage:      student.prevPercentage || "",
    prevAttendanceDays:  student.prevAttendanceDays || "",
    lastExamGiven:       student.lastExamGiven || "No",
    aadhar:           student.aadhar || "",
    aadharName:       student.aadharName || "",
    fatherAadhar:     student.fatherAadhar || "",
    fatherAadharName: student.fatherAadharName || "",
    motherAadhar:     student.motherAadhar || "",
    motherAadharName: student.motherAadharName || "",
    udise:            student.udise || "",
    pen:              student.pen || "",
    apaar:            student.apaar || "",
    birthCertRegNo:   student.birthCertRegNo || "",
    birthCertRegDate: student.birthCertRegDate || "",
    hasAadhar:        !!student.aadhar,
    hasSibling:       (student.siblings?.length || 0) > 0,
    siblings:     student.siblings?.map(sib => ({
      id: sib.id || Date.now(),
      name: sib.name || "",
      cls: sib.cls || "",
    })) || [],
    uploadedDocs,
    photo: student.photo || null,
  };
}

// ── Helpers ────────────────────────────────────────────────────
function normalizeAadhar(v) {
  return String(v || "").replace(/\s/g, "");
}
function isNonEmptyAadhar(v) {
  return normalizeAadhar(v).length > 0;
}

// ── Reusable UI components ─────────────────────────────────────
function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs text-red-500 mt-1">{children}</p>;
}

function SectionHeader({ number, title }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-lg bg-school-navy flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">{number}</span>
      </div>
      <h3 className="font-semibold text-school-navy text-base">{title}</h3>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required
        ? <span className="text-red-500 ml-0.5">*</span>
        : <span className="text-gray-400 text-xs ml-1.5">(Optional)</span>
      }
    </label>
  );
}

function Input({ className = "", type, ...props }) {
  const cls = `w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 ${className}`;
  if (type === "date") return <DateInputDMY className={cls} {...props} />;
  return <input type={type} className={cls} {...props} />;
}

function SelectField({ children, value, onChange, disabled, required }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={onChange} disabled={disabled} required={required}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function YesNoToggle({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2 max-w-xs">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt} type="button" disabled={disabled} onClick={() => onChange(opt === "Yes")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            (opt === "Yes" && value) || (opt === "No" && !value)
              ? "bg-school-navy text-white border-school-navy shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Read-only locked field ─────────────────────────────────────
function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
        {label}
        <Lock className="w-3 h-3 text-gray-400" />
      </label>
      <div className="flex items-center justify-between px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">{value || "—"}</span>
        <span className="text-[10px] text-gray-400 font-medium">Not editable here</span>
      </div>
    </div>
  );
}

// ── Edit Form — receives pre-loaded student ────────────────────
function EditForm({ existing, id, router }) {
  const [standards, setStandards] = useState([]);

  useEffect(() => {
    getActiveClasses().then(cls => setStandards(cls.map(c => c.name))).catch(() => {});
  }, []);

  const [hasPrevSchool, setHasPrevSchool] = useState(!!(existing.lastSchoolName));
  const [hasSibling, setHasSibling] = useState(existing.hasSibling);
  const [siblings, setSiblings]     = useState(
    existing.siblings?.length ? existing.siblings : [{ id: 1, cls: "", name: "" }]
  );

  const addSibling    = () => setSiblings((p) => [...p, { id: Date.now(), cls: "", name: "" }]);
  const removeSibling = (id) => setSiblings((p) => p.filter((s) => s.id !== id));
  const updateSibling = (id, field, val) =>
    setSiblings((p) =>
      p.map((s) => s.id === id ? { ...s, [field]: val, ...(field === "cls" ? { name: "" } : {}) } : s)
    );
  const [hasAadhar, setHasAadhar]               = useState(existing.hasAadhar);
  const [lastExamGiven, setLastExamGiven]       = useState(existing.lastExamGiven === "Yes");
  const [fatherAadharDisplay, setFatherAadharDisplay] = useState(existing.fatherAadhar || "");
  const [motherAadharDisplay, setMotherAadharDisplay] = useState(existing.motherAadhar || "");
  const [photo, setPhoto]                 = useState(null);
  const [photoPreview, setPhotoPreview]   = useState(null);
  const [photoError, setPhotoError]       = useState("");
  const [photoKey, setPhotoKey]           = useState(null);
  const [photoSize, setPhotoSize]         = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [casteCertFile, setCasteCertFile] = useState(null);
  const [casteCertError, setCasteCertError] = useState("");
  // Pre-populate from existing uploaded doc so caste isn't reset on save
  const [casteCertKey, setCasteCertKey] = useState(
    existing.uploadedDocs["Caste Certificate"] || null
  );
  const [casteCertSize, setCasteCertSize] = useState(0);
  const [casteCertUploading, setCasteCertUploading] = useState(false);
  const casteCertRef = useRef(null);
  const photoRef     = useRef(null);
  const [aadharDisplay, setAadharDisplay] = useState(existing.aadhar || "");
  const [checkedDocs, setCheckedDocs]   = useState(
    Object.fromEntries(Object.keys(existing.uploadedDocs).map((k) => [k, true]))
  );
  const [uploadedFiles, setUploadedFiles] = useState({ ...existing.uploadedDocs });
  const [customDocs, setCustomDocs]     = useState([]);
  const [docErrors, setDocErrors]       = useState({});
  const [errors, setErrors]             = useState({});
  const [submitting, setSubmitting]     = useState(false);

  // Show the already-uploaded photo (if any) by resolving a fresh presigned view URL
  useEffect(() => {
    if (existing.photo) {
      getS3ViewUrl(existing.photo).then((url) => { if (url) setPhotoPreview(url); }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState({
    joinDate:         existing.joinDate,
    std:              existing.std,
    section:          existing.section,
    rollNo:           existing.rollNo,
    firstName:        existing.firstName,
    lastName:         existing.lastName,
    fatherName:       existing.fatherName,
    motherName:       existing.motherName,
    dob:              existing.dob,
    gender:           existing.gender,
    religion:         existing.religion,
    caste:            existing.caste,
    motherTongue:     existing.motherTongue || "",
    subCaste:         existing.subCaste || "",
    height:           existing.height || "",
    weight:            existing.weight || "",
    roomPlotNo:       existing.roomPlotNo,
    society:          existing.society || "",
    landmark:         existing.landmark || "",
    area:             existing.area || "",
    pinCode:          existing.pinCode || "",
    address:          existing.address,
    mobile1:          existing.mobile1,
    mobile2:          existing.mobile2,
    placeOfBirth:     existing.placeOfBirth,
    birthState:       existing.birthState || "",
    birthDistrict:    existing.birthDistrict || "",
    birthCity:        existing.birthCity || "",
    lastSchoolName:   existing.lastSchoolName,
    lastSchoolClass:  existing.lastSchoolClass,
    lastSchoolMedium: existing.lastSchoolMedium,
    lastSchoolPlace:  existing.lastSchoolPlace,
    lastSchoolGrNo:   existing.lastSchoolGrNo || "",
    prevPercentage:        existing.prevPercentage || "",
    prevAttendanceDays:    existing.prevAttendanceDays || "",
    aadharName:       existing.aadharName,
    fatherAadharName: existing.fatherAadharName || "",
    motherAadharName: existing.motherAadharName || "",
    udise:            existing.udise,
    pen:              existing.pen,
    apaar:            existing.apaar,
    birthCertRegNo:   existing.birthCertRegNo || "",
    birthCertRegDate: existing.birthCertRegDate || "",
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value.toUpperCase() }));

  const handleAadharInput = (e) => {
    const digits    = e.target.value.replace(/\D/g, "").slice(0, 12);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    setAadharDisplay(formatted);
    setForm((p) => ({ ...p, aadharRaw: digits }));
  };
  const handleFatherAadharInput = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    setFatherAadharDisplay(digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
    setForm((p) => ({ ...p, fatherAadharRaw: digits }));
  };
  const handleMotherAadharInput = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    setMotherAadharDisplay(digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
    setForm((p) => ({ ...p, motherAadharRaw: digits }));
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isValidUploadFile(file)) {
      setPhotoError("Invalid file — only JPG/PNG/PDF up to 5MB allowed.");
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
        const key = `students/${existing._studentId}/photo.${fileExt(compressed)}`;
        setPhotoSize(compressed.size);
        return uploadFileToS3(compressed, key).then(() => setPhotoKey(key));
      })
      .catch((err) => setPhotoError("Photo upload failed: " + (err?.message || "Unknown error")))
      .finally(() => setPhotoUploading(false));
  };

  const toggleDoc = (name) => {
    const wasChecked = checkedDocs[name];
    setCheckedDocs((p) => ({ ...p, [name]: !p[name] }));
    if (wasChecked) {
      setUploadedFiles((p) => { const next = { ...p }; delete next[name]; return next; });
    }
  };

  const handleDocFile = (name, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isValidUploadFile(file)) {
      setDocErrors((p) => ({ ...p, [name]: "Invalid file — only JPG/PNG/PDF up to 5MB allowed." }));
      e.target.value = "";
      return;
    }
    setDocErrors((p) => { const next = { ...p }; delete next[name]; return next; });
    setUploadedFiles((p) => ({ ...p, [name]: { fileName: file.name, key: null, size: 0, uploading: true } }));
    compressFile(file)
      .then((compressed) => {
        const key = `students/${existing._studentId}/documents/${slugify(name)}.${fileExt(compressed)}`;
        return uploadFileToS3(compressed, key).then(() =>
          setUploadedFiles((p) => ({ ...p, [name]: { ...p[name], key, size: compressed.size, uploading: false } }))
        );
      })
      .catch(() => {
        setDocErrors((p) => ({ ...p, [name]: "Upload failed — please try again." }));
        setUploadedFiles((p) => ({ ...p, [name]: { ...p[name], uploading: false } }));
      });
  };

  const addCustomDoc = () => setCustomDocs((p) => [...p, { id: Date.now(), label: "" }]);
  const updateCustomDocLabel = (docId, label) =>
    setCustomDocs((p) => p.map((d) => (d.id === docId ? { ...d, label } : d)));
  const removeCustomDoc = (docId) => setCustomDocs((p) => p.filter((d) => d.id !== docId));

  const validate = () => {
    const errs = {};

    if (!isValidName(form.firstName)) errs.firstName = "Enter a valid first name.";
    if (!isValidName(form.lastName)) errs.lastName = "Enter a valid last name.";
    if (!isValidName(form.fatherName)) errs.fatherName = "Enter a valid father's name.";
    if (!isValidName(form.motherName)) errs.motherName = "Enter a valid mother's name.";

    if (!isValidPhone(form.mobile1)) errs.mobile1 = "Enter a valid 10-digit mobile number.";
    if (form.mobile2 && !isValidPhone(form.mobile2)) errs.mobile2 = "Enter a valid 10-digit mobile number.";

    if (form.pinCode && !isValidPincode(form.pinCode)) errs.pinCode = "Enter a valid 6-digit pin code.";

    if (hasAadhar) {
      const rawAadhar = form.aadharRaw !== undefined ? form.aadharRaw : normalizeAadhar(existing.aadhar);
      if (!rawAadhar) {
        errs.aadhar = "Aadhar number is required.";
      } else if (!isValidAadhar(rawAadhar)) {
        errs.aadhar = "Enter a valid 12-digit Aadhar number.";
      }
    }

    if (form.prevAttendanceDays && !isNonNegativeNumber(form.prevAttendanceDays, 365)) {
      errs.prevAttendanceDays = "Enter a valid number of attendance days.";
    }
    if (lastExamGiven && form.prevPercentage && !isValidPercentage(form.prevPercentage)) {
      errs.prevPercentage = "Enter a valid percentage (0-100).";
    }

    if (form.birthCertRegDate && form.dob && form.birthCertRegDate < form.dob) {
      errs.birthCertRegDate = "Registration date must be on or after the date of birth.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const anyDocUploading = Object.values(uploadedFiles).some((d) => d?.uploading);
    if (photoUploading || anyDocUploading || casteCertUploading) {
      alert("Please wait for file uploads to finish before submitting.");
      return;
    }

    let finalCaste = form.caste;
    if (form.caste !== "General" && !casteCertKey) {
      finalCaste = "General";
      setForm(p => ({ ...p, caste: "General" }));
      alert("No caste certificate uploaded — category has been reset to General.");
    }
    const rawAadhar = form.aadharRaw !== undefined
      ? form.aadharRaw
      : normalizeAadhar(existing.aadhar);

    setSubmitting(true);
    try {
      await svcUpdate(existing._studentId, {
        enrollmentId: existing._enrollmentId,
        joinDate:     form.joinDate || undefined,
        grNo:         existing.grNo || "",
        firstName:    form.firstName,
        lastName:     form.lastName,
        dob:          form.dob,
        gender:       form.gender,
        placeOfBirth: form.placeOfBirth,
        birthState:    form.birthState,
        birthDistrict: form.birthDistrict,
        birthCity:     form.birthCity,
        photo:        photoKey || existing.photo || null,
        fatherName:   form.fatherName,
        motherName:   form.motherName,
        mobile:       form.mobile1,
        mobile2:      form.mobile2,
        religion:     form.religion,
        caste:        finalCaste,
        subCaste:     form.subCaste,
        motherTongue: form.motherTongue,
        height:       form.height,
        weight:       form.weight,
        roomPlotNo:   form.roomPlotNo,
        society:      form.society,
        landmark:     form.landmark,
        area:         form.area,
        pinCode:      form.pinCode,
        address:      form.address,
        aadhar:            rawAadhar || null,
        aadharName:        form.aadharName,
        fatherAadhar:      form.fatherAadharRaw !== undefined ? form.fatherAadharRaw : (existing.fatherAadhar?.replace(/\s/g, "") || null),
        fatherAadharName:  form.fatherAadharName,
        motherAadhar:      form.motherAadharRaw !== undefined ? form.motherAadharRaw : (existing.motherAadhar?.replace(/\s/g, "") || null),
        motherAadharName:  form.motherAadharName,
        udise:             form.udise,
        pen:               form.pen,
        apaar:             form.apaar,
        birthCertRegNo:    form.birthCertRegNo,
        birthCertRegDate:  form.birthCertRegDate,
        lastSchoolName:     hasPrevSchool ? form.lastSchoolName : "",
        lastSchoolGrNo:     form.lastSchoolGrNo,
        lastSchoolClass:    form.lastSchoolClass,
        lastSchoolMedium:   form.lastSchoolMedium,
        lastSchoolPlace:    form.lastSchoolPlace,
        prevAttendanceDays: form.prevAttendanceDays,
        lastExamGiven:      lastExamGiven ? "Yes" : "No",
        prevPercentage:     form.prevPercentage,
      });

      // Save document statuses to DB
      const { data: docTypes } = await supabase.from("document_types").select("id, name");
      if (docTypes?.length) {
        const docTypeMap = Object.fromEntries(docTypes.map(d => [d.name, d.id]));
        const visibleDocs = defaultDocTypes.filter(d => hasPrevSchool || (d !== "Leaving Certificate" && d !== "Marksheet"));
        const upserts = visibleDocs
          .filter(name => docTypeMap[name])
          .map(name => {
            // uploadedFiles[name] is either a plain string (pre-existing key, untouched
            // this session) or an { fileName, key, ... } object (uploaded this session).
            // file_url must be included on every row with its real value (never omitted) —
            // Supabase's bulk upsert pads any key missing from a row with NULL when other
            // rows in the same batch DO have that key, which previously wiped out file_url
            // on every document not re-uploaded in the current save.
            const existingVal = uploadedFiles[name];
            const fileUrl = existingVal && typeof existingVal === "object"
              ? (existingVal.key || null)
              : (existingVal || null);
            return {
              student_id:       existing._studentId,
              document_type_id: docTypeMap[name],
              status:           checkedDocs[name] ? "Uploaded" : "Pending",
              uploaded_at:      checkedDocs[name] ? new Date().toISOString() : null,
              file_url:         fileUrl,
            };
          });
        if (casteCertKey && docTypeMap["Caste Certificate"]) {
          upserts.push({
            student_id:       existing._studentId,
            document_type_id: docTypeMap["Caste Certificate"],
            status:           "Uploaded",
            uploaded_at:      new Date().toISOString(),
            file_url:         casteCertKey,
          });
        }
        // Save custom docs — insert document_type if it doesn't exist yet
        for (const doc of customDocs.filter(d => d.label.trim())) {
          let typeId = docTypeMap[doc.label];
          if (!typeId) {
            const { data: newType } = await supabase
              .from("document_types")
              .insert({ name: doc.label })
              .select("id")
              .single();
            typeId = newType?.id;
          }
          if (!typeId) continue;
          const val = uploadedFiles[doc.label];
          const fileUrl = val && typeof val === "object" ? (val.key || null) : (val || null);
          upserts.push({
            student_id:       existing._studentId,
            document_type_id: typeId,
            status:           fileUrl ? "Uploaded" : "Pending",
            uploaded_at:      fileUrl ? new Date().toISOString() : null,
            file_url:         fileUrl,
          });
        }
        if (upserts.length) {
          const { error: docErr } = await supabase.from("student_documents").upsert(upserts, { onConflict: "student_id,document_type_id" });
          if (docErr) throw docErr;
        }
      }

      alert("Student profile updated successfully!");
      router.replace(`/student/${id}`);
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ══ SECTION 1: Admission Details ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="1" title="Admission Details" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel required>Academic Session</FieldLabel>
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
              <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-700">{CURRENT_SESSION}</span>
              <span className="text-xs text-gray-400 ml-auto">Set in Settings</span>
            </div>
          </div>
          <div>
            <FieldLabel required>Date of Join</FieldLabel>
            <Input type="date" value={form.joinDate} max={todayStr} onChange={set("joinDate")} />
          </div>
          <div>
            <FieldLabel required>Enrollment Number</FieldLabel>
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-school-navy/30 rounded-xl bg-blue-50">
              <span className="text-school-navy font-bold text-sm">#{existing.enrollment}</span>
              <span className="text-xs text-gray-400">(Cannot change)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ SECTION 2: Student Photo ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="2" title="Student Photo" />
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-dashed border-gray-300">
            {photoPreview
              ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              : <Camera className="w-8 h-8 text-gray-300" />
            }
          </div>
          <div>
            <input ref={photoRef} type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
            <button
              type="button" onClick={() => photoRef.current.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {photo ? "Change Photo" : "Upload New Photo"}
            </button>
            {photo && (
              <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); setPhotoKey(null); setPhotoSize(0); }}
                className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>
            )}
            <p className="text-xs text-gray-400 mt-2">Optional · JPG or PNG · auto-compressed to 1MB or less</p>
            {!photoUploading && photoSize > 0 && (
              <p className="text-xs text-green-600 font-medium mt-1">✓ {formatFileSize(photoSize)}</p>
            )}
            <FieldError>{photoError}</FieldError>
          </div>
        </div>
      </div>

      {/* ══ SECTION 3: Sibling ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="3" title="Sibling at This School" />
        <div className="space-y-4">
          <div>
            <FieldLabel>Does this student have a sibling already studying here?</FieldLabel>
            <YesNoToggle
              value={hasSibling}
              onChange={(val) => { setHasSibling(val); setSiblings([{ id: 1, cls: "", name: "" }]); }}
            />
          </div>
          {hasSibling && (
            <div className="space-y-4 pt-1">
              {siblings.map((sib, i) => (
                <div key={sib.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Sibling {i + 1}
                    </p>
                    {siblings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSibling(sib.id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Sibling&apos;s Class</FieldLabel>
                      <SelectField
                        value={sib.cls}
                        onChange={(e) => updateSibling(sib.id, "cls", e.target.value)}
                        required
                      >
                        <option value="">Select Class</option>
                        {standards.map((s) => <option key={s}>{s}</option>)}
                      </SelectField>
                    </div>
                    <div>
                      <FieldLabel required>Sibling&apos;s Name</FieldLabel>
                      <input
                        type="text"
                        value={sib.name}
                        onChange={(e) => updateSibling(sib.id, "name", e.target.value)}
                        placeholder="Enter sibling's full name"
                        required
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSibling}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-school-navy/40 rounded-xl text-sm font-semibold text-school-navy hover:bg-blue-50 hover:border-school-navy transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Another Sibling
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 4: Class Details ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="4" title="Class Details" />
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">Class, Section and Roll No are managed through the dedicated Class Management section.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
          <ReadOnlyField label="Standard" value={form.std} />
          <ReadOnlyField label="Section"  value={form.section} />
          <ReadOnlyField label="Roll No"  value={form.rollNo} />
        </div>
      </div>

      {/* ══ SECTION 5: Personal Information ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="5" title="Personal Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>First Name</FieldLabel>
            <Input placeholder="Student's first name" value={form.firstName} onChange={set("firstName")} required />
            <FieldError>{errors.firstName}</FieldError>
          </div>
          <div>
            <FieldLabel required>Last Name</FieldLabel>
            <Input placeholder="Student's last name" value={form.lastName} onChange={set("lastName")} required />
            <FieldError>{errors.lastName}</FieldError>
          </div>
          <div>
            <FieldLabel required>Father&apos;s Name</FieldLabel>
            <Input placeholder="e.g. Rajesh" value={form.fatherName} onChange={set("fatherName")} required />
            <p className="text-xs text-amber-600 mt-1 font-medium">Note: Write first name only</p>
            <FieldError>{errors.fatherName}</FieldError>
          </div>
          <div>
            <FieldLabel required>Mother&apos;s Name</FieldLabel>
            <Input placeholder="e.g. Meena" value={form.motherName} onChange={set("motherName")} required />
            <p className="text-xs text-amber-600 mt-1 font-medium">Note: Write first name only</p>
            <FieldError>{errors.motherName}</FieldError>
          </div>
          <div>
            <FieldLabel>Father&apos;s Aadhar Number</FieldLabel>
            <Input
              placeholder="XXXX XXXX XXXX"
              value={fatherAadharDisplay}
              onChange={handleFatherAadharInput}
              maxLength={14}
              className="tracking-widest font-mono"
            />
          </div>
          <div>
            <FieldLabel>Father&apos;s Name as per Aadhar</FieldLabel>
            <Input
              placeholder="Exact name on father's Aadhar"
              value={form.fatherAadharName}
              onChange={set("fatherAadharName")}
            />
          </div>
          <div>
            <FieldLabel>Mother&apos;s Aadhar Number</FieldLabel>
            <Input
              placeholder="XXXX XXXX XXXX"
              value={motherAadharDisplay}
              onChange={handleMotherAadharInput}
              maxLength={14}
              className="tracking-widest font-mono"
            />
          </div>
          <div>
            <FieldLabel>Mother&apos;s Name as per Aadhar</FieldLabel>
            <Input
              placeholder="Exact name on mother's Aadhar"
              value={form.motherAadharName}
              onChange={set("motherAadharName")}
            />
          </div>
          <div>
            <ReadOnlyField label="Date of Birth" value={fmtDMY(form.dob)} />
          </div>
          <div>
            <ReadOnlyField label="Gender" value={form.gender} />
          </div>
          <div>
            <FieldLabel required>Religion</FieldLabel>
            <SelectField value={form.religion} onChange={set("religion")} required>
              {religions.map((r) => <option key={r}>{r}</option>)}
            </SelectField>
          </div>
          <div>
            <FieldLabel required>Category / Caste</FieldLabel>
            <SelectField
              value={form.caste}
              onChange={(e) => { set("caste")(e); setCasteCertFile(null); setCasteCertKey(null); }}
              required
            >
              {castes.map((c) => <option key={c}>{c}</option>)}
            </SelectField>
          </div>

          <div>
            <FieldLabel>Sub Caste</FieldLabel>
            <Input placeholder="e.g. Patel" value={form.subCaste} onChange={set("subCaste")} />
          </div>

          <div>
            <FieldLabel>Mother Tongue</FieldLabel>
            <Input placeholder="e.g. Gujarati" value={form.motherTongue} onChange={set("motherTongue")} />
          </div>

          <div>
            <FieldLabel>Height (cm)</FieldLabel>
            <Input type="number" placeholder="e.g. 140" value={form.height} onChange={set("height")} />
          </div>

          <div>
            <FieldLabel>Weight (kg)</FieldLabel>
            <Input type="number" placeholder="e.g. 35" value={form.weight} onChange={set("weight")} />
          </div>
        </div>

        {/* Caste certificate — required when non-General */}
        {form.caste !== "General" && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {form.caste} Certificate Required
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Upload is mandatory. If not uploaded, the category will be reset to <b>General</b> on save.
                </p>
              </div>
            </div>
            <input
              ref={casteCertRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0] || null;
                if (file && !isValidUploadFile(file)) {
                  setCasteCertError("Invalid file — only JPG/PNG/PDF up to 5MB allowed.");
                  e.target.value = "";
                  return;
                }
                setCasteCertError("");
                setCasteCertFile(file);
                setCasteCertKey(null);
                setCasteCertSize(0);
                if (!file) return;
                setCasteCertUploading(true);
                compressFile(file)
                  .then((compressed) => {
                    const key = `students/${existing._studentId}/documents/caste-certificate.${fileExt(compressed)}`;
                    setCasteCertSize(compressed.size);
                    return uploadFileToS3(compressed, key).then(() => setCasteCertKey(key));
                  })
                  .catch(() => setCasteCertError("Upload failed — please try again."))
                  .finally(() => setCasteCertUploading(false));
              }}
            />
            <FieldError>{casteCertError}</FieldError>
            {casteCertFile ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-700 font-medium flex-1 truncate">
                  {casteCertUploading
                    ? "Uploading…"
                    : `${casteCertFile.name}${casteCertSize ? ` (${formatFileSize(casteCertSize)})` : ""}`}
                </span>
                <button
                  type="button"
                  onClick={() => { setCasteCertFile(null); setCasteCertKey(null); }}
                  className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => casteCertRef.current.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 rounded-xl text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload {form.caste} Certificate
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ SECTION 6: Address & Contact ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="6" title="Address & Contact Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Room No / Plot No</FieldLabel>
            <Input placeholder="e.g. 12, Block B" value={form.roomPlotNo} onChange={set("roomPlotNo")} required />
          </div>
          <div>
            <FieldLabel>Society</FieldLabel>
            <Input placeholder="e.g. Shanti Nagar Society" value={form.society} onChange={set("society")} />
          </div>
          <div>
            <FieldLabel>Landmark</FieldLabel>
            <Input placeholder="e.g. Near Bus Stand" value={form.landmark} onChange={set("landmark")} />
          </div>
          <div>
            <FieldLabel>Area</FieldLabel>
            <Input placeholder="e.g. Vesu" value={form.area} onChange={set("area")} />
          </div>
          <div>
            <FieldLabel>Pin Code</FieldLabel>
            <Input placeholder="e.g. 395007" maxLength={6} value={form.pinCode} onChange={set("pinCode")} />
            <FieldError>{errors.pinCode}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel required>Full Address</FieldLabel>
            <textarea
              placeholder="Society / Area / Landmark / City / PIN Code"
              value={form.address} onChange={set("address")} rows={2} required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 resize-none"
            />
          </div>
          <div>
            <FieldLabel required>Mobile Number 1</FieldLabel>
            <Input type="tel" placeholder="Primary mobile" maxLength={10} value={form.mobile1} onChange={set("mobile1")} required />
            <FieldError>{errors.mobile1}</FieldError>
          </div>
          <div>
            <FieldLabel>Mobile Number 2</FieldLabel>
            <Input type="tel" placeholder="Alternate mobile" maxLength={10} value={form.mobile2} onChange={set("mobile2")} />
            <FieldError>{errors.mobile2}</FieldError>
          </div>
        </div>
      </div>

      {/* ══ SECTION 7: Birth Details ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="7" title="Birth Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <ReadOnlyField label="Place of Birth" value={form.placeOfBirth} />
          </div>
          <div />
          <div>
            <ReadOnlyField label="Birth State" value={form.birthState} />
          </div>
          <div>
            <ReadOnlyField label="Birth District" value={form.birthDistrict} />
          </div>
          <div>
            <ReadOnlyField label="Birth City" value={form.birthCity} />
          </div>
          <div />
          <div>
            <FieldLabel>Birth Certificate Reg. No.</FieldLabel>
            <Input
              placeholder="e.g. BDDR/2015/12345"
              value={form.birthCertRegNo}
              onChange={set("birthCertRegNo")}
            />
          </div>
          <div>
            <FieldLabel>Birth Certificate Reg. Date</FieldLabel>
            <Input
              type="date"
              value={form.birthCertRegDate}
              onChange={(e) => setForm((p) => ({ ...p, birthCertRegDate: e.target.value }))}
              min={form.dob || ""}
              max={todayStr}
            />
            <FieldError>{errors.birthCertRegDate}</FieldError>
          </div>
        </div>
      </div>

      {/* ══ SECTION 8: Previous School ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="8" title="Previous School Details" />
        <div className="space-y-4">
          <div>
            <FieldLabel>Does this student have a previous school?</FieldLabel>
            <YesNoToggle
              value={hasPrevSchool}
              onChange={(val) => {
                setHasPrevSchool(val);
                if (!val) {
                  setForm(p => ({ ...p, lastSchoolName:"", lastSchoolClass:"", lastSchoolMedium:"", lastSchoolPlace:"", lastSchoolGrNo:"", prevAttendanceDays:"", prevPercentage:"" }));
                  setLastExamGiven(false);
                }
              }}
            />
          </div>

          {!hasPrevSchool && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">
                TC (Transfer Certificate) and Marksheet are <b>not required</b> — they will be hidden from documents.
              </p>
            </div>
          )}

          {hasPrevSchool && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel>Previous School Name</FieldLabel>
                  <Input placeholder="Name of the last school attended" value={form.lastSchoolName} onChange={set("lastSchoolName")} />
                </div>
                <div>
                  <FieldLabel>Last School GR No</FieldLabel>
                  <Input placeholder="GR No at previous school" value={form.lastSchoolGrNo} onChange={set("lastSchoolGrNo")} />
                </div>
                <div>
                  <FieldLabel>Last Class Attended</FieldLabel>
                  <SelectField value={form.lastSchoolClass} onChange={set("lastSchoolClass")}>
                    <option value="">Select Standard</option>
                    {prevStandards.map((s) => <option key={s}>{s}</option>)}
                  </SelectField>
                </div>
                <div>
                  <FieldLabel>Medium of Instruction</FieldLabel>
                  <SelectField value={form.lastSchoolMedium} onChange={set("lastSchoolMedium")}>
                    <option value="">Select Medium</option>
                    {mediums.map((m) => <option key={m}>{m}</option>)}
                  </SelectField>
                </div>
                <div>
                  <FieldLabel>School Location</FieldLabel>
                  <Input placeholder="City / Town" value={form.lastSchoolPlace} onChange={set("lastSchoolPlace")} />
                </div>
                <div>
                  <FieldLabel>Previous Class Attendance Days</FieldLabel>
                  <Input type="number" placeholder="e.g. 185" value={form.prevAttendanceDays} onChange={set("prevAttendanceDays")} />
                  <FieldError>{errors.prevAttendanceDays}</FieldError>
                </div>
                <div>
                  <FieldLabel>Last Exam Given or Not</FieldLabel>
                  <YesNoToggle value={lastExamGiven} onChange={setLastExamGiven} />
                </div>
                {lastExamGiven && (
                  <div>
                    <FieldLabel>Previous Class Percentage</FieldLabel>
                    <Input placeholder="e.g. 78%" value={form.prevPercentage} onChange={set("prevPercentage")} />
                    <FieldError>{errors.prevPercentage}</FieldError>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">TC & Marksheet are Mandatory</p>
                  <p className="text-xs text-amber-700 mt-0.5">Upload Transfer Certificate and Marksheet in Section 10 (Documents).</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ SECTION 9: Aadhar Details ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="9" title="Aadhar Card Details" />
        <div className="space-y-4">
          <div>
            <FieldLabel>Does the student have an Aadhar Card?</FieldLabel>
            <YesNoToggle
              value={hasAadhar}
              disabled={existing.hasAadhar}
              onChange={(val) => { setHasAadhar(val); setAadharDisplay(""); setForm((p) => ({ ...p, aadharRaw: "", aadharName: "" })); }}
            />
            {existing.hasAadhar && (
              <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Aadhar already on file — contact Super Admin to remove or change it.
              </p>
            )}
          </div>
          {hasAadhar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <FieldLabel required>Aadhar Number</FieldLabel>
                <Input
                  placeholder="XXXX XXXX XXXX" value={aadharDisplay}
                  onChange={handleAadharInput} maxLength={14}
                  className="tracking-widest font-mono" required
                />
                <FieldError>{errors.aadhar}</FieldError>
              </div>
              <div>
                <FieldLabel required>Name as per Aadhar</FieldLabel>
                <Input placeholder="Exact name on Aadhar card" value={form.aadharName} onChange={set("aadharName")} required />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 10: Document Upload ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="10" title="Document Upload" />
        <p className="text-xs text-gray-400 mb-4 -mt-2">Tick to confirm document is available · Untick to mark as not submitted</p>
        <div className="space-y-3">
          {!hasPrevSchool && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-600 font-medium">TC and Marksheet hidden — no previous school.</p>
            </div>
          )}
          {defaultDocTypes
            .filter(d => hasPrevSchool || (d !== "Leaving Certificate" && d !== "Marksheet"))
            .map((docName) => (
            <div key={docName} className="border border-gray-100 rounded-xl overflow-hidden">
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${checkedDocs[docName] ? "bg-blue-50" : "bg-white"}`}
                onClick={() => toggleDoc(docName)}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checkedDocs[docName] ? "bg-school-navy border-school-navy" : "border-gray-300"}`}>
                  {checkedDocs[docName] && <Check className="w-3 h-3 text-white" />}
                </div>
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{docName}</span>
                {uploadedFiles[docName] && (
                  <span className="ml-auto text-xs text-green-600 font-medium truncate max-w-[160px]">
                    {typeof uploadedFiles[docName] === "object"
                      ? (uploadedFiles[docName].uploading
                          ? "Uploading…"
                          : `✓ ${uploadedFiles[docName].fileName}${uploadedFiles[docName].size ? ` (${formatFileSize(uploadedFiles[docName].size)})` : ""}`)
                      : `✓ ${uploadedFiles[docName]}`}
                  </span>
                )}
              </div>
              {checkedDocs[docName] && (
                <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-school-navy cursor-pointer hover:bg-blue-50 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadedFiles[docName] ? "Change File" : "Upload File"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleDocFile(docName, e)} />
                  </label>
                  <FieldError>{docErrors[docName]}</FieldError>
                </div>
              )}
            </div>
          ))}

          {customDocs.map((doc) => (
            <div key={doc.id} className="border border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <input
                type="text" placeholder="Document name..." value={doc.label}
                onChange={(e) => updateCustomDocLabel(doc.id, e.target.value)}
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-300"
              />
              {doc.label && (
                <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  <Upload className="w-3 h-3" /> Upload
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleDocFile(doc.label, e)} />
                </label>
              )}
              <button type="button" onClick={() => removeCustomDoc(doc.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button" onClick={addCustomDoc}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Another Document
          </button>
        </div>
      </div>

      {/* ══ SECTION 11: Government IDs ══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <SectionHeader number="11" title="Government ID Numbers" />
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">Government IDs must be updated through the dedicated Government ID update section to maintain audit records.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ReadOnlyField label="UDISE Number" value={form.udise} />
          <ReadOnlyField label="PEN Number"   value={form.pen}   />
          <ReadOnlyField label="APAAR ID"     value={form.apaar} />
        </div>
      </div>

      {/* ══ Submit ══ */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button" onClick={() => router.replace(`/student/${id}`)}
          className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ── Page Entry Point ───────────────────────────────────────────
export default function EditStudentPage() {
  const { id }     = useParams();
  const router     = useRouter();
  const [existing, setExisting] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState(null);

  useEffect(() => {
    if (!id) return;
    getStudentByEnrollment(id)
      .then(s => { setExisting(mapToEditForm(s)); setLoading(false); })
      .catch(err => { setLoadErr(err.message); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading student data...</p>
      </div>
    );
  }

  if (loadErr || !existing) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <GraduationCap className="w-12 h-12 text-gray-200" />
        <p className="text-gray-500 font-medium">{loadErr ? "Failed to load student" : "Student not found"}</p>
        {loadErr && <p className="text-xs text-red-400">{loadErr}</p>}
        <button onClick={() => router.back()} className="text-school-navy text-sm font-medium hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button
          type="button" onClick={() => router.replace(`/student/${id}`)}
          className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Edit Student Profile</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enrollment No:{" "}
            <span className="font-semibold text-school-navy">#{existing.enrollment}</span>
            {" · "}
            <span className="text-gray-400">{existing.firstName} {existing.lastName}</span>
          </p>
        </div>
      </div>

      <EditForm existing={existing} id={id} router={router} />
    </div>
  );
}
