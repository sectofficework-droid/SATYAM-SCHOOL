"use client";

import { useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  X, Download, Upload, Check, AlertCircle, CheckCircle2,
} from "lucide-react";
import { addStudent, getClasses } from "@/lib/studentService";
import { normalizeDate } from "@/lib/importUtils";

// Basic Details Import - Student module. Only the fields a school can
// realistically collect for its whole roster in one pass: Class, Name,
// Father/Mother Name, DOB, Mobile 1/2, Address. Each row gets a real
// enrollment number and a working app login (addStudent() already leaves
// app_password unset, which is exactly what the ordinary Add Student form
// does too - the DB default hashes a working password for both) so the
// student can use the app immediately; data_status:"Incomplete" marks the
// record for later backfill via Super Admin > Replace Full Details.
const BASIC_FIELDS = [
  { key: "cls",         label: "Class",         required: true },
  { key: "studentName", label: "Student Name",  required: true },
  { key: "fatherName",  label: "Father Name",   required: true },
  { key: "motherName",  label: "Mother Name",   required: true },
  { key: "dob",         label: "Date of Birth (DD-MM-YYYY)", required: true },
  { key: "mobile1",     label: "Mobile 1",      required: true },
  { key: "mobile2",     label: "Mobile 2",      required: false },
  { key: "address",     label: "Address",       required: false },
];
const BASIC_DATE_KEYS = new Set(["dob"]);
const BASIC_EXAMPLE_ROW = ["5th", "Arjun Patel", "Rajesh Patel", "Meena Patel", "15-06-2015", "9876543210", "", "12 Gandhi Nagar, Adajan, Surat"];

// "Student Name" -> firstName/lastName the same way the students table
// already splits them - first word is the first name, everything after is
// the last name (empty string if there's no space, which is fine: last_name
// is NOT NULL but an empty string satisfies that).
function splitName(full) {
  const s = String(full || "").trim().replace(/\s+/g, " ");
  const idx = s.indexOf(" ");
  if (idx === -1) return { firstName: s, lastName: "" };
  return { firstName: s.slice(0, idx), lastName: s.slice(idx + 1) };
}

export default function BasicDetailsImportModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [classNames, setClassNames] = useState([]);
  const [step,      setStep]      = useState("idle");
  const [parsed,    setParsed]    = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState([]);

  useEffect(() => {
    getClasses().then(list => setClassNames((list || []).map(c => c.name))).catch(() => {});
  }, []);

  function normalizeClass(raw) {
    if (!raw) return raw;
    const key = raw.trim().toUpperCase().replace(/\./g, " ").replace(/\s+/g, " ");
    const match = classNames.find(c => c.toUpperCase().replace(/\./g, " ").replace(/\s+/g, " ") === key);
    return match || raw;
  }

  function downloadTemplate() {
    const headerRow = BASIC_FIELDS.map(f => f.label);
    const reqRow    = BASIC_FIELDS.map(f => f.required ? "Required *" : "Optional");
    const ws = XLSX.utils.aoa_to_sheet([headerRow, reqRow, BASIC_EXAMPLE_ROW]);

    const TOTAL_ROWS = 1000;
    BASIC_FIELDS.forEach((f, colIdx) => {
      if (!BASIC_DATE_KEYS.has(f.key)) return;
      for (let r = 2; r < TOTAL_ROWS; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: colIdx });
        if (ws[addr]) ws[addr].z = "@";
        else ws[addr] = { t: "s", v: "", z: "@" };
      }
    });
    ws["!ref"]  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: TOTAL_ROWS - 1, c: BASIC_FIELDS.length - 1 } });
    ws["!cols"] = BASIC_FIELDS.map(() => ({ wch: 22 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Student_Basic_Details_Import_Template.xlsx");
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: "binary", cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 3) { alert("File has no data rows. Please use the downloaded template."); return; }
        const headerRow = rows[0];
        const colMap = {};
        const stripHint = (label) => String(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
        BASIC_FIELDS.forEach(f => {
          const idx = headerRow.findIndex(h => stripHint(h) === stripHint(f.label));
          if (idx >= 0) colMap[f.key] = idx;
        });
        const dataRows = rows.slice(2);
        const result = [];
        const errs   = [];
        dataRows.forEach((row, i) => {
          if (row.every(c => !c)) return;
          const s = { _row: i + 3, _errors: [] };
          BASIC_FIELDS.forEach(f => {
            const raw = colMap[f.key] !== undefined ? (row[colMap[f.key]] ?? "") : "";
            if (BASIC_DATE_KEYS.has(f.key)) {
              s[f.key]           = raw ? (normalizeDate(raw) || "") : "";
              s["_raw_" + f.key] = raw instanceof Date ? raw.toDateString() : String(raw).trim();
            } else {
              s[f.key] = raw instanceof Date ? normalizeDate(raw) || "" : String(raw).trim();
            }
          });
          s.cls = normalizeClass(s.cls);
          const { firstName, lastName } = splitName(s.studentName);
          s.firstName = firstName;
          s.lastName  = lastName;

          if (!s.cls) s._errors.push("Class missing");
          if (s.cls && classNames.length > 0 && !classNames.includes(s.cls)) s._errors.push(`Unknown class "${s.cls}"`);
          if (!s.studentName) s._errors.push("Student Name missing");
          if (!s.fatherName)  s._errors.push("Father Name missing");
          if (!s.motherName)  s._errors.push("Mother Name missing");
          if (!s.dob && s._raw_dob) s._errors.push(`Date of Birth "${s._raw_dob}" is not a valid date — use DD-MM-YYYY`);
          if (!s.dob && !s._raw_dob) s._errors.push("Date of Birth missing");
          if (!s.mobile1) s._errors.push("Mobile 1 missing");

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
    setImporting(true);
    setImportLog([]);
    const log = [];
    // Sequential, not Promise.all - getNextEnrollmentNo() (inside addStudent)
    // re-queries the live MAX every call and is only safe one row at a time.
    for (const s of valid) {
      const label = `${s.firstName} ${s.lastName}`.trim();
      try {
        const payload = {
          std:         s.cls,
          firstName:   s.firstName,
          lastName:    s.lastName,
          fatherName:  s.fatherName,
          motherName:  s.motherName,
          dob:         s.dob,
          mobile:      s.mobile1,
          mobile2:     s.mobile2 || "",
          address:     s.address || "",
          dataStatus:  "Incomplete",
        };
        const result = await addStudent(payload);
        const mismatches = ["firstName", "lastName", "dob"]
          .filter(k => payload[k] && payload[k] !== result?.student?.[k === "firstName" ? "first_name" : k === "lastName" ? "last_name" : "dob"]);
        log.push({
          name: label,
          enrollmentNo: result?.enrollment?.enrollment_no || "",
          ok: true,
          warning: mismatches.length ? `Didn't save: ${mismatches.join(", ")}` : null,
        });
      } catch (err) {
        log.push({ name: label, ok: false, err: err?.message || "Error" });
      }
      setImportLog([...log]);
    }
    setImporting(false);
    setStep("done");
    if (onImported) onImported();
  }

  function reset() { setParsed([]); setRowErrors([]); setStep("idle"); setImportLog([]); }

  const valid   = parsed.filter(s => s._errors.length === 0);
  const invalid = parsed.filter(s => s._errors.length  >  0);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 sm:my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Import Basic Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Bulk-add students with just the essentials — enrollment no + app login assigned automatically</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Students imported here are marked <span className="font-semibold">Incomplete</span> in the student list until their full details are
              added later via Super Admin → Replace Full Details (matched by the enrollment no assigned here).
            </p>
          </div>

          {step === "idle" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900">Step 1 — Download Template</p>
                    <p className="text-xs text-blue-600 mt-0.5">8 columns — Class, Name, Parents, DOB, Mobile, Address</p>
                  </div>
                </div>
                <ul className="text-xs text-blue-700 space-y-1 pl-1">
                  {["Row 2 shows which fields are required", "Row 3 shows example data — replace with real data", "Do not change column headers or order"].map(t => (
                    <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0" />{t}</li>
                  ))}
                </ul>
                <button onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                  <Download className="w-4 h-4" /> Download Template (.xlsx)
                </button>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-900">Step 2 — Upload Filled File</p>
                    <p className="text-xs text-green-600 mt-0.5">Upload the template after filling in student data</p>
                  </div>
                </div>
                <ul className="text-xs text-green-700 space-y-1 pl-1">
                  {["Use only the downloaded template", "One student per row starting from Row 3", "Supports .xlsx and .xls files"].map(t => (
                    <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0" />{t}</li>
                  ))}
                </ul>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                  <Upload className="w-4 h-4" /> Select Excel File
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> {valid.length} valid student{valid.length !== 1 ? "s" : ""}
                </div>
                {invalid.length > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                    <AlertCircle className="w-4 h-4" /> {invalid.length} row{invalid.length !== 1 ? "s" : ""} with errors
                  </div>
                )}
                <span className="text-xs text-gray-400">{parsed.length} total rows parsed</span>
              </div>
              {rowErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">Errors — these rows will be skipped</p>
                  {rowErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                    </p>
                  ))}
                </div>
              )}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-bold text-gray-700">Preview — First 10 valid rows</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-school-navy text-white">
                        {["#", "Name", "DOB", "Class", "Father", "Mobile 1"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {valid.slice(0, 10).map((s, i) => (
                        <tr key={i} className={"border-b border-gray-50 " + (i % 2 === 0 ? "bg-white" : "bg-gray-50/40")}>
                          <td className="px-3 py-2 text-gray-400">{s._row}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800">{s.firstName} {s.lastName}</td>
                          <td className="px-3 py-2 font-semibold text-orange-600 whitespace-nowrap">{s.dob}</td>
                          <td className="px-3 py-2 text-school-navy font-semibold">{s.cls}</td>
                          <td className="px-3 py-2 text-gray-600">{s.fatherName || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{s.mobile1 || "—"}</td>
                        </tr>
                      ))}
                      {valid.length > 10 && (
                        <tr><td colSpan={6} className="px-3 py-2 text-center text-xs text-gray-400">... and {valid.length - 10} more students</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={confirmImport}
                  disabled={valid.length === 0 || importing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-50">
                  {importing
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing {importLog.length}/{valid.length}...</>
                    : <><Upload className="w-4 h-4" /> Import {valid.length} Student{valid.length !== 1 ? "s" : ""}</>
                  }
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-800">Import Complete!</p>
              <p className="text-sm text-gray-500">
                <span className="font-bold text-green-700">{importLog.filter(l => l.ok).length} students</span> imported successfully.
                {importLog.filter(l => !l.ok).length > 0 && <><br /><span className="text-red-500">{importLog.filter(l => !l.ok).length} failed</span> — check errors below.</>}
              </p>
              {importLog.filter(l => l.ok).length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full max-w-md text-left space-y-1 max-h-40 overflow-y-auto">
                  {importLog.filter(l => l.ok).map((l, i) => (
                    <p key={i} className="text-xs text-green-700">
                      <span className="font-mono font-semibold">#{l.enrollmentNo}</span> {l.name}
                      {l.warning && <span className="text-amber-600"> — {l.warning}</span>}
                    </p>
                  ))}
                </div>
              )}
              {importLog.filter(l => !l.ok).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 w-full max-w-md text-left space-y-1 max-h-40 overflow-y-auto">
                  {importLog.filter(l => !l.ok).map((l, i) => (
                    <p key={i} className="text-xs text-red-600">{l.name}: {l.err}</p>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={reset}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors">
                  <Upload className="w-4 h-4" /> Import More Students
                </button>
                <button onClick={onClose}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
