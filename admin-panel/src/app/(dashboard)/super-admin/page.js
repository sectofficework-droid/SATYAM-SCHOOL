"use client";

import { useState } from "react";
import {
  ShieldCheck, Crown, Shield, LogOut, Eye, EyeOff,
  Camera, Calendar, CreditCard, MapPin, User, Tag,
  AlertCircle, CheckCircle2, ArrowDown, Save,
  Search, RefreshCw, ChevronRight, Users, Check,
  Phone, Hash, GraduationCap, IndianRupee, Package,
  Pencil, X,
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

const MGMT_USERS = [
  { name:"Sunil Pradhan",  password:"sunil123",  initials:"SP" },
  { name:"Rajesh Pradhan", password:"rajesh123", initials:"RP" },
];
const SENIOR_USERS = [
  { name:"Meena Shah",  password:"meena123", initials:"MS" },
  { name:"Kiran Joshi", password:"kiran123", initials:"KJ" },
];

const FIELD_GROUPS = [
  { group:"Basic Info", fields:[
    { key:"photo",      label:"Profile Photo",   icon:Camera,        type:"photo"  },
    { key:"firstName",  label:"First Name",      icon:User,          type:"text"   },
    { key:"lastName",   label:"Last Name",       icon:User,          type:"text"   },
    { key:"dob",        label:"Date of Birth",   icon:Calendar,      type:"date"   },
    { key:"gender",     label:"Gender",          icon:User,          type:"select", options:GENDERS   },
    { key:"religion",   label:"Religion",        icon:Tag,           type:"select", options:RELIGIONS },
    { key:"category",   label:"Category/Caste",  icon:Tag,           type:"select", options:CASTES    },
  ]},
  { group:"Family", fields:[
    { key:"fatherName", label:"Father's Name",   icon:User,          type:"text"   },
    { key:"motherName", label:"Mother's Name",   icon:User,          type:"text"   },
  ]},
  { group:"Contact", fields:[
    { key:"roomPlotNo", label:"Room / Plot No",  icon:MapPin,        type:"text"   },
    { key:"address",    label:"Full Address",    icon:MapPin,        type:"text"   },
    { key:"mobile1",    label:"Mobile 1",        icon:Phone,         type:"text"   },
    { key:"mobile2",    label:"Mobile 2",        icon:Phone,         type:"text"   },
  ]},
  { group:"Birth", fields:[
    { key:"placeOfBirth", label:"Place of Birth", icon:MapPin,       type:"text"   },
  ]},
  { group:"Govt IDs", fields:[
    { key:"aadhar",     label:"Aadhar Number",   icon:CreditCard,    type:"aadhar" },
    { key:"aadharName", label:"Name on Aadhar",  icon:CreditCard,    type:"text"   },
    { key:"grNo",       label:"GR Number",       icon:Hash,          type:"text"   },
    { key:"udise",      label:"UDISE Number",    icon:Hash,          type:"text"   },
    { key:"pen",        label:"PEN Number",      icon:Hash,          type:"text"   },
    { key:"apaar",      label:"APAAR ID",        icon:Hash,          type:"text"   },
  ]},
  { group:"Previous School", fields:[
    { key:"lastSchoolName",   label:"School Name",  icon:GraduationCap, type:"text"   },
    { key:"lastSchoolClass",  label:"Last Class",   icon:GraduationCap, type:"select", options:PREV_CLS },
    { key:"lastSchoolMedium", label:"Medium",       icon:GraduationCap, type:"select", options:MEDIUMS  },
    { key:"lastSchoolPlace",  label:"School Place", icon:MapPin,        type:"text"   },
  ]},
];

const BULK_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

// ── Dummy Data ────────────────────────────────────────────────────────────────
function mkSt(base) {
  return {
    photo:null, gender:"Male", religion:"Hindu", category:"General",
    roomPlotNo:"", mobile2:"", placeOfBirth:"Surat",
    aadhar:"", aadharName:"", grNo:"", udise:"", pen:"", apaar:"",
    lastSchoolName:"", lastSchoolClass:"", lastSchoolMedium:"", lastSchoolPlace:"",
    ...base,
  };
}

const DUMMY_STUDENTS = [
  mkSt({ id:1,  enrollNo:"SS-0001", firstName:"Arjun",  lastName:"Patel",    cls:"JR KG",         section:"A", dob:"2021-04-10", fatherName:"Amit",    motherName:"Rina",    address:"Varachha, Surat",  mobile1:"9876543210", gender:"Male",   religion:"Hindu", category:"General" }),
  mkSt({ id:2,  enrollNo:"SS-0002", firstName:"Diya",   lastName:"Shah",     cls:"SR KG",         section:"A", dob:"2020-07-22", fatherName:"Rahul",   motherName:"Priya",   address:"Adajan, Surat",    mobile1:"9876543211", gender:"Female", religion:"Hindu", category:"General" }),
  mkSt({ id:3,  enrollNo:"SS-0003", firstName:"Vivaan", lastName:"Mehta",    cls:"Balvatika",     section:"A", dob:"2019-09-15", fatherName:"Sanjay",  motherName:"Neha",    address:"Katargam, Surat",  mobile1:"9876543212", gender:"Male",   religion:"Hindu", category:"OBC"     }),
  mkSt({ id:4,  enrollNo:"SS-0004", firstName:"Anaya",  lastName:"Desai",    cls:"1st",           section:"A", dob:"2018-12-05", fatherName:"Vishal",  motherName:"Kavita",  address:"Piplod, Surat",    mobile1:"9876543213", gender:"Female", religion:"Jain",  category:"General", aadhar:"1234 5678 9012", aadharName:"Anaya Desai" }),
  mkSt({ id:5,  enrollNo:"SS-0005", firstName:"Rohan",  lastName:"Joshi",    cls:"2nd",           section:"B", dob:"2017-05-18", fatherName:"Prakash", motherName:"Sunita",  address:"Majura, Surat",    mobile1:"9876543214", gender:"Male",   religion:"Hindu", category:"SC"      }),
  mkSt({ id:6,  enrollNo:"SS-0006", firstName:"Ishaan", lastName:"Trivedi",  cls:"3rd",           section:"A", dob:"2016-08-30", fatherName:"Mahesh",  motherName:"Geeta",   address:"Citylight, Surat", mobile1:"9876543215", gender:"Male",   religion:"Hindu", category:"General", aadhar:"2345 6789 0123", aadharName:"Ishaan Trivedi" }),
  mkSt({ id:7,  enrollNo:"SS-0007", firstName:"Priya",  lastName:"Verma",    cls:"4th",           section:"A", dob:"2015-11-12", fatherName:"Suresh",  motherName:"Anita",   address:"Vesu, Surat",      mobile1:"9876543216", gender:"Female", religion:"Hindu", category:"OBC"     }),
  mkSt({ id:8,  enrollNo:"SS-0008", firstName:"Aditya", lastName:"Rao",      cls:"5th",           section:"B", dob:"2014-02-25", fatherName:"Ramesh",  motherName:"Lakshmi", address:"Pal, Surat",       mobile1:"9876543217", gender:"Male",   religion:"Hindu", category:"General", aadhar:"3456 7890 1234", aadharName:"Aditya Rao" }),
  mkSt({ id:9,  enrollNo:"SS-0009", firstName:"Sneha",  lastName:"Gupta",    cls:"6th",           section:"A", dob:"2013-06-08", fatherName:"Vinod",   motherName:"Meena",   address:"Athwa, Surat",     mobile1:"9876543218", gender:"Female", religion:"Hindu", category:"General" }),
  mkSt({ id:10, enrollNo:"SS-0010", firstName:"Karan",  lastName:"Nair",     cls:"7th",           section:"C", dob:"2012-09-20", fatherName:"Krishna", motherName:"Radha",   address:"Bhatar, Surat",    mobile1:"9876543219", gender:"Male",   religion:"Hindu", category:"OBC",    aadhar:"4567 8901 2345", aadharName:"Karan Nair" }),
  mkSt({ id:11, enrollNo:"SS-0011", firstName:"Pooja",  lastName:"Singh",    cls:"8th",           section:"A", dob:"2011-03-14", fatherName:"Arvind",  motherName:"Sonia",   address:"Rander, Surat",    mobile1:"9876543220", gender:"Female", religion:"Hindu", category:"SC"      }),
  mkSt({ id:12, enrollNo:"SS-0012", firstName:"Rahul",  lastName:"Kumar",    cls:"9th",           section:"B", dob:"2010-07-30", fatherName:"Deepak",  motherName:"Rekha",   address:"Udhna, Surat",     mobile1:"9876543221", gender:"Male",   religion:"Hindu", category:"General", aadhar:"5678 9012 3456", aadharName:"Rahul Kumar", grNo:"GR-012" }),
  mkSt({ id:13, enrollNo:"SS-0013", firstName:"Anjali", lastName:"Mishra",   cls:"10th",          section:"A", dob:"2009-11-05", fatherName:"Rajan",   motherName:"Usha",    address:"Dumas, Surat",     mobile1:"9876543222", gender:"Female", religion:"Hindu", category:"General", aadhar:"6789 0123 4567", aadharName:"Anjali Mishra", grNo:"GR-013" }),
  mkSt({ id:14, enrollNo:"SS-0014", firstName:"Varun",  lastName:"Pillai",   cls:"11th Commerce", section:"A", dob:"2008-04-18", fatherName:"Vijay",   motherName:"Latha",   address:"Adajan, Surat",    mobile1:"9876543223", gender:"Male",   religion:"Hindu", category:"OBC",    aadhar:"7890 1234 5678", aadharName:"Varun Pillai",  grNo:"GR-014", udise:"123456789012345678" }),
  mkSt({ id:15, enrollNo:"SS-0015", firstName:"Neha",   lastName:"Pandey",   cls:"12th Commerce", section:"A", dob:"2007-08-22", fatherName:"Ravi",    motherName:"Sarita",  address:"Piplod, Surat",    mobile1:"9876543224", gender:"Female", religion:"Hindu", category:"General", aadhar:"8901 2345 6789", aadharName:"Neha Pandey",   grNo:"GR-015" }),
  mkSt({ id:16, enrollNo:"SS-0016", firstName:"Dev",    lastName:"Agarwal",  cls:"10th",          section:"B", dob:"2009-05-10", fatherName:"Anil",    motherName:"Manju",   address:"Katargam, Surat",  mobile1:"9876543225", gender:"Male",   religion:"Hindu", category:"General" }),
  mkSt({ id:17, enrollNo:"SS-0017", firstName:"Riya",   lastName:"Bhat",     cls:"9th",           section:"A", dob:"2010-02-14", fatherName:"Mohan",   motherName:"Savita",  address:"Varachha, Surat",  mobile1:"9876543226", gender:"Female", religion:"Hindu", category:"SC"      }),
  mkSt({ id:18, enrollNo:"SS-0018", firstName:"Aryan",  lastName:"Jain",     cls:"8th",           section:"B", dob:"2011-10-28", fatherName:"Dinesh",  motherName:"Seema",   address:"Majura, Surat",    mobile1:"9876543227", gender:"Male",   religion:"Jain",  category:"Jain"    }),
  mkSt({ id:19, enrollNo:"SS-0019", firstName:"Sia",    lastName:"Kapoor",   cls:"5th",           section:"A", dob:"2014-07-03", fatherName:"Rakesh",  motherName:"Pooja",   address:"Citylight, Surat", mobile1:"9876543228", gender:"Female", religion:"Hindu", category:"General" }),
  mkSt({ id:20, enrollNo:"SS-0020", firstName:"Harsh",  lastName:"Chawla",   cls:"7th",           section:"A", dob:"2012-12-19", fatherName:"Naresh",  motherName:"Parvati", address:"Vesu, Surat",      mobile1:"9876543229", gender:"Male",   religion:"Hindu", category:"OBC"     }),
  mkSt({ id:21, enrollNo:"SS-0021", firstName:"Tara",   lastName:"Menon",    cls:"6th",           section:"B", dob:"2013-03-27", fatherName:"Suresh",  motherName:"Geetha",  address:"Pal, Surat",       mobile1:"9876543230", gender:"Female", religion:"Hindu", category:"General" }),
  mkSt({ id:22, enrollNo:"SS-0022", firstName:"Yash",   lastName:"Patil",    cls:"4th",           section:"B", dob:"2015-08-11", fatherName:"Ganesh",  motherName:"Lalita",  address:"Athwa, Surat",     mobile1:"9876543231", gender:"Male",   religion:"Hindu", category:"OBC"     }),
  mkSt({ id:23, enrollNo:"SS-0023", firstName:"Kriti",  lastName:"Sharma",   cls:"3rd",           section:"B", dob:"2016-01-04", fatherName:"Bharat",  motherName:"Divya",   address:"Bhatar, Surat",    mobile1:"9876543232", gender:"Female", religion:"Hindu", category:"General" }),
  mkSt({ id:24, enrollNo:"SS-0024", firstName:"Aarav",  lastName:"Yadav",    cls:"2nd",           section:"A", dob:"2017-11-16", fatherName:"Hemant",  motherName:"Kanchan", address:"Rander, Surat",    mobile1:"9876543233", gender:"Male",   religion:"Hindu", category:"ST"      }),
  mkSt({ id:25, enrollNo:"SS-0025", firstName:"Mishka", lastName:"Soni",     cls:"1st",           section:"B", dob:"2018-06-29", fatherName:"Ajay",    motherName:"Aarti",   address:"Udhna, Surat",     mobile1:"9876543234", gender:"Female", religion:"Hindu", category:"General" }),
];

const FEES_STRUCTURE_EDIT = [
  { cls:"JR KG",         tuition:12000, transport:2500, activity:1200, exam:500  },
  { cls:"SR KG",         tuition:12000, transport:2500, activity:1200, exam:500  },
  { cls:"Balvatika",     tuition:12500, transport:2500, activity:1500, exam:500  },
  { cls:"1st",           tuition:13000, transport:3000, activity:1500, exam:500  },
  { cls:"2nd",           tuition:13200, transport:3000, activity:1500, exam:500  },
  { cls:"3rd",           tuition:13500, transport:3000, activity:1500, exam:500  },
  { cls:"4th",           tuition:13800, transport:3000, activity:1500, exam:500  },
  { cls:"5th",           tuition:14000, transport:3000, activity:1800, exam:700  },
  { cls:"6th",           tuition:14500, transport:3000, activity:1800, exam:700  },
  { cls:"7th",           tuition:14500, transport:3000, activity:1800, exam:700  },
  { cls:"8th",           tuition:15000, transport:3500, activity:2000, exam:800  },
  { cls:"9th",           tuition:15500, transport:3500, activity:2000, exam:800  },
  { cls:"10th",          tuition:16000, transport:3500, activity:2000, exam:1000 },
  { cls:"11th Commerce", tuition:17000, transport:3500, activity:2000, exam:1000 },
  { cls:"12th Commerce", tuition:17000, transport:3500, activity:2000, exam:1000 },
];

const DUMMY_FEE_RECORDS = [
  { id:1,  enrollNo:"SS-0001", name:"Arjun Patel",   cls:"JR KG",         tuition:12000, transport:2500, activity:1200, exam:500,  discount:0,    paid:10000 },
  { id:2,  enrollNo:"SS-0002", name:"Diya Shah",     cls:"SR KG",         tuition:12000, transport:2500, activity:1200, exam:500,  discount:500,  paid:15700 },
  { id:3,  enrollNo:"SS-0003", name:"Vivaan Mehta",  cls:"Balvatika",     tuition:12500, transport:2500, activity:1500, exam:500,  discount:0,    paid:7500  },
  { id:4,  enrollNo:"SS-0004", name:"Anaya Desai",   cls:"1st",           tuition:13000, transport:3000, activity:1500, exam:500,  discount:1000, paid:18000 },
  { id:5,  enrollNo:"SS-0005", name:"Rohan Joshi",   cls:"2nd",           tuition:13200, transport:3000, activity:1500, exam:500,  discount:0,    paid:10000 },
  { id:6,  enrollNo:"SS-0006", name:"Ishaan Trivedi",cls:"3rd",           tuition:13500, transport:3000, activity:1500, exam:500,  discount:0,    paid:18500 },
  { id:7,  enrollNo:"SS-0007", name:"Priya Verma",   cls:"4th",           tuition:13800, transport:3000, activity:1500, exam:500,  discount:500,  paid:12000 },
  { id:8,  enrollNo:"SS-0008", name:"Aditya Rao",    cls:"5th",           tuition:14000, transport:3000, activity:1800, exam:700,  discount:0,    paid:9500  },
  { id:9,  enrollNo:"SS-0009", name:"Sneha Gupta",   cls:"6th",           tuition:14500, transport:3000, activity:1800, exam:700,  discount:0,    paid:20000 },
  { id:10, enrollNo:"SS-0010", name:"Karan Nair",    cls:"7th",           tuition:14500, transport:3000, activity:1800, exam:700,  discount:0,    paid:14500 },
  { id:11, enrollNo:"SS-0011", name:"Pooja Singh",   cls:"8th",           tuition:15000, transport:3500, activity:2000, exam:800,  discount:2000, paid:19300 },
  { id:12, enrollNo:"SS-0012", name:"Rahul Kumar",   cls:"9th",           tuition:15500, transport:3500, activity:2000, exam:800,  discount:0,    paid:21800 },
  { id:13, enrollNo:"SS-0013", name:"Anjali Mishra", cls:"10th",          tuition:16000, transport:3500, activity:2000, exam:1000, discount:0,    paid:15000 },
  { id:14, enrollNo:"SS-0014", name:"Varun Pillai",  cls:"11th Commerce", tuition:17000, transport:3500, activity:2000, exam:1000, discount:500,  paid:23000 },
  { id:15, enrollNo:"SS-0015", name:"Neha Pandey",   cls:"12th Commerce", tuition:17000, transport:3500, activity:2000, exam:1000, discount:0,    paid:12000 },
];

const DUMMY_ASSETS = [
  { id:1, name:"Canon EOS R50 Camera", category:"Camera",   status:"In Use",    holder:"Rajesh Sir",      location:"AV Room"  },
  { id:2, name:"Wireless Mic Set",     category:"Audio",    status:"Available", holder:null,              location:"Store"    },
  { id:3, name:"DJI Osmo Gimbal",      category:"Camera",   status:"Available", holder:null,              location:"AV Room"  },
  { id:4, name:"MacBook Pro 14\"",     category:"Laptop",   status:"In Use",    holder:"Office Staff",    location:"Office"   },
  { id:5, name:"Projector Epson",      category:"Display",  status:"Available", holder:null,              location:"Hall"     },
  { id:6, name:"Ring Light",           category:"Lighting", status:"In Use",    holder:"Photography Club",location:"Studio"   },
  { id:7, name:"iPad (10th gen)",      category:"Tablet",   status:"Available", holder:null,              location:"Library"  },
  { id:8, name:"DSLR Lens 50mm",       category:"Camera",   status:"Available", holder:null,              location:"AV Room"  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAadhar(val) {
  const d = val.replace(/\D/g, "").slice(0, 12);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function renderInput(f, value, onChange) {
  if (f.type === "photo") {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 flex-shrink-0">
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="" className="w-full h-full object-cover" />
            : <Camera className="w-5 h-5 text-gray-300" />}
        </div>
        <div>
          <span className="text-xs text-school-navy font-semibold hover:underline block">{value ? "Change Photo" : "Upload Photo"}</span>
          <span className="text-[10px] text-gray-400">JPG / PNG</span>
        </div>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => { const file = e.target.files[0]; if (file) onChange(URL.createObjectURL(file)); }} />
      </label>
    );
  }
  if (f.type === "select") {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white">
        <option value="">Select...</option>
        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "aadhar") {
    return (
      <input type="text" maxLength={14} value={value || ""} onChange={(e) => onChange(fmtAadhar(e.target.value))}
        placeholder="XXXX XXXX XXXX"
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy tracking-widest font-mono" />
    );
  }
  return (
    <input type={f.type === "date" ? "date" : "text"} value={value || ""} onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${f.label.toLowerCase()}...`}
      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
  );
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
    { key:"management", title:"Management Head",  desc:"Full system access — student, fees, inventory & staff management", icon:Crown,  gradient:"from-amber-500 to-amber-600", selectedBorder:"border-amber-500", iconBg:"bg-amber-50",  iconColor:"text-amber-600", badge:"bg-amber-50 text-amber-700", members:MGMT_USERS   },
    { key:"senior",     title:"Senior Admin",      desc:"Protected student field access — name, DOB, govt IDs & bulk updates", icon:Shield, gradient:"from-blue-500 to-blue-700",   selectedBorder:"border-blue-500",  iconBg:"bg-blue-50",   iconColor:"text-blue-600",  badge:"bg-blue-50 text-blue-700",   members:SENIOR_USERS },
  ];

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center py-8 px-4">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-school-navy rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Super Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Select your role to continue</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-6">
        {roles.map(({ key, title, desc, icon:Icon, gradient, selectedBorder, iconBg, iconColor, badge, members }) => {
          const isSelected = role === key;
          return (
            <button key={key} onClick={() => selectRole(key)}
              className={`text-left p-6 rounded-2xl border-2 transition-all shadow-sm ${isSelected ? `${selectedBorder} bg-gradient-to-br ${gradient} shadow-lg` : "border-gray-200 bg-white hover:shadow-md hover:border-gray-300"}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${isSelected ? "bg-white/20" : iconBg}`}>
                <Icon className={`w-6 h-6 ${isSelected ? "text-white" : iconColor}`} />
              </div>
              <h3 className={`font-bold text-base ${isSelected ? "text-white" : "text-gray-800"}`}>{title}</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isSelected ? "text-white/75" : "text-gray-500"}`}>{desc}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {members.map((u) => (
                  <span key={u.name} className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isSelected ? "bg-white/20 text-white" : badge}`}>{u.name}</span>
                ))}
              </div>
              {isSelected && (
                <div className="flex items-center gap-1 mt-3 text-white/80">
                  <Check className="w-3.5 h-3.5" /><span className="text-[11px] font-semibold">Selected</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

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
                <input type={showPwd ? "text" : "password"} value={pwd}
                  onChange={(e) => { setPwd(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full px-3.5 pr-11 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors" />
                <button onClick={() => setShowPwd((p) => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
              </p>
            )}
            <button onClick={handleLogin} disabled={loading}
              className="w-full py-2.5 rounded-xl bg-school-navy hover:bg-school-navy-dark text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                : <><ShieldCheck className="w-4 h-4" /> Sign In Securely</>}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-4">
            Demo — {role === "management" ? "sunil123 · rajesh123" : "meena123 · kiran123"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Single Student Tool ───────────────────────────────────────────────────────
function SingleStudentTool({ students }) {
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [openGroups, setOpenGroups] = useState(FIELD_GROUPS.map((g) => g.group));

  const filtered = search.length >= 2
    ? students.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        s.enrollNo.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const selectStudent = (s) => { setSelected(s); setForm({ ...s }); setSearch(""); };
  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const toggleGroup = (g) => setOpenGroups((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);

  const handleSave = () => {
    setSaveStatus("saving");
    setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 2500); }, 800);
  };

  const SaveBtn = ({ sm }) => (
    <button onClick={handleSave}
      className={`flex items-center gap-1.5 ${sm ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"} rounded-xl font-semibold transition-all shadow-sm ${
        saveStatus === "saved" ? "bg-green-600 text-white" : "bg-school-navy hover:bg-school-navy-dark text-white"
      }`}>
      {saveStatus === "saving"
        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
        : saveStatus === "saved"
        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
        : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Find Student</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or enroll number..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {filtered.map((s) => (
              <button key={s.id} onClick={() => selectStudent(s)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-school-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {s.firstName[0]}{s.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{s.firstName} {s.lastName}</p>
                  <p className="text-xs text-gray-500">{s.enrollNo} · {s.cls} {s.section}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {search.length >= 2 && filtered.length === 0 && (
          <p className="text-xs text-gray-400 mt-2 px-1">No students found</p>
        )}
      </div>

      {/* Edit form */}
      {selected && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-school-navy flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {form.firstName?.[0]}{form.lastName?.[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{form.firstName} {form.lastName}</p>
                <p className="text-xs text-gray-500">{form.enrollNo} · {form.cls} {form.section}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setSelected(null); setForm({}); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
              <SaveBtn sm />
            </div>
          </div>

          {FIELD_GROUPS.map((grp) => {
            const isOpen = openGroups.includes(grp.group);
            return (
              <div key={grp.group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleGroup(grp.group)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{grp.group}</p>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                      {grp.fields.map((f) => (
                        <div key={f.key} className={f.type === "photo" || f.key === "address" ? "sm:col-span-2" : ""}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                          {renderInput(f, form[f.key], (val) => setField(f.key, val))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-1">
            <SaveBtn />
          </div>
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

  const scopedStudents = scopeType === "all" ? allStudents : allStudents.filter((s) => s.cls === selectedClass);
  const displayStudents = search
    ? tableData.filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.enrollNo.toLowerCase().includes(search.toLowerCase()))
    : tableData;

  const selectedFieldConfigs = BULK_FIELDS.filter((f) => selectedFields.includes(f.key));

  const goStep2 = () => { if (!scopeType || (scopeType === "class" && !selectedClass)) return; setStep(2); setSelectedFields([]); };
  const goStep3 = () => { if (!selectedFields.length) return; setTableData(scopedStudents.map((s) => ({ ...s }))); setBatchValues({}); setSearch(""); setStep(3); };
  const toggleField = (key) => setSelectedFields((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  const updateCell = (id, key, val) => setTableData((p) => p.map((r) => r.id === id ? { ...r, [key]: val } : r));
  const applyToAll = (key) => { const val = batchValues[key] ?? ""; setTableData((p) => p.map((r) => ({ ...r, [key]: val }))); };
  const handleSave = () => { setSaveStatus("saving"); setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 2500); }, 900); };
  const reset = () => { setStep(1); setScopeType(null); setSelectedClass(""); setSelectedFields([]); setTableData([]); setSearch(""); setSaveStatus(null); };

  const STEPS = [{ n:1, label:"Select Scope" }, { n:2, label:"Select Fields" }, { n:3, label:"Update Records" }];

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-start">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${step > s.n ? "bg-green-500 border-green-500 text-white" : step === s.n ? "bg-school-navy border-school-navy text-white" : "bg-white border-gray-200 text-gray-400"}`}>
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <p className={`text-[11px] font-semibold mt-1.5 text-center ${step === s.n ? "text-school-navy" : step > s.n ? "text-green-600" : "text-gray-400"}`}>{s.label}</p>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mt-4 mx-2 ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Scope */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Select Student Scope</h3>
          <p className="text-xs text-gray-500 mb-5">Choose which students to include in the update</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {[
              { key:"all",   label:"All Students", desc:`${allStudents.length} students across all classes`, icon:Users  },
              { key:"class", label:"By Class",      desc:"Select a specific class",                          icon:Search },
            ].map(({ key, label, desc, icon:Icon }) => (
              <button key={key} onClick={() => { setScopeType(key); if (key === "all") setSelectedClass(""); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${scopeType === key ? "border-school-navy bg-school-navy/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
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
                {CLASSES.map((c) => { const cnt = allStudents.filter((s) => s.cls === c).length; return <option key={c} value={c}>{c} — {cnt} student{cnt !== 1 ? "s" : ""}</option>; })}
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
          <button onClick={goStep2} disabled={!scopeType || (scopeType === "class" && !selectedClass)}
            className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm">
            Next: Select Fields <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Field Selection (grouped) */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-800">Select Fields to Update</h3>
            <button onClick={() => setStep(1)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
          </div>
          <p className="text-xs text-gray-500 mb-5">Pick one or more fields across all {scopedStudents.length} students</p>

          <div className="space-y-5 mb-5">
            {FIELD_GROUPS.map((grp) => (
              <div key={grp.group}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{grp.group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {grp.fields.map(({ key, label, icon:Icon }) => {
                    const active = selectedFields.includes(key);
                    return (
                      <button key={key} onClick={() => toggleField(key)}
                        className={`relative flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${active ? "border-school-navy bg-school-navy/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                        {active && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-school-navy rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-school-navy" : "bg-gray-100"}`}>
                          <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-gray-500"}`} />
                        </div>
                        <p className={`text-[11px] font-semibold leading-tight ${active ? "text-school-navy" : "text-gray-600"}`}>{label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedFields.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-school-navy text-white text-xs font-bold rounded-full">{selectedFields.length}</span>
              <span className="text-xs text-gray-600">field{selectedFields.length !== 1 ? "s" : ""} selected</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={goStep3} disabled={selectedFields.length === 0}
              className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shadow-sm">
              Open Update Table <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Table */}
      {step === 3 && (
        <div className="space-y-4">
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
                <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Start Over
                </button>
                <button onClick={handleSave}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${saveStatus === "saved" ? "bg-green-600 text-white" : "bg-school-navy hover:bg-school-navy-dark text-white"}`}>
                  {saveStatus === "saving" ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                    : saveStatus === "saved" ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                    : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors"
                placeholder="Search by name or enroll no..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <select value={batchValues[f.key] || ""} onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="text-xs border-0 outline-none bg-transparent text-gray-800 min-w-[90px]">
                      <option value="">Pick...</option>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "aadhar" ? (
                    <input className="text-xs border-0 outline-none bg-transparent text-gray-800 w-[120px] tracking-widest font-mono"
                      placeholder="XXXX XXXX XXXX" maxLength={14}
                      value={batchValues[f.key] || ""}
                      onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: fmtAadhar(e.target.value) }))} />
                  ) : (
                    <input type={f.type === "date" ? "date" : "text"}
                      className="text-xs border-0 outline-none bg-transparent text-gray-800 w-[110px]"
                      placeholder="Enter value..." value={batchValues[f.key] || ""}
                      onChange={(e) => setBatchValues((p) => ({ ...p, [f.key]: e.target.value }))} />
                  )}
                  <button onClick={() => applyToAll(f.key)}
                    className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap flex-shrink-0">
                    <ArrowDown className="w-2.5 h-2.5" /> All
                  </button>
                </div>
              ))}
              {selectedFieldConfigs.every((f) => f.type === "photo") && (
                <p className="text-xs text-amber-600 italic">Batch fill not applicable for Profile Photo — upload individually below.</p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[520px]">
              <table className="text-xs border-collapse" style={{ minWidth:"100%" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="sticky left-0 z-30 bg-gray-50 text-left px-4 py-3 text-[11px] font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap" style={{ minWidth:96 }}>Enroll No</th>
                    <th className="sticky bg-gray-50 z-30 text-left px-4 py-3 text-[11px] font-semibold text-gray-500 border-r border-gray-200 whitespace-nowrap" style={{ left:96, minWidth:160 }}>Student Name</th>
                    <th className="bg-gray-50 text-left px-3 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap" style={{ minWidth:90 }}>Class</th>
                    {selectedFieldConfigs.map((f) => (
                      <th key={f.key} className="bg-gray-50 text-left px-3 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap"
                        style={{ minWidth: f.type === "aadhar" ? 155 : f.type === "date" ? 145 : f.key === "address" || f.key === "lastSchoolName" ? 190 : f.key === "udise" ? 165 : 135 }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayStudents.length === 0 && (
                    <tr><td colSpan={3 + selectedFieldConfigs.length} className="text-center py-10 text-gray-400">No students found</td></tr>
                  )}
                  {displayStudents.map((student, i) => {
                    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                    return (
                      <tr key={student.id} className="hover:bg-blue-50/40 transition-colors border-b border-gray-50">
                        <td className="sticky left-0 z-10 px-4 py-3 border-r border-gray-100 whitespace-nowrap" style={{ backgroundColor:bg, minWidth:96 }}>
                          <span className="font-mono text-gray-500">{student.enrollNo}</span>
                        </td>
                        <td className="sticky z-10 px-4 py-3 border-r border-gray-100 whitespace-nowrap" style={{ left:96, backgroundColor:bg, minWidth:160 }}>
                          <p className="font-semibold text-gray-800">{student.firstName} {student.lastName}</p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap" style={{ minWidth:90 }}>
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
                                  onChange={(e) => { const file = e.target.files[0]; if (file) updateCell(student.id, "photo", URL.createObjectURL(file)); }} />
                              </label>
                            ) : f.type === "select" ? (
                              <select value={student[f.key] || (f.options?.[0] || "")}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white">
                                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : f.type === "aadhar" ? (
                              <input type="text" maxLength={14} value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, fmtAadhar(e.target.value))}
                                placeholder="XXXX XXXX XXXX"
                                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy tracking-widest font-mono w-[143px]" />
                            ) : f.type === "date" ? (
                              <input type="date" value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
                            ) : (
                              <input type="text" value={student[f.key] || ""}
                                onChange={(e) => updateCell(student.id, f.key, e.target.value)}
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                                className={`px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy ${f.key === "address" || f.key === "lastSchoolName" ? "w-[178px]" : f.key === "udise" ? "w-[153px]" : "w-[123px]"}`} />
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
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${saveStatus === "saved" ? "bg-green-600 text-white" : "bg-school-navy hover:bg-school-navy-dark text-white"}`}>
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

// ── Student Records Panel (single + bulk sub-tabs) ────────────────────────────
function StudentRecordsPanel({ students }) {
  const [subTab, setSubTab] = useState("single");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[{ key:"single", label:"Single Student Update" }, { key:"bulk", label:"Bulk Update" }].map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${subTab === key ? "bg-school-navy text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>
      {subTab === "single" ? <SingleStudentTool students={students} /> : <BulkUpdateTool allStudents={students} />}
    </div>
  );
}

// ── Fees Panel (Management Head only) ─────────────────────────────────────────
function FeesPanel() {
  const [view, setView]                     = useState("records");
  const [feeStructure, setFeeStructure]     = useState(FEES_STRUCTURE_EDIT);
  const [feeRecords, setFeeRecords]         = useState(DUMMY_FEE_RECORDS);
  const [editingId, setEditingId]           = useState(null);
  const [editForm, setEditForm]             = useState({});
  const [search, setSearch]                 = useState("");
  const [feeSaveStatus, setFeeSaveStatus]   = useState(null);

  const filteredRecords = search
    ? feeRecords.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.enrollNo.toLowerCase().includes(search.toLowerCase()) || r.cls.toLowerCase().includes(search.toLowerCase()))
    : feeRecords;

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const saveEdit = (id) => { setFeeRecords((p) => p.map((r) => r.id === id ? { ...editForm } : r)); setEditingId(null); };
  const updateStructure = (cls, field, val) => setFeeStructure((p) => p.map((r) => r.cls === cls ? { ...r, [field]: Number(val) || 0 } : r));

  const saveStructure = () => {
    setFeeSaveStatus("saving");
    setTimeout(() => { setFeeSaveStatus("saved"); setTimeout(() => setFeeSaveStatus(null), 2500); }, 700);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[{ key:"records", label:"Student Fee Records" }, { key:"structure", label:"Fee Structure" }].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${view === key ? "bg-school-navy text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Fee Structure */}
      {view === "structure" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Fee Structure by Class — Annual (₹)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Edit fee component amounts per class</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Class","Tuition ₹","Transport ₹","Activity ₹","Exam ₹","Total ₹"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feeStructure.map((row, i) => {
                  const tot = row.tuition + row.transport + row.activity + row.exam;
                  const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                  return (
                    <tr key={row.cls} style={{ backgroundColor:bg }} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{row.cls}</td>
                      {["tuition","transport","activity","exam"].map((field) => (
                        <td key={field} className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-xs">₹</span>
                            <input type="number" min={0} value={row[field]}
                              onChange={(e) => updateStructure(row.cls, field, e.target.value)}
                              className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-2.5 font-bold text-school-navy whitespace-nowrap">₹{tot.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
            <button onClick={saveStructure}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-colors shadow-sm ${feeSaveStatus === "saved" ? "bg-green-600 text-white" : "bg-school-navy hover:bg-school-navy-dark text-white"}`}>
              {feeSaveStatus === "saving" ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                : feeSaveStatus === "saved" ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                : <><Save className="w-3.5 h-3.5" /> Save Fee Structure</>}
            </button>
          </div>
        </div>
      )}

      {/* Student Fee Records */}
      {view === "records" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, enroll no, or class..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[560px]">
              <table className="text-xs border-collapse" style={{ minWidth:"100%" }}>
                <thead className="sticky top-0 z-10 bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    {["Enroll","Student","Class","Tuition ₹","Transport ₹","Activity ₹","Exam ₹","Discount ₹","Net Total ₹","Paid ₹","Balance ₹","Status","Action"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, i) => {
                    const isEditing = editingId === r.id;
                    const d = isEditing ? editForm : r;
                    const tot = d.tuition + d.transport + d.activity + d.exam;
                    const net = tot - d.discount;
                    const bal = net - d.paid;
                    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
                    const statusColor = bal <= 0 ? "bg-green-50 text-green-700" : d.paid > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
                    const statusLabel = bal <= 0 ? "Paid" : d.paid > 0 ? "Partial" : "Unpaid";
                    const numInput = (field) => (
                      <input type="number" min={0} value={editForm[field] || 0}
                        onChange={(e) => setEditForm((p) => ({ ...p, [field]: Number(e.target.value) || 0 }))}
                        className="w-20 px-2 py-1.5 border border-school-navy/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-school-navy/20" />
                    );
                    return (
                      <tr key={r.id} style={{ backgroundColor:bg }} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">{r.enrollNo}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">{r.cls}</span></td>
                        <td className="px-3 py-2">{isEditing ? numInput("tuition")   : <span className="text-gray-700">₹{r.tuition.toLocaleString()}</span>}</td>
                        <td className="px-3 py-2">{isEditing ? numInput("transport") : <span className="text-gray-700">₹{r.transport.toLocaleString()}</span>}</td>
                        <td className="px-3 py-2">{isEditing ? numInput("activity")  : <span className="text-gray-700">₹{r.activity.toLocaleString()}</span>}</td>
                        <td className="px-3 py-2">{isEditing ? numInput("exam")      : <span className="text-gray-700">₹{r.exam.toLocaleString()}</span>}</td>
                        <td className="px-3 py-2">{isEditing ? numInput("discount")  : <span className="text-green-600 font-semibold">₹{r.discount.toLocaleString()}</span>}</td>
                        <td className="px-4 py-3 font-bold text-school-navy whitespace-nowrap">₹{net.toLocaleString()}</td>
                        <td className="px-3 py-2">{isEditing ? numInput("paid")      : <span className="text-gray-700">₹{r.paid.toLocaleString()}</span>}</td>
                        <td className={`px-4 py-3 font-bold whitespace-nowrap ${bal <= 0 ? "text-green-600" : "text-red-500"}`}>{bal <= 0 ? "₹0" : `₹${bal.toLocaleString()}`}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColor}`}>{statusLabel}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => saveEdit(r.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-school-navy text-white text-[10px] font-bold rounded-lg hover:bg-school-navy-dark transition-colors">
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button onClick={cancelEdit} className="p-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(r)} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-600 text-[10px] font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inventory Panel (Management Head only) ────────────────────────────────────
function InventoryPanel() {
  const [assets, setAssets] = useState(DUMMY_ASSETS);
  const [search, setSearch] = useState("");

  const filtered = search ? assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase())) : assets;

  const toggleStatus = (id) => {
    setAssets((p) => p.map((a) => a.id === id
      ? { ...a, status: a.status === "Available" ? "In Use" : "Available", holder: a.status === "Available" ? "Assigned" : null }
      : a
    ));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold">Total: {assets.length}</span>
          <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold">Available: {assets.filter((a) => a.status === "Available").length}</span>
          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">In Use: {assets.filter((a) => a.status === "In Use").length}</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Asset","Category","Status","Holder","Location","Action"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
              return (
                <tr key={a.id} style={{ backgroundColor:bg }} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{a.name}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded-full">{a.category}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${a.status === "Available" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{a.status}</span></td>
                  <td className="px-4 py-3 text-gray-600">{a.holder || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{a.location}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(a.id)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors border ${a.status === "Available" ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200" : "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"}`}>
                      {a.status === "Available" ? "Take" : "Return"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab]     = useState("students");
  const [students]                    = useState(DUMMY_STUDENTS);

  const handleLogin  = (user) => { setLoggedIn(true); setCurrentUser(user); setActiveTab("students"); };
  const handleLogout = ()     => { setLoggedIn(false); setCurrentUser(null); };

  if (!loggedIn) return <LoginView onLogin={handleLogin} />;

  const isMgmt   = currentUser.role === "management";
  const RoleIcon = isMgmt ? Crown : Shield;

  const mgmtTabs = [
    { key:"students",  label:"Student Records",  icon:GraduationCap },
    { key:"fees",      label:"Fees Management",  icon:IndianRupee   },
    { key:"inventory", label:"Inventory",        icon:Package       },
  ];

  return (
    <div className="space-y-5">
      {/* Session header */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-2xl shadow-md ${isMgmt ? "bg-gradient-to-r from-amber-500 to-amber-600" : "bg-gradient-to-r from-blue-600 to-blue-700"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <RoleIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{currentUser.name}</p>
            <p className="text-white/65 text-xs">{isMgmt ? "Management Head" : "Senior Admin"} · Super Admin Panel</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-colors border border-white/20">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Management Head tab bar */}
      {isMgmt && (
        <div className="flex gap-2 flex-wrap">
          {mgmtTabs.map(({ key, label, icon:Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${activeTab === key ? "bg-school-navy text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {(!isMgmt || activeTab === "students")   && <StudentRecordsPanel students={students} />}
      {isMgmt && activeTab === "fees"          && <FeesPanel />}
      {isMgmt && activeTab === "inventory"     && <InventoryPanel />}
    </div>
  );
}
