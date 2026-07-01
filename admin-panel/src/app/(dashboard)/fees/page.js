"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useStore from "@/lib/store";
import { isPositiveAmount } from "@/lib/validators";
import {
  IndianRupee, Search, Send, Bell, CheckCircle2,
  Package, Phone, GraduationCap, ChevronDown, ChevronUp,
  X, MessageSquare, Users, Check, Lock, Eye, RotateCcw,
} from "lucide-react";
import supabase from "@/lib/supabase";
import {
  getStudentsForFees,
  getFeeStructure,
  saveFeePayment,
  markInventoryGiven,
} from "@/lib/feesService";
import { getActiveClasses } from "@/lib/settingsService";

// ── Default Fees Structure (fallback when DB has no fee_structures rows) ──
const DEFAULT_FEES = {
  "JR.KG":14500,"SR.KG":14500,"Balvatika":15000,
  "1st":15500,"2nd":15700,"3rd":15900,"4th":16200,"5th":16500,
  "6th":16800,"7th":17000,"8th":17300,"9th":17500,"10th":18000,
  "11th - Commerce":19000,"12th - Commerce":19000,
};

const ADMINS = [
  "Sunil Pradhan",
  "Rajesh Biswal",
  "BK Debiprasad Das",
  "Sandeep Pradhan",
  "Gaurang Polai",
  "Rudra Prasad Muni",
  "Ayeshkant Rout",
  "Other",
];

const todayStr = new Date().toISOString().split("T")[0];

const CLASS_ORDER = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th",
  "6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];
// ── Helpers ────────────────────────────────────────────────────
function getStructureFee(std, feesMap) {
  return (feesMap ?? DEFAULT_FEES)[std] ?? 0;
}

function calcSummary(student, feesMap) {
  const totalFees  = getStructureFee(student.std, feesMap);
  const discount   = student.discount?.amount ?? 0;
  const actualFees = Math.max(totalFees - discount, 0);
  // Only count payments recorded for the student's current class
  const classPayments = (student.payments ?? []).filter(p => !p.std || p.std === student.std);
  const paidFees   = classPayments.reduce((s, p) => s + p.amount, 0);
  const dueFees    = Math.max(actualFees - paidFees, 0);
  return { totalFees, discount, actualFees, paidFees, dueFees, classPayments };
}

function getPaymentStatus(student, feesMap) {
  const { paidFees, dueFees, actualFees } = calcSummary(student, feesMap);
  if (paidFees === 0 && actualFees > 0) return "Not Paid";
  if (dueFees <= 0) return "Full Paid";
  return "Partial Paid";
}

function formatDateLong(d) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return d; }
}

function formatDateShort(d) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function todayLong() {
  return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Fills {name}, {class}, {roll}, {amount}, {date} placeholders in a template
function fillTemplate(template, vars) {
  return template
    .replace(/\{name\}/g,   vars.name)
    .replace(/\{class\}/g,  vars.cls)
    .replace(/\{roll\}/g,   vars.roll)
    .replace(/\{amount\}/g, vars.amount)
    .replace(/\{date\}/g,   vars.date);
}

// Tri-lingual reminder — uses templates from Settings
function buildReminderMsg(student, lastDate, templates, feesMap) {
  const { dueFees } = calcSummary(student, feesMap);
  const vars = {
    name:   student.name,
    cls:    `${student.std}${student.section ? "-" + student.section : ""}`,
    roll:   student.rollNo,
    amount: `₹${dueFees.toLocaleString("en-IN")}`,
    date:   formatDateLong(lastDate),
  };
  return [
    "— English —",
    fillTemplate(templates.en, vars),
    "",
    "— हिंदी —",
    fillTemplate(templates.hi, vars),
    "",
    "— ଓଡ଼ିଆ —",
    fillTemplate(templates.or, vars),
  ].join("\n");
}

// Per-language message for individual Notify modal — uses templates from Settings
function buildLangMessage(student, lastDate, lang, templates, feesMap) {
  const { dueFees } = calcSummary(student, feesMap);
  const vars = {
    name:   student.name,
    cls:    student.std + (student.section ? '-' + student.section : ''),
    roll:   student.rollNo,
    amount: '₹' + dueFees.toLocaleString('en-IN'),
    date:   formatDateLong(lastDate),
  };
  return fillTemplate(templates[lang] || templates.en, vars);
}

// ── Reusable UI ────────────────────────────────────────────────
function SelectField({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={onChange} disabled={disabled}
        className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function SummaryPill({ label, value, subLabel, colorClass }) {
  return (
    <div className={`rounded-2xl p-4 text-center border ${colorClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {subLabel && <p className="text-[10px] mt-0.5 opacity-60 truncate">{subLabel}</p>}
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-semibold">
      <Lock className="w-2.5 h-2.5" /> Read only
    </span>
  );
}

// ── Individual Notify Modal ────────────────────────────────────
const NOTIFY_LANGS = [
  { key:"en", label:"English" },
  { key:"hi", label:"Hindi"   },
  { key:"or", label:"Odia"    },
];

function NotificationModal({ student, onClose, feesMap }) {
  const templates  = useStore(s => s.feeReminderTemplates);
  const defaultLast = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const [lastDate, setLastDate] = useState(defaultLast);
  const [lang,     setLang]     = useState("en");
  const [message,  setMessage]  = useState(() => buildLangMessage(student, defaultLast, "en", templates, feesMap));

  const handleDateChange = (d) => {
    setLastDate(d);
    setMessage(buildLangMessage(student, d, lang, templates, feesMap));
  };

  const handleLangChange = (l) => {
    setLang(l);
    setMessage(buildLangMessage(student, lastDate, l, templates, feesMap));
  };

  const { dueFees } = calcSummary(student, feesMap);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-school-navy px-5 py-4 flex items-center justify-between">
          <p className="text-white font-bold">Send Fee Reminder</p>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-school-navy flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">{student.name}</p>
              <p className="text-xs text-gray-500">
                Class {student.std}{student.section ? "-" + student.section : ""} · Roll {student.rollNo}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Due</p>
              <p className="text-sm font-bold text-red-600">₹{dueFees.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Date for Payment</label>
            <input
              type="date" value={lastDate} min={todayStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Message <span className="text-gray-400 font-normal normal-case">(Editable)</span>
              </label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                {NOTIFY_LANGS.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => handleLangChange(l.key)}
                    className={`px-3 py-1.5 transition-colors ${
                      lang === l.key
                        ? "bg-school-navy text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} rows={7}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">Selecting a language reloads the template. Edit freely before sending.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { alert("Notification sent! (FCM integration pending)"); onClose(); }}
              className="flex-1 py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Notification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── View Modal ─────────────────────────────────────────────────
function ViewModal({ student, onClose, feesMap }) {
  const { totalFees, discount, actualFees, paidFees, dueFees, classPayments } = calcSummary(student, feesMap);
  const status = getPaymentStatus(student, feesMap);
  const givenItems   = student.inventory.filter((i) => i.given);
  const pendingItems = student.inventory.filter((i) => !i.given);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-school-navy px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold leading-tight">{student.name}</p>
            <p className="text-white/60 text-xs mt-0.5">
              Class {student.std}{student.section ? "-" + student.section : ""} · Roll {student.rollNo} · Enr #{student.enrollment}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-5 space-y-5">

          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              status === "Full Paid"    ? "bg-green-100 text-green-700"
              : status === "Partial Paid" ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-600"
            }`}>{status}</span>
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Phone className="w-3.5 h-3.5 text-gray-400" /> {student.mobile}
            </span>
            {student.discount?.amount > 0 && (
              <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold">
                Discount: ₹{student.discount.amount.toLocaleString("en-IN")} · {student.discount.reason}
              </span>
            )}
          </div>

          {/* Summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryPill label="Total Fees"  value={`₹${totalFees.toLocaleString("en-IN")}`}  colorClass="bg-blue-50 border-blue-100 text-blue-800" />
            <SummaryPill label="Discount"    value={`₹${discount.toLocaleString("en-IN")}`}   colorClass="bg-amber-50 border-amber-100 text-amber-800" subLabel={student.discount?.reason || "—"} />
            <SummaryPill label="Actual Fees" value={`₹${actualFees.toLocaleString("en-IN")}`} colorClass="bg-purple-50 border-purple-100 text-purple-800" />
            <SummaryPill label="Paid Fees"   value={`₹${paidFees.toLocaleString("en-IN")}`}   colorClass="bg-green-50 border-green-100 text-green-800" />
            <SummaryPill
              label="Due Fees"
              value={dueFees <= 0 ? "Cleared ✓" : `₹${dueFees.toLocaleString("en-IN")}`}
              colorClass={dueFees <= 0 ? "bg-gray-50 border-gray-100 text-gray-600" : "bg-red-50 border-red-100 text-red-700"}
            />
          </div>

          {/* Payment History — class-specific */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Payment History — {student.std}</p>
              <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                {classPayments.length} payment{classPayments.length !== 1 ? "s" : ""}
              </span>
            </div>
            {classPayments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No payments recorded for {student.std} yet</p>
            ) : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {classPayments.map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{formatDateShort(p.date)}</td>
                      <td className="px-4 py-3 font-bold text-green-700">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-gray-600">{p.receivedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          {/* Inventory */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Inventory</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {givenItems.length} given
                </span>
                {pendingItems.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    {pendingItems.length} pending
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {[...student.inventory].sort((a, b) => (b.given ? 1 : 0) - (a.given ? 1 : 0)).map((inv, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 ${inv.given ? "" : "bg-amber-50/40"}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${inv.given ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                      {inv.given
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        : <Package className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{inv.item}</span>
                  </div>
                  <span className={`text-xs font-medium ${inv.given ? "text-gray-500" : "text-amber-600"}`}>
                    {inv.given ? inv.givenDate : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function FeesPage() {
  const searchParams = useSearchParams();
  const templates    = useStore(s => s.feeReminderTemplates);
  const [activeClassNames, setActiveClassNames] = useState([]);

  // ── DB state ────────────────────────────────────────────────
  const [students,       setStudents]      = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [loadError,      setLoadError]     = useState(null);
  const [academicYears,  setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [feeSession,     setFeeSession]    = useState("");
  const [feesMap,        setFeesMap]       = useState(DEFAULT_FEES);

  const [notifyStudent, setNotifyStudent] = useState(null);
  const [viewStudent,   setViewStudent]   = useState(null);

  const stdOrder   = CLASS_ORDER;
  const allStdList = CLASS_ORDER.filter(c => activeClassNames.includes(c));

  // Top toggle cards
  const [structureOpen, setStructureOpen] = useState(false);
  const [reminderOpen,  setReminderOpen]  = useState(false);

  // Fee Entry
  const [entryStd,         setEntryStd]         = useState("");
  const [entryRoll,        setEntryRoll]         = useState("");
  const [newAmt,           setNewAmt]            = useState("");
  const [newDate,          setNewDate]           = useState(todayStr);
  const [newAdmin,         setNewAdmin]          = useState("");
  const [newAdminCustom,   setNewAdminCustom]    = useState("");
  const [pendingInventory, setPendingInventory]  = useState(new Set());
  const [invGivenDate,     setInvGivenDate]      = useState(todayStr);
  const [saving,           setSaving]            = useState(false);

  // Overview filters
  const [filterClass,  setFilterClass]  = useState("All Classes");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  // Reminder state
  const [msgRecipient,       setMsgRecipient]      = useState("incomplete");
  const [msgLastDate,        setMsgLastDate]        = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [customMsg,          setCustomMsg]          = useState("");
  const [selectedIncomplete, setSelectedIncomplete] = useState(new Set());
  const [studentListOpen,    setStudentListOpen]    = useState(false);
  const [reminderMsg,        setReminderMsg]        = useState("");

  const autoSelectDone = useRef(false);

  // ── Load academic years + active classes on mount ──────────
  useEffect(() => {
    supabase
      .from("academic_years")
      .select("id, label, is_current")
      .order("label", { ascending: false })
      .then(({ data }) => {
        if (data?.length > 0) {
          setAcademicYears(data);
          const current = data.find(y => y.is_current) || data[0];
          setSelectedYearId(current.id);
          setFeeSession(current.label);
        }
      });
    getActiveClasses().then(cls => setActiveClassNames(cls.map(c => c.name))).catch(() => {});
  }, []);

  // ── Load students + fee structure when year changes ─────────
  useEffect(() => {
    if (!selectedYearId) return;
    setLoading(true);
    Promise.all([
      getStudentsForFees(selectedYearId),
      getFeeStructure(selectedYearId),
    ])
      .then(([fetchedStudents, fetchedFees]) => {
        setStudents(fetchedStudents);
        setFeesMap(Object.keys(fetchedFees).length > 0 ? fetchedFees : DEFAULT_FEES);
        setLoading(false);
      })
      .catch(err => { setLoadError(err.message); setLoading(false); });
  }, [selectedYearId]);

  // ── Init reminder selection once students load ──────────────
  useEffect(() => {
    if (!students.length) return;
    const incomplete = students.filter(s => getPaymentStatus(s, feesMap) !== "Full Paid");
    setSelectedIncomplete(new Set(incomplete.map(s => s.enrollment)));
    const first = incomplete[0];
    if (first) setReminderMsg(buildReminderMsg(first, msgLastDate, templates, feesMap));
  }, [students, feesMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-select student from URL params (after students load) ─
  useEffect(() => {
    if (!students.length || autoSelectDone.current) return;
    const enrollment = searchParams.get("enrollment");
    const std        = searchParams.get("std");
    const roll       = searchParams.get("roll");

    if (enrollment) {
      const found = students.find(s => s.enrollment === enrollment);
      if (found) {
        setEntryStd(found.std);
        setEntryRoll(found.rollNo);
      } else if (std) {
        setEntryStd(std);
        if (roll) setEntryRoll(roll);
      }
      setTimeout(() => {
        document.getElementById("fee-entry-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      autoSelectDone.current = true;
    } else if (std) {
      setEntryStd(std);
      if (roll) setEntryRoll(roll);
      setTimeout(() => {
        document.getElementById("fee-entry-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      autoSelectDone.current = true;
    }
  }, [students]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ────────────────────────────────────────────
  const stdList = allStdList.length > 0
    ? allStdList
    : [...new Set(students.map(s => s.std))].sort((a, b) => stdOrder.indexOf(a) - stdOrder.indexOf(b));

  const rollsForStd = students
    .filter(s => s.std === entryStd)
    .map(s => s.rollNo)
    .sort((a, b) => parseInt(a) - parseInt(b));

  const entryStudent = entryRoll
    ? students.find(s => s.std === entryStd && s.rollNo === entryRoll) || null
    : null;

  const allInvItems = entryStudent
    ? [...entryStudent.inventory].sort((a, b) => (b.given ? 1 : 0) - (a.given ? 1 : 0))
    : [];
  const pendingInvItems = allInvItems.filter(i => !i.given);

  const filteredStudents = students.filter(s => {
    const status = getPaymentStatus(s, feesMap);
    return (
      (filterClass  === "All Classes" || s.std === filterClass) &&
      (!filterSearch || s.name.toLowerCase().includes(filterSearch.toLowerCase()) || s.rollNo.includes(filterSearch)) &&
      (filterStatus === "All"         || status === filterStatus)
    );
  });

  const incompleteStudents = students.filter(s => getPaymentStatus(s, feesMap) !== "Full Paid");

  // ── Interaction helpers ─────────────────────────────────────
  const togglePendingItem = (item) => {
    setPendingInventory(prev => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  };

  const clearEntryStudent = () => {
    setEntryStd(""); setEntryRoll("");
    setNewAmt(""); setNewDate(todayStr); setNewAdmin(""); setNewAdminCustom("");
    setPendingInventory(new Set());
    setInvGivenDate(todayStr);
  };

  const refreshStudents = async () => {
    const [fresh, freshFees] = await Promise.all([
      getStudentsForFees(selectedYearId),
      getFeeStructure(selectedYearId),
    ]);
    setStudents(fresh);
    if (Object.keys(freshFees).length > 0) setFeesMap(freshFees);
  };

  const handleSavePayment = async () => {
    const receivedBy = newAdmin === "Other" ? newAdminCustom.trim() : newAdmin;
    if (!entryStudent || !newAmt || !receivedBy) {
      alert("Please fill amount and received by.");
      return;
    }
    const { dueFees } = calcSummary(entryStudent, feesMap);
    if (dueFees <= 0) {
      alert("All fees for this class are already paid. No further payment can be recorded.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(newAmt).trim())) {
      alert("Please enter a valid amount with at most 2 decimal places.");
      return;
    }
    const amt = Number(newAmt);
    if (!isPositiveAmount(amt, dueFees)) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }
    if (amt > dueFees) {
      alert(`Amount ₹${amt.toLocaleString("en-IN")} exceeds the due balance of ₹${dueFees.toLocaleString("en-IN")}. Please enter a correct amount.`);
      return;
    }
    setSaving(true);
    try {
      await saveFeePayment(entryStudent._enrollmentId, entryStudent._studentId, {
        amount:      amt,
        paymentDate: newDate,
        receivedBy,
      });
      await refreshStudents();
      setNewAmt(""); setNewDate(todayStr); setNewAdmin(""); setNewAdminCustom("");
      setPendingInventory(new Set());
      alert("Payment recorded successfully!");
    } catch (err) {
      alert("Failed to save payment: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInventory = async () => {
    if (!entryStudent || pendingInventory.size === 0) {
      alert("Select at least one inventory item to mark as given.");
      return;
    }
    const assignmentIds = entryStudent.inventory
      .filter(i => pendingInventory.has(i.item) && i._assignmentId)
      .map(i => i._assignmentId);
    if (assignmentIds.length === 0) {
      alert("No valid inventory assignments found. Items may not have been assigned at admission.");
      return;
    }
    setSaving(true);
    try {
      await markInventoryGiven(assignmentIds, invGivenDate || todayStr);
      await refreshStudents();
      const count = pendingInventory.size;
      setPendingInventory(new Set());
      setInvGivenDate(todayStr);
      alert(`${count} inventory item(s) marked as given!`);
    } catch (err) {
      alert("Failed to update inventory: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleIncomplete = (enr) => {
    setSelectedIncomplete(prev => {
      const next = new Set(prev);
      next.has(enr) ? next.delete(enr) : next.add(enr);
      const newFirst = incompleteStudents.find(s => next.has(s.enrollment));
      if (newFirst) setReminderMsg(buildReminderMsg(newFirst, msgLastDate, templates, feesMap));
      return next;
    });
  };

  const handleReminderDateChange = (d) => {
    setMsgLastDate(d);
    const first = incompleteStudents.find(s => selectedIncomplete.has(s.enrollment));
    if (first) setReminderMsg(buildReminderMsg(first, d, templates, feesMap));
  };

  const handleSendMessage = () => {
    if (msgRecipient === "all") {
      if (!customMsg.trim()) { alert("Please type a message."); return; }
      alert(`Message sent to all ${students.length} students! (FCM integration pending)`);
    } else {
      if (selectedIncomplete.size === 0) { alert("No students selected."); return; }
      alert(`Fee reminder sent to ${selectedIncomplete.size} student(s)! (FCM integration pending)`);
    }
  };

  const todayDisplay = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 font-medium text-sm">{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-school-navy text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <>
      {notifyStudent && (
        <NotificationModal student={notifyStudent} onClose={() => setNotifyStudent(null)} feesMap={feesMap} />
      )}
      {viewStudent && (
        <ViewModal student={viewStudent} onClose={() => setViewStudent(null)} feesMap={feesMap} />
      )}

      <div className="space-y-6">

        {loading && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Loading fees data…
          </div>
        )}

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Fees Management</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fee structure, collection, receipts & due reports</p>
          </div>
          {/* Session selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Session</label>
            <select
              value={feeSession}
              onChange={e => {
                const label = e.target.value;
                const yr = academicYears.find(y => y.label === label);
                setFeeSession(label);
                if (yr) setSelectedYearId(yr.id);
                setEntryStd(""); setEntryRoll("");
                autoSelectDone.current = false;
              }}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.label}>{y.label}{y.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ══ Top Toggle Cards ══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Card 1 — Fees Structure */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setStructureOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">Fees Structure</p>
                <p className="text-xs text-gray-400 mt-0.5">Session {feeSession}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
{structureOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>
            {structureOpen && (
              <div className="border-t border-gray-100">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-[11px] text-gray-500 font-semibold">Fee amounts for <b>{feeSession}</b></span>
                  <span className="text-[10px] text-gray-400 italic">Edit in Settings</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  {CLASS_ORDER.map((cls) => (
                    <div key={cls} className="bg-white px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{cls}</p>
                      <p className="text-sm font-bold text-school-navy mt-0.5">₹{(feesMap[cls] ?? 0).toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 2 — Send Reminder */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setReminderOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">Send Reminder</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {incompleteStudents.length} student{incompleteStudents.length !== 1 ? "s" : ""} with pending fees
                </p>
              </div>
              {reminderOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {reminderOpen && (
              <div className="border-t border-gray-100 p-5 space-y-4">

                {/* Recipient toggle — Incomplete first */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Send To</label>
                  <div className="flex gap-2">
                    {[
                      { key: "incomplete", label: "Incomplete Fees" },
                      { key: "all",        label: "All Students" },
                    ].map(({ key, label }) => (
                      <button
                        key={key} onClick={() => setMsgRecipient(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          msgRecipient === key
                            ? "bg-school-navy text-white border-school-navy"
                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Incomplete Fees — tri-lingual auto message */}
                {msgRecipient === "incomplete" && (
                  <div className="space-y-4">

                    {/* Last date */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Date for Payment</label>
                      <input
                        type="date" value={msgLastDate} min={todayStr}
                        onChange={(e) => handleReminderDateChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                      />
                    </div>

                    {incompleteStudents.length === 0 ? (
                      <p className="text-sm text-green-600 font-semibold">All students have cleared their fees!</p>
                    ) : (
                      /* Collapsible student list */
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <button
                          onClick={() => setStudentListOpen((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-school-navy" />
                            <span className="text-sm font-semibold text-gray-700">Students</span>
                            <span className="text-[11px] bg-school-navy text-white px-2 py-0.5 rounded-full font-bold">
                              {selectedIncomplete.size} of {incompleteStudents.length} selected
                            </span>
                          </div>
                          {studentListOpen
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {studentListOpen && (
                          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                            {incompleteStudents.map((s) => {
                              const { dueFees } = calcSummary(s, feesMap);
                              const checked = selectedIncomplete.has(s.enrollment);
                              return (
                                <div
                                  key={s.enrollment}
                                  onClick={() => toggleIncomplete(s.enrollment)}
                                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? "bg-blue-50/50" : "bg-white"}`}
                                >
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-school-navy border-school-navy" : "border-gray-300"}`}>
                                    {checked && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                                    <p className="text-xs text-gray-500">
                                      Class {s.std}{s.section ? `-${s.section}` : ""} · Roll {s.rollNo}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] text-gray-400">Due</p>
                                    <p className="text-sm font-bold text-red-600">₹{dueFees.toLocaleString("en-IN")}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editable tri-lingual preview */}
                    {selectedIncomplete.size > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Message</label>
                          <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                            English · हिंदी · ଓଡ଼ିଆ
                          </span>
                          <span className="text-gray-400 text-[10px]">(editable · personalized per student)</span>
                        </div>
                        <textarea
                          value={reminderMsg}
                          onChange={(e) => setReminderMsg(e.target.value)}
                          rows={10}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          Each student gets their own due amount · Sent on: {todayDisplay}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* All Students — custom message */}
                {msgRecipient === "all" && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <Users className="w-4 h-4 text-school-navy flex-shrink-0" />
                      <p className="text-xs text-gray-600">
                        Message will be sent to <b>all {students.length} students</b>
                      </p>
                    </div>
                    <textarea
                      value={customMsg} onChange={(e) => setCustomMsg(e.target.value)}
                      placeholder="Type your message here..."
                      rows={4}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none"
                    />
                    <p className="text-xs text-gray-400">Sent on: {todayDisplay}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSendMessage}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    {msgRecipient === "all"
                      ? `Send to All ${students.length} Students`
                      : `Send to ${selectedIncomplete.size} Student${selectedIncomplete.size !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Redirect context banner ── */}
        {searchParams.get("new") === "1" && (
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0"/>
            New student added successfully. Select their class and roll number below to record the admission fee.
          </div>
        )}
        {searchParams.get("promoted") === "1" && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-700 font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0"/>
            Student promoted to next class. Their fee record is selected below — record the new session fee payment.
          </div>
        )}

        {/* ══ Fee Entry ══ */}
        <div id="fee-entry-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <IndianRupee className="w-4 h-4 text-school-navy" />
            <span className="text-sm font-bold text-gray-800">Fee Entry</span>
          </div>
          <div className="p-5 space-y-5">

            {/* Student selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Standard</label>
                <SelectField value={entryStd} onChange={(e) => { setEntryStd(e.target.value); setEntryRoll(""); setPendingInventory(new Set()); }}>
                  <option value="">Select Standard</option>
                  {stdList.map((s) => <option key={s}>{s}</option>)}
                </SelectField>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Roll Number</label>
                <SelectField value={entryRoll} onChange={(e) => { setEntryRoll(e.target.value); setPendingInventory(new Set()); }} disabled={!entryStd}>
                  <option value="">{entryStd ? "Select Roll No" : "Select standard first"}</option>
                  {rollsForStd.map((r) => <option key={r}>{r}</option>)}
                </SelectField>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Student Name</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl bg-gray-50">
                  {entryStudent ? (
                    <>
                      <GraduationCap className="w-4 h-4 text-school-navy flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-800 truncate">{entryStudent.name}</span>
                      <button onClick={clearEntryStudent} className="ml-auto text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Auto-filled on roll selection</span>
                  )}
                </div>
              </div>
            </div>

            {!entryStd && (
              <p className="text-center py-6 text-gray-400 text-sm">
                Select a standard and roll number to view fee details and record payment.
              </p>
            )}

            {entryStudent && (() => {
              const { totalFees, discount, actualFees, paidFees, dueFees, classPayments } = calcSummary(entryStudent, feesMap);
              const isFullyPaid = dueFees <= 0;
              return (
                <div className="space-y-4">

                  {/* Class indicator */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                    <GraduationCap className="w-3.5 h-3.5 text-school-navy" />
                    Showing fees for class <span className="font-bold text-school-navy">{entryStudent.std}</span>
                    {isFullyPaid && (
                      <span className="ml-auto inline-flex items-center gap-1 bg-green-100 text-green-700 font-semibold px-2.5 py-0.5 rounded-full border border-green-200">
                        <CheckCircle2 className="w-3 h-3" /> All Fees Paid
                      </span>
                    )}
                  </div>

                  {/* Summary pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <SummaryPill label="Total Fees"  value={`₹${totalFees.toLocaleString("en-IN")}`}  colorClass="bg-blue-50 border-blue-100 text-blue-800" />
                    <SummaryPill label="Discount"    value={`₹${discount.toLocaleString("en-IN")}`}   colorClass="bg-amber-50 border-amber-100 text-amber-800" subLabel={entryStudent.discount?.reason || "No discount"} />
                    <SummaryPill label="Actual Fees" value={`₹${actualFees.toLocaleString("en-IN")}`} colorClass="bg-purple-50 border-purple-100 text-purple-800" />
                    <SummaryPill label="Paid Fees"   value={`₹${paidFees.toLocaleString("en-IN")}`}   colorClass="bg-green-50 border-green-100 text-green-800" />
                    <SummaryPill
                      label="Due Fees"
                      value={isFullyPaid ? "Cleared ✓" : `₹${dueFees.toLocaleString("en-IN")}`}
                      colorClass={isFullyPaid ? "bg-gray-50 border-gray-100 text-gray-600" : "bg-red-50 border-red-100 text-red-700"}
                    />
                  </div>

                  {/* Payment History — class-specific, read only */}
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Payment History — {entryStudent.std}
                      </p>
                      <div className="flex items-center gap-2">
                        <ReadOnlyBadge />
                        <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          {classPayments.length} payment{classPayments.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {classPayments.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">No payments recorded for {entryStudent.std} yet</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50/60">
                            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">#</th>
                            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Amount</th>
                            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Received By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {classPayments.map((p, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-gray-700">{formatDateShort(p.date)}</td>
                              <td className="px-4 py-3 font-bold text-green-700">₹{p.amount.toLocaleString("en-IN")}</td>
                              <td className="px-4 py-3 text-gray-600">{p.receivedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Inventory Given — Read only */}
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Inventory Given</p>
                      <div className="flex items-center gap-2">
                        <ReadOnlyBadge />
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          {entryStudent.inventory.filter((i) => i.given).length} given
                        </span>
                      </div>
                    </div>
                    {entryStudent.inventory.filter((i) => i.given).length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">No inventory distributed yet</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {entryStudent.inventory.filter((i) => i.given).map((inv, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <span className="text-sm font-medium text-gray-800">{inv.item}</span>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{inv.givenDate}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pending Inventory — interactive */}
                  {pendingInvItems.length > 0 && (
                    <div className="border border-amber-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pending Inventory</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">Tick items to mark as given — set the date below</p>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                          {pendingInvItems.length} pending
                        </span>
                      </div>
                      <div className="divide-y divide-amber-50/60 bg-white">
                        {pendingInvItems.map((inv) => {
                          const checked = pendingInventory.has(inv.item);
                          return (
                            <div
                              key={inv.item}
                              onClick={() => togglePendingItem(inv.item)}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50/30 transition-colors ${checked ? "bg-amber-50/50" : ""}`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-amber-500 border-amber-500" : "border-gray-300"}`}>
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800">{inv.item}</span>
                              </div>
                              {checked && (
                                <span className="text-[11px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                  Given · {invGivenDate ? invGivenDate.split("-").reverse().join("-") : todayLong()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-amber-800 uppercase tracking-wide whitespace-nowrap">Given Date</label>
                          <input
                            type="date"
                            value={invGivenDate}
                            max={todayStr}
                            onChange={(e) => setInvGivenDate(e.target.value)}
                            className="text-sm border border-amber-300 rounded-lg px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </div>
                        {pendingInventory.size > 0 && (
                          <button
                            onClick={handleSaveInventory}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                          >
                            <Package className="w-4 h-4" />
                            {saving ? "Saving…" : `Save Inventory (${pendingInventory.size} item${pendingInventory.size !== 1 ? "s" : ""})`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* New Payment Form — hidden when fully paid */}
                  {isFullyPaid ? (
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-800">All Fees Paid — {entryStudent.std}</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          ₹{actualFees.toLocaleString("en-IN")} collected in full. No further payment required.
                        </p>
                      </div>
                      <button
                        onClick={clearEntryStudent}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-green-200 bg-white text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <IndianRupee className="w-3.5 h-3.5" /> Record New Payment
                        <span className="ml-auto font-semibold text-blue-600 normal-case">
                          Balance due: ₹{dueFees.toLocaleString("en-IN")}
                        </span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">₹</span>
                            <input
                              type="number" placeholder="0" value={newAmt} min="1" max={dueFees}
                              onChange={(e) => setNewAmt(e.target.value)}
                              className="w-full pl-7 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Payment <span className="text-red-500">*</span></label>
                          <input
                            type="date" value={newDate} max={todayStr}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received By <span className="text-red-500">*</span></label>
                          <SelectField value={newAdmin} onChange={(e) => { setNewAdmin(e.target.value); setNewAdminCustom(""); }}>
                            <option value="">Select Name</option>
                            {ADMINS.map((a) => <option key={a}>{a}</option>)}
                          </SelectField>
                          {newAdmin === "Other" && (
                            <input
                              type="text"
                              placeholder="Enter name..."
                              value={newAdminCustom}
                              onChange={(e) => setNewAdminCustom(e.target.value)}
                              className="mt-2 w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white"
                            />
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <button
                          onClick={clearEntryStudent}
                          className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-500 text-sm font-semibold rounded-xl transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Clear
                        </button>
                        <button
                          onClick={handleSavePayment}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-6 py-2.5 bg-school-navy hover:bg-school-navy-dark disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                        >
                          <Check className="w-4 h-4" /> {saving ? "Saving…" : "Save Payment"}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}
          </div>
        </div>

        {/* ══ Fee Overview ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5 mb-3">
              <Users className="w-4 h-4 text-school-navy" />
              <span className="text-sm font-bold text-gray-800">Fee Overview</span>
              <span className="ml-auto text-xs text-gray-500">{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <div className="w-full sm:w-44">
                <SelectField value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                  <option value="All Classes">All Classes</option>
                  {allStdList.map((s) => <option key={s}>{s}</option>)}
                </SelectField>
              </div>
              <div className="flex-1 relative min-w-[180px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text" placeholder="Search by name or roll..."
                  value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {["All", "Full Paid", "Partial Paid", "Not Paid"].map((s) => (
                  <button
                    key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      filterStatus === s
                        ? s === "Not Paid"     ? "bg-red-600 text-white"
                        : s === "Full Paid"    ? "bg-green-600 text-white"
                        : s === "Partial Paid" ? "bg-amber-500 text-white"
                        : "bg-school-navy text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-gray-50">
                  {["Student", "Std", "Roll", "Mobile", "Paid", "Due", "Status", "Action"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide ${
                      h === "Paid" || h === "Due" ? "text-right"
                      : h === "Status" || h === "Action" ? "text-center"
                      : "text-left"
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No students match the selected filters
                    </td>
                  </tr>
                ) : filteredStudents.map((s) => {
                  const { paidFees, dueFees } = calcSummary(s, feesMap);
                  const status = getPaymentStatus(s, feesMap);
                  return (
                    <tr key={s.enrollment} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <p className="text-[11px] text-gray-400">#{s.enrollment}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                          {s.std}{s.section ? `-${s.section}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-gray-700">{s.rollNo}</td>
                      <td className="px-4 py-3.5 text-gray-600">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" /> {s.mobile}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-green-700">
                        ₹{paidFees.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        <span className={dueFees <= 0 ? "text-gray-400" : "text-red-600"}>
                          {dueFees <= 0 ? "—" : `₹${dueFees.toLocaleString("en-IN")}`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          status === "Full Paid"    ? "bg-green-100 text-green-700"
                          : status === "Partial Paid" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-600"
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-stretch gap-1.5 min-w-[72px]">
                          <button
                            onClick={() => setViewStudent(s)}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-school-navy hover:text-white text-gray-600 rounded-lg text-[11px] font-semibold transition-all"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          {status !== "Full Paid" ? (
                            <button
                              onClick={() => setNotifyStudent(s)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-school-navy/10 hover:bg-school-navy text-school-navy hover:text-white rounded-lg text-[11px] font-semibold transition-all"
                            >
                              <Bell className="w-3 h-3" /> Notify
                            </button>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1 text-[11px] text-green-600 font-semibold py-1">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
