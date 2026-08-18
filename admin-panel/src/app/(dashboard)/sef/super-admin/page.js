"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldCheck, GraduationCap, IndianRupee, Users, Package, Wallet, Upload, Save, Search, Plus,
} from "lucide-react";
import useStore from "@/lib/store";
import { getStudents, addStudent, updateStudent } from "@/lib/sefStudentService";
import { getEmployees, updateEmployee, getSalaryPayments, addSalaryPayment } from "@/lib/sefEmployeeService";
import { getItems } from "@/lib/sefInventoryService";
import { getSefClasses } from "@/lib/sefSettingsService";

const IPT = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy";

const PANELS = {
  student:   { label: "Student",   icon: GraduationCap },
  fees:      { label: "Fees",      icon: IndianRupee },
  employee:  { label: "Employee",  icon: Users },
  inventory: { label: "Inventory", icon: Package },
  salary:    { label: "Salary",    icon: Wallet },
  import:    { label: "Import Students", icon: Upload },
};

export default function SefSuperAdminPage() {
  const authUser = useStore(s => s.authUser);
  const isManagement = authUser?.role === "management";
  const visiblePanels = isManagement ? Object.keys(PANELS) : ["student", "import"];
  const [panel, setPanel] = useState(visiblePanels[0]);

  if (!authUser) return null;
  if (authUser.role === "normal_admin") {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">You do not have access to this section.</p></div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> SEF Super Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Privileged bulk tools</p>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit overflow-x-auto">
        {visiblePanels.map(key => {
          const { label, icon: Icon } = PANELS[key];
          return (
            <button key={key} onClick={() => setPanel(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${panel === key ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          );
        })}
      </div>

      {panel === "student" && <StudentPanel />}
      {panel === "fees" && <FeesPanel />}
      {panel === "employee" && <EmployeePanel />}
      {panel === "inventory" && <InventoryPanel />}
      {panel === "salary" && <SalaryPanel />}
      {panel === "import" && <ImportStudentsPanel />}
    </div>
  );
}

// ── Student: spreadsheet-style bulk edit ─────────────────────────
function StudentPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(new Set());
  const [savingIds, setSavingIds] = useState(new Set());

  const load = useCallback(() => { setLoading(true); getStudents().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(load, [load]);

  function setField(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setDirty(prev => new Set(prev).add(id));
  }

  async function saveRow(r) {
    setSavingIds(prev => new Set(prev).add(r.id));
    try {
      await updateStudent(r.id, {
        name: r.name, std: r.std, medium: r.medium, schoolName: r.school_name, dob: r.dob,
        fatherName: r.father_name, motherName: r.mother_name, mobile1: r.mobile_1, mobile2: r.mobile_2,
        address: r.address, aadharNo: r.aadhar_no, aadharName: r.aadhar_name, aadharDocKey: r.aadhar_doc_key,
        monthlyFee: r.monthly_fee,
      });
      setDirty(prev => { const n = new Set(prev); n.delete(r.id); return n; });
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(r.id); return n; });
    }
  }

  const filtered = rows.filter(r => !search.trim() || (r.name || "").toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 max-w-sm">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..." className="flex-1 text-sm outline-none bg-transparent" />
        </div>
      </div>
      {loading ? <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {["Name", "Std", "Mobile 1", "Monthly Fee", ""].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-3 py-2"><input className={IPT} value={r.name || ""} onChange={e => setField(r.id, "name", e.target.value)} /></td>
                  <td className="px-3 py-2 w-24"><input className={IPT} value={r.std || ""} onChange={e => setField(r.id, "std", e.target.value)} /></td>
                  <td className="px-3 py-2 w-32"><input className={IPT} value={r.mobile_1 || ""} onChange={e => setField(r.id, "mobile_1", e.target.value)} /></td>
                  <td className="px-3 py-2 w-28"><input type="number" className={IPT} value={r.monthly_fee ?? ""} onChange={e => setField(r.id, "monthly_fee", e.target.value)} /></td>
                  <td className="px-3 py-2 w-20">
                    {dirty.has(r.id) && (
                      <button onClick={() => saveRow(r)} disabled={savingIds.has(r.id)} className="p-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Fees: bulk monthly-fee edit ──────────────────────────────────
function FeesPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(new Set());

  const load = useCallback(() => { setLoading(true); getStudents().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(load, [load]);

  function setFee(id, value) { setRows(prev => prev.map(r => r.id === id ? { ...r, monthly_fee: value } : r)); setDirty(prev => new Set(prev).add(id)); }
  async function saveRow(r) {
    await updateStudent(r.id, { name: r.name, std: r.std, mobile1: r.mobile_1, monthlyFee: r.monthly_fee });
    setDirty(prev => { const n = new Set(prev); n.delete(r.id); return n; });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">Bulk Edit Monthly Fees</p></div>
      {loading ? <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div> : (
        <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{r.name}</p>
                <p className="text-xs text-gray-400">Std {r.std}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" className={IPT + " w-28"} value={r.monthly_fee ?? ""} onChange={e => setFee(r.id, e.target.value)} />
                {dirty.has(r.id) && <button onClick={() => saveRow(r)} className="p-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors"><Save className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Employee: bulk edit designation/role/status ──────────────────
function EmployeePanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(new Set());

  const load = useCallback(() => { setLoading(true); getEmployees().then(setRows).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(load, [load]);

  function setField(id, field, value) { setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r)); setDirty(prev => new Set(prev).add(id)); }
  async function saveRow(r) {
    await updateEmployee(r.id, {
      name: r.name, phone: r.phone, joiningDate: r.joining_date, roleType: r.role_type,
      designation: r.designation, status: r.status, subjectMappings: r.subject_mappings, documents: r.documents,
    });
    setDirty(prev => { const n = new Set(prev); n.delete(r.id); return n; });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {loading ? <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              {["Name", "Designation", "Role", "Status", ""].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 w-40"><input className={IPT} value={r.designation || ""} onChange={e => setField(r.id, "designation", e.target.value)} /></td>
                  <td className="px-3 py-2 w-32">
                    <select className={IPT} value={r.role_type} onChange={e => setField(r.id, "role_type", e.target.value)}>
                      {["Tutor", "Admin", "Management"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-28">
                    <select className={IPT} value={r.status} onChange={e => setField(r.id, "status", e.target.value)}>
                      {["Active", "Inactive"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-20">
                    {dirty.has(r.id) && <button onClick={() => saveRow(r)} className="p-1.5 rounded-lg bg-school-navy text-white hover:bg-school-navy/90 transition-colors"><Save className="w-3.5 h-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Inventory: read-only stock overview ──────────────────────────
function InventoryPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getItems().then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {loading ? <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div> : items.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">No inventory items yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(i => (
            <div key={i.id} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm font-medium text-gray-800">{i.name}</p>
              <p className={`text-sm font-bold ${i.available <= i.lowStockAt ? "text-red-600" : "text-green-600"}`}>{i.available} {i.unit}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Salary: quick record-payment across staff ────────────────────
function SalaryPanel() {
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [paidBy, setPaidBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => { getEmployees().then(rows => setEmployees(rows.filter(e => e.status !== "Inactive"))).catch(() => {}); }, []);
  useEffect(() => { if (selectedId) getSalaryPayments(selectedId).then(setHistory).catch(() => {}); else setHistory([]); }, [selectedId]);

  async function handleSave() {
    if (!selectedId || !amount) return;
    setSaving(true);
    try {
      await addSalaryPayment({ employeeId: selectedId, amount: Number(amount), month: month + "-01", paidOn: new Date().toISOString().slice(0, 10), paidBy });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      setAmount("");
      getSalaryPayments(selectedId).then(setHistory);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-lg">
      <select className={IPT} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
        <option value="">Select staff...</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {selectedId && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className={IPT} placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
            <input type="month" className={IPT} value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <input className={IPT} placeholder="Paid By (optional)" value={paidBy} onChange={e => setPaidBy(e.target.value)} />
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${saved ? "bg-green-500" : "bg-school-navy hover:bg-school-navy/90"}`}>
            <Plus className="w-4 h-4" /> {saving ? "Saving…" : saved ? "Saved!" : "Record Payment"}
          </button>
          {history.length > 0 && (
            <div className="pt-3 border-t border-gray-100 space-y-1">
              {history.map(p => <p key={p.id} className="text-xs text-gray-500">₹{Number(p.amount).toLocaleString("en-IN")} — {p.month?.slice(0, 7)}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Import Students (Excel) ──────────────────────────────────────
function ImportStudentsPanel() {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    setRows(json);
    setResult(null);
  }

  async function handleImport() {
    setImporting(true);
    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        await addStudent({
          name: row.Name || row.name, std: row.Std || row.std, medium: row.Medium || row.medium,
          schoolName: row.School || row.school, mobile1: row["Mobile 1"] || row.mobile1,
          mobile2: row["Mobile 2"] || row.mobile2, fatherName: row.Father || row.fatherName,
          motherName: row.Mother || row.motherName, address: row.Address || row.address,
          aadharNo: row.Aadhar || row.aadharNo, monthlyFee: row["Monthly Fee"] || row.monthlyFee || 0,
        });
        ok++;
      } catch { fail++; }
    }
    setResult({ ok, fail });
    setImporting(false);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-2xl">
      <p className="text-sm text-gray-600">Upload an Excel file with columns: Name, Std, Medium, School, Mobile 1, Mobile 2, Father, Mother, Address, Aadhar, Monthly Fee.</p>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile}
        className="text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-school-navy file:text-white file:text-sm file:font-semibold" />
      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{rows.length} rows ready to import.</p>
          <button onClick={handleImport} disabled={importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors disabled:opacity-60">
            <Upload className="w-4 h-4" /> {importing ? "Importing…" : `Import ${rows.length} Students`}
          </button>
        </div>
      )}
      {result && <p className="text-sm text-gray-700">Imported {result.ok} students{result.fail ? `, ${result.fail} failed` : ""}.</p>}
    </div>
  );
}
