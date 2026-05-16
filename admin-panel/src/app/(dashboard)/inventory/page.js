"use client";

import { Fragment, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package, Plus, AlertTriangle, Search, TrendingDown,
  Users, Archive, X, ArrowUpCircle, MinusCircle, Info,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const RECEIVERS = ["Sunil Pradhan", "Rajesh Pradhan", "Other"];
const TODAY = new Date().toISOString().split("T")[0];

// ── Initial Data ──────────────────────────────────────────────────────────────
const INITIAL_INVENTORY = [
  {
    id: 1, name: "School Bag", category: "student", unit: "Pcs", lowStockAt: 10,
    batches: [{ id: 1, qty: 150, date: "2026-05-01", by: "Sunil Pradhan", note: "Opening stock 2026-27" }],
    usages:  [{ id: 1, qty: 98,  date: "2026-06-05", purpose: "student", note: "Distributed Std 1–5", by: "Sunil Pradhan" }],
    studentsTotal: 110, studentsGiven: 98,
  },
  {
    id: 2, name: "Uniform (Set)", category: "student", unit: "Sets", lowStockAt: 10,
    batches: [{ id: 1, qty: 200, date: "2026-05-03", by: "Rajesh Pradhan", note: "Summer uniform 2026-27" }],
    usages:  [{ id: 1, qty: 105, date: "2026-06-01", purpose: "student", note: "Distributed", by: "Rajesh Pradhan" }],
    studentsTotal: 110, studentsGiven: 105,
  },
  {
    id: 3, name: "Textbooks (Set)", category: "student", unit: "Sets", lowStockAt: 8,
    batches: [
      { id: 1, qty: 120, date: "2026-05-10", by: "Sunil Pradhan", note: "Academic year 2026-27" },
      { id: 2, qty: 30,  date: "2026-05-20", by: "Sunil Pradhan", note: "Additional stock" },
    ],
    usages: [{ id: 1, qty: 110, date: "2026-06-07", purpose: "student", note: "All classes", by: "Sunil Pradhan" }],
    studentsTotal: 110, studentsGiven: 110,
  },
  {
    id: 4, name: "Notebooks (Set)", category: "student", unit: "Sets", lowStockAt: 15,
    batches: [{ id: 1, qty: 130, date: "2026-05-10", by: "Sunil Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 108, date: "2026-06-05", purpose: "student", note: "", by: "Rajesh Pradhan" }],
    studentsTotal: 110, studentsGiven: 108,
  },
  {
    id: 5, name: "School Diary", category: "student", unit: "Pcs", lowStockAt: 5,
    batches: [{ id: 1, qty: 115, date: "2026-05-15", by: "Sunil Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 110, date: "2026-06-05", purpose: "student", note: "", by: "Sunil Pradhan" }],
    studentsTotal: 110, studentsGiven: 110,
  },
  {
    id: 6, name: "ID Card", category: "student", unit: "Pcs", lowStockAt: 10,
    batches: [{ id: 1, qty: 120, date: "2026-05-20", by: "Rajesh Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 95,  date: "2026-06-10", purpose: "student", note: "", by: "Rajesh Pradhan" }],
    studentsTotal: 110, studentsGiven: 95,
  },
  {
    id: 7, name: "Whiteboard Marker", category: "office", unit: "Box", lowStockAt: 3,
    batches: [{ id: 1, qty: 20, date: "2026-05-01", by: "Sunil Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 18, date: "2026-06-01", purpose: "office", note: "Staff room + classrooms", by: "Sunil Pradhan" }],
    studentsTotal: 0, studentsGiven: 0,
  },
  {
    id: 8, name: "Chalk Box", category: "office", unit: "Box", lowStockAt: 5,
    batches: [{ id: 1, qty: 30, date: "2026-05-01", by: "Sunil Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 24, date: "2026-06-01", purpose: "office", note: "All classrooms", by: "Rajesh Pradhan" }],
    studentsTotal: 0, studentsGiven: 0,
  },
  {
    id: 9, name: "Printer Paper", category: "office", unit: "Ream", lowStockAt: 5,
    batches: [{ id: 1, qty: 50, date: "2026-05-05", by: "Rajesh Pradhan", note: "" }],
    usages:  [{ id: 1, qty: 48, date: "2026-06-10", purpose: "office", note: "Office use", by: "Rajesh Pradhan" }],
    studentsTotal: 0, studentsGiven: 0,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const totalIn   = (item) => item.batches.reduce((s, b) => s + b.qty, 0);
const totalUsed = (item) => item.usages.reduce((s, u) => s + u.qty, 0);
const avail     = (item) => totalIn(item) - totalUsed(item);
const isLow     = (item) => avail(item) > 0 && avail(item) <= item.lowStockAt;
const isOut     = (item) => avail(item) <= 0;
const pending   = (item) => item.category === "student" ? item.studentsTotal - item.studentsGiven : 0;

const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${day} ${months[+m - 1]} ${y}`;
};

// ── Shared input style ────────────────────────────────────────────────────────
const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors";

// ── Add Stock Modal ───────────────────────────────────────────────────────────
function AddStockModal({ items, onClose, onSave }) {
  const [tab, setTab]           = useState("existing");
  const [selId, setSelId]       = useState(items[0]?.id ?? "");
  const [newName, setNewName]   = useState("");
  const [newCat, setNewCat]     = useState("student");
  const [newUnit, setNewUnit]   = useState("Pcs");
  const [newLow, setNewLow]     = useState("10");
  const [qty, setQty]           = useState("");
  const [date, setDate]         = useState(TODAY);
  const [by, setBy]             = useState("");
  const [byCustom, setByCustom] = useState("");
  const [note, setNote]         = useState("");
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);

  const receivedBy = by === "Other" ? byCustom.trim() : by;
  const valid =
    receivedBy && qty && Number(qty) > 0 && date &&
    (tab === "existing" ? !!selId : !!newName.trim());

  const handleSave = () => {
    if (!valid) return;
    onSave({
      tab,
      selId: tab === "existing" ? Number(selId) : null,
      newItem: tab === "new" ? {
        name: newName.trim(),
        category: newCat,
        unit: newUnit.trim() || "Pcs",
        lowStockAt: Number(newLow) || 10,
      } : null,
      batch: { qty: Number(qty), date, by: receivedBy, note: note.trim() },
    });
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Add Stock</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {[["existing", "Existing Item"], ["new", "New Item"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 pt-3.5 px-1 mr-5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? "border-school-navy text-school-navy" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {tab === "existing" ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Item</label>
              <select value={selId} onChange={(e) => setSelId(e.target.value)} className={IPT}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit}) — Available: {avail(item)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item Name *</label>
                <input className={IPT} placeholder="e.g. Sports Kit" value={newName}
                  onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category *</label>
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={IPT}>
                    <option value="student">Student</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit</label>
                  <input className={IPT} placeholder="Pcs / Sets / Box" value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Low Stock Alert At
                </label>
                <div className="relative">
                  <input type="number" min="1" className={IPT} value={newLow}
                    onChange={(e) => setNewLow(e.target.value)} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    {newUnit || "Pcs"}
                  </span>
                </div>
              </div>
              {newCat === "student" && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    This student item will appear in the Student module and Fees module automatically when integrated.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity *</label>
                <input type="number" min="1" className={IPT} placeholder="0" value={qty}
                  onChange={(e) => setQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
                <input type="date" className={IPT} value={date}
                  onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received By *</label>
              <select value={by} onChange={(e) => { setBy(e.target.value); setByCustom(""); }} className={IPT}>
                <option value="">Select Name</option>
                {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {by === "Other" && (
                <input className={`${IPT} mt-2`} placeholder="Enter name..."
                  value={byCustom} onChange={(e) => setByCustom(e.target.value)} />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
              <input className={IPT} placeholder="Optional note..." value={note}
                onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
            Add Stock
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Record Usage Modal ────────────────────────────────────────────────────────
function UseStockModal({ items, onClose, onSave }) {
  const [purpose, setPurpose]   = useState("student");
  const [selId, setSelId]       = useState("");
  const [qty, setQty]           = useState("");
  const [date, setDate]         = useState(TODAY);
  const [by, setBy]             = useState("");
  const [byCustom, setByCustom] = useState("");
  const [note, setNote]         = useState("");
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);

  const eligibleItems = purpose === "student"
    ? items.filter((i) => i.category === "student" && avail(i) > 0)
    : items.filter((i) => avail(i) > 0);

  const selectedItem = items.find((i) => i.id === Number(selId));
  const availQty     = selectedItem ? avail(selectedItem) : 0;
  const receivedBy   = by === "Other" ? byCustom.trim() : by;
  const qtyNum       = Number(qty);
  const valid = receivedBy && selId && qty && qtyNum > 0 && qtyNum <= availQty && date;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      itemId: Number(selId),
      usage: { qty: qtyNum, date, purpose, note: note.trim(), by: receivedBy },
      isStudentDist: purpose === "student" && selectedItem?.category === "student",
    });
  };

  const PURPOSES = [
    { key: "student", label: "Student Distribution" },
    { key: "office",  label: "Office Use" },
    { key: "other",   label: "Other Purpose" },
  ];

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Record Usage</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Purpose *</label>
            <div className="grid grid-cols-3 gap-2">
              {PURPOSES.map(({ key, label }) => (
                <button key={key} onClick={() => { setPurpose(key); setSelId(""); }}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors text-center leading-snug ${
                    purpose === key
                      ? "border-school-navy bg-school-navy/5 text-school-navy"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Item *
              {purpose === "student" && (
                <span className="font-normal text-gray-400 ml-1">(student items only)</span>
              )}
            </label>
            <select value={selId} onChange={(e) => setSelId(e.target.value)} className={IPT}>
              <option value="">Choose item...</option>
              {eligibleItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — Available: {avail(item)} {item.unit}
                </option>
              ))}
            </select>
            {selectedItem && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                Available:{" "}
                <span className={`font-bold ${isLow(selectedItem) ? "text-amber-600" : "text-green-600"}`}>
                  {avail(selectedItem)} {selectedItem.unit}
                </span>
                {purpose === "student" && ` · Students pending: ${pending(selectedItem)}`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity *</label>
              <input type="number" min="1" className={IPT} placeholder="0" value={qty}
                onChange={(e) => setQty(e.target.value)} />
              {qty && qtyNum > availQty && availQty > 0 && (
                <p className="text-[11px] text-red-500 mt-1">Exceeds available ({availQty})</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
              <input type="date" className={IPT} value={date}
                onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Issued By *</label>
            <select value={by} onChange={(e) => { setBy(e.target.value); setByCustom(""); }} className={IPT}>
              <option value="">Select Name</option>
              {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {by === "Other" && (
              <input className={`${IPT} mt-2`} placeholder="Enter name..."
                value={byCustom} onChange={(e) => setByCustom(e.target.value)} />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
            <input className={IPT} placeholder="e.g. Distributed to Std 6 students"
              value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {purpose === "student" && selId && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
              <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Student distribution auto-deducts from stock and updates the student coverage count.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
            Save Usage
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [items, setItems]           = useState(INITIAL_INVENTORY);
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("all");
  const [stFilter, setStFilter]     = useState("all");
  const [sortPending, setSortPending] = useState(false);
  const [expanded, setExpanded]     = useState({});
  const [addOpen, setAddOpen]       = useState(false);
  const [useOpen, setUseOpen]       = useState(false);

  // Derived stats
  const lowItems     = items.filter(isLow);
  const outItems     = items.filter(isOut);
  const studentItems = items.filter((i) => i.category === "student");
  const totalPending = studentItems.reduce((s, i) => s + pending(i), 0);

  // Filtered + sorted list
  const filtered = items
    .filter((item) => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchCat    = catFilter === "all" || item.category === catFilter;
      const matchSt     =
        stFilter === "all" ||
        (stFilter === "low" && isLow(item)) ||
        (stFilter === "out" && isOut(item));
      return matchSearch && matchCat && matchSt;
    })
    .sort((a, b) => (sortPending ? pending(b) - pending(a) : a.id - b.id));

  const toggleExpand = (itemId, key) =>
    setExpanded((prev) => ({ ...prev, [itemId]: prev[itemId] === key ? null : key }));

  const handleAddStock = (payload) => {
    setItems((prev) => {
      if (payload.tab === "existing") {
        return prev.map((item) =>
          item.id === payload.selId
            ? { ...item, batches: [...item.batches, { id: Date.now(), ...payload.batch }] }
            : item
        );
      }
      const newId = Math.max(...prev.map((i) => i.id)) + 1;
      return [
        ...prev,
        {
          id: newId,
          ...payload.newItem,
          studentsGiven: 0,
          studentsTotal: payload.newItem.category === "student" ? 0 : 0,
          batches: [{ id: Date.now(), ...payload.batch }],
          usages: [],
        },
      ];
    });
    setAddOpen(false);
  };

  const handleUseStock = (payload) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== payload.itemId) return item;
        return {
          ...item,
          usages: [...item.usages, { id: Date.now(), ...payload.usage }],
          studentsGiven: payload.isStudentDist
            ? Math.min(item.studentsTotal, item.studentsGiven + payload.usage.qty)
            : item.studentsGiven,
        };
      })
    );
    setUseOpen(false);
  };

  const CAT_COLOR = {
    student: "bg-blue-50 text-blue-600",
    office:  "bg-purple-50 text-purple-600",
    other:   "bg-gray-100 text-gray-500",
  };

  const PURPOSE_COLOR = {
    student: "bg-blue-50 text-blue-600",
    office:  "bg-purple-50 text-purple-600",
    other:   "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Inventory Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Stock tracking, distribution & low stock alerts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setUseOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <MinusCircle className="w-4 h-4" />
            Record Usage
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Add Stock
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Items",       value: items.length,      icon: Package,    bg: "bg-blue-50",   color: "text-blue-600" },
          { label: "Low Stock",         value: lowItems.length,   icon: TrendingDown, bg: "bg-amber-50", color: "text-amber-600" },
          { label: "Out of Stock",      value: outItems.length,   icon: Archive,    bg: "bg-red-50",    color: "text-red-600" },
          { label: "Students Pending",  value: totalPending,      icon: Users,      bg: "bg-purple-50", color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Stock Alerts ── */}
      {(lowItems.length > 0 || outItems.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-800">Stock Alerts</h3>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-full">
              {lowItems.length + outItems.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {outItems.map((item) => (
              <div key={item.id}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700">{item.name}</span>
                <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">OUT OF STOCK</span>
              </div>
            ))}
            {lowItems.map((item) => (
              <div key={item.id}
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-700">{item.name}</span>
                <span className="text-[10px] text-amber-600">{avail(item)} {item.unit} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
              placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {/* Category */}
          <div className="flex gap-2 flex-wrap">
            {[["all","All"],["student","Student"],["office","Office"],["other","Other"]].map(([k, l]) => (
              <button key={k} onClick={() => setCatFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  catFilter === k
                    ? "bg-school-navy text-white border-school-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>{l}</button>
            ))}
          </div>
          {/* Status */}
          <div className="flex gap-2">
            {[["all","All Status"],["low","Low Stock"],["out","Out of Stock"]].map(([k, l]) => (
              <button key={k} onClick={() => setStFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  stFilter === k
                    ? k === "out" ? "bg-red-500 text-white border-red-500"
                    : k === "low" ? "bg-amber-500 text-white border-amber-500"
                    : "bg-school-navy text-white border-school-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>{l}</button>
            ))}
          </div>
          {/* Sort by pending */}
          <button onClick={() => setSortPending((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              sortPending ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}>
            <Users className="w-3.5 h-3.5" />
            Sort by Pending
          </button>
        </div>
      </div>

      {/* ── Inventory Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total In</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Used</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Available</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Students Pending</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-gray-400 text-sm">
                    No items match your filters
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <Fragment key={item.id}>
                  {/* Main row */}
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{item.name}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${CAT_COLOR[item.category]}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                      {totalIn(item)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                      {totalUsed(item)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={`font-bold ${isOut(item) ? "text-red-600" : isLow(item) ? "text-amber-600" : "text-green-600"}`}>
                        {avail(item)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {item.category === "student" ? (
                        pending(item) > 0
                          ? <span className="font-semibold text-purple-600">{pending(item)} students</span>
                          : <span className="text-xs text-green-500 font-semibold">All received</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isOut(item) ? (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[11px] font-bold rounded-full">Out</span>
                      ) : isLow(item) ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-full">Low</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[11px] font-bold rounded-full">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleExpand(item.id, "batches")}
                          title="Stock in history"
                          className={`p-1.5 rounded-lg transition-colors ${
                            expanded[item.id] === "batches"
                              ? "bg-blue-100 text-blue-700"
                              : "hover:bg-gray-100 text-gray-400"
                          }`}>
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleExpand(item.id, "usages")}
                          title="Usage history"
                          className={`p-1.5 rounded-lg transition-colors ${
                            expanded[item.id] === "usages"
                              ? "bg-purple-100 text-purple-700"
                              : "hover:bg-gray-100 text-gray-400"
                          }`}>
                          <MinusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Batch history */}
                  {expanded[item.id] === "batches" && (
                    <tr>
                      <td colSpan={8} className="px-5 pb-4 bg-blue-50/40">
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide pt-3 mb-2">
                          Stock In History
                        </p>
                        <div className="space-y-1.5">
                          {item.batches.map((b) => (
                            <div key={b.id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-white border border-blue-100 rounded-xl px-3.5 py-2 text-xs">
                              <span className="font-bold text-blue-700">+{b.qty} {item.unit}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">{fmtDate(b.date)}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">{b.by}</span>
                              {b.note && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span className="text-gray-500 italic">{b.note}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Usage history */}
                  {expanded[item.id] === "usages" && (
                    <tr>
                      <td colSpan={8} className="px-5 pb-4 bg-purple-50/30">
                        <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wide pt-3 mb-2">
                          Usage History
                        </p>
                        {item.usages.length === 0 ? (
                          <p className="text-xs text-gray-400">No usage recorded yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {item.usages.map((u) => (
                              <div key={u.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-white border border-purple-100 rounded-xl px-3.5 py-2 text-xs">
                                <span className="font-bold text-red-600">−{u.qty} {item.unit}</span>
                                <span className="text-gray-300">·</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${PURPOSE_COLOR[u.purpose]}`}>
                                  {u.purpose}
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-600">{fmtDate(u.date)}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-600">{u.by}</span>
                                {u.note && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-gray-500 italic">{u.note}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Student Coverage ── */}
      {studentItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-gray-800">Student Coverage</h3>
            <span className="text-xs text-gray-400">— How many students received each item</span>
          </div>
          <div className="space-y-4">
            {[...studentItems]
              .sort((a, b) => pending(b) - pending(a))
              .map((item) => {
                const pct     = item.studentsTotal > 0 ? Math.round((item.studentsGiven / item.studentsTotal) * 100) : 0;
                const notGiven = item.studentsTotal - item.studentsGiven;
                const barColor =
                  pct === 100 ? "bg-green-500" :
                  pct >= 80   ? "bg-blue-500"  :
                  pct >= 50   ? "bg-amber-500" : "bg-red-400";
                return (
                  <div key={item.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                      <span className="text-xs text-gray-500">
                        <span className="font-bold text-gray-700">{item.studentsGiven}</span>
                        {" / "}{item.studentsTotal} students
                        {notGiven > 0 && (
                          <span className="text-purple-600 font-semibold ml-2">{notGiven} pending</span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{pct}% distributed</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <AddStockModal items={items} onClose={() => setAddOpen(false)} onSave={handleAddStock} />
      )}
      {useOpen && (
        <UseStockModal items={items} onClose={() => setUseOpen(false)} onSave={handleUseStock} />
      )}
    </div>
  );
}
