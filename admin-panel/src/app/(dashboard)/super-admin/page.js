"use client";

import { useState } from "react";
import {
  ShieldCheck, Crown, Shield, LogOut, Eye, EyeOff,
  Camera, Calendar, CreditCard, MapPin, User, Tag,
  AlertCircle, CheckCircle2, Save, Search, RefreshCw,
  ChevronRight, Users, Check, Phone, Hash, GraduationCap,
  IndianRupee, Package, Pencil, X, Plus, ChevronDown,
  ChevronUp, BookOpen, Briefcase, History, Trash2,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASSES = [
  "JR KG","SR KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th Commerce","12th Commerce",
];
const GENDERS   = ["Male","Female","Other"];
const RELIGIONS = ["Hindu","Muslim","Christian","Jain","Sikh","Buddhist","Parsi","Other"];
const CASTES    = ["General","OBC","SC","ST","EWS","SEBC","Other"];
const MEDIUMS   = ["English","Gujarati","Hindi","Other"];
const PREV_CLS  = ["Nursery / KG","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"];

const MGMT_USERS   = [{ name:"Sunil Pradhan",  password:"sunil123",  initials:"SP" },{ name:"Rajesh Pradhan",password:"rajesh123",initials:"RP" }];
const SENIOR_USERS = [{ name:"Meena Shah",     password:"meena123",  initials:"MS" },{ name:"Kiran Joshi",  password:"kiran123", initials:"KJ" }];

// All student fields matching Add Student form (no discount)
const FIELD_GROUPS = [
  { group:"Admission", fields:[
    { key:"joinDate",        label:"Date of Join",    icon:Calendar,      type:"date"   },
    { key:"grNo",            label:"GR Number",       icon:Hash,          type:"text"   },
    { key:"cls",             label:"Class",           icon:GraduationCap, type:"select", options:CLASSES },
  ]},
  { group:"Personal", fields:[
    { key:"firstName",       label:"First Name",      icon:User,          type:"text"   },
    { key:"lastName",        label:"Last Name",       icon:User,          type:"text"   },
    { key:"fatherName",      label:"Father's Name",   icon:User,          type:"text"   },
    { key:"motherName",      label:"Mother's Name",   icon:User,          type:"text"   },
    { key:"dob",             label:"Date of Birth",   icon:Calendar,      type:"date"   },
    { key:"gender",          label:"Gender",          icon:User,          type:"select", options:GENDERS   },
    { key:"religion",        label:"Religion",        icon:Tag,           type:"select", options:RELIGIONS },
    { key:"caste",           label:"Category/Caste",  icon:Tag,           type:"select", options:CASTES    },
  ]},
  { group:"Contact", fields:[
    { key:"roomPlotNo",      label:"Room / Plot No",  icon:MapPin,        type:"text"   },
    { key:"address",         label:"Full Address",    icon:MapPin,        type:"text"   },
    { key:"mobile1",         label:"Mobile 1",        icon:Phone,         type:"text"   },
    { key:"mobile2",         label:"Mobile 2",        icon:Phone,         type:"text"   },
  ]},
  { group:"Birth", fields:[
    { key:"placeOfBirth",    label:"Place of Birth",  icon:MapPin,        type:"text"   },
  ]},
  { group:"Previous School", fields:[
    { key:"lastSchoolName",  label:"School Name",     icon:GraduationCap, type:"text"   },
    { key:"lastSchoolClass", label:"Last Class",      icon:GraduationCap, type:"select", options:PREV_CLS },
    { key:"lastSchoolMedium",label:"Medium",          icon:BookOpen,      type:"select", options:MEDIUMS   },
    { key:"lastSchoolPlace", label:"School Location", icon:MapPin,        type:"text"   },
  ]},
  { group:"Aadhar", fields:[
    { key:"aadharNo",        label:"Aadhar Number",   icon:CreditCard,    type:"text"   },
    { key:"aadharName",      label:"Name on Aadhar",  icon:User,          type:"text"   },
  ]},
  { group:"Govt IDs", fields:[
    { key:"udise",           label:"UDISE Number",    icon:Hash,          type:"text"   },
    { key:"pen",             label:"PEN Number",      icon:Hash,          type:"text"   },
    { key:"apaar",           label:"APAAR ID",        icon:Hash,          type:"text"   },
  ]},
];

const ALL_FIELDS = FIELD_GROUPS.flatMap(g => g.fields);

const GROUP_STYLES = {
  "Admission":       { activeCls:"bg-indigo-500 border-indigo-500",  iconBg:"bg-indigo-100",  iconColor:"text-indigo-500"  },
  "Personal":        { activeCls:"bg-blue-500 border-blue-500",      iconBg:"bg-blue-100",    iconColor:"text-blue-500"    },
  "Contact":         { activeCls:"bg-emerald-500 border-emerald-500",iconBg:"bg-emerald-100", iconColor:"text-emerald-500" },
  "Birth":           { activeCls:"bg-orange-500 border-orange-500",  iconBg:"bg-orange-100",  iconColor:"text-orange-500"  },
  "Previous School": { activeCls:"bg-teal-500 border-teal-500",      iconBg:"bg-teal-100",    iconColor:"text-teal-500"    },
  "Aadhar":          { activeCls:"bg-rose-500 border-rose-500",      iconBg:"bg-rose-100",    iconColor:"text-rose-500"    },
  "Govt IDs":        { activeCls:"bg-purple-500 border-purple-500",  iconBg:"bg-purple-100",  iconColor:"text-purple-500"  },
};

const MODULE_THEMES = {
  students:  { tabBg:"bg-blue-600",   tabActive:"bg-blue-600 text-white",   banner:"bg-gradient-to-r from-blue-600 to-blue-700",   ring:"focus:ring-blue-400"  },
  fees:      { tabBg:"bg-emerald-600",tabActive:"bg-emerald-600 text-white",banner:"bg-gradient-to-r from-emerald-600 to-teal-700", ring:"focus:ring-emerald-400"},
  inventory: { tabBg:"bg-amber-500",  tabActive:"bg-amber-500 text-white",  banner:"bg-gradient-to-r from-amber-500 to-orange-600", ring:"focus:ring-amber-400"  },
  employee:  { tabBg:"bg-purple-600", tabActive:"bg-purple-600 text-white", banner:"bg-gradient-to-r from-purple-600 to-violet-700",ring:"focus:ring-purple-400" },
};

const MGMT_MODULES = [
  { key:"students",  label:"Student Records",  icon:GraduationCap, stats:["25 Students","15 Classes","All Active"]          },
  { key:"fees",      label:"Fees Management",  icon:IndianRupee,   stats:["₹3.2L Collected","₹48K Pending","15 Records"]    },
  { key:"inventory", label:"Inventory",        icon:Package,       stats:["8 Assets","6 Item Types","₹2.4L Value"]          },
  { key:"employee",  label:"Employee",         icon:Users,         stats:["12 Staff","8 Teachers","4 Support"]              },
];

const FEES_STRUCTURE = [
  { cls:"JR KG",         totalFee:16200 },{ cls:"SR KG",         totalFee:16200 },
  { cls:"Balvatika",     totalFee:17000 },{ cls:"1st",           totalFee:18000 },
  { cls:"2nd",           totalFee:18200 },{ cls:"3rd",           totalFee:18500 },
  { cls:"4th",           totalFee:18800 },{ cls:"5th",           totalFee:19500 },
  { cls:"6th",           totalFee:20000 },{ cls:"7th",           totalFee:20000 },
  { cls:"8th",           totalFee:21300 },{ cls:"9th",           totalFee:21800 },
  { cls:"10th",          totalFee:22500 },{ cls:"11th Commerce", totalFee:23500 },
  { cls:"12th Commerce", totalFee:23500 },
];

const INVENTORY_ITEMS = ["School Bag","Uniform","Textbooks","Notebooks","School Diary","ID Card"];
const EMP_ROLES    = ["Teacher","Admin Staff","Principal","Vice Principal","Lab Assistant","Librarian","Peon","Guard","Cook","Driver"];
const EMP_STATUSES = ["Active","On Leave","Resigned"];
const ASSET_ACTIONS = ["Purchased","Assigned","Returned","Serviced","Repaired","Moved","Disposed"];

// ── Dummy data ────────────────────────────────────────────────────────────────
let _sid = 0;
function mkSt(cls, roll, firstName, lastName, gender) {
  _sid++;
  return {
    id:_sid, enrollNo:`SS-${String(_sid).padStart(4,"0")}`,
    firstName, lastName, name:`${firstName} ${lastName}`,
    cls, roll, gender,
    joinDate:"2026-06-01", grNo:`GR${2000+_sid}`,
    dob:"2015-06-10", religion:"Hindu", caste:"General",
    fatherName:`${lastName} Sr`, motherName:`Smt. ${lastName}`,
    roomPlotNo:"12", address:"Gandhi Nagar, Surat", mobile1:`98765${String(40000+_sid).padStart(5,"0")}`, mobile2:"",
    placeOfBirth:"Surat",
    lastSchoolName:"City Primary School", lastSchoolClass:"Nursery / KG", lastSchoolMedium:"Gujarati", lastSchoolPlace:"Surat",
    aadharNo:`XXXX XXXX ${1000+_sid}`, aadharName:`${firstName} ${lastName}`,
    udise:"", pen:`PEN${3000+_sid}`, apaar:"",
  };
}

const DUMMY_STUDENTS = [
  mkSt("JR KG","1","Arjun","Patel","Male"),       mkSt("SR KG","1","Diya","Shah","Female"),
  mkSt("Balvatika","1","Vivaan","Mehta","Male"),   mkSt("1st","1","Anaya","Desai","Female"),
  mkSt("2nd","1","Rohan","Joshi","Male"),          mkSt("3rd","1","Ishaan","Trivedi","Male"),
  mkSt("4th","1","Priya","Verma","Female"),        mkSt("5th","1","Aditya","Rao","Male"),
  mkSt("6th","1","Sneha","Gupta","Female"),        mkSt("7th","1","Karan","Nair","Male"),
  mkSt("8th","1","Pooja","Singh","Female"),        mkSt("9th","1","Rahul","Kumar","Male"),
  mkSt("10th","1","Anjali","Mishra","Female"),     mkSt("11th Commerce","1","Varun","Pillai","Male"),
  mkSt("12th Commerce","1","Neha","Pandey","Female"),
  mkSt("JR KG","2","Riya","Patel","Female"),       mkSt("SR KG","2","Dev","Shah","Male"),
  mkSt("1st","2","Aarav","Joshi","Male"),          mkSt("2nd","2","Shreya","Mehta","Female"),
  mkSt("3rd","2","Yash","Desai","Male"),           mkSt("4th","2","Kavya","Trivedi","Female"),
  mkSt("5th","2","Om","Rao","Male"),               mkSt("6th","2","Nisha","Gupta","Female"),
  mkSt("7th","2","Jay","Nair","Male"),             mkSt("8th","2","Tanu","Singh","Female"),
];

let _payId = 1;
function mkPay(label, amount, dueDate, paid, paidDate) {
  return { id: _payId++, label, amount, dueDate, paid, paidDate };
}
function mkFee(id, enrollNo, name, cls, totalFee, discount, payments) {
  return { id, enrollNo, name, cls, totalFee, discount, payments };
}

const DUMMY_FEE_RECORDS = [
  mkFee(1,"SS-0001","Arjun Patel",   "JR KG",         16200,0,   [mkPay("Term 1",5400,"2026-04-15",5400,"2026-04-10"),mkPay("Term 2",5400,"2026-07-15",5400,"2026-07-08"),mkPay("Term 3",5400,"2026-10-15",0,"")]),
  mkFee(2,"SS-0002","Diya Shah",     "SR KG",         16200,500, [mkPay("Full Payment",15700,"2026-04-15",15700,"2026-04-05")]),
  mkFee(3,"SS-0003","Vivaan Mehta",  "Balvatika",     17000,0,   [mkPay("Term 1",5666,"2026-04-15",5666,"2026-04-12"),mkPay("Term 2",5667,"2026-07-15",0,""),mkPay("Term 3",5667,"2026-10-15",0,"")]),
  mkFee(4,"SS-0004","Anaya Desai",   "1st",           18000,1000,[mkPay("Half Yearly 1",8500,"2026-04-15",8500,"2026-04-08"),mkPay("Half Yearly 2",8500,"2026-10-15",8500,"2026-10-10")]),
  mkFee(5,"SS-0005","Rohan Joshi",   "2nd",           18200,0,   [mkPay("Term 1",6066,"2026-04-15",6066,"2026-04-15"),mkPay("Term 2",6067,"2026-07-15",0,""),mkPay("Term 3",6067,"2026-10-15",0,"")]),
  mkFee(6,"SS-0006","Ishaan Trivedi","3rd",           18500,0,   [mkPay("Full Payment",18500,"2026-04-15",18500,"2026-04-02")]),
  mkFee(7,"SS-0007","Priya Verma",   "4th",           18800,500, [mkPay("Term 1",6100,"2026-04-15",6100,"2026-04-20"),mkPay("Term 2",6100,"2026-07-15",6100,"2026-07-15"),mkPay("Term 3",6100,"2026-10-15",0,"")]),
  mkFee(8,"SS-0008","Aditya Rao",    "5th",           19500,0,   [mkPay("Term 1",6500,"2026-04-15",6500,"2026-04-18"),mkPay("Term 2",6500,"2026-07-15",0,""),mkPay("Term 3",6500,"2026-10-15",0,"")]),
];

const DUMMY_ASSETS = [
  { id:1, name:"HP LaserJet Printer",   category:"Electronics", location:"Office",        status:"Active",      assignedTo:"Admin",      purchaseDate:"2023-01-15", value:18500,
    history:[{ id:1,date:"2023-01-15",action:"Purchased",from:"—",to:"Office",note:"Initial setup"},{ id:2,date:"2024-03-10",action:"Serviced",from:"Office",to:"Office",note:"Cartridge replaced"}]},
  { id:2, name:"Dell Laptop",           category:"Electronics", location:"Lab",           status:"Active",      assignedTo:"Lab Staff",  purchaseDate:"2022-06-10", value:55000,
    history:[{ id:3,date:"2022-06-10",action:"Purchased",from:"—",to:"Lab",note:"New purchase"},{ id:4,date:"2023-09-01",action:"Assigned",from:"Lab",to:"Lab Staff",note:"Staff assignment"}]},
  { id:3, name:"Projector Epson X41+", category:"Electronics", location:"Hall",          status:"Active",      assignedTo:"AV Team",    purchaseDate:"2021-08-20", value:42000,
    history:[{ id:5,date:"2021-08-20",action:"Purchased",from:"—",to:"Hall",note:"Hall installation"},{ id:6,date:"2025-01-15",action:"Serviced",from:"Hall",to:"Hall",note:"Bulb replaced"}]},
  { id:4, name:"Classroom Chairs (30)", category:"Furniture",   location:"Classroom 4",  status:"Active",      assignedTo:"Class 4",    purchaseDate:"2020-04-01", value:24000,
    history:[{ id:7,date:"2020-04-01",action:"Purchased",from:"—",to:"Classroom 4",note:"Annual procurement"}]},
  { id:5, name:"Science Lab Kit",       category:"Lab Equip",   location:"Science Lab",  status:"Maintenance", assignedTo:"Lab Asst",   purchaseDate:"2023-03-12", value:32000,
    history:[{ id:8,date:"2023-03-12",action:"Purchased",from:"—",to:"Science Lab",note:""},{ id:9,date:"2026-02-20",action:"Repaired",from:"Science Lab",to:"Science Lab",note:"Under maintenance"}]},
  { id:6, name:"Sports Equipment Set",  category:"Sports",      location:"Ground",        status:"Active",      assignedTo:"PE Teacher", purchaseDate:"2024-01-05", value:15000,
    history:[{ id:10,date:"2024-01-05",action:"Purchased",from:"—",to:"Ground",note:"New set"}]},
  { id:7, name:"Water Purifier",        category:"Appliance",   location:"Canteen",       status:"Active",      assignedTo:"Cook",       purchaseDate:"2022-11-30", value:12500,
    history:[{ id:11,date:"2022-11-30",action:"Purchased",from:"—",to:"Canteen",note:""}]},
  { id:8, name:"CCTV Camera Set",       category:"Security",    location:"Entire School", status:"Active",      assignedTo:"Admin",      purchaseDate:"2023-07-01", value:38000,
    history:[{ id:12,date:"2023-07-01",action:"Purchased",from:"—",to:"Entire School",note:"16-camera setup"}]},
];

const DUMMY_STUDENT_INVENTORY = DUMMY_STUDENTS.map((s,i) => ({
  ...s,
  items: INVENTORY_ITEMS.map((item,j) => ({
    item, given: j < [5,6,3,6,4,6,5,4,6,5,4,6,5,6,4,5,5,5,4,5,5,5,4,4,5][i],
    date: j < [5,6,3,6,4,6,5,4,6,5,4,6,5,6,4,5,5,5,4,5,5,5,4,4,5][i] ? "2026-06-05" : "",
  })),
}));

const DUMMY_STOCK = [
  { id:1,item:"School Bag",   price:450, total:150,issued:120},{ id:2,item:"Uniform",      price:850, total:200,issued:185},
  { id:3,item:"Textbooks",    price:1200,total:300,issued:252},{ id:4,item:"Notebooks",    price:180, total:500,issued:420},
  { id:5,item:"School Diary", price:120, total:180,issued:160},{ id:6,item:"ID Card",      price:50,  total:200,issued:192},
  { id:7,item:"Water Bottle", price:250, total:100,issued:78 },{ id:8,item:"PE Kit",       price:650, total:120,issued:92 },
];

const DUMMY_EMPLOYEES = [
  { id:1, name:"Rajesh Patel",    role:"Teacher",     subject:"Mathematics", qualification:"B.Ed, M.Sc", mobile:"9876541001",email:"rajesh@satyam.in",salary:28000,joinDate:"2020-06-01",status:"Active"   },
  { id:2, name:"Meena Desai",     role:"Teacher",     subject:"English",     qualification:"B.Ed, M.A",  mobile:"9876541002",email:"meena@satyam.in", salary:26000,joinDate:"2019-04-15",status:"Active"   },
  { id:3, name:"Suresh Shah",     role:"Teacher",     subject:"Science",     qualification:"B.Ed, B.Sc", mobile:"9876541003",email:"suresh@satyam.in",salary:27000,joinDate:"2021-07-01",status:"Active"   },
  { id:4, name:"Priya Trivedi",   role:"Teacher",     subject:"Social Sc",   qualification:"B.Ed",       mobile:"9876541004",email:"priya@satyam.in", salary:25000,joinDate:"2022-06-15",status:"Active"   },
  { id:5, name:"Amit Kumar",      role:"Teacher",     subject:"Hindi",       qualification:"B.Ed, M.A",  mobile:"9876541005",email:"amit@satyam.in",  salary:24000,joinDate:"2020-08-01",status:"Active"   },
  { id:6, name:"Kavita Joshi",    role:"Teacher",     subject:"Gujarati",    qualification:"B.Ed",       mobile:"9876541006",email:"kavita@satyam.in",salary:24000,joinDate:"2021-06-01",status:"Active"   },
  { id:7, name:"Ramesh Verma",    role:"Admin Staff", subject:"—",           qualification:"B.Com",      mobile:"9876541007",email:"ramesh@satyam.in",salary:22000,joinDate:"2018-03-01",status:"Active"   },
  { id:8, name:"Sunita Rao",      role:"Teacher",     subject:"Computer",    qualification:"MCA",        mobile:"9876541008",email:"sunita@satyam.in",salary:25000,joinDate:"2023-06-01",status:"Active"   },
  { id:9, name:"Dinesh Mehta",    role:"Peon",        subject:"—",           qualification:"10th",       mobile:"9876541009",email:"",               salary:15000,joinDate:"2017-06-01",status:"Active"   },
  { id:10,name:"Aarti Sharma",    role:"Teacher",     subject:"Drawing",     qualification:"B.F.A",      mobile:"9876541010",email:"aarti@satyam.in", salary:20000,joinDate:"2022-01-15",status:"Active"   },
  { id:11,name:"Vinod Prajapati", role:"Guard",       subject:"—",           qualification:"10th",       mobile:"9876541011",email:"",               salary:14000,joinDate:"2019-06-01",status:"Active"   },
  { id:12,name:"Savita Nair",     role:"Teacher",     subject:"Music",       qualification:"B.Mus",      mobile:"9876541012",email:"savita@satyam.in",salary:20000,joinDate:"2021-06-15",status:"Active"   },
];

// ── Shared cell renderer ──────────────────────────────────────────────────────
function FieldCell({ field, value, onChange, compact }) {
  const cls = compact
    ? "border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-school-navy bg-white w-full"
    : "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy bg-white w-full";
  if (field.type === "select") {
    return (
      <select className={cls} value={value || ""} onChange={e => onChange(e.target.value)}>
        {field.options.map(o => <option key={o}>{o}</option>)}
      </select>
    );
  }
  return <input type={field.type} className={cls} value={value || ""} onChange={e => onChange(e.target.value)} />;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }) {
  const [role,  setRole]  = useState("management");
  const [name,  setName]  = useState("");
  const [pass,  setPass]  = useState("");
  const [showP, setShowP] = useState(false);
  const [error, setError] = useState("");
  const users = role === "management" ? MGMT_USERS : SENIOR_USERS;

  function handleLogin(e) {
    e.preventDefault();
    const found = users.find(u => u.name === name && u.password === pass);
    if (found) onLogin({ ...found, role });
    else setError("Invalid credentials.");
  }

  return (
    <div className="-m-4 lg:-m-6 flex items-center justify-center h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-school-navy p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex">

        {/* Left — branding panel */}
        <div className="hidden md:flex flex-col justify-center w-2/5 flex-shrink-0 bg-school-navy px-8 py-8 text-white">
          <div className="w-16 h-16 bg-school-gold rounded-2xl flex items-center justify-center mb-5 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <p className="text-2xl font-bold mb-1">Super Admin</p>
          <p className="text-white/50 text-sm mb-7">Restricted Access Portal</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <Crown className="w-5 h-5 text-school-gold flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Management Head</p>
                <p className="text-white/45 text-xs mt-0.5">Full website control</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <Shield className="w-5 h-5 text-blue-300 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Senior Admin</p>
                <p className="text-white/45 text-xs mt-0.5">Student update access</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-8">
          {/* Mobile header */}
          <div className="flex md:hidden items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-school-gold rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-gray-800">Super Admin — Restricted Access</p>
          </div>

          <p className="text-xl font-bold text-gray-800 mb-1">Sign In</p>
          <p className="text-sm text-gray-400 mb-6">Select your role and enter credentials</p>

          {/* Role toggle */}
          <div className="flex gap-3 mb-5">
            {[{v:"management",label:"Management Head",Icon:Crown},{v:"senior",label:"Senior Admin",Icon:Shield}].map(({v,label,Icon}) => (
              <button key={v} onClick={() => { setRole(v); setError(""); setName(""); setPass(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${role===v?"border-school-navy bg-school-navy text-white shadow-md":"border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Name</label>
              <select className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" value={name} onChange={e => { setName(e.target.value); setError(""); }}>
                <option value="">-- Select --</option>
                {users.map(u => <option key={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input type={showP?"text":"password"} className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" value={pass} onChange={e => { setPass(e.target.value); setError(""); }} placeholder="Enter password" />
                <button type="button" onClick={() => setShowP(!showP)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">{showP?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
              </div>
            </div>
            <button type="submit" className="w-full bg-school-navy text-white py-3 rounded-xl font-semibold text-sm hover:bg-opacity-90 transition-colors shadow-md">
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Single Student Tool (Senior Admin) ────────────────────────────────────────
function SingleStudentTool({ students }) {
  const [selClass, setSelClass] = useState("");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState({});
  const [saved,    setSaved]    = useState(false);

  const classCounts = {};
  students.forEach(s => { classCounts[s.cls] = (classCounts[s.cls] || 0) + 1; });

  const inClass = selClass ? students.filter(s =>
    s.cls === selClass &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.roll.toString().includes(search) || s.enrollNo.toLowerCase().includes(search.toLowerCase()))
  ) : [];

  if (!selClass) return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Select Class to Search Students</h3>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {CLASSES.map(cls => (
          <button key={cls} onClick={() => setSelClass(cls)} className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-gray-200 hover:border-school-navy hover:bg-school-navy/5 transition-all group">
            <div className="w-10 h-10 rounded-full bg-school-navy/10 group-hover:bg-school-navy/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-school-navy" />
            </div>
            <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{cls}</span>
            <span className="text-[10px] text-gray-400">{classCounts[cls]||0} students</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (!selected) return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => { setSelClass(""); setSearch(""); }} className="text-school-navy text-sm font-semibold">← Back</button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-bold text-gray-700">{selClass}</span>
        <span className="ml-auto text-xs text-gray-400">{inClass.length} students</span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" placeholder="Search by name, roll, or enroll no…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-2">
        {inClass.map(st => (
          <button key={st.id} onClick={() => { setSelected(st); setForm({...st}); setSaved(false); }} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-school-navy hover:bg-school-navy/5 transition-all text-left">
            <div className="w-10 h-10 rounded-full bg-school-gold flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{st.firstName[0]}{st.lastName[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{st.name}</p>
              <p className="text-xs text-gray-400">{st.enrollNo} · Roll {st.roll}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        ))}
        {inClass.length===0 && <p className="text-center text-gray-400 py-10 text-sm">No students found</p>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setSelected(null)} className="text-school-navy text-sm font-semibold">← Back</button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-bold">{selClass}</span>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-bold">{selected.name}</span>
      </div>
      {saved && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 mb-4 text-sm"><CheckCircle2 className="w-4 h-4"/>Changes saved!</div>}
      <div className="space-y-6">
        {FIELD_GROUPS.map(grp => (
          <div key={grp.group}>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{grp.group}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {grp.fields.map(field => {
                const Icon = field.icon;
                return (
                  <div key={field.key}>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1"><Icon className="w-3.5 h-3.5"/>{field.label}</label>
                    <FieldCell field={field} value={form[field.key]} onChange={v => setForm({...form,[field.key]:v})} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={() => { setSaved(true); setTimeout(()=>setSaved(false),2500); }} className="flex items-center gap-2 bg-school-navy text-white px-6 py-2.5 rounded-lg text-sm font-semibold"><Save className="w-4 h-4"/>Save Changes</button>
        <button onClick={() => setForm({...selected})} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold"><RefreshCw className="w-4 h-4"/>Reset</button>
      </div>
    </div>
  );
}

// ── Spreadsheet bulk editor (shared logic) ────────────────────────────────────
function SpreadsheetEditor({ students, title }) {
  const [selClass,       setSelClass]       = useState("All");
  const [search,         setSearch]         = useState("");
  const [selFields,      setSelFields]      = useState([]);
  const [showPicker,     setShowPicker]     = useState(true);
  const [edits,          setEdits]          = useState({});
  const [saved,          setSaved]          = useState(false);

  const filtered = students.filter(s =>
    (selClass==="All"||s.cls===selClass) &&
    (search===""||s.name.toLowerCase().includes(search.toLowerCase())||s.enrollNo.toLowerCase().includes(search.toLowerCase()))
  );

  function getCellVal(stuId, key) {
    if (edits[stuId] && edits[stuId][key] !== undefined) return edits[stuId][key];
    return students.find(s=>s.id===stuId)?.[key]||"";
  }

  function setCell(stuId, key, val) {
    setEdits(prev => ({ ...prev, [stuId]: { ...prev[stuId], [key]: val } }));
  }

  function toggleField(key) {
    setSelFields(prev => prev.includes(key) ? prev.filter(k=>k!==key) : [...prev, key]);
  }

  const selectedFields = ALL_FIELDS.filter(f => selFields.includes(f.key));

  return (
    <div className="space-y-4">
      {/* Field picker */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowPicker(!showPicker)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700">
          <span>Select Fields to Edit <span className="text-school-navy">({selFields.length} selected)</span></span>
          {showPicker?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
        </button>
        {showPicker && (
          <div className="p-4 space-y-4">
            {FIELD_GROUPS.map(grp => {
              const gs = GROUP_STYLES[grp.group]||GROUP_STYLES["Personal"];
              return (
                <div key={grp.group}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{grp.group}</p>
                  <div className="flex flex-wrap gap-2">
                    {grp.fields.map(field => {
                      const isSel = selFields.includes(field.key);
                      return (
                        <button key={field.key} onClick={() => toggleField(field.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${isSel ? gs.activeCls+" text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                          {field.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" placeholder="Search student…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={selClass} onChange={e=>setSelClass(e.target.value)}>
          <option value="All">All Classes</option>
          {CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <span className="self-center text-xs text-gray-400">{filtered.length} students</span>
      </div>

      {selFields.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-400 font-medium">Select fields above to start editing</p>
          <p className="text-xs text-gray-300 mt-1">Each student gets their own editable value</p>
        </div>
      )}

      {/* Spreadsheet */}
      {selFields.length > 0 && (
        <>
          {saved && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 text-sm"><CheckCircle2 className="w-4 h-4"/>All changes saved!</div>}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50 z-10">Student</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Class</th>
                  {selectedFields.map(f => (
                    <th key={f.key} className="px-3 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-32">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((st, idx) => (
                  <tr key={st.id} className={`border-b border-gray-100 ${idx%2===0?"bg-white":"bg-gray-50/50"}`}>
                    <td className={`px-3 py-2 font-semibold text-gray-800 whitespace-nowrap sticky left-0 z-10 ${idx%2===0?"bg-white":"bg-gray-50/50"}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-school-gold flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{st.firstName[0]}{st.lastName[0]}</div>
                        {st.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{st.cls}</td>
                    {selectedFields.map(field => (
                      <td key={field.key} className="px-2 py-1.5">
                        <FieldCell field={field} value={getCellVal(st.id, field.key)} onChange={v=>setCell(st.id, field.key, v)} compact />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}} className="flex items-center gap-2 bg-school-navy text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
              <Save className="w-4 h-4"/>Save All Changes ({filtered.length} students)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Fees Panel ────────────────────────────────────────────────────────────────
function FeesPanel() {
  const [tab,       setTab]       = useState("records");
  const [feeRecs,   setFeeRecs]   = useState(DUMMY_FEE_RECORDS);
  const [feeStruct, setFeeStruct] = useState(FEES_STRUCTURE);
  const [expandId,  setExpandId]  = useState(null);
  const [editRec,   setEditRec]   = useState(null);
  const [clsF,      setClsF]      = useState("All");
  const [search,    setSearch]    = useState("");
  const [saved,     setSaved]     = useState(false);

  const filtered = feeRecs.filter(r =>
    (clsF==="All"||r.cls===clsF) &&
    (r.name.toLowerCase().includes(search.toLowerCase())||r.enrollNo.toLowerCase().includes(search.toLowerCase()))
  );

  function openEdit(rec) { setExpandId(rec.id); setEditRec(JSON.parse(JSON.stringify(rec))); }

  function saveEdit() {
    setFeeRecs(prev=>prev.map(r=>r.id===editRec.id?editRec:r));
    setSaved(true); setTimeout(()=>setSaved(false),2000);
    setExpandId(null); setEditRec(null);
  }

  function updatePay(pIdx, key, val) {
    setEditRec(prev => { const p=[...prev.payments]; p[pIdx]={...p[pIdx],[key]:val}; return {...prev,payments:p}; });
  }

  function addPayment() {
    const newP = { id: Date.now(), label:`Payment ${editRec.payments.length+1}`, amount:0, dueDate:"", paid:0, paidDate:"" };
    setEditRec(prev=>({...prev,payments:[...prev.payments,newP]}));
  }

  function removePayment(pIdx) {
    setEditRec(prev=>({...prev,payments:prev.payments.filter((_,i)=>i!==pIdx)}));
  }

  const NCOLS = 8;

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {[{k:"records",label:"Student Fee Records"},{k:"structure",label:"Fee Structure"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${tab===t.k?"bg-emerald-600 text-white border-emerald-600":"border-gray-200 text-gray-600 hover:border-emerald-500"}`}>{t.label}</button>
        ))}
      </div>

      {tab==="structure" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Class / Standard</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Annual Fee (₹)</th>
            </tr></thead>
            <tbody>
              {feeStruct.map((row,idx)=>(
                <tr key={row.cls} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{row.cls}</td>
                  <td className="px-4 py-3">
                    <div className="relative w-40">
                      <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                      <input type="number" className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={row.totalFee} onChange={e=>setFeeStruct(prev=>prev.map((r,i)=>i===idx?{...r,totalFee:Number(e.target.value)}:r))}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100">
            <button className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"><Save className="w-4 h-4"/>Save Fee Structure</button>
          </div>
        </div>
      )}

      {tab==="records" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={clsF} onChange={e=>setClsF(e.target.value)}><option value="All">All Classes</option>{CLASSES.map(c=><option key={c}>{c}</option>)}</select>
          </div>
          {saved && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 mb-3 text-sm"><CheckCircle2 className="w-4 h-4"/>Saved!</div>}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {["Enroll","Name","Class","Annual Fee","Discount","Payments","Total Paid","Action"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(rec => {
                  const totalPaid = rec.payments.reduce((s,p)=>s+p.paid,0);
                  const isExp = expandId===rec.id;
                  return (
                    <>
                      <tr key={rec.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isExp?"bg-emerald-50":""}`} onClick={()=>isExp?(setExpandId(null),setEditRec(null)):openEdit(rec)}>
                        <td className="px-3 py-2 font-mono text-gray-500">{rec.enrollNo}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{rec.name}</td>
                        <td className="px-3 py-2 text-gray-600">{rec.cls}</td>
                        <td className="px-3 py-2 font-semibold">₹{rec.totalFee.toLocaleString()}</td>
                        <td className="px-3 py-2 text-orange-600">{rec.discount>0?`₹${rec.discount.toLocaleString()}`:"—"}</td>
                        <td className="px-3 py-2 text-gray-600">{rec.payments.length} payment{rec.payments.length!==1?"s":""}</td>
                        <td className="px-3 py-2">
                          <span className={`font-semibold ${totalPaid>=(rec.totalFee-rec.discount)?"text-green-600":"text-amber-600"}`}>₹{totalPaid.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2">
                          <button className="flex items-center gap-1 text-emerald-700 font-semibold">
                            {isExp?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}{isExp?"Close":"Edit"}
                          </button>
                        </td>
                      </tr>
                      {isExp && editRec && (
                        <tr key={`exp-${rec.id}`}><td colSpan={NCOLS} className="px-4 py-4 bg-emerald-50/40">
                          <div className="bg-white rounded-xl border border-emerald-200 p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-gray-800">{rec.name} — {rec.cls}</h4>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>Annual: ₹{editRec.totalFee.toLocaleString()}</span>
                                <span className="text-orange-600">Discount:
                                  <input type="number" className="ml-1 w-20 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" value={editRec.discount} onChange={e=>setEditRec({...editRec,discount:Number(e.target.value)})}/>
                                </span>
                              </div>
                            </div>
                            <div className="overflow-x-auto mb-3">
                              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                                <thead><tr className="bg-gray-50">
                                  {["#","Label","Amount ₹","Due Date","Paid ₹","Paid Date","Balance","Status",""].map(h=>(
                                    <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {editRec.payments.map((p,pIdx)=>{
                                    const bal = p.amount - p.paid;
                                    return (
                                      <tr key={p.id} className="border-t border-gray-100">
                                        <td className="px-2 py-2 text-gray-400">{pIdx+1}</td>
                                        <td className="px-2 py-1.5"><input className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-28 bg-white" value={p.label} onChange={e=>updatePay(pIdx,"label",e.target.value)}/></td>
                                        <td className="px-2 py-1.5"><input type="number" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-20 bg-white" value={p.amount} onChange={e=>updatePay(pIdx,"amount",Number(e.target.value))}/></td>
                                        <td className="px-2 py-1.5"><input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none bg-white" value={p.dueDate} onChange={e=>updatePay(pIdx,"dueDate",e.target.value)}/></td>
                                        <td className="px-2 py-1.5"><input type="number" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-20 bg-white" value={p.paid} onChange={e=>updatePay(pIdx,"paid",Number(e.target.value))}/></td>
                                        <td className="px-2 py-1.5"><input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none bg-white" value={p.paidDate} onChange={e=>updatePay(pIdx,"paidDate",e.target.value)}/></td>
                                        <td className={`px-2 py-2 font-semibold ${bal<=0?"text-green-600":"text-red-500"}`}>{bal<=0?"Cleared":`₹${bal.toLocaleString()}`}</td>
                                        <td className="px-2 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${p.paid>=p.amount?"bg-green-100 text-green-700":p.paid>0?"bg-yellow-100 text-yellow-700":"bg-red-100 text-red-700"}`}>{p.paid>=p.amount?"Paid":p.paid>0?"Partial":"Unpaid"}</span></td>
                                        <td className="px-2 py-2"><button onClick={()=>removePayment(pIdx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={addPayment} className="flex items-center gap-1.5 border border-dashed border-emerald-400 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-50"><Plus className="w-3.5 h-3.5"/>Add Payment</button>
                              <button onClick={saveEdit} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save</button>
                              <button onClick={()=>{setExpandId(null);setEditRec(null);}} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-semibold"><X className="w-3.5 h-3.5"/>Cancel</button>
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {filtered.length===0 && <p className="text-center text-gray-400 py-8 text-sm">No records found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inventory Panel ───────────────────────────────────────────────────────────
function InventoryPanel() {
  const [tab,      setTab]      = useState("assets");
  const [assets,   setAssets]   = useState(DUMMY_ASSETS);
  const [stock,    setStock]    = useState(DUMMY_STOCK);
  const [stuInv,   setStuInv]   = useState(DUMMY_STUDENT_INVENTORY);
  const [clsF,     setClsF]     = useState("All");
  const [selStu,   setSelStu]   = useState(null);
  const [stuItems, setStuItems] = useState([]);
  const [expandId, setExpandId] = useState(null);
  const [histMode, setHistMode] = useState(null); // assetId showing history
  const [stockEdit,setStockEdit]= useState(null);
  const [saved,    setSaved]    = useState("");
  let _hid = 100;

  function showSaved(msg) { setSaved(msg); setTimeout(()=>setSaved(""),2000); }

  function addHistEntry(assetId) {
    setAssets(prev=>prev.map(a=>a.id===assetId?{...a,history:[...a.history,{id:_hid++,date:"",action:"Assigned",from:"",to:"",note:""}]}:a));
  }

  function updateHistEntry(assetId, hIdx, key, val) {
    setAssets(prev=>prev.map(a=>a.id===assetId?{...a,history:a.history.map((h,i)=>i===hIdx?{...h,[key]:val}:h)}:a));
  }

  function removeHistEntry(assetId, hIdx) {
    setAssets(prev=>prev.map(a=>a.id===assetId?{...a,history:a.history.filter((_,i)=>i!==hIdx)}:a));
  }

  const filteredStu = stuInv.filter(s=>clsF==="All"||s.cls===clsF);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {[{k:"assets",label:"Assets"},{k:"student",label:"Student Items"},{k:"stock",label:"Stock / Extra"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${tab===t.k?"bg-amber-500 text-white border-amber-500":"border-gray-200 text-gray-600 hover:border-amber-400"}`}>{t.label}</button>
        ))}
      </div>
      {saved && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 mb-3 text-sm"><CheckCircle2 className="w-4 h-4"/>{saved}</div>}

      {/* Assets tab */}
      {tab==="assets" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {["#","Asset Name","Category","Location","Assigned To","Purchase Date","Value ₹","Status","Actions"].map(h=>(
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {assets.map(a=>(
                <>
                  <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${expandId===a.id?"bg-amber-50":""}`}>
                    <td className="px-3 py-2 text-gray-400">{a.id}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{a.name}</td>
                    <td className="px-3 py-2 text-gray-600">{a.category}</td>
                    <td className="px-3 py-2 text-gray-600">{a.location}</td>
                    <td className="px-3 py-2 text-gray-600">{a.assignedTo}</td>
                    <td className="px-3 py-2 text-gray-600">{a.purchaseDate}</td>
                    <td className="px-3 py-2 font-semibold">₹{a.value.toLocaleString()}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status==="Active"?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{a.status}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setExpandId(expandId===a.id?null:a.id)} className="flex items-center gap-1 text-amber-700 font-semibold hover:text-amber-900">
                          <Pencil className="w-3.5 h-3.5"/>{expandId===a.id?"Close":"Edit"}
                        </button>
                        <button onClick={()=>setHistMode(histMode===a.id?null:a.id)} className={`flex items-center gap-1 font-semibold ${histMode===a.id?"text-purple-700":"text-gray-500 hover:text-purple-600"}`}>
                          <History className="w-3.5 h-3.5"/>History
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Edit row */}
                  {expandId===a.id && (
                    <tr key={`ae-${a.id}`}><td colSpan={9} className="px-4 py-3 bg-amber-50/50">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        {[{l:"Name",f:"name",t:"text"},{l:"Category",f:"category",t:"text"},{l:"Location",f:"location",t:"text"},{l:"Assigned To",f:"assignedTo",t:"text"},{l:"Purchase Date",f:"purchaseDate",t:"date"},{l:"Value ₹",f:"value",t:"number"},{l:"Status",f:"status",t:"sel",opts:["Active","Maintenance","Disposed"]}].map(({l,f,t,opts})=>(
                          <div key={f} className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-semibold text-gray-500">{l}</label>
                            {t==="sel"
                              ?<select className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" value={a[f]} onChange={e=>setAssets(prev=>prev.map(x=>x.id===a.id?{...x,[f]:e.target.value}:x))}>{opts.map(o=><option key={o}>{o}</option>)}</select>
                              :<input type={t} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" value={a[f]} onChange={e=>setAssets(prev=>prev.map(x=>x.id===a.id?{...x,[f]:t==="number"?Number(e.target.value):e.target.value}:x))}/>
                            }
                          </div>
                        ))}
                      </div>
                      <button onClick={()=>{setExpandId(null);showSaved("Asset updated!");}} className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save</button>
                    </td></tr>
                  )}

                  {/* History row */}
                  {histMode===a.id && (
                    <tr key={`hist-${a.id}`}><td colSpan={9} className="px-4 py-4 bg-purple-50/40">
                      <div className="bg-white rounded-xl border border-purple-200 p-4">
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><History className="w-4 h-4 text-purple-600"/>Usage History — {a.name}</h4>
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                            <thead><tr className="bg-gray-50">
                              {["#","Date","Action","From","To","Notes",""].map(h=><th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>)}
                            </tr></thead>
                            <tbody>
                              {a.history.map((h,hIdx)=>(
                                <tr key={h.id} className="border-t border-gray-100">
                                  <td className="px-2 py-1.5 text-gray-400">{hIdx+1}</td>
                                  <td className="px-2 py-1.5"><input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none w-32" value={h.date} onChange={e=>updateHistEntry(a.id,hIdx,"date",e.target.value)}/></td>
                                  <td className="px-2 py-1.5"><select className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none" value={h.action} onChange={e=>updateHistEntry(a.id,hIdx,"action",e.target.value)}>{ASSET_ACTIONS.map(ac=><option key={ac}>{ac}</option>)}</select></td>
                                  <td className="px-2 py-1.5"><input className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none w-24" value={h.from} onChange={e=>updateHistEntry(a.id,hIdx,"from",e.target.value)}/></td>
                                  <td className="px-2 py-1.5"><input className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none w-24" value={h.to} onChange={e=>updateHistEntry(a.id,hIdx,"to",e.target.value)}/></td>
                                  <td className="px-2 py-1.5"><input className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none w-36" value={h.note} onChange={e=>updateHistEntry(a.id,hIdx,"note",e.target.value)}/></td>
                                  <td className="px-2 py-1.5"><button onClick={()=>removeHistEntry(a.id,hIdx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5"/></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>addHistEntry(a.id)} className="flex items-center gap-1.5 border border-dashed border-purple-400 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-purple-50"><Plus className="w-3.5 h-3.5"/>Add Entry</button>
                          <button onClick={()=>{setHistMode(null);showSaved("History saved!");}} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save History</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Items tab */}
      {tab==="student" && !selStu && (
        <div>
          <div className="flex gap-3 mb-4">
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={clsF} onChange={e=>setClsF(e.target.value)}><option value="All">All Classes</option>{CLASSES.map(c=><option key={c}>{c}</option>)}</select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Class</th>
                {INVENTORY_ITEMS.map(item=><th key={item} className="px-3 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">{item}</th>)}
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Action</th>
              </tr></thead>
              <tbody>
                {filteredStu.map(s=>(
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.name}</td>
                    <td className="px-3 py-2 text-gray-600">{s.cls}</td>
                    {s.items.map((it,j)=>(
                      <td key={j} className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${it.given?"bg-green-100 text-green-700":"bg-gray-100 text-gray-400"}`}>{it.given?"✓":"✗"}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2"><button onClick={()=>{setSelStu(s);setStuItems(s.items.map(i=>({...i})));}} className="flex items-center gap-1 text-amber-700 font-semibold"><Pencil className="w-3.5 h-3.5"/>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab==="student" && selStu && (
        <div>
          <button onClick={()=>setSelStu(null)} className="text-amber-700 text-sm font-semibold mb-4">← Back to list</button>
          <h4 className="text-sm font-bold text-gray-800 mb-1">{selStu.name}</h4>
          <p className="text-xs text-gray-400 mb-4">{selStu.cls} · {selStu.enrollNo}</p>
          <div className="space-y-3">
            {stuItems.map((it,j)=>(
              <div key={j} className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <button onClick={()=>setStuItems(prev=>prev.map((x,i)=>i===j?{...x,given:!x.given,date:!x.given?"2026-06-05":""}:x))} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${it.given?"bg-green-500 border-green-500 text-white":"border-gray-300 text-gray-400"}`}><Check className="w-4 h-4"/></button>
                <span className="text-sm font-semibold text-gray-700 min-w-24">{it.item}</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Date:</label>
                  <input type="date" disabled={!it.given} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none disabled:opacity-40" value={it.date} onChange={e=>setStuItems(prev=>prev.map((x,i)=>i===j?{...x,date:e.target.value}:x))}/>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={()=>{setStuInv(prev=>prev.map(s=>s.id===selStu.id?{...s,items:stuItems}:s));showSaved("Student inventory updated!");setSelStu(null);}} className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"><Save className="w-4 h-4"/>Save</button>
            <button onClick={()=>setSelStu(null)} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      {/* Stock tab */}
      {tab==="stock" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {["#","Item","Price/Unit ₹","Total Qty","Issued","Available","Action"].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody>
              {stock.map(s=>(
                <>
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 ${stockEdit===s.id?"bg-amber-50":""}`}>
                    <td className="px-3 py-2 text-gray-400">{s.id}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.item}</td>
                    <td className="px-3 py-2">₹{s.price}</td>
                    <td className="px-3 py-2">{s.total}</td>
                    <td className="px-3 py-2">{s.issued}</td>
                    <td className="px-3 py-2"><span className={`font-bold ${s.total-s.issued<=5?"text-red-600":"text-green-600"}`}>{s.total-s.issued}</span></td>
                    <td className="px-3 py-2"><button onClick={()=>setStockEdit(stockEdit===s.id?null:s.id)} className="flex items-center gap-1 text-amber-700 font-semibold text-xs"><Pencil className="w-3.5 h-3.5"/>{stockEdit===s.id?"Close":"Edit"}</button></td>
                  </tr>
                  {stockEdit===s.id && (
                    <tr key={`se-${s.id}`}><td colSpan={7} className="px-4 py-3 bg-amber-50/60">
                      <div className="flex flex-wrap gap-4 mb-3">
                        {[{l:"Item",f:"item",t:"text"},{l:"Price ₹",f:"price",t:"number"},{l:"Total Qty",f:"total",t:"number"},{l:"Issued",f:"issued",t:"number"}].map(({l,f,t})=>(
                          <div key={f} className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-semibold text-gray-500">{l}</label>
                            <input type={t} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none w-28" value={s[f]} onChange={e=>setStock(prev=>prev.map(x=>x.id===s.id?{...x,[f]:t==="number"?Number(e.target.value):e.target.value}:x))}/>
                          </div>
                        ))}
                      </div>
                      <button onClick={()=>{setStockEdit(null);showSaved("Stock updated!");}} className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save</button>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Employee Panel ────────────────────────────────────────────────────────────
function EmployeePanel() {
  const [employees,setEmployees]=useState(DUMMY_EMPLOYEES);
  const [search,   setSearch]   =useState("");
  const [roleF,    setRoleF]    =useState("All");
  const [editId,   setEditId]   =useState(null);
  const [form,     setForm]     =useState({});
  const [saved,    setSaved]    =useState(false);

  const filtered=employees.filter(e=>(roleF==="All"||e.role===roleF)&&(e.name.toLowerCase().includes(search.toLowerCase())||e.role.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={roleF} onChange={e=>setRoleF(e.target.value)}><option value="All">All Roles</option>{EMP_ROLES.map(r=><option key={r}>{r}</option>)}</select>
      </div>
      {saved && <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 mb-3 text-sm"><CheckCircle2 className="w-4 h-4"/>Employee record updated!</div>}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {["Name","Role","Subject","Qualification","Mobile","Salary ₹","Status","Join Date","Action"].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(emp=>(
              <>
                <tr key={emp.id} className={`border-b border-gray-100 hover:bg-gray-50 ${editId===emp.id?"bg-purple-50":""}`}>
                  <td className="px-3 py-2 font-semibold text-gray-800">{emp.name}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">{emp.role}</span></td>
                  <td className="px-3 py-2 text-gray-600">{emp.subject}</td>
                  <td className="px-3 py-2 text-gray-600">{emp.qualification}</td>
                  <td className="px-3 py-2 text-gray-600">{emp.mobile}</td>
                  <td className="px-3 py-2 font-semibold">₹{emp.salary.toLocaleString()}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.status==="Active"?"bg-green-100 text-green-700":emp.status==="On Leave"?"bg-yellow-100 text-yellow-700":"bg-red-100 text-red-700"}`}>{emp.status}</span></td>
                  <td className="px-3 py-2 text-gray-500">{emp.joinDate}</td>
                  <td className="px-3 py-2"><button onClick={()=>editId===emp.id?setEditId(null):(setEditId(emp.id),setForm({...emp}))} className="flex items-center gap-1 text-purple-700 font-semibold hover:text-purple-900"><Pencil className="w-3.5 h-3.5"/>{editId===emp.id?"Close":"Edit"}</button></td>
                </tr>
                {editId===emp.id && (
                  <tr key={`ee-${emp.id}`}><td colSpan={9} className="px-4 py-4 bg-purple-50/40">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
                      {[{l:"Full Name",f:"name",t:"text"},{l:"Role",f:"role",t:"sel",opts:EMP_ROLES},{l:"Subject",f:"subject",t:"text"},{l:"Qualification",f:"qualification",t:"text"},{l:"Mobile",f:"mobile",t:"text"},{l:"Email",f:"email",t:"text"},{l:"Salary ₹",f:"salary",t:"number"},{l:"Join Date",f:"joinDate",t:"date"},{l:"Status",f:"status",t:"sel",opts:EMP_STATUSES}].map(({l,f,t,opts})=>(
                        <div key={f} className="flex flex-col gap-0.5">
                          <label className="text-[10px] font-semibold text-gray-500">{l}</label>
                          {t==="sel"
                            ?<select className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" value={form[f]||""} onChange={e=>setForm({...form,[f]:e.target.value})}>{opts.map(o=><option key={o}>{o}</option>)}</select>
                            :<input type={t} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" value={form[f]||""} onChange={e=>setForm({...form,[f]:t==="number"?Number(e.target.value):e.target.value})}/>
                          }
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>{setEmployees(prev=>prev.map(e=>e.id===editId?{...form}:e));setEditId(null);setSaved(true);setTimeout(()=>setSaved(false),2000);}} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save</button>
                      <button onClick={()=>setEditId(null)} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-semibold"><X className="w-3.5 h-3.5"/>Cancel</button>
                    </div>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <p className="text-center text-gray-400 py-8 text-sm">No employees found</p>}
      </div>
    </div>
  );
}

// ── Super Admin Page ──────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [authUser,  setAuthUser]  = useState(null);
  const [activeTab, setActiveTab] = useState("single");
  const [mgmtTab,   setMgmtTab]   = useState("students");

  if (!authUser) return <LoginView onLogin={setAuthUser} />;

  const isMgmt = authUser.role === "management";
  const curModule = MGMT_MODULES.find(m=>m.key===mgmtTab);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${isMgmt?"bg-school-gold":"bg-school-navy"}`}>
            {isMgmt?<Crown className="w-5 h-5 text-white"/>:<Shield className="w-5 h-5 text-white"/>}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isMgmt?"Management Head":"Senior Admin"}</h1>
            <p className="text-xs text-gray-500">Welcome, <span className="font-semibold text-gray-700">{authUser.name}</span></p>
          </div>
        </div>
        <button onClick={()=>setAuthUser(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 border border-gray-200 px-3 py-2 rounded-lg transition-colors">
          <LogOut className="w-4 h-4"/>Logout
        </button>
      </div>

      {/* Senior Admin tabs */}
      {!isMgmt && (
        <>
          <div className="flex gap-2">
            {[{key:"single",label:"Update Student",icon:GraduationCap},{key:"bulk",label:"Bulk Edit (Spreadsheet)",icon:Users}].map(t=>{
              const Icon=t.icon; const isA=activeTab===t.key;
              return <button key={t.key} onClick={()=>setActiveTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isA?"bg-school-navy text-white shadow-md":"text-gray-600 hover:bg-gray-100"}`}><Icon className="w-4 h-4"/>{t.label}</button>;
            })}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {activeTab==="single" && <SingleStudentTool students={DUMMY_STUDENTS}/>}
            {activeTab==="bulk"   && <SpreadsheetEditor students={DUMMY_STUDENTS} title="Bulk Edit Students"/>}
          </div>
        </>
      )}

      {/* Management Head */}
      {isMgmt && (
        <>
          {/* Module tabs */}
          <div className="flex flex-wrap gap-2">
            {MGMT_MODULES.map(t=>{
              const Icon=t.icon; const isA=mgmtTab===t.key;
              const theme=MODULE_THEMES[t.key];
              return (
                <button key={t.key} onClick={()=>setMgmtTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${isA?theme.tabActive+" border-transparent shadow-lg":"border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}>
                  <Icon className="w-4 h-4"/>{t.label}
                </button>
              );
            })}
          </div>

          {/* Module banner */}
          {curModule && (
            <div className={`rounded-2xl p-5 text-white ${MODULE_THEMES[mgmtTab].banner}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{curModule.label}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {curModule.stats.map((s,i)=>(
                      <span key={i} className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-semibold">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  {(() => { const Icon=curModule.icon; return <Icon className="w-8 h-8 text-white"/>; })()}
                </div>
              </div>
            </div>
          )}

          {/* Module content */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {mgmtTab==="students"  && <SpreadsheetEditor students={DUMMY_STUDENTS} title="Student Records"/>}
            {mgmtTab==="fees"      && <FeesPanel/>}
            {mgmtTab==="inventory" && <InventoryPanel/>}
            {mgmtTab==="employee"  && <EmployeePanel/>}
          </div>
        </>
      )}
    </div>
  );
}
