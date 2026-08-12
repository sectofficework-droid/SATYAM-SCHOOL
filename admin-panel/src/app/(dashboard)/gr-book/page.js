"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BookMarked, Search, X, GraduationCap, UploadCloud, Download,
  AlertTriangle, Pencil, Save, ExternalLink, FileText, Check,
} from "lucide-react";
import {
  getGrBookEntries, getGrBookDocuments, createGrBookImportRows,
  updateGrBookImportRow, uploadGrBookDocument, composePlaceOfBirth,
} from "@/lib/grBookService";
import { addStudent } from "@/lib/studentService";
import { renderTablePdf } from "@/lib/pdfTableExport";
import DateInputDMY from "@/components/DateInputDMY";
import { fmtDMY } from "@/lib/utils";

// Fixed field order, exactly as specified by the school for the paper register.
const FIELD_DEFS = [
  { key: "grNo",            label: "GR No" },
  { key: "surname",         label: "Surname" },
  { key: "studentName",     label: "Student Name" },
  { key: "fatherName",      label: "Father's Name" },
  { key: "motherName",      label: "Mother's Name" },
  { key: "religion",        label: "Religion" },
  { key: "caste",           label: "Caste" },
  { key: "birthVillage",    label: "Birth Village" },
  { key: "birthCity",       label: "Birth City" },
  { key: "birthDistrict",   label: "Birth District" },
  { key: "birthState",      label: "Birth State" },
  { key: "placeOfBirth",    label: "Place of Birth (Village, City, District, State)", derived: true },
  { key: "dob",             label: "Date of Birth", type: "date" },
  { key: "dobWords",        label: "Date of Birth (in words)", derived: true },
  { key: "lastSchoolGrNo",  label: "Last School Attended GR No" },
  { key: "lastSchoolName",  label: "Last School Name" },
  { key: "dateOfAdmission", label: "Date of Admission", type: "date" },
  { key: "admissionClass",  label: "Admission Class" },
  { key: "aadharNo",        label: "Student Aadhar No" },
  { key: "udiseNo",         label: "UDISE No" },
  { key: "apaarId",         label: "APAAR ID" },
  { key: "penNo",           label: "PEN No" },
  { key: "dateOfLeaving",   label: "Date of Leaving", type: "date" },
  { key: "classWhenLeft",   label: "Class When Left" },
  { key: "tcNo",            label: "TC No" },
];

// requiredIf: a document that's only mandatory in certain cases - shown as a
// "Required" flag when missing and the condition holds, same reasoning as
// the main Documents module already applies to "Leaving Certificate" (only
// required when the student has previous-school info on file).
const DOC_FIELDS = [
  { key: "birthCertificate", label: "Student Birth Certificate", dbField: "birth_cert_key" },
  { key: "studentAadhar",    label: "Student Aadhar Card",       dbField: "student_aadhar_key" },
  { key: "fatherAadhar",     label: "Father's Aadhar Card",      dbField: "father_aadhar_key" },
  { key: "motherAadhar",     label: "Mother's Aadhar Card",      dbField: "mother_aadhar_key" },
  {
    key: "previousSchoolTc", label: "Previous School TC (Leaving Certificate)", dbField: "previous_school_tc_key",
    requiredIf: (entry) => !!(entry.lastSchoolName || entry.lastSchoolGrNo),
  },
  { key: "tc",                label: "TC (if left school)",       dbField: "tc_key" },
];

function fmtField(v, type) {
  if (!v) return "—";
  return type === "date" ? fmtDMY(v) : v;
}

// The register table itself shows the paper-register field order exactly -
// the combined Place of Birth line, not its 4 raw village/city/district/state
// components (those stay import/edit-only, see GrDetailModal).
const REGISTER_COLUMNS = FIELD_DEFS.filter(f => !["birthVillage", "birthCity", "birthDistrict", "birthState"].includes(f.key));

// ── Import-only field list (Import GR Records tab) ──────────────────────────
// Separate from FIELD_DEFS/REGISTER_COLUMNS above, which are the *display*
// shape and must stay exactly as they are. This is the richer sheet used to
// digitize the whole GR sequence in one pass: a Status column decides where
// each row goes (see confirmImport) - "Active" students get the same
// student+enrollment fields the Super Admin bulk importer collects (so they
// become real students, matching IMPORT_FIELDS in super-admin/page.js
// exactly, key-for-key, so the same confirmImport payload-building logic can
// be reused), "Left" students only need the original GR-only fields below.
const STATUS_FIELD = { key: "status", label: "Status (Active/Left)", required: true };

// Keep in sync with IMPORT_FIELDS in super-admin/page.js - same keys/labels/
// required flags, since Active rows are written via the same addStudent().
const BULK_IMPORT_FIELDS = [
  { key: "grNo",              label: "GR Number",                        required: false },
  { key: "cls",                label: "Class",                            required: true  },
  { key: "admissionClass",    label: "Admission Class",                  required: false },
  { key: "section",            label: "Section (A/B/C)",                  required: false },
  { key: "rollNo",             label: "Roll No",                          required: false },
  { key: "joinDate",           label: "Date of Joining (DD-MM-YYYY)",     required: false },
  { key: "feeTotal",           label: "Fee Total (Rs)",                   required: false },
  { key: "discountAmount",     label: "Discount Amount (Rs)",             required: false },
  { key: "discountReason",     label: "Discount Reason",                  required: false },
  { key: "firstName",          label: "First Name",                       required: true  },
  { key: "lastName",           label: "Last Name",                        required: true  },
  { key: "fatherName",         label: "Father Name",                      required: true  },
  { key: "motherName",         label: "Mother Name",                      required: true  },
  { key: "dob",                label: "Date of Birth (DD-MM-YYYY)",       required: true  },
  { key: "birthCertRegNo",     label: "Birth Cert Reg No",                required: false },
  { key: "birthCertRegDate",   label: "Birth Cert Reg Date (DD-MM-YYYY)", required: false },
  { key: "gender",             label: "Gender (Male/Female/Other)",       required: true  },
  { key: "birthVillage",       label: "Birth Village",                    required: false },
  { key: "birthCity",          label: "Birth City",                       required: true  },
  { key: "birthDistrict",      label: "Birth District",                   required: false },
  { key: "birthState",         label: "Birth State",                      required: false },
  { key: "motherTongue",       label: "Mother Tongue",                    required: true  },
  { key: "religion",           label: "Religion",                         required: true  },
  { key: "caste",              label: "Category / Caste",                required: true  },
  { key: "subCaste",           label: "Sub Caste",                        required: false },
  { key: "height",             label: "Height (cm)",                      required: false },
  { key: "weight",             label: "Weight (kg)",                      required: false },
  { key: "mobile1",            label: "Mobile 1",                         required: true  },
  { key: "mobile2",            label: "Mobile 2",                         required: false },
  { key: "roomPlotNo",         label: "Room / Plot No",                   required: true  },
  { key: "society",            label: "Society / Colony",                 required: true  },
  { key: "landmark",           label: "Landmark",                         required: false },
  { key: "area",               label: "Area / Locality",                  required: true  },
  { key: "pinCode",            label: "Pin Code",                         required: true  },
  { key: "address",            label: "Full Address",                     required: false },
  { key: "aadharNo",           label: "Aadhar Number",                    required: false },
  { key: "aadharName",         label: "Aadhar Name",                      required: false },
  { key: "fatherAadhar",       label: "Father's Aadhar Number",           required: false },
  { key: "fatherAadharName",   label: "Father's Name as per Aadhar",      required: false },
  { key: "motherAadhar",       label: "Mother's Aadhar Number",           required: false },
  { key: "motherAadharName",   label: "Mother's Name as per Aadhar",      required: false },
  { key: "udise",              label: "UDISE Number",                     required: false },
  { key: "pen",                label: "PEN Number",                       required: false },
  { key: "apaar",              label: "APAAR ID",                         required: false },
  { key: "lastSchoolName",     label: "Last School Name",                 required: false },
  { key: "lastSchoolClass",    label: "Last School Class",                required: false },
  { key: "lastSchoolGrNo",     label: "Last School GR No",                required: false },
  { key: "lastSchoolMedium",   label: "Last School Medium",               required: false },
  { key: "lastSchoolPlace",    label: "Last School Place",                required: false },
  { key: "prevAttendanceDays", label: "Previous Attendance Days",         required: false },
  { key: "lastExamGiven",      label: "Last Exam Given (Yes/No)",         required: false },
  { key: "prevPercentage",     label: "Previous Percentage",              required: false },
];

// GR-only fields not already covered by BULK_IMPORT_FIELDS - only meaningful
// for "Left" rows (a currently-enrolled student has no leaving date/TC yet).
const GR_ONLY_FIELDS = [
  { key: "surname",       label: "Surname",         required: false },
  { key: "dateOfLeaving", label: "Date of Leaving (DD-MM-YYYY)", required: false, isDate: true },
  { key: "classWhenLeft", label: "Class When Left", required: false },
  { key: "tcNo",          label: "TC No",           required: false },
];

const IMPORT_FIELD_DEFS = [STATUS_FIELD, ...BULK_IMPORT_FIELDS, ...GR_ONLY_FIELDS];

const IMPORT_DATE_KEYS = new Set(["joinDate", "dob", "birthCertRegDate", "dateOfLeaving"]);
const IMPORT_LONG_ID_KEYS = new Set(["udise", "pen", "apaar", "aadharNo", "fatherAadhar", "motherAadhar"]);

export default function GrBookPage() {
  const [tab, setTab]           = useState("register"); // 'register' | 'import'
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    setLoadError("");
    getGrBookEntries()
      .then(setEntries)
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (e.grNo || "").toLowerCase().includes(q)
      || (e.studentName || "").toLowerCase().includes(q)
      || (e.surname || "").toLowerCase().includes(q)
      || (e.fatherName || "").toLowerCase().includes(q);
  });

  function sourceLabel(e) { return e._source === "system" ? "In System" : "Imported Record"; }

  function doExportExcel() {
    const isoToday = new Date().toISOString().slice(0, 10);
    const headerRow = ["Status", "Source", ...REGISTER_COLUMNS.map(f => f.label)];
    const rows = [
      ["Satyam Stars International School"],
      ["Surat, Gujarat  |  GSEB Board  |  English Medium"],
      ["GR Book — Digital General Register"],
      [`Generated: ${fmtDMY(isoToday)}`, "", `Total Records: ${filtered.length}`],
      [],
      headerRow,
      ...filtered.map(e => [
        e.status, sourceLabel(e),
        ...REGISTER_COLUMNS.map(f => fmtField(e[f.key], f.type)),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = headerRow.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GR Book");
    XLSX.writeFile(wb, `GR_Book_${isoToday}.xlsx`);
  }

  async function doExportPDF() {
    const isoToday = new Date().toISOString().slice(0, 10);
    const columns = [{ key: "status", label: "Status" }, { key: "source", label: "Source" }, ...REGISTER_COLUMNS];
    const rows = filtered.map(e => ({
      status: e.status,
      source: sourceLabel(e),
      ...Object.fromEntries(REGISTER_COLUMNS.map(f => [f.key, fmtField(e[f.key], f.type)])),
    }));
    await renderTablePdf({
      bandLabel: "GR Book — Digital General Register",
      columns, rows,
      infoLines: [`Total Records: ${filtered.length}`],
      filename: `GR_Book_${isoToday}.pdf`,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">GR Book</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Digital General Register — every student, past and present, ordered by GR No.
        </p>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit">
        <TabButton active={tab === "register"} onClick={() => setTab("register")} icon={BookMarked} label="Register" />
        <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={UploadCloud} label="Import GR Records" />
      </div>

      {tab === "register" ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search by GR No, name or father's name" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy" />
            </div>
            <div className="flex gap-2">
              <button onClick={doExportExcel} disabled={filtered.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40">
                <Download className="w-4 h-4" />Export Excel
              </button>
              <button onClick={doExportPDF} disabled={filtered.length === 0}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40">
                <FileText className="w-4 h-4" />Export PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40 gap-3">
                <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Loading register...</span>
              </div>
            ) : loadError ? (
              <div className="flex items-center justify-center h-40 text-sm text-red-500">{loadError}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <GraduationCap className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">{entries.length === 0 ? "No GR records yet" : "No records match your search"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left text-[11px] text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Documents</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Status</th>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Source</th>
                      {REGISTER_COLUMNS.map(f => (
                        <th key={f.key} className="px-3 py-2.5 font-semibold whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((e, i) => (
                      <tr key={e._studentId || e._importId || i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <button onClick={() => setSelected(e)}
                            className="text-xs font-semibold text-school-navy hover:underline">
                            {e._source === "import" ? "View / Edit" : "View"}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            e.status === "Active" ? "bg-green-50 text-green-700"
                            : e.status === "Imported" ? "bg-purple-50 text-purple-700"
                            : "bg-gray-100 text-gray-500"
                          }`}>{e.status}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            e._source === "system" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                          }`}>{sourceLabel(e)}</span>
                        </td>
                        {REGISTER_COLUMNS.map(f => (
                          <td key={f.key} className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                            {fmtField(e[f.key], f.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <ImportGrRecordsPanel onImportDone={load} onSwitchToRegister={() => setTab("register")} />
      )}

      {selected && (
        <GrDetailModal entry={selected} onClose={() => setSelected(null)} onSaved={load} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"
      }`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

// ── Detail modal: view (all sources) + inline edit & doc upload (import only) ──
function GrDetailModal({ entry, onClose, onSaved }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm]         = useState(entry);
  const [saving, setSaving]     = useState(false);
  const [docs, setDocs]         = useState(null);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState(null);
  const fileRef = useRef(null);
  const pendingUploadField = useRef(null);

  useEffect(() => {
    setDocsLoading(true);
    getGrBookDocuments(entry).then(setDocs).catch(() => setDocs({})).finally(() => setDocsLoading(false));
  }, [entry]);

  const isImport = entry._source === "import";

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGrBookImportRow(entry._importId, {
        gr_no: form.grNo || null, surname: form.surname || null, student_name: form.studentName || null,
        father_name: form.fatherName || null, mother_name: form.motherName || null,
        religion: form.religion || null, caste: form.caste || null,
        birth_village: form.birthVillage || null, birth_city: form.birthCity || null,
        birth_district: form.birthDistrict || null, birth_state: form.birthState || null,
        dob: form.dob || null, last_school_gr_no: form.lastSchoolGrNo || null, last_school_name: form.lastSchoolName || null,
        date_of_admission: form.dateOfAdmission || null, admission_class: form.admissionClass || null,
        aadhar_no: form.aadharNo || null, udise_no: form.udiseNo || null, apaar_id: form.apaarId || null,
        pen_no: form.penNo || null, date_of_leaving: form.dateOfLeaving || null,
        class_when_left: form.classWhenLeft || null, tc_no: form.tcNo || null,
      });
      setEditMode(false);
      onSaved?.();
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function openUploadFor(dbField) {
    pendingUploadField.current = dbField;
    fileRef.current?.click();
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    const dbField = pendingUploadField.current;
    e.target.value = "";
    if (!file || !dbField) return;
    setUploadingKey(dbField);
    try {
      await uploadGrBookDocument(entry._importId, dbField, file);
      const fresh = await getGrBookDocuments(entry);
      setDocs(fresh);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-800">{[entry.studentName, entry.surname].filter(Boolean).join(" ") || "GR Record"}</p>
            <p className="text-xs text-gray-400">GR No {entry.grNo || "—"} · {entry._source === "system" ? "In System" : "Imported Record"}</p>
          </div>
          <div className="flex items-center gap-2">
            {isImport && (
              editMode ? (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-school-navy text-white hover:bg-school-navy/90 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save"}
                </button>
              ) : (
                <button onClick={() => { setForm(entry); setEditMode(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
                  <Pencil className="w-3.5 h-3.5" />Edit
                </button>
              )
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {!isImport && (
            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              This record is derived from the student's live profile. To correct a field, update it via Student → Update,
              or via Transfer Certificate issuance for leaving details.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {FIELD_DEFS.map(f => (
              <div key={f.key}>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{f.label}</p>
                {editMode && !f.derived ? (
                  f.type === "date" ? (
                    <DateInputDMY value={form[f.key] || ""} onChange={e => setField(f.key, e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy" />
                  ) : (
                    <input type="text" value={form[f.key] || ""} onChange={e => setField(f.key, e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy" />
                  )
                ) : (
                  <p className="text-sm text-gray-800 mt-0.5">{fmtField(f.derived ? entry[f.key] : entry[f.key], f.type)}</p>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Documents</p>
            {docsLoading ? (
              <p className="text-sm text-gray-400">Loading documents...</p>
            ) : (
              <div className="flex flex-col gap-2">
                {DOC_FIELDS.map(d => {
                  const url = docs?.[d.key];
                  const isRequiredMissing = !url && d.requiredIf && d.requiredIf(entry);
                  return (
                    <div key={d.key} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${isRequiredMissing ? "bg-red-50 border border-red-100" : "bg-gray-50"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${isRequiredMissing ? "text-red-400" : "text-gray-400"}`} />
                        <span className="text-sm text-gray-700 truncate">{d.label}</span>
                        {isRequiredMissing && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">Required</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-school-navy hover:underline">
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Not uploaded</span>
                        )}
                        {isImport && (
                          <button onClick={() => openUploadFor(d.dbField)} disabled={uploadingKey === d.dbField}
                            className="text-xs font-semibold text-gray-500 hover:text-school-navy disabled:opacity-50">
                            {uploadingKey === d.dbField ? "Uploading..." : url ? "Replace" : "Upload"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!isImport && (
                  <p className="text-xs text-gray-400 mt-1">
                    Documents are managed from the Documents module and Transfer Certificate issuance.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChosen} />
      </div>
    </div>
  );
}

// ── Import GR Records: download template -> upload -> preview -> confirm ──
// Same download -> upload -> preview -> confirm flow as ImportStudentsPanel
// (super-admin/page.js), but each row's Status decides where it's written:
// "Active" rows go through the same addStudent() call the Super Admin bulk
// importer uses (a real student + enrollment), "Left" rows go into
// gr_book_imports as a paper-register-only entry, same as before this field
// list was merged with the bulk importer's.
function ImportGrRecordsPanel({ onImportDone, onSwitchToRegister }) {
  const fileRef = useRef(null);
  const [step, setStep]           = useState("idle"); // idle | preview | importing | done
  const [parsed, setParsed]       = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState([]);

  function downloadTemplate() {
    const fields = IMPORT_FIELD_DEFS;
    const headerRow = fields.map(f => f.label);
    const reqRow = fields.map(f => {
      if (f.key === "status") return "Required *";
      if (f.required) return "Required for Active";
      return "Optional";
    });
    const exampleRow = [
      "Active",
      // Admission Info
      "GR001", "5th", "5th", "A", "1", "01-06-2026", "15500", "0", "",
      // Personal Info
      "Arjun", "Patel", "Rajesh Patel", "Meena Patel", "15-06-2015",
      "BC2015/001", "01-01-2016",
      "Male", "Pandesara", "Surat", "Surat", "Gujarat", "Gujarati", "Hindu", "General", "Patel", "120", "25",
      // Contact
      "9876543210", "", "12", "Gandhi Nagar", "Near Park", "Adajan", "395009", "12 Gandhi Nagar, Adajan, Surat",
      // IDs
      "1234 5678 9012", "Arjun Rajesh Patel",
      "9876 5432 1012", "Rajesh Kumar Patel",
      "8765 4321 0123", "Meena Rajesh Patel",
      "", "", "",
      // Previous School
      "City Primary School", "4th", "", "Gujarati", "Surat", "200", "Yes", "75.5",
      // GR-only (Left rows)
      "", "", "", "",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow, reqRow, exampleRow]);

    // Dates and long ID numbers formatted as Text down to row 1000, same
    // silent-corruption fix as the student importer's downloadTemplate().
    const TOTAL_ROWS = 1000;
    fields.forEach((f, colIdx) => {
      if (!IMPORT_DATE_KEYS.has(f.key) && !IMPORT_LONG_ID_KEYS.has(f.key)) return;
      for (let r = 2; r < TOTAL_ROWS; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: colIdx });
        if (ws[addr]) ws[addr].z = "@";
        else ws[addr] = { t: "s", v: "", z: "@" };
      }
    });
    ws["!ref"]  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: TOTAL_ROWS - 1, c: fields.length - 1 } });
    ws["!cols"] = fields.map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GR Book");
    XLSX.writeFile(wb, "GR_Book_Import_Template.xlsx");
  }

  function normalizeDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, "0"), d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(val).replace(/\s+/g, " ").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const dd = d.padStart(2, "0"), mm = m.padStart(2, "0");
      if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
      return `${y}-${mm}-${dd}`;
    }
    const serial = Number(s);
    if (!isNaN(serial) && serial > 1000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      if (!isNaN(date.getTime())) return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
    }
    return null;
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    const fields = IMPORT_FIELD_DEFS;
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 3) { alert("File has no data rows. Please use the downloaded template."); return; }
        const headerRow = rows[0];
        const stripHint = (label) => String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
        const colMap = {};
        fields.forEach(f => {
          const idx = headerRow.findIndex(h => stripHint(h) === stripHint(f.label));
          if (idx >= 0) colMap[f.key] = idx;
        });
        const dataRows = rows.slice(2);
        const result = [];
        const errs = [];
        dataRows.forEach((row, i) => {
          if (row.every(c => !c)) return;
          const s = { _row: i + 3, _errors: [] };
          fields.forEach(f => {
            const raw = colMap[f.key] !== undefined ? (row[colMap[f.key]] ?? "") : "";
            if (IMPORT_DATE_KEYS.has(f.key)) {
              s[f.key] = raw ? (normalizeDate(raw) || "") : "";
              s["_raw_" + f.key] = raw instanceof Date ? raw.toDateString() : String(raw).trim();
            } else {
              s[f.key] = raw instanceof Date ? (normalizeDate(raw) || "") : String(raw).trim();
            }
          });

          // Status decides which validation rules and which write-path apply.
          const statusNorm = String(s.status || "").trim().toLowerCase();
          if (statusNorm === "active") s.status = "Active";
          else if (statusNorm === "left") s.status = "Left";
          else s._errors.push(`Status "${s.status || ""}" must be "Active" or "Left"`);

          if (s.status === "Active") {
            BULK_IMPORT_FIELDS.filter(f => f.required).forEach(f => {
              if (!s[f.key]) s._errors.push(`${f.label} is required for an Active student`);
            });
          } else {
            if (!s.grNo) s._errors.push("GR No missing");
          }

          if (!s.dob && s._raw_dob) s._errors.push(`Date of Birth "${s._raw_dob}" is not a valid date — use DD-MM-YYYY`);
          if (!s.joinDate && s._raw_joinDate) s._errors.push(`Date of Joining "${s._raw_joinDate}" is not a valid date`);
          if (!s.dateOfLeaving && s._raw_dateOfLeaving) s._errors.push(`Date of Leaving "${s._raw_dateOfLeaving}" is not a valid date`);

          result.push(s);
          if (s._errors.length) errs.push("Row " + s._row + ": " + s._errors.join(", "));
        });
        setParsed(result);
        setRowErrors(errs);
        setStep("preview");
      } catch { alert("Could not read the file. Please use the downloaded template (.xlsx)."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function confirmImport() {
    const valid = parsed.filter(s => s._errors.length === 0);
    const leftRows   = valid.filter(s => s.status === "Left");
    const activeRows = valid.filter(s => s.status === "Active");
    setImporting(true);
    setStep("importing");
    const log = [];

    // Left rows: unchanged from before - a single batch insert into
    // gr_book_imports, the paper-register-only table.
    if (leftRows.length) {
      try {
        await createGrBookImportRows(leftRows.map(s => ({
          gr_no: s.grNo, surname: s.surname || s.lastName || null, student_name: s.firstName || null,
          father_name: s.fatherName || null, mother_name: s.motherName || null,
          religion: s.religion || null, caste: s.caste || null,
          birth_village: s.birthVillage || null, birth_city: s.birthCity || null,
          birth_district: s.birthDistrict || null, birth_state: s.birthState || null,
          dob: s.dob || null, last_school_gr_no: s.lastSchoolGrNo || null, last_school_name: s.lastSchoolName || null,
          date_of_admission: s.joinDate || null, admission_class: s.admissionClass || null,
          aadhar_no: s.aadharNo || null, udise_no: s.udise || null, apaar_id: s.apaar || null,
          pen_no: s.pen || null, date_of_leaving: s.dateOfLeaving || null,
          class_when_left: s.classWhenLeft || null, tc_no: s.tcNo || null,
        })));
        leftRows.forEach(s => log.push({ row: s._row, grNo: s.grNo, status: "Left", ok: true }));
      } catch (err) {
        leftRows.forEach(s => log.push({ row: s._row, grNo: s.grNo, status: "Left", ok: false, error: err.message }));
      }
    }

    // Active rows: one addStudent() call per row, same payload shape and
    // per-row try/catch as the Super Admin bulk importer (super-admin/page.js
    // ImportStudentsPanel.confirmImport) - reused, not reimplemented, since
    // it's the exact same "create a real student" operation.
    for (const s of activeRows) {
      try {
        const payload = {
          std:               s.cls,
          admissionClass:    s.admissionClass || s.cls,
          section:           s.section || "A",
          rollNo:            s.rollNo ? Number(s.rollNo) : undefined,
          firstName:         s.firstName,
          lastName:          s.lastName,
          fatherName:        s.fatherName || "",
          motherName:        s.motherName || "",
          gender:            s.gender,
          dob:               s.dob || null,
          placeOfBirth:      composePlaceOfBirth(s.birthCity, s.birthDistrict, s.birthState),
          birthState:        s.birthState || "",
          birthDistrict:     s.birthDistrict || "",
          birthCity:         s.birthCity || "",
          birthVillage:      s.birthVillage || "",
          motherTongue:      s.motherTongue || "",
          religion:          s.religion || "",
          caste:             s.caste || "General",
          subCaste:          s.subCaste || "",
          height:            s.height || null,
          weight:            s.weight || null,
          grNo:              s.grNo || "",
          mobile:            s.mobile1 || "",
          mobile2:           s.mobile2 || "",
          roomPlotNo:        s.roomPlotNo || "",
          society:           s.society || "",
          landmark:          s.landmark || "",
          area:              s.area || "",
          pinCode:           s.pinCode || "",
          address:           s.address || [s.roomPlotNo, s.society, s.landmark, s.area, "SURAT", "GUJARAT", s.pinCode].filter(Boolean).join(", "),
          aadhar:            s.aadharNo || "",
          aadharName:        s.aadharName || "",
          fatherAadhar:      s.fatherAadhar?.replace(/\s/g, "") || null,
          fatherAadharName:  s.fatherAadharName || null,
          motherAadhar:      s.motherAadhar?.replace(/\s/g, "") || null,
          motherAadharName:  s.motherAadharName || null,
          birthCertRegNo:    s.birthCertRegNo || null,
          birthCertRegDate:  s.birthCertRegDate || null,
          udise:             s.udise || "",
          pen:               s.pen || "",
          apaar:             s.apaar || "",
          dateOfJoin:        s.joinDate || new Date().toISOString().split("T")[0],
          feeTotal:          s.feeTotal ? Number(s.feeTotal) : 0,
          discountAmount:    s.discountAmount ? Number(s.discountAmount) : 0,
          discountReason:    s.discountReason || "",
          lastSchoolName:    s.lastSchoolName || "",
          lastSchoolClass:   s.lastSchoolClass || "",
          lastSchoolGrNo:    s.lastSchoolGrNo || "",
          lastSchoolMedium:  s.lastSchoolMedium || "",
          lastSchoolPlace:   s.lastSchoolPlace || "",
          prevAttendanceDays: s.prevAttendanceDays || "",
          lastExamGiven:     s.lastExamGiven || "No",
          prevPercentage:    s.prevPercentage || "",
        };
        await addStudent(payload);
        log.push({ row: s._row, grNo: s.grNo, name: `${s.firstName} ${s.lastName}`, status: "Active", ok: true });
      } catch (err) {
        log.push({ row: s._row, grNo: s.grNo, name: `${s.firstName} ${s.lastName}`, status: "Active", ok: false, error: err.message });
      }
      setImportLog([...log]);
    }

    setImportLog(log);
    setImporting(false);
    setStep("done");
    onImportDone?.();
  }

  const validCount = parsed.filter(s => s._errors.length === 0).length;
  const invalidCount = parsed.length - validCount;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {step === "idle" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-blue-100 bg-blue-50/50 rounded-xl p-5">
            <p className="text-sm font-bold text-blue-800 mb-2">Step 1 — Download Template</p>
            <ul className="text-xs text-blue-600 space-y-1 mb-4 list-disc list-inside">
              <li>One row per student — mark each row's Status as <strong>Active</strong> or <strong>Left</strong></li>
              <li><strong>Active</strong> students are added as real enrolled students (current academic year) and will appear in the Student module too — fill the full field set (class, address, mobile, etc.)</li>
              <li><strong>Left</strong> students are recorded in the historical register only, same as before — just the GR fields, plus Date of Leaving / Class When Left / TC No</li>
              <li>Dates must be DD-MM-YYYY</li>
            </ul>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors">
              <Download className="w-4 h-4" />Download Template
            </button>
          </div>
          <div className="border-2 border-green-100 bg-green-50/50 rounded-xl p-5">
            <p className="text-sm font-bold text-green-800 mb-2">Step 2 — Upload Filled File</p>
            <p className="text-xs text-green-600 mb-4">
              Digitize the whole GR sequence in one pass — students still studying this session become real student
              records, students who left long ago are recorded in the register only.
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              <UploadCloud className="w-4 h-4" />Choose File
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
              <Check className="w-4 h-4" />{validCount} valid
            </span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <AlertTriangle className="w-4 h-4" />{invalidCount} with errors (will be skipped)
              </span>
            )}
          </div>
          {rowErrors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 max-h-40 overflow-y-auto">
              {rowErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">GR No</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Father's Name</th>
                  <th className="px-3 py-2 font-semibold">DOB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsed.slice(0, 10).map((s, i) => (
                  <tr key={i} className={s._errors.length ? "bg-red-50/50" : ""}>
                    <td className="px-3 py-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.status === "Active" ? "bg-green-50 text-green-700"
                        : s.status === "Left" ? "bg-gray-100 text-gray-500"
                        : "bg-red-50 text-red-600"
                      }`}>{s.status || "—"}</span>
                    </td>
                    <td className="px-3 py-1.5">{s.grNo || "—"}</td>
                    <td className="px-3 py-1.5">{[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-1.5">{s.fatherName || "—"}</td>
                    <td className="px-3 py-1.5">{s.dob || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 10 && <p className="text-xs text-gray-400 px-3 py-2">...and {parsed.length - 10} more rows</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("idle")} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={confirmImport} disabled={validCount === 0 || importing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark disabled:opacity-40 transition-colors">
              Import {validCount} Record{validCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="flex items-center justify-center h-32 gap-3">
          <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Importing...</span>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <Check className="w-5 h-5" />
            {importLog.filter(l => l.ok && l.status === "Left").length} recorded in register,{" "}
            {importLog.filter(l => l.ok && l.status === "Active").length} added as students
          </div>
          {importLog.some(l => !l.ok) && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              {importLog.filter(l => !l.ok).map((l, i) => (
                <p key={i} className="text-xs text-red-600">
                  {l.row ? `Row ${l.row} (${l.grNo || l.name || "—"}): ` : ""}{l.error}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setStep("idle"); setParsed([]); setRowErrors([]); setImportLog([]); }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Import More
            </button>
            <button onClick={onSwitchToRegister}
              className="px-4 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark">
              View Register
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
