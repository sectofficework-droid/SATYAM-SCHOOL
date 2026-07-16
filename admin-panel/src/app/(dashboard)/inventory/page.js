"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import useStore from "@/lib/store";
import { createPortal } from "react-dom";
import { isPositiveAmount, isValidLength } from "@/lib/validators";
import {
  getInventoryItems, addInventoryItem, updateItemAddress, addBatch, addUsage,
  getAssets, addAsset, takeAsset, returnAsset,
} from "@/lib/inventoryService";
import supabase from "@/lib/supabase";
import {
  Package, Plus, AlertTriangle, Search, TrendingDown,
  Users, Archive, X, ArrowUpCircle, MinusCircle, Info,
  MapPin, LogOut, LogIn, Cpu, Clock, ChevronRight,
} from "lucide-react";
import DateInputDMY from "@/components/DateInputDMY";

// ── Constants ─────────────────────────────────────────────────────────────────
const RECEIVERS = ["Sunil Pradhan", "Rajesh Biswal", "BK Debiprasad Das", "Sandeep Pradhan", "Gaurang Polai", "Rudra Prasad Muni", "Ayeshkant Rout", "Other"];
const TODAY     = new Date().toISOString().split("T")[0];


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

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors";

// ── Asset Detail Modal ────────────────────────────────────────────────────────
function AssetDetailModal({ asset, onClose, onTake, onReturn }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const inUse = !!asset.currentCheckout;
  const co    = asset.currentCheckout;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full mb-2 ${
              inUse ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${inUse ? "bg-amber-500" : "bg-green-500"}`} />
              {inUse ? "In Use" : "Available"}
            </span>
            <h3 className="text-lg font-bold text-gray-800">{asset.name}</h3>
            {asset.brand && <p className="text-sm text-gray-400 mt-0.5">{asset.brand}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors mt-1">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {asset.storageAddress && (
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Storage Location</p>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">{asset.storageAddress}</p>
              </div>
            </div>
          )}
          {inUse && co && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">Currently With</p>
              <p className="text-sm font-bold text-gray-800">{co.takenBy}</p>
              <p className="text-xs text-gray-600 mt-0.5 italic">{co.purpose}</p>
              <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysSince(co.takenDate)} · since {fmtDate(co.takenDate)}
              </p>
            </div>
          )}
          {inUse ? (
            <button onClick={onReturn}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> Return Asset
            </button>
          ) : (
            <button onClick={onTake}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Take Asset
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Checkout History</p>
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">
                {asset.checkouts.length}
              </span>
            </div>
            {asset.checkouts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Never checked out.</p>
            ) : (
              <div className="space-y-2">
                {[...asset.checkouts].reverse().map((entry, i) => (
                  <div key={entry.id ?? i}
                    className={`rounded-xl px-4 py-3 border ${!entry.returnDate ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{entry.takenBy}</p>
                      {entry.returnDate ? (
                        <span className="text-[11px] text-green-600 font-bold flex-shrink-0">Returned {fmtDate(entry.returnDate)}</span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-bold flex-shrink-0">Still Out</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 italic mt-0.5">{entry.purpose}</p>
                    <p className="text-[11px] text-gray-400 mt-1">Taken: {fmtDate(entry.takenDate)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Asset Management Modal (full panel) ───────────────────────────────────────
function AssetManagementModal({ assets, onClose, onAddAsset, onTake, onReturn }) {
  const [search, setSearch]         = useState("");
  const [viewAssetId, setViewAssetId] = useState(null);
  const [takeAsset, setTakeAsset]     = useState(null);
  const [returnAsset, setReturnAsset] = useState(null);
  const [addOpen, setAddOpen]         = useState(false);
  const [mounted, setMounted]         = useState(false);
  useEffect(() => setMounted(true), []);

  const viewAssetData = viewAssetId ? assets.find((a) => a.id === viewAssetId) : null;
  const available     = assets.filter((a) => !a.currentCheckout).length;
  const inUseCount    = assets.filter((a) => !!a.currentCheckout).length;

  const filtered = assets.filter((a) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.brand.toLowerCase().includes(search.toLowerCase()) ||
    a.storageAddress.toLowerCase().includes(search.toLowerCase())
  );

  const modal = (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-school-navy rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Asset Management</h2>
              <p className="text-xs text-white/60">Permanent items tracked by checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border border-white/20">
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Assets", value: assets.length,  bg: "bg-blue-50",   color: "text-blue-600",  icon: Cpu },
              { label: "Available",    value: available,       bg: "bg-green-50",  color: "text-green-600", icon: Package },
              { label: "In Use",       value: inUseCount,      bg: "bg-amber-50",  color: "text-amber-600", icon: LogOut },
            ].map(({ label, value, bg, color, icon: Icon }) => (
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors shadow-sm"
              placeholder="Search by name, brand or location..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-10 text-gray-400 text-sm">No assets found</div>
            )}
            {filtered.map((asset) => {
              const inUse = !!asset.currentCheckout;
              const co    = asset.currentCheckout;
              return (
                <button
                  key={asset.id}
                  onClick={() => setViewAssetId(asset.id)}
                  className={`text-left bg-white rounded-2xl border-2 shadow-sm p-4 hover:shadow-md transition-all group cursor-pointer ${
                    inUse ? "border-amber-200 hover:border-amber-400" : "border-gray-100 hover:border-green-300"
                  }`}
                >
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-full mb-3 ${
                    inUse ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${inUse ? "bg-amber-500" : "bg-green-500"}`} />
                    {inUse ? "In Use" : "Available"}
                  </span>
                  <p className="font-bold text-gray-800 text-sm leading-tight">{asset.name}</p>
                  {asset.brand && <p className="text-[11px] text-gray-400 mt-0.5">{asset.brand}</p>}
                  {asset.storageAddress && (
                    <div className="flex items-center gap-1 mt-2.5">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-[11px] text-gray-400 truncate">{asset.storageAddress}</span>
                    </div>
                  )}
                  {inUse && co && (
                    <div className="mt-2.5 pt-2.5 border-t border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 truncate">{co.takenBy}</p>
                      <p className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{daysSince(co.takenDate)}
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-300 group-hover:text-gray-400 transition-colors mt-2.5">
                    Tap for details →
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Nested modals */}
      {addOpen && (
        <AddAssetModal
          onClose={() => setAddOpen(false)}
          onSave={(data) => { onAddAsset(data); setAddOpen(false); }}
        />
      )}
      {viewAssetData && !takeAsset && !returnAsset && (
        <AssetDetailModal
          asset={viewAssetData}
          onClose={() => setViewAssetId(null)}
          onTake={() => setTakeAsset(viewAssetData)}
          onReturn={() => setReturnAsset(viewAssetData)}
        />
      )}
      {takeAsset && (
        <TakeAssetModal
          asset={takeAsset}
          onClose={() => setTakeAsset(null)}
          onSave={(assetId, checkout) => { onTake(assetId, checkout); setTakeAsset(null); }}
        />
      )}
      {returnAsset && (
        <ReturnAssetModal
          asset={returnAsset}
          onClose={() => setReturnAsset(null)}
          onSave={(assetId, returnDate, note) => { onReturn(assetId, returnDate, note); setReturnAsset(null); }}
        />
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Add Stock Modal ───────────────────────────────────────────────────────────
function AddStockModal({ items, onClose, onSave }) {
  const [tab, setTab]           = useState("existing");
  const [selId, setSelId]       = useState(items[0]?.id ?? "");
  const [newName, setNewName]   = useState("");
  const [newCat, setNewCat]     = useState("student");
  const [newUnit, setNewUnit]   = useState("Pcs");
  const [newLow, setNewLow]     = useState("10");
  const [newAddr, setNewAddr]   = useState("");
  const [qty, setQty]           = useState("");
  const [date, setDate]         = useState(TODAY);
  const [by, setBy]             = useState("");
  const [byCustom, setByCustom] = useState("");
  const [note, setNote]         = useState("");
  const [location, setLocation] = useState(() => items.find(i => i.id === items[0]?.id)?.storageAddress || "");
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (tab === "existing" && selId) {
      const found = items.find(i => i.id === selId);
      setLocation(found?.storageAddress || "");
    }
  }, [selId, tab]);

  const receivedBy = by === "Other" ? byCustom.trim() : by;
  const qtyValid = isPositiveAmount(qty, 100000);
  const valid =
    receivedBy && qtyValid && date &&
    (tab === "existing" ? !!selId : !!newName.trim());

  const handleSave = () => {
    if (!valid) return;
    onSave({
      tab,
      selId: tab === "existing" ? selId : null,
      newItem: tab === "new" ? {
        name: newName.trim(), category: newCat,
        unit: newUnit.trim() || "Pcs", lowStockAt: Number(newLow) || 10,
        storageAddress: newAddr.trim(),
      } : null,
      batch: { qty: Number(qty), date, by: receivedBy, note: note.trim(), location: location.trim() },
      location: location.trim(),
    });
  };

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Add Stock</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {[["existing","Existing Item"],["new","New Item"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-3 pt-3.5 px-1 mr-5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? "border-school-navy text-school-navy" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>{l}</button>
          ))}
        </div>
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
              {selId && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Storage Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      className={`${IPT} pl-9`}
                      placeholder="e.g. Store Room 1, Rack A"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Updates the stored address for this item and is saved with this batch.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item Name *</label>
                <input className={IPT} placeholder="e.g. Sports Kit" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category *</label>
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={IPT}>
                    <option value="student">Student</option>
                    <option value="stock">Stock Only</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit</label>
                  <input className={IPT} placeholder="Pcs / Sets / Box" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Low Stock Alert At</label>
                <div className="relative">
                  <input type="number" min="1" className={IPT} value={newLow} onChange={(e) => setNewLow(e.target.value)} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{newUnit || "Pcs"}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Storage Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input className={`${IPT} pl-9`} placeholder="e.g. Store Room 1, Rack A" value={newAddr} onChange={(e) => setNewAddr(e.target.value)} />
                </div>
              </div>
              {newCat === "student" && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
                  <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">This item will appear in the Student and Fees modules when integrated.</p>
                </div>
              )}
            </>
          )}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity *</label>
                <input type="number" min="1" className={IPT} placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
                {qty.length > 0 && !qtyValid && (
                  <p className="text-xs text-red-500 mt-1">Enter a quantity between 1 and 100000</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
                <DateInputDMY className={IPT} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Received By *</label>
              <select value={by} onChange={(e) => { setBy(e.target.value); setByCustom(""); }} className={IPT}>
                <option value="">Select Name</option>
                {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {by === "Other" && (
                <input className={`${IPT} mt-2`} placeholder="Enter name..." value={byCustom} onChange={(e) => setByCustom(e.target.value)} />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
              <input className={IPT} placeholder="Optional note..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!valid} className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">Add Stock</button>
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
  const selectedItem = items.find((i) => i.id === selId);
  const availQty     = selectedItem ? avail(selectedItem) : 0;
  const receivedBy   = by === "Other" ? byCustom.trim() : by;
  const qtyNum       = Number(qty);
  const valid = receivedBy && selId && qty && qtyNum > 0 && qtyNum <= availQty && date;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      itemId: selId,
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">Record Usage</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Purpose *</label>
            <div className="grid grid-cols-3 gap-2">
              {PURPOSES.map(({ key, label }) => (
                <button key={key} onClick={() => { setPurpose(key); setSelId(""); }}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors text-center leading-snug ${
                    purpose === key ? "border-school-navy bg-school-navy/5 text-school-navy" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Item *{purpose === "student" && <span className="font-normal text-gray-400 ml-1">(student items only)</span>}
            </label>
            <select value={selId} onChange={(e) => setSelId(e.target.value)} className={IPT}>
              <option value="">Choose item...</option>
              {eligibleItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name} — Available: {avail(item)} {item.unit}</option>
              ))}
            </select>
            {selectedItem && (
              <>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Available: <span className={`font-bold ${isLow(selectedItem) ? "text-amber-600" : "text-green-600"}`}>{avail(selectedItem)} {selectedItem.unit}</span>
                  {purpose === "student" && ` · Students pending: ${pending(selectedItem)}`}
                </p>
                {selectedItem.storageAddress && (
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selectedItem.storageAddress}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quantity *</label>
              <input type="number" min="1" className={IPT} placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
              {qty && qtyNum > availQty && availQty > 0 && <p className="text-[11px] text-red-500 mt-1">Exceeds available ({availQty})</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
              <DateInputDMY className={IPT} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Issued By *</label>
            <select value={by} onChange={(e) => { setBy(e.target.value); setByCustom(""); }} className={IPT}>
              <option value="">Select Name</option>
              {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {by === "Other" && <input className={`${IPT} mt-2`} placeholder="Enter name..." value={byCustom} onChange={(e) => setByCustom(e.target.value)} />}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
            <input className={IPT} placeholder="e.g. Distributed to Std 6 students" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {purpose === "student" && selId && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
              <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Student distribution auto-deducts from stock and updates the student coverage count.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!valid} className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">Save Usage</button>
        </div>
      </div>
    </div>
  );
  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Add Asset Modal ───────────────────────────────────────────────────────────
function AddAssetModal({ onClose, onSave }) {
  const [name, setName]   = useState("");
  const [brand, setBrand] = useState("");
  const [addr, setAddr]   = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nameValid  = isValidLength(name, 80, 2);
  const brandValid = !brand.trim() || isValidLength(brand, 100, 1);
  const addrValid  = !addr.trim() || isValidLength(addr, 100, 1);
  const valid = nameValid && brandValid && addrValid;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Add Asset</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Asset Name *</label>
            <input className={IPT} placeholder="e.g. Wireless Microphone" value={name} onChange={(e) => setName(e.target.value)} />
            {name.length > 0 && !nameValid && (
              <p className="text-xs text-red-500 mt-1">Name must be 2-80 characters</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Brand / Model</label>
            <input className={IPT} placeholder="e.g. Boya BY-WM8" value={brand} onChange={(e) => setBrand(e.target.value)} />
            {brand.length > 0 && !brandValid && (
              <p className="text-xs text-red-500 mt-1">Brand / Model must be under 100 characters</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Storage Location *</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input className={`${IPT} pl-9`} placeholder="e.g. AV Room, Cabinet 1" value={addr} onChange={(e) => setAddr(e.target.value)} />
            </div>
            {addr.length > 0 && !addrValid && (
              <p className="text-xs text-red-500 mt-1">Storage location must be under 100 characters</p>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={() => { if (valid) onSave({ name: name.trim(), brand: brand.trim(), storageAddress: addr.trim(), currentCheckout: null, checkouts: [] }); }}
            disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
            Add Asset
          </button>
        </div>
      </div>
    </div>
  );
  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Take Asset Modal ──────────────────────────────────────────────────────────
function TakeAssetModal({ asset, onClose, onSave }) {
  const [by, setBy]           = useState("");
  const [byCustom, setBy2]    = useState("");
  const [purpose, setPurpose] = useState("");
  const [date, setDate]       = useState(TODAY);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const takenBy = by === "Other" ? byCustom.trim() : by;
  const valid   = takenBy && purpose.trim() && date;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-800">Take Asset</h3>
            <p className="text-xs text-gray-400 mt-0.5">{asset.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {asset.storageAddress && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-600 font-medium">{asset.storageAddress}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Taken By *</label>
            <select value={by} onChange={(e) => { setBy(e.target.value); setBy2(""); }} className={IPT}>
              <option value="">Select Name</option>
              {RECEIVERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {by === "Other" && <input className={`${IPT} mt-2`} placeholder="Enter name..." value={byCustom} onChange={(e) => setBy2(e.target.value)} />}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purpose *</label>
            <input className={IPT} placeholder="e.g. Annual Day Recording" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
            <DateInputDMY className={IPT} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => { if (valid) onSave(asset.id, { takenBy, purpose: purpose.trim(), takenDate: date }); }}
            disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            <LogOut className="w-4 h-4" /> Confirm Take
          </button>
        </div>
      </div>
    </div>
  );
  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// ── Return Asset Modal ────────────────────────────────────────────────────────
function ReturnAssetModal({ asset, onClose, onSave }) {
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const co = asset.currentCheckout;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-800">Return Asset</h3>
            <p className="text-xs text-gray-400 mt-0.5">{asset.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs text-amber-700"><span className="font-semibold">Taken by:</span> {co?.takenBy}</p>
            <p className="text-xs text-amber-700"><span className="font-semibold">Purpose:</span> {co?.purpose}</p>
            <p className="text-xs text-amber-700"><span className="font-semibold">Since:</span> {fmtDate(co?.takenDate)} · {daysSince(co?.takenDate)}</p>
          </div>
          {asset.storageAddress && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-600">Return to: <span className="font-semibold">{asset.storageAddress}</span></p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Return Date *</label>
            <DateInputDMY className={IPT} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Note</label>
            <input className={IPT} placeholder="Optional note..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(asset.id, date, note.trim())} disabled={!date}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            <LogIn className="w-4 h-4" /> Confirm Return
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
  const masterItems = useStore(s => s.studentInventoryItems);

  const [items,    setItems]   = useState([]);
  const [assets,   setAssets]  = useState([]);
  const [loading,  setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);

  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [search, setSearch]               = useState("");
  const [catFilter, setCatFilter]         = useState("all");
  const [stFilter, setStFilter]           = useState("all");
  const [sortPending, setSortPending]     = useState(false);
  const [expanded, setExpanded]           = useState({});
  const [addOpen, setAddOpen]             = useState(false);
  const [useOpen, setUseOpen]             = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsData, yearData] = await Promise.all([
        getAssets(),
        supabase.from("academic_years").select("id").eq("is_current", true).single(),
      ]);
      const currentYearId = yearData.data?.id || null;
      const [itemsData] = await Promise.all([getInventoryItems(currentYearId)]);
      let studentCount = 0;
      if (currentYearId) {
        const { count } = await supabase
          .from("student_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("academic_year_id", currentYearId);
        studentCount = count || 0;
      }
      setTotalStudents(studentCount);
      setItems(itemsData.map(it =>
        it.category === "student" ? { ...it, studentsTotal: studentCount } : it
      ));
      setAssets(assetsData);
    } catch {
      // keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const assetsAvailable = assets.filter((a) => !a.currentCheckout).length;
  const assetsInUse     = assets.filter((a) => !!a.currentCheckout).length;
  const inUseAssets     = assets.filter((a) => !!a.currentCheckout);

  const lowItems     = items.filter(isLow);
  const outItems     = items.filter(isOut);
  const studentItems = items.filter((i) => i.category === "student");
  const totalPending = studentItems.reduce((s, i) => s + pending(i), 0);

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

  const handleAddAsset = async (data) => {
    try {
      const created = await addAsset(data);
      setAssets(prev => [...prev, created]);
    } catch (err) { alert("Failed to add asset: " + err.message); }
  };

  const handleTake = async (assetId, checkout) => {
    try {
      const co = await takeAsset(assetId, checkout);
      setAssets(prev => prev.map(a => {
        if (a.id !== assetId) return a;
        return { ...a, currentCheckout: co, checkouts: [...a.checkouts, co] };
      }));
    } catch (err) { alert("Failed to record checkout: " + err.message); }
  };

  const handleReturn = async (assetId, returnDate) => {
    try {
      const asset = assets.find(a => a.id === assetId);
      const co    = asset?.currentCheckout;
      if (!co) return;
      await returnAsset(co.id, returnDate);
      setAssets(prev => prev.map(a => {
        if (a.id !== assetId) return a;
        return {
          ...a,
          currentCheckout: null,
          checkouts: a.checkouts.map(c => c.id === co.id ? { ...c, returnDate } : c),
        };
      }));
    } catch (err) { alert("Failed to record return: " + err.message); }
  };

  const handleAddStock = async (payload) => {
    try {
      if (payload.tab === "existing") {
        const [newBatch] = await Promise.all([
          addBatch(payload.selId, payload.batch),
          payload.location ? updateItemAddress(payload.selId, payload.location) : Promise.resolve(),
        ]);
        setItems(prev => prev.map(item =>
          item.id === payload.selId
            ? { ...item, storageAddress: payload.location || item.storageAddress, batches: [...item.batches, newBatch] }
            : item
        ));
      } else {
        const newItem = await addInventoryItem(payload.newItem);
        const newBatch = await addBatch(newItem.id, payload.batch);
        const withTotal = newItem.category === "student" ? { ...newItem, studentsTotal: totalStudents } : newItem;
        setItems(prev => [...prev, { ...withTotal, batches: [newBatch], usages: [] }]);
      }
      setAddOpen(false);
    } catch (err) { alert("Failed to add stock: " + err.message); }
  };

  const handleUseStock = async (payload) => {
    try {
      const newUsage = await addUsage(payload.itemId, payload.usage);
      setItems(prev => prev.map(item => {
        if (item.id !== payload.itemId) return item;
        return { ...item, usages: [...item.usages, newUsage] };
      }));
      setUseOpen(false);
    } catch (err) { alert("Failed to record usage: " + err.message); }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-400">Loading inventory…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Inventory Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Stock tracking, distribution & low stock alerts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setUseOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <MinusCircle className="w-4 h-4" /> Record Usage
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Stock
          </button>
        </div>
      </div>

      {/* ── Asset Management Summary Card ── */}
      <button
        onClick={() => setAssetPanelOpen(true)}
        className="w-full text-left bg-school-navy hover:bg-school-navy-dark transition-all rounded-2xl shadow-md p-5 group"
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: icon + title */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-base">Asset Management</p>
              <p className="text-white/60 text-xs mt-0.5">Mic, camera, phone, gimbal & more — click to manage</p>
            </div>
          </div>
          {/* Right: chevron */}
          <div className="flex items-center gap-2 flex-shrink-0 self-center">
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/50" />
            <span className="text-white/70 text-xs font-medium">{assets.length} Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-white/70 text-xs font-medium">{assetsAvailable} Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-white/70 text-xs font-medium">{assetsInUse} In Use</span>
          </div>
          {/* Mini chips for in-use items */}
          {inUseAssets.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
              {inUseAssets.slice(0, 3).map((a) => (
                <span key={a.id} className="px-2 py-0.5 bg-amber-400/20 border border-amber-400/30 text-amber-200 text-[11px] font-semibold rounded-full">
                  {a.name}
                </span>
              ))}
              {inUseAssets.length > 3 && (
                <span className="text-[11px] text-white/50">+{inUseAssets.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* ── Stock Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Items",      value: items.length,    icon: Package,     bg: "bg-blue-50",   color: "text-blue-600" },
          { label: "Low Stock",        value: lowItems.length, icon: TrendingDown,bg: "bg-amber-50",  color: "text-amber-600" },
          { label: "Out of Stock",     value: outItems.length, icon: Archive,     bg: "bg-red-50",    color: "text-red-600" },
          { label: "Students Pending", value: totalPending,    icon: Users,       bg: "bg-purple-50", color: "text-purple-600" },
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

      {/* ── Student Inventory Items ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800">Student Inventory Items</p>
            <p className="text-xs text-gray-400 mt-0.5">Items given to every student — shown in their profile &amp; fee entry</p>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold px-3 py-1.5 rounded-xl flex-shrink-0">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Manage in Super Admin
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {masterItems.map((name) => (
            <span key={name} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Package className="w-3 h-3 text-blue-400 flex-shrink-0" />
              {name}
            </span>
          ))}
          {masterItems.length === 0 && (
            <p className="text-xs text-gray-400">No items configured. Go to Super Admin → Inventory → Item Master to add items.</p>
          )}
        </div>
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
              <div key={item.id} className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700">{item.name}</span>
                <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full">OUT</span>
              </div>
            ))}
            {lowItems.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-700">{item.name}</span>
                <span className="text-[10px] text-amber-600">{avail(item)} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
              placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[["all","All"],["student","Student"],["office","Office"],["other","Other"]].map(([k,l]) => (
              <button key={k} onClick={() => setCatFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  catFilter === k ? "bg-school-navy text-white border-school-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {[["all","All Status"],["low","Low Stock"],["out","Out of Stock"]].map(([k,l]) => (
              <button key={k} onClick={() => setStFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  stFilter === k
                    ? k === "out" ? "bg-red-500 text-white border-red-500"
                    : k === "low" ? "bg-amber-500 text-white border-amber-500"
                    :               "bg-school-navy text-white border-school-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setSortPending((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              sortPending ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}>
            <Users className="w-3.5 h-3.5" /> Sort by Pending
          </button>
        </div>
      </div>

      {/* ── Stock Table ── */}
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
                <tr><td colSpan={8} className="text-center py-14 text-gray-400 text-sm">No items match your filters</td></tr>
              )}
              {filtered.map((item) => (
                <Fragment key={item.id}>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      {item.storageAddress && (
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{item.storageAddress}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${CAT_COLOR[item.category]}`}>{item.category}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                      {totalIn(item)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                      {totalUsed(item)} <span className="text-xs text-gray-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={`font-bold ${isOut(item) ? "text-red-600" : isLow(item) ? "text-amber-600" : "text-green-600"}`}>{avail(item)}</span>
                      <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {item.category === "student" ? (
                        pending(item) > 0
                          ? <span className="font-semibold text-purple-600">{pending(item)} students</span>
                          : <span className="text-xs text-green-500 font-semibold">All received</span>
                      ) : <span className="text-gray-300">—</span>}
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
                        <button onClick={() => toggleExpand(item.id, "batches")} title="Stock in history"
                          className={`p-1.5 rounded-lg transition-colors ${expanded[item.id] === "batches" ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-400"}`}>
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleExpand(item.id, "usages")} title="Usage history"
                          className={`p-1.5 rounded-lg transition-colors ${expanded[item.id] === "usages" ? "bg-purple-100 text-purple-700" : "hover:bg-gray-100 text-gray-400"}`}>
                          <MinusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded[item.id] === "batches" && (
                    <tr>
                      <td colSpan={8} className="px-5 pb-4 bg-blue-50/40">
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide pt-3 mb-2">Stock In History</p>
                        <div className="space-y-1.5">
                          {item.batches.map((b) => (
                            <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-white border border-blue-100 rounded-xl px-3.5 py-2 text-xs">
                              <span className="font-bold text-blue-700">+{b.qty} {item.unit}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">{fmtDate(b.date)}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-gray-600">{b.by}</span>
                              {b.location && <><span className="text-gray-300">·</span><span className="flex items-center gap-1 text-gray-500"><MapPin className="w-2.5 h-2.5 flex-shrink-0" />{b.location}</span></>}
                              {b.note && <><span className="text-gray-300">·</span><span className="text-gray-500 italic">{b.note}</span></>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {expanded[item.id] === "usages" && (
                    <tr>
                      <td colSpan={8} className="px-5 pb-4 bg-purple-50/30">
                        <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wide pt-3 mb-2">Usage History</p>
                        {item.usages.length === 0 ? (
                          <p className="text-xs text-gray-400">No usage recorded yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {item.usages.map((u) => (
                              <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-white border border-purple-100 rounded-xl px-3.5 py-2 text-xs">
                                <span className="font-bold text-red-600">−{u.qty} {item.unit}</span>
                                <span className="text-gray-300">·</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${PURPOSE_COLOR[u.purpose]}`}>{u.purpose}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-600">{fmtDate(u.date)}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-gray-600">{u.by}</span>
                                {u.note && <><span className="text-gray-300">·</span><span className="text-gray-500 italic">{u.note}</span></>}
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
            {[...studentItems].sort((a, b) => pending(b) - pending(a)).map((item) => {
              const pct      = item.studentsTotal > 0 ? Math.round((item.studentsGiven / item.studentsTotal) * 100) : 0;
              const notGiven = item.studentsTotal - item.studentsGiven;
              const barColor = pct === 100 ? "bg-green-500" : pct >= 80 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                      {item.storageAddress && (
                        <span className="text-[10px] text-gray-400 ml-2 inline-flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{item.storageAddress}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      <span className="font-bold text-gray-700">{item.studentsGiven}</span>
                      {" / "}{item.studentsTotal} students
                      {notGiven > 0 && <span className="text-purple-600 font-semibold ml-2">{notGiven} pending</span>}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{pct}% distributed</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {addOpen && <AddStockModal items={items} onClose={() => setAddOpen(false)} onSave={handleAddStock} />}
      {useOpen && <UseStockModal items={items} onClose={() => setUseOpen(false)} onSave={handleUseStock} />}
      {assetPanelOpen && (
        <AssetManagementModal
          assets={assets}
          onClose={() => setAssetPanelOpen(false)}
          onAddAsset={handleAddAsset}
          onTake={handleTake}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
}
