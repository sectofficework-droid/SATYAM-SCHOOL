"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Upload, X, Plus, FileText,
  User, ArrowLeft, Check, Camera,
} from "lucide-react";

// ── Options ────────────────────────────────────────────────────
const sessions     = ["2025-26", "2026-27", "2024-25"];
const standards    = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Science","11th - Commerce","11th - Arts",
  "12th - Science","12th - Commerce","12th - Arts",
];
const genders      = ["Male", "Female", "Other"];
const religions    = ["Hindu", "Muslim", "Christian", "Jain", "Sikh", "Buddhist", "Parsi", "Other"];
const castes       = ["General", "OBC", "SC", "ST", "EWS", "SEBC", "Other"];
const mediums      = ["English", "Gujarati", "Hindi", "Other"];
const todayStr     = new Date().toISOString().split("T")[0];
const nextEnrollment = "1006"; // auto-generated (will come from DB later)

// Sibling dummy data
const siblingsByClass = {
  "10th": ["Arjun Patel", "Ravi Kumar"],
  "9th":  ["Priya Shah", "Nisha Mehta"],
  "8th":  ["Sneha Desai", "Pooja Joshi"],
};

// Default document types
const defaultDocTypes = [
  "Birth Certificate",
  "Student Aadhar Card",
  "Father's Aadhar Card",
  "Mother's Aadhar Card",
  "Leaving Certificate",
];

// ── Helpers ────────────────────────────────────────────────────
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

function SelectField({ children, value, onChange, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
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

  // Section states
  const [hasSibling, setHasSibling]   = useState(false);
  const [siblingClass, setSiblingClass] = useState("");
  const [siblingName, setSiblingName]   = useState("");
  const [hasAadhar, setHasAadhar]       = useState(false);
  const [photo, setPhoto]               = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoRef = useRef(null);

  // Aadhar display (with spaces) vs saved (no spaces)
  const [aadharDisplay, setAadharDisplay] = useState("");

  // Document section
  const [checkedDocs, setCheckedDocs]   = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [customDocs, setCustomDocs]       = useState([]);

  // Form data
  const [form, setForm] = useState({
    session: sessions[0],
    joinDate: todayStr,
    std: "",
    studentName: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "",
    religion: "",
    caste: "",
    roomPlotNo: "",
    address: "",
    mobile1: "",
    mobile2: "",
    placeOfBirth: "",
    lastSchoolName: "",
    lastSchoolClass: "",
    lastSchoolMedium: "",
    lastSchoolPlace: "",
    aadharName: "",
    udise: "",
    pen: "",
    apaar: "",
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  // Aadhar formatting
  const handleAadharInput = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    setAadharDisplay(formatted);
    setForm((p) => ({ ...p, aadharRaw: digits }));
  };

  // Photo upload
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  // Document checkbox toggle
  const toggleDoc = (name) =>
    setCheckedDocs((p) => ({ ...p, [name]: !p[name] }));

  // Document file upload
  const handleDocFile = (name, e) => {
    const file = e.target.files[0];
    if (file) setUploadedFiles((p) => ({ ...p, [name]: file.name }));
  };

  // Add custom doc
  const addCustomDoc = () =>
    setCustomDocs((p) => [...p, { id: Date.now(), label: "", checked: false }]);

  const updateCustomDocLabel = (id, label) =>
    setCustomDocs((p) => p.map((d) => (d.id === id ? { ...d, label } : d)));

  const removeCustomDoc = (id) =>
    setCustomDocs((p) => p.filter((d) => d.id !== id));

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Student added successfully! (Dummy — will save to Supabase later)");
    router.push("/student");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
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

            {/* Session */}
            <div>
              <FieldLabel required>Academic Session</FieldLabel>
              <SelectField value={form.session} onChange={set("session")}>
                {sessions.map((s) => <option key={s}>Session {s}</option>)}
              </SelectField>
            </div>

            {/* Date of Join */}
            <div>
              <FieldLabel required>Date of Join</FieldLabel>
              <Input
                type="date"
                value={form.joinDate}
                max={todayStr}
                onChange={set("joinDate")}
              />
            </div>

            {/* Enrollment Number */}
            <div>
              <FieldLabel required>Enrollment Number</FieldLabel>
              <div className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-school-navy/30 rounded-xl bg-blue-50">
                <span className="text-school-navy font-bold text-sm">#{nextEnrollment}</span>
                <span className="text-xs text-gray-400">(Auto-assigned)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ SECTION 2: Student Photo ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="2" title="Student Photo" />
          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-dashed border-gray-300">
              {photoPreview
                ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                : <Camera className="w-8 h-8 text-gray-300" />
              }
            </div>
            <div>
              <input
                ref={photoRef}
                type="file"
                accept="image/jpg,image/jpeg,image/png"
                className="hidden"
                onChange={handlePhoto}
              />
              <button
                type="button"
                onClick={() => photoRef.current.click()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {photo ? "Change Photo" : "Upload Photo"}
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  className="ml-2 text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
              <p className="text-xs text-gray-400 mt-2">Optional · JPG or PNG · Max 2MB</p>
            </div>
          </div>
        </div>

        {/* ══ SECTION 3: Sibling Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="3" title="Sibling at This School" />
          <div className="space-y-4">
            <div>
              <FieldLabel>Does this student have a sibling already studying here?</FieldLabel>
              <div className="max-w-xs">
                <YesNoToggle value={hasSibling} onChange={setHasSibling} />
              </div>
            </div>
            {hasSibling && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <FieldLabel>Sibling's Class</FieldLabel>
                  <SelectField
                    value={siblingClass}
                    onChange={(e) => { setSiblingClass(e.target.value); setSiblingName(""); }}
                  >
                    <option value="">Select Class</option>
                    {standards.map((s) => <option key={s}>{s}</option>)}
                  </SelectField>
                </div>
                <div>
                  <FieldLabel>Sibling's Name</FieldLabel>
                  <SelectField
                    value={siblingName}
                    onChange={(e) => setSiblingName(e.target.value)}
                    disabled={!siblingClass}
                  >
                    <option value="">
                      {siblingClass ? "Select Student" : "Select class first"}
                    </option>
                    {(siblingsByClass[siblingClass] || []).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </SelectField>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ SECTION 4: Class Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="4" title="Class Details" />
          <div className="max-w-xs">
            <FieldLabel required>Standard</FieldLabel>
            <SelectField value={form.std} onChange={set("std")}>
              <option value="">Select Standard</option>
              {standards.map((s) => <option key={s}>{s}</option>)}
            </SelectField>
          </div>
        </div>

        {/* ══ SECTION 5: Personal Information ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="5" title="Personal Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2">
              <FieldLabel required>Student Full Name</FieldLabel>
              <Input
                placeholder="e.g. Arjun Rajesh Patel  (First Name · Middle Name · Last Name)"
                value={form.studentName}
                onChange={set("studentName")}
              />
            </div>

            <div>
              <FieldLabel required>Father's Name</FieldLabel>
              <Input placeholder="Father's full name" value={form.fatherName} onChange={set("fatherName")} />
            </div>

            <div>
              <FieldLabel required>Mother's Name</FieldLabel>
              <Input placeholder="Mother's full name" value={form.motherName} onChange={set("motherName")} />
            </div>

            <div>
              <FieldLabel required>Date of Birth</FieldLabel>
              <Input
                type="date"
                value={form.dob}
                onChange={set("dob")}
                max={todayStr}
              />
            </div>

            <div>
              <FieldLabel required>Gender</FieldLabel>
              <SelectField value={form.gender} onChange={set("gender")}>
                <option value="">Select Gender</option>
                {genders.map((g) => <option key={g}>{g}</option>)}
              </SelectField>
            </div>

            <div>
              <FieldLabel required>Religion</FieldLabel>
              <SelectField value={form.religion} onChange={set("religion")}>
                <option value="">Select Religion</option>
                {religions.map((r) => <option key={r}>{r}</option>)}
              </SelectField>
            </div>

            <div>
              <FieldLabel required>Category / Caste</FieldLabel>
              <SelectField value={form.caste} onChange={set("caste")}>
                <option value="">Select Category</option>
                {castes.map((c) => <option key={c}>{c}</option>)}
              </SelectField>
            </div>
          </div>
        </div>

        {/* ══ SECTION 6: Address & Contact ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="6" title="Address & Contact Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <FieldLabel required>Room No / Plot No</FieldLabel>
              <Input placeholder="e.g. 12, Block B" value={form.roomPlotNo} onChange={set("roomPlotNo")} />
            </div>

            <div>
              <FieldLabel required>Place of Birth</FieldLabel>
              <Input placeholder="City / Town of birth" value={form.placeOfBirth} onChange={set("placeOfBirth")} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel required>Full Address</FieldLabel>
              <textarea
                placeholder="Society / Area / Landmark / City / PIN Code"
                value={form.address}
                onChange={set("address")}
                rows={2}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 resize-none"
              />
            </div>

            <div>
              <FieldLabel required>Mobile Number 1</FieldLabel>
              <Input
                type="tel"
                placeholder="Primary mobile number"
                maxLength={10}
                value={form.mobile1}
                onChange={set("mobile1")}
              />
            </div>

            <div>
              <FieldLabel>Mobile Number 2</FieldLabel>
              <Input
                type="tel"
                placeholder="Alternate mobile number"
                maxLength={10}
                value={form.mobile2}
                onChange={set("mobile2")}
              />
            </div>
          </div>
        </div>

        {/* ══ SECTION 7: Previous School Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="7" title="Previous School Details" />
          <p className="text-xs text-gray-400 mb-4 -mt-2">Leave blank if this is the student's first school</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldLabel>Previous School Name</FieldLabel>
              <Input placeholder="Name of the last school attended" value={form.lastSchoolName} onChange={set("lastSchoolName")} />
            </div>
            <div>
              <FieldLabel>Last Class Attended</FieldLabel>
              <Input placeholder="e.g. 5th Standard" value={form.lastSchoolClass} onChange={set("lastSchoolClass")} />
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
          </div>
        </div>

        {/* ══ SECTION 8: Aadhar Details ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="8" title="Aadhar Card Details" />
          <div className="space-y-4">
            <div>
              <FieldLabel>Does the student have an Aadhar Card?</FieldLabel>
              <div className="max-w-xs">
                <YesNoToggle value={hasAadhar} onChange={setHasAadhar} />
              </div>
            </div>
            {hasAadhar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <FieldLabel>Aadhar Number</FieldLabel>
                  <Input
                    placeholder="XXXX XXXX XXXX"
                    value={aadharDisplay}
                    onChange={handleAadharInput}
                    maxLength={14}
                    className="tracking-widest font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">Displayed with spaces · Saved without spaces</p>
                </div>
                <div>
                  <FieldLabel>Name as per Aadhar</FieldLabel>
                  <Input
                    placeholder="Exact name on Aadhar card"
                    value={form.aadharName}
                    onChange={set("aadharName")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ SECTION 9: Document Upload ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="9" title="Document Upload" />
          <p className="text-xs text-gray-400 mb-4 -mt-2">
            All documents are optional · Supported formats: PDF, JPG, PNG
          </p>
          <div className="space-y-3">
            {/* Default documents */}
            {defaultDocTypes.map((docName) => (
              <div key={docName} className="border border-gray-100 rounded-xl overflow-hidden">
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    checkedDocs[docName] ? "bg-blue-50" : "bg-white"
                  }`}
                  onClick={() => toggleDoc(docName)}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checkedDocs[docName]
                      ? "bg-school-navy border-school-navy"
                      : "border-gray-300"
                  }`}>
                    {checkedDocs[docName] && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">{docName}</span>
                  {uploadedFiles[docName] && (
                    <span className="ml-auto text-xs text-green-600 font-medium truncate max-w-[140px]">
                      ✓ {uploadedFiles[docName]}
                    </span>
                  )}
                </div>
                {checkedDocs[docName] && (
                  <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-medium text-school-navy cursor-pointer hover:bg-blue-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadedFiles[docName] ? "Change File" : "Upload File"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => handleDocFile(docName, e)}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}

            {/* Custom documents */}
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
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={(e) => handleDocFile(doc.label, e)} />
                  </label>
                )}
                <button type="button" onClick={() => removeCustomDoc(doc.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Add custom doc button */}
            <button
              type="button"
              onClick={addCustomDoc}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Document
            </button>
          </div>
        </div>

        {/* ══ SECTION 10: Government IDs ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <SectionHeader number="10" title="Government ID Numbers" />
          <p className="text-xs text-gray-400 mb-4 -mt-2">
            All fields are optional at admission · Can be updated later
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel>UDISE Number</FieldLabel>
              <Input
                placeholder="18-digit UDISE number"
                value={form.udise}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 18);
                  setForm((p) => ({ ...p, udise: v }));
                }}
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
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setForm((p) => ({ ...p, pen: v }));
                }}
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
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setForm((p) => ({ ...p, apaar: v }));
                }}
                maxLength={12}
                className="font-mono tracking-wide"
              />
              <p className="text-xs text-gray-400 mt-1">12 digits</p>
            </div>
          </div>
        </div>

        {/* ══ Submit Buttons ══ */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-8 py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors shadow-sm"
          >
            Add Student
          </button>
        </div>
      </form>
    </div>
  );
}
