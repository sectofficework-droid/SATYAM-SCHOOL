"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import useStore from "@/lib/store";
import { useParams, useRouter } from "next/navigation";
import { getStudentByEnrollment, bagItemAllowedForClass } from "@/lib/studentService";
import { fmtDMY } from "@/lib/utils";
import S3Image from "@/components/S3Image";
import { getS3ViewUrl, buildDocDownloadName } from "@/lib/s3Upload";
import {
  ArrowLeft, User, Phone, Calendar, BookOpen,
  FileText, IndianRupee, ClipboardCheck, Award, Edit,
  Download, CheckCircle, XCircle, GraduationCap, Shield,
  Package, Clock, AlertTriangle, Bell, Send, X,
} from "lucide-react";


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
        <InfoRow label="GR Number"        value={s.grNo} />
        <InfoRow label="Academic Session" value={s.session} />
        <InfoRow label="Date of Join"     value={fmtDMY(s.joinDate)} />
        <InfoRow label="Standard"         value={`${s.std} - ${s.section}`} />
        <InfoRow label="Roll Number"      value={s.rollNo} />
        <InfoRow label="App Password"     value={s.password} />
        {s.discount?.applied && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-0.5">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Fees Discount Applied</p>
            <InfoRow label="Discount Amount" value={`₹${s.discount.amount.toLocaleString("en-IN")}`} />
            <InfoRow label="Reason"          value={s.discount.reason} />
          </div>
        )}
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Info</p>
        <InfoRow label="Full Name"    value={s.studentName} />
        <InfoRow label="Father's Name" value={s.fatherName} />
        <InfoRow label="Mother's Name" value={s.motherName} />
        <InfoRow label="Date of Birth" value={fmtDMY(s.dob)} />
        <InfoRow label="Gender"        value={s.gender} />
        <InfoRow label="Religion"      value={s.religion} />
        <InfoRow label="Category"      value={s.caste} />
        <InfoRow label="Sub Caste"     value={s.subCaste} />
        <InfoRow label="Mother Tongue" value={s.motherTongue} />
        <InfoRow label="Height"        value={s.height ? `${s.height} cm` : ""} />
        <InfoRow label="Weight"        value={s.weight ? `${s.weight} kg` : ""} />
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact & Address</p>
        <InfoRow label="Mobile 1"      value={s.mobile1} />
        <InfoRow label="Mobile 2"      value={s.mobile2} />
        <InfoRow label="Room / Plot"   value={s.roomPlotNo} />
        <InfoRow label="Society"       value={s.society} />
        <InfoRow label="Landmark"      value={s.landmark} />
        <InfoRow label="Area"          value={s.area} />
        <InfoRow label="Pin Code"      value={s.pinCode} />
        <InfoRow label="Address"       value={s.address} />
        <InfoRow label="Place of Birth" value={s.placeOfBirth} />
        <InfoRow label="Birth State"    value={s.birthState} />
        <InfoRow label="Birth District" value={s.birthDistrict} />
        <InfoRow label="Birth City"     value={s.birthCity} />
      </div>
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Previous School</p>
        <InfoRow label="School Name"   value={s.lastSchoolName} />
        <InfoRow label="School GR No"  value={s.lastSchoolGrNo} />
        <InfoRow label="Last Class"    value={s.lastSchoolClass} />
        <InfoRow label="Medium"        value={s.lastSchoolMedium} />
        <InfoRow label="Location"      value={s.lastSchoolPlace} />
        <InfoRow label="Attendance Days" value={s.prevAttendanceDays} />
        <InfoRow label="Last Exam Given" value={s.lastExamGiven} />
        <InfoRow label="Previous Percentage" value={s.prevPercentage} />
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Government IDs</p>
          <InfoRow label="Aadhar No"          value={s.aadhar} />
          <InfoRow label="Name on Aadhar"     value={s.aadharName} />
          <InfoRow label="Father's Aadhar"    value={s.fatherAadhar} />
          <InfoRow label="Father's Aadhar Name" value={s.fatherAadharName} />
          <InfoRow label="Mother's Aadhar"    value={s.motherAadhar} />
          <InfoRow label="Mother's Aadhar Name" value={s.motherAadharName} />
          <InfoRow label="UDISE No"           value={s.udise} />
          <InfoRow label="PEN No"             value={s.pen} />
          <InfoRow label="APAAR ID"           value={s.apaar} />
          <InfoRow label="Birth Cert Reg No"  value={s.birthCertRegNo} />
          <InfoRow label="Birth Cert Reg Date" value={s.birthCertRegDate ? fmtDMY(s.birthCertRegDate) : ""} />
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ docs, s }) {
  const pendingDocs               = docs.filter((d) => !d.uploaded);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMsg,  setNotifyMsg]  = useState("");
  const [mounted,    setMounted]    = useState(false);
  useEffect(() => setMounted(true), []);

  const openNotify = () => {
    const docList = pendingDocs.map((d) => `• ${d.name}`).join("\n");
    setNotifyMsg(
      `Dear Parent,\n\nThis is to inform you that the following document${pendingDocs.length > 1 ? "s" : ""} for your child ${s.studentName} (Class ${s.std}-${s.section}, Enrollment #${s.enrollment}) ${pendingDocs.length > 1 ? "are" : "is"} still pending submission:\n\n${docList}\n\nKindly submit the above at the school office at the earliest.\n\nRegards,\nSatyam Stars International School, Surat`
    );
    setNotifyOpen(true);
  };

  const notifyModal = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-school-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white" />
            <p className="text-white font-bold">Document Reminder</p>
          </div>
          <button onClick={() => setNotifyOpen(false)} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Preview and edit the notification message before sending.</p>
          <textarea
            value={notifyMsg}
            onChange={(e) => setNotifyMsg(e.target.value)}
            rows={10}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setNotifyOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { alert("Notification sent! (Will send via student app after integration)"); setNotifyOpen(false); }}
              className="flex-1 py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {pendingDocs.length > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-700">
              {pendingDocs.length} document{pendingDocs.length !== 1 ? "s" : ""} pending
            </span>
          </div>
          <button
            onClick={openNotify}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-school-navy text-white rounded-lg text-xs font-semibold hover:bg-school-navy-dark transition-colors flex-shrink-0"
          >
            <Bell className="w-3 h-3" /> Send Notification
          </button>
        </div>
      )}

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
                {doc.uploaded ? (doc.file?.split("/").pop() || "Uploaded") : "Not uploaded yet"}
              </p>
            </div>
            {doc.uploaded ? (
              <button
                onClick={async () => {
                  const downloadName = buildDocDownloadName(s.enrollment, s.studentName, doc.name, doc.file);
                  const url = await getS3ViewUrl(doc.file, downloadName);
                  if (url) window.open(url, "_blank");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> View
              </button>
            ) : (
              <span className="text-xs text-red-400 font-medium">Pending</span>
            )}
          </div>
        ))}
      </div>

      {notifyOpen && mounted && createPortal(notifyModal, document.body)}
    </div>
  );
}

function FeesTab({ fees }) {
  const totalFees  = fees?.total ?? 0;
  const discount   = fees?.discount ?? 0;
  const actualFees = Math.max(totalFees - discount, 0);
  const totalPaid  = fees?.paid ?? 0;
  const totalDue   = Math.max(actualFees - totalPaid, 0);
  const paidPct    = actualFees > 0 ? Math.round((totalPaid / actualFees) * 100) : 0;
  const payments   = fees?.payments || [];

  return (
    <div className="space-y-5">
      {/* Summary — 3 cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-blue-50 rounded-2xl p-2 sm:p-4 text-center border border-blue-100">
          <p className="text-[10px] sm:text-xs text-blue-500 font-bold uppercase tracking-wide mb-1">Total Fees</p>
          <p className="text-sm sm:text-2xl font-bold text-blue-700">₹{actualFees.toLocaleString("en-IN")}</p>
          {discount > 0 && <p className="text-[10px] sm:text-xs text-amber-600 font-semibold mt-1 hidden sm:block">₹{totalFees.toLocaleString("en-IN")} - ₹{discount.toLocaleString("en-IN")} disc</p>}
        </div>
        <div className="bg-green-50 rounded-2xl p-2 sm:p-4 text-center border border-green-100">
          <p className="text-[10px] sm:text-xs text-green-500 font-bold uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-sm sm:text-2xl font-bold text-green-700">₹{totalPaid.toLocaleString("en-IN")}</p>
          <p className="text-[10px] sm:text-xs text-green-400 mt-1">{paidPct}%</p>
        </div>
        <div className={`rounded-2xl p-2 sm:p-4 text-center border ${totalDue === 0 ? "bg-gray-50 border-gray-100" : "bg-red-50 border-red-100"}`}>
          <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide mb-1 ${totalDue === 0 ? "text-gray-400" : "text-red-500"}`}>Balance</p>
          <p className={`text-sm sm:text-2xl font-bold ${totalDue === 0 ? "text-gray-500" : "text-red-600"}`}>
            {totalDue === 0 ? "Cleared" : `₹${totalDue.toLocaleString("en-IN")}`}
          </p>
          <p className={`text-[10px] sm:text-xs mt-1 hidden sm:block ${totalDue === 0 ? "text-gray-400" : "text-red-400"}`}>
            {totalDue === 0 ? "Fully paid ✓" : `of ₹${actualFees.toLocaleString("en-IN")}`}
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
          <span className="text-xs text-gray-400">₹{actualFees.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Fee Payment History</p>
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
            {payments.length} payment{payments.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
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
            {payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">
                  No fee payments recorded yet
                </td>
              </tr>
            ) : (
              payments.map((fee, i) => (
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
        <div className="overflow-x-auto">
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
          {inventory.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No inventory assigned to this student</p>
            </div>
          ) : (
            inventory.map((item, i) => (
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
            ))
          )}
        </div>
      </div>

      {inventory.length > 0 && pending.length === 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-5 py-4">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-700">All inventory items have been distributed to this student.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
// ── Admission form PDF generator ───────────────────────────────
function generateAdmissionFormHTML(s, logoUrl) {
  // Page 2: Left col = Birth Certificate + TC; Right col = 3 Aadhar cards (compact)
  const leftDocs = [
    { key: "Birth Certificate",  alwaysShow: true  },
    { key: "Leaving Certificate", alwaysShow: false },
  ];
  const rightDocs = [
    { key: "Student Aadhar Card",  alwaysShow: true },
    { key: "Father's Aadhar Card", alwaysShow: true },
    { key: "Mother's Aadhar Card", alwaysShow: true },
  ];

  const makeDocBlock = ({ key, alwaysShow }, compact = false) => {
    const doc = (s.documents || []).find((d) => d.name === key);
    const uploaded = doc?.uploaded || false;
    if (!alwaysShow && !uploaded) return "";
    const label = key === "Leaving Certificate" ? "Transfer Certificate (TC)" : key;
    const fileRef = doc?.file || "";

    const isRealUrl = fileRef.startsWith("blob:") || fileRef.startsWith("data:") || fileRef.startsWith("http");
    const isImg = isRealUrl
      ? (doc?.type || "").startsWith("image/") || fileRef.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)
      : fileRef.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = isRealUrl && !isImg;

    const imgH = compact ? "110px" : "200px";
    const pdfH = compact ? "120px" : "210px";
    const phH  = compact ? "75px"  : "110px";
    const iconW = compact ? 22 : 28;

    let contentHTML = "";
    if (!uploaded) {
      contentHTML = `<div style="height:50px;background:#fafafa;border:1px dashed #e5e7eb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:9px;">Document not submitted yet</div>`;
    } else if (isRealUrl && isImg) {
      contentHTML = `<img src="${fileRef}" style="max-width:100%;max-height:${imgH};object-fit:contain;border-radius:6px;border:1px solid #e5e7eb;display:block;margin:0 auto;" />`;
    } else if (isRealUrl && isPdf) {
      contentHTML = `<embed src="${fileRef}" type="application/pdf" style="width:100%;height:${pdfH};border-radius:6px;border:1px solid #e5e7eb;" />`;
    } else {
      contentHTML = `
        <div style="height:${phH};background:#f8fafc;border:2px dashed #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;">
          <svg width="${iconW}" height="${iconW}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <div style="font-size:${compact ? 9 : 10}px;font-weight:600;color:#64748b;">${fileRef}</div>
          <div style="font-size:8px;color:#94a3b8;">Preview available after Supabase integration</div>
        </div>`;
    }

    return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:10px;">
      <div style="background:${uploaded ? "#eff6ff" : "#fef2f2"};padding:6px 10px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:9.5px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.4px;">${label}</span>
        <span style="font-size:8.5px;font-weight:700;padding:2px 7px;border-radius:10px;background:${uploaded ? "#dcfce7" : "#fee2e2"};color:${uploaded ? "#166534" : "#991b1b"};">${uploaded ? "Submitted" : "Not Submitted"}</span>
      </div>
      <div style="padding:8px 10px;">${contentHTML}</div>
    </div>`;
  };

  const leftColHTML  = leftDocs.map((d) => makeDocBlock(d, false)).filter(Boolean).join("");
  const rightColHTML = rightDocs.map((d) => makeDocBlock(d, true)).filter(Boolean).join("");

  const docBlocksHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div>${leftColHTML}</div><div>${rightColHTML}</div></div>`;

  const discountBlock = s.discount?.applied
    ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;margin-top:8px;">
         <div style="font-size:8.5px;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Fees Discount Applied</div>
         <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">
           <div><div style="font-size:8px;color:#aaa;text-transform:uppercase;">Amount</div><div style="font-size:11px;font-weight:700;color:#222;">&#8377;${s.discount.amount.toLocaleString("en-IN")}</div></div>
           <div><div style="font-size:8px;color:#aaa;text-transform:uppercase;">Reason</div><div style="font-size:11px;font-weight:700;color:#222;">${s.discount.reason}</div></div>
         </div>
       </div>`
    : "";

  const logoTag = logoUrl
    ? `<img src="${logoUrl}" style="width:50px;height:50px;object-fit:contain;border-radius:6px;flex-shrink:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Admission Form - ${s.studentName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;font-size:11px;color:#333;background:#fff;}
  .page{width:210mm;padding:10mm 14mm;page-break-after:always;}
  .page:last-child{page-break-after:avoid;}
  @media print{body{margin:0;}.page{page-break-after:always;}.page:last-child{page-break-after:avoid;}}
  .hdr{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:10px;}
  .hdr-text{flex:1;}
  .school-name{font-size:15px;font-weight:900;color:#1e3a5f;}
  .school-sub{font-size:9px;color:#888;margin-top:1px;}
  .form-title{font-size:12px;font-weight:bold;color:#444;margin-top:4px;text-transform:uppercase;letter-spacing:1px;}
  .photo-box{width:75px;height:90px;border:1px solid #aaa;display:flex;align-items:center;justify-content:center;font-size:9px;color:#aaa;text-align:center;flex-shrink:0;border-radius:4px;margin-left:auto;}
  .enroll-bar{background:#1e3a5f;color:white;padding:4px 10px;border-radius:4px;margin-bottom:9px;font-size:10px;display:flex;gap:18px;flex-wrap:wrap;}
  .enroll-bar b{color:#fbbf24;}
  .sec{font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#1e3a5f;background:#eff6ff;padding:3px 8px;border-left:3px solid #1e3a5f;margin:9px 0 5px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;}
  .grid .full{grid-column:1/-1;}
  .field{border-bottom:1px dotted #ddd;padding:3px 1px;}
  .fl{font-size:8px;color:#aaa;text-transform:uppercase;letter-spacing:0.4px;}
  .fv{font-size:11px;font-weight:600;color:#222;min-height:13px;}
  .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px;}
  .sig{border-top:1px solid #bbb;padding-top:4px;text-align:center;font-size:9px;color:#777;}
  .footer{text-align:center;font-size:8px;color:#ccc;margin-top:8px;}
</style>
</head>
<body>

<!-- PAGE 1: ADMISSION FORM -->
<div class="page">
  <div class="hdr">
    ${logoTag}
    <div class="hdr-text">
      <div class="school-name">SATYAM STARS INTERNATIONAL SCHOOL</div>
      <div class="school-sub">Affiliated &middot; Surat, Gujarat &middot; India</div>
      <div class="form-title">Student Admission Form</div>
    </div>
    <div class="photo-box">Student<br/>Photo</div>
  </div>

  <div class="enroll-bar">
    <span>Enrollment: <b>#${s.enrollment}</b></span>
    <span>GR No: <b>${s.grNo || "—"}</b></span>
    <span>Session: <b>${s.session}</b></span>
    <span>Date of Join: <b>${fmtDMY(s.joinDate)}</b></span>
  </div>

  <div class="sec">Class Details</div>
  <div class="grid">
    <div class="field"><div class="fl">Standard</div><div class="fv">${s.std}</div></div>
    <div class="field"><div class="fl">Section</div><div class="fv">${s.section || "—"}</div></div>
    <div class="field"><div class="fl">Roll Number</div><div class="fv">${s.rollNo}</div></div>
  </div>

  <div class="sec">Personal Information</div>
  <div class="grid">
    <div class="field full"><div class="fl">Full Name</div><div class="fv">${s.studentName}</div></div>
    <div class="field"><div class="fl">Father's Name</div><div class="fv">${s.fatherName}</div></div>
    <div class="field"><div class="fl">Mother's Name</div><div class="fv">${s.motherName}</div></div>
    <div class="field"><div class="fl">Date of Birth</div><div class="fv">${fmtDMY(s.dob)}</div></div>
    <div class="field"><div class="fl">Gender</div><div class="fv">${s.gender}</div></div>
    <div class="field"><div class="fl">Religion</div><div class="fv">${s.religion}</div></div>
    <div class="field"><div class="fl">Category / Caste</div><div class="fv">${s.caste}</div></div>
    <div class="field"><div class="fl">Sub Caste</div><div class="fv">${s.subCaste || "—"}</div></div>
    <div class="field"><div class="fl">Mother Tongue</div><div class="fv">${s.motherTongue || "—"}</div></div>
    <div class="field"><div class="fl">Height</div><div class="fv">${s.height ? s.height + " cm" : "—"}</div></div>
    <div class="field"><div class="fl">Weight</div><div class="fv">${s.weight ? s.weight + " kg" : "—"}</div></div>
    <div class="field"><div class="fl">Place of Birth</div><div class="fv">${s.placeOfBirth}</div></div>
    <div class="field"><div class="fl">Birth State</div><div class="fv">${s.birthState || "—"}</div></div>
    <div class="field"><div class="fl">Birth District</div><div class="fv">${s.birthDistrict || "—"}</div></div>
    <div class="field"><div class="fl">Birth City</div><div class="fv">${s.birthCity || "—"}</div></div>
  </div>

  <div class="sec">Contact &amp; Address</div>
  <div class="grid">
    <div class="field"><div class="fl">Mobile 1</div><div class="fv">${s.mobile1}</div></div>
    <div class="field"><div class="fl">Mobile 2</div><div class="fv">${s.mobile2 || "—"}</div></div>
    <div class="field"><div class="fl">Society</div><div class="fv">${s.society || "—"}</div></div>
    <div class="field"><div class="fl">Landmark</div><div class="fv">${s.landmark || "—"}</div></div>
    <div class="field"><div class="fl">Area</div><div class="fv">${s.area || "—"}</div></div>
    <div class="field"><div class="fl">Pin Code</div><div class="fv">${s.pinCode || "—"}</div></div>
    <div class="field full"><div class="fl">Address</div><div class="fv">${s.roomPlotNo ? s.roomPlotNo + ", " : ""}${s.address}</div></div>
  </div>

  <div class="sec">Previous School</div>
  <div class="grid">
    <div class="field full"><div class="fl">School Name</div><div class="fv">${s.lastSchoolName || "—"}</div></div>
    <div class="field"><div class="fl">Last School GR No</div><div class="fv">${s.lastSchoolGrNo || "—"}</div></div>
    <div class="field"><div class="fl">Last Class</div><div class="fv">${s.lastSchoolClass || "—"}</div></div>
    <div class="field"><div class="fl">Medium</div><div class="fv">${s.lastSchoolMedium || "—"}</div></div>
    <div class="field"><div class="fl">School Location</div><div class="fv">${s.lastSchoolPlace || "—"}</div></div>
    <div class="field"><div class="fl">Attendance Days</div><div class="fv">${s.prevAttendanceDays || "—"}</div></div>
    <div class="field"><div class="fl">Last Exam Given</div><div class="fv">${s.lastExamGiven || "—"}</div></div>
    <div class="field"><div class="fl">Previous Percentage</div><div class="fv">${s.prevPercentage || "—"}</div></div>
  </div>

  <div class="sec">Aadhar &amp; Government IDs</div>
  <div class="grid">
    <div class="field"><div class="fl">Aadhar Number</div><div class="fv">${s.aadhar || "Not Provided"}</div></div>
    <div class="field"><div class="fl">Name on Aadhar</div><div class="fv">${s.aadharName || "—"}</div></div>
    <div class="field"><div class="fl">Father&apos;s Aadhar No</div><div class="fv">${s.fatherAadhar || "—"}</div></div>
    <div class="field"><div class="fl">Father&apos;s Name (Aadhar)</div><div class="fv">${s.fatherAadharName || "—"}</div></div>
    <div class="field"><div class="fl">Mother&apos;s Aadhar No</div><div class="fv">${s.motherAadhar || "—"}</div></div>
    <div class="field"><div class="fl">Mother&apos;s Name (Aadhar)</div><div class="fv">${s.motherAadharName || "—"}</div></div>
    <div class="field"><div class="fl">UDISE Number</div><div class="fv">${s.udise || "—"}</div></div>
    <div class="field"><div class="fl">PEN Number</div><div class="fv">${s.pen || "—"}</div></div>
    <div class="field"><div class="fl">APAAR ID</div><div class="fv">${s.apaar || "—"}</div></div>
    <div class="field"><div class="fl">Birth Cert Reg No</div><div class="fv">${s.birthCertRegNo || "—"}</div></div>
    <div class="field"><div class="fl">Birth Cert Reg Date</div><div class="fv">${s.birthCertRegDate || "—"}</div></div>
  </div>

  ${discountBlock}

  <div class="sigs">
    <div class="sig">Parent / Guardian Signature</div>
    <div class="sig">Class Teacher</div>
    <div class="sig">Principal</div>
  </div>
  <div class="footer">Satyam Stars International School &middot; Surat, Gujarat &middot; ${s.session} Academic Year</div>
</div>

<!-- PAGE 2: DOCUMENTS -->
<div class="page">
  <div class="hdr">
    ${logoTag}
    <div class="hdr-text">
      <div class="school-name">SATYAM STARS INTERNATIONAL SCHOOL</div>
      <div class="school-sub">Affiliated &middot; Surat, Gujarat &middot; India</div>
      <div class="form-title">Document Submission Record</div>
    </div>
  </div>

  <div style="font-size:11px;color:#555;margin-bottom:12px;">
    Student: <b>${s.studentName}</b> &nbsp;|&nbsp; Enrollment: <b>#${s.enrollment}</b> &nbsp;|&nbsp; Session: <b>${s.session}</b>
  </div>

  ${docBlocksHTML}

  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-top:6px;">
    <div style="font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Declaration</div>
    <p style="font-size:10px;color:#555;line-height:1.7;">I hereby declare that all documents submitted are genuine. I undertake to abide by all the rules and regulations of the school.</p>
  </div>

  <div class="sigs" style="margin-top:18px;">
    <div class="sig">Parent / Guardian Signature</div>
    <div class="sig">Date</div>
    <div class="sig">School Stamp &amp; Signature</div>
  </div>
  <div class="footer">Satyam Stars International School &middot; Document Submission Record &middot; ${s.session}</div>
</div>

</body>
</html>`;
}

export default function StudentDetailPage() {
  const { id }       = useParams();
  const router       = useRouter();
  const [activeTab,  setActiveTab]  = useState("personal");
  const [rawStudent, setRawStudent] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStudentByEnrollment(id)
      .then(data => { setRawStudent(data); setLoading(false); })
      .catch(err  => { setLoadError(err.message); setLoading(false); });
  }, [id]);

  // Map DB result to the field names used throughout this page's rendering code
  const student = rawStudent ? {
    ...rawStudent,
    studentName: rawStudent.name,
    mobile1:     rawStudent.mobile,
    joinDate:    rawStudent.dateOfJoin,
    discount: rawStudent.fees.discount > 0 ? {
      applied: true,
      amount:  rawStudent.fees.discount,
      reason:  rawStudent.fees.discountReason,
    } : { applied: false, amount: 0, reason: "" },
    fees:      { ...rawStudent.fees, payments: rawStudent.feePayments },
    attendance: [],
    results:    [],
  } : null;

  const handleDownloadPDF = () => {
    if (!student) return;
    const logoUrl = window.location.origin + "/school-logo.jpg";
    const html = generateAdmissionFormHTML(student, logoUrl);
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups to download the admission form."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading student profile...</p>
      </div>
    );
  }

  if (loadError || !student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <GraduationCap className="w-12 h-12 text-gray-200" />
        <p className="text-gray-500 font-medium">{loadError ? "Failed to load student" : "Student not found"}</p>
        {loadError && <p className="text-xs text-red-400">{loadError}</p>}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download Form
            </button>
            <button
              onClick={() => router.push(`/student/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Edit className="w-3.5 h-3.5" /> Edit Profile
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6">
          <div className="flex gap-5 sm:gap-6">

            {/* Photo Column */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-4 border-school-navy/15 bg-gradient-to-b from-school-navy/5 to-school-navy/10 flex items-center justify-center overflow-hidden shadow-inner">
                <S3Image
                  s3Key={student.photo}
                  alt={student.studentName}
                  className="w-full h-full object-cover"
                  fallback={<User className="w-10 h-10 text-school-navy/25" />}
                />
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
                    <Calendar className="w-3 h-3 text-gray-400" /> {fmtDMY(student.dob)}
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

          {/* Alerts Strip — Docs Pending · Inventory Pending · Discount */}
          {(() => {
            const hasPrevSchool    = !!student.lastSchoolName;
            const docs             = student.documents ?? [];
            const tcUploaded       = docs.some((d) => d.name === "Leaving Certificate" && d.uploaded);
            const bcUploaded       = docs.some((d) => d.name === "Birth Certificate"   && d.uploaded);
            const hasTCWarning     = hasPrevSchool  && !tcUploaded;
            const hasBCWarning     = !hasPrevSchool && !bcUploaded;

            // Exclude from general pending list:
            //  - TC/Marksheet when no prev school (not required)
            //  - Birth Certificate when shown as its own warning (avoid double alert)
            const notRequired = !hasPrevSchool
              ? ["Leaving Certificate", "Marksheet"]
              : [];
            const pendingDocs = docs.filter((d) =>
              !d.uploaded &&
              !notRequired.includes(d.name) &&
              !(hasBCWarning && d.name === "Birth Certificate")
            );
            const pendingInv  = (student.inventory ?? [])
              .filter((i) => bagItemAllowedForClass(i.item, student.std))
              .filter((i) => !i.given);
            const hasDiscount = student.discount?.applied;
            const hasAnything = pendingDocs.length > 0 || pendingInv.length > 0 || hasDiscount || hasTCWarning || hasBCWarning;
            if (!hasAnything) return null;
            return (
              <div className="mt-4 pt-3 border-t border-dashed border-gray-200 space-y-3">

                {/* TC Warning — only when prev school + TC missing */}
                {hasTCWarning && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">TC Not Uploaded</span>
                      <p className="text-[10px] text-red-600 mt-0.5 leading-relaxed">
                        Transfer Certificate is mandatory for students with a previous school. Please submit at the school office immediately.
                      </p>
                    </div>
                  </div>
                )}

                {/* Birth Certificate Warning — only when no prev school + BC missing */}
                {hasBCWarning && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Birth Certificate Not Uploaded</span>
                      <p className="text-[10px] text-red-600 mt-0.5 leading-relaxed">
                        Please submit the Birth Certificate at the school office.
                        <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">TC not required — no previous school</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Documents Pending */}
                {pendingDocs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Docs Pending</span>
                      <span className="ml-1 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {pendingDocs.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingDocs.slice(0, 4).map((doc, i) => (
                        <span key={i} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                          {doc.name}
                        </span>
                      ))}
                      {pendingDocs.length > 4 && (
                        <span className="text-[10px] bg-red-100 text-red-500 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                          +{pendingDocs.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Inventory Pending */}
                {pendingInv.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Inventory Pending</span>
                      <span className="ml-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {pendingInv.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingInv.slice(0, 4).map((item, i) => (
                        <span key={i} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          {item.item}
                        </span>
                      ))}
                      {pendingInv.length > 4 && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          +{pendingInv.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Discount Applied */}
                {hasDiscount && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex-shrink-0">Discount Applied</span>
                    <span className="text-[10px] font-bold text-amber-900 flex-shrink-0">
                      ₹{student.discount.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-amber-600 truncate">· {student.discount.reason}</span>
                  </div>
                )}

              </div>
            );
          })()}

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
          {activeTab === "documents"  && <DocumentsTab  docs={student.documents ?? []} s={student} />}
          {activeTab === "fees"       && <FeesTab       fees={student.fees} />}
          {activeTab === "attendance" && <AttendanceTab attendance={student.attendance ?? []} />}
          {activeTab === "results"    && <ResultsTab    results={student.results ?? []} />}
          {activeTab === "inventory"  && <InventoryTab  inventory={(student.inventory ?? []).filter(i => bagItemAllowedForClass(i.item, student.std))} />}
        </div>
      </div>
    </div>
  );
}
