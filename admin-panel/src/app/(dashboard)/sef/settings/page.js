"use client";

import { useState, useEffect } from "react";
import {
  Building2, Calendar, IndianRupee, BookOpen, MessageSquare, Users, ScrollText,
  Save, Plus, X, Check, Pencil, AlertCircle, CheckCircle2,
} from "lucide-react";
import {
  getSefProfile, saveSefProfile,
  getSefAcademicYears, addSefAcademicYear, deleteSefAcademicYear, setSefCurrentYear,
  getSefClasses, addSefClass, removeSefClass,
  getSefFeeStructure, saveSefFeeStructure,
  getSefFeeReminderTemplate, saveSefFeeReminderTemplate,
  getSefRules, saveSefRules,
} from "@/lib/sefSettingsService";
import UsersRolesTab from "../../settings/UsersRolesTab";

// Same small visual pattern as the school's Settings (settings/page.js) -
// redefined locally since those are private, unexported helpers there.
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ViewVal({ val }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 min-h-[38px]">
      <span className="text-sm text-gray-800 font-medium">{val || <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full";

function EditBar({ editMode, saved, onEdit, onSave, onCancel }) {
  if (!editMode) {
    return (
      <div className="flex justify-end">
        <button onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors shadow-sm">
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
        <X className="w-4 h-4" /> Cancel
      </button>
      <button onClick={onSave}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${saved ? "bg-green-500 text-white" : "bg-school-navy hover:bg-school-navy/90 text-white"}`}>
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

// ── Tab: Institute Profile ───────────────────────────────────────
function InstituteProfileTab() {
  const [form, setForm] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [backup, setBackup] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSefProfile().then(setForm).catch(() => setForm({})); }, []);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  function startEdit() { setBackup({ ...form }); setEditMode(true); }
  function cancel() { setForm(backup); setEditMode(false); }
  async function save() {
    setSaving(true);
    try {
      await saveSefProfile(form);
      setSaved(true); setEditMode(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally { setSaving(false); }
  }

  if (!form) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  const FIELDS = [
    ["name", "Institute Name"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"],
    ["address", "Address"], ["city", "City"], ["state", "State"], ["pincode", "Pincode"],
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">Institute Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              {editMode ? <input className={inp} value={form[key] || ""} onChange={set(key)} /> : <ViewVal val={form[key]} />}
            </Field>
          ))}
        </div>
      </div>
      <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel} />
      {saving && <p className="text-xs text-gray-400 text-right">Saving…</p>}
    </div>
  );
}

// ── Tab: Academic Year ───────────────────────────────────────────
function AcademicYearTab() {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newYear, setNewYear] = useState("");
  const [error, setError] = useState("");

  const load = () => { getSefAcademicYears().then(setYears).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  async function handleAdd() {
    const trimmed = newYear.trim();
    if (!/^\d{4}-\d{2}$/.test(trimmed)) { setError("Use format YYYY-YY, e.g. 2027-28"); return; }
    if (years.some(y => y.label === trimmed)) { setError("Year already exists"); return; }
    setError("");
    try { await addSefAcademicYear(trimmed); setNewYear(""); load(); }
    catch { setError("Failed to add year"); }
  }

  async function handleSetCurrent(id) { await setSefCurrentYear(id); load(); }
  async function handleRemove(y) {
    if (y.is_current) return;
    try { await deleteSefAcademicYear(y.id); load(); } catch { setError("Failed to remove — it may be in use"); }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">Academic Years</h3>
      <div className="flex flex-wrap gap-2">
        {years.map(y => (
          <div key={y.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${y.is_current ? "bg-school-navy text-white" : "bg-gray-100 text-gray-700"}`}>
            {y.is_current && <span className="w-1.5 h-1.5 rounded-full bg-school-gold flex-shrink-0" />}
            {!y.is_current && (
              <button onClick={() => handleSetCurrent(y.id)} className="hover:underline">{y.label}</button>
            )}
            {y.is_current && y.label}
            {!y.is_current && (
              <button onClick={() => handleRemove(y)} className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {years.length === 0 && <p className="text-sm text-gray-400">No academic years added yet.</p>}
      </div>
      <div className="pt-2 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Year</p>
        <div className="flex items-center gap-2 max-w-xs">
          <input className={inp} placeholder="e.g. 2027-28" value={newYear}
            onChange={e => { setNewYear(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()} maxLength={7} />
          <button onClick={handleAdd} className="flex items-center gap-1 bg-school-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
        <p className="text-xs text-gray-400">Click a year to make it current. The current year can&apos;t be removed.</p>
      </div>
    </div>
  );
}

// ── Tab: Classes & Section (Std list) ────────────────────────────
function ClassesSectionTab() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStd, setNewStd] = useState("");
  const [error, setError] = useState("");

  const load = () => { getSefClasses().then(setClasses).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  async function handleAdd() {
    const trimmed = newStd.trim();
    if (!trimmed) return;
    if (classes.some(c => c.std === trimmed)) { setError("Already exists"); return; }
    setError("");
    try { await addSefClass(trimmed); setNewStd(""); load(); }
    catch { setError("Failed to add"); }
  }

  async function handleRemove(std) {
    try { await removeSefClass(std); load(); } catch { setError("Failed to remove — it may be in use"); }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">Std List</h3>
      <p className="text-xs text-gray-500">This is the list students are picked from on the Student form.</p>
      <div className="flex flex-wrap gap-2">
        {classes.map(c => (
          <div key={c.std} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700">
            {c.std}
            <button onClick={() => handleRemove(c.std)} className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {classes.length === 0 && <p className="text-sm text-gray-400">No std added yet.</p>}
      </div>
      <div className="pt-2 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Std</p>
        <div className="flex items-center gap-2 max-w-xs">
          <input className={inp} placeholder="e.g. 8th" value={newStd}
            onChange={e => { setNewStd(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <button onClick={handleAdd} className="flex items-center gap-1 bg-school-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</p>}
      </div>
    </div>
  );
}

// ── Tab: Fee Structure ───────────────────────────────────────────
function FeeStructureTab() {
  const [classes, setClasses] = useState([]);
  const [feeMap, setFeeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingStd, setSavingStd] = useState(null);
  const [savedStd, setSavedStd] = useState(null);

  useEffect(() => {
    Promise.all([getSefClasses(), getSefFeeStructure()]).then(([cls, fees]) => {
      setClasses(cls);
      const map = {};
      fees.forEach(f => { map[f.std] = f.default_fee; });
      setFeeMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave(std) {
    setSavingStd(std);
    try {
      await saveSefFeeStructure(std, Number(feeMap[std]) || 0);
      setSavedStd(std);
      setTimeout(() => setSavedStd(null), 2000);
    } catch {
      alert("Failed to save fee for " + std);
    } finally { setSavingStd(null); }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">Default Monthly Fee per Std</h3>
      <p className="text-xs text-gray-500">Prefills a new student&apos;s monthly fee on the Student form — stays editable per student.</p>
      {classes.length === 0 ? (
        <p className="text-sm text-gray-400">Add a Std under Classes &amp; Section first.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {classes.map(c => (
            <div key={c.std} className="flex items-center justify-between gap-3 py-3">
              <p className="text-sm font-medium text-gray-800 w-24 flex-shrink-0">{c.std}</p>
              <input type="number" className={inp} placeholder="0" value={feeMap[c.std] ?? ""}
                onChange={e => setFeeMap(m => ({ ...m, [c.std]: e.target.value }))} />
              <button onClick={() => handleSave(c.std)} disabled={savingStd === c.std}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-50 flex-shrink-0">
                {savedStd === c.std ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {savingStd === c.std ? "Saving…" : savedStd === c.std ? "Saved" : "Save"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Fee Reminder ─────────────────────────────────────────────
function FeeReminderTab() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSefFeeReminderTemplate().then(setContent).catch(() => {}).finally(() => setLoading(false)); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSefFeeReminderTemplate(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { alert("Failed to save: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <MessageSquare className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-blue-800">Fee Reminder Message Template</p>
          <p className="text-xs text-blue-600">Use these placeholders — replaced with each student&apos;s actual data:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {["{name}", "{std}", "{amount}", "{date}"].map(p => (
              <code key={p} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-mono">{p}</code>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <textarea rows={8} value={content} onChange={e => setContent(e.target.value)}
          placeholder="e.g. Dear Parent, {name} (Std {std}) has {amount} tuition fees pending. Please pay by {date}."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y leading-relaxed" />
        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy/90 disabled:opacity-60 transition-colors">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Rules & Regulations ──────────────────────────────────────
function RulesRegulationsTab() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSefRules().then(setContent).catch(() => {}).finally(() => setLoading(false)); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSefRules(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { alert("Failed to save: " + err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center">
          <ScrollText className="w-4.5 h-4.5 text-school-navy" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Rules & Regulations</h3>
          <p className="text-xs text-gray-500">SEF&apos;s rules content, kept ready for a future SEF-facing app.</p>
        </div>
      </div>
      <textarea rows={14} value={content} onChange={e => setContent(e.target.value)}
        placeholder="Type SEF's rules and regulations here."
        className="w-full mt-4 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y leading-relaxed" />
      <div className="flex items-center gap-3 mt-4">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy/90 disabled:opacity-60 transition-colors">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
const TABS = [
  { key: "profile",   label: "Institute Profile",   icon: Building2    },
  { key: "year",      label: "Academic Year",       icon: Calendar     },
  { key: "fees",      label: "Fee Structure",       icon: IndianRupee  },
  { key: "classes",   label: "Classes & Section",   icon: BookOpen     },
  { key: "reminders", label: "Fee Reminder",        icon: MessageSquare},
  { key: "users",     label: "Users & Roles",       icon: Users        },
  { key: "rules",     label: "Rules & Regulations", icon: ScrollText   },
];

export default function SefSettingsPage() {
  const [tab, setTab] = useState("profile");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Satyam Education Foundation configuration</p>
      </div>

      <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "profile"   && <InstituteProfileTab />}
      {tab === "year"      && <AcademicYearTab />}
      {tab === "fees"      && <FeeStructureTab />}
      {tab === "classes"   && <ClassesSectionTab />}
      {tab === "reminders" && <FeeReminderTab />}
      {tab === "users"     && <UsersRolesTab />}
      {tab === "rules"     && <RulesRegulationsTab />}
    </div>
  );
}
