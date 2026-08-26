"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useStore from "@/lib/store";
import supabase from "@/lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Building2, Calendar, IndianRupee, BookOpen, Users,
  Save, Plus, Trash2, Eye, EyeOff, Check, X,
  Phone, Mail, MapPin, Hash, Shield, UserPlus,
  GraduationCap, Lock, ChevronDown, ChevronUp, Pencil,
  AlertCircle, LogOut, SlidersHorizontal, LayoutGrid,
  Download, FileSpreadsheet, MessageSquare, CalendarRange, Layers, ScrollText, Award, Smartphone,
  Link2,
} from "lucide-react";
import YearPlanningTab from "./YearPlanningTab";
import RulesRegulationsTab from "./RulesRegulationsTab";
import UsersRolesTab from "./UsersRolesTab";
import ExamsTab from "./ExamsTab";
import AppUpdateTab from "./AppUpdateTab";
import DateInputDMY from "@/components/DateInputDMY";
import {
  isNonEmpty, isValidEmail, isValidPhone, isValidPincode, isValidName,
  isValidAddressText, isValidLength, isPositiveAmount, isDateOnOrAfter, hasNoErrors,
} from "@/lib/validators";
import {
  getSchoolProfile, saveSchoolProfile,
  getHelpDeskAdminNumbers, saveHelpDeskAdminNumbers,
  getAcademicYears, addAcademicYear, deleteAcademicYear, saveCurrentYear,
  getFeeStructuresForYear, saveFeeStructuresForYear,
  getClassesWithSections, setClassActiveInDB, insertSection, deleteSectionFromDB, updateSectionTeacher,
  addSupportingTeacher, removeSupportingTeacher,
  getTeachingEmployees, getAllClassSubjects, saveClassSubjects,
  getPeriodDefs, savePeriodDefs, getDayGroupWeekdays, saveDayGroupWeekdays,
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
// Day groups themselves are no longer a fixed list - admin can add/rename/
// delete them freely (see TimetableTab). DEF_PERIOD_DEFS/DEF_DAY_GROUP_WEEKDAYS
// below are only the starting defaults for a school that's never touched this
// yet - exactly today's 3-group Mon–Sat split, so nothing changes until the
// new UI is actually used.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEF_DAY_GROUP_WEEKDAYS = {
  "Mon – Wed": ["Monday", "Tuesday", "Wednesday"],
  "Thu – Fri": ["Thursday", "Friday"],
  "Saturday": ["Saturday"],
};

// Groups sorted by their earliest assigned weekday (Mon-first), so the grid/
// tabs/exports read in natural week order without needing separately
// persisted ordering - a group with no weekdays assigned yet sorts last.
function sortDayGroups(names, weekdaysMap) {
  const rank = (name) => {
    const days = weekdaysMap?.[name] || [];
    const idxs = days.map(d => WEEKDAYS.indexOf(d)).filter(i => i >= 0);
    return idxs.length ? Math.min(...idxs) : 99;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

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
  "Mathematics","Science","English","Hindi","Social Science","Computer",
  "Accountancy","Economics","Business Studies","P.E.","Drawing",
  "Sanskrit","Gujarati","EVS","Rhymes & Activity","Dance / Yoga",
  "Activity & Play","Free Period","Odia - MIL","G.K.",
];

// Teacher colors used to come from a fixed 16-swatch palette picked by
// hashing the name mod 16 (hashIndex) - collision-spread, but with more
// than a handful of teachers (this school has 50+ staff) two teachers
// landing on the same swatch was inevitable, not just possible. Colors are
// now generated per teacher from their position in the live roster
// (already alphabetical - getTeachingEmployees orders by name), spacing
// hues evenly around the full 360° wheel for however many teachers
// actually exist, so every currently-active teacher gets a genuinely
// distinct color instead of sharing a swatch. Built once via useMemo in
// TimetableTab as `teacherColorMap` (name -> {bg, text, border, rgb}); see
// its definition for how index/total become a hue.
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
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
  const [form,     setForm]     = useState({ ...DEF_SCHOOL, adminNumbers: [] });
  const [saved,    setSaved]    = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [backup,   setBackup]   = useState(null);
  const [errors,   setErrors]   = useState({});
  const set = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  useEffect(() => {
    getSchoolProfile().then(p => {
      if (!p) return;
      setForm(prev => ({
        ...prev,
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
      }));
    }).catch(() => {});
    getHelpDeskAdminNumbers().then(rows => {
      setForm(prev => ({ ...prev, adminNumbers: rows.map(r => ({ label: r.label, phone: r.phone })) }));
    }).catch(() => {});
  }, []);

  function startEdit() {
    setBackup({ ...form, adminNumbers: form.adminNumbers.map(n => ({ ...n })) });
    setEditMode(true);
    setErrors({});
  }
  function cancel()    { setForm(backup); setEditMode(false); setErrors({}); }

  function addAdminNumberLocal() {
    setForm(p => ({ ...p, adminNumbers: [...p.adminNumbers, { label: "", phone: "" }] }));
  }
  function removeAdminNumberLocal(i) {
    setForm(p => ({ ...p, adminNumbers: p.adminNumbers.filter((_, idx) => idx !== i) }));
  }
  function setAdminNumberField(i, key, val) {
    setForm(p => ({ ...p, adminNumbers: p.adminNumbers.map((n, idx) => idx === i ? { ...n, [key]: val } : n) }));
  }

  function validate() {
    const e = {};
    if (!isValidLength(form.name, 100, 3)) e.name = "Enter a valid school name (3-100 characters).";
    if (!isValidAddressText(form.address)) e.address = "Enter a valid address (3-200 characters).";
    if (!isValidName(form.city, { max: 60 })) e.city = "Enter a valid city name.";
    if (!isValidName(form.state, { max: 60 })) e.state = "Enter a valid state name.";
    if (!isValidPincode(form.pin)) e.pin = "PIN code must be exactly 6 digits.";
    if (!isValidPhone(form.phone)) e.phone = "Phone must be a valid 10-digit mobile number.";
    if (!isValidEmail(form.email)) e.email = "Enter a valid email address.";
    if (form.website && !/^(https?:\/\/)?[^\s.]+\..+/.test(form.website.trim())) e.website = "Enter a valid website (e.g. www.school.edu.in).";
    if (!isNonEmpty(form.udise) || !/^\d{8,11}$/.test(form.udise.trim())) e.udise = "UDISE code must be 8-11 digits.";
    const adminErrors = form.adminNumbers.map(n => {
      if (!n.label.trim())        return "Enter a label (e.g. Office, Accounts).";
      if (!isValidPhone(n.phone)) return "Phone must be a valid 10-digit mobile number.";
      return "";
    });
    if (adminErrors.some(Boolean)) e.adminNumbers = adminErrors;
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    if (!hasNoErrors(e)) {
      const messages = Object.entries(e).map(([k, v]) =>
        k === "adminNumbers" ? v.filter(Boolean).join(" ") : v
      );
      alert("Please fix the following before saving:\n\n" + messages.join("\n"));
      return;
    }
    try {
      await saveSchoolProfile(form);
      await saveHelpDeskAdminNumbers(form.adminNumbers.filter(n => n.phone?.trim()));
      setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save: " + (err?.message || "Unknown error"));
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
          Help Desk — Admin Numbers
        </h3>
        <p className="text-xs text-gray-400 -mt-3">
          Shown to students in the mobile app&apos;s Help Desk, after their Class/Supporting Teacher and before the Principal.
        </p>
        <div className="space-y-3">
          {form.adminNumbers.map((n, i) => (
            <div key={i}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  {editMode
                    ? <input className={inp} value={n.label} onChange={e => setAdminNumberField(i, "label", e.target.value)} placeholder="Label (e.g. Office, Accounts)"/>
                    : <ViewVal val={n.label}/>}
                </div>
                <div className="flex-1">
                  {editMode
                    ? <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                        <input className={inp + " pl-9"} value={n.phone} onChange={e => setAdminNumberField(i, "phone", e.target.value)} maxLength={10} placeholder="10-digit mobile"/></div>
                    : <ViewVal val={n.phone} icon={Phone}/>}
                </div>
                {editMode && (
                  <button type="button" onClick={() => removeAdminNumberLocal(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>
              {editMode && <FieldError msg={errors.adminNumbers?.[i]}/>}
            </div>
          ))}
          {form.adminNumbers.length === 0 && !editMode && (
            <p className="text-sm text-gray-300">No admin numbers configured</p>
          )}
          {editMode && (
            <button type="button" onClick={addAdminNumberLocal}
              className="flex items-center gap-1.5 border-2 border-dashed border-gray-300 text-gray-400 hover:border-school-navy hover:text-school-navy text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-3 h-3"/> Add Admin Number
            </button>
          )}
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
    } catch (err) {
      alert("Failed to save: " + (err?.message || "Unknown error"));
    }
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
              ? <DateInputDMY className={inp} value={form.newAdmissionDate} onChange={e => { set("newAdmissionDate")(e); setDateError(""); }}/>
              : <ViewVal val={fmt(form.newAdmissionDate)}/>}
          </Field>
          <Field label="Re-admission Date (Promotion)">
            {editMode
              ? <DateInputDMY className={inp} value={form.readmissionDate} onChange={e => { set("readmissionDate")(e); setDateError(""); }}/>
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
      setEditing(null);
      setBulkUniform("");
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save fee structure: " + (err.message || "Unknown error"));
    }
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

// Maps raw sections from getClassesWithSections() into the shape ClassSectionsTab
// keeps in state — used both on initial load and after save() reloads.
function mapSections(sections) {
  const sorted = (sections || []).sort((a, b) => a.name.localeCompare(b.name));
  return {
    sections: sorted,
    sectionTeachers: Object.fromEntries(sorted.map(s => [s.name, s.class_teacher || ""])),
    sectionSupportingTeachers: Object.fromEntries(sorted.map(s => [
      s.name,
      (s.section_supporting_teachers || []).map(st => ({
        employeeId: st.employee_id,
        name: st.employees?.name || "",
      })),
    ])),
  };
}

function ClassSectionsTab() {
  const setActiveClassesInStore = useStore(s => s.setActiveClasses);

  // rows: [{id, cls, isActive, sections:[{id,name}], sectionTeachers:{}}]
  const [rows,     setRows]     = useState([]);
  const [teachers, setTeachers] = useState([]); // [{id, name}] — real teaching staff
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
        ...mapSections(c.sections),
      }));
      setRows(mapped);
      setActiveClassesInStore(mapped.filter(r => r.isActive).map(r => dbToStore(r.cls)));
      setLoading(false);
    }).catch(() => setLoading(false));
    getTeachingEmployees().then(setTeachers).catch(() => {});
  }, [setActiveClassesInStore]);

  const activeRows   = rows.filter(r => r.isActive);
  const inactiveRows = rows.filter(r => !r.isActive);

  function startEdit() {
    setBackup(rows.map(r => ({
      ...r,
      sections:        r.sections.map(s => ({ ...s })),
      sectionTeachers: { ...r.sectionTeachers },
      sectionSupportingTeachers: Object.fromEntries(
        Object.entries(r.sectionSupportingTeachers || {}).map(([k, v]) => [k, v.map(t => ({ ...t }))])
      ),
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
          // New section — insert with teacher name + real employee link
          const teacherName = row.sectionTeachers?.[sec.name] || null;
          const teacherId   = teachers.find(t => t.name === teacherName)?.id || null;
          ops.push(insertSection(row.id, sec.name, teacherName, teacherId));
        } else {
          // Existing section — save teacher if changed
          const newTeacher  = row.sectionTeachers?.[sec.name]  || null;
          const origTeacher = orig.sectionTeachers?.[sec.name] || null;
          if (newTeacher !== origTeacher) {
            const teacherId = teachers.find(t => t.name === newTeacher)?.id || null;
            ops.push(updateSectionTeacher(sec.id, newTeacher, teacherId));
          }

          // Supporting teachers — diff against backup for this section
          const newSupport  = row.sectionSupportingTeachers?.[sec.name]  || [];
          const origSupport = orig.sectionSupportingTeachers?.[sec.name] || [];
          const newIds  = new Set(newSupport.map(t => t.employeeId));
          const origIds = new Set(origSupport.map(t => t.employeeId));
          for (const t of newSupport)
            if (!origIds.has(t.employeeId)) ops.push(addSupportingTeacher(sec.id, t.employeeId));
          for (const t of origSupport)
            if (!newIds.has(t.employeeId)) ops.push(removeSupportingTeacher(sec.id, t.employeeId));
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
        return { ...r, ...mapSections(f.sections) };
      }));
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save classes/sections: " + (err?.message || "Unknown error"));
    }
  }

  async function handleActivate(row) {
    try {
      await setClassActiveInDB(row.id, true);
      const updated = rows.map(r => r.id === row.id ? { ...r, isActive: true } : r);
      setRows(updated);
      setActiveClassesInStore(updated.filter(r => r.isActive).map(r => dbToStore(r.cls)));
    } catch (err) {
      alert("Failed to activate class: " + (err?.message || "Unknown error"));
    }
  }

  async function handleDeactivate(row) {
    try {
      await setClassActiveInDB(row.id, false);
      const updated = rows.map(r => r.id === row.id ? { ...r, isActive: false } : r);
      setRows(updated);
      setActiveClassesInStore(updated.filter(r => r.isActive).map(r => dbToStore(r.cls)));
      setExpanded(null);
    } catch (err) {
      alert("Failed to deactivate class: " + (err?.message || "Unknown error"));
    }
  }

  function addSectionLocal(cls) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const next = String.fromCharCode(65 + r.sections.length);
      if (r.sections.find(s => s.name === next)) return r;
      return {
        ...r,
        sections: [...r.sections, { id: null, name: next }],
        sectionTeachers: { ...r.sectionTeachers, [next]: "" },
        sectionSupportingTeachers: { ...r.sectionSupportingTeachers, [next]: [] },
      };
    }));
  }

  function removeSectionLocal(cls, secName) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const st = { ...r.sectionTeachers };
      delete st[secName];
      const sst = { ...r.sectionSupportingTeachers };
      delete sst[secName];
      return { ...r, sections: r.sections.filter(s => s.name !== secName), sectionTeachers: st, sectionSupportingTeachers: sst };
    }));
  }

  function setSectionTeacher(cls, sec, val) {
    setRows(prev => prev.map(r =>
      r.cls === cls ? { ...r, sectionTeachers: { ...r.sectionTeachers, [sec]: val } } : r
    ));
  }

  function addSupportingTeacherLocal(cls, sec, employeeId) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const emp = teachers.find(t => t.id === employeeId);
      if (!emp) return r;
      const current = r.sectionSupportingTeachers?.[sec] || [];
      if (current.some(t => t.employeeId === employeeId)) return r;
      return {
        ...r,
        sectionSupportingTeachers: {
          ...r.sectionSupportingTeachers,
          [sec]: [...current, { employeeId, name: emp.name }],
        },
      };
    }));
  }

  function removeSupportingTeacherLocal(cls, sec, employeeId) {
    setRows(prev => prev.map(r => {
      if (r.cls !== cls) return r;
      const current = r.sectionSupportingTeachers?.[sec] || [];
      return {
        ...r,
        sectionSupportingTeachers: {
          ...r.sectionSupportingTeachers,
          [sec]: current.filter(t => t.employeeId !== employeeId),
        },
      };
    }));
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
                      {row.sections.map(sec => {
                        const classTeacherName = row.sectionTeachers?.[sec.name] || "";
                        const supportList = row.sectionSupportingTeachers?.[sec.name] || [];
                        const availableForSupport = teachers.filter(t =>
                          t.name !== classTeacherName && !supportList.some(st => st.employeeId === t.id)
                        );
                        return (
                        <div key={sec.name} className="space-y-1.5">
                          <div className="flex items-center gap-3">
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
                                value={classTeacherName}
                                onChange={e => setSectionTeacher(row.cls, sec.name, e.target.value)}
                              >
                                <option value="">— Not Assigned —</option>
                                {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            ) : (
                              <span className={`text-sm font-medium ${classTeacherName ? "text-gray-700" : "text-gray-300"}`}>
                                {classTeacherName || "Not assigned"}
                              </span>
                            )}
                          </div>

                          {/* Supporting Teachers — same mobile-app section access as the Class Teacher */}
                          <div className="flex items-center gap-2 pl-[76px] flex-wrap">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Supporting:</span>
                            {supportList.map(t => (
                              <span key={t.employeeId} className="flex items-center gap-1 bg-gray-100 text-gray-600 text-[11px] font-medium px-2 py-1 rounded-lg">
                                {t.name}
                                {editMode && (
                                  <button onClick={() => removeSupportingTeacherLocal(row.cls, sec.name, t.employeeId)}
                                    className="hover:text-red-500 transition-colors">
                                    <X className="w-3 h-3"/>
                                  </button>
                                )}
                              </span>
                            ))}
                            {supportList.length === 0 && !editMode && (
                              <span className="text-[11px] text-gray-300">None</span>
                            )}
                            {editMode && (
                              sec.id ? (
                                availableForSupport.length > 0 && (
                                  <select
                                    className="text-[11px] border border-dashed border-gray-300 rounded-lg px-2 py-1 text-gray-400 hover:border-school-navy hover:text-school-navy transition-colors"
                                    value=""
                                    onChange={e => { if (e.target.value) addSupportingTeacherLocal(row.cls, sec.name, e.target.value); }}
                                  >
                                    <option value="">+ Add supporting teacher…</option>
                                    {availableForSupport.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                  </select>
                                )
                              ) : (
                                <span className="text-[11px] text-gray-300 italic">Save the section first to add supporting teachers</span>
                              )
                            )}
                          </div>
                        </div>
                        );
                      })}

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

// ── Tab: Subjects per Class (feeds the Documents → Marksheet report) ──────────
function SubjectsTab() {
  const [rows,       setRows]       = useState([]); // [{cls, subjects:[string,...]}]
  const [loading,    setLoading]    = useState(true);
  const [saved,      setSaved]      = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [backup,     setBackup]     = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [customOpen, setCustomOpen] = useState({}); // {[cls]: bool} — showing the "new subject" text input
  const [customText, setCustomText] = useState({}); // {[cls]: draft text}

  useEffect(() => {
    Promise.all([getClassesWithSections(), getAllClassSubjects()])
      .then(([classes, subjMap]) => {
        const mapped = classes
          .filter(c => c.is_active)
          .map(c => ({ cls: c.name, subjects: subjMap[c.name] || [] }));
        setRows(mapped);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  function startEdit() {
    setBackup(rows.map(r => ({ ...r, subjects: [...r.subjects] })));
    setEditMode(true);
  }
  function cancel() {
    setRows(backup);
    setEditMode(false);
    setCustomOpen({});
    setCustomText({});
  }

  async function save() {
    try {
      await Promise.all(rows.map(r => saveClassSubjects(r.cls, r.subjects)));
      setSaved(true);
      setEditMode(false);
      setCustomOpen({});
      setCustomText({});
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to save subjects: " + (err?.message || "Unknown error"));
    }
  }

  // SUBJECTS_TT (the Timetable tab's master list) plus any subject already
  // in use on some class - e.g. a school-specific one like "MIL"/"Odiya -
  // Math" that a teacher added via "+ Add New Subject" for one class is
  // then a real dropdown option for every other class too, instead of
  // needing to be retyped (and risking a typo) each time.
  const allKnownSubjects = useMemo(() => {
    const set = new Set(SUBJECTS_TT);
    rows.forEach(r => r.subjects.forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [rows]);

  function addSubject(cls, subject) {
    if (!subject) return;
    setRows(prev => prev.map(r =>
      r.cls === cls && !r.subjects.includes(subject)
        ? { ...r, subjects: [...r.subjects, subject] }
        : r
    ));
  }

  function confirmCustomSubject(cls) {
    const text = (customText[cls] || "").trim();
    if (text) addSubject(cls, text);
    setCustomOpen(prev => ({ ...prev, [cls]: false }));
    setCustomText(prev => ({ ...prev, [cls]: "" }));
  }

  function removeSubject(cls, subject) {
    setRows(prev => prev.map(r =>
      r.cls === cls ? { ...r, subjects: r.subjects.filter(s => s !== subject) } : r
    ));
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading subjects…</div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700">Subjects per Class</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {editMode ? "Add or remove subjects for each class" : "Used by the Documents → Marksheet report to know which subjects to list for each class"}
            </p>
          </div>
          <EditBar editMode={editMode} saved={saved} onEdit={startEdit} onSave={save} onCancel={cancel}/>
        </div>
        <div className="divide-y divide-gray-100">
          {rows.map(row => {
            const isOpen = expanded === row.cls;
            return (
              <div key={row.cls}>
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : row.cls)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-school-navy/10 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-school-navy"/>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{row.cls}</p>
                      <p className="text-xs text-gray-400">
                        {row.subjects.length ? `${row.subjects.length} subject${row.subjects.length !== 1 ? "s" : ""}` : "No subjects added yet"}
                      </p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 pt-3 bg-gray-50/60 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {row.subjects.map(subj => (
                        <span key={subj} className="flex items-center gap-1.5 bg-school-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                          {subj}
                          {editMode && (
                            <button onClick={() => removeSubject(row.cls, subj)} className="hover:text-red-300 transition-colors">
                              <X className="w-3 h-3"/>
                            </button>
                          )}
                        </span>
                      ))}
                      {row.subjects.length === 0 && !editMode && (
                        <span className="text-xs text-gray-300">No subjects added yet</span>
                      )}
                    </div>
                    {editMode && (
                      customOpen[row.cls] ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            className={inp + " max-w-xs"}
                            placeholder="e.g. MIL, Odiya - Math…"
                            value={customText[row.cls] || ""}
                            onChange={e => setCustomText(prev => ({ ...prev, [row.cls]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmCustomSubject(row.cls); } }}
                          />
                          <button onClick={() => confirmCustomSubject(row.cls)}
                            className="flex items-center gap-1.5 bg-school-navy text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-school-navy/90 transition-colors">
                            <Plus className="w-3 h-3"/> Add
                          </button>
                          <button onClick={() => { setCustomOpen(prev => ({ ...prev, [row.cls]: false })); setCustomText(prev => ({ ...prev, [row.cls]: "" })); }}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                            <X className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      ) : (() => {
                        const available = allKnownSubjects.filter(s => !row.subjects.includes(s));
                        return (
                          <select
                            className={sel + " max-w-xs"}
                            value=""
                            onChange={e => {
                              if (e.target.value === "__custom__") setCustomOpen(prev => ({ ...prev, [row.cls]: true }));
                              else addSubject(row.cls, e.target.value);
                            }}
                          >
                            <option value="">
                              {available.length === 0 ? "All known subjects added" : "Select a subject to add…"}
                            </option>
                            {available.map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom__">+ Add New Subject…</option>
                          </select>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Timetable ─────────────────────────────────────────────────────────────
function TimetableTab() {
  // Period timings used to live only in the Zustand store, which persists
  // to that browser's localStorage - an edit only ever showed up on the
  // machine that made it, never for any other admin. Now backed by
  // school_profile.period_defs (Supabase) instead, same as the rest of
  // school-wide config.
  const [periodDefs,       setPeriodDefsLocal]  = useState(null);
  const [periodDefsLoading,setPeriodDefsLoading]= useState(true);
  // Fetched directly from the classes table rather than the Zustand
  // "activeClasses" store, which is only populated once the Classes &
  // Sections tab has actually been mounted this session — its hardcoded
  // fallback is also missing 10th/11th Commerce/12th Commerce, so on a
  // fresh browser that opened Settings straight to Timetable, those
  // classes' columns/boxes would silently never appear.
  const [ttActiveClasses,  setTtActiveClasses]  = useState([]);
  const backupRef       = useRef(null);
  const periodsBackup   = useRef(null);

  const [selYear,          setSelYear]          = useState("");
  const [yearList,         setYearList]         = useState([]);
  const [editMode,         setEditMode]         = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [ttLoading,        setTtLoading]        = useState(false);
  const [ttError,          setTtError]          = useState("");
  const [activeCell,       setActiveCell]       = useState(null);
  const [ttData,           setTtData]           = useState({});
  const [periodsEditMode,  setPeriodsEditMode]  = useState(false);
  const [periodsForm,      setPeriodsForm]      = useState(() => JSON.parse(JSON.stringify(DEF_PERIOD_DEFS)));
  const [periodsSaved,     setPeriodsSaved]     = useState(false);
  const [activeGroup,      setActiveGroup]      = useState(Object.keys(DEF_PERIOD_DEFS)[0]);

  // Which weekdays use which day group's periods - see
  // mobile-app/SUPABASE_TIMETABLE_CUSTOMIZE_MERGE.sql. weekdaysForm is the
  // draft edited alongside periodsForm during periodsEditMode; groupRenames/
  // groupDeletes track structural changes (current name -> original DB name,
  // and original DB names to delete) made during THIS edit session, applied
  // to saved `timetables` rows only on Save so Cancel stays truly a no-op.
  const [dayGroupWeekdays, setDayGroupWeekdaysLocal] = useState(null);
  const [weekdaysForm,     setWeekdaysForm]     = useState(() => JSON.parse(JSON.stringify(DEF_DAY_GROUP_WEEKDAYS)));
  const [groupRenames,     setGroupRenames]     = useState({}); // currentName -> originalDbName
  const [groupDeletes,     setGroupDeletes]     = useState(new Set()); // originalDbNames

  // Teacher and Subject options for the cell editor - previously hardcoded
  // 16-name/20-subject lists (TEACHERS_TT/SUBJECTS_TT), so any teacher hired
  // since, or any subject not in that exact list, simply had no option to
  // pick from. Teachers now come live from Employees; subjects are scoped
  // per-class from the "Subjects" tab's class_subjects table (same source
  // SubjectsTab writes to), falling back to the generic SUBJECTS_TT starter
  // list for a class that hasn't been configured there yet.
  const [teacherList,      setTeacherList]      = useState([]); // [{id, name}]
  const [classSubjectsMap, setClassSubjectsMap]  = useState({}); // store-format class name -> [subjects]

  useEffect(() => {
    getPeriodDefs()
      .then(defs => {
        setPeriodDefsLocal(defs);
        setPeriodsForm(JSON.parse(JSON.stringify(defs || DEF_PERIOD_DEFS)));
        // activeGroup started out pointing at the fallback default's first
        // key - once the real saved groups load, make sure it still points
        // at something that actually exists (a school that's already
        // customized this could have entirely different group names).
        const keys = Object.keys(defs || DEF_PERIOD_DEFS);
        setActiveGroup(prev => keys.includes(prev) ? prev : (keys[0] || ""));
      })
      .finally(() => setPeriodDefsLoading(false));
    getDayGroupWeekdays()
      .then(map => {
        setDayGroupWeekdaysLocal(map);
        setWeekdaysForm(JSON.parse(JSON.stringify(map || DEF_DAY_GROUP_WEEKDAYS)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getClassesWithSections()
      .then(data => setTtActiveClasses(data.filter(c => c.is_active).map(c => dbToStore(c.name))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getTeachingEmployees().then(setTeacherList).catch(() => {});
  }, []);

  useEffect(() => {
    getAllClassSubjects().then(dbMap => {
      const storeMap = {};
      Object.entries(dbMap).forEach(([dbName, subjects]) => { storeMap[dbToStore(dbName)] = subjects; });
      setClassSubjectsMap(storeMap);
    }).catch(() => {});
  }, []);

  const teacherNames = teacherList.map(t => t.name);

  // One evenly-spaced hue per teacher, indexed by their position in the
  // (already name-sorted) roster - see hslToRgb's comment above for why.
  const teacherColorMap = useMemo(() => {
    const map = {};
    const total = teacherList.length;
    teacherList.forEach((t, i) => {
      const hue = Math.round((360 * i) / Math.max(total, 1));
      map[t.name] = {
        bg:     `hsl(${hue}, 68%, 93%)`,
        text:   `hsl(${hue}, 55%, 30%)`,
        border: `hsl(${hue}, 55%, 78%)`,
        rgb:    hslToRgb(hue, 68, 93),
      };
    });
    return map;
  }, [teacherList]);

  useEffect(() => {
    supabase.from("academic_years").select("label, is_current").order("label").then(({ data }) => {
      const years = (data || []).map(y => y.label).filter(Boolean);
      if (years.length) setYearList(years);
      const current = (data || []).find(y => y.is_current)?.label || years[years.length - 1] || DEF_YEAR.current;
      setSelYear(current);
    });
  }, []);

  async function loadTT(year) {
    setTtLoading(true);
    setTtError("");
    const { data, error } = await supabase.from("timetables").select("*").eq("academic_year", year);
    if (error) {
      // Was previously swallowed silently - a failed read looked exactly
      // like "the schedule is just empty", which is how a permissions
      // issue on this table would present as "I saved, refreshed, and my
      // changes are gone" with no visible error anywhere.
      console.error("Failed to load timetable:", error);
      setTtError(error.message || "Failed to load the saved timetable.");
      setTtData({});
      setTtLoading(false);
      return;
    }
    const built = {};
    (data || []).forEach(row => {
      if (!built[year])                              built[year]                              = {};
      if (!built[year][row.day_group])               built[year][row.day_group]               = {};
      if (!built[year][row.day_group][row.slot_id])  built[year][row.day_group][row.slot_id]  = {};
      built[year][row.day_group][row.slot_id][row.class_name] = { subject: row.subject || "", teacher: row.teacher || "", mergedWith: row.merged_with || [] };
    });
    setTtData(built);
    setTtLoading(false);
  }

  useEffect(() => { if (selYear) loadTT(selYear); }, [selYear]);

  const activeDefs     = periodsEditMode ? periodsForm : (periodDefs || DEF_PERIOD_DEFS);
  const activeWeekdays = periodsEditMode ? weekdaysForm : (dayGroupWeekdays || DEF_DAY_GROUP_WEEKDAYS);
  const groupList = useMemo(
    () => sortDayGroups(Object.keys(activeDefs), activeWeekdays),
    [activeDefs, activeWeekdays]
  );
  function groupSlots(group) { return activeDefs[group] ?? []; }

  function fmtTime(t) { if (!t) return ""; const [h,m] = t.split(":"); return `${parseInt(h)}:${m}`; }
  function fmtSlotTime(slot) { return `${fmtTime(slot.startTime)} – ${fmtTime(slot.endTime)}`; }

  // ── Period management ──
  function startPeriodsEdit() {
    periodsBackup.current = JSON.parse(JSON.stringify(periodDefs || DEF_PERIOD_DEFS));
    setPeriodsForm(JSON.parse(JSON.stringify(periodDefs || DEF_PERIOD_DEFS)));
    setWeekdaysForm(JSON.parse(JSON.stringify(dayGroupWeekdays || DEF_DAY_GROUP_WEEKDAYS)));
    setGroupRenames({});
    setGroupDeletes(new Set());
    setPeriodsEditMode(true);
  }
  function cancelPeriodsEdit() {
    setPeriodsForm(periodsBackup.current);
    setGroupRenames({});
    setGroupDeletes(new Set());
    setPeriodsEditMode(false);
  }
  async function savePeriodsEdit() {
    // Cascade renames/deletes to saved timetable rows (every academic year,
    // not just the selected one - a schedule name change should stay
    // consistent everywhere) before the group names they reference stop
    // existing in period_defs.
    for (const [currentName, originalName] of Object.entries(groupRenames)) {
      if (currentName !== originalName) {
        await supabase.from("timetables").update({ day_group: currentName }).eq("day_group", originalName);
      }
    }
    for (const originalName of groupDeletes) {
      await supabase.from("timetables").delete().eq("day_group", originalName);
    }
    await savePeriodDefs(periodsForm);
    await saveDayGroupWeekdays(weekdaysForm);
    setPeriodDefsLocal(periodsForm);
    setDayGroupWeekdaysLocal(weekdaysForm);
    setGroupRenames({});
    setGroupDeletes(new Set());
    setPeriodsSaved(true);
    setPeriodsEditMode(false);
    if (selYear) loadTT(selYear); // renamed/deleted groups can change which saved rows exist
    setTimeout(() => setPeriodsSaved(false), 2500);
  }

  // originalNameOf: resolves a possibly-just-renamed-this-session group back
  // to the name it's actually saved under in `timetables`, so a rename then
  // a delete (or two renames in a row) in the same edit session still
  // cascades correctly against the real saved data.
  function originalNameOf(currentName) { return groupRenames[currentName] || currentName; }

  function addDayGroup() {
    const name = (window.prompt('New day group name (e.g. "Sunday" or "Special Week"):', "") || "").trim();
    if (!name) return;
    if (periodsForm[name]) { alert(`A day group named "${name}" already exists.`); return; }
    setPeriodsForm(prev => ({ ...prev, [name]: [{ id: "slot_" + Date.now(), label: "Period 1", startTime: "09:00", endTime: "09:45", isBreak: false }] }));
    setWeekdaysForm(prev => ({ ...prev, [name]: [] }));
    setActiveGroup(name);
  }

  function renameDayGroup(oldName) {
    const name = (window.prompt("Rename day group:", oldName) || "").trim();
    if (!name || name === oldName) return;
    if (periodsForm[name]) { alert(`A day group named "${name}" already exists.`); return; }
    const original = originalNameOf(oldName);
    setPeriodsForm(prev => {
      const { [oldName]: slots, ...rest } = prev;
      return { ...rest, [name]: slots };
    });
    setWeekdaysForm(prev => {
      const { [oldName]: days, ...rest } = prev;
      return { ...rest, [name]: days || [] };
    });
    setGroupRenames(prev => {
      const { [oldName]: _drop, ...rest } = prev;
      return { ...rest, [name]: original };
    });
    setActiveGroup(name);
  }

  function deleteDayGroup(name) {
    const typed = window.prompt(`This deletes "${name}" and ALL saved timetable entries under it, for every academic year. Type the group name to confirm:`);
    if (typed !== name) return;
    const original = originalNameOf(name);
    setPeriodsForm(prev => { const { [name]: _drop, ...rest } = prev; return rest; });
    setWeekdaysForm(prev => { const { [name]: _drop, ...rest } = prev; return rest; });
    setGroupRenames(prev => { const { [name]: _drop, ...rest } = prev; return rest; });
    setGroupDeletes(prev => new Set([...prev, original]));
    setActiveGroup(prev => prev === name ? (Object.keys(periodsForm).find(g => g !== name) || "") : prev);
  }

  // One group per weekday - selecting a weekday for `group` clears it from
  // whichever group had it before; clicking an already-assigned weekday on
  // its own group unassigns it (no school that day, same as Sunday already
  // implicitly is).
  function toggleGroupWeekday(group, day) {
    setWeekdaysForm(prev => {
      const next = {};
      for (const g of Object.keys(prev)) next[g] = (prev[g] || []).filter(d => d !== day);
      const wasOnThisGroup = (prev[group] || []).includes(day);
      if (!wasOnThisGroup) next[group] = [...(next[group] || []), day];
      return next;
    });
  }

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
    return ttData?.[selYear]?.[group]?.[slotId]?.[cls] ?? { subject:"", teacher:"", mergedWith:[] };
  }
  function setSlotVal(group, slotId, cls, key, value) {
    setTtData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ensure = (c) => {
        if (!next[selYear])                next[selYear]                = {};
        if (!next[selYear][group])         next[selYear][group]         = {};
        if (!next[selYear][group][slotId]) next[selYear][group][slotId] = {};
        if (!next[selYear][group][slotId][c]) next[selYear][group][slotId][c] = { subject:"", teacher:"", mergedWith:[] };
        return next[selYear][group][slotId][c];
      };
      const cell = ensure(cls);
      cell[key] = value;
      // Merged classes always share subject+teacher - propagate so a later
      // edit here can't silently drift the merge partners out of sync.
      if ((key === "subject" || key === "teacher") && cell.mergedWith?.length) {
        cell.mergedWith.forEach(partnerCls => { ensure(partnerCls)[key] = value; });
      }
      return next;
    });
  }
  // Toggles a merge link between `cls` and `partnerCls` at this exact
  // group+slot - merging copies cls's current subject/teacher onto the
  // partner and links both ways; un-merging drops the link both ways
  // without touching either class's own subject/teacher.
  function toggleMerge(group, slotId, cls, partnerCls) {
    setTtData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ensure = (c) => {
        if (!next[selYear])                next[selYear]                = {};
        if (!next[selYear][group])         next[selYear][group]         = {};
        if (!next[selYear][group][slotId]) next[selYear][group][slotId] = {};
        if (!next[selYear][group][slotId][c]) next[selYear][group][slotId][c] = { subject:"", teacher:"", mergedWith:[] };
        return next[selYear][group][slotId][c];
      };
      const cell = ensure(cls);
      const already = (cell.mergedWith || []).includes(partnerCls);
      const partner = ensure(partnerCls);
      if (already) {
        cell.mergedWith = (cell.mergedWith || []).filter(c => c !== partnerCls);
        partner.mergedWith = (partner.mergedWith || []).filter(c => c !== cls);
      } else {
        cell.mergedWith = [...new Set([...(cell.mergedWith || []), partnerCls])];
        partner.subject = cell.subject;
        partner.teacher = cell.teacher;
        partner.mergedWith = [...new Set([...(partner.mergedWith || []), cls])];
      }
      return next;
    });
  }
  // Classes actually merged with currentCls at this slot don't count as a
  // conflict - a real conflict is a DIFFERENT class that independently
  // already holds that teacher in the same slot.
  function getBusyTeachers(group, slotId, currentCls) {
    const busy = new Set();
    const mergedPartners = new Set(getSlot(group, slotId, currentCls).mergedWith || []);
    Object.entries(ttData?.[selYear]?.[group]?.[slotId] ?? {}).forEach(([cls, cell]) => {
      if (cls === currentCls || mergedPartners.has(cls)) return;
      if (cell?.teacher) busy.add(cell.teacher);
    });
    return busy;
  }
  function startEdit() { backupRef.current = JSON.parse(JSON.stringify(ttData)); setEditMode(true); setActiveCell(null); }
  function cancel()    { if (backupRef.current) setTtData(backupRef.current); setEditMode(false); setActiveCell(null); }
  async function save() {
    const rows = [];
    const yearData = ttData[selYear] || {};
    Object.entries(yearData).forEach(([group, slots]) => {
      Object.entries(slots).forEach(([slotId, classes]) => {
        Object.entries(classes).forEach(([cls, cell]) => {
          if (cell.subject || cell.teacher) {
            rows.push({
              academic_year: selYear, day_group: group, slot_id: slotId, class_name: cls,
              subject: cell.subject || "", teacher: cell.teacher || "",
              merged_with: cell.mergedWith?.length ? cell.mergedWith : null,
            });
          }
        });
      });
    });
    const { error: delErr } = await supabase.from("timetables").delete().eq("academic_year", selYear);
    if (delErr) {
      alert("Failed to save timetable: " + delErr.message);
      return;
    }
    if (rows.length) {
      const { error: insErr } = await supabase.from("timetables").insert(rows);
      if (insErr) {
        alert("Timetable was cleared but the new schedule failed to save: " + insErr.message + " — please try saving again.");
        return;
      }
    }
    setSaved(true); setEditMode(false); setActiveCell(null); setTimeout(() => setSaved(false), 2500);
  }
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
    groupList.forEach((group) => {
      const slots = groupSlots(group);
      doc.setFillColor(30,58,95);
      doc.setTextColor(255,255,255); doc.setFontSize(11);
      doc.rect(30, y, pw-60, 18, "F");
      doc.text(`  ${group}`, 34, y+13);
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
          if (cell?.teacher && teacherColorMap[cell.teacher]) {
            data.cell.styles.fillColor = teacherColorMap[cell.teacher].rgb;
            data.cell.styles.textColor = [40,40,40];
          }
        },
        margin: { left:30, right:30 },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 14;
      if (y > doc.internal.pageSize.height - 60 && group !== groupList[groupList.length-1]) { doc.addPage(); y = 30; }
    });
    doc.save(`Timetable_${selYear}.pdf`);
  }

  // ── Excel Export ──
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    // Excel sheet names: max 31 chars, and \/*?[]: are illegal - didn't
    // matter while groups were always "Mon – Wed"/"Thu – Fri"/"Saturday",
    // but a custom group name could now hit either limit.
    const usedSheetNames = new Set();
    function safeSheetName(name) {
      let safe = name.replace(/[\\/*?[\]:]/g, "").slice(0, 31) || "Group";
      let n = 2;
      while (usedSheetNames.has(safe)) { safe = `${name.slice(0, 28)} ${n++}`; }
      usedSheetNames.add(safe);
      return safe;
    }
    groupList.forEach(group => {
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
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(group));
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
            <button onClick={startPeriodsEdit} disabled={periodDefsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 disabled:opacity-50 transition-colors shadow-sm">
              <Pencil className="w-3.5 h-3.5"/> {periodDefsLoading ? "Loading…" : "Edit Schedule"}
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

        {/* Day group tab selector - fully custom: add/rename/delete groups,
            each with its own weekday assignment, not a fixed set of 3. */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {groupList.map(g => (
            <div key={g} className={`flex items-center rounded-lg ${activeGroup === g ? "bg-gray-100" : ""}`}>
              <button onClick={() => setActiveGroup(g)}
                className={`text-xs font-semibold py-1.5 px-2.5 rounded-lg transition-colors ${
                  activeGroup === g ? "bg-white text-school-navy shadow-sm m-0.5" : "text-gray-500 hover:text-gray-700"
                }`}>
                {g}
              </button>
              {periodsEditMode && (
                <>
                  <button onClick={() => renameDayGroup(g)} title="Rename" className="p-1 text-gray-400 hover:text-school-navy rounded transition-colors">
                    <Pencil className="w-3 h-3"/>
                  </button>
                  <button onClick={() => deleteDayGroup(g)} title="Delete" className="p-1 mr-0.5 text-gray-400 hover:text-red-600 rounded transition-colors">
                    <Trash2 className="w-3 h-3"/>
                  </button>
                </>
              )}
            </div>
          ))}
          {periodsEditMode && (
            <button onClick={addDayGroup}
              className="flex items-center gap-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg border-2 border-dashed border-school-navy/30 text-school-navy hover:border-school-navy hover:bg-school-navy/5 transition-colors">
              <Plus className="w-3 h-3"/> Add Day Group
            </button>
          )}
        </div>

        {periodsEditMode && activeGroup && (
          <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Weekdays using &quot;{activeGroup}&quot;</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(day => {
                const active = (weekdaysForm[activeGroup] || []).includes(day);
                return (
                  <button key={day} onClick={() => toggleGroupWeekday(activeGroup, day)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      active ? "bg-school-navy text-white border-school-navy" : "bg-white text-gray-500 border-gray-200 hover:border-school-navy/40"
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
              {yearList.map(y => <option key={y}>{y}</option>)}
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
              Click any cell to assign subject & teacher · Busy teachers are disabled · Use &quot;Merge With&quot; to put one teacher in two classes at once
            </p>
          </div>
        )}
      </div>

      {ttError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-xs text-red-700 font-semibold">Couldn&apos;t load the saved timetable</p>
            <p className="text-xs text-red-600 mt-0.5">{ttError}</p>
          </div>
        </div>
      )}

      {ttLoading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm font-medium">
          Loading timetable…
        </div>
      )}

      {/* ── One table per day group, stacked ── */}
      {!ttLoading && groupList.map(group => {
        const slots  = groupSlots(group);
        const colLen = activeColClasses.length;
        const groupDays = (activeWeekdays[group] || []).map(d => d.slice(0, 3)).join(", ");

        return (
          <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Group header */}
            <div className="bg-school-navy px-4 py-3 flex items-center gap-3">
              <LayoutGrid className="w-4 h-4 text-white/70 flex-shrink-0"/>
              <p className="text-white font-bold text-sm tracking-wide">
                {group}{groupDays ? `  ·  ${groupDays}` : ""}
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
                        {/* Sticky TIME column always fully opaque white - it
                            used to reuse rowBg, which is semi-transparent on
                            alternating rows (bg-gray-50/40), so scrolling the
                            table horizontally let the subject/teacher cells
                            underneath show through the sticky column instead
                            of being hidden behind it. */}
                        <td className="px-3 py-2 border-r border-gray-200 text-center sticky left-0 z-10 bg-white">
                          <p className="text-[10px] font-bold text-school-navy whitespace-nowrap">{fmtSlotTime(slot)}</p>
                        </td>
                        {activeColClasses.map(cls => {
                          const cell   = getSlot(group, slot.id, cls);
                          const active = isCellActive(group, slot.id, cls);
                          const busy   = active ? getBusyTeachers(group, slot.id, cls) : new Set();
                          const tColor = cell.teacher ? teacherColorMap[cell.teacher] : null;
                          const filled = cell.subject || cell.teacher;

                          return (
                            <td key={cls} className="px-1 py-1 border-r border-gray-100 last:border-r-0 align-top">
                              {active ? (
                                <div className="relative z-20 bg-white border-2 border-school-navy rounded-xl p-2 shadow-2xl space-y-1.5" style={{ minWidth:"120px" }}>
                                  <select autoFocus value={cell.subject}
                                    onChange={e => setSlotVal(group, slot.id, cls, "subject", e.target.value)}
                                    className="w-full text-[11px] border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-school-navy cursor-pointer bg-white">
                                    <option value="">— Subject —</option>
                                    {(classSubjectsMap[cls]?.length ? classSubjectsMap[cls] : SUBJECTS_TT).map(s => <option key={s}>{s}</option>)}
                                  </select>
                                  <select value={cell.teacher}
                                    onChange={e => setSlotVal(group, slot.id, cls, "teacher", e.target.value)}
                                    className="w-full text-[11px] border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-school-navy cursor-pointer bg-white">
                                    <option value="">— Teacher —</option>
                                    {teacherNames.map(t => (
                                      <option key={t} value={t} disabled={busy.has(t)}>
                                        {busy.has(t) ? `⚠ ${t} (busy)` : t}
                                      </option>
                                    ))}
                                  </select>
                                  {activeColClasses.length > 1 && (
                                    <div className="pt-1 border-t border-gray-100">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Merge With</p>
                                      <div className="flex flex-wrap gap-1">
                                        {activeColClasses.filter(c => c !== cls).map(partnerCls => {
                                          const merged = (cell.mergedWith || []).includes(partnerCls);
                                          return (
                                            <button key={partnerCls} type="button"
                                              onClick={() => toggleMerge(group, slot.id, cls, partnerCls)}
                                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold border transition-colors ${
                                                merged ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-500 border-gray-200 hover:border-purple-300"
                                              }`}>
                                              {partnerCls}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
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
                                      ? `border ${editMode ? "hover:opacity-75 hover:ring-2 hover:ring-school-navy/30" : ""}`
                                      : editMode
                                        ? "min-h-[44px] border-2 border-dashed border-gray-200 hover:border-school-navy/50 hover:bg-school-navy/5 flex items-center justify-center"
                                        : "min-h-[44px]"
                                  }`}
                                  style={filled ? { backgroundColor: tColor?.bg || "#f3f4f6", borderColor: tColor?.border || "#e5e7eb" } : undefined}
                                >
                                  {filled ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <p className="text-[11px] font-bold leading-tight truncate flex-1" style={{ color: tColor?.text || "#1f2937" }}>{cell.subject}</p>
                                        {cell.mergedWith?.length > 0 && (
                                          <Link2 className="w-2.5 h-2.5 flex-shrink-0" style={{ color: tColor?.text || "#6b7280" }}
                                            title={`Merged with ${cell.mergedWith.join(", ")}`}/>
                                        )}
                                      </div>
                                      {cell.teacher && (
                                        <p className="text-[10px] mt-0.5 leading-tight opacity-80 truncate" style={{ color: tColor?.text || "#6b7280" }}>{shortName(cell.teacher)}</p>
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
          {teacherNames.map((t) => {
            const c = teacherColorMap[t];
            return (
              <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                style={{ backgroundColor: c?.bg, color: c?.text, borderColor: c?.border }}>
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
  { key:"subjects",   label:"Subjects",           icon:Layers       },
  { key:"exams",      label:"Exams",              icon:Award        },
  { key:"timetable",  label:"Timetable",          icon:LayoutGrid   },
  { key:"planning",   label:"Year Planning",      icon:CalendarRange},
  { key:"reminders",  label:"Fee Reminders",      icon:MessageSquare},
  { key:"users",      label:"Users & Roles",      icon:Users        },
  { key:"rules",      label:"Rules & Regulations",icon:ScrollText   },
  { key:"appupdate",  label:"App Update",         icon:Smartphone   },
];

export default function SettingsPage() {
  const authUser = useStore(s => s.authUser);
  const [tab, setTab] = useState("school");

  if (!authUser) return null;
  if (authUser.role === "normal_admin") return (
    <div className="flex items-center justify-center h-64"><p className="text-gray-500">You do not have access to this section.</p></div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">School configuration, academic year, fee structure & user management</p>
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
      {tab === "subjects"   && <SubjectsTab/>}
      {tab === "exams"      && <ExamsTab/>}
      {tab === "timetable"  && <TimetableTab/>}
      {tab === "planning"   && <YearPlanningTab/>}
      {tab === "reminders"  && <FeeReminderTab/>}
      {tab === "users"      && <UsersRolesTab/>}
      {tab === "rules"      && <RulesRegulationsTab/>}
      {tab === "appupdate"  && <AppUpdateTab/>}
    </div>
  );
}
