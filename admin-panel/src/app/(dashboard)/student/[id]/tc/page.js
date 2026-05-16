"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, GraduationCap, CheckCircle2, Printer, FileText,
  ChevronDown, Lock,
} from "lucide-react";

// ── Dummy student DB ───────────────────────────────────────────
const studentDB = {
  "1001": {
    enrollment: "1001", name: "Arjun Patel", std: "10th", section: "A",
    rollNo: "101", session: "2025-26",
    fatherName: "Rajesh Patel", motherName: "Meena Patel",
    dob: "15 Jan 2010", gender: "Male",
    address: "12, Shree Society, Varachha Road, Surat - 395006",
    mobile: "9876543210", aadhar: "1234 5678 9012",
    admissionDate: "01 Jun 2023", admissionClass: "8th",
    caste: "General", religion: "Hindu",
  },
  "1002": {
    enrollment: "1002", name: "Priya Shah", std: "9th", section: "B",
    rollNo: "204", session: "2025-26",
    fatherName: "Amit Shah", motherName: "Kavita Shah",
    dob: "22 Mar 2011", gender: "Female",
    address: "45, Ganesh Nagar, Adajan, Surat - 395009",
    mobile: "9765432100", aadhar: "",
    admissionDate: "15 Jun 2023", admissionClass: "8th",
    caste: "OBC", religion: "Hindu",
  },
  "1003": {
    enrollment: "1003", name: "Rohan Mehta", std: "11th - Commerce", section: "A",
    rollNo: "312", session: "2025-26",
    fatherName: "Suresh Mehta", motherName: "Asha Mehta",
    dob: "08 Jul 2009", gender: "Male",
    address: "78, Silver Park, Katargam, Surat - 395004",
    mobile: "9654321098", aadhar: "9876 5432 1098",
    admissionDate: "10 Apr 2022", admissionClass: "9th",
    caste: "General", religion: "Jain",
  },
  "1004": {
    enrollment: "1004", name: "Sneha Desai", std: "8th", section: "C",
    rollNo: "418", session: "2025-26",
    fatherName: "Kishore Desai", motherName: "Hetal Desai",
    dob: "30 Nov 2011", gender: "Female",
    address: "23, Krishna Society, Piplod, Surat - 395007",
    mobile: "9543210987", aadhar: "",
    admissionDate: "05 Jun 2024", admissionClass: "8th",
    caste: "SC", religion: "Hindu",
  },
  "1005": {
    enrollment: "1005", name: "Dev Joshi", std: "JR.KG", section: "A",
    rollNo: "501", session: "2025-26",
    fatherName: "Prakash Joshi", motherName: "Ruchita Joshi",
    dob: "14 Sep 2020", gender: "Male",
    address: "5, Swaminarayan Society, Dindoli, Surat - 395010",
    mobile: "9432109876", aadhar: "",
    admissionDate: "12 Jun 2024", admissionClass: "JR.KG",
    caste: "General", religion: "Hindu",
  },
};

const todayStr = new Date().toISOString().split("T")[0];

const LEAVE_REASONS = [
  "Transfer to another school",
  "Academic completion (passed out)",
  "Family relocation",
  "Financial reasons",
  "Health / Medical reasons",
  "Study in Village",
  "Parent's request",
  "Disciplinary reasons",
  "Other",
];

const CONDUCT_OPTIONS = ["Excellent", "Good", "Satisfactory", "Needs Improvement"];

function generateTcNumber(enrollment) {
  const year = new Date().getFullYear();
  return `TC-${year}-${enrollment.padStart(4, "0")}`;
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

function SelectField({ children, value, onChange, required }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={onChange} required={required}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer transition-all"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── TC Certificate Preview ─────────────────────────────────────
function TcCertificate({ student, tcData }) {
  return (
    <div className="bg-white border-4 border-school-navy rounded-2xl p-8 max-w-2xl mx-auto" id="tc-print">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-200 pb-5 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Satyam Stars International School
        </p>
        <h2 className="text-2xl font-black text-school-navy mt-1">
          TRANSFER CERTIFICATE
        </h2>
        <p className="text-xs text-gray-400 mt-1">Affiliated · Surat, Gujarat · India</p>
        <div className="mt-3 flex justify-center gap-6 text-xs text-gray-500">
          <span>TC No: <b className="text-gray-800">{tcData.tcNumber}</b></span>
          <span>Date: <b className="text-gray-800">{new Date(tcData.tcDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</b></span>
        </div>
      </div>

      {/* Student info */}
      <div className="space-y-3">
        {[
          ["Student's Name",          student.name],
          ["Father's Name",           student.fatherName],
          ["Mother's Name",           student.motherName],
          ["Date of Birth",           student.dob],
          ["Nationality / Religion",  `Indian / ${student.religion}`],
          ["Category",                student.caste],
          ["Aadhar Card No.",         student.aadhar || "Not Provided"],
          ["Date of Admission",       student.admissionDate],
          ["Class at Admission",      student.admissionClass || "—"],
          ["Last Class Attended",     `${student.std}${student.section ? "-" + student.section : ""}`],
          ["Academic Session",        student.session],
          ["Date of Leaving",         new Date(tcData.leavingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
          ["Reason for Leaving",      tcData.reason === "Other" ? tcData.customReason : tcData.reason],
          ["General Conduct",         tcData.conduct],
          ["Dues / Books Cleared",    tcData.duesCleared ? "Yes — All cleared" : "No — Dues pending"],
          ["Remarks",                 tcData.remarks || "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-start border-b border-gray-100 pb-2.5 last:border-0">
            <span className="text-xs text-gray-500 font-medium w-52 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-gray-900 font-semibold flex-1">: {value}</span>
          </div>
        ))}
      </div>

      {/* Signatures */}
      <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t-2 border-gray-200">
        {["Class Teacher", "Checked By", "Principal"].map((role) => (
          <div key={role} className="text-center">
            <div className="h-10 border-b border-gray-300 mb-2" />
            <p className="text-xs font-semibold text-gray-600">{role}</p>
            <p className="text-[10px] text-gray-400">Satyam Stars Int. School</p>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-4">
        This certificate is issued on the basis of school records. Any correction must be reported within 30 days.
      </p>
    </div>
  );
}

// ── Main TC Page ───────────────────────────────────────────────
export default function TcPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const student  = studentDB[id];

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    tcNumber:     generateTcNumber(id),
    tcDate:       todayStr,
    leavingDate:  todayStr,
    reason:       "",
    customReason: "",
    conduct:      "Good",
    duesCleared:  true,
    remarks:      "",
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <GraduationCap className="w-12 h-12 text-gray-200" />
        <p className="text-gray-500 font-medium">Student not found</p>
        <button onClick={() => router.back()} className="text-school-navy text-sm font-medium hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.reason) { alert("Please select a reason for leaving."); return; }
    if (form.reason === "Other" && !form.customReason.trim()) {
      alert("Please enter the reason for leaving."); return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-10">
        {/* Success banner */}
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-800">Transfer Certificate Generated</p>
            <p className="text-xs text-green-600 mt-0.5">
              {student.name} has been marked as <b>Inactive</b>. TC No: <b>{form.tcNumber}</b>
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-school-navy text-white text-xs font-semibold rounded-xl hover:bg-school-navy-dark transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print TC
          </button>
        </div>

        <TcCertificate student={student} tcData={form} />

        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.push("/student")}
            className="px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors"
          >
            Back to Student List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button" onClick={() => router.replace(`/student/${id}`)}
          className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Generate Transfer Certificate</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Student: <span className="font-semibold text-gray-700">{student.name}</span>
            {" · "}Enrollment: <span className="font-semibold text-school-navy">#{student.enrollment}</span>
          </p>
        </div>
      </div>

      {/* ── Student Info Card ── */}
      <div className="bg-gradient-to-r from-school-navy to-blue-900 rounded-2xl px-5 py-4 text-white">
        <p className="text-white/50 text-[10px] uppercase tracking-widest font-medium mb-1">Student Being Issued TC</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-sm font-bold">{student.name}</span>
          <span className="text-white/70 text-xs">{student.std}{student.section ? `-${student.section}` : ""} · Roll {student.rollNo}</span>
          <span className="text-white/70 text-xs">Session: {student.session}</span>
          <span className="text-white/70 text-xs">Father: {student.fatherName}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* TC Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-lg bg-school-navy flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-school-navy text-base">TC Details</h3>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel required>TC Number</FieldLabel>
              <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-bold text-school-navy font-mono">{form.tcNumber}</span>
              </div>
            </div>
            <div>
              <FieldLabel required>TC Issue Date</FieldLabel>
              <Input type="date" value={form.tcDate} max={todayStr} onChange={set("tcDate")} />
            </div>
            <div>
              <FieldLabel required>Date of Leaving</FieldLabel>
              <Input type="date" value={form.leavingDate} max={todayStr} onChange={set("leavingDate")} />
            </div>
          </div>
        </div>

        {/* Leaving Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <h3 className="font-semibold text-school-navy text-base">Leaving Details</h3>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Reason for Leaving</FieldLabel>
              <SelectField value={form.reason} onChange={set("reason")} required>
                <option value="">Select Reason</option>
                {LEAVE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </SelectField>
            </div>

            {form.reason === "Other" && (
              <div>
                <FieldLabel required>Specify Reason</FieldLabel>
                <Input
                  placeholder="Enter reason..."
                  value={form.customReason}
                  onChange={set("customReason")}
                  required
                />
              </div>
            )}

            <div>
              <FieldLabel required>General Conduct</FieldLabel>
              <SelectField value={form.conduct} onChange={set("conduct")} required>
                {CONDUCT_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </SelectField>
            </div>

            <div>
              <FieldLabel required>Books & Dues Cleared?</FieldLabel>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, duesCleared: val }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      form.duesCleared === val
                        ? val
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-red-500 text-white border-red-500 shadow-sm"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Remarks</FieldLabel>
              <textarea
                placeholder="Any additional remarks for this TC..."
                value={form.remarks}
                onChange={set("remarks")}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all bg-white placeholder:text-gray-300 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-xs text-red-700 font-medium">
            Once the TC is generated, <b>{student.name}</b> will be marked as <b>Inactive</b> and will not appear
            in the active student list. Their data will be preserved for records. This action cannot be undone.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.replace(`/student/${id}`)}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            Generate TC & Mark as Deactive
          </button>
        </div>
      </form>
    </div>
  );
}
