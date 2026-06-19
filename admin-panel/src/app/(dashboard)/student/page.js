"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useStore from "@/lib/store";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import {
  getStudents as fetchStudentsFromDB,
  deactivateStudent as svcDeactivate,
  promoteStudent as svcPromote,
} from "@/lib/studentService";
import { getActiveClasses } from "@/lib/settingsService";
import {
  Plus, Search, GraduationCap, Phone, Calendar, Edit, Trash2,
  LogOut, Eye, EyeOff, User, ChevronDown, ArrowUpCircle,
  CheckCircle2, X, AlertTriangle, Package, FileText,
  IndianRupee, Check, ArrowLeft, Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isPositiveAmount, isValidLength } from "@/lib/validators";

// ── Session helpers ────────────────────────────────────────────
function getCurrentSession() {
  const now   = new Date();
  const yr    = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 4 ? yr : yr - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

const CURRENT_SESSION = getCurrentSession();

const CLASS_ORDER = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th",
  "6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];

const CLASS_FEES = {
  "JR.KG": 14500, "SR.KG": 14500, "Balvatika": 15000,
  "1st": 15500, "2nd": 15700, "3rd": 15900, "4th": 16200, "5th": 16500,
  "6th": 16800, "7th": 17000, "8th": 17300, "9th": 17500, "10th": 18000,
  "11th - Commerce": 19000, "12th - Commerce": 19000,
};

function getNextClass(cls) {
  const idx = CLASS_ORDER.indexOf(cls);
  return idx < 0 || idx >= CLASS_ORDER.length - 1 ? null : CLASS_ORDER[idx + 1];
}

function calcAge(dobStr) {
  try {
    const dob = new Date(dobStr);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return isNaN(age) ? "—" : age;
  } catch { return "—"; }
}


// Auto-assigned accent colors — cycle automatically for every student added
const ACCENTS = [
  { border:"border-l-blue-500",    hdrFrom:"from-blue-700",    hdrTo:"to-blue-900",   photoBg:"bg-blue-100",    photoIcon:"text-blue-400",    photoBorder:"border-blue-300",    idBg:"bg-blue-50/80"    },
  { border:"border-l-violet-500",  hdrFrom:"from-violet-700",  hdrTo:"to-purple-900", photoBg:"bg-violet-100",  photoIcon:"text-violet-400",  photoBorder:"border-violet-300",  idBg:"bg-violet-50/80"  },
  { border:"border-l-emerald-500", hdrFrom:"from-emerald-700", hdrTo:"to-teal-900",   photoBg:"bg-emerald-100", photoIcon:"text-emerald-400", photoBorder:"border-emerald-300", idBg:"bg-emerald-50/80" },
  { border:"border-l-amber-500",   hdrFrom:"from-amber-600",   hdrTo:"to-orange-800", photoBg:"bg-amber-100",   photoIcon:"text-amber-400",   photoBorder:"border-amber-300",   idBg:"bg-amber-50/80"   },
  { border:"border-l-rose-500",    hdrFrom:"from-rose-600",    hdrTo:"to-pink-900",   photoBg:"bg-rose-100",    photoIcon:"text-rose-400",    photoBorder:"border-rose-300",    idBg:"bg-rose-50/80"    },
];

// ── ID field row ───────────────────────────────────────────────
function IdRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">{label}</p>
      <p className={`text-[13px] font-semibold mt-0.5 leading-tight ${value ? "text-gray-800" : "text-gray-300"}`}>
        {value || "N/A"}
      </p>
    </div>
  );
}

// ── Deactivate modal ───────────────────────────────────────────
const DEACTIVATE_REASONS = [
  "Long term absence",
  "School transfer",
  "Family relocation",
  "Financial reasons",
  "Health issues",
  "Disciplinary action",
  "Parent request",
  "Other",
];

function DeactivateModal({ student, onClose, onConfirm }) {
  const todayVal = new Date().toISOString().split("T")[0];
  const [reason, setReason]           = useState("");
  const [customReason, setCustomReason] = useState("");
  const [date, setDate]               = useState(todayVal);

  const finalReason = reason === "Other" ? customReason.trim() : reason;
  const customReasonValid = reason !== "Other" || isValidLength(customReason, 200, 1);
  const canSubmit   = finalReason && date && customReasonValid;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-red-700 px-5 py-4 flex items-center justify-between">
          <p className="text-white font-bold">Deactivate Student</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Deactivating <span className="font-bold text-gray-900">{student.name}</span>. Student will be marked inactive and hidden from active lists.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Reason for Deactivation <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => { setReason(e.target.value); setCustomReason(""); }}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 bg-white cursor-pointer"
              >
                <option value="">Select a reason...</option>
                {DEACTIVATE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {reason === "Other" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Specify Reason <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={200}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
              />
              {!customReasonValid && (
                <p className="text-xs text-red-500 mt-1">Reason must be 1-200 characters.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date of Deactivation <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={date}
              max={todayVal}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => canSubmit && onConfirm({ reason: finalReason, date })}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
            >
              Confirm Deactivate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Promote modal ──────────────────────────────────────────────
const PROMOTE_DISCOUNT_REASONS = [
  "Financial Weak", "3 Kids", "Fatherless Student", "Relative",
  "Early Fees Complete", "Early Admission", "Old Student", "Other",
];

function PromoteModal({ student, onClose, onPromote, router }) {
  const nextClass          = getNextClass(student.std);
  const uniformFees        = useStore(s => s.uniformFees);
  const uniformFee         = (nextClass && uniformFees[nextClass]) ? uniformFees[nextClass] : 1500;
  const oldStudentFixedAmt = useStore(s => s.oldStudentDiscount) ?? 1000;

  // step: "action" → choose promote or leave | "discount" → fill discounts then confirm
  const [step, setStep] = useState("action");

  const [oldStudentOn,     setOldStudentOn]     = useState(true);
  const [oldStudentType,   setOldStudentType]   = useState("fixed"); // "fixed" | "custom"
  const [oldStudentCustom, setOldStudentCustom] = useState("");
  const [uniformReqd,  setUniformReqd]  = useState(true);
  const [extraOn,      setExtraOn]      = useState(false);
  const [extraAmount,  setExtraAmount]  = useState("");
  const [extraReason,  setExtraReason]  = useState("");
  const [extraCustom,  setExtraCustom]  = useState("");

  const oldStudentAmt = oldStudentOn
    ? (oldStudentType === "fixed" ? oldStudentFixedAmt : (Number(oldStudentCustom) || 0))
    : 0;

  const totalDiscount =
    oldStudentAmt +
    (!uniformReqd  ? uniformFee : 0) +
    (extraOn && extraAmount ? Number(extraAmount) : 0);

  const oldStudentValid = !oldStudentOn || oldStudentType === "fixed" || (oldStudentType === "custom" && !!oldStudentCustom);
  const extraAmountValid = !extraOn || isPositiveAmount(extraAmount, 100000);
  const extraValid = oldStudentValid && extraAmountValid &&
    (!extraOn || (extraAmount && extraReason && (extraReason !== "Other" || extraCustom)));

  const handleConfirmPromote = async () => {
    if (!extraValid) return;
    const discReason = oldStudentOn
      ? "Old Student Discount"
      : extraOn ? (extraReason === "Other" ? extraCustom : extraReason) : "";
    try {
      await onPromote({ discount: totalDiscount, discountReason: discReason });
      const enr = encodeURIComponent(student.enrollment);
      const std = encodeURIComponent(nextClass);
      router.push("/fees?enrollment=" + enr + "&std=" + std + "&promoted=1");
    } catch {
      // error already shown via alert in handlePromote
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-school-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === "discount" && (
              <button
                onClick={() => setStep("action")}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <p className="text-white font-bold">
              {step === "action" ? "Year-End Student Action" : "Fee Discount — New Session"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── STEP 1: Choose action ── */}
        {step === "action" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600 mb-1">
              Select action for <span className="font-bold text-gray-900">{student.name}</span>:
            </p>

            {nextClass ? (
              <button
                onClick={() => setStep("discount")}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-50 border-2 border-green-200 hover:bg-green-100 hover:border-green-400 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <ArrowUpCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">Promote to Next Class</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Move to <b>{nextClass}</b> · Session <b>{CURRENT_SESSION}</b>
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700"><b>{student.std}</b> is the highest class — cannot promote further.</p>
              </div>
            )}

            <button
              onClick={() => { onClose(); router.push(`/student/${student.enrollment}/tc`); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-50 border-2 border-red-200 hover:bg-red-100 hover:border-red-400 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800">Leave School</p>
                <p className="text-xs text-red-600 mt-0.5">Generate Transfer Certificate (TC)</p>
              </div>
            </button>

            <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* ── STEP 2: Discount section ── */}
        {step === "discount" && (
          <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <p className="text-xs text-gray-500">
              Promoting <span className="font-semibold text-gray-800">{student.name}</span> → <span className="font-semibold text-school-navy">{nextClass}</span>
            </p>

            {/* Discount card */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden">

              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2">
                <IndianRupee className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Fee Discounts</p>
                {totalDiscount > 0 && (
                  <span className="ml-auto text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    ₹{totalDiscount.toLocaleString("en-IN")}
                  </span>
                )}
              </div>

              <div className="divide-y divide-gray-50">

                {/* 1 — Old Student */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setOldStudentOn((v) => !v); setOldStudentCustom(""); }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${oldStudentOn ? "bg-school-navy border-school-navy" : "border-gray-300"}`}
                    >
                      {oldStudentOn && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Old Student Discount</p>
                      <p className="text-[11px] text-gray-400">Returning student — selected by default</p>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${oldStudentOn ? "text-green-700" : "text-gray-300 line-through"}`}>
                      {oldStudentOn
                        ? (oldStudentType === "fixed"
                            ? `₹${oldStudentFixedAmt.toLocaleString("en-IN")}`
                            : (oldStudentCustom ? `₹${Number(oldStudentCustom).toLocaleString("en-IN")}` : "—"))
                        : `₹${oldStudentFixedAmt.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                  {oldStudentOn && (
                    <div className="mt-2 pl-8 space-y-2">
                      <div className="flex gap-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={oldStudentType === "fixed"}
                            onChange={() => { setOldStudentType("fixed"); setOldStudentCustom(""); }}
                            className="w-3.5 h-3.5 accent-school-navy"
                          />
                          <span className="text-xs font-semibold text-gray-700">Fixed — ₹{oldStudentFixedAmt.toLocaleString("en-IN")}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={oldStudentType === "custom"}
                            onChange={() => setOldStudentType("custom")}
                            className="w-3.5 h-3.5 accent-school-navy"
                          />
                          <span className="text-xs font-semibold text-gray-700">Custom Amount</span>
                        </label>
                      </div>
                      {oldStudentType === "custom" && (
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">₹</span>
                          <input
                            type="number"
                            placeholder="Enter discount amount"
                            value={oldStudentCustom}
                            onChange={(e) => setOldStudentCustom(e.target.value)}
                            min="0"
                            className="w-full pl-7 pr-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2 — Uniform */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Uniform This Year</p>
                      <p className="text-[11px] text-gray-400">If not required, ₹{uniformFee.toLocaleString("en-IN")} discount applies</p>
                    </div>
                    {!uniformReqd && (
                      <span className="text-sm font-bold text-green-700 flex-shrink-0">₹{uniformFee.toLocaleString("en-IN")}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {["Required", "Not Required"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setUniformReqd(opt === "Required")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          (opt === "Required" && uniformReqd) || (opt === "Not Required" && !uniformReqd)
                            ? "bg-school-navy text-white border-school-navy"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 — Extra Discount */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      type="button"
                      onClick={() => { setExtraOn((v) => !v); setExtraAmount(""); setExtraReason(""); setExtraCustom(""); }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${extraOn ? "bg-school-navy border-school-navy" : "border-gray-300"}`}
                    >
                      {extraOn && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">Extra Discount</p>
                      <p className="text-[11px] text-gray-400">Additional amount set by admin</p>
                    </div>
                    {extraOn && extraAmount && (
                      <span className="text-sm font-bold text-green-700 flex-shrink-0">
                        ₹{Number(extraAmount).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  {extraOn && (
                    <div className="space-y-2 pl-8 pt-1">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">₹</span>
                        <input
                          type="number"
                          placeholder="Enter discount amount"
                          value={extraAmount}
                          onChange={(e) => setExtraAmount(e.target.value)}
                          min="0"
                          max="100000"
                          className="w-full pl-7 pr-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                        />
                      </div>
                      {!extraAmountValid && (
                        <p className="text-xs text-red-500">Enter a valid amount between ₹1 and ₹1,00,000.</p>
                      )}
                      <div className="relative">
                        <select
                          value={extraReason}
                          onChange={(e) => { setExtraReason(e.target.value); setExtraCustom(""); }}
                          className="w-full appearance-none pl-3.5 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer"
                        >
                          <option value="">Select Reason</option>
                          {PROMOTE_DISCOUNT_REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      {extraReason === "Other" && (
                        <input
                          type="text"
                          placeholder="Enter custom reason..."
                          value={extraCustom}
                          onChange={(e) => setExtraCustom(e.target.value)}
                          className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Total row */}
              {totalDiscount > 0 && (
                <div className="bg-green-50 border-t border-green-100 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Total Discount</span>
                  <span className="text-sm font-bold text-green-800">₹{totalDiscount.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>

            {/* Confirm promote */}
            <button
              onClick={handleConfirmPromote}
              disabled={!extraValid}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-50 border-2 border-green-200 hover:bg-green-100 hover:border-green-400 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <ArrowUpCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-800">Confirm Promote to {nextClass}</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Session <b>{CURRENT_SESSION}</b>
                  {totalDiscount > 0 && <> · Discount: <b>₹{totalDiscount.toLocaleString("en-IN")}</b></>}
                </p>
              </div>
            </button>

            <button onClick={() => setStep("action")} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function StudentPage() {
  const router           = useRouter();
  const readmissionDate  = useStore(s => s.readmissionDate);
  const canPromote       = !!(readmissionDate && new Date() >= new Date(readmissionDate));

  const [activeClassNames, setActiveClassNames] = useState([]);
  const [session, setSession]             = useState(CURRENT_SESSION);
  const [search, setSearch]               = useState("");
  const [stdFilter, setStdFilter]         = useState("All Classes");
  const [docFilter, setDocFilter]         = useState("All");
  const [govtIdFilter, setGovtIdFilter]   = useState([]);
  const [showPasswords, setShowPasswords] = useState({});
  const [students, setStudents]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState(null);
  const [academicYears, setAcademicYears]     = useState([]);
  const [selectedYearId, setSelectedYearId]   = useState(null);
  const [promoteModal, setPromoteModal]       = useState(null);
  const [deactivateModal, setDeactivateModal] = useState(null);


  const togglePw = (enr) => setShowPasswords((p) => ({ ...p, [enr]: !p[enr] }));

  // Load academic years + active classes on mount
  useEffect(() => {
    supabase
      .from("academic_years")
      .select("id, label, is_current, start_date")
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAcademicYears(data);
          const current = data.find(y => y.is_current) || data[0];
          setSelectedYearId(current.id);
          setSession(current.label);
        }
      });
    getActiveClasses().then(cls => setActiveClassNames(cls.map(c => c.name))).catch(() => {});
  }, []);

  // Fetch students when year changes
  useEffect(() => {
    if (!selectedYearId) return;
    setLoading(true);
    setLoadError(null);
    fetchStudentsFromDB(selectedYearId)
      .then(data => { setStudents(data); setLoading(false); })
      .catch(err  => { setLoadError(err.message); setLoading(false); });
  }, [selectedYearId]);

  const allStandards = [
    "All Classes",
    ...CLASS_ORDER.filter(c => activeClassNames.includes(c)),
  ];

  const DOC_FILTER_OPTIONS = [
    { key: "Leaving Certificate",  label: "TC" },
    { key: "Birth Certificate",    label: "Birth Certificate" },
    { key: "Student Aadhar Card",  label: "Student Aadhar" },
    { key: "Father's Aadhar Card", label: "Father's Aadhar" },
    { key: "Mother's Aadhar Card", label: "Mother's Aadhar" },
    { key: "Marksheet",            label: "Marksheet" },
  ];

  const GOVTID_FILTER_OPTIONS = [
    { key: "udise", label: "UDISE" },
    { key: "pen",   label: "PEN"   },
    { key: "apaar", label: "APAAR" },
  ];

  // Students are already filtered by year from DB; just exclude Left status
  const sessionStudents = students.filter(s => s.status !== "Left");

  const filtered = sessionStudents.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.enrollment.includes(search) ||
      s.fatherName.toLowerCase().includes(search.toLowerCase());
    const matchStd    = stdFilter === "All Classes" || s.std === stdFilter;
    const matchDoc    = docFilter === "All" || (s.pendingDocs || []).includes(docFilter);
    const matchGovtId = govtIdFilter.length === 0 || govtIdFilter.some(k => !(s[k] && s[k].trim()));
    return matchSearch && matchStd && matchDoc && matchGovtId;
  });

  const handleDeactivate = async (student, { reason, date }) => {
    try {
      await svcDeactivate(student._studentId, student._enrollmentId, reason, date);
      setDeactivateModal(null);
      if (selectedYearId) {
        const data = await fetchStudentsFromDB(selectedYearId);
        setStudents(data);
      }
    } catch (err) {
      alert("Could not deactivate student: " + err.message);
    }
  };

  const handlePromote = async (student, discountData = {}) => {
    const nextClass = getNextClass(student.std);
    if (!nextClass) return;
    const fTotal = student.fees?.total ?? 0;
    const fDisc  = student.fees?.discount ?? 0;
    const fPaid  = student.fees?.paid ?? 0;
    if (Math.max(fTotal - fDisc, 0) > fPaid) return;
    const { discount = 0, discountReason = "" } = discountData;
    try {
      await svcPromote(student._studentId, student._enrollmentId, nextClass, {
        feeTotal:      CLASS_FEES[nextClass] ?? 0,
        totalDiscount: discount,
        reason:        discountReason,
      });
      setPromoteModal(null);
      if (selectedYearId) {
        fetchStudentsFromDB(selectedYearId).then(data => setStudents(data));
      }
    } catch (err) {
      alert("Could not promote student: " + err.message);
      throw err;
    }
  };

  function doExportExcel() {
    const today = new Date().toLocaleDateString("en-IN");
    const activeIdLabels = govtIdFilter.length > 0
      ? `Pending: ${govtIdFilter.map(k => k.toUpperCase()).join(", ")}`
      : "All Students";
    const rows = [
      ["Satyam Stars International School"],
      ["Surat, Gujarat  |  GSEB Board  |  English Medium"],
      [`Student List  |  Session: ${session}  |  ${activeIdLabels}`],
      [`Generated: ${today}`, "", `Total Records: ${filtered.length}`],
      [],
      ["#","Enroll No","Student Name","Class","Father Name","Mobile","Aadhar","UDISE","PEN","APAAR","Pending Docs"],
      ...filtered.map((s, i) => [
        i+1, s.enrollment, s.name,
        s.std + (s.section ? " - "+s.section : ""),
        s.fatherName, s.mobile,
        s.aadhar || "-",
        s.udise  || "Pending",
        s.pen    || "Pending",
        s.apaar  || "Pending",
        (s.pendingDocs || []).join(", ") || "None",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [4,10,20,12,18,14,16,16,16,16,30].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `Students_${session.replace("-","_")}_${today}.xlsx`);
  }

  function doExportPDF() {
    const today = new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
    const doc = new jsPDF({ orientation:"landscape" });
    const w = doc.internal.pageSize.getWidth();

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
    doc.text("STUDENT LIST", w/2, 27, {align:"center"});

    doc.setTextColor(60,60,60); doc.setFontSize(8); doc.setFont("helvetica","normal");
    let y = 36;
    doc.text(`Session: ${session}   |   Generated: ${today}   |   Total Records: ${filtered.length}`, 14, y); y += 5;
    if (govtIdFilter.length > 0) {
      doc.text(`Pending ID Filter: ${govtIdFilter.map(k => k.toUpperCase()).join(", ")}`, 14, y); y += 5;
    }
    if (stdFilter !== "All Classes") { doc.text(`Class Filter: ${stdFilter}`, 14, y); y += 5; }

    autoTable(doc, {
      startY: y + 2,
      head: [["#","Enroll No","Student Name","Class","Father Name","Mobile","Aadhar","UDISE","PEN","APAAR"]],
      body: filtered.map((s, i) => [
        i+1, s.enrollment, s.name,
        s.std + (s.section ? "-"+s.section : ""),
        s.fatherName, s.mobile,
        s.aadhar  || "-",
        s.udise   || "Pending",
        s.pen     || "Pending",
        s.apaar   || "Pending",
      ]),
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
        doc.text("Satyam Stars International School  |  Confidential", 14, ph-7);
        doc.text(`Page ${pn}  |  Generated: ${today}`, pw-14, ph-7, {align:"right"});
      },
    });

    doc.save(`Students_${session.replace("-","_")}_${today}.pdf`);
  }

  return (
    <>
      {promoteModal && (
        <PromoteModal
          student={promoteModal}
          onClose={() => setPromoteModal(null)}
          onPromote={(discountData) => handlePromote(promoteModal, discountData)}
          router={router}
        />
      )}
      {deactivateModal && (
        <DeactivateModal
          student={deactivateModal}
          onClose={() => setDeactivateModal(null)}
          onConfirm={(data) => handleDeactivate(deactivateModal, data)}
        />
      )}

      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""} · Session {session}
              <span className="ml-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Current: {CURRENT_SESSION}
              </span>
            </p>
          </div>
          <Link
            href="/student/add"
            className="inline-flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add New Student
          </Link>
        </div>

        {/* ── Promotion Period Banner ── */}
        {canPromote && session !== CURRENT_SESSION && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">Re-admission Period Open</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Re-admission date is <span className="font-semibold">{readmissionDate}</span>. Promote button is now visible on eligible student cards.
              </p>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, enrollment or father's name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-all"
              />
            </div>
            <div className="relative">
              <select value={stdFilter} onChange={(e) => setStdFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer">
                {allStandards.map((s) => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={session}
                onChange={(e) => {
                  const yr = academicYears.find(y => y.label === e.target.value);
                  if (yr) { setSession(yr.label); setSelectedYearId(yr.id); }
                }}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer font-medium text-school-navy">
                {academicYears.map((yr) => (
                  <option key={yr.id} value={yr.label}>
                    Session {yr.label}{yr.is_current ? " (Current)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-school-navy pointer-events-none" />
            </div>
          </div>

          {/* ── Pending Document Filter Chips ── */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5 border-t border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex-shrink-0">
              Pending Doc:
            </span>
            <button
              onClick={() => setDocFilter("All")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                docFilter === "All"
                  ? "bg-school-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Students
            </button>
            {DOC_FILTER_OPTIONS.map(({ key, label }) => {
              const count = sessionStudents.filter((s) =>
                (s.pendingDocs || []).includes(key)
              ).length;
              if (count === 0) return null;
              const active = docFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setDocFilter(active ? "All" : key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? "bg-school-navy text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active ? "bg-white/25 text-white" : "bg-red-100 text-red-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {docFilter !== "All" && (
              <button
                onClick={() => setDocFilter("All")}
                className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* ── Pending Govt ID Filter Chips (multi-select) ── */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5 border-t border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex-shrink-0">
              Pending ID:
            </span>
            {GOVTID_FILTER_OPTIONS.map(({ key, label }) => {
              const count  = sessionStudents.filter((s) => !(s[key] && s[key].trim())).length;
              const active = govtIdFilter.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => setGovtIdFilter(prev =>
                    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                  )}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? "bg-purple-700 text-white"
                      : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {label} Pending
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active ? "bg-white/25 text-white" : "bg-purple-100 text-purple-700"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {govtIdFilter.length > 0 && (
              <button
                onClick={() => setGovtIdFilter([])}
                className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Export Bar ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{filtered.length}</span> student{filtered.length !== 1 ? "s" : ""}
            {govtIdFilter.length > 0 && (
              <span className="ml-2 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Pending: {govtIdFilter.map(k => k.toUpperCase()).join(", ")}
              </span>
            )}
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

        {/* ── Student Cards ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="w-10 h-10 border-4 border-school-navy/20 border-t-school-navy rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading students...</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-16 text-center">
            <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-600 font-medium">Failed to load students</p>
            <p className="text-sm text-red-400 mt-1">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
            <GraduationCap className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No students found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting filters or add a new student</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((student, idx) => {
              const a             = ACCENTS[idx % ACCENTS.length];
              const pwVisible     = showPasswords[student.enrollment] || false;
              const isPromoted      = !!student.promotedTo;
              const feeTotal        = student.fees?.total ?? 0;
              const feeDiscount     = student.fees?.discount ?? 0;
              const feePaid         = student.fees?.paid ?? 0;
              const hasPendingFees  = Math.max(feeTotal - feeDiscount, 0) > feePaid;

              return (
                <div
                  key={student.enrollment}
                  className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${a.border} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
                >
                  {/* ── Header strip ── */}
                  <div className={`bg-gradient-to-r ${a.hdrFrom} ${a.hdrTo} px-5 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-white/50 text-[10px] uppercase tracking-widest font-medium">Enroll No.</span>
                      <span className="text-yellow-300 font-bold text-sm font-mono">#{student.enrollment}</span>
                      <span className="text-white/25">·</span>
                      <span className="text-white/55 text-xs">Session {student.session}</span>
                    </div>
                    {isPromoted ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-400/20 text-blue-200">
                        Promoted → {student.promotedTo.std}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        student.status === "Active" ? "bg-green-400/20 text-green-300" : "bg-red-400/20 text-red-300"
                      }`}>
                        {student.status}
                      </span>
                    )}
                  </div>

                  {/* ── 6-Column Grid Body ── */}
                  <div className="grid" style={{ gridTemplateColumns: "148px 1fr 155px 185px 175px 205px" }}>

                    {/* ── Column 1: Photo — full card height ── */}
                    <div className={`relative overflow-hidden border-r border-gray-100 ${a.photoBg}`} style={{ minHeight: "168px" }}>
                      {student.photo ? (
                        <img src={student.photo} alt={student.name} className="w-full h-full object-cover absolute inset-0" />
                      ) : (
                        <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <User className={`w-14 h-14 ${a.photoIcon}`} />
                          <span className={`text-[10px] font-bold tracking-widest uppercase ${a.photoIcon} opacity-40`}>Photo</span>
                        </div>
                      )}
                    </div>

                    {/* ── Column 2: Basic Details ── */}
                    <div className="px-4 py-4 space-y-2.5 border-r border-gray-100 min-w-0">

                      {/* Name */}
                      <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{student.name}</h3>

                      {/* Class badge + Roll No side-by-side */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-school-navy bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md">
                          <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                          {student.std}{student.section ? ` - ${student.section}` : ""}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                          Roll {student.rollNo}
                        </span>
                      </div>

                      {/* Father & Mother — one row, two boxes */}
                      <div className="flex items-stretch min-w-0 rounded-lg overflow-hidden border border-gray-100">
                        <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Father</p>
                          <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{student.fatherName}</p>
                        </div>
                        <div className="w-px bg-gray-200" />
                        <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Mother</p>
                          <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{student.motherName}</p>
                        </div>
                      </div>

                      {/* GR No + Date of Join — one row */}
                      <div className="flex items-stretch min-w-0 rounded-lg overflow-hidden border border-gray-100">
                        <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50/60">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">GR No</p>
                          <p className="text-[13px] font-bold text-school-navy leading-tight">{student.grNo || "—"}</p>
                        </div>
                        <div className="w-px bg-gray-200" />
                        <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50/60">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Date of Join</p>
                          <p className="text-[13px] font-semibold text-gray-700 leading-tight">{student.dateOfJoin || "—"}</p>
                        </div>
                      </div>

                      {/* Mobile — labeled */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide flex-shrink-0">Mobile</span>
                        <span className="text-[13px] font-medium text-gray-700">{student.mobile}</span>
                      </div>

                      {/* DOB — labeled */}
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide flex-shrink-0">DOB</span>
                        <span className="text-[13px] font-medium text-gray-700">
                          {student.dob} · Age <b className="text-gray-900">{calcAge(student.dob)}</b> · {student.gender}
                        </span>
                      </div>
                    </div>

                    {/* ── Column 3: IDs & Password ── */}
                    <div className={`px-5 py-4 ${a.idBg} space-y-3 border-r border-gray-100`}>
                      <IdRow label="Aadhar" value={student.aadhar} />
                      <IdRow label="UDISE"  value={student.udise}  />
                      <IdRow label="PEN No" value={student.pen}    />
                      <IdRow label="APAAR"  value={student.apaar}  />

                      {/* Password — single clickable pill */}
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mb-1.5">
                          App Password
                        </p>
                        <button
                          onClick={() => togglePw(student.enrollment)}
                          className="inline-flex items-center gap-2 bg-white/80 hover:bg-white border border-white/60 hover:border-gray-200 rounded-lg px-2.5 py-1.5 transition-all shadow-sm"
                        >
                          <span className="text-[13px] font-bold text-gray-800 font-mono">
                            {pwVisible ? student.password : "••••••••"}
                          </span>
                          {pwVisible
                            ? <EyeOff className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            : <Eye    className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* ── Column 4 (NEW): Alerts ── */}
                    <div className="px-3 py-4 border-r border-gray-100 space-y-2.5 bg-white">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Alerts</p>

                      {/* Critical doc warning — TC for transfer students, Birth Cert for fresh */}
                      {student.lastSchoolName ? (
                        !student.tcUploaded && (
                          <div className="flex items-start gap-1.5 bg-red-50 border border-red-300 rounded-lg px-2 py-1.5">
                            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-red-600 leading-tight uppercase tracking-wide">TC Not Uploaded</p>
                              <p className="text-[9px] text-red-500 leading-tight mt-0.5">Transfer Certificate required</p>
                            </div>
                          </div>
                        )
                      ) : (
                        !student.birthCertUploaded && (
                          <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2 py-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-amber-700 leading-tight uppercase tracking-wide">Birth Cert Missing</p>
                              <p className="text-[9px] text-amber-600 leading-tight mt-0.5">Birth Certificate required</p>
                            </div>
                          </div>
                        )
                      )}

                      {/* Document status */}
                      {student.pendingDocs.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-red-400 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide leading-none">Docs Pending</span>
                            <span className="ml-auto text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {student.pendingDocs.length}
                            </span>
                          </div>
                          {student.pendingDocs.map((d) => (
                            <p key={d} className="text-[11px] text-gray-500 leading-tight truncate pl-0.5">· {d}</p>
                          ))}
                        </div>
                      ) : student.documents.length === 0 ? (
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-gray-400">No Docs</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-green-600">All Docs OK</span>
                        </div>
                      )}

                      <div className="w-full h-px bg-gray-100" />

                      {/* Inventory status */}
                      {student.pendingInventory.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide leading-none">Items Pending</span>
                            <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {student.pendingInventory.length}
                            </span>
                          </div>
                          {student.pendingInventory.map((d) => (
                            <p key={d} className="text-[11px] text-gray-500 leading-tight truncate pl-0.5">· {d}</p>
                          ))}
                        </div>
                      ) : student.inventory.length === 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-gray-400">No Inventory</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-green-600">All Given</span>
                        </div>
                      )}
                    </div>

                    {/* ── Column 5: Fee Summary ── */}
                    {(() => {
                      const gross    = student.fees?.total    ?? 0;
                      const discount = student.fees?.discount ?? 0;
                      const actual   = Math.max(gross - discount, 0);
                      const paid     = student.fees?.paid     ?? 0;
                      const due      = Math.max(actual - paid, 0);
                      const paidPct  = actual > 0 ? Math.round((paid / actual) * 100) : 0;
                      const cleared  = due === 0;
                      return (
                        <div className="px-4 py-4 bg-gray-50/60 border-r border-gray-100 flex flex-col justify-between gap-3">
                          <div className="space-y-2.5">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Fee Summary</p>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Fees</p>
                              <p className="text-[13px] font-bold text-gray-800 mt-0.5">
                                ₹{actual.toLocaleString("en-IN")}
                              </p>
                              {discount > 0 && (
                                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                  ₹{gross.toLocaleString("en-IN")} - ₹{discount.toLocaleString("en-IN")} discount
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Paid</p>
                              <p className="text-[13px] font-bold text-green-700 mt-0.5">
                                ₹{paid.toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Balance Due</p>
                              <p className={`text-[13px] font-bold mt-0.5 ${cleared ? "text-green-600" : "text-red-600"}`}>
                                {cleared ? "Cleared ✓" : `₹${due.toLocaleString("en-IN")}`}
                              </p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] text-gray-400 font-semibold">{paidPct}% paid</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${cleared ? "bg-green-500" : paidPct >= 50 ? "bg-blue-500" : "bg-red-400"}`}
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Column 6: Actions ── */}
                    <div className="px-4 py-4 flex flex-col gap-2">

                      {isPromoted ? (
                        /* ── Already promoted — show badge + View only ── */
                        <div className="space-y-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-center">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Promoted</p>
                            <p className="text-[11px] text-blue-500 mt-0.5 font-semibold">
                              {student.promotedTo.std} · {student.promotedTo.session}
                            </p>
                          </div>
                          <Link
                            href={`/student/${student.enrollment}?session=${student.session}`}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy-dark transition-colors"
                          >
                            <Eye className="w-4 h-4 flex-shrink-0" /> View Profile
                          </Link>
                        </div>

                      ) : (
                        /* ── Active / normal student ── */
                        <>
                          <div className="space-y-2">
                            <Link
                              href={`/student/${student.enrollment}/edit`}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 transition-colors"
                            >
                              <Edit className="w-4 h-4 flex-shrink-0" /> Update
                            </Link>
                            <Link
                              href={`/student/${student.enrollment}?session=${student.session}`}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy-dark transition-colors"
                            >
                              <Eye className="w-4 h-4 flex-shrink-0" /> View
                            </Link>
                            <button
                              onClick={() => setDeactivateModal(student)}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 flex-shrink-0" /> Deactivate
                            </button>
                          </div>
                          {canPromote && student.session !== CURRENT_SESSION && getNextClass(student.std) && (
                            <div className="pt-2 border-t border-gray-100 space-y-1.5">
                              {hasPendingFees ? (
                                <>
                                  <button
                                    disabled
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                                  >
                                    <ArrowUpCircle className="w-4 h-4 flex-shrink-0" /> Promote to {getNextClass(student.std)}
                                  </button>
                                  <p className="text-[10px] text-red-500 font-semibold text-center">
                                    Clear pending fees of session {student.session} to promote
                                  </p>
                                </>
                              ) : (
                                <button
                                  onClick={() => setPromoteModal(student)}
                                  className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition-colors"
                                >
                                  <ArrowUpCircle className="w-4 h-4 flex-shrink-0" /> Promote to {getNextClass(student.std)}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
