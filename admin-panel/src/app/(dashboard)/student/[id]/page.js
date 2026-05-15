"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Phone, Calendar, BookOpen,
  FileText, IndianRupee, ClipboardCheck, Award, Edit,
  Download, CheckCircle, XCircle, GraduationCap, Shield,
  Package, Clock,
} from "lucide-react";

// ── Dummy Student Data ─────────────────────────────────────────
const studentDB = {
  "1001": {
    enrollment: "1001", password: "ARJ1001", session: "2025-26",
    joinDate: "01 Jun 2025", std: "10th", section: "A", rollNo: "101",
    studentName: "Arjun Rajesh Patel", fatherName: "Rajesh Patel",
    motherName: "Meena Patel", dob: "15 Jan 2010", gender: "Male",
    religion: "Hindu", caste: "General", mobile1: "9876543210", mobile2: "9876500000",
    roomPlotNo: "12, Block B", address: "Shree Society, Varachha Road, Surat - 395006",
    placeOfBirth: "Surat", photo: null,
    lastSchoolName: "St. Xavier's Primary School", lastSchoolClass: "9th",
    lastSchoolMedium: "English", lastSchoolPlace: "Surat",
    aadhar: "1234 5678 9012", aadharName: "Arjun Rajesh Patel",
    udise: "24180100101", pen: "", apaar: "",
    siblingName: "", siblingClass: "",
    documents: [
      { name: "Birth Certificate", uploaded: true, file: "birth_cert.pdf" },
      { name: "Student Aadhar Card", uploaded: true, file: "aadhar_student.jpg" },
      { name: "Father's Aadhar Card", uploaded: false, file: "" },
      { name: "Mother's Aadhar Card", uploaded: false, file: "" },
      { name: "Leaving Certificate", uploaded: true, file: "leaving_cert.pdf" },
    ],
    fees: [
      { term: "Term 1 - 2025-26", amount: 8500, paid: true,  date: "05 Jun 2025", receipt: "RCP001" },
      { term: "Term 2 - 2025-26", amount: 8500, paid: true,  date: "12 Oct 2025", receipt: "RCP042" },
      { term: "Term 3 - 2025-26", amount: 8500, paid: false, date: "",            receipt: "" },
    ],
    inventory: [
      { item: "School Bag",    givenDate: "05 Jun 2025", given: true  },
      { item: "Uniform",       givenDate: "05 Jun 2025", given: true  },
      { item: "Textbooks",     givenDate: "10 Jun 2025", given: true  },
      { item: "Notebooks",     givenDate: "",            given: false },
      { item: "School Diary",  givenDate: "05 Jun 2025", given: true  },
      { item: "ID Card",       givenDate: "15 Jun 2025", given: true  },
      { item: "Assignment - 1", givenDate: "",           given: false },
      { item: "Assignment - 2", givenDate: "",           given: false },
      { item: "Assignment - 3", givenDate: "",           given: false },
    ],
    attendance: [
      { month: "June 2025",    present: 22, absent: 2, total: 24, pct: 92 },
      { month: "July 2025",    present: 25, absent: 1, total: 26, pct: 96 },
      { month: "August 2025",  present: 23, absent: 3, total: 26, pct: 88 },
      { month: "September 2025", present: 24, absent: 2, total: 26, pct: 92 },
      { month: "October 2025", present: 20, absent: 4, total: 24, pct: 83 },
    ],
    results: [
      { exam: "Unit Test 1",      math: 45, science: 42, english: 38, gujarati: 47, social: 40, total: 212, max: 250 },
      { exam: "Mid-Term Exam",    math: 88, science: 82, english: 76, gujarati: 90, social: 78, total: 414, max: 500 },
      { exam: "Unit Test 2",      math: 44, science: 46, english: 40, gujarati: 48, social: 43, total: 221, max: 250 },
      { exam: "Final Exam",       math: 86, science: 80, english: 74, gujarati: 88, social: 76, total: 404, max: 500 },
    ],
  },
};

const TABS = [
  { id: "personal",   label: "Personal Details", icon: User },
  { id: "documents",  label: "Documents",        icon: FileText },
  { id: "fees",       label: "Fees",             icon: IndianRupee },
  { id: "attendance", label: "Attendance",       icon: ClipboardCheck },
  { id: "results",    label: "Exam Results",     icon: Award },
  { id: "inventory",  label: "Inventory",        icon: Package },
];

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium flex-1">
        {value || <span className="text-gray-300 font-normal">N/A</span>}
      </span>
    </div>
  );
}

function Badge({ value, colorClass }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      {value}
    </span>
  );
}

// ── Tabs ───────────────────────────────────────────────────────

function PersonalTab({ s }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Admission Info</p>
        <InfoRow label="Enrollment No"    value={s.enrollment} />
        <InfoRow label="Academic Session" value={s.session} />
        <InfoRow label="Date of Join"     value={s.joinDate} />
        <InfoRow label="Standard"         value={`${s.std} - ${s.section}`} />
        <InfoRow label="Roll Number"      value={s.rollNo} />
        <InfoRow label="App Password"     value={s.password} />
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Info</p>
        <InfoRow label="Full Name"    value={s.studentName} />
        <InfoRow label="Father's Name" value={s.fatherName} />
        <InfoRow label="Mother's Name" value={s.motherName} />
        <InfoRow label="Date of Birth" value={s.dob} />
        <InfoRow label="Gender"        value={s.gender} />
        <InfoRow label="Religion"      value={s.religion} />
        <InfoRow label="Category"      value={s.caste} />
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact & Address</p>
        <InfoRow label="Mobile 1"      value={s.mobile1} />
        <InfoRow label="Mobile 2"      value={s.mobile2} />
        <InfoRow label="Room / Plot"   value={s.roomPlotNo} />
        <InfoRow label="Address"       value={s.address} />
        <InfoRow label="Place of Birth" value={s.placeOfBirth} />
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Previous School</p>
        <InfoRow label="School Name"   value={s.lastSchoolName} />
        <InfoRow label="Last Class"    value={s.lastSchoolClass} />
        <InfoRow label="Medium"        value={s.lastSchoolMedium} />
        <InfoRow label="Location"      value={s.lastSchoolPlace} />
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Government IDs</p>
          <InfoRow label="Aadhar No"   value={s.aadhar} />
          <InfoRow label="Name on Aadhar" value={s.aadharName} />
          <InfoRow label="UDISE No"    value={s.udise} />
          <InfoRow label="PEN No"      value={s.pen} />
          <InfoRow label="APAAR ID"    value={s.apaar} />
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ docs }) {
  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <div key={doc.name} className="flex items-center gap-4 bg-gray-50 rounded-xl px-5 py-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            doc.uploaded ? "bg-green-100" : "bg-red-50"
          }`}>
            {doc.uploaded
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-red-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{doc.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {doc.uploaded ? doc.file : "Not uploaded yet"}
            </p>
          </div>
          {doc.uploaded ? (
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> View
            </button>
          ) : (
            <span className="text-xs text-red-400 font-medium">Pending</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FeesTab({ fees }) {
  const totalFees = fees.reduce((s, f) => s + f.amount, 0);
  const paidFees  = fees.filter((f) => f.paid);
  const totalPaid = paidFees.reduce((s, f) => s + f.amount, 0);
  const totalDue  = totalFees - totalPaid;
  const paidPct   = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary — 3 cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wide mb-1">Total Fees</p>
          <p className="text-2xl font-bold text-blue-700">₹{totalFees.toLocaleString("en-IN")}</p>
          <p className="text-xs text-blue-400 mt-1">{fees.length} term{fees.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
          <p className="text-xs text-green-500 font-bold uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-green-700">₹{totalPaid.toLocaleString("en-IN")}</p>
          <p className="text-xs text-green-400 mt-1">{paidPct}% of total</p>
        </div>
        <div className={`rounded-2xl p-4 text-center border ${totalDue === 0 ? "bg-gray-50 border-gray-100" : "bg-red-50 border-red-100"}`}>
          <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${totalDue === 0 ? "text-gray-400" : "text-red-500"}`}>Balance Due</p>
          <p className={`text-2xl font-bold ${totalDue === 0 ? "text-gray-500" : "text-red-600"}`}>
            {totalDue === 0 ? "Cleared" : `₹${totalDue.toLocaleString("en-IN")}`}
          </p>
          <p className={`text-xs mt-1 ${totalDue === 0 ? "text-gray-400" : "text-red-400"}`}>
            {totalDue === 0 ? "Fully paid ✓" : `${fees.length - paidFees.length} term pending`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Payment Progress</span>
          <span className="text-sm font-bold text-gray-800">{paidPct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${paidPct === 100 ? "bg-green-500" : paidPct >= 50 ? "bg-blue-500" : "bg-red-400"}`}
            style={{ width: `${paidPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">₹0</span>
          <span className="text-xs text-gray-400">₹{totalFees.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Paid-only Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Fee Payment History</p>
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
            {paidFees.length} payment{paidFees.length !== 1 ? "s" : ""}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Term</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid On</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt No</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paidFees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">
                  No fee payments recorded yet
                </td>
              </tr>
            ) : (
              paidFees.map((fee, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{fee.term}</td>
                  <td className="px-5 py-3.5 font-semibold text-green-700">
                    ₹{fee.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{fee.date}</td>
                  <td className="px-5 py-3.5">
                    <button className="text-school-navy text-xs font-semibold hover:text-school-gold transition-colors">
                      {fee.receipt}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceTab({ attendance }) {
  const totalPresent = attendance.reduce((s, a) => s + a.present, 0);
  const totalDays    = attendance.reduce((s, a) => s + a.total, 0);
  const overallPct   = totalDays ? Math.round((totalPresent / totalDays) * 100) : 0;
  return (
    <div className="space-y-5">
      {/* Overall */}
      <div className="bg-gradient-to-r from-school-navy to-school-navy-light rounded-2xl p-5 text-white flex items-center justify-between">
        <div>
          <p className="text-white/70 text-sm">Overall Attendance</p>
          <p className="text-4xl font-bold mt-1">{overallPct}%</p>
          <p className="text-white/60 text-xs mt-1">{totalPresent} present out of {totalDays} working days</p>
        </div>
        <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center">
          <span className="text-xl font-bold">{overallPct}%</span>
        </div>
      </div>
      {/* Month-wise */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Present</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Absent</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Working Days</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Percentage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {attendance.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-800">{row.month}</td>
                <td className="px-5 py-3.5 text-green-600 font-semibold">{row.present}</td>
                <td className="px-5 py-3.5 text-red-500 font-semibold">{row.absent}</td>
                <td className="px-5 py-3.5 text-gray-500">{row.total}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className={`h-full rounded-full ${row.pct >= 90 ? "bg-green-500" : row.pct >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${row.pct >= 90 ? "text-green-600" : row.pct >= 75 ? "text-amber-600" : "text-red-600"}`}>
                      {row.pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsTab({ results }) {
  const subjects = ["math", "science", "english", "gujarati", "social"];
  const subjectLabels = { math: "Mathematics", science: "Science", english: "English", gujarati: "Gujarati", social: "Social Sci." };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Exam</th>
            {subjects.map((s) => (
              <th key={s} className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {subjectLabels[s]}
              </th>
            ))}
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {results.map((row, i) => {
            const pct = Math.round((row.total / row.max) * 100);
            return (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-800 whitespace-nowrap">{row.exam}</td>
                {subjects.map((s) => (
                  <td key={s} className="px-3 py-3.5 text-center font-semibold text-gray-700">{row[s]}</td>
                ))}
                <td className="px-5 py-3.5 text-center font-bold text-gray-800">
                  {row.total}<span className="text-gray-400 font-normal text-xs">/{row.max}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Badge
                    value={`${pct}% · ${pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 45 ? "C" : "D"}`}
                    colorClass={pct >= 75 ? "bg-green-100 text-green-700" : pct >= 45 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTab({ inventory }) {
  const given   = inventory.filter((i) => i.given);
  const pending = inventory.filter((i) => !i.given);

  return (
    <div className="space-y-5">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wide mb-1">Total Items</p>
          <p className="text-2xl font-bold text-blue-700">{inventory.length}</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
          <p className="text-xs text-green-500 font-bold uppercase tracking-wide mb-1">Given</p>
          <p className="text-2xl font-bold text-green-700">{given.length}</p>
          <p className="text-xs text-green-400 mt-1">to student</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
          <p className="text-xs text-amber-500 font-bold uppercase tracking-wide mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{pending.length}</p>
          <p className="text-xs text-amber-400 mt-1">with school</p>
        </div>
      </div>

      {/* Items list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">School Inventory Items</p>
          {pending.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
              {pending.length} item{pending.length !== 1 ? "s" : ""} pending
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-50">
          {inventory.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                item.given ? "bg-green-100" : "bg-amber-50 border border-amber-200"
              }`}>
                {item.given
                  ? <CheckCircle className="w-4.5 h-4.5 text-green-600" />
                  : <Clock className="w-4 h-4 text-amber-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{item.item}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.given
                    ? `Given on ${item.givenDate}`
                    : "Pending — not yet distributed"
                  }
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                item.given
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {item.given ? "Given" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pending.length === 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-5 py-4">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-700">All inventory items have been distributed to this student.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function StudentDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const [activeTab, setActiveTab] = useState("personal");

  const student = studentDB[id];

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

  return (
    <div className="space-y-5 max-w-screen-xl">

      {/* ── ID Card Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Card Top Bar — navy gradient */}
        <div className="bg-gradient-to-r from-school-navy via-blue-900 to-school-navy px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-white/50 text-[10px] font-medium uppercase tracking-widest">
                Student Identity Card
              </p>
              <p className="text-white text-sm font-semibold leading-tight">
                Satyam Stars International School
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/student/${id}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <Edit className="w-3.5 h-3.5" /> Edit Profile
          </button>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6">
          <div className="flex gap-5 sm:gap-6">

            {/* Photo Column */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-4 border-school-navy/15 bg-gradient-to-b from-school-navy/5 to-school-navy/10 flex items-center justify-center overflow-hidden shadow-inner">
                {student.photo
                  ? <img src={student.photo} alt={student.studentName} className="w-full h-full object-cover" />
                  : <User className="w-10 h-10 text-school-navy/25" />
                }
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700">
                Active
              </span>
            </div>

            {/* Details Column */}
            <div className="flex-1 min-w-0">

              {/* Name + Enrollment */}
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">{student.studentName}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    S/o <span className="font-medium text-gray-700">{student.fatherName}</span>
                    {" · "}
                    M/o <span className="font-medium text-gray-700">{student.motherName}</span>
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg">
                  #{student.enrollment}
                </span>
              </div>

              {/* Info Pills Grid */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Date of Birth</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" /> {student.dob}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Mobile</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-gray-400" /> {student.mobile1}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Gender</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">{student.gender}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Class</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-gray-400" />
                    {student.std}-{student.section} · Roll {student.rollNo}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Session</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5">{student.session}</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">App Password</p>
                  <p className="text-xs font-bold text-gray-800 mt-0.5 font-mono tracking-wider">
                    {student.password}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card Footer Strip */}
          <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex items-center gap-2 flex-wrap">
            <Shield className="w-3.5 h-3.5 text-school-navy/40" />
            <span className="text-[10px] text-gray-400 font-medium">
              Issued by School Administration · {student.session} Academic Year
            </span>
            <span className="ml-auto text-[10px] font-semibold text-school-navy/60 font-mono">
              ID: {student.udise || student.enrollment}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tab Nav */}
        <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? "border-school-navy text-school-navy bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 lg:p-6">
          {activeTab === "personal"   && <PersonalTab   s={student} />}
          {activeTab === "documents"  && <DocumentsTab  docs={student.documents} />}
          {activeTab === "fees"       && <FeesTab       fees={student.fees} />}
          {activeTab === "attendance" && <AttendanceTab attendance={student.attendance} />}
          {activeTab === "results"    && <ResultsTab    results={student.results} />}
          {activeTab === "inventory"  && <InventoryTab  inventory={student.inventory} />}
        </div>
      </div>
    </div>
  );
}
