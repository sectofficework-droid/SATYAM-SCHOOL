"use client";

import { useState } from "react";
import {
  IndianRupee, Search, Send, Bell, CheckCircle2,
  Package, Phone, GraduationCap, ChevronDown, ChevronUp,
  X, MessageSquare, Users, Check, Lock,
} from "lucide-react";

// ── Fees Structure ─────────────────────────────────────────────
const FEES_STRUCTURE = [
  { std: "JR.KG",           amount: 14500 },
  { std: "SR.KG",           amount: 14500 },
  { std: "Balvatika",       amount: 15000 },
  { std: "1st",             amount: 15500 },
  { std: "2nd",             amount: 15700 },
  { std: "3rd",             amount: 15900 },
  { std: "4th",             amount: 16200 },
  { std: "5th",             amount: 16500 },
  { std: "6th",             amount: 16800 },
  { std: "7th",             amount: 17000 },
  { std: "8th",             amount: 17300 },
  { std: "9th",             amount: 17500 },
  { std: "10th",            amount: 18000 },
  { std: "11th - Commerce", amount: 19000 },
  { std: "12th - Commerce", amount: 19000 },
];

const INVENTORY_ITEMS = [
  "School Bag", "Uniform", "Textbooks", "School Diary", "ID Card", "Water Bottle",
];

const ADMINS = ["Principal", "Vice Principal", "Admin", "Accountant", "Class Teacher"];

const INITIAL_STUDENTS = [
  {
    enrollment: "1001", name: "Arjun Patel", fatherName: "Rajesh",
    std: "10th", section: "A", rollNo: "101", mobile: "9876543210",
    discount: { amount: 5000, reason: "Financial Weak" },
    payments: [
      { date: "2026-06-05", amount: 8500, receivedBy: "Principal" },
      { date: "2026-10-12", amount: 5000, receivedBy: "Admin" },
    ],
    inventory: [
      { item: "School Bag",   givenDate: "05 Jun 2026" },
      { item: "Uniform",      givenDate: "05 Jun 2026" },
      { item: "Textbooks",    givenDate: "10 Jun 2026" },
      { item: "School Diary", givenDate: "05 Jun 2026" },
      { item: "ID Card",      givenDate: "15 Jun 2026" },
    ],
  },
  {
    enrollment: "1002", name: "Priya Shah", fatherName: "Amit",
    std: "9th", section: "B", rollNo: "204", mobile: "9765432100",
    discount: { amount: 0, reason: "" },
    payments: [
      { date: "2026-06-10", amount: 17500, receivedBy: "Admin" },
    ],
    inventory: [
      { item: "School Bag",   givenDate: "10 Jun 2026" },
      { item: "Uniform",      givenDate: "10 Jun 2026" },
      { item: "Textbooks",    givenDate: "12 Jun 2026" },
      { item: "School Diary", givenDate: "10 Jun 2026" },
      { item: "ID Card",      givenDate: "15 Jun 2026" },
    ],
  },
  {
    enrollment: "1003", name: "Rohan Mehta", fatherName: "Suresh",
    std: "11th - Commerce", section: "A", rollNo: "312", mobile: "9654321098",
    discount: { amount: 1000, reason: "Old Student" },
    payments: [
      { date: "2026-06-08", amount: 9000, receivedBy: "Admin" },
    ],
    inventory: [
      { item: "School Bag", givenDate: "08 Jun 2026" },
      { item: "Textbooks",  givenDate: "10 Jun 2026" },
      { item: "ID Card",    givenDate: "15 Jun 2026" },
    ],
  },
  {
    enrollment: "1004", name: "Sneha Desai", fatherName: "Kishore",
    std: "8th", section: "C", rollNo: "418", mobile: "9543210987",
    discount: { amount: 2500, reason: "3 Kids" },
    payments: [],
    inventory: [],
  },
  {
    enrollment: "1005", name: "Dev Joshi", fatherName: "Prakash",
    std: "JR.KG", section: "A", rollNo: "501", mobile: "9432109876",
    discount: { amount: 0, reason: "" },
    payments: [
      { date: "2026-06-12", amount: 14500, receivedBy: "Admin" },
    ],
    inventory: [
      { item: "School Bag",   givenDate: "12 Jun 2026" },
      { item: "Uniform",      givenDate: "12 Jun 2026" },
      { item: "School Diary", givenDate: "12 Jun 2026" },
      { item: "ID Card",      givenDate: "20 Jun 2026" },
    ],
  },
];

const todayStr = new Date().toISOString().split("T")[0];

// ── Helpers ────────────────────────────────────────────────────
function getStructureFee(std) {
  return FEES_STRUCTURE.find((f) => f.std === std)?.amount ?? 0;
}

function calcSummary(student) {
  const totalFees  = getStructureFee(student.std);
  const discount   = student.discount?.amount ?? 0;
  const actualFees = Math.max(totalFees - discount, 0);
  const paidFees   = student.payments.reduce((s, p) => s + p.amount, 0);
  const dueFees    = Math.max(actualFees - paidFees, 0);
  return { totalFees, discount, actualFees, paidFees, dueFees };
}

function getPaymentStatus(student) {
  const { paidFees, dueFees, actualFees } = calcSummary(student);
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

function buildReminderMsg(student, lastDate) {
  const { actualFees, dueFees } = calcSummary(student);
  return `Dear Parent / Guardian,

This is a gentle reminder regarding the school fee payment for your ward ${student.name} (Class ${student.std}${student.section ? "-" + student.section : ""}, Roll No. ${student.rollNo}).

As per our records, a fee balance of ₹${dueFees.toLocaleString("en-IN")} is currently outstanding out of the total applicable fees of ₹${actualFees.toLocaleString("en-IN")}.

Kindly ensure the pending amount is cleared on or before ${formatDateLong(lastDate)} to avoid any inconvenience.

For assistance or queries, please contact the school office during working hours.

Warm Regards,
Satyam Stars International School
Surat, Gujarat`;
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

// ── Notification Modal ──────────────────────────────────────────
function NotificationModal({ student, onClose }) {
  const defaultLast = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const [lastDate, setLastDate] = useState(defaultLast);
  const [message,  setMessage]  = useState(() => buildReminderMsg(student, defaultLast));

  const handleDateChange = (d) => {
    setLastDate(d);
    setMessage(buildReminderMsg(student, d));
  };

  const { dueFees } = calcSummary(student);

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
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Last Date for Payment
            </label>
            <input
              type="date" value={lastDate} min={todayStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Message <span className="text-gray-400 font-normal normal-case">(Editable)</span>
            </label>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} rows={12}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
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

// ── Main Page ──────────────────────────────────────────────────
export default function FeesPage() {
  const [students,      setStudents]      = useState(INITIAL_STUDENTS);
  const [notifyStudent, setNotifyStudent] = useState(null);

  // Top toggle cards
  const [structureOpen, setStructureOpen] = useState(false);
  const [reminderOpen,  setReminderOpen]  = useState(false);

  // Fee Entry
  const [entryStd,        setEntryStd]        = useState("");
  const [entryRoll,       setEntryRoll]        = useState("");
  const [newAmt,          setNewAmt]           = useState("");
  const [newDate,         setNewDate]          = useState(todayStr);
  const [newAdmin,        setNewAdmin]         = useState("");
  const [pendingInventory, setPendingInventory] = useState(new Set());

  const stdOrder    = FEES_STRUCTURE.map((f) => f.std);
  const stdList     = [...new Set(students.map((s) => s.std))].sort(
    (a, b) => stdOrder.indexOf(a) - stdOrder.indexOf(b)
  );
  const rollsForStd  = students.filter((s) => s.std === entryStd).map((s) => s.rollNo).sort();
  const entryStudent = entryRoll
    ? students.find((s) => s.std === entryStd && s.rollNo === entryRoll)
    : null;

  const pendingItems = entryStudent
    ? INVENTORY_ITEMS.filter((item) => !entryStudent.inventory.find((i) => i.item === item))
    : [];

  const togglePendingItem = (item) => {
    setPendingInventory((prev) => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  };

  const handleSavePayment = () => {
    if (!entryStudent || !newAmt || !newAdmin) {
      alert("Please fill amount and received by.");
      return;
    }
    setStudents((prev) =>
      prev.map((s) =>
        s.enrollment === entryStudent.enrollment
          ? { ...s, payments: [...s.payments, { date: newDate, amount: Number(newAmt), receivedBy: newAdmin }] }
          : s
      )
    );
    setNewAmt(""); setNewDate(todayStr); setNewAdmin("");
    setEntryStd(""); setEntryRoll("");
    setPendingInventory(new Set());
    alert("Payment recorded successfully!");
  };

  const handleSaveInventory = () => {
    if (!entryStudent || pendingInventory.size === 0) {
      alert("Select at least one inventory item to mark as given.");
      return;
    }
    const givenDate = todayLong();
    setStudents((prev) =>
      prev.map((s) =>
        s.enrollment === entryStudent.enrollment
          ? {
              ...s,
              inventory: [
                ...s.inventory,
                ...[...pendingInventory].map((item) => ({ item, givenDate })),
              ],
            }
          : s
      )
    );
    setPendingInventory(new Set());
    alert(`${pendingInventory.size} inventory item(s) marked as given!`);
  };

  const clearEntryStudent = () => {
    setEntryStd(""); setEntryRoll("");
    setNewAmt(""); setNewDate(todayStr); setNewAdmin("");
    setPendingInventory(new Set());
  };

  // Fee Overview filters
  const [filterClass,  setFilterClass]  = useState("All Classes");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const filteredStudents = students.filter((s) => {
    const status = getPaymentStatus(s);
    return (
      (filterClass  === "All Classes" || s.std === filterClass) &&
      (!filterSearch || s.name.toLowerCase().includes(filterSearch.toLowerCase()) || s.rollNo.includes(filterSearch)) &&
      (filterStatus === "All"         || status === filterStatus)
    );
  });

  // Send Message (reminder)
  const [msgRecipient,       setMsgRecipient]       = useState("all");
  const [msgLastDate,        setMsgLastDate]         = useState(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
  const [customMsg,          setCustomMsg]           = useState("");
  const [selectedIncomplete, setSelectedIncomplete]  = useState(
    () => new Set(INITIAL_STUDENTS.filter((s) => calcSummary(s).dueFees > 0).map((s) => s.enrollment))
  );

  const incompleteStudents = students.filter((s) => getPaymentStatus(s) !== "Full Paid");

  const toggleIncomplete = (enr) =>
    setSelectedIncomplete((prev) => {
      const next = new Set(prev);
      next.has(enr) ? next.delete(enr) : next.add(enr);
      return next;
    });

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

  return (
    <>
      {notifyStudent && (
        <NotificationModal student={notifyStudent} onClose={() => setNotifyStudent(null)} />
      )}

      <div className="space-y-6">

        {/* ── Page Header ── */}
        <div>
          <h2 className="text-xl font-bold text-gray-800">Fees Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Fee structure, collection, receipts & due reports</p>
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
                <p className="text-xs text-gray-400 mt-0.5">Academic Year 2026-27</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                  <Lock className="w-2.5 h-2.5" /> Edit in Settings
                </span>
                {structureOpen
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {structureOpen && (
              <div className="border-t border-gray-100">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  {FEES_STRUCTURE.map((row) => (
                    <div key={row.std} className="bg-white px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{row.std}</p>
                      <p className="text-sm font-bold text-school-navy mt-0.5">₹{row.amount.toLocaleString("en-IN")}</p>
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
              {reminderOpen
                ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {reminderOpen && (
              <div className="border-t border-gray-100 p-5 space-y-4">

                {/* Recipient toggle */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Send To</label>
                  <div className="flex gap-2">
                    {[
                      { key: "all",        label: "All Students" },
                      { key: "incomplete", label: "Incomplete Fees" },
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

                {/* All — custom message */}
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

                {/* Incomplete — auto message */}
                {msgRecipient === "incomplete" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Date for Payment</label>
                      <input
                        type="date" value={msgLastDate} min={todayStr}
                        onChange={(e) => setMsgLastDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                      />
                    </div>
                    {incompleteStudents.length === 0 ? (
                      <p className="text-sm text-green-600 font-semibold">All students have cleared their fees!</p>
                    ) : (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        {incompleteStudents.map((s) => {
                          const { dueFees } = calcSummary(s);
                          const checked = selectedIncomplete.has(s.enrollment);
                          return (
                            <div
                              key={s.enrollment}
                              onClick={() => toggleIncomplete(s.enrollment)}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${checked ? "bg-blue-50/50" : "bg-white"}`}
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
                    {selectedIncomplete.size > 0 && (() => {
                      const first = incompleteStudents.find((s) => selectedIncomplete.has(s.enrollment));
                      if (!first) return null;
                      return (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                            Message Preview
                            <span className="ml-1 text-gray-400 font-normal normal-case">(personalized per student)</span>
                          </label>
                          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {buildReminderMsg(first, msgLastDate)}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Each student gets their own due amount · Sent on: {todayDisplay}
                          </p>
                        </div>
                      );
                    })()}
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

        {/* ══ Fee Entry ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
              const { totalFees, discount, actualFees, paidFees, dueFees } = calcSummary(entryStudent);
              return (
                <div className="space-y-4">

                  {/* Summary pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <SummaryPill label="Total Fees"  value={`₹${totalFees.toLocaleString("en-IN")}`}  colorClass="bg-blue-50 border-blue-100 text-blue-800" />
                    <SummaryPill label="Discount"    value={`₹${discount.toLocaleString("en-IN")}`}   colorClass="bg-amber-50 border-amber-100 text-amber-800" subLabel={entryStudent.discount?.reason || "No discount"} />
                    <SummaryPill label="Actual Fees" value={`₹${actualFees.toLocaleString("en-IN")}`} colorClass="bg-purple-50 border-purple-100 text-purple-800" />
                    <SummaryPill label="Paid Fees"   value={`₹${paidFees.toLocaleString("en-IN")}`}   colorClass="bg-green-50 border-green-100 text-green-800" />
                    <SummaryPill
                      label="Due Fees"
                      value={dueFees <= 0 ? "Cleared ✓" : `₹${dueFees.toLocaleString("en-IN")}`}
                      colorClass={dueFees <= 0 ? "bg-gray-50 border-gray-100 text-gray-600" : "bg-red-50 border-red-100 text-red-700"}
                    />
                  </div>

                  {/* Payment History */}
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Payment History</p>
                      <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                        {entryStudent.payments.length} payment{entryStudent.payments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {entryStudent.payments.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">No payments recorded yet</p>
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
                          {entryStudent.payments.map((p, i) => (
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

                  {/* Inventory Given */}
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Inventory Given</p>
                      <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Package className="w-2.5 h-2.5" /> {entryStudent.inventory.length} item{entryStudent.inventory.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {entryStudent.inventory.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">No inventory distributed yet</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {entryStudent.inventory.map((inv, i) => (
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

                  {/* Pending Inventory */}
                  {pendingItems.length > 0 && (
                    <div className="border border-amber-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Pending Inventory</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">Tick items given today — date auto-assigned</p>
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                          {pendingItems.length} pending
                        </span>
                      </div>
                      <div className="divide-y divide-amber-50/60 bg-white">
                        {pendingItems.map((item) => {
                          const checked = pendingInventory.has(item);
                          return (
                            <div
                              key={item}
                              onClick={() => togglePendingItem(item)}
                              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50/30 transition-colors ${checked ? "bg-amber-50/50" : ""}`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-amber-500 border-amber-500" : "border-gray-300"}`}>
                                {checked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <Package className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800">{item}</span>
                              </div>
                              {checked && (
                                <span className="text-[11px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                  Given today · {todayLong()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {pendingInventory.size > 0 && (
                        <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex justify-end">
                          <button
                            onClick={handleSaveInventory}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
                          >
                            <Package className="w-4 h-4" />
                            Save Inventory ({pendingInventory.size} item{pendingInventory.size !== 1 ? "s" : ""})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* New Payment Form */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <IndianRupee className="w-3.5 h-3.5" /> Record New Payment
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm pointer-events-none">₹</span>
                          <input
                            type="number" placeholder="0" value={newAmt} min="0"
                            onChange={(e) => setNewAmt(e.target.value)}
                            className="w-full pl-7 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Payment <span className="text-red-500">*</span></label>
                        <input
                          type="date" value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received By <span className="text-red-500">*</span></label>
                        <SelectField value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)}>
                          <option value="">Select Admin</option>
                          {ADMINS.map((a) => <option key={a}>{a}</option>)}
                        </SelectField>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleSavePayment}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                      >
                        <Check className="w-4 h-4" /> Save Payment
                      </button>
                    </div>
                  </div>

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
                  {[...new Set(students.map((s) => s.std))].sort((a, b) => stdOrder.indexOf(a) - stdOrder.indexOf(b))
                    .map((s) => <option key={s}>{s}</option>)}
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
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="bg-gray-50">
                  {["Student", "Std", "Roll", "Mobile", "Paid", "Due", "Status", "Action"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wide ${h === "Paid" || h === "Due" ? "text-right" : h === "Status" || h === "Action" ? "text-center" : "text-left"}`}>
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
                  const { paidFees, dueFees } = calcSummary(s);
                  const status = getPaymentStatus(s);
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
                      <td className="px-4 py-3.5 text-center">
                        {status !== "Full Paid" ? (
                          <button
                            onClick={() => setNotifyStudent(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-school-navy/10 hover:bg-school-navy text-school-navy hover:text-white rounded-lg text-xs font-semibold transition-all"
                          >
                            <Bell className="w-3 h-3" /> Notify
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                          </span>
                        )}
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
