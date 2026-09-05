"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getItems, addItem, addBatch, addUsage, getHistory } from "@/lib/sefInventoryService";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

export default function SefInventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null); // "item" | { type: "batch"|"usage", item }

  const load = useCallback(() => {
    setLoading(true);
    getItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const lowStock = items.filter(i => i.available <= i.lowStockAt);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-school-navy">SEF Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock items — books, stationery, and supplies</p>
        </div>
        <button onClick={() => setModal("item")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Low Stock</p>
            <p className="text-xs text-amber-600 mt-0.5">{lowStock.map(i => i.name).join(", ")}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Package className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-400">No inventory items added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map(item => {
              const low = item.available <= item.lowStockAt;
              const isOpen = expanded === item.id;
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <button onClick={() => setExpanded(isOpen ? null : item.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.totalIn} in · {item.totalUsed} used</p>
                      </div>
                    </button>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${low ? "text-red-600" : "text-green-600"}`}>{item.available} {item.unit}</p>
                      {low && <p className="text-[10px] font-bold text-red-500">LOW STOCK</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setModal({ type: "batch", item })} title="Add Stock" className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                        <ArrowDownCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => setModal({ type: "usage", item })} title="Record Usage" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <ArrowUpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isOpen && <ItemHistory itemId={item.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal === "item" && <AddItemModal onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "batch" && <StockModal type="batch" item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {modal?.type === "usage" && <StockModal type="usage" item={modal.item} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ItemHistory({ itemId }) {
  const [history, setHistory] = useState(null);
  useEffect(() => { getHistory(itemId).then(setHistory).catch(() => {}); }, [itemId]);
  if (!history) return <div className="px-10 py-3 text-xs text-gray-400">Loading history…</div>;
  return (
    <div className="px-10 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Stock In</p>
        {history.batches.length === 0 ? <p className="text-xs text-gray-400">None yet</p> : (
          <div className="space-y-1">
            {history.batches.map(b => (
              <p key={b.id} className="text-xs text-gray-600">+{b.qty} on {b.received_date}{b.received_by ? ` · ${b.received_by}` : ""}</p>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Stock Out</p>
        {history.usages.length === 0 ? <p className="text-xs text-gray-400">None yet</p> : (
          <div className="space-y-1">
            {history.usages.map(u => (
              <p key={u.id} className="text-xs text-gray-600">-{u.qty} on {u.usage_date}{u.used_by ? ` · ${u.used_by}` : ""}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddItemModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [lowStockAt, setLowStockAt] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Enter item name"); return; }
    setError(""); setSaving(true);
    try {
      await addItem({ name: name.trim(), unit: unit.trim() || "pcs", lowStockAt: Number(lowStockAt) || 10 });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Add Item</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className={LBL}>Item Name *</label><input className={IPT} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className={LBL}>Unit</label><input className={IPT} placeholder="e.g. pcs, box, set" value={unit} onChange={e => setUnit(e.target.value)} /></div>
          <div><label className={LBL}>Low Stock Alert At</label><input type="number" className={IPT} value={lowStockAt} onChange={e => setLowStockAt(e.target.value)} /></div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockModal({ type, item, onClose, onSaved }) {
  const isBatch = type === "batch";
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const q = Number(qty);
    if (!q || q <= 0) { setError("Enter a valid quantity"); return; }
    setError(""); setSaving(true);
    try {
      if (isBatch) await addBatch(item.id, { qty: q, receivedDate: date, receivedBy: who, note });
      else await addUsage(item.id, { qty: q, usageDate: date, usedBy: who, note });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">{isBatch ? "Add Stock" : "Record Usage"} — {item.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className={LBL}>Quantity *</label><input type="number" className={IPT} value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className={LBL}>Date *</label><DateInputDMY className={IPT} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label className={LBL}>{isBatch ? "Received By" : "Used By"}</label><input className={IPT} value={who} onChange={e => setWho(e.target.value)} /></div>
          <div><label className={LBL}>Note</label><input className={IPT} value={note} onChange={e => setNote(e.target.value)} /></div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
