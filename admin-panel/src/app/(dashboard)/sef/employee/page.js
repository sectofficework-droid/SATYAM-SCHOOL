"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, X, Search, User, Upload, FileText, Pencil, Power, Users, CalendarCheck, IndianRupee, Check,
} from "lucide-react";
import {
  getEmployees, addEmployee, updateEmployee, setEmployeeStatus,
  getAttendanceForDate, saveAttendanceForDate,
  getSalaryPayments, addSalaryPayment,
} from "@/lib/sefEmployeeService";
import { getSefClasses, getSefStdSubjects } from "@/lib/sefSettingsService";
import { uploadFileToS3, getS3ViewUrl, slugify } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

const ROLE_TYPES = ["Tutor", "Admin", "Management"];
const EMPLOYMENT_TYPES = ["Permanent", "Contractual", "Part-time"];
const DOC_TYPES = ["Aadhar Card", "PAN Card"];

function SubTabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"
      }`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

export default function SefEmployeePage() {
  const [view, setView] = useState("staff"); // staff | attendance | salary
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getEmployees().then(setEmployees).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Employee</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tutors and staff records</p>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit flex-wrap">
        <SubTabButton active={view === "staff"} onClick={() => setView("staff")} icon={Users} label="Staff List" />
        <SubTabButton active={view === "attendance"} onClick={() => setView("attendance")} icon={CalendarCheck} label="Mark Attendance" />
        <SubTabButton active={view === "salary"} onClick={() => setView("salary")} icon={IndianRupee} label="Salary" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          {view === "staff" && <StaffListTab employees={employees} onChange={load} />}
          {view === "attendance" && <MarkAttendanceTab employees={employees} />}
          {view === "salary" && <SalaryTab employees={employees} />}
        </>
      )}
    </div>
  );
}

// ── Staff List ──────────────────────────────────────────────────────
function StaffListTab({ employees, onChange }) {
  const [search, setSearch] = useState("");
  const [modalEmp, setModalEmp] = useState(null); // null closed, {} add, {...} edit

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => (e.name || "").toLowerCase().includes(q) || (e.designation || "").toLowerCase().includes(q) || (e.phone || "").includes(q));
  }, [employees, search]);

  async function handleToggleStatus(e) {
    await setEmployeeStatus(e.id, e.status === "Active" ? "Inactive" : "Active");
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 max-w-sm flex-1">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, designation, phone..."
            className="flex-1 text-sm outline-none text-gray-700 placeholder:text-gray-400" />
        </div>
        <button onClick={() => setModalEmp({})}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <User className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-400">{search ? "No matching staff" : "No staff added yet"}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{e.name}</p>
                    {e.status === "Inactive" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">INACTIVE</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{e.role_type}{e.designation ? ` · ${e.designation}` : ""}</p>
                </div>
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{e.phone}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModalEmp(e)} title="Edit" className="p-2 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-50 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleStatus(e)} title={e.status === "Active" ? "Mark Inactive" : "Mark Active"}
                    className={`p-2 rounded-lg transition-colors ${e.status === "Active" ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalEmp !== null && (
        <EmployeeModal employee={modalEmp} onClose={() => setModalEmp(null)} onSaved={() => { setModalEmp(null); onChange(); }} />
      )}
    </div>
  );
}

const emptyForm = {
  name: "", gender: "", dob: "", phone: "", altPhone: "", email: "", address: "",
  aadhar: "", pan: "", roleType: "Tutor", designation: "", joiningDate: "",
  employmentType: "Permanent", photoKey: "", subjectMappings: [], documents: [],
};

function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee.id;
  const [form, setForm] = useState(() => isEdit ? {
    name: employee.name || "", gender: employee.gender || "", dob: employee.dob || "",
    phone: employee.phone || "", altPhone: employee.alt_phone || "", email: employee.email || "",
    address: employee.address || "", aadhar: employee.aadhar || "", pan: employee.pan || "",
    roleType: employee.role_type || "Tutor", designation: employee.designation || "",
    joiningDate: employee.joining_date || "", employmentType: employee.employment_type || "Permanent",
    photoKey: employee.photo_key || "", subjectMappings: employee.subject_mappings || [],
    documents: employee.documents || [],
  } : emptyForm);

  const [classes, setClasses] = useState([]);
  useEffect(() => { getSefClasses().then(setClasses).catch(() => {}); }, []);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef(null);

  function set(field) { return (e) => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const compressed = await compressFile(file);
      const key = `sef-employees/${slugify(form.name || "staff")}-${Date.now()}-photo.jpg`;
      await uploadFileToS3(compressed, key);
      setForm(f => ({ ...f, photoKey: key }));
    } catch (err) {
      setError(err.message || "Photo upload failed");
    } finally { setPhotoUploading(false); }
  }

  async function handleDocUpload(docName, file) {
    if (!file) return;
    try {
      const compressed = await compressFile(file);
      const key = `sef-employees/${slugify(form.name || "staff")}-${Date.now()}-${slugify(docName)}.${file.name.split(".").pop()}`;
      await uploadFileToS3(compressed, key);
      setForm(f => ({
        ...f,
        documents: [
          ...f.documents.filter(d => d.name !== docName),
          { name: docName, uploaded: true, fileName: file.name, fileUrl: key },
        ],
      }));
    } catch (err) {
      setError(err.message || "Document upload failed");
    }
  }

  async function handleViewDoc(key, name) {
    const win = window.open("", "_blank");
    const url = await getS3ViewUrl(key, name);
    if (url && win) win.location.href = url;
    else if (win) win.close();
    else alert("Please allow pop-ups to view this document.");
  }

  function addMapping(std) {
    if (!std || form.subjectMappings.some(m => m.std === std)) return;
    setForm(f => ({ ...f, subjectMappings: [...f.subjectMappings, { std, subjects: [] }] }));
  }
  function removeMapping(std) {
    setForm(f => ({ ...f, subjectMappings: f.subjectMappings.filter(m => m.std !== std) }));
  }
  function toggleMappingSubject(std, subject) {
    setForm(f => ({
      ...f,
      subjectMappings: f.subjectMappings.map(m => m.std !== std ? m : {
        ...m,
        subjects: m.subjects.includes(subject) ? m.subjects.filter(s => s !== subject) : [...m.subjects, subject],
      }),
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Enter the employee's name"); return; }
    if (!form.phone.trim()) { setError("Enter a phone number"); return; }
    if (!form.joiningDate) { setError("Enter the joining date"); return; }
    setError(""); setSaving(true);
    try {
      if (isEdit) await updateEmployee(employee.id, form);
      else await addEmployee(form);
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? "Edit Employee" : "Add Employee"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.photoKey ? <PhotoPreview photoKey={form.photoKey} /> : <User className="w-7 h-7 text-gray-300" />}
            </div>
            <div>
              <label className={LBL}>Photo</label>
              <input ref={photoRef} type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
              <button type="button" onClick={() => photoRef.current.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Upload className="w-3.5 h-3.5" /> {photoUploading ? "Uploading…" : form.photoKey ? "Change Photo" : "Upload Photo"}
              </button>
            </div>
          </div>

          <div>
            <label className={LBL}>Full Name *</label>
            <input className={IPT} value={form.name} onChange={set("name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Gender</label>
              <select className={IPT} value={form.gender} onChange={set("gender")}>
                <option value="">Select...</option>
                {["Male", "Female", "Other"].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Date of Birth</label>
              <DateInputDMY className={IPT} value={form.dob} onChange={set("dob")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Phone *</label>
              <input className={IPT} maxLength={10} value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label className={LBL}>Alt. Phone</label>
              <input className={IPT} maxLength={10} value={form.altPhone} onChange={set("altPhone")} />
            </div>
          </div>

          <div>
            <label className={LBL}>Email</label>
            <input type="email" className={IPT} value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className={LBL}>Address</label>
            <input className={IPT} value={form.address} onChange={set("address")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Aadhar No.</label>
              <input className={IPT} value={form.aadhar} onChange={set("aadhar")} />
            </div>
            <div>
              <label className={LBL}>PAN No.</label>
              <input className={IPT} value={form.pan} onChange={set("pan")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Role Type *</label>
              <select className={IPT} value={form.roleType} onChange={set("roleType")}>
                {ROLE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LBL}>Designation</label>
              <input className={IPT} placeholder="e.g. Maths Tutor" value={form.designation} onChange={set("designation")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Joining Date *</label>
              <DateInputDMY className={IPT} value={form.joiningDate} onChange={set("joiningDate")} />
            </div>
            <div>
              <label className={LBL}>Employment Type</label>
              <select className={IPT} value={form.employmentType} onChange={set("employmentType")}>
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {form.roleType === "Tutor" && (
            <SubjectMappingEditor classes={classes} mappings={form.subjectMappings}
              onAdd={addMapping} onRemove={removeMapping} onToggleSubject={toggleMappingSubject} />
          )}

          <div>
            <label className={LBL}>Documents</label>
            <div className="space-y-2">
              {DOC_TYPES.map(docName => {
                const doc = form.documents.find(d => d.name === docName);
                return (
                  <div key={docName} className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-100 rounded-lg">
                    <span className="text-sm text-gray-700">{docName}</span>
                    <div className="flex items-center gap-2">
                      {doc?.uploaded && (
                        <button type="button" onClick={() => handleViewDoc(doc.fileUrl, docName)} className="text-xs font-semibold text-school-navy hover:underline">View</button>
                      )}
                      <label className="text-xs font-semibold text-gray-500 hover:text-school-navy cursor-pointer">
                        {doc?.uploaded ? "Replace" : "Upload"}
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleDocUpload(docName, e.target.files?.[0])} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || photoUploading}
            className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoPreview({ photoKey }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { getS3ViewUrl(photoKey).then(setUrl).catch(() => {}); }, [photoKey]);
  return url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-gray-300" />;
}

function SubjectMappingEditor({ classes, mappings, onAdd, onRemove, onToggleSubject }) {
  const [addStd, setAddStd] = useState("");
  const available = classes.filter(c => !mappings.some(m => m.std === c.std));

  return (
    <div>
      <label className={LBL}>Subjects Taught (by Std)</label>
      <div className="space-y-3">
        {mappings.map(m => (
          <StdMappingCard key={m.std} mapping={m} onRemove={() => onRemove(m.std)} onToggleSubject={subj => onToggleSubject(m.std, subj)} />
        ))}
        {available.length > 0 && (
          <div className="flex items-center gap-2">
            <select className={IPT} value={addStd} onChange={e => setAddStd(e.target.value)}>
              <option value="">Add Std...</option>
              {available.map(c => <option key={c.std} value={c.std}>{c.std}</option>)}
            </select>
            <button type="button" onClick={() => { onAdd(addStd); setAddStd(""); }} disabled={!addStd}
              className="flex items-center gap-1 bg-school-navy text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-school-navy/90 transition-colors disabled:opacity-50 flex-shrink-0">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StdMappingCard({ mapping, onRemove, onToggleSubject }) {
  const [subjects, setSubjects] = useState([]);
  useEffect(() => { getSefStdSubjects(mapping.std).then(setSubjects).catch(() => {}); }, [mapping.std]);

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-800">Std {mapping.std}</p>
        <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {subjects.length === 0 ? (
        <p className="text-xs text-gray-400">No subjects configured for this Std yet (Settings → Classes &amp; Section).</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map(s => {
            const on = mapping.subjects.includes(s.subject);
            return (
              <button key={s.subject} type="button" onClick={() => onToggleSubject(s.subject)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  on ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                {on && <Check className="w-3 h-3" />}{s.subject}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mark Attendance ────────────────────────────────────────────────
function MarkAttendanceTab({ employees }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const active = employees.filter(e => e.status !== "Inactive");

  useEffect(() => {
    setLoading(true);
    getAttendanceForDate(date).then(rows => {
      const map = {};
      rows.forEach(r => { map[r.employee_id] = r.status; });
      active.forEach(e => { if (!map[e.id]) map[e.id] = "P"; });
      setStatus(map);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleSave() {
    setSaving(true);
    try {
      const records = Object.entries(status).map(([employee_id, s]) => ({ employee_id, date, status: s }));
      await saveAttendanceForDate(records);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Failed to save: " + e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${saved ? "bg-green-500" : "bg-school-navy hover:bg-school-navy/90"}`}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save Attendance"}
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
          {active.map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{e.name}</p>
                <p className="text-xs text-gray-400">{e.designation || e.role_type}</p>
              </div>
              <div className="flex gap-1.5">
                {["P", "A", "L"].map(v => (
                  <button key={v} onClick={() => setStatus(prev => ({ ...prev, [e.id]: v }))}
                    className={`w-9 h-9 rounded-lg text-xs font-bold border transition-colors ${
                      status[e.id] === v
                        ? (v === "P" ? "bg-green-500 border-green-500 text-white" : v === "A" ? "bg-red-500 border-red-500 text-white" : "bg-purple-500 border-purple-500 text-white")
                        : (v === "P" ? "border-green-200 text-green-600 hover:bg-green-50" : v === "A" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-purple-200 text-purple-600 hover:bg-purple-50")
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Salary ────────────────────────────────────────────────────────
function SalaryTab({ employees }) {
  const [selectedId, setSelectedId] = useState(employees[0]?.id || null);
  const active = employees.filter(e => e.status !== "Inactive");
  const selected = active.find(e => e.id === selectedId) || active[0] || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-1">
        <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
          {active.length === 0 ? (
            <p className="text-sm text-gray-400 p-5">No staff found</p>
          ) : active.map(e => (
            <button key={e.id} onClick={() => setSelectedId(e.id)}
              className={`w-full text-left px-4 py-3 transition-colors ${selected?.id === e.id ? "bg-school-navy/5" : "hover:bg-gray-50"}`}>
              <p className="text-sm font-medium text-gray-800">{e.name}</p>
              <p className="text-xs text-gray-400">{e.designation || e.role_type}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        {selected ? <EmployeeSalaryPanel key={selected.id} employee={selected} /> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-sm text-gray-400">Select a staff member</div>
        )}
      </div>
    </div>
  );
}

function EmployeeSalaryPanel({ employee }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => { setLoading(true); getSalaryPayments(employee.id).then(setPayments).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, [employee.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800">{employee.name}</h2>
          <p className="text-xs text-gray-400">{employee.designation || employee.role_type}</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-school-navy text-white rounded-lg text-xs font-semibold hover:bg-school-navy/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Record Payment
        </button>
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
            <p className="text-sm text-gray-400">No salary payments recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-400">{new Date(p.month + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Paid {new Date(p.paid_on + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  {p.paid_by && <p className="text-xs text-gray-400">by {p.paid_by}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddSalaryModal employeeId={employee.id} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

function AddSalaryModal({ employeeId, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }
    if (!month) { setError("Select a month"); return; }
    setError(""); setSaving(true);
    try {
      await addSalaryPayment({ employeeId, amount: Number(amount), month: month + "-01", paidOn, paidBy, note });
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save payment");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-800">Record Salary Payment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LBL}>Amount (₹) *</label>
            <input type="number" className={IPT} value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Month *</label>
            <input type="month" className={IPT} value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Paid On *</label>
            <DateInputDMY className={IPT} value={paidOn} onChange={e => setPaidOn(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Paid By</label>
            <input className={IPT} placeholder="Optional" value={paidBy} onChange={e => setPaidBy(e.target.value)} />
          </div>
          <div>
            <label className={LBL}>Note</label>
            <input className={IPT} placeholder="Optional" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
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
