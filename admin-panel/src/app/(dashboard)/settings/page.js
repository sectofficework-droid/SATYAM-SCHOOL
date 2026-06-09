"use client";

import { useState, useRef } from "react";
import useStore from "@/lib/store";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Building2, Calendar, IndianRupee, BookOpen, Users,
  Save, Plus, Trash2, Eye, EyeOff, Check, X,
  Phone, Mail, MapPin, Hash, Shield, UserPlus,
  GraduationCap, Lock, ChevronDown, ChevronUp, Pencil,
  AlertCircle, LogOut, SlidersHorizontal, LayoutGrid,
  Download, FileSpreadsheet,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES = [
  "JR KG","SR KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th Commerce","12th Commerce",
];

const BOARDS   = ["GSEB","CBSE","ICSE","IB","State Board"];
const MEDIUMS  = ["English","Gujarati","Hindi","Semi-English"];
const ROLES    = ["Super Admin","Management Head","Fee Clerk","Teacher","Receptionist"];
const INIT_YEARS = ["2024-25","2025-26","2026-27"];

// ── Default State ─────────────────────────────────────────────────────────────
const DEF_SCHOOL = {
  name:"Satyam Stars International School",
  address:"Gandhi Nagar", city:"Surat", state:"Gujarat", pin:"395001",
  phone:"+91 98765 43210", email:"info@satyamstars.edu.in",
  board:"GSEB", medium:"English",
  udise:"24XXXXXXXX", affiliation:"AFF-XXXX",
  website:"www.satyamstars.edu.in",
};

const DEF_YEAR = {
  current:"2026-27",
  newAdmissionDate:"2026-04-01",
  readmissionDate:"2026-03-15",
};

const DEF_FEE = CLASSES.map(cls => ({
  cls,
  tuition:  (cls==="JR KG"||cls==="SR KG"||cls==="Balvatika") ? 8000
          : (["1st","2nd","3rd","4th","5th"].includes(cls))    ? 10000
          : (["6th","7th","8th","9th","10th"].includes(cls))   ? 12000
          : 15000,
  admission: 2000,
  transport: 3000,
  lab:       (["6th","7th","8th","9th","10th","11th Commerce","12th Commerce"].includes(cls)) ? 1500 : 0,
  sports:    500,
  library:   500,
}));

const DEF_UNIFORM = CLASSES.map(cls => ({ cls, amount: 1500 }));

const DEF_SECTIONS = CLASSES.map(cls => ({
  cls,
  sections:["A","B"],
  teacher:"",
}));

const DEF_USERS = [
  { id:1, name:"Admin User",    email:"admin@satyamstars.edu.in", role:"Super Admin",     status:"Active",  pass:"" },
  { id:2, name:"Fee Clerk",     email:"fees@satyamstars.edu.in",  role:"Fee Clerk",        status:"Active",  pass:"" },
  { id:3, name:"Management",    email:"mgmt@satyamstars.edu.in",  role:"Management Head",  status:"Active",  pass:"" },
];

// ── Timetable Constants ────────────────────────────────────────────────────────
const DAY_GROUPS = ["Mon – Wed", "Thu – Fri", "Saturday"];

const TIME_SLOTS = [
  { id:"prayer", label:"PRAYER",  time:"9:00 – 9:20",   special:true  },
  { id:"p1",     label:"Period 1", time:"9:20 – 10:20"                 },
  { id:"p2",     label:"Period 2", time:"10:20 – 11:10"                },
  { id:"recess", label:"RECESS",  time:"11:10 – 11:40", special:true  },
  { id:"p3",     label:"Period 3", time:"11:40 – 12:30"                },
  { id:"p4",     label:"Period 4", time:"12:30 – 1:20"                 },
  { id:"p5",     label:"Period 5", time:"1:20 – 2:00"                  },
];

const SUBJECTS_TT = [
  "Mathematics","Science","English","Hindi","Social Studies","Computer",
  "Accountancy","Economics","Business Studies","P.E.","Drawing",
  "Sanskrit","Gujarati","EVS","Odia","Rhymes & Activity","Dance / Yoga",
  "Activity & Play","Free Period",
];

const TEACHERS_TT = [
  "Pami Pradhan","Rashmita Patra","Priti Singh","Janki Das",
  "Shivani Pradhan","Smurti Panda","Manisha Biswal","Parvati Polai",
  "Sita Gouda","Kabita Panigrahi","Barsha Pradhan","Liza Patra",
  "Laxmi Behera","Pragyan Panda","Priyanka Bisoyi","Priyanka Padhi",
];

const TEACHER_PALETTE = [
  { bg:"bg-amber-100",   text:"text-amber-900",   border:"border-amber-300"   },
  { bg:"bg-blue-100",    text:"text-blue-900",    border:"border-blue-300"    },
  { bg:"bg-green-100",   text:"text-green-900",   border:"border-green-300"   },
  { bg:"bg-purple-100",  text:"text-purple-900",  border:"border-purple-300"  },
  { bg:"bg-pink-100",    text:"text-pink-900",    border:"border-pink-300"    },
  { bg:"bg-indigo-100",  text:"text-indigo-900",  border:"border-indigo-300"  },
  { bg:"bg-teal-100",    text:"text-teal-900",    border:"border-teal-300"    },
  { bg:"bg-orange-100",  text:"text-orange-900",  border:"border-orange-300"  },
  { bg:"bg-red-100",     text:"text-red-900",     border:"border-red-300"     },
  { bg:"bg-cyan-100",    text:"text-cyan-900",    border:"border-cyan-300"    },
  { bg:"bg-lime-100",    text:"text-lime-900",    border:"border-lime-300"    },
  { bg:"bg-rose-100",    text:"text-rose-900",    border:"border-rose-300"    },
  { bg:"bg-violet-100",  text:"text-violet-900",  border:"border-violet-300"  },
  { bg:"bg-emerald-100", text:"text-emerald-900", border:"border-emerald-300" },
  { bg:"bg-fuchsia-100", text:"text-fuchsia-900", border:"border-fuchsia-300" },
  { bg:"bg-sky-100",     text:"text-sky-900",     border:"border-sky-300"     },
];

const TEACHER_RGB_PALETTE = [
  [254,243,199],[219,234,254],[220,252,231],[243,232,255],
  [252,231,243],[224,231,255],[204,251,241],[255,237,213],
  [254,226,226],[207,250,254],[236,252,203],[255,228,230],
  [237,233,254],[209,250,229],[253,224,255],[224,242,254],
];

function getTeacherColor(teacher) {
  if (!teacher) return null;
  const idx = TEACHERS_TT.indexOf(teacher);
  return TEACHER_PALETTE[(idx >= 0 ? idx : 0) % TEACHER_PALETTE.length];
}

function shortName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0]}`
    : parts[0];
}

// ── Reusable Field ─────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

// ── View-mode value display ────────────────────────────────────────────────────
function ViewVal({ val, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 min-h-[38px]">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>}
      <span className="text-sm text-gray-800 font-medium">
        {val || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}

const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full";
const sel = inp + " cursor-pointer";

// ── Edit/Save/Cancel bar ───────────────────────────────────────────────────────
function EditBar({ editMode, saved, onEdit, onSave, onCancel }) {
  if (!editMode) {
    return (
      <div className="flex justify-end">
        <button onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors shadow-sm">
          <Pencil className="w-4 h-4"/> Edit
        </button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <button onClick={onCancel}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
        <X className="w-4 h-4"/> Cancel
      </button>
      <button onClick={onSave}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${saved ? "bg-green-500 text-white" : "bg-school-navy hover:bg-school-navy/90 text-white"}`}>
        {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

// ── Tab: School Profile ────────────────────────────────────────────────────────
function SchoolProfileTab() {
  const [form,     setForm]     = useState(DEF_SCHOOL);
  const [saved,    setSaved]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function startEdit() { setBackup({ ...form }); setEditMode(true); }
  function cancel()    { setForm(backup); setEditMode(false); }
  function save()      { setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2500); }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="School Name">
              {editMode
                ? <input className={inp} value={form.name} onChange={set("name")}/>
                : <ViewVal val={form.name}/>}
            </Field>
          </div>
          <Field label="Address">
            {editMode
              ? <input className={inp} value={form.address} onChange={set("address")} placeholder="Street / Area"/>
              : <ViewVal val={form.address}/>}
          </Field>
          <Field label="City">
            {editMode
              ? <input className={inp} value={form.city} onChange={set("city")}/>
              : <ViewVal val={form.city}/>}
          </Field>
          <Field label="State">
            {editMode
              ? <input className={inp} value={form.state} onChange={set("state")}/>
              : <ViewVal val={form.state}/>}
          </Field>
          <Field label="PIN Code">
            {editMode
              ? <input className={inp} value={form.pin} onChange={set("pin")} maxLength={6}/>
              : <ViewVal val={form.pin}/>}
          </Field>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Contact Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Phone Number">
            {editMode
              ? <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.phone} onChange={set("phone")}/></div>
              : <ViewVal val={form.phone} icon={Phone}/>}
          </Field>
          <Field label="Email Address">
            {editMode
              ? <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.email} onChange={set("email")} type="email"/></div>
              : <ViewVal val={form.email} icon={Mail}/>}
          </Field>
          <Field label="Website">
            {editMode
              ? <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.website} onChange={set("website")}/></div>
              : <ViewVal val={form.website} icon={MapPin}/>}
          </Field>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Academic Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Board">
            {editMode
              ? <select className={sel} value={form.board} onChange={set("board")}>{BOARDS.map(b => <option key={b}>{b}</option>)}</select>
              : <ViewVal val={form.board}/>}
          </Field>
          <Field label="Medium">
            {editMode
              ? <select className={sel} value={form.medium} onChange={set("medium")}>{MEDIUMS.map(m => <option key={m}>{m}</option>)}</select>
              : <ViewVal val={form.medium}/>}
          </Field>
          <Field label="UDISE Code">
            {editMode
              ? <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.udise} onChange={set("udise")}/></div>
              : <ViewVal val={form.udise} icon={Hash}/>}
          </Field>
          <Field label="Affiliation Number">
            {editMode
              ? <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.affiliation} onChange={set("affiliation")}/></div>
              : <ViewVal val={form.affiliation} icon={Hash}/>}
          </Field>
        </div>
      </div>

      <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
    </div>
  );
}

// ── Tab: Academic Year ─────────────────────────────────────────────────────────
function AcademicYearTab() {
  const setReadmissionDate = useStore(s => s.setReadmissionDate);

  const [yearsList, setYearsList] = useState(INIT_YEARS);
  const [form,      setForm]      = useState(DEF_YEAR);
  const [saved,     setSaved]     = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [backup,    setBackup]    = useState(null);
  const [newYear,   setNewYear]   = useState("");
  const [addError,  setAddError]  = useState("");

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function startEdit() {
    setBackup({ form: { ...form }, yearsList: [...yearsList] });
    setEditMode(true);
    setNewYear("");
    setAddError("");
  }

  function cancel() {
    setForm(backup.form);
    setYearsList(backup.yearsList);
    setNewYear("");
    setAddError("");
    setEditMode(false);
  }

  function save() {
    setReadmissionDate(form.readmissionDate);
    setSaved(true);
    setEditMode(false);
    setNewYear("");
    setAddError("");
    setTimeout(() => setSaved(false), 2500);
  }

  function addYear() {
    const trimmed = newYear.trim();
    if (!trimmed) return;
    if (!/^\d{4}-\d{2}$/.test(trimmed)) {
      setAddError("Use format YYYY-YY  e.g. 2027-28");
      return;
    }
    const [startStr, endShort] = trimmed.split("-");
    const start = parseInt(startStr);
    const expectedEnd = String(start + 1).slice(-2);
    if (endShort !== expectedEnd) {
      setAddError(`End year should be ${expectedEnd} (e.g. ${start}-${expectedEnd})`);
      return;
    }
    if (yearsList.includes(trimmed)) {
      setAddError("Year already exists.");
      return;
    }
    setYearsList(prev => [...prev, trimmed].sort());
    setNewYear("");
    setAddError("");
  }

  function removeYear(y) {
    if (y === form.current) return;
    setYearsList(prev => prev.filter(yr => yr !== y));
  }

  const fmt = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}) : "—";

  return (
    <div className="space-y-6">
      {/* Current Year Card */}
      <div className="bg-school-navy rounded-2xl p-6 text-white">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Currently Active</p>
        <p className="text-3xl font-bold">Academic Year {form.current}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-[10px] uppercase tracking-wide font-semibold mb-1">New Admissions Open</p>
            <p className="text-white font-semibold text-sm">{fmt(form.newAdmissionDate)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-[10px] uppercase tracking-wide font-semibold mb-1">Re-admission / Promotion</p>
            <p className="text-white font-semibold text-sm">{fmt(form.readmissionDate)}</p>
          </div>
        </div>
      </div>

      {/* Manage Years List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Academic Years List
        </h3>

        <div className="flex flex-wrap gap-2">
          {yearsList.map(y => (
            <div key={y} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
              y === form.current
                ? "bg-school-navy text-white"
                : "bg-gray-100 text-gray-700"
            }`}>
              {y === form.current && <span className="w-1.5 h-1.5 rounded-full bg-school-gold flex-shrink-0"/>}
              {y}
              {editMode && y !== form.current && (
                <button onClick={() => removeYear(y)}
                  className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3"/>
                </button>
              )}
            </div>
          ))}
        </div>

        {editMode && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add New Year</p>
            <div className="flex items-center gap-2 max-w-xs">
              <input
                className={inp}
                placeholder="e.g. 2027-28"
                value={newYear}
                onChange={e => { setNewYear(e.target.value); setAddError(""); }}
                onKeyDown={e => e.key === "Enter" && addYear()}
                maxLength={7}
              />
              <button onClick={addYear}
                className="flex items-center gap-1 bg-school-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4"/> Add
              </button>
            </div>
            {addError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3"/> {addError}
              </p>
            )}
            <p className="text-xs text-gray-400">Active year (highlighted) cannot be removed. Use format YYYY-YY.</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Academic Year Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Current Academic Year">
            {editMode
              ? <select className={sel} value={form.current} onChange={set("current")}>
                  {yearsList.map(y => <option key={y}>{y}</option>)}
                </select>
              : <ViewVal val={form.current}/>}
          </Field>
          <Field label="New Admission Start Date">
            {editMode
              ? <input type="date" className={inp} value={form.newAdmissionDate} onChange={set("newAdmissionDate")}/>
              : <ViewVal val={fmt(form.newAdmissionDate)}/>}
          </Field>
          <Field label="Re-admission Date (Promotion)">
            {editMode
              ? <input type="date" className={inp} value={form.readmissionDate} onChange={set("readmissionDate")}/>
              : <ViewVal val={fmt(form.readmissionDate)}/>}
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">New Admission Date</p>
            <p className="text-xs text-blue-600">Date from which the school starts accepting fresh student admissions for the next academic year.</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Re-admission Date</p>
            <p className="text-xs text-amber-600">Date from which existing students are re-admitted after being promoted to the next class for the upcoming year.</p>
          </div>
        </div>
      </div>

      <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
    </div>
  );
}

// ── Tab: Fee Structure ─────────────────────────────────────────────────────────
const FEE_COL_KEYS = ["tuition","admission","transport","lab","sports","library"];

function buildDefaultRows() {
  return CLASSES.map(cls => {
    const base = DEF_FEE.find(r => r.cls === cls);
    const tuition = base ? FEE_COL_KEYS.reduce((s, k) => s + base[k], 0) : 0;
    return { cls, tuition, uniform: 1500 };
  });
}

const TOTALS_2026_27 = {
  "JR KG":           14500,
  "SR KG":           14500,
  "Balvatika":       15000,
  "1st":             15500,
  "2nd":             15700,
  "3rd":             15900,
  "4th":             16200,
  "5th":             16500,
  "6th":             16800,
  "7th":             17000,
  "8th":             17300,
  "9th":             17500,
  "10th":            18000,
  "11th Commerce":   19000,
  "12th Commerce":   19000,
};

function buildRows2026_27() {
  return CLASSES.map(cls => {
    const total   = TOTALS_2026_27[cls] ?? 0;
    const uniform = 1500;
    return { cls, tuition: total - uniform, uniform };
  });
}

function FeeStructureTab() {
  const setUniformFeesStore = useStore(s => s.setUniformFees);

  const [selectedYear, setSelectedYear] = useState("2026-27");
  const [feeData,      setFeeData]      = useState(() => {
    const init = {};
    INIT_YEARS.forEach(y => {
      init[y] = y === "2026-27" ? buildRows2026_27() : buildDefaultRows();
    });
    return init;
  });
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [editing,  setEditing]  = useState(null);
  const [saved,    setSaved]    = useState(false);

  const rows = feeData[selectedYear] ?? buildDefaultRows();

  function startEdit() {
    setBackup(rows.map(r => ({ ...r })));
    setEditMode(true);
  }

  function cancel() {
    setFeeData(p => ({ ...p, [selectedYear]: backup }));
    setEditing(null);
    setEditMode(false);
  }

  function save() {
    const map = {};
    rows.forEach(r => { map[r.cls] = r.uniform; });
    setUniformFeesStore(map);
    setEditing(null);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function setCell(cls, key, val) {
    const num = parseInt(val) || 0;
    setFeeData(p => ({
      ...p,
      [selectedYear]: p[selectedYear].map(r => r.cls === cls ? { ...r, [key]: num } : r),
    }));
  }

  function handleYearChange(y) {
    if (editMode) return;
    if (!feeData[y]) {
      setFeeData(p => ({ ...p, [y]: buildDefaultRows() }));
    }
    setSelectedYear(y);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Annual Fee Structure (₹)</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {editMode ? "Click any cell to edit" : "Select academic year, then click Edit to modify"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0"/>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-school-navy focus:outline-none focus:ring-2 focus:ring-school-navy/20 cursor-pointer disabled:opacity-50"
                value={selectedYear}
                onChange={e => handleYearChange(e.target.value)}
                disabled={editMode}
              >
                {INIT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-school-navy text-white">
                <th className="px-4 py-3 text-left font-semibold text-xs whitespace-nowrap">Class</th>
                <th className="px-4 py-3 text-right font-semibold text-xs whitespace-nowrap">Tuition Fees</th>
                <th className="px-4 py-3 text-right font-semibold text-xs whitespace-nowrap">Uniform Fees</th>
                <th className="px-4 py-3 text-right font-semibold text-xs whitespace-nowrap">Total Fees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const total   = row.tuition + row.uniform;
                const isEven  = idx % 2 === 0;
                return (
                  <tr key={row.cls} className={`border-b border-gray-100 transition-colors ${isEven ? "bg-white" : "bg-gray-50/40"} ${editMode ? "hover:bg-blue-50/20" : ""}`}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-school-navy text-xs">{row.cls}</span>
                    </td>

                    {/* Tuition — editable */}
                    <td className="px-4 py-2 text-right">
                      {editMode && editing === `${row.cls}-tuition` ? (
                        <input
                          type="number" min="0" autoFocus
                          className="w-28 border border-school-navy rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-school-navy"
                          value={row.tuition}
                          onChange={e => setCell(row.cls, "tuition", e.target.value)}
                          onBlur={() => setEditing(null)}
                        />
                      ) : editMode ? (
                        <button className="text-xs text-gray-700 hover:text-school-navy hover:underline font-medium w-28 text-right"
                          onClick={() => setEditing(`${row.cls}-tuition`)}>
                          ₹{row.tuition.toLocaleString("en-IN")}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-700 font-medium">₹{row.tuition.toLocaleString("en-IN")}</span>
                      )}
                    </td>

                    {/* Uniform — editable, amber tint */}
                    <td className="px-4 py-2 text-right">
                      {editMode && editing === `${row.cls}-uniform` ? (
                        <input
                          type="number" min="0" autoFocus
                          className="w-28 border border-amber-500 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={row.uniform}
                          onChange={e => setCell(row.cls, "uniform", e.target.value)}
                          onBlur={() => setEditing(null)}
                        />
                      ) : editMode ? (
                        <button className="text-xs text-amber-700 hover:text-amber-600 hover:underline font-semibold w-28 text-right"
                          onClick={() => setEditing(`${row.cls}-uniform`)}>
                          ₹{row.uniform.toLocaleString("en-IN")}
                        </button>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold">₹{row.uniform.toLocaleString("en-IN")}</span>
                      )}
                    </td>

                    {/* Total — auto-calc, read-only */}
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-bold text-school-navy text-xs">₹{total.toLocaleString("en-IN")}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Classes & Sections ────────────────────────────────────────────────────
function ClassSectionsTab() {
  const activeClasses  = useStore(s => s.activeClasses);
  const activateClass  = useStore(s => s.activateClass);
  const deactivateClass = useStore(s => s.deactivateClass);

  const [rows,     setRows]     = useState(DEF_SECTIONS);
  const [saved,    setSaved]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [expanded, setExpanded] = useState(null);

  const inactiveClasses = CLASSES.filter(c => !activeClasses.includes(c));

  function startEdit() { setBackup(rows.map(r => ({ ...r, sections: [...r.sections] }))); setEditMode(true); }
  function cancel()    { setRows(backup); setEditMode(false); }
  function save()      { setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2500); }

  function addSection(cls) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const next = String.fromCharCode(65 + r.sections.length);
      if (r.sections.includes(next)) return r;
      return { ...r, sections: [...r.sections, next] };
    }));
  }

  function removeSection(cls, sec) {
    setRows(prev => prev.map(r =>
      r.cls === cls ? { ...r, sections: r.sections.filter(s => s !== sec) } : r
    ));
  }

  function setTeacher(cls, val) {
    setRows(prev => prev.map(r => r.cls === cls ? { ...r, teacher: val } : r));
  }

  return (
    <div className="space-y-4">

      {/* ── Active Classes ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Active Classes</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {editMode ? "Managing sections and class teachers" : `${activeClasses.length} classes currently running · Click Edit to manage sections and teachers`}
            </p>
          </div>
          <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
        </div>
        <div className="divide-y divide-gray-100">
          {rows.filter(row => activeClasses.includes(row.cls)).map(row => {
            const isOpen = expanded === row.cls;
            return (
              <div key={row.cls}>
                <div className="flex items-center">
                  <button
                    className="flex-1 flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : row.cls)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-school-navy/10 flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-school-navy"/>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{row.cls}</p>
                        <p className="text-xs text-gray-400">
                          {row.sections.length} Section{row.sections.length !== 1 ? "s" : ""} &nbsp;·&nbsp;
                          {row.sections.map(s => `${row.cls}-${s}`).join(", ")}
                          {row.teacher && <> &nbsp;·&nbsp; Teacher: {row.teacher}</>}
                        </p>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                  </button>
                  <button
                    onClick={() => { deactivateClass(row.cls); setExpanded(null); }}
                    title="Deactivate this class"
                    className="mr-4 px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 text-xs font-semibold hover:bg-orange-50 hover:border-orange-400 transition-colors flex-shrink-0">
                    Deactivate
                  </button>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 pt-2 bg-gray-50/60 border-t border-gray-100 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sections</p>
                      <div className="flex flex-wrap gap-2">
                        {row.sections.map(sec => (
                          <div key={sec} className="flex items-center gap-1 bg-school-navy text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                            {row.cls}-{sec}
                            {editMode && row.sections.length > 1 && (
                              <button onClick={() => removeSection(row.cls, sec)}
                                className="ml-1 hover:text-red-300 transition-colors">
                                <X className="w-3 h-3"/>
                              </button>
                            )}
                          </div>
                        ))}
                        {editMode && row.sections.length < 5 && (
                          <button onClick={() => addSection(row.cls)}
                            className="flex items-center gap-1 border-2 border-dashed border-gray-300 text-gray-400 hover:border-school-navy hover:text-school-navy text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            <Plus className="w-3 h-3"/> Add Section
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Class Teacher</p>
                      {editMode
                        ? <input className={inp} placeholder="Enter teacher name" value={row.teacher} onChange={e => setTeacher(row.cls, e.target.value)}/>
                        : <ViewVal val={row.teacher || "Not assigned"}/>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upcoming / Inactive Classes ── */}
      {inactiveClasses.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Upcoming Classes</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              These classes are not yet started. Activate a class when you are ready to run it.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {inactiveClasses.map(cls => (
              <div key={cls} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-gray-400"/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500">{cls}</p>
                    <p className="text-xs text-gray-400">Not yet started</p>
                  </div>
                </div>
                <button
                  onClick={() => activateClass(cls)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-school-navy text-white text-xs font-bold hover:bg-school-navy/90 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5"/> Activate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Tab: Users & Roles ─────────────────────────────────────────────────────────
function UsersRolesTab() {
  const [users,    setUsers]    = useState(DEF_USERS);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [showPass, setShowPass] = useState({});
  const [saved,    setSaved]    = useState(false);

  const blank = { name:"", email:"", role:"Fee Clerk", status:"Active", pass:"" };
  const [form, setForm] = useState(blank);
  const setF = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function startEdit() { setBackup(users.map(u => ({ ...u }))); setEditMode(true); }
  function cancel()    { setUsers(backup); setShowForm(false); setEditId(null); setEditMode(false); }
  function save()      { setShowForm(false); setEditId(null); setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2000); }

  function openAdd() { setForm(blank); setEditId(null); setShowForm(true); }
  function openEdit(u) { setForm({ ...u }); setEditId(u.id); setShowForm(true); }

  function saveUser() {
    if (!form.name || !form.email) return;
    if (editId) {
      setUsers(prev => prev.map(u => u.id === editId ? { ...form, id: editId } : u));
    } else {
      setUsers(prev => [...prev, { ...form, id: Date.now() }]);
    }
    setShowForm(false);
  }

  function deleteUser(id) { setUsers(prev => prev.filter(u => u.id !== id)); }

  const ROLE_COLORS = {
    "Super Admin":      "bg-red-100 text-red-700",
    "Management Head":  "bg-purple-100 text-purple-700",
    "Fee Clerk":        "bg-blue-100 text-blue-700",
    "Teacher":          "bg-green-100 text-green-700",
    "Receptionist":     "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Admin Users</h3>
            <p className="text-xs text-gray-400 mt-0.5">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode && (
              <button onClick={openAdd}
                className="flex items-center gap-2 bg-school-navy hover:bg-school-navy/90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                <UserPlus className="w-4 h-4"/> Add User
              </button>
            )}
            <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
          </div>
        </div>

        {/* Add/Edit Form */}
        {editMode && showForm && (
          <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100">
            <p className="text-xs font-bold text-school-navy uppercase tracking-wide mb-4">
              {editId ? "Edit User" : "Add New User"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Full Name">
                <input className={inp} placeholder="Enter name" value={form.name} onChange={setF("name")}/>
              </Field>
              <Field label="Email">
                <input className={inp} type="email" placeholder="email@school.in" value={form.email} onChange={setF("email")}/>
              </Field>
              <Field label="Role">
                <select className={sel} value={form.role} onChange={setF("role")}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    className={inp + " pr-9"}
                    type={showPass.form ? "text" : "password"}
                    placeholder="Set password"
                    value={form.pass}
                    onChange={setF("pass")}
                  />
                  <button type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPass(p => ({ ...p, form: !p.form }))}>
                    {showPass.form ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                  </button>
                </div>
              </Field>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveUser}
                className="flex items-center gap-1.5 bg-school-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-school-navy/90 transition-colors">
                <Check className="w-3.5 h-3.5"/>{editId ? "Update" : "Add User"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                <X className="w-3.5 h-3.5"/>Cancel
              </button>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="divide-y divide-gray-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-school-gold flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                  {u.role}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.status==="Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {u.status}
                </span>
                {editMode && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                      <Pencil className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => deleteUser(u.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-pulse">
          <Check className="w-4 h-4"/> User saved successfully
        </div>
      )}
    </div>
  );
}

// ── Saturday uses only morning slots ──────────────────────────────────────────
const SAT_SLOT_IDS = new Set(["prayer","p1","p2","recess","p3"]);
function slotsForGroup(group) {
  return group === "Saturday" ? TIME_SLOTS.filter(s => SAT_SLOT_IDS.has(s.id)) : TIME_SLOTS;
}

// ── Tab: Timetable ─────────────────────────────────────────────────────────────
function TimetableTab() {
  const storedTT        = useStore(s => s.timetables);
  const saveTT          = useStore(s => s.setTimetables);
  const ttActiveClasses = useStore(s => s.activeClasses);
  const backupRef       = useRef(null);

  const [selYear,    setSelYear]    = useState(DEF_YEAR.current);
  const [editMode,   setEditMode]   = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [activeCell, setActiveCell] = useState(null); // { group, slotId, cls }
  const [ttData,     setTtData]     = useState(() => storedTT || {});

  const activeColClasses = CLASSES.filter(c => ttActiveClasses.includes(c));

  function getSlot(group, slotId, cls) {
    return ttData?.[selYear]?.[group]?.[slotId]?.[cls] ?? { subject:"", teacher:"" };
  }

  function setSlotVal(group, slotId, cls, key, value) {
    setTtData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[selYear])                              next[selYear]                    = {};
      if (!next[selYear][group])                       next[selYear][group]             = {};
      if (!next[selYear][group][slotId])               next[selYear][group][slotId]     = {};
      if (!next[selYear][group][slotId][cls])          next[selYear][group][slotId][cls] = { subject:"", teacher:"" };
      next[selYear][group][slotId][cls][key] = value;
      return next;
    });
  }

  function getBusyTeachers(group, slotId, currentCls) {
    const busy = new Set();
    const slotData = ttData?.[selYear]?.[group]?.[slotId] ?? {};
    Object.entries(slotData).forEach(([cls, cell]) => {
      if (cls !== currentCls && cell?.teacher) busy.add(cell.teacher);
    });
    return busy;
  }

  function startEdit() { backupRef.current = JSON.parse(JSON.stringify(ttData)); setEditMode(true); setActiveCell(null); }
  function cancel()    { if (backupRef.current) setTtData(backupRef.current); setEditMode(false); setActiveCell(null); }
  function save()      { saveTT(ttData); setSaved(true); setEditMode(false); setActiveCell(null); setTimeout(() => setSaved(false), 2500); }

  const isCellActive = (group, slotId, cls) =>
    activeCell?.group === group && activeCell?.slotId === slotId && activeCell?.cls === cls;

  // ── PDF Export ────────────────────────────────────────────────
  function exportPDF() {
    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a3" });
    const pw = doc.internal.pageSize.width;

    doc.setFontSize(16); doc.setTextColor(30,58,95);
    doc.text(`Staff Time Table — ${selYear}`, pw/2, 32, { align:"center" });
    doc.setFontSize(9); doc.setTextColor(100,100,100);
    doc.text("Satyam Stars International School  ·  Surat, Gujarat", pw/2, 46, { align:"center" });

    let y = 58;

    DAY_GROUPS.forEach((group) => {
      const slots = slotsForGroup(group);
      const isSat = group === "Saturday";

      doc.setFillColor(...(isSat ? [180,72,0] : [30,58,95]));
      doc.setTextColor(255,255,255); doc.setFontSize(11);
      doc.rect(30, y, pw-60, 18, "F");
      doc.text(`  ${group}${isSat ? "  —  Half Day" : ""}`, 34, y+13);
      y += 22;

      const head = [["TIME", ...activeColClasses]];
      const body = slots.map(slot => {
        if (slot.special) return [{ content:slot.time }, { content:slot.label, colSpan:activeColClasses.length, styles:{ halign:"center", fontStyle:"bold", textColor:[80,80,80], fillColor:[240,240,240] } }];
        return [
          slot.time,
          ...activeColClasses.map(cls => {
            const cell = getSlot(group, slot.id, cls);
            return cell.subject ? `${cell.subject}\n${shortName(cell.teacher)||""}` : "";
          }),
        ];
      });

      autoTable(doc, {
        head, body, startY: y,
        theme:"grid",
        styles: { fontSize:7, cellPadding:3, overflow:"linebreak" },
        headStyles: { fillColor:[30,58,95], textColor:[255,255,255], fontStyle:"bold", fontSize:7.5 },
        columnStyles: { 0:{ cellWidth:58, fontStyle:"bold", textColor:[30,58,95] } },
        didParseCell(data) {
          if (data.section !== "body" || data.column.index === 0) return;
          const slot = slots[data.row.index];
          if (slot?.special) return;
          const cls = activeColClasses[data.column.index - 1];
          if (!cls) return;
          const cell = getSlot(group, slot.id, cls);
          if (cell?.teacher) {
            const idx = TEACHERS_TT.indexOf(cell.teacher);
            if (idx >= 0) {
              data.cell.styles.fillColor = TEACHER_RGB_PALETTE[idx % TEACHER_RGB_PALETTE.length];
              data.cell.styles.textColor = [40,40,40];
            }
          }
        },
        margin: { left:30, right:30 },
      });

      y = (doc.lastAutoTable?.finalY ?? y) + 14;
      if (y > doc.internal.pageSize.height - 60 && group !== DAY_GROUPS[DAY_GROUPS.length-1]) {
        doc.addPage(); y = 30;
      }
    });

    doc.save(`Timetable_${selYear}.pdf`);
  }

  // ── Excel Export ──────────────────────────────────────────────
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    DAY_GROUPS.forEach(group => {
      const slots = slotsForGroup(group);
      const data  = [
        ["TIME", ...activeColClasses],
        ...slots.map(slot => {
          if (slot.special) return [slot.time, ...activeColClasses.map(() => `── ${slot.label} ──`)];
          return [
            slot.time,
            ...activeColClasses.map(cls => {
              const cell = getSlot(group, slot.id, cls);
              return cell.subject ? `${cell.subject} / ${shortName(cell.teacher) || ""}` : "";
            }),
          ];
        }),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch:14 }, ...activeColClasses.map(() => ({ wch:16 }))];
      XLSX.utils.book_append_sheet(wb, ws, group.replace("–","to"));
    });
    XLSX.writeFile(wb, `Timetable_${selYear}.xlsx`);
  }

  return (
    <div className="space-y-4">

      {/* ── Top Controls ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select disabled={editMode} value={selYear} onChange={e => setSelYear(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-school-navy focus:outline-none cursor-pointer disabled:opacity-50">
              {INIT_YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg font-medium">
              Full week view — all day groups
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportExcel} disabled={editMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-200 text-green-700 bg-green-50 text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-40">
              <FileSpreadsheet className="w-3.5 h-3.5"/> Excel
            </button>
            <button onClick={exportPDF} disabled={editMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-red-50 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-40">
              <Download className="w-3.5 h-3.5"/> PDF
            </button>
            <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
          </div>
        </div>
        {editMode && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 font-medium">
              Click any cell to assign subject & teacher · Busy teachers are disabled
            </p>
          </div>
        )}
      </div>

      {/* ── One table per day group, stacked ── */}
      {DAY_GROUPS.map(group => {
        const slots  = slotsForGroup(group);
        const isSat  = group === "Saturday";
        const hdrBg  = isSat ? "bg-amber-600" : "bg-school-navy";
        const colLen = activeColClasses.length;

        return (
          <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Group header */}
            <div className={`${hdrBg} px-4 py-3 flex items-center gap-3`}>
              <LayoutGrid className="w-4 h-4 text-white/70 flex-shrink-0"/>
              <p className="text-white font-bold text-sm tracking-wide">
                {group}{isSat ? "  ·  Half Day" : ""}
                <span className="ml-3 text-white/50 font-normal text-xs">WEF {selYear}</span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth:"1100px" }}>
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap border-r border-white/10 w-24 sticky left-0 bg-gray-800 z-10">
                      TIME
                    </th>
                    {activeColClasses.map(cls => (
                      <th key={cls} className="px-1 py-2.5 text-center font-bold whitespace-nowrap border-r border-white/10 last:border-r-0" style={{ minWidth:"80px" }}>
                        {cls}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, idx) => {
                    if (slot.special) {
                      return (
                        <tr key={slot.id} className="bg-gray-100 border-b border-gray-200">
                          <td className="px-3 py-2 border-r border-gray-300 text-center sticky left-0 bg-gray-100 z-10">
                            <p className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{slot.time}</p>
                          </td>
                          <td colSpan={colLen} className="py-2 text-center">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">{slot.label}</span>
                          </td>
                        </tr>
                      );
                    }

                    const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/40";
                    return (
                      <tr key={slot.id} className={`border-b border-gray-100 ${rowBg}`}>
                        <td className={`px-3 py-2 border-r border-gray-200 text-center sticky left-0 z-10 ${rowBg}`}>
                          <p className="text-[10px] font-bold text-school-navy whitespace-nowrap">{slot.time}</p>
                        </td>
                        {activeColClasses.map(cls => {
                          const cell   = getSlot(group, slot.id, cls);
                          const active = isCellActive(group, slot.id, cls);
                          const busy   = active ? getBusyTeachers(group, slot.id, cls) : new Set();
                          const tColor = getTeacherColor(cell.teacher);
                          const filled = cell.subject || cell.teacher;

                          return (
                            <td key={cls} className="px-1 py-1 border-r border-gray-100 last:border-r-0 align-top">
                              {active ? (
                                <div className="relative z-20 bg-white border-2 border-school-navy rounded-xl p-2 shadow-2xl space-y-1.5" style={{ minWidth:"120px" }}>
                                  <select autoFocus value={cell.subject}
                                    onChange={e => setSlotVal(group, slot.id, cls, "subject", e.target.value)}
                                    className="w-full text-[11px] border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-school-navy cursor-pointer bg-white">
                                    <option value="">— Subject —</option>
                                    {SUBJECTS_TT.map(s => <option key={s}>{s}</option>)}
                                  </select>
                                  <select value={cell.teacher}
                                    onChange={e => setSlotVal(group, slot.id, cls, "teacher", e.target.value)}
                                    className="w-full text-[11px] border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-school-navy cursor-pointer bg-white">
                                    <option value="">— Teacher —</option>
                                    {TEACHERS_TT.map(t => (
                                      <option key={t} value={t} disabled={busy.has(t)}>
                                        {busy.has(t) ? `⚠ ${t} (busy)` : t}
                                      </option>
                                    ))}
                                  </select>
                                  <button onClick={() => setActiveCell(null)}
                                    className="w-full py-1 rounded-lg bg-school-navy text-white text-[10px] font-bold hover:bg-school-navy/90 transition-colors">
                                    Done
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => editMode && setActiveCell({ group, slotId:slot.id, cls })}
                                  className={`rounded-lg px-1.5 py-1.5 transition-all ${editMode ? "cursor-pointer" : ""} ${
                                    filled
                                      ? `${tColor?.bg||"bg-gray-100"} border ${tColor?.border||"border-gray-200"} ${editMode ? "hover:opacity-75 hover:ring-2 hover:ring-school-navy/30" : ""}`
                                      : editMode
                                        ? "min-h-[44px] border-2 border-dashed border-gray-200 hover:border-school-navy/50 hover:bg-school-navy/5 flex items-center justify-center"
                                        : "min-h-[44px]"
                                  }`}
                                >
                                  {filled ? (
                                    <>
                                      <p className={`text-[11px] font-bold leading-tight ${tColor?.text||"text-gray-800"} truncate`}>{cell.subject}</p>
                                      {cell.teacher && (
                                        <p className={`text-[10px] mt-0.5 leading-tight ${tColor?.text||"text-gray-500"} opacity-80 truncate`}>{shortName(cell.teacher)}</p>
                                      )}
                                    </>
                                  ) : editMode ? (
                                    <Plus className="w-3 h-3 text-gray-300"/>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ── Teacher Legend ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Teacher Colour Legend</p>
        <div className="flex flex-wrap gap-1.5">
          {TEACHERS_TT.map((t, i) => {
            const c = TEACHER_PALETTE[i % TEACHER_PALETTE.length];
            return (
              <span key={t} className={`${c.bg} ${c.text} text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.border}`}>
                {shortName(t)}
              </span>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ── Settings Auth ──────────────────────────────────────────────────────────────
const SETTINGS_USERS = [
  { name:"Sunil Pradhan", password:"admin123", initials:"SP" },
];

function SettingsLogin({ onLogin }) {
  const [name,  setName]  = useState("");
  const [pass,  setPass]  = useState("");
  const [showP, setShowP] = useState(false);
  const [error, setError] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    const found = SETTINGS_USERS.find(u => u.name === name && u.password === pass);
    if (found) onLogin(found);
    else setError("Invalid credentials.");
  }

  return (
    <div className="-m-4 lg:-m-6 flex items-center justify-center h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-school-navy p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex">

        {/* Left — branding */}
        <div className="hidden md:flex flex-col justify-center w-2/5 flex-shrink-0 bg-school-navy px-8 py-8 text-white">
          <div className="w-16 h-16 bg-school-gold rounded-2xl flex items-center justify-center mb-5 shadow-lg">
            <SlidersHorizontal className="w-8 h-8 text-white" />
          </div>
          <p className="text-2xl font-bold mb-1">Settings</p>
          <p className="text-white/50 text-sm mb-7">Restricted Configuration Area</p>
          <div className="space-y-3">
            {[
              { Icon:Building2,    title:"School Profile",    sub:"Name, address & contact"   },
              { Icon:IndianRupee,  title:"Fee Structure",     sub:"Class-wise fee management" },
              { Icon:Users,        title:"User Management",   sub:"Roles & access control"    },
            ].map(({ Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <Icon className="w-5 h-5 text-school-gold flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="text-white/45 text-xs mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-8">
          <div className="flex md:hidden items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-school-gold rounded-xl flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-gray-800">Settings — Restricted Access</p>
          </div>

          <p className="text-xl font-bold text-gray-800 mb-1">Sign In</p>
          <p className="text-sm text-gray-400 mb-6">Enter your credentials to access settings</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Name</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                value={name} onChange={e => { setName(e.target.value); setError(""); }}>
                <option value="">-- Select --</option>
                {SETTINGS_USERS.map(u => <option key={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showP ? "text" : "password"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy"
                  value={pass} onChange={e => { setPass(e.target.value); setError(""); }}
                  placeholder="Enter password"
                />
                <button type="button" onClick={() => setShowP(!showP)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showP ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit"
              className="w-full bg-school-navy text-white py-3 rounded-xl font-semibold text-sm hover:bg-opacity-90 transition-colors shadow-md">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
const TABS = [
  { key:"school",     label:"School Profile",    icon:Building2   },
  { key:"year",       label:"Academic Year",      icon:Calendar    },
  { key:"fees",       label:"Fee Structure",      icon:IndianRupee },
  { key:"classes",    label:"Classes & Sections", icon:BookOpen    },
  { key:"timetable",  label:"Timetable",          icon:LayoutGrid  },
  { key:"users",      label:"Users & Roles",      icon:Users       },
];

export default function SettingsPage() {
  const [authUser, setAuthUser] = useState(null);
  const [tab, setTab] = useState("school");

  if (!authUser) return <SettingsLogin onLogin={setAuthUser} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">School configuration, academic year, fee structure & user management</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-school-navy flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {authUser.initials}
            </div>
            <span className="text-xs font-semibold text-gray-700">{authUser.name}</span>
          </div>
          <button
            onClick={() => setAuthUser(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => {
          const Icon = t.icon;
          const isA  = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                isA ? "bg-school-navy text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:border-school-navy/40 hover:text-school-navy"
              }`}>
              <Icon className="w-4 h-4"/>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === "school"     && <SchoolProfileTab/>}
      {tab === "year"       && <AcademicYearTab/>}
      {tab === "fees"       && <FeeStructureTab/>}
      {tab === "classes"    && <ClassSectionsTab/>}
      {tab === "timetable"  && <TimetableTab/>}
      {tab === "users"      && <UsersRolesTab/>}
    </div>
  );
}
