"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, IndianRupee, Plus, X } from "lucide-react";
import { getStudents } from "@/lib/sefStudentService";
import { getPaymentsForStudent, addPayment } from "@/lib/sefFeesService";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function SefFeesPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    getStudents().then(list => {
      setStudents(list);
      if (list.length) setSelectedId(list[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = students.filter(s => s.status !== "Inactive");
    if (!q) return active;
    return active.filter(s => (s.name || "").toLowerCase().includes(q) || (s.std || "").toLowerCase().includes(q));
  }, [students, search]);

  const selected = students.find(s => s.id === selectedId) || null;

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Fees</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tuition fee collection per student</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Student list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-1">
          <div className="p-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."
                className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder:text-gray-400" />
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No students found</p>
            ) : filtered.map(s => (
              <button key={s.id} onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedId === s.id ? "bg-school-navy/5" : "hover:bg-gray-50"}`}>
                <p className="text-sm font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-400">Std {s.std} · ₹{Number(s.monthly_fee || 0).toLocaleString("en-IN")}/mo</p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selected ? <StudentFeesPanel key={selected.id} student={selected} /> : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">
              Select a student to view fee details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentFeesPanel({ student }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    getPaymentsForStudent(student.id).then(setPayments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [student.id]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-800">{student.name}</h2>
            <p className="text-xs text-gray-400">Std {student.std}{student.medium ? ` · ${student.medium}` : ""}</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-school-navy text-white rounded-lg text-xs font-semibold hover:bg-school-navy/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Payment
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-school-navy/5 rounded-xl p-3.5">
            <p className="text-xs text-gray-500">Monthly Fee</p>
            <p className="text-lg font-bold text-school-navy">₹{Number(student.monthly_fee || 0).toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3.5">
            <p className="text-xs text-gray-500">Total Collected</p>
            <p className="text-lg font-bold text-green-600">₹{totalPaid.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-1.5">
            <IndianRupee className="w-7 h-7 text-gray-200" />
            <p className="text-sm text-gray-400">No payments recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                  {p.note && <p className="text-xs text-gray-400">{p.note}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{fmtDate(p.payment_date)}</p>
                  {p.received_by && <p className="text-xs text-gray-400">by {p.received_by}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddPaymentModal studentId={student.id} onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

function AddPaymentModal({ studentId, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }
    if (!paymentDate) { setError("Select a payment date"); return; }
    setError(""); setSaving(true);
    try {
      await addPayment({ studentId, amount: Number(amount), paymentDate, receivedBy, note });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Add Payment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LBL}>Amount (₹) *</label>
            <input type="number" className={IPT} placeholder="e.g. 1500" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Payment Date *</label>
            <DateInputDMY className={IPT} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Received By</label>
            <input className={IPT} placeholder="Optional" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Note</label>
            <input className={IPT} placeholder="Optional" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
