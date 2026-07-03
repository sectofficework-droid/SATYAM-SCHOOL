"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { addStudent as svcAddStudent, getNextEnrollmentNo } from "@/lib/studentService";
import { getActiveClasses } from "@/lib/settingsService";
import {
  ChevronDown, Upload, X, Plus, FileText, AlertTriangle,
  ArrowLeft, Check, Camera, Lock, GraduationCap, Hash,
} from "lucide-react";
import {
  isValidName, isValidPhone, isValidPincode, isValidAadhar,
  isValidPercentage, isNonNegativeNumber, isValidUploadFile,
} from "@/lib/validators";
import { uploadFileToS3, slugify, fileExt } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";

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
const mediums   = ["English", "Gujarati", "Hindi", "Other"];
const todayStr = new Date().toISOString().split("T")[0];

const DISCOUNT_REASONS = [
  "Financial Weak",
  "3 Kids",
  "Fatherless Student",
  "Relative",
  "Early Fees Complete",
  "Early Admission",
  "Old Student",
  "Other",
];

const siblingsByClass = {
  "10th": ["Arjun Patel", "Ravi Kumar"],
  "9th":  ["Priya Shah", "Nisha Mehta"],
  "8th":  ["Sneha Desai", "Pooja Joshi"],
};

const defaultDocTypes = [
  "Birth Certificate",
  "Student Aadhar Card",
  "Father's Aadhar Card",
  "Mother's Aadhar Card",
  "Leaving Certificate",
  "Marksheet",
];

// ── Helpers ────────────────────────────────────────────────────
function normalizeAadhar(v) {
  return String(v || "").replace(/\s/g, "");
}
function isNonEmptyAadhar(v) {
  return normalizeAadhar(v).length > 0;
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

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 ${className}`}
      {...props}
    />
  );
}

function SelectField({ children, value, onChange, disabled, required }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs text-red-500 mt-1">{children}</p>;
}

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2 max-w-xs">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === "Yes")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
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

// ── Main Component ─────────────────────────────────────────────
export default function AddStudentPage() {
  const router = useRouter();
  const [sessionId] = useState(() => crypto.randomUUID());

  const [standards, setStandards]           = useState([]);
  const [nextEnrollment, setNextEnrollment] = useState("...");
  const [autoRollNo, setAutoRollNo]         = useState(null);
  const [feeTotal, setFeeTotal]             = useState(0);
  const [submitting, setSubmitting]         = useState(false);

  // Fetch next enrollment number from DB on mount
  useEffect(() => {
    getNextEnrollmentNo().then(n => setNextEnrollment(n)).catch(() => {});
    getActiveClasses().then(cls => setStandards(cls.map(c => c.name))).catch(() => {});
  }, []);

  const [hasPrevSchool, setHasPrevSchool] = useState(false);
  const [hasSibling, setHasSibling] = useState(false);
  const [siblings, setSiblings]     = useState([{ id: 1, cls: "", name: "" }]);

  const addSibling = () =>
    setSiblings((p) => [...p, { id: Date.now(), cls: "", name: "" }]);
  const removeSibling = (id) =>
    setSiblings((p) => p.filter((s) => s.id !== id));
  const updateSibling = (id, field, val) =>
    setSiblings((p) =>
      p.map((s) =>
        s.id === id ? { ...s, [field]: val, ...(field === "cls" ? { name: "" } : {}) } : s
      )
    );
  const [hasDiscount, setHasDiscount]           = useState(false);
  const [discountAmount, setDiscountAmount]     = useState("");
  const [discountReason, setDiscountReason]     = useState("");
  const [discountCustomReason, setDiscountCustomReason] = useState("");
  const [hasAadhar, setHasAadhar]               = useState(true);
  const [lastExamGiven, setLastExamGiven]       = useState(false);
  const [casteCertError, setCasteCertError]     = useState("");
  const [photo, setPhoto]                 = useState(null);
  const [photoPreview, setPhotoPreview]   = useState(null);
  const [photoError, setPhotoError]       = useState("");
  const [photoKey, setPhotoKey]           = useState(null);
  const [photoSize, setPhotoSize]         = useState(0);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [casteCertFile, setCasteCertFile] = useState(null);
  const [casteCertKey, setCasteCertKey]   = useState(null);
  const [casteCertSize, setCasteCertSize] = useState(0);
  const [casteCertUploading, setCasteCertUploading] = useState(false);
  const casteCertRef = useRef(null);
  const photoRef = useRef(null);

  const [aadharDisplay, setAadharDisplay] = useState("");
  const [fatherAadharDisplay, setFatherAadharDisplay] = useState("");
  const [motherAadharDisplay, setMotherAadharDisplay] = useState("");

  const [checkedDocs, setCheckedDocs]       = useState({});
  const [uploadedFiles, setUploadedFiles]   = useState({}); // { docName: { fileName, key, uploading } }
  const [uploadedFileUrls, setUploadedFileUrls] = useState({}); // { docName: { url, type } }
  const [customDocs, setCustomDocs]         = useState([]);
  const [docErrors, setDocErrors]           = useState({}); // { docName: errorMsg }

  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    joinDate: todayStr,
    grNo: "",
    std: "",
    admissionClass: "",
    rollNo: "",
    firstName: "",
    lastName: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "",
    religion: "Hindu",   // default
    caste: "General",    // default
    motherTongue: "",
    subCaste: "",
    height: "",
    weight: "",
    roomPlotNo: "",
    society: "",
    landmark: "",
    area: "",
    pinCode: "",
    address: "",
    mobile1: "",
    mobile2: "",
    placeOfBirth: "",
    lastSchoolName: "",
    lastSchoolClass: "",
    lastSchoolMedium: "",
    lastSchoolPlace: "",
    lastSchoolGrNo: "",
    prevPercentage: "",
    prevAttendanceDays: "",
    aadharName: "",
    fatherAadharName: "",
    motherAadharName: "",
    udise: "",
    pen: "",
    apaar: "",
    birthCertRegNo: "",
    birthCertRegDate: "",
  });

  const set      = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value.toUpperCase() }));
  const setExact = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    const parts = [form.roomPlotNo, form.society, form.landmark, form.area, "SURAT", form.pinCode]
      .filter(Boolean);
    setForm(p => ({ ...p, address: parts.join(", ") }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.roomPlotNo, form.society, form.landmark, form.area, form.pinCode]);

  const handleStdChange = async (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, std: val, admissionClass: val }));
    setAutoRollNo(null);
    if (val) {
      const { data: cls } = await supabase.from("classes").select("id").eq("name", val).single();
      if (cls) {
        const { data: yr } = await supabase.from("academic_years").select("id").eq("is_current", true).single();
        if (yr) {
          // Fee structure
          const { data: fs } = await supabase
            .from("fee_structures")
            .select("tuition_amount, uniform_amount")
            .eq("class_id", cls.id)
            .eq("academic_year_id", yr.id)
            .single();
          setFeeTotal(fs ? (Number(fs.tuition_amount) || 0) + (Number(fs.uniform_amount) || 0) : 0);

          // Next roll number (section "A" is the default)
          const { data: sec } = await supabase
            .from("sections")
            .select("id")
            .eq("class_id", cls.id)
            .eq("name", "A")
            .maybeSingle();
          if (sec) {
            const { data: rolls } = await supabase
              .from("student_enrollments")
              .select("roll_no")
              .eq("class_id", cls.id)
              .eq("section_id", sec.id)
              .eq("academic_year_id", yr.id)
              .order("roll_no", { ascending: false })
              .limit(1);
            const last = rolls?.[0]?.roll_no || 0;
            setAutoRollNo(last + 1);
            setForm(p => ({ ...p, rollNo: String(last + 1) }));
          } else {
            setAutoRollNo(1);
            setForm(p => ({ ...p, rollNo: "1" }));
          }
        }
      }
    } else {
      setFeeTotal(0);
    }
  };

  // Aadhar formatting — XXXX XXXX XXXX display, raw digits saved
  const handleAadharInput = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
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

  // Photo
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
        const key = `students/pending/${sessionId}/photo.${fileExt(compressed)}`;
        setPhotoSize(compressed.size);
        return uploadFileToS3(compressed, key).then(() => setPhotoKey(key));
      })
      .catch((err) => setPhotoError("Upload failed: " + (err?.message || "Unknown error")))
      .finally(() => setPhotoUploading(false));
  };

  // Toggle document — clears uploaded file when unticked
  const toggleDoc = (name) => {
    const wasChecked = checkedDocs[name];
    setCheckedDocs((p) => ({ ...p, [name]: !p[name] }));
    if (wasChecked) {
      setUploadedFiles((p) => { const next = { ...p }; delete next[name]; return next; });
      setUploadedFileUrls((p) => { const next = { ...p }; delete next[name]; return next; });
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
    setUploadedFileUrls((p) => ({
      ...p,
      [name]: { url: URL.createObjectURL(file), type: file.type },
    }));
    compressFile(file)
      .then((compressed) => {
        const key = `students/pending/${sessionId}/documents/${slugify(name)}.${fileExt(compressed)}`;
        return uploadFileToS3(compressed, key).then(() =>
          setUploadedFiles((p) => ({ ...p, [name]: { ...p[name], key, size: compressed.size, uploading: false } }))
        );
      })
      .catch(() => {
        setDocErrors((p) => ({ ...p, [name]: "Upload failed — please try again." }));
        setUploadedFiles((p) => ({ ...p, [name]: { ...p[name], uploading: false } }));
      });
  };

  const addCustomDoc = () =>
    setCustomDocs((p) => [...p, { id: Date.now(), label: "" }]);

  const updateCustomDocLabel = (id, label) =>
    setCustomDocs((p) => p.map((d) => (d.id === id ? { ...d, label } : d)));

  const removeCustomDoc = (id) =>
    setCustomDocs((p) => p.filter((d) => d.id !== id));

  const validate = () => {
    const errs = {};

    if (!isValidName(form.firstName)) errs.firstName = "Enter a valid first name.";
    if (!isValidName(form.lastName)) errs.lastName = "Enter a valid last name.";
    if (!isValidName(form.fatherName)) errs.fatherName = "Enter a valid father's name.";
    if (!isValidName(form.motherName)) errs.motherName = "Enter a valid mother's name.";

    if (!isValidPhone(form.mobile1)) errs.mobile1 = "Enter a valid 10-digit mobile number.";
    if (form.mobile2 && !isValidPhone(form.mobile2)) errs.mobile2 = "Enter a valid 10-digit mobile number.";

    if (!form.society)  errs.society = "Society / Colony is required.";
    if (!form.area)     errs.area    = "Area / Locality is required.";
    if (!form.pinCode)  errs.pinCode = "Pin code is required.";
    else if (!isValidPincode(form.pinCode)) errs.pinCode = "Enter a valid 6-digit pin code.";

    if (hasAadhar) {
      if (!form.aadharRaw) {
        errs.aadhar = "Aadhar number is required.";
      } else if (!isValidAadhar(form.aadharRaw)) {
        errs.aadhar = "Enter a valid 12-digit Aadhar number.";
      }
    }

    if (form.prevAttendanceDays && !isNonNegativeNumber(form.prevAttendanceDays, 365)) {
      errs.prevAttendanceDays = "Enter a valid number of attendance days.";
    }
    if (lastExamGiven && form.prevPercentage && !isValidPercentage(form.prevPercentage)) {
      errs.prevPercentage = "Enter a valid percentage (0-100).";
    }

    if (form.birthCertRegDate && form.dob && form.birthCertRegDate <= form.dob) {
      errs.birthCertRegDate = "Registration date must be after the date of birth.";
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
      alert("No caste certificate uploaded — category has been set to General automatically.");
    }

    // Build documents array from checked docs
    const allDocNames = [
      ...defaultDocTypes,
      ...customDocs.filter(d => d.label.trim()).map(d => d.label),
    ];
    const documents = allDocNames
      .filter(name => checkedDocs[name])
      .map(name => ({
        name,
        uploaded: !!uploadedFiles[name]?.key,
        fileUrl:  uploadedFiles[name]?.key || null,
      }));
    if (casteCertKey) {
      documents.push({ name: "Caste Certificate", uploaded: true, fileUrl: casteCertKey });
    }

    const finalDiscountReason = discountReason === "Other" ? discountCustomReason : discountReason;

    const payload = {
      // Identity
      firstName:      form.firstName,
      lastName:       form.lastName,
      grNo:           form.grNo,
      dob:            form.dob,
      gender:         form.gender,
      placeOfBirth:   form.placeOfBirth,
      // Photo
      photo:          photoKey,
      // Academic
      std:            form.std,
      section:        "A",
      rollNo:         form.rollNo ? Number(form.rollNo) : null,
      admissionClass: form.admissionClass || form.std,
      dateOfJoin:     form.joinDate,
      // Family
      fatherName:     form.fatherName,
      motherName:     form.motherName,
      mobile:         form.mobile1,
      mobile2:        form.mobile2,
      // Personal
      religion:       form.religion,
      caste:          finalCaste,
      subCaste:       form.subCaste,
      motherTongue:   form.motherTongue,
      height:         form.height,
      weight:         form.weight,
      // Address
      roomPlotNo:     form.roomPlotNo,
      society:        form.society,
      landmark:       form.landmark,
      area:           form.area,
      pinCode:        form.pinCode,
      address:        form.address,
      // Govt IDs
      aadhar:            form.aadharRaw || null,
      aadharName:        form.aadharName,
      fatherAadhar:      form.fatherAadharRaw || null,
      fatherAadharName:  form.fatherAadharName,
      motherAadhar:      form.motherAadharRaw || null,
      motherAadharName:  form.motherAadharName,
      udise:             form.udise,
      pen:               form.pen,
      apaar:             form.apaar,
      birthCertRegNo:    form.birthCertRegNo,
      birthCertRegDate:  form.birthCertRegDate,
      // Fees
      feeTotal:       feeTotal,
      discountAmount: hasDiscount ? Number(discountAmount) || 0 : 0,
      discountReason: hasDiscount ? finalDiscountReason : null,
      // Documents
      documents,
      // Previous school
      lastSchoolName:     hasPrevSchool ? form.lastSchoolName : "",
      lastSchoolGrNo:     form.lastSchoolGrNo,
      lastSchoolClass:    form.lastSchoolClass,
      lastSchoolMedium:   form.lastSchoolMedium,
      lastSchoolPlace:    form.lastSchoolPlace,
      prevAttendanceDays: form.prevAttendanceDays,
      lastExamGiven:      lastExamGiven ? "Yes" : "No",
      prevPercentage:     form.prevPercentage,
      // Siblings
      siblings: hasSibling ? siblings.filter(s => s.name) : [],
    };

    setSubmitting(true);
    try {
      const { rollNo, enrollmentNo } = await svcAddStudent(payload);
      alert(`Student added! Enrollment: #${enrollmentNo} · Roll No: ${rollNo} for ${form.std}.`);
      router.push("/student");
    } catch (err) {
      alert("Failed to add student: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Add New Student</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enrollment No will be auto-assigned:{" "}
            <span className="font-semibold text-school-navy">#{nextEnrollment}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ══ SECTION 1: Admission Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="1" title="Admission Details" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Session — read-only */}
            <div>
              <FieldLabel required>Academic Session</FieldLabel>
              <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-700">{CURRENT_SESSION}</span>
                <span className="text-xs text-gray-400 ml-auto">Set in Settings</span>
              </div>
            </div>

            {/* Date of Join */}
            <div>
              <FieldLabel required>Date of Join</FieldLabel>
              <Input type="date" value={form.joinDate} max={todayStr} onChange={set("joinDate")} />
            </div>

            {/* Enrollment Number */}
            <div>
              <FieldLabel required>Enrollment Number</FieldLabel>
              <div className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-school-navy/30 rounded-xl bg-blue-50">
                <span className="text-school-navy font-bold text-sm">#{nextEnrollment}</span>
                <span className="text-xs text-gray-400">(Auto-assigned)</span>
              </div>
            </div>

            {/* GR Number */}
            <div>
              <FieldLabel>GR Number</FieldLabel>
              <Input
                placeholder="e.g. GR-006"
                value={form.grNo}
                onChange={set("grNo")}
              />
              <p className="text-xs text-gray-400 mt-1">General Register number (optional at admission)</p>
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
                type="button"
                onClick={() => photoRef.current.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {photo ? "Change Photo" : "Upload Photo"}
              </button>
              {photo && (
                <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); setPhotoKey(null); setPhotoSize(0); }}
                  className="ml-2 text-xs text-red-500 hover:text-red-700">
                  Remove
                </button>
              )}
              <p className="text-xs text-gray-400 mt-2">Optional · JPG or PNG · auto-compressed to 1MB or less</p>
              {!photoUploading && photoSize > 0 && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ {formatFileSize(photoSize)}</p>
              )}
              <FieldError>{photoError}</FieldError>
            </div>
          </div>
        </div>

        {/* ══ SECTION 3: Sibling at School ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="3" title="Sibling at This School" />
          <div className="space-y-4">
            <div>
              <FieldLabel>Does this student have a sibling already studying here?</FieldLabel>
              <YesNoToggle
                value={hasSibling}
                onChange={(val) => {
                  setHasSibling(val);
                  setSiblings([{ id: 1, cls: "", name: "" }]);
                }}
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
                        <SelectField
                          value={sib.name}
                          onChange={(e) => updateSibling(sib.id, "name", e.target.value)}
                          disabled={!sib.cls}
                          required
                        >
                          <option value="">
                            {sib.cls ? "Select Student" : "Select class first"}
                          </option>
                          {(siblingsByClass[sib.cls] || []).map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </SelectField>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <FieldLabel required>Current Standard</FieldLabel>
              <SelectField value={form.std} onChange={handleStdChange} required>
                <option value="">Select Standard</option>
                {standards.map((s) => <option key={s}>{s}</option>)}
              </SelectField>
            </div>
            <div>
              <FieldLabel required>Roll Number</FieldLabel>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="number"
                  min="1"
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-school-navy/30 ${form.rollNo ? "border-school-navy/30 bg-blue-50 text-school-navy" : "border-gray-200 bg-gray-50 text-gray-400"}`}
                  placeholder={form.std ? "Enter roll no" : "Select class first"}
                  value={form.rollNo}
                  onChange={e => setForm(p => ({ ...p, rollNo: e.target.value }))}
                  disabled={!form.std}
                />
                {autoRollNo && Number(form.rollNo) !== autoRollNo && (
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, rollNo: String(autoRollNo) }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-semibold hover:text-blue-700"
                  >
                    Reset to {autoRollNo}
                  </button>
                )}
              </div>
              {autoRollNo && Number(form.rollNo) === autoRollNo && (
                <p className="text-[11px] text-gray-400 mt-1">Auto-assigned · editable</p>
              )}
            </div>
            <div>
              <FieldLabel>Admission Class</FieldLabel>
              <SelectField
                value={form.admissionClass}
                onChange={setExact("admissionClass")}
              >
                <option value="">Same as current std</option>
                {standards.map((s) => <option key={s}>{s}</option>)}
              </SelectField>
              <p className="text-[11px] text-gray-400 mt-1">Class when student first joined this school</p>
            </div>
          </div>
          {form.std && (
            <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 max-w-lg">
              <GraduationCap className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">
                Current class: <b>{form.std}</b> · Admission class: <b>{form.admissionClass || form.std}</b>
              </p>
            </div>
          )}
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
              <FieldLabel required>Date of Birth</FieldLabel>
              <Input type="date" value={form.dob} onChange={set("dob")} max={todayStr} required />
            </div>

            <div>
              <FieldLabel required>Gender</FieldLabel>
              <SelectField value={form.gender} onChange={setExact("gender")} required>
                <option value="">Select Gender</option>
                {genders.map((g) => <option key={g}>{g}</option>)}
              </SelectField>
            </div>

            <div>
              <FieldLabel required>Religion</FieldLabel>
              <SelectField value={form.religion} onChange={setExact("religion")} required>
                {religions.map((r) => <option key={r}>{r}</option>)}
              </SelectField>
            </div>

            <div>
              <FieldLabel required>Category / Caste</FieldLabel>
              <SelectField value={form.caste} onChange={(e) => { setExact("caste")(e); setCasteCertFile(null); setCasteCertKey(null); }} required>
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

          {/* Caste certificate — mandatory if non-General */}
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
                    Upload is mandatory. If not uploaded, the category will be automatically set to <b>General</b> on save.
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
                      const key = `students/pending/${sessionId}/documents/caste-certificate.${fileExt(compressed)}`;
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
              <FieldLabel required>Society / Colony</FieldLabel>
              <Input placeholder="e.g. Shanti Nagar Society" value={form.society} onChange={set("society")} required />
              <FieldError>{errors.society}</FieldError>
            </div>

            <div>
              <FieldLabel>Landmark</FieldLabel>
              <Input placeholder="e.g. Near Bus Stand" value={form.landmark} onChange={set("landmark")} />
            </div>

            <div>
              <FieldLabel required>Area / Locality</FieldLabel>
              <Input placeholder="e.g. Vesu" value={form.area} onChange={set("area")} required />
              <FieldError>{errors.area}</FieldError>
            </div>

            <div>
              <FieldLabel required>Pin Code</FieldLabel>
              <Input placeholder="e.g. 395007" maxLength={6} value={form.pinCode} onChange={set("pinCode")} required />
              <FieldError>{errors.pinCode}</FieldError>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel required>Full Address</FieldLabel>
              <textarea
                placeholder="Society / Area / Landmark / City / PIN Code"
                value={form.address}
                onChange={set("address")}
                rows={2}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 resize-none"
              />
            </div>

            <div>
              <FieldLabel required>Mobile Number 1</FieldLabel>
              <Input type="tel" placeholder="Primary mobile number" maxLength={10} value={form.mobile1} onChange={set("mobile1")} required />
              <FieldError>{errors.mobile1}</FieldError>
            </div>

            <div>
              <FieldLabel>Mobile Number 2</FieldLabel>
              <Input type="tel" placeholder="Alternate mobile number" maxLength={10} value={form.mobile2} onChange={set("mobile2")} />
              <FieldError>{errors.mobile2}</FieldError>
            </div>
          </div>
        </div>

        {/* ══ SECTION 7: Birth Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="7" title="Birth Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Place of Birth</FieldLabel>
              <Input placeholder="City / Town where student was born" value={form.placeOfBirth} onChange={set("placeOfBirth")} required />
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
                onChange={setExact("birthCertRegDate")}
                min={form.dob ? (() => { const d = new Date(form.dob); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })() : ""}
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
                    <SelectField value={form.lastSchoolClass} onChange={setExact("lastSchoolClass")}>
                      <option value="">Select Standard</option>
                      {prevStandards.map((s) => <option key={s}>{s}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <FieldLabel>Medium of Instruction</FieldLabel>
                    <SelectField value={form.lastSchoolMedium} onChange={setExact("lastSchoolMedium")}>
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
                    <p className="text-xs text-amber-700 mt-0.5">
                      Upload Transfer Certificate and Marksheet in Section 10 (Documents).
                    </p>
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
              <YesNoToggle value={hasAadhar} onChange={(val) => { setHasAadhar(val); setAadharDisplay(""); setForm((p) => ({ ...p, aadharRaw: "", aadharName: "" })); }} />
            </div>
            {hasAadhar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <FieldLabel required>Aadhar Number</FieldLabel>
                  <Input
                    placeholder="XXXX XXXX XXXX"
                    value={aadharDisplay}
                    onChange={handleAadharInput}
                    maxLength={14}
                    className="tracking-widest font-mono"
                    required
                  />
                  <FieldError>{errors.aadhar}</FieldError>
                </div>
                <div>
                  <FieldLabel required>Name as per Aadhar</FieldLabel>
                  <Input
                    placeholder="Exact name on Aadhar card"
                    value={form.aadharName}
                    onChange={set("aadharName")}
                    required
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ SECTION 10: Document Upload ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="10" title="Document Upload" />
          <p className="text-xs text-gray-400 mb-4 -mt-2">All documents are optional · Supported formats: PDF, JPG, PNG</p>
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
                      {uploadedFiles[docName].uploading
                        ? "Uploading…"
                        : `✓ ${uploadedFiles[docName].fileName}${uploadedFiles[docName].size ? ` (${formatFileSize(uploadedFiles[docName].size)})` : ""}`}
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
                  type="text"
                  placeholder="Document name..."
                  value={doc.label}
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
              type="button"
              onClick={addCustomDoc}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Document
            </button>
          </div>
        </div>

        {/* ══ SECTION 11: Government IDs ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="11" title="Government ID Numbers" />
          <p className="text-xs text-gray-400 mb-4 -mt-2">All fields are optional at admission · Can be updated later</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel>UDISE Number</FieldLabel>
              <Input
                placeholder="18-digit UDISE number"
                value={form.udise}
                onChange={(e) => setForm((p) => ({ ...p, udise: e.target.value.replace(/\D/g, "").slice(0, 18) }))}
                maxLength={18}
                className="font-mono tracking-wide"
              />
              <p className="text-xs text-gray-400 mt-1">18 digits</p>
            </div>
            <div>
              <FieldLabel>PEN Number</FieldLabel>
              <Input
                placeholder="11-digit PEN number"
                value={form.pen}
                onChange={(e) => setForm((p) => ({ ...p, pen: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
                maxLength={11}
                className="font-mono tracking-wide"
              />
              <p className="text-xs text-gray-400 mt-1">11 digits</p>
            </div>
            <div>
              <FieldLabel>APAAR ID</FieldLabel>
              <Input
                placeholder="12-digit APAAR ID"
                value={form.apaar}
                onChange={(e) => setForm((p) => ({ ...p, apaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                maxLength={12}
                className="font-mono tracking-wide"
              />
              <p className="text-xs text-gray-400 mt-1">12 digits</p>
            </div>
          </div>
        </div>

        {/* ══ SECTION 12: Fees Discount ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="12" title="Fees Discount" />
          <div className="space-y-4">
            <div>
              <FieldLabel>Apply Discount to Fees?</FieldLabel>
              <YesNoToggle
                value={hasDiscount}
                onChange={(v) => {
                  setHasDiscount(v);
                  setDiscountAmount(""); setDiscountReason(""); setDiscountCustomReason("");
                }}
              />
            </div>
            {hasDiscount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <FieldLabel required>Discount Amount</FieldLabel>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">₹</span>
                    <Input
                      type="number" placeholder="0" value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="pl-7" min="0" required
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel required>Reason</FieldLabel>
                  <SelectField
                    value={discountReason}
                    onChange={(e) => { setDiscountReason(e.target.value); setDiscountCustomReason(""); }}
                    required
                  >
                    <option value="">Select Reason</option>
                    {DISCOUNT_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </SelectField>
                </div>
                {discountReason === "Other" && (
                  <div className="sm:col-span-2">
                    <FieldLabel required>Remarks</FieldLabel>
                    <Input
                      placeholder="Enter reason for discount..."
                      value={discountCustomReason}
                      onChange={(e) => setDiscountCustomReason(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ Submit ══ */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Add Student"}
          </button>
        </div>
      </form>
    </div>
  );
}
