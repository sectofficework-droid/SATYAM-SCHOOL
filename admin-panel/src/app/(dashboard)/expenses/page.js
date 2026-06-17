"use client";

import { useState, useMemo, useEffect } from "react";
import { getExpenses, addExpense, deleteExpense } from "@/lib/expensesService";
import {
  IndianRupee, Plus, Search, Trash2, X, Check,
  ChevronDown, Download, FileSpreadsheet, TrendingDown,
  Calendar, User, Tag, FileText, SlidersHorizontal,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isPositiveAmount, isValidLength } from "@/lib/validators";

// ── Constants ──────────────────────────────────────────────────
const CATEGORIES = ["Salary", "Infrastructure", "Supplies", "Utilities", "Events", "Maintenance", "Transport", "Other"];

const CAT_COLOR = {
  Salary:         "bg-blue-100 text-blue-700",
  Infrastructure: "bg-purple-100 text-purple-700",
  Supplies:       "bg-amber-100 text-amber-700",
  Utilities:      "bg-teal-100 text-teal-700",
  Events:         "bg-pink-100 text-pink-700",
  Maintenance:    "bg-orange-100 text-orange-700",
  Transport:      "bg-indigo-100 text-indigo-700",
  Other:          "bg-gray-100 text-gray-600",
};

const PAID_BY = [
  "Sunil Pradhan", "Rajesh Biswal", "BK Debiprasad Das",
  "Sandeep Pradhan", "Gaurang Polai", "Rudra Prasad Muni", "Ayeshkant Rout",
];

const TODAY = new Date().toISOString().split("T")[0];


function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return d; }
}

function fmtAmt(n) { return "₹" + Number(n).toLocaleString("en-IN"); }

// ── Add Expense Modal ───────────────────────────────────────────
function AddExpenseModal({ onClose, onSave }) {
  const [title,    setTitle]    = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount,   setAmount]   = useState("");
  const [date,     setDate]     = useState(TODAY);
  const [paidBy,   setPaidBy]   = useState(PAID_BY[0]);
  const [note,     setNote]     = useState("");

  const titleValid  = isValidLength(title, 100, 2);
  const amountValid = isPositiveAmount(amount, 1000000);
  const valid = titleValid && amountValid && date;

  function handleSave() {
    if (!valid) return;
    onSave({ title: title.trim(), category, amount: Number(amount), date, paidBy, note: note.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Add Expense</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
              placeholder="e.g. Electricity Bill — June 2026" value={title} onChange={e => setTitle(e.target.value)} />
            {title.length > 0 && !titleValid && (
              <p className="text-xs text-red-500 mt-1">Title must be 2-100 characters</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category *</label>
              <div className="relative">
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white pr-9">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₹) *</label>
              <div className="relative">
                <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                <input type="number" min="1" className="w-full border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                  placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              {amount.length > 0 && !amountValid && (
                <p className="text-xs text-red-500 mt-1">Enter an amount between ₹1 and ₹10,00,000</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Paid By</label>
              <div className="relative">
                <select value={paidBy} onChange={e => setPaidBy(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white pr-9">
                  {PAID_BY.map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional description…"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none"/>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
            Add Expense
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ExpensesPage() {
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [addOpen,     setAddOpen]     = useState(false);

  useEffect(() => {
    getExpenses()
      .then(data => { setExpenses(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => e.date.slice(0, 7)));
    return [...set].sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => expenses.filter(e => {
    const ms = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.paidBy.toLowerCase().includes(search.toLowerCase());
    const mc = catFilter === "all" || e.category === catFilter;
    const mm = monthFilter === "all" || e.date.startsWith(monthFilter);
    return ms && mc && mm;
  }).sort((a, b) => b.date.localeCompare(a.date)), [expenses, search, catFilter, monthFilter]);

  const totalAll     = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth    = new Date().toISOString().slice(0, 7);
  const totalMonth   = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0);
  const catTotals    = CATEGORIES.map(c => ({ cat: c, total: expenses.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0) }));
  const topCat       = catTotals.sort((a, b) => b.total - a.total)[0];

  async function handleAdd(exp) {
    try {
      const saved = await addExpense(exp);
      setExpenses(prev => [saved, ...prev]);
    } catch { }
    setAddOpen(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this expense?")) return;
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch { }
  }

  function exportExcel() {
    const rows = filtered.map(e => ({
      Date: fmtDate(e.date), Title: e.title, Category: e.category,
      "Amount (₹)": e.amount, "Paid By": e.paidBy, Note: e.note,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, "Expenses.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14); doc.setTextColor(30, 58, 95);
    doc.text("Expenses Report — Satyam Stars International School", 40, 36);
    autoTable(doc, {
      startY: 50,
      head: [["Date", "Title", "Category", "Amount (₹)", "Paid By", "Note"]],
      body: filtered.map(e => [fmtDate(e.date), e.title, e.category, fmtAmt(e.amount), e.paidBy, e.note]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95] },
    });
    doc.save("Expenses.pdf");
  }

  return (
    <>
      {addOpen && <AddExpenseModal onClose={() => setAddOpen(false)} onSave={handleAdd}/>}
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Expenses</h2>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage all school expenditures</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-200 text-green-700 bg-green-50 text-xs font-bold hover:bg-green-100 transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5"/> Excel
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-red-50 text-xs font-bold hover:bg-red-100 transition-colors">
              <Download className="w-3.5 h-3.5"/> PDF
            </button>
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <Plus className="w-4 h-4"/> Add Expense
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total (All Time)", value: fmtAmt(totalAll),   icon: IndianRupee,  bg: "bg-blue-50",   color: "text-blue-600"  },
            { label: "This Month",       value: fmtAmt(totalMonth),  icon: Calendar,     bg: "bg-amber-50",  color: "text-amber-600" },
            { label: "Total Entries",    value: expenses.length,     icon: FileText,     bg: "bg-purple-50", color: "text-purple-600"},
            { label: "Top Category",     value: topCat?.cat || "—",  icon: Tag,          bg: "bg-rose-50",   color: "text-rose-600"  },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`}/>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-base font-bold text-gray-800 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-700 mb-3">Category Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {catTotals.filter(c => c.total > 0).sort((a,b) => b.total - a.total).map(({ cat, total }) => (
              <div key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${CAT_COLOR[cat]}`}>
                <span>{cat}</span>
                <span className="opacity-70">{fmtAmt(total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
              <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                placeholder="Search title or paid by…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:outline-none bg-white appearance-none cursor-pointer">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
              <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:outline-none bg-white appearance-none cursor-pointer">
                <option value="all">All Months</option>
                {months.map(m => <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month:"long", year:"numeric" })}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
            </div>
            <span className="text-xs text-gray-400 font-medium ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "700px" }}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Paid By</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Note</th>
                  <th className="px-5 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Loading expenses…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No expenses found.</td></tr>
                )}
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{e.title}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${CAT_COLOR[e.category]}`}>{e.category}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-gray-800 whitespace-nowrap">{fmtAmt(e.amount)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{e.paidBy}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 italic max-w-[180px] truncate">{e.note || "—"}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleDelete(e.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td colSpan={3} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total ({filtered.length} records)</td>
                    <td className="px-5 py-3 text-right font-bold text-school-navy whitespace-nowrap">
                      {fmtAmt(filtered.reduce((s, e) => s + e.amount, 0))}
                    </td>
                    <td colSpan={3}/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
