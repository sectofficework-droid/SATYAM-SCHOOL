"use client";

import { useState } from "react";
import {
  ShieldCheck, Crown, Shield, LogOut, Eye, EyeOff,
  Camera, Calendar, CreditCard, MapPin, User, Tag,
  AlertCircle, CheckCircle2, ArrowDown, Save,
  Search, RefreshCw, ChevronRight, Users, Check,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES = [
  "JR KG", "SR KG", "Balvatika",
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
  "11th Commerce", "12th Commerce",
];
const CATEGORIES = ["General", "OBC", "SC", "ST", "Jain", "Other"];

const MGMT_USERS = [
  { name: "Sunil Pradhan",  password: "sunil123",  initials: "SP" },
  { name: "Rajesh Pradhan", password: "rajesh123", initials: "RP" },
];
const SENIOR_USERS = [
  { name: "Meena Shah",  password: "meena123", initials: "MS" },
  { name: "Kiran Joshi", password: "kiran123", initials: "KJ" },
];

const BULK_FIELDS = [
  { key: "photo",      label: "Profile Photo",  icon: Camera,     type: "photo"  },
  { key: "firstName",  label: "First Name",     icon: User,       type: "text"   },
  { key: "lastName",   label: "Last Name",      icon: User,       type: "text"   },
  { key: "dob",        label: "Date of Birth",  icon: Calendar,   type: "date"   },
  { key: "aadhar",     label: "Aadhar No",      icon: CreditCard, type: "aadhar" },
  { key: "pan",        label: "PAN No",         icon: CreditCard, type: "text"   },
  { key: "fatherName", label: "Father&apos;s Name", icon: User,   type: "text"   },
  { key: "motherName", label: "Mother&apos;s Name", icon: User,   type: "text"   },
  { key: "address",    label: "Address",        icon: MapPin,     type: "text"   },
  { key: "category",   label: "Category/Caste", icon: Tag,        type: "select" },
];

// ── Dummy Students ────────────────────────────────────────────────────────────
const DUMMY_STUDENTS = [
  { id:  1, enrollNo: "SS-0001", firstName: "Arjun",   lastName: "Patel",   cls: "JR KG",         section: "A", dob: "2021-04-10", aadhar: "",               pan: "",           fatherName: "Amit",    motherName: "Rina",    address: "Varachha, Surat",  category: "General", photo: null },
  { id:  2, enrollNo: "SS-0002", firstName: "Diya",    lastName: "Shah",    cls: "SR KG",         section: "A", dob: "2020-07-22", aadhar: "",               pan: "",           fatherName: "Rahul",   motherName: "Priya",   address: "Adajan, Surat",    category: "General", photo: null },
  { id:  3, enrollNo: "SS-0003", firstName: "Vivaan",  lastName: "Mehta",   cls: "Balvatika",     section: "A", dob: "2019-09-15", aadhar: "",               pan: "",           fatherName: "Sanjay",  motherName: "Neha",    address: "Katargam, Surat",  category: "OBC",     photo: null },
  { id:  4, enrollNo: "SS-0004", firstName: "Anaya",   lastName: "Desai",   cls: "1st",           section: "A", dob: "2018-12-05", aadhar: "1234 5678 9012", pan: "",           fatherName: "Vishal",  motherName: "Kavita",  address: "Piplod, Surat",    category: "General", photo: null },
  { id:  5, enrollNo: "SS-0005", firstName: "Rohan",   lastName: "Joshi",   cls: "2nd",           section: "B", dob: "2017-05-18", aadhar: "",               pan: "",           fatherName: "Prakash", motherName: "Sunita",  address: "Majura, Surat",    category: "SC",      photo: null },
  { id:  6, enrollNo: "SS-0006", firstName: "Ishaan",  lastName: "Trivedi", cls: "3rd",           section: "A", dob: "2016-08-30", aadhar: "2345 6789 0123", pan: "",           fatherName: "Mahesh",  motherName: "Geeta",   address: "Citylight, Surat", category: "General", photo: null },
  { id:  7, enrollNo: "SS-0007", firstName: "Priya",   lastName: "Verma",   cls: "4th",           section: "A", dob: "2015-11-12", aadhar: "",               pan: "",           fatherName: "Suresh",  motherName: "Anita",   address: "Vesu, Surat",      category: "OBC",     photo: null },
  { id:  8, enrollNo: "SS-0008", firstName: "Aditya",  lastName: "Rao",     cls: "5th",           section: "B", dob: "2014-02-25", aadhar: "3456 7890 1234", pan: "",           fatherName: "Ramesh",  motherName: "Lakshmi", address: "Pal, Surat",       category: "General", photo: null },
  { id:  9, enrollNo: "SS-0009", firstName: "Sneha",   lastName: "Gupta",   cls: "6th",           section: "A", dob: "2013-06-08", aadhar: "",               pan: "",           fatherName: "Vinod",   motherName: "Meena",   address: "Athwa, Surat",     category: "General", photo: null },
  { id: 10, enrollNo: "SS-0010", firstName: "Karan",   lastName: "Nair",    cls: "7th",           section: "C", dob: "2012-09-20", aadhar: "4567 8901 2345", pan: "",           fatherName: "Krishna", motherName: "Radha",   address: "Bhatar, Surat",    category: "OBC",     photo: null },
  { id: 11, enrollNo: "SS-0011", firstName: "Pooja",   lastName: "Singh",   cls: "8th",           section: "A", dob: "2011-03-14", aadhar: "",               pan: "",           fatherName: "Arvind",  motherName: "Sonia",   address: "Rander, Surat",    category: "SC",      photo: null },
  { id: 12, enrollNo: "SS-0012", firstName: "Rahul",   lastName: "Kumar",   cls: "9th",           section: "B", dob: "2010-07-30", aadhar: "5678 9012 3456", pan: "ABCPK1234D", fatherName: "Deepak",  motherName: "Rekha",   address: "Udhna, Surat",     category: "General", photo: null },
  { id: 13, enrollNo: "SS-0013", firstName: "Anjali",  lastName: "Mishra",  cls: "10th",          section: "A", dob: "2009-11-05", aadhar: "6789 0123 4567", pan: "BCDPM5678E", fatherName: "Rajan",   motherName: "Usha",    address: "Dumas, Surat",     category: "General", photo: null },
  { id: 14, enrollNo: "SS-0014", firstName: "Varun",   lastName: "Pillai",  cls: "11th Commerce", section: "A", dob: "2008-04-18", aadhar: "7890 1234 5678", pan: "CDEQV6789F", fatherName: "Vijay",   motherName: "Latha",   address: "Adajan, Surat",    category: "OBC",     photo: null },
  { id: 15, enrollNo: "SS-0015", firstName: "Neha",    lastName: "Pandey",  cls: "12th Commerce", section: "A", dob: "2007-08-22", aadhar: "8901 2345 6789", pan: "DEFQN7890G", fatherName: "Ravi",    motherName: "Sarita",  address: "Piplod, Surat",    category: "General", photo: null },
  { id: 16, enrollNo: "SS-0016", firstName: "Dev",     lastName: "Agarwal", cls: "10th",          section: "B", dob: "2009-05-10", aadhar: "",               pan: "",           fatherName: "Anil",    motherName: "Manju",   address: "Katargam, Surat",  category: "General", photo: null },
  { id: 17, enrollNo: "SS-0017", firstName: "Riya",    lastName: "Bhat",    cls: "9th",           section: "A", dob: "2010-02-14", aadhar: "",               pan: "",           fatherName: "Mohan",   motherName: "Savita",  address: "Varachha, Surat",  category: "SC",      photo: null },
  { id: 18, enrollNo: "SS-0018", firstName: "Aryan",   lastName: "Jain",    cls: "8th",           section: "B", dob: "2011-10-28", aadhar: "",               pan: "",           fatherName: "Dinesh",  motherName: "Seema",   address: "Majura, Surat",    category: "Jain",    photo: null },
  { id: 19, enrollNo: "SS-0019", firstName: "Sia",     lastName: "Kapoor",  cls: "5th",           section: "A", dob: "2014-07-03", aadhar: "",               pan: "",           fatherName: "Rakesh",  motherName: "Pooja",   address: "Citylight, Surat", category: "General", photo: null },
  { id: 20, enrollNo: "SS-0020", firstName: "Harsh",   lastName: "Chawla",  cls: "7th",           section: "A", dob: "2012-12-19", aadhar: "",               pan: "",           fatherName: "Naresh",  motherName: "Parvati", address: "Vesu, Surat",      category: "OBC",     photo: null },
  { id: 21, enrollNo: "SS-0021", firstName: "Tara",    lastName: "Menon",   cls: "6th",           section: "B", dob: "2013-03-27", aadhar: "",               pan: "",           fatherName: "Suresh",  motherName: "Geetha",  address: "Pal, Surat",       category: "General", photo: null },
  { id: 22, enrollNo: "SS-0022", firstName: "Yash",    lastName: "Patil",   cls: "4th",           section: "B", dob: "2015-08-11", aadhar: "",               pan: "",           fatherName: "Ganesh",  motherName: "Lalita",  address: "Athwa, Surat",     category: "OBC",     photo: null },
  { id: 23, enrollNo: "SS-0023", firstName: "Kriti",   lastName: "Sharma",  cls: "3rd",           section: "B", dob: "2016-01-04", aadhar: "",               pan: "",           fatherName: "Bharat",  motherName: "Divya",   address: "Bhatar, Surat",    category: "General", photo: null },
  { id: 24, enrollNo: "SS-0024", firstName: "Aarav",   lastName: "Yadav",   cls: "2nd",           section: "A", dob: "2017-11-16", aadhar: "",               pan: "",           fatherName: "Hemant",  motherName: "Kanchan", address: "Rander, Surat",    category: "ST",      photo: null },
  { id: 25, enrollNo: "SS-0025", firstName: "Mishka",  lastName: "Soni",    cls: "1st",           section: "B", dob: "2018-06-29", aadhar: "",               pan: "",           fatherName: "Ajay",    motherName: "Aarti",   address: "Udhna, Surat",     category: "General", photo: null },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAadhar(val) {
  const d = val.replace(/\D/g, "").slice(0, 12);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

// ── Login View ────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
  const [role, setRole]       = useState(null);
  const [name, setName]       = useState("");
  const [pwd, setPwd]         = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const users = role === "management" ? MGMT_USERS : SENIOR_USERS;

  const selectRole = (r) => { setRole(r); setName(""); setPwd(""); setError(""); };

  const handleLogin = () => {
    if (!name || !pwd) { setError("Please select name and enter password."); return; }
    const user = users.find((u) => u.name === name && u.password === pwd);
    if (!user) { setError("Incorrect password. Please try again."); return; }
    setLoading(true);
    setTimeout(() => onLogin({ ...user, role }), 700);
  };

  const roles = [
    {
      key: "management",
      title: "Management Head",
      desc: "Full system access — student, fees, inventory & staff management",
      icon: Crown,
      gradient: "from-amber-500 to-amber-600",
      selectedBorder: "border-amber-500",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      badge: "bg-amber-50 text-amber-700",
      members: MGMT_USERS,
    },
    {
      key: "senior",
      title: "Senior Admin",
      desc: "Protected student field access — name, DOB, govt IDs & bulk updates",
      icon: Shield,
      gradient: "from-blue-500 to-blue-700",
      selectedBorder: "border-blue-500",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      badge: "bg-blue-50 text-blue-700",
      members: SENIOR_USERS,
    },
  ];

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-school-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Super Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Select your role to continue</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-6">
        {roles.map(({ key, title, desc, icon: Icon, gradient, selectedBorder, iconBg, iconColor, badge, members }) => {
          const isSelected = role === key;
          return (
            <button key={key} onClick={() => selectRole(key)}
              className={`text-left p-6 rounded-2xl border-2 transition-all shadow-sm ${
                isSelected
                  ? `${selectedBorder} bg-gradient-to-br ${gradient} shadow-lg`
                  : "border-gray-200 bg-white hover:shadow-md hover:border-gray-300"
              }`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${isSelected ? "bg-white/20" : iconBg}`}>
                <Icon className={`w-6 h-6 ${isSelected ? "text-white" : iconColor}`} />
              </div>
              <h3 className={`font-bold text-base ${isSelected ? "text-white" : "text-gray-800"}`}>{title}</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isSelected ? "text-white/75" : "text-gray-500"}`}>{desc}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {members.map((u) => (
                  <span key={u.name} className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isSelected ? "bg-white/20 text-white" : badge}`}>
                    {u.name}
                  </span>
                ))}
              </div>
              {isSelected && (
                <div className="flex items-center gap-1 mt-3 text-white/80">
                  <Check className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Selected</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Credential form */}
      {role && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full max-w-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            {role === "management" ? "Management Head" : "Senior Admin"} Login
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name *</label>
              <select value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors">
                <option value="">Select your name</option>
                {users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => { setPwd(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full px-3.5 pr-11 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
                />
                <button onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </p>
            )}
            <button onClick={handleLogin} disabled={loading}
              className="w-full py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Sign In Securely</>
              )}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-4">
            Demo passwords — {role === "management" ? "sunil123 · rajesh123" : "meena123 · kiran123"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Bulk Update Tool ──────────────────────────────────────────────────────────
function BulkUpdateTool({ allStudents }) {
  const [step, setStep]                     = useState(1);
  const [scopeType, setScopeType]           = useState(null);
  const [selectedClass, setSelectedClass]   = useState("");
  const [selectedFields, setSelectedFields] = useState([]);
  const [tableData, setTableData]           = useState([]);
  const [batchValues, setBatchValues]       = useState({});
  const [saveStatus, setSaveStatus]         = useState(null);
  const [search, setSearch]                 = useState("");

  const scopedStudents = scopeType === "all"
    ? allStudents
    : allStudents.filter((s) => s.cls === selectedClass);

  const displayStudents = search
    ? tableData.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        s.enrollNo.toLowerCase().includes(search.toLowerCase())
      )
    : tableData;

  const selectedFieldConfigs = BULK_FIELDS.filter((f) => selectedFields.includes(f.key));

  const goStep2 = () => {
    if (!scopeType || (scopeType === "class" && !selectedClass)) return;
    setStep(2);
    setSelectedFields([]);
  };

  const goStep3 = () => {
    if (!selectedFields.length) return;
    setTableData(scopedStudents.map((s) => ({ ...s })));
    setBatchValues({});
    setSearch("");
    setStep(3);
  };

  const toggleField = (key) =>
    setSelectedFields((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const updateCell = (id, key, value) =>
    setTableData((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r));

  const applyToAll = (key) => {
    const val = batchValues[key] ?? "";
    setTableData((prev) => prev.map((r) => ({ ...r, [key]: val })));
  };

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 2500); }, 900);
  };

  const reset = () => {
    setStep(1); setScopeType(null); setSelectedClass(""); setSelectedFields([]);
    setTableData([]); setSearch(""); setSaveStatus(null);
  };

  const STEPS = [
    { n: 1, label: "Select Scope" },
    { n: 2, label: "Select Fields" },
    { n: 3, label: "Update Records" },
  ];

  return (
    <div className="space-y-5">

      {/* Step indicator */}
      <div className="flex items-start">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                step > s.n  ? "bg-green-500 border-green-500 text-white"
                : step === s.n ? "bg-school-navy border-school-navy text-white"
                : "bg-white border-gray-200 text-gray-400"
              }`}>
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <p className={`text-[11px] font-semibold mt-1.5 text-center ${
                step === s.n ? "text-school-navy" : step > s.n ? "text-green-600" : "text-gray-400"
              }`}>{s.label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-2 ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Scope ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Select Student Scope</h3>
          <p className="text-xs text-gray-500 mb-5">Choose which students to include in the update</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {[
              { key: "all",   label: "All Students", desc: `${allStudents.length} students across all classes`, icon: Users },
              { key: "class", label: "By Class",     desc: "Select a specific class",                           icon: Search },
            ].map(({ key, label, desc, icon: Icon }) => (
              <button key={key} onClick={() => { setScopeType(key); if (key === "all") setSelectedClass(""); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  scopeType === key ? "border-school-navy bg-school-navy/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${scopeType === key ? "bg-school-navy" : "bg-gray-100"}`}>
                  <Icon className={`w-5 h-5 ${scopeType === key ? "text-white" : "text-gray-500"}`} />
                </div>
                <div className="text-left flex-1">
                  <p className={`text-sm font-bold ${scopeType === key ? "text-school-navy" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                {scopeType === key && <Check className="w-4 h-4 text-school-navy flex-shrink-0" />}
              </button>
            ))}
          </div>

          {scopeType === "class" && (
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Class *</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full max-w-xs px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors">
                <option value="">Choose class...</option>
                {CLASSES.map((c) => {
                  const count = allStudents.filter((s) => s.cls === c).length;
                  return <option key={c} value={c}>{c} — {count} student{count !== 1 ? "s" : ""}</option>;
                })}
              </select>
            </div>
          )}

          {(scopeType === "all" || (scopeType === "class" && selectedClass)) && (
            <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                <span className="font-bold">{scopedStudents.length} student{scopedStudents.length !== 1 ? "s" : ""}</span> will be included
                {selectedClass && <> from <span className="font-semibold">{selectedClass}</span></>}
              </p>
            </div>
          )}

          <button onClick={goStep2}
            disabled={!scopeType || (scopeType === "class" && !selectedClass)}
            className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm">
            Next: Select Fields <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 2: Field Selection ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-800">Select Fields to Update</h3>
            <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Pick one or more fields — you can update single or multiple fields at once for all {scopedStudents.length} students
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {BULK_FIELDS.map(({ key, label, icon: Icon }) => {
              const active = selectedFields.includes(key);
              return (
                <button key={key} onClick={() => toggleField(key)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    active ? "border-school-navy bg-school-navy/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}>
                  {active && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-school-navy rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-school-navy" : "bg-gray-100"}`}>
                    <Icon className={`w-5 h-5 ${active ? "text-white" : "text-gray-500"}`} />
                  </div>
                  <p className={`text-[11px] font-semibold text-center leading-tight ${active ? "text-school-navy" : "text-gray-600"}`}>{label}</p>
                </button>
              );
            })}
          </div>

          {selectedFields.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-school-navy text-white text-xs font-bold rounded-full">{selectedFields.length}</span>
              <span className="text-xs text-gray-600">field{selectedFields.length !== 1 ? "s" : ""} selected</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button onClick={goStep3} disabled={selectedFields.length === 0}
              className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm">
              Open Update Table <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Update Table ── */}
      {step === 3 && (
        <div className="space-y-4">

          {/* Controls bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {tableData.length} student{tableData.length !== 1 ? "s" : ""}
                  {selectedClass && <> · <span className="text-school-navy">{selectedClass}</span></>}
                  {" · "}{selectedFields.length} field{selectedFields.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Edit cells directly · use Batch Fill to apply one value to all rows</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Start Over
                </button>
                <button onClick={handleSave}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                    saveStatus === "saved"
                      ? "bg-green-600 text-white"
                      : "bg-school-navy hover:bg-school-navy-dark text-white"
                  }`}>
                  {saveStatus === "saving" ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  ) : saveStatus === "saved" ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> Save Changes</>
                  )}
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
                placeholder="Search by name or enroll no..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Batch Fill */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ArrowDown className="w-3.5 h-3.5" /> Batch Fill — Apply Same Value to All Rows
            </p>
            <div className="flex flex-wrap gap-3">
              {selectedFieldConfigs.filter((f) => f.type !== "photo").map((f) => (
                <div key={f.key} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                  <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap flex-shrink-0">{f.label}:</span>
                  {f.type === "select" ? (
                    <select value={batchValues[f.key] || ""}
                      onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="text-xs border-0 outline-none bg-transparent text-gray-800 min-w-[90px]">
                      <option value="">Pick...</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : f.type === "aadhar" ? (
                    <input
                      className="text-xs border-0 outline-none bg-transparent text-gray-800 w-[120px] tracking-widest font-mono"
                      placeholder="XXXX XXXX XXXX" maxLength={14}
                      value={batchValues[f.key] || ""}
                      onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: fmtAadhar(e.target.value) }))}
                    />
                  ) : (
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      className="text-xs border-0 outline-none bg-transparent text-gray-800 w-[110px]"
                      placeholder="Enter value..."
                      value={batchValues[f.key] || ""}
                      onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                  <button onClick={() => applyToAll(f.key)}
                    className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap flex-shrink-0">
                    <ArrowDown className="w-2.5 h-2.5" /> All
                  </button>
                </div>
              ))}
              {selectedFieldConfigs.every((f) => f.type === "photo") && (
                <p className="text-xs text-amber-600 italic">Batch fill not applicable for Profile Photo — upload individually in the table below.</p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[520px]">
              <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="sticky left-0 z-30 bg-gray-50 text-left px-4 py-3 text-[11px] font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap" style={{ minWidth: 96 }}>
                      Enroll No
                    </th>
                    <th className="sticky bg-gray-50 z-30 text-left px-4 py-3 text-[11px] font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap" style={{ left: 96, minWidth: 160 }}>
                      Student Name
                    </th>
                    <th className="bg-gray-50 text-left px-3 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: 100 }}>
                      Class
                    </th>
                    {selectedFieldConfigs.map((f) => (
                      <th key={f.key} className="bg-gray-50 text-left px-3 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth: f.type === "aadhar" ? 150 : f.type === "date" ? 140 : f.key === "address" ? 180 : 140 }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayStudents.length === 0 && (
                    <tr>
                      <td colSpan={3 + selectedFieldConfigs.length} className="text-center py-10 text-gray-400">
                        No students found
                      </td>
                    </tr>
                  )}
                  {displayStudents.map((student, i) => {
                    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                    return (
                      <tr key={student.id} className="hover:bg-blue-50/40 transition-colors border-b border-gray-50">
                        <td className="sticky left-0 z-10 px-4 py-3 border-r border-gray-100 whitespace-nowrap" style={{ backgroundColor: bg, minWidth: 96 }}>
                          <span className="font-mono text-gray-500">{student.enrollNo}</span>
                        </td>
                        <td className="sticky z-10 px-4 py-3 border-r border-gray-100 whitespace-nowrap" style={{ left: 96, backgroundColor: bg, minWidth: 160 }}>
                          <p className="font-semibold text-gray-800">{student.firstName} {student.lastName}</p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ minWidth: 100 }}>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full">{student.cls}</span>
                        </td>
                        {selectedFieldConfigs.map((f) => (
                          <td key={f.key} className="px-3 py-2.5">
                            {f.type === "photo" ? (
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                                  {student.photo
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={student.photo} alt="" className="w-full h-full object-cover" />
                                    : <Camera className="w-3.5 h-3.5 text-gray-400" />}
                                </div>
                                <span className="text-[11px] text-school-navy font-semibold group-hover:underline">Upload</span>
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) updateCell(student.id, "photo", URL.createObjectURL(file));
                                  }} />
                              </label>
                            ) : f.type === "select" ? (
                              <select value={student[f.key] || "General"}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white">
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : f.type === "aadhar" ? (
                              <input type="text" maxLength={14}
                                value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, fmtAadhar(e.target.value))}
                                placeholder="XXXX XXXX XXXX"
                                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors tracking-widest font-mono w-[138px]"
                              />
                            ) : f.type === "date" ? (
                              <input type="date"
                                value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
                              />
                            ) : (
                              <input type="text"
                                value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                                className={`px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors ${f.key === "address" ? "w-[168px]" : "w-[130px]"}`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {displayStudents.length > 0 && (
              <div className="px-5 py-2.5 border-t border-gray-50 flex items-center justify-between">
                <p className="text-[11px] text-gray-400">{displayStudents.length} student{displayStudents.length !== 1 ? "s" : ""} shown</p>
                <button onClick={handleSave}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    saveStatus === "saved" ? "bg-green-600 text-white" : "bg-school-navy hover:bg-school-navy-dark text-white"
                  }`}>
                  {saveStatus === "saved" ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [students]                    = useState(DUMMY_STUDENTS);

  const handleLogin  = (user) => { setLoggedIn(true); setCurrentUser(user); };
  const handleLogout = ()     => { setLoggedIn(false); setCurrentUser(null); };

  if (!loggedIn) return <LoginView onLogin={handleLogin} />;

  const isMgmt   = currentUser.role === "management";
  const RoleIcon = isMgmt ? Crown : Shield;

  return (
    <div className="space-y-5">

      {/* Session header */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-2xl shadow-md ${
        isMgmt
          ? "bg-gradient-to-r from-amber-500 to-amber-600"
          : "bg-gradient-to-r from-blue-600 to-blue-700"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <RoleIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{currentUser.name}</p>
            <p className="text-white/65 text-xs">
              {isMgmt ? "Management Head" : "Senior Admin"} · Super Admin Panel
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors border border-white/20">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Page title */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Bulk Update</h2>
          <p className="text-sm text-gray-500 mt-0.5">Update student records individually or all at once</p>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
          isMgmt ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
        }`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          {isMgmt ? "Management Head" : "Senior Admin"}
        </span>
      </div>

      {/* Bulk update wizard */}
      <BulkUpdateTool allStudents={students} />
    </div>
  );
}
