"use client";

import { useState, useRef, useEffect } from "react";
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
  Download, FileSpreadsheet, MessageSquare, CalendarRange,
} from "lucide-react";
import YearPlanningTab from "./YearPlanningTab";
import {
  isNonEmpty, isValidEmail, isValidPhone, isValidPincode, isValidName,
  isValidAddressText, isValidLength, isPositiveAmount, isDateOnOrAfter, hasNoErrors,
} from "@/lib/validators";
import {
  getSchoolProfile, saveSchoolProfile,
  getAcademicYears, addAcademicYear, deleteAcademicYear, saveCurrentYear,
  getFeeStructuresForYear, saveFeeStructuresForYear,
  getClassesWithSections, setClassActiveInDB, insertSection, deleteSectionFromDB, updateSectionTeacher,
} from "@/lib/settingsService";

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES = [
  "JR KG","SR KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th Commerce","12th Commerce",
];

const BOARDS   = ["GSEB","CBSE","ICSE","IB","State Board"];
const MEDIUMS  = ["English","Gujarati","Hindi","Semi-English"];
const ROLES    = ["Super Admin","Admin","Teacher"];
const INIT_YEARS = ["2024-25","2025-26","2026-27"];

// ── Default State ─────────────────────────────────────────────────────────────
const DEF_SCHOOL = {
  name:"Satyam Stars International School",
  address:"Swaminarayan Nagar - Bhidbhanjan Society, Pandesara", city:"Surat", state:"Gujarat", pin:"394221",
  phone:"8200069671", email:"satyamstarsinternational@gmail.com",
  board:"GSEB", medium:"English",
  udise:"24224100067",
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
  sections: ["A"],
  sectionTeachers: { "A": "" },
}));

const DEF_USERS = [
  { id:1, name:"Admin User",    email:"admin@satyamstars.edu.in", role:"Super Admin",     status:"Active",  pass:"" },
  { id:2, name:"Fee Clerk",     email:"fees@satyamstars.edu.in",  role:"Fee Clerk",        status:"Active",  pass:"" },
  { id:3, name:"Management",    email:"mgmt@satyamstars.edu.in",  role:"Management Head",  status:"Active",  pass:"" },
];

// ── Timetable Constants ────────────────────────────────────────────────────────
const DAY_GROUPS = ["Mon – Wed", "Thu – Fri", "Saturday"];

const DEF_PERIOD_DEFS = {
  "Mon – Wed": [
    { id:"prayer", label:"Prayer",   startTime:"09:00", endTime:"09:20", isBreak:true  },
    { id:"p1",     label:"Period 1", startTime:"09:20", endTime:"10:20", isBreak:false },
    { id:"p2",     label:"Period 2", startTime:"10:20", endTime:"11:10", isBreak:false },
    { id:"recess", label:"Recess",   startTime:"11:10", endTime:"11:40", isBreak:true  },
    { id:"p3",     label:"Period 3", startTime:"11:40", endTime:"12:30", isBreak:false },
    { id:"p4",     label:"Period 4", startTime:"12:30", endTime:"13:20", isBreak:false },
    { id:"p5",     label:"Period 5", startTime:"13:20", endTime:"14:00", isBreak:false },
  ],
  "Thu – Fri": [
    { id:"prayer", label:"Prayer",   startTime:"09:00", endTime:"09:20", isBreak:true  },
    { id:"p1",     label:"Period 1", startTime:"09:20", endTime:"10:20", isBreak:false },
    { id:"p2",     label:"Period 2", startTime:"10:20", endTime:"11:10", isBreak:false },
    { id:"recess", label:"Recess",   startTime:"11:10", endTime:"11:40", isBreak:true  },
    { id:"p3",     label:"Period 3", startTime:"11:40", endTime:"12:30", isBreak:false },
    { id:"p4",     label:"Period 4", startTime:"12:30", endTime:"13:20", isBreak:false },
    { id:"p5",     label:"Period 5", startTime:"13:20", endTime:"14:00", isBreak:false },
  ],
  "Saturday": [
    { id:"prayer",  label:"Prayer",   startTime:"09:00", endTime:"09:20", isBreak:true  },
    { id:"p1",      label:"Period 1", startTime:"09:20", endTime:"10:20", isBreak:false },
    { id:"p2",      label:"Period 2", startTime:"10:20", endTime:"11:10", isBreak:false },
    { id:"recess",  label:"Recess",   startTime:"11:10", endTime:"11:40", isBreak:true  },
    { id:"p3",      label:"Period 3", startTime:"11:40", endTime:"12:30", isBreak:false },
  ],
};

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
  const [errors,   setErrors]   = useState({});
  const set = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  useEffect(() => {
    getSchoolProfile().then(p => {
      if (!p) return;
      setForm({
        name:    p.name    || DEF_SCHOOL.name,
        address: p.address || DEF_SCHOOL.address,
        city:    p.city    || DEF_SCHOOL.city,
        state:   p.state   || DEF_SCHOOL.state,
        pin:     p.pincode || DEF_SCHOOL.pin,
        phone:   p.phone   || DEF_SCHOOL.phone,
        email:   p.email   || DEF_SCHOOL.email,
        board:   p.board   || DEF_SCHOOL.board,
        medium:  p.medium  || DEF_SCHOOL.medium,
        udise:   p.udise   || DEF_SCHOOL.udise,
        website: p.website || DEF_SCHOOL.website,
      });
    }).catch(() => {});
  }, []);

  function startEdit() { setBackup({ ...form }); setEditMode(true); setErrors({}); }
  function cancel()    { setForm(backup); setEditMode(false); setErrors({}); }

  function validate() {
    const e = {};
    if (!isValidLength(form.name, 100, 3)) e.name = "Enter a valid school name (3-100 characters).";
    if (!isValidAddressText(form.address)) e.address = "Enter a valid address (3-200 characters).";
    if (!isValidName(form.city, { max: 60 })) e.city = "Enter a valid city name.";
    if (!isValidName(form.state, { max: 60 })) e.state = "Enter a valid state name.";
    if (!isValidPincode(form.pin)) e.pin = "PIN code must be exactly 6 digits.";
    if (!isValidPhone(form.phone)) e.phone = "Phone must be a valid 10-digit mobile number.";
    if (!isValidEmail(form.email)) e.email = "Enter a valid email address.";
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website.trim())) e.website = "Website must start with http:// or https://";
    if (!isNonEmpty(form.udise) || !/^\d{8,11}$/.test(form.udise.trim())) e.udise = "UDISE code must be 8-11 digits.";
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    if (!hasNoErrors(e)) return;
    try {
      await saveSchoolProfile(form);
      setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2500);
    } catch {
      setErrors(prev => ({ ...prev, _save: "Save failed. Try again." }));
    }
  }

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
                ? <><input className={inp} value={form.name} onChange={set("name")}/><FieldError msg={errors.name}/></>
                : <ViewVal val={form.name}/>}
            </Field>
          </div>
          <Field label="Address">
            {editMode
              ? <><input className={inp} value={form.address} onChange={set("address")} placeholder="Street / Area"/><FieldError msg={errors.address}/></>
              : <ViewVal val={form.address}/>}
          </Field>
          <Field label="City">
            {editMode
              ? <><input className={inp} value={form.city} onChange={set("city")}/><FieldError msg={errors.city}/></>
              : <ViewVal val={form.city}/>}
          </Field>
          <Field label="State">
            {editMode
              ? <><input className={inp} value={form.state} onChange={set("state")}/><FieldError msg={errors.state}/></>
              : <ViewVal val={form.state}/>}
          </Field>
          <Field label="PIN Code">
            {editMode
              ? <><input className={inp} value={form.pin} onChange={set("pin")} maxLength={6}/><FieldError msg={errors.pin}/></>
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
              ? <div><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.phone} onChange={set("phone")} maxLength={10}/></div><FieldError msg={errors.phone}/></div>
              : <ViewVal val={form.phone} icon={Phone}/>}
          </Field>
          <Field label="Email Address">
            {editMode
              ? <div><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.email} onChange={set("email")} type="email"/></div><FieldError msg={errors.email}/></div>
              : <ViewVal val={form.email} icon={Mail}/>}
          </Field>
          <Field label="Website">
            {editMode
              ? <div><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.website} onChange={set("website")} placeholder="https://..."/></div><FieldError msg={errors.website}/></div>
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
              ? <div><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                  <input className={inp + " pl-9"} value={form.udise} onChange={set("udise")}/></div><FieldError msg={errors.udise}/></div>
              : <ViewVal val={form.udise} icon={Hash}/>}
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

  const [yearsData, setYearsData] = useState([]); // [{id, label, is_current, admission_date, readmission_date}]
  const [form,      setForm]      = useState(DEF_YEAR);
  const [saved,     setSaved]     = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [backup,    setBackup]    = useState(null);
  const [newYear,   setNewYear]   = useState("");
  const [addError,  setAddError]  = useState("");
  const [dateError, setDateError] = useState("");
  const [saving,    setSaving]    = useState(false);

  const yearsList = yearsData.map(y => y.label);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    getAcademicYears().then(years => {
      setYearsData(years);
      const cur = years.find(y => y.is_current) || years[years.length - 1];
      if (cur) setForm({
        current:          cur.label,
        newAdmissionDate: cur.admission_date   || "",
        readmissionDate:  cur.readmission_date || "",
      });
    }).catch(() => {});
  }, []);

  function startEdit() {
    setBackup({ form: { ...form }, yearsData: yearsData.map(y => ({ ...y })) });
    setEditMode(true);
    setNewYear("");
    setAddError("");
  }

  function cancel() {
    setForm(backup.form);
    setYearsData(backup.yearsData);
    setNewYear("");
    setAddError("");
    setDateError("");
    setEditMode(false);
  }

  async function save() {
    if (form.newAdmissionDate && form.readmissionDate && !isDateOnOrAfter(form.readmissionDate, form.newAdmissionDate)) {
      setDateError("Re-admission date must be on or after the new admission start date.");
      return;
    }
    setDateError("");
    setSaving(true);
    try {
      const yr = yearsData.find(y => y.label === form.current);
      if (yr) {
        await saveCurrentYear(yr.id, { admissionDate: form.newAdmissionDate, readmissionDate: form.readmissionDate });
        setYearsData(prev => prev.map(y => ({
          ...y,
          is_current:       y.id === yr.id,
          admission_date:   y.id === yr.id ? form.newAdmissionDate : y.admission_date,
          readmission_date: y.id === yr.id ? form.readmissionDate  : y.readmission_date,
        })));
      }
      setReadmissionDate(form.readmissionDate);
      setSaved(true);
      setEditMode(false);
      setNewYear("");
      setAddError("");
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }

  async function addYear() {
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
    try {
      const row = await addAcademicYear(trimmed);
      setYearsData(prev => [...prev, row].sort((a, b) => a.label.localeCompare(b.label)));
      setNewYear("");
      setAddError("");
    } catch {
      setAddError("Failed to add year. Try again.");
    }
  }

  async function removeYear(label) {
    if (label === form.current) return;
    const yr = yearsData.find(y => y.label === label);
    if (!yr) return;
    try {
      await deleteAcademicYear(yr.id);
      setYearsData(prev => prev.filter(y => y.id !== yr.id));
    } catch {
      setAddError("Failed to remove year. It may have student data.");
    }
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
              ? <input type="date" className={inp} value={form.newAdmissionDate} onChange={e => { set("newAdmissionDate")(e); setDateError(""); }}/>
              : <ViewVal val={fmt(form.newAdmissionDate)}/>}
          </Field>
          <Field label="Re-admission Date (Promotion)">
            {editMode
              ? <input type="date" className={inp} value={form.readmissionDate} onChange={e => { set("readmissionDate")(e); setDateError(""); }}/>
              : <ViewVal val={fmt(form.readmissionDate)}/>}
          </Field>
        </div>
        {editMode && dateError && (
          <p className="text-xs text-red-500 flex items-center gap-1 pt-1">
            <AlertCircle className="w-3 h-3"/> {dateError}
          </p>
        )}

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
function FeeStructureTab() {
  const setUniformFeesStore        = useStore(s => s.setUniformFees);
  const setOldStudentDiscountStore = useStore(s => s.setOldStudentDiscount);

  const [years,          setYears]          = useState([]);
  const [allClasses,     setAllClasses]     = useState([]);
  const [selectedYearId, setSelectedYearId] = useState(null);
  const [rows,           setRows]           = useState([]); // [{classId, cls, tuition, uniform}]
  const [loadingRows,    setLoadingRows]    = useState(false);
  const [editMode,       setEditMode]       = useState(false);
  const [backup,         setBackup]         = useState(null);
  const [editing,        setEditing]        = useState(null);
  const [saved,          setSaved]          = useState(false);
  const [bulkUniform,    setBulkUniform]    = useState("");
  const [oldDiscount,    setOldDiscount]    = useState(1000);
  const backupDiscountRef = useRef(null);

  // Load years + class list on mount
  useEffect(() => {
    Promise.all([getAcademicYears(), getClassesWithSections()]).then(([yrs, cls]) => {
      setYears(yrs);
      setAllClasses(cls);
      const cur = yrs.find(y => y.is_current) || yrs[yrs.length - 1];
      if (cur) setSelectedYearId(cur.id);
    }).catch(() => {});
  }, []);

  // Load fee structures when year or allClasses changes
  useEffect(() => {
    if (!selectedYearId || allClasses.length === 0) return;
    setLoadingRows(true);
    getFeeStructuresForYear(selectedYearId).then(fsRows => {
      if (fsRows.length > 0) {
        setRows(fsRows.map(r => ({
          classId: r.class_id,
          cls:     r.classes?.name || "",
          tuition: Number(r.tuition_amount) || 0,
          uniform: Number(r.uniform_amount) || 0,
        })));
        setOldDiscount(Number(fsRows[0].old_student_discount) || 1000);
      } else {
        setRows(allClasses.map(c => ({ classId: c.id, cls: c.name, tuition: 0, uniform: 0 })));
        setOldDiscount(1000);
      }
    }).catch(() => {}).finally(() => setLoadingRows(false));
  }, [selectedYearId, allClasses]);

  function startEdit() {
    setBackup(rows.map(r => ({ ...r })));
    backupDiscountRef.current = oldDiscount;
    setBulkUniform("");
    setEditMode(true);
  }

  function cancel() {
    setRows(backup);
    setOldDiscount(backupDiscountRef.current);
    setEditing(null);
    setBulkUniform("");
    setEditMode(false);
  }

  async function save() {
    try {
      await saveFeeStructuresForYear(selectedYearId, rows, oldDiscount);
      const uniformMap = {};
      rows.forEach(r => { uniformMap[r.cls] = r.uniform; });
      setUniformFeesStore(uniformMap);
      setOldStudentDiscountStore(oldDiscount);
    } catch { /* silently fail */ }
    setEditing(null);
    setBulkUniform("");
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2500);
  }

  function applyBulkUniform() {
    const num = parseInt(bulkUniform);
    if (!isPositiveAmount(num, 100000)) return;
    setRows(prev => prev.map(r => ({ ...r, uniform: num })));
    setBulkUniform("");
  }

  function setCell(cls, key, val) {
    const num = parseInt(val) || 0;
    const clamped = Math.min(Math.max(num, 0), 1000000);
    setRows(prev => prev.map(r => r.cls === cls ? { ...r, [key]: clamped } : r));
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
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0"/>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-school-navy focus:outline-none focus:ring-2 focus:ring-school-navy/20 cursor-pointer disabled:opacity-50"
                value={selectedYearId || ""}
                onChange={e => { if (!editMode) setSelectedYearId(e.target.value); }}
                disabled={editMode}
              >
                {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>
            <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
          </div>
        </div>

        {/* Bulk uniform setter — edit mode only */}
        {editMode && (
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <IndianRupee className="w-3.5 h-3.5 text-amber-600"/>
              <span className="text-xs font-bold text-amber-700">Set uniform fee for all classes:</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold pointer-events-none">₹</span>
                <input
                  type="number" min="0"
                  className="pl-7 pr-3 py-1.5 border border-amber-300 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  placeholder="e.g. 1500"
                  value={bulkUniform}
                  onChange={e => setBulkUniform(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyBulkUniform()}
                />
              </div>
              <button
                onClick={applyBulkUniform}
                disabled={!isPositiveAmount(parseInt(bulkUniform), 100000)}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply to All
              </button>
            </div>
            <span className="text-[11px] text-amber-600">
              Updates all classes · You can still edit individual classes below
            </span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          {loadingRows ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Loading fee structure…
            </div>
          ) : (
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
                  const total  = row.tuition + row.uniform;
                  const isEven = idx % 2 === 0;
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
          )}
        </div>

        {/* Old Student Discount */}
        <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
          <div>
            <p className="text-sm font-bold text-gray-700">Old Student Discount</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Applied automatically to returning students during promotion · Change each year as needed
            </p>
          </div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold">₹</span>
              <input
                type="number" min="0"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-school-navy w-32 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy text-right"
                value={oldDiscount}
                onChange={e => setOldDiscount(parseInt(e.target.value) || 0)}
              />
            </div>
          ) : (
            <span className="text-xl font-bold text-school-navy">
              ₹{oldDiscount.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Classes & Sections ────────────────────────────────────────────────────
// DB class name → Zustand store name (for timetable/student page compat)
const DB_TO_STORE = { "JR.KG":"JR KG","SR.KG":"SR KG","11th - Commerce":"11th Commerce","12th - Commerce":"12th Commerce" };
function dbToStore(name) { return DB_TO_STORE[name] || name; }

function ClassSectionsTab() {
  const setActiveClassesInStore = useStore(s => s.setActiveClasses);

  // rows: [{id, cls, isActive, sections:[{id,name}], sectionTeachers:{}}]
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saved,    setSaved]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getClassesWithSections().then(data => {
      const mapped = data.map(c => ({
        id:      c.id,
        cls:     c.name,
        isActive: c.is_active,
        sections: (c.sections || []).sort((a, b) => a.name.localeCompare(b.name)),
        sectionTeachers: Object.fromEntries(
          (c.sections || []).map(s => [s.name, s.class_teacher || ""])
        ),
      }));
      setRows(mapped);
      setActiveClassesInStore(mapped.filter(r => r.isActive).map(r => dbToStore(r.cls)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setActiveClassesInStore]);

  const activeRows   = rows.filter(r => r.isActive);
  const inactiveRows = rows.filter(r => !r.isActive);

  function startEdit() {
    setBackup(rows.map(r => ({
      ...r,
      sections:        r.sections.map(s => ({ ...s })),
      sectionTeachers: { ...r.sectionTeachers },
    })));
    setEditMode(true);
  }

  function cancel() { setRows(backup); setEditMode(false); }

  async function save() {
    const ops = [];
    for (const row of rows) {
      const orig = backup.find(b => b.id === row.id);
      if (!orig) continue;
      for (const sec of row.sections) {
        const origSec = orig.sections.find(s => s.name === sec.name);
        if (!origSec) {
          // New section — insert with teacher name
          ops.push(insertSection(row.id, sec.name, row.sectionTeachers?.[sec.name] || null));
        } else {
          // Existing section — save teacher if changed
          const newTeacher  = row.sectionTeachers?.[sec.name]  || null;
          const origTeacher = orig.sectionTeachers?.[sec.name] || null;
          if (newTeacher !== origTeacher)
            ops.push(updateSectionTeacher(sec.id, newTeacher));
        }
      }
      for (const sec of orig.sections) {
        if (!row.sections.find(s => s.name === sec.name))
          ops.push(deleteSectionFromDB(sec.id));
      }
    }
    try {
      await Promise.all(ops);
      // Reload to get real ids for new sections and confirm saved teachers
      const fresh = await getClassesWithSections();
      setRows(prev => prev.map(r => {
        const f = fresh.find(c => c.id === r.id);
        if (!f) return r;
        return {
          ...r,
          sections: (f.sections || []).sort((a, b) => a.name.localeCompare(b.name)),
          sectionTeachers: Object.fromEntries(
            (f.sections || []).map(s => [s.name, s.class_teacher || ""])
          ),
        };
      }));
    } catch { /* silently fail — local state remains */ }
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleActivate(row) {
    try {
      await setClassActiveInDB(row.id, true);
      const updated = rows.map(r => r.id === row.id ? { ...r, isActive: true } : r);
      setRows(updated);
      setActiveClassesInStore(updated.filter(r => r.isActive).map(r => dbToStore(r.cls)));
    } catch { /* silently fail */ }
  }

  async function handleDeactivate(row) {
    try {
      await setClassActiveInDB(row.id, false);
      const updated = rows.map(r => r.id === row.id ? { ...r, isActive: false } : r);
      setRows(updated);
      setActiveClassesInStore(updated.filter(r => r.isActive).map(r => dbToStore(r.cls)));
      setExpanded(null);
    } catch { /* silently fail */ }
  }

  function addSectionLocal(cls) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const next = String.fromCharCode(65 + r.sections.length);
      if (r.sections.find(s => s.name === next)) return r;
      return { ...r, sections: [...r.sections, { id: null, name: next }], sectionTeachers: { ...r.sectionTeachers, [next]: "" } };
    }));
  }

  function removeSectionLocal(cls, secName) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const st = { ...r.sectionTeachers };
      delete st[secName];
      return { ...r, sections: r.sections.filter(s => s.name !== secName), sectionTeachers: st };
    }));
  }

  function setSectionTeacher(cls, sec, val) {
    setRows(prev => prev.map(r =>
      r.cls === cls ? { ...r, sectionTeachers: { ...r.sectionTeachers, [sec]: val } } : r
    ));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading classes…</div>
  );

  return (
    <div className="space-y-4">

      {/* ── Active Classes ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Active Classes</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {editMode ? "Managing sections and class teachers" : `${activeRows.length} classes currently running · Click Edit to manage sections and teachers`}
            </p>
          </div>
          <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
        </div>
        <div className="divide-y divide-gray-100">
          {activeRows.map(row => {
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
                          {row.sections.map(s => {
                            const t = row.sectionTeachers?.[s.name];
                            return t ? `${row.cls}-${s.name} (${t.split(" ")[0]})` : `${row.cls}-${s.name}`;
                          }).join("  ·  ")}
                        </p>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                  </button>
                  <button
                    onClick={() => handleDeactivate(row)}
                    title="Deactivate this class"
                    className="mr-4 px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 text-xs font-semibold hover:bg-orange-50 hover:border-orange-400 transition-colors flex-shrink-0">
                    Deactivate
                  </button>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 pt-3 bg-gray-50/60 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Sections & Class Teachers</p>
                    <div className="space-y-2.5">
                      {row.sections.map(sec => (
                        <div key={sec.name} className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-school-navy text-white text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0 min-w-[64px] justify-between">
                            <span>{row.cls}-{sec.name}</span>
                            {editMode && row.sections.length > 1 && (
                              <button onClick={() => removeSectionLocal(row.cls, sec.name)}
                                className="ml-1.5 hover:text-red-300 transition-colors">
                                <X className="w-3 h-3"/>
                              </button>
                            )}
                          </div>
                          {editMode ? (
                            <select
                              className={`${sel} flex-1 max-w-xs`}
                              value={row.sectionTeachers?.[sec.name] || ""}
                              onChange={e => setSectionTeacher(row.cls, sec.name, e.target.value)}
                            >
                              <option value="">— Not Assigned —</option>
                              {TEACHERS_TT.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ) : (
                            <span className={`text-sm font-medium ${row.sectionTeachers?.[sec.name] ? "text-gray-700" : "text-gray-300"}`}>
                              {row.sectionTeachers?.[sec.name] || "Not assigned"}
                            </span>
                          )}
                        </div>
                      ))}

                      {editMode && row.sections.length < 5 && (
                        <button onClick={() => addSectionLocal(row.cls)}
                          className="flex items-center gap-1.5 border-2 border-dashed border-gray-300 text-gray-400 hover:border-school-navy hover:text-school-navy text-xs font-semibold px-3 py-2 rounded-lg transition-colors mt-1">
                          <Plus className="w-3 h-3"/> Add Section
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Upcoming / Inactive Classes ── */}
      {inactiveRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Upcoming Classes</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              These classes are not yet started. Activate a class when you are ready to run it.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {inactiveRows.map(row => (
              <div key={row.cls} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-gray-400"/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500">{row.cls}</p>
                    <p className="text-xs text-gray-400">Not yet started</p>
                  </div>
                </div>
                <button
                  onClick={() => handleActivate(row)}
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

// ── Permission Constants ───────────────────────────────────────────────────────
const PERM_ROLES = ["Admin","Teacher"];

const PERMISSION_GROUPS = [
  {
    group:"Students",
    items:[
      { id:"student_basic", label:"Student Basic Info",    desc:"Name, class, section, roll no, photo" },
      { id:"student_full",  label:"Student Full Details",  desc:"DOB, parent contact, govt IDs, all documents" },
    ],
  },
  {
    group:"Fees",
    items:[
      { id:"fees_view",       label:"View Fee Records",         desc:"See fee payment history and pending dues" },
      { id:"fees_class_only", label:"Assigned Class Fees Only", desc:"Restrict fee view to their assigned class only" },
      { id:"fees_remind",     label:"Send Fee Reminders",       desc:"Notify parents about pending fee payments" },
    ],
  },
  {
    group:"Other Access",
    items:[
      { id:"attendance", label:"Attendance",     desc:"Mark and view daily student attendance" },
      { id:"reports",    label:"Reports",         desc:"View and export school reports" },
      { id:"timetable",  label:"View Timetable",  desc:"Access and view the class timetable" },
    ],
  },
];

const DEFAULT_ROLE_PERMS = {
  "Admin":   { student_basic:true, student_full:true,  fees_view:true,  fees_class_only:false, fees_remind:true,  attendance:true,  reports:true,  timetable:true  },
  "Teacher": { student_basic:true, student_full:false, fees_view:true,  fees_class_only:true,  fees_remind:true,  attendance:true,  reports:false, timetable:true  },
};

const ROLE_COLORS = {
  "Super Admin": "bg-red-100 text-red-700",
  "Admin":       "bg-purple-100 text-purple-700",
  "Teacher":     "bg-green-100 text-green-700",
};

// ── Tab: Users & Roles ─────────────────────────────────────────────────────────
function UsersRolesTab() {
  // ── Permissions ──
  const storedPerms = useStore(s => s.rolePermissions);
  const savePerms   = useStore(s => s.setRolePermissions);
  const pBackupRef  = useRef(null);

  const [perms, setPerms] = useState(() => {
    // Always start from DEFAULT_ROLE_PERMS so all required roles exist,
    // then overlay any previously saved values for matching roles.
    const saved = storedPerms ?? {};
    return Object.fromEntries(
      PERM_ROLES.map(role => [
        role,
        { ...DEFAULT_ROLE_PERMS[role], ...(saved[role] ?? {}) },
      ])
    );
  });
  const [pEditMode, setPEditMode] = useState(false);
  const [pSaved,    setPSaved]    = useState(false);

  function pStartEdit() { pBackupRef.current = JSON.parse(JSON.stringify(perms)); setPEditMode(true); }
  function pCancel()    { setPerms(pBackupRef.current); setPEditMode(false); }
  function pSave()      { savePerms(perms); setPSaved(true); setPEditMode(false); setTimeout(() => setPSaved(false), 2500); }

  function togglePerm(role, permId) {
    setPerms(prev => ({
      ...prev,
      [role]: { ...(DEFAULT_ROLE_PERMS[role] ?? {}), ...(prev[role] ?? {}), [permId]: !(prev[role]?.[permId] ?? false) },
    }));
  }

  // ── Users ──
  const [users,    setUsers]    = useState(DEF_USERS);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [showPass, setShowPass] = useState({});
  const [saved,    setSaved]    = useState(false);

  const blank = { name:"", email:"", role:"Fee Clerk", status:"Active", pass:"" };
  const [form, setForm] = useState(blank);
  const [userErrors, setUserErrors] = useState({});
  const setF = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setUserErrors(p => ({ ...p, [k]: "" })); };

  function startEdit() { setBackup(users.map(u => ({ ...u }))); setEditMode(true); }
  function cancel()    { setUsers(backup); setShowForm(false); setEditId(null); setEditMode(false); }
  function save()      { setShowForm(false); setEditId(null); setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2000); }

  function openAdd()    { setForm(blank); setEditId(null); setUserErrors({}); setShowForm(true); }
  function openEdit(u)  { setForm({ ...u }); setEditId(u.id); setUserErrors({}); setShowForm(true); }

  function saveUser() {
    const e = {};
    if (!isValidName(form.name, { max: 80 })) e.name = "Enter a valid full name.";
    if (!isValidEmail(form.email)) e.email = "Enter a valid email address.";
    else if (users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editId)) {
      e.email = "A user with this email already exists.";
    }
    if (!isNonEmpty(form.pass) || form.pass.trim().length < 6) e.pass = "Password must be at least 6 characters.";
    setUserErrors(e);
    if (!hasNoErrors(e)) return;
    if (editId) setUsers(prev => prev.map(u => u.id === editId ? { ...form, id: editId } : u));
    else        setUsers(prev => [...prev, { ...form, id: Date.now() }]);
    setShowForm(false);
  }

  function deleteUser(id) { setUsers(prev => prev.filter(u => u.id !== id)); }

  return (
    <div className="space-y-5">

      {/* ── Role Permissions Matrix ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Role Permissions</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Control what each role can access in the teacher &amp; staff app
            </p>
          </div>
          <EditBar editMode={pEditMode} saved={pSaved} onEdit={pStartEdit} onSave={pSave} onCancel={pCancel}/>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ minWidth:"220px" }}>
                  Permission
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-red-600 whitespace-nowrap">
                  Super Admin
                </th>
                {PERM_ROLES.map(role => (
                  <th key={role} className="px-4 py-3 text-center text-xs font-bold text-gray-600 whitespace-nowrap">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(group => (
                <>
                  <tr key={group.group} className="bg-school-navy/5 border-b border-gray-100">
                    <td colSpan={PERM_ROLES.length + 2} className="px-5 py-2">
                      <span className="text-[10px] font-black text-school-navy uppercase tracking-[0.2em]">
                        {group.group}
                      </span>
                    </td>
                  </tr>
                  {group.items.map((perm, idx) => (
                    <tr key={perm.id} className={`border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-800">{perm.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{perm.desc}</p>
                      </td>
                      {/* Super Admin — always enabled, locked */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-red-600"/>
                          </div>
                        </div>
                      </td>
                      {/* Other roles — toggleable */}
                      {PERM_ROLES.map(role => {
                        const enabled = perms[role]?.[perm.id] ?? false;
                        return (
                          <td key={role} className="px-4 py-3.5 text-center">
                            <div className="flex justify-center">
                              <button
                                disabled={!pEditMode}
                                onClick={() => togglePerm(role, perm.id)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                  enabled
                                    ? "bg-green-500 text-white shadow-sm"
                                    : "bg-gray-100 border border-gray-200 text-transparent"
                                } ${pEditMode ? "cursor-pointer hover:opacity-75 hover:scale-110" : "cursor-default"}`}
                              >
                                <Check className="w-4 h-4"/>
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white"/>
            </div>
            <span className="text-xs text-gray-500 font-medium">Allowed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-gray-100 border border-gray-200"/>
            <span className="text-xs text-gray-500 font-medium">Not allowed</span>
          </div>
          {pEditMode && (
            <span className="text-xs text-amber-600 font-medium ml-2">
              · Click any cell to toggle permission
            </span>
          )}
        </div>
      </div>

      {/* ── Users List ── */}
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

        {editMode && showForm && (
          <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100">
            <p className="text-xs font-bold text-school-navy uppercase tracking-wide mb-4">
              {editId ? "Edit User" : "Add New User"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Full Name">
                <input className={inp} placeholder="Enter name" value={form.name} onChange={setF("name")}/>
                <FieldError msg={userErrors.name}/>
              </Field>
              <Field label="Email">
                <input className={inp} type="email" placeholder="email@school.in" value={form.email} onChange={setF("email")}/>
                <FieldError msg={userErrors.email}/>
              </Field>
              <Field label="Role">
                <select className={sel} value={form.role} onChange={setF("role")}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input className={inp + " pr-9"} type={showPass.form ? "text" : "password"}
                    placeholder="Set password" value={form.pass} onChange={setF("pass")}/>
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, form: !p.form }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass.form ? <EyeOff className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                  </button>
                </div>
                <FieldError msg={userErrors.pass}/>
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

// ── Tab: Timetable ─────────────────────────────────────────────────────────────
function TimetableTab() {
  const periodDefs      = useStore(s => s.periodDefs);
  const setPeriodDefs   = useStore(s => s.setPeriodDefs);
  const storedTT        = useStore(s => s.timetables);
  const saveTT          = useStore(s => s.setTimetables);
  const ttActiveClasses = useStore(s => s.activeClasses);
  const backupRef       = useRef(null);
  const periodsBackup   = useRef(null);

  const [selYear,          setSelYear]          = useState(DEF_YEAR.current);
  const [editMode,         setEditMode]         = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [activeCell,       setActiveCell]       = useState(null);
  const [ttData,           setTtData]           = useState(() => storedTT || {});
  const [periodsEditMode,  setPeriodsEditMode]  = useState(false);
  const [periodsForm,      setPeriodsForm]      = useState(() => JSON.parse(JSON.stringify(periodDefs || DEF_PERIOD_DEFS)));
  const [periodsSaved,     setPeriodsSaved]     = useState(false);
  const [activeGroup,      setActiveGroup]      = useState(DAY_GROUPS[0]);

  const activeDefs = periodsEditMode ? periodsForm : (periodDefs || DEF_PERIOD_DEFS);
  function groupSlots(group) { return activeDefs[group] ?? []; }

  function fmtTime(t) { if (!t) return ""; const [h,m] = t.split(":"); return `${parseInt(h)}:${m}`; }
  function fmtSlotTime(slot) { return `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}`; }

  // ── Period management ──
  function startPeriodsEdit() {
    periodsBackup.current = JSON.parse(JSON.stringify(periodDefs || DEF_PERIOD_DEFS));
    setPeriodsForm(JSON.parse(JSON.stringify(periodDefs || DEF_PERIOD_DEFS)));
    setPeriodsEditMode(true);
  }
  function cancelPeriodsEdit() { setPeriodsForm(periodsBackup.current); setPeriodsEditMode(false); }
  function savePeriodsEdit()   { setPeriodDefs(periodsForm); setPeriodsSaved(true); setPeriodsEditMode(false); setTimeout(() => setPeriodsSaved(false), 2500); }

  function moveSlot(group, idx, dir) {
    setPeriodsForm(prev => {
      const slots = [...(prev[group] ?? [])];
      const ni = idx + dir;
      if (ni < 0 || ni >= slots.length) return prev;
      [slots[idx], slots[ni]] = [slots[ni], slots[idx]];
      return { ...prev, [group]: slots };
    });
  }
  function updateSlot(group, idx, key, val) {
    setPeriodsForm(prev => ({ ...prev, [group]: prev[group].map((s,i) => i===idx ? {...s,[key]:val} : s) }));
  }
  function deleteSlot(group, idx) {
    setPeriodsForm(prev => ({ ...prev, [group]: prev[group].filter((_,i) => i!==idx) }));
  }
  function addSlot(group, isBreak) {
    const existing = periodsForm[group] ?? [];
    const last = existing[existing.length - 1];
    const periodCount = existing.filter(s => !s.isBreak).length;
    setPeriodsForm(prev => ({
      ...prev,
      [group]: [...(prev[group] ?? []), {
        id: "slot_" + Date.now(),
        label: isBreak ? "Break" : `Period ${periodCount + 1}`,
        startTime: last?.endTime ?? "09:00",
        endTime:   last?.endTime ?? "09:45",
        isBreak,
      }],
    }));
  }

  // ── Timetable grid ──
  const activeColClasses = CLASSES.filter(c => ttActiveClasses.includes(c));

  function getSlot(group, slotId, cls) {
    return ttData?.[selYear]?.[group]?.[slotId]?.[cls] ?? { subject:"", teacher:"" };
  }
  function setSlotVal(group, slotId, cls, key, value) {
    setTtData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[selYear])                     next[selYear]                     = {};
      if (!next[selYear][group])              next[selYear][group]              = {};
      if (!next[selYear][group][slotId])      next[selYear][group][slotId]      = {};
      if (!next[selYear][group][slotId][cls]) next[selYear][group][slotId][cls] = { subject:"", teacher:"" };
      next[selYear][group][slotId][cls][key] = value;
      return next;
    });
  }
  function getBusyTeachers(group, slotId, currentCls) {
    const busy = new Set();
    Object.entries(ttData?.[selYear]?.[group]?.[slotId] ?? {}).forEach(([cls, cell]) => {
      if (cls !== currentCls && cell?.teacher) busy.add(cell.teacher);
    });
    return busy;
  }
  function startEdit() { backupRef.current = JSON.parse(JSON.stringify(ttData)); setEditMode(true); setActiveCell(null); }
  function cancel()    { if (backupRef.current) setTtData(backupRef.current); setEditMode(false); setActiveCell(null); }
  function save()      { saveTT(ttData); setSaved(true); setEditMode(false); setActiveCell(null); setTimeout(() => setSaved(false), 2500); }
  const isCellActive = (group, slotId, cls) =>
    activeCell?.group === group && activeCell?.slotId === slotId && activeCell?.cls === cls;

  // ── PDF Export ──
  function exportPDF() {
    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a3" });
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.setTextColor(30,58,95);
    doc.text(`Staff Time Table — ${selYear}`, pw/2, 32, { align:"center" });
    doc.setFontSize(9); doc.setTextColor(100,100,100);
    doc.text("Satyam Stars International School  ·  Surat, Gujarat", pw/2, 46, { align:"center" });
    let y = 58;
    DAY_GROUPS.forEach((group) => {
      const slots = groupSlots(group);
      const isSat = group === "Saturday";
      doc.setFillColor(...(isSat ? [180,72,0] : [30,58,95]));
      doc.setTextColor(255,255,255); doc.setFontSize(11);
      doc.rect(30, y, pw-60, 18, "F");
      doc.text(`  ${group}${isSat ? "  —  Half Day" : ""}`, 34, y+13);
      y += 22;
      const head = [["TIME", ...activeColClasses]];
      const body = slots.map(slot => {
        if (slot.isBreak) return [{ content: fmtSlotTime(slot) }, { content:slot.label, colSpan:activeColClasses.length, styles:{ halign:"center", fontStyle:"bold", textColor:[80,80,80], fillColor:[240,240,240] } }];
        return [
          fmtSlotTime(slot),
          ...activeColClasses.map(cls => {
            const cell = getSlot(group, slot.id, cls);
            return cell.subject ? `${cell.subject}\n${shortName(cell.teacher)||""}` : "";
          }),
        ];
      });
      autoTable(doc, {
        head, body, startY: y, theme:"grid",
        styles: { fontSize:7, cellPadding:3, overflow:"linebreak" },
        headStyles: { fillColor:[30,58,95], textColor:[255,255,255], fontStyle:"bold", fontSize:7.5 },
        columnStyles: { 0:{ cellWidth:58, fontStyle:"bold", textColor:[30,58,95] } },
        didParseCell(data) {
          if (data.section !== "body" || data.column.index === 0) return;
          const slot = slots[data.row.index];
          if (slot?.isBreak) return;
          const cls = activeColClasses[data.column.index - 1];
          if (!cls) return;
          const cell = getSlot(group, slot.id, cls);
          if (cell?.teacher) {
            const tidx = TEACHERS_TT.indexOf(cell.teacher);
            if (tidx >= 0) { data.cell.styles.fillColor = TEACHER_RGB_PALETTE[tidx % TEACHER_RGB_PALETTE.length]; data.cell.styles.textColor = [40,40,40]; }
          }
        },
        margin: { left:30, right:30 },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 14;
      if (y > doc.internal.pageSize.height - 60 && group !== DAY_GROUPS[DAY_GROUPS.length-1]) { doc.addPage(); y = 30; }
    });
    doc.save(`Timetable_${selYear}.pdf`);
  }

  // ── Excel Export ──
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    DAY_GROUPS.forEach(group => {
      const slots = groupSlots(group);
      const data = [
        ["TIME", ...activeColClasses],
        ...slots.map(slot => {
          if (slot.isBreak) return [fmtSlotTime(slot), ...activeColClasses.map(() => `── ${slot.label} ──`)];
          return [
            fmtSlotTime(slot),
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

      {/* ── Manage Periods ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-bold text-gray-800">Period Schedule</p>
            <p className="text-xs text-gray-400 mt-0.5">Add, remove, reorder periods and breaks for each day group independently</p>
          </div>
          {!periodsEditMode ? (
            <button onClick={startPeriodsEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors shadow-sm">
              <Pencil className="w-3.5 h-3.5"/> Edit Schedule
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={cancelPeriodsEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                <X className="w-3.5 h-3.5"/> Cancel
              </button>
              <button onClick={savePeriodsEdit}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all ${periodsSaved ? "bg-green-500 text-white" : "bg-school-navy text-white hover:bg-school-navy/90"}`}>
                {periodsSaved ? <Check className="w-3.5 h-3.5"/> : <Save className="w-3.5 h-3.5"/>}
                {periodsSaved ? "Saved!" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Day group tab selector */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          {DAY_GROUPS.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)}
              className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors ${
                activeGroup === g ? "bg-white text-school-navy shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {g}
            </button>
          ))}
        </div>

        {/* Period rows for selected day group */}
        <div className="space-y-2">
          {groupSlots(activeGroup).map((slot, idx) => {
            const slots = groupSlots(activeGroup);
            const periodNum = slots.slice(0, idx + 1).filter(s => !s.isBreak).length;
            return (
              <div key={slot.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                slot.isBreak ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"
              }`}>
                {/* Reorder arrows */}
                {periodsEditMode && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button disabled={idx === 0} onClick={() => moveSlot(activeGroup, idx, -1)}
                      className="p-0.5 rounded text-gray-400 hover:text-school-navy disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronUp className="w-3.5 h-3.5"/>
                    </button>
                    <button disabled={idx === slots.length - 1} onClick={() => moveSlot(activeGroup, idx, 1)}
                      className="p-0.5 rounded text-gray-400 hover:text-school-navy disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                      <ChevronDown className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                )}
                {/* Type badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                  slot.isBreak ? "bg-amber-200 text-amber-800" : "bg-school-navy/10 text-school-navy"
                }`}>
                  {slot.isBreak ? "BREAK" : `P${periodNum}`}
                </span>

                {periodsEditMode ? (
                  <>
                    <input value={slot.label} onChange={e => updateSlot(activeGroup, idx, "label", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-school-navy/30 bg-white"
                      placeholder="Label"/>
                    <input type="time" value={slot.startTime} onChange={e => updateSlot(activeGroup, idx, "startTime", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-[7.5rem] flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-school-navy/30 bg-white"/>
                    <span className="text-gray-400 text-xs flex-shrink-0">–</span>
                    <input type="time" value={slot.endTime} onChange={e => updateSlot(activeGroup, idx, "endTime", e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-[7.5rem] flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-school-navy/30 bg-white"/>
                    <button onClick={() => updateSlot(activeGroup, idx, "isBreak", !slot.isBreak)}
                      className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold border transition-colors whitespace-nowrap flex-shrink-0 ${
                        slot.isBreak
                          ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200"
                          : "bg-gray-100 text-gray-500 border-gray-200 hover:border-amber-300 hover:text-amber-600"
                      }`}>
                      {slot.isBreak ? "Break ✓" : "Set Break"}
                    </button>
                    <button onClick={() => deleteSlot(activeGroup, idx)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-gray-700 flex-1">{slot.label}</span>
                    <span className="text-xs text-gray-400 font-mono tabular-nums">{fmtSlotTime(slot)}</span>
                  </>
                )}
              </div>
            );
          })}

          {periodsEditMode && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => addSlot(activeGroup, false)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-school-navy/30 text-school-navy text-xs font-semibold hover:border-school-navy hover:bg-school-navy/5 transition-colors">
                <Plus className="w-3.5 h-3.5"/> Add Period
              </button>
              <button onClick={() => addSlot(activeGroup, true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 text-xs font-semibold hover:border-amber-500 hover:bg-amber-50 transition-colors">
                <Plus className="w-3.5 h-3.5"/> Add Break
              </button>
            </div>
          )}
        </div>

        {periodsSaved && (
          <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
            <Check className="w-4 h-4"/> Period schedule saved.
          </div>
        )}
      </div>

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
        const slots  = groupSlots(group);
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
                    if (slot.isBreak) {
                      return (
                        <tr key={slot.id} className="bg-gray-100 border-b border-gray-200">
                          <td className="px-3 py-2 border-r border-gray-300 text-center sticky left-0 bg-gray-100 z-10">
                            <p className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{fmtSlotTime(slot)}</p>
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
                          <p className="text-[10px] font-bold text-school-navy whitespace-nowrap">{fmtSlotTime(slot)}</p>
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
// ── Tab: Fee Reminder Templates ────────────────────────────────────────────────
function FeeReminderTab() {
  const stored    = useStore(s => s.feeReminderTemplates);
  const setStored = useStore(s => s.setFeeReminderTemplates);
  const [form,     setForm]     = useState({ ...stored });
  const [editMode, setEditMode] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [backup,   setBackup]   = useState(null);

  function startEdit() { setBackup({ ...form }); setEditMode(true); }
  function cancel()    { setForm(backup); setEditMode(false); }
  function save()      { setStored(form); setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2500); }

  const LANGS = [
    { key:"en", label:"English Template"  },
    { key:"hi", label:"Hindi Template"    },
    { key:"or", label:"Odia Template"     },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <MessageSquare className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"/>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-blue-800">Fee Reminder Message Templates</p>
          <p className="text-xs text-blue-600">Edit the default message for each language. These are used in the Fees module when sending reminders. Use the placeholders below — they are replaced automatically with each student&apos;s actual data:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {["{name}", "{class}", "{roll}", "{amount}", "{date}"].map(p => (
              <code key={p} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-mono">{p}</code>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-3">
          Message Templates
        </h3>
        <div className="space-y-5">
          {LANGS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
              {editMode
                ? <textarea
                    rows={5}
                    value={form[key]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-y"
                  />
                : <pre className="px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm leading-relaxed text-gray-700 whitespace-pre-wrap font-sans">{form[key]}</pre>
              }
            </div>
          ))}
        </div>
        <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
      </div>
    </div>
  );
}

const TABS = [
  { key:"school",     label:"School Profile",    icon:Building2    },
  { key:"year",       label:"Academic Year",      icon:Calendar     },
  { key:"fees",       label:"Fee Structure",      icon:IndianRupee  },
  { key:"classes",    label:"Classes & Sections", icon:BookOpen     },
  { key:"timetable",  label:"Timetable",          icon:LayoutGrid   },
  { key:"planning",   label:"Year Planning",      icon:CalendarRange},
  { key:"reminders",  label:"Fee Reminders",      icon:MessageSquare},
  { key:"users",      label:"Users & Roles",      icon:Users        },
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
      {tab === "planning"   && <YearPlanningTab/>}
      {tab === "reminders"  && <FeeReminderTab/>}
      {tab === "users"      && <UsersRolesTab/>}
    </div>
  );
}
