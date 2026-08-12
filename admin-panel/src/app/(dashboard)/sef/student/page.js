"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Search, User, Upload, FileText, Pencil, Power } from "lucide-react";
import { getStudents, addStudent, updateStudent, setStudentStatus } from "@/lib/sefStudentService";
import { uploadFileToS3, getS3ViewUrl, slugify } from "@/lib/s3Upload";
import { compressFile, formatFileSize } from "@/lib/fileCompression";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

const MEDIUMS = ["English", "Gujarati", "Hindi", "Odia", "Other"];

const emptyForm = {
  name: "", std: "", medium: "", schoolName: "", dob: "",
  fatherName: "", motherName: "", mobile1: "", mobile2: "",
  address: "", aadharNo: "", aadharName: "", aadharDocKey: "", monthlyFee: "",
};

export default function SefStudentPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalStudent, setModalStudent] = useState(null); // null = closed, {} = add, {...} = edit

  const load = () => {
    setLoading(true);
    getStudents().then(setStudents).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.std || "").toLowerCase().includes(q) ||
      (s.mobile_1 || "").includes(q)
    );
  }, [students, search]);

  async function handleToggleStatus(s) {
    const next = s.status === "Active" ? "Inactive" : "Active";
    await setStudentStatus(s.id, next);
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-school-navy">SEF Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tuition class student records</p>
        </div>
        <button onClick={() => setModalStudent({})}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 max-w-sm">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, std, mobile..."
          className="flex-1 text-sm outline-none text-gray-700 placeholder:text-gray-400" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <User className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-gray-400">{search ? "No matching students" : "No students added yet"}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                    {s.status === "Inactive" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">INACTIVE</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Std {s.std}{s.medium ? ` · ${s.medium}` : ""}{s.school_name ? ` · ${s.school_name}` : ""}
                  </p>
                </div>
                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{s.mobile_1}</p>
                  <p className="text-xs font-semibold text-school-navy">₹{Number(s.monthly_fee || 0).toLocaleString("en-IN")}/mo</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModalStudent(s)} title="Edit"
                    className="p-2 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-50 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleStatus(s)} title={s.status === "Active" ? "Mark Inactive" : "Mark Active"}
                    className={`p-2 rounded-lg transition-colors ${s.status === "Active" ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalStudent !== null && (
        <StudentModal
          student={modalStudent}
          onClose={() => setModalStudent(null)}
          onSaved={() => { setModalStudent(null); load(); }}
        />
      )}
    </div>
  );
}

function StudentModal({ student, onClose, onSaved }) {
  const isEdit = !!student.id;
  const [form, setForm] = useState(() => isEdit ? {
    name: student.name || "", std: student.std || "", medium: student.medium || "",
    schoolName: student.school_name || "", dob: student.dob || "",
    fatherName: student.father_name || "", motherName: student.mother_name || "",
    mobile1: student.mobile_1 || "", mobile2: student.mobile_2 || "",
    address: student.address || "", aadharNo: student.aadhar_no || "",
    aadharName: student.aadhar_name || "", aadharDocKey: student.aadhar_doc_key || "",
    monthlyFee: student.monthly_fee ?? "",
  } : emptyForm);

  const [docUploading, setDocUploading] = useState(false);
  const [docSize, setDocSize] = useState(0);
  const [docError, setDocError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const docRef = useRef(null);

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocError(""); setDocUploading(true);
    try {
      const compressed = await compressFile(file);
      const key = `sef-students/${slugify(form.name || "student")}-${Date.now()}-aadhar.${file.name.split(".").pop()}`;
      await uploadFileToS3(compressed, key);
      setForm(f => ({ ...f, aadharDocKey: key }));
      setDocSize(compressed.size);
    } catch (err) {
      setDocError(err.message || "Upload failed");
    } finally {
      setDocUploading(false);
    }
  }

  async function handleViewDoc() {
    const win = window.open("", "_blank");
    const url = await getS3ViewUrl(form.aadharDocKey, `${form.name || "student"}-aadhar`);
    if (url && win) win.location.href = url;
    else if (win) win.close();
    else alert("Please allow pop-ups to view this document.");
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Enter the student's name"); return; }
    if (!form.std.trim()) { setError("Enter the standard"); return; }
    if (!form.mobile1.trim()) { setError("Enter Mobile 1"); return; }
    setError(""); setSaving(true);
    try {
      const payload = { ...form, monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0 };
      if (isEdit) await updateStudent(student.id, payload);
      else await addStudent(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? "Edit Student" : "Add Student"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className={LBL}>Student Name *</label>
            <input className={IPT} placeholder="e.g. Aarav Patel" value={form.name} onChange={set("name")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Std *</label>
              <input className={IPT} placeholder="e.g. 8th" value={form.std} onChange={set("std")} />
            </div>
            <div>
              <label className={LBL}>Medium</label>
              <select className={IPT} value={form.medium} onChange={set("medium")}>
                <option value="">Select...</option>
                {MEDIUMS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LBL}>School Name</label>
            <input className={IPT} placeholder="School the student currently attends" value={form.schoolName} onChange={set("schoolName")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Date of Birth</label>
              <DateInputDMY className={IPT} value={form.dob} onChange={set("dob")} />
            </div>
            <div>
              <label className={LBL}>Monthly Fee (₹)</label>
              <input type="number" className={IPT} placeholder="e.g. 1500" value={form.monthlyFee} onChange={set("monthlyFee")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Father&apos;s Name</label>
              <input className={IPT} value={form.fatherName} onChange={set("fatherName")} />
            </div>
            <div>
              <label className={LBL}>Mother&apos;s Name</label>
              <input className={IPT} value={form.motherName} onChange={set("motherName")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Mobile 1 *</label>
              <input className={IPT} placeholder="10-digit mobile" maxLength={10} value={form.mobile1} onChange={set("mobile1")} />
            </div>
            <div>
              <label className={LBL}>Mobile 2</label>
              <input className={IPT} placeholder="Optional" maxLength={10} value={form.mobile2} onChange={set("mobile2")} />
            </div>
          </div>

          <div>
            <label className={LBL}>Address</label>
            <input className={IPT} placeholder="Full residential address" value={form.address} onChange={set("address")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Aadhar Card No.</label>
              <input className={IPT} placeholder="XXXX XXXX XXXX" value={form.aadharNo} onChange={set("aadharNo")} />
            </div>
            <div>
              <label className={LBL}>Name as per Aadhar</label>
              <input className={IPT} value={form.aadharName} onChange={set("aadharName")} />
            </div>
          </div>

          <div>
            <label className={LBL}>Aadhar Card Document</label>
            <input ref={docRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleDocUpload} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => docRef.current.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {docUploading ? "Uploading…" : form.aadharDocKey ? "Replace Document" : "Upload Document"}
              </button>
              {form.aadharDocKey && !docUploading && (
                <button type="button" onClick={handleViewDoc}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-school-navy hover:bg-gray-50 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> View
                </button>
              )}
            </div>
            {!docUploading && docSize > 0 && <p className="text-xs text-green-600 font-medium mt-1">✓ {formatFileSize(docSize)}</p>}
            {docError && <p className="text-xs text-red-500 mt-1">{docError}</p>}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || docUploading}
            className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Student"}
          </button>
        </div>
      </div>
    </div>
  );
}
