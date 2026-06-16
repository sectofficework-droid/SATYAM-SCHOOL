"use client";

import { useState, useRef } from "react";
import {
  ShieldCheck, Crown, Shield, LogOut, Eye, EyeOff,
  Camera, Calendar, CreditCard, MapPin, User, Tag,
  AlertCircle, CheckCircle2, Save, Search, RefreshCw,
  ChevronRight, Users, Check, Phone, Hash, GraduationCap,
  IndianRupee, Package, Pencil, X, Plus, ChevronDown,
  ChevronUp, BookOpen, Briefcase, History, Trash2,
  ClipboardList, Flag, Upload, FileText, Download, Filter,
} from "lucide-react";
import useStore from "@/lib/store";
import {
  isValidName, isValidPhone, isValidEmail, isValidAadhar, isValidPincode,
  isNonNegativeNumber,
} from "@/lib/validators";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

const MGMT_USERS   = [{ name:"Sunil Pradhan", password:"sunil123", initials:"SP" }];
const SENIOR_USERS = [{ name:"Rajesh Biswal", password:"rajesh123", initials:"RB" },{ name:"BK Debiprasad Das", password:"bkdas123", initials:"BD" }];

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
  "Photo":           { activeCls:"bg-pink-500 border-pink-500",      iconBg:"bg-pink-100",    iconColor:"text-pink-500"    },
  "Documents":       { activeCls:"bg-cyan-600 border-cyan-600",      iconBg:"bg-cyan-100",    iconColor:"text-cyan-600"    },
};

const MODULE_THEMES = {
  students:  { tabBg:"bg-blue-600",   tabActive:"bg-blue-600 text-white",   banner:"bg-gradient-to-r from-blue-600 to-blue-700",    ring:"focus:ring-blue-400"   },
  fees:      { tabBg:"bg-emerald-600",tabActive:"bg-emerald-600 text-white",banner:"bg-gradient-to-r from-emerald-600 to-teal-700",  ring:"focus:ring-emerald-400" },
  inventory: { tabBg:"bg-amber-500",  tabActive:"bg-amber-500 text-white",  banner:"bg-gradient-to-r from-amber-500 to-orange-600",  ring:"focus:ring-amber-400"   },
  employee:  { tabBg:"bg-purple-600", tabActive:"bg-purple-600 text-white", banner:"bg-gradient-to-r from-purple-600 to-violet-700", ring:"focus:ring-purple-400"  },
  salary:    { tabBg:"bg-green-700",  tabActive:"bg-green-700 text-white",  banner:"bg-gradient-to-r from-green-700 to-emerald-800", ring:"focus:ring-green-400"   },
};

const MGMT_MODULES = [
  { key:"students",  label:"Student Records",  icon:GraduationCap, stats:["25 Students","15 Classes","All Active"]          },
  { key:"fees",      label:"Fees Management",  icon:IndianRupee,   stats:["₹3.2L Collected","₹48K Pending","15 Records"]    },
  { key:"inventory", label:"Inventory",        icon:Package,       stats:["8 Assets","6 Item Types","₹2.4L Value"]          },
  { key:"employee",  label:"Employee",         icon:Users,         stats:["12 Staff","8 Teachers","4 Support"]              },
  { key:"salary",    label:"Salary",           icon:IndianRupee,   stats:["Management Only","Auto Expense Sync","Private"]  },
];


const DEFAULT_DOCS = ["Birth Certificate","Student Aadhar Card","Father's Aadhar Card","Mother's Aadhar Card","Leaving Certificate","Marksheet"];

const PHOTO_GROUP = {
  group: "Photo",
  fields: [{ key:"photo", label:"Student Photo", icon:Camera, type:"photo" }],
};
const DOC_FIELDS_GROUP = {
  group: "Documents",
  fields: DEFAULT_DOCS.map(doc => ({
    key: `doc__${doc.replace(/[\s']+/g,"_")}`,
    label: doc,
    icon: FileText,
    type: "doc",
  })),
};

const PENDING_ID_FIELDS = [
  { key:"aadharNo", label:"Aadhar No"  },
  { key:"udise",    label:"UDISE"      },
  { key:"pen",      label:"PEN No"     },
  { key:"apaar",    label:"APAAR ID"   },
];

const INVENTORY_ITEMS = ["Bag","Uniform Set","Book Set","Notebook Set","School Diary","ID Card"];
const EMP_ROLES    = ["Teacher","Admin Staff","Principal","Vice Principal","Lab Assistant","Librarian","Peon","Guard","Cook","Driver"];
const EMP_STATUSES = ["Active","On Leave","Resigned"];
const ASSET_ACTIONS = ["Purchased","Assigned","Returned","Serviced","Repaired","Moved","Disposed"];

// â"€â"€ Dummy data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
  { id:1,item:"Bag",   price:450, total:150,issued:120},{ id:2,item:"Uniform Set",      price:850, total:200,issued:185},
  { id:3,item:"Book Set",    price:1200,total:300,issued:252},{ id:4,item:"Notebook Set",    price:180, total:500,issued:420},
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

// â"€â"€ Shared cell renderer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Detects the semantic type of a free-text field from its key/label so the
// spreadsheet editor can flag obviously invalid values without blocking typing.
function detectFieldKind(field) {
  const probe = `${field.key} ${field.label}`.toLowerCase();
  if (probe.includes("aadhar")) return "aadhar";
  if (probe.includes("pincode") || probe.includes("pin code")) return "pincode";
  if (probe.includes("mobile") || probe.includes("phone")) return "phone";
  if (probe.includes("email")) return "email";
  return null;
}

function isFieldValueValid(kind, value) {
  if (!value) return true; // empty stays neutral — only flag once something is typed
  switch (kind) {
    case "aadhar":  return isValidAadhar(value);
    case "pincode": return isValidPincode(value);
    case "phone":   return isValidPhone(value);
    case "email":   return isValidEmail(value);
    default:        return true;
  }
}

function FieldCell({ field, value, onChange, compact, error }) {
  const fileRef = useRef(null);
  const [touched, setTouched] = useState(false);

  const kind         = detectFieldKind(field);
  const selfInvalid  = kind && touched && !isFieldValueValid(kind, value);
  const isInvalid    = Boolean(error) || selfInvalid;
  const invalidMsg   = error || (selfInvalid ? `Invalid ${field.label.toLowerCase()}` : "");

  const cls = `${compact
    ? "border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-school-navy bg-white w-full"
    : "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy bg-white w-full"
  } ${isInvalid ? "border-red-400" : "border-gray-200"}`;

  if (field.type === "photo") {
    return (
      <div className="flex items-center gap-2 min-w-28">
        <input type="file" accept="image/*" className="hidden" ref={fileRef}
          onChange={e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => onChange(ev.target.result);
            reader.readAsDataURL(file);
          }}/>
        {value
          ? <img src={value} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0"/>
          : <div className="w-8 h-8 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
              <Camera className="w-3.5 h-3.5 text-gray-300"/>
            </div>}
        <button type="button" onClick={() => fileRef.current?.click()}
          className={`text-[10px] px-2 py-1 rounded border font-semibold whitespace-nowrap transition-colors ${value ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-gray-300 text-gray-500 hover:border-pink-400 hover:text-pink-600"}`}>
          {value ? "Change" : "Upload"}
        </button>
      </div>
    );
  }

  if (field.type === "doc") {
    const isUploaded = value === "uploaded";
    return (
      <div className="flex items-center gap-1.5 min-w-24">
        <input type="file" accept=".pdf,image/*" className="hidden" ref={fileRef}
          onChange={e => { if (e.target.files[0]) onChange("uploaded"); }}/>
        <button type="button" onClick={() => onChange(isUploaded ? "" : "uploaded")}
          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${isUploaded ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}>
          {isUploaded && <Check className="w-2.5 h-2.5 text-white"/>}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}
          className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap transition-colors ${isUploaded ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-gray-300 text-gray-400 hover:border-cyan-400 hover:text-cyan-600"}`}>
          {isUploaded ? "✓ Done" : "Upload"}
        </button>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <select className={cls} value={value || ""} onChange={e => onChange(e.target.value)}>
        {field.options.map(o => <option key={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      className={cls}
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      onBlur={() => setTouched(true)}
      title={invalidMsg || undefined}
    />
  );
}

// â"€â"€ Login â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function LoginView({ onLogin }) {
  const [role,  setRole]  = useState("management");
  const [name,  setName]  = useState("");
  const [pass,  setPass]  = useState("");
  const [showP, setShowP] = useState(false);
  const [error, setError] = useState("");
  const users = role === "management" ? MGMT_USERS : SENIOR_USERS;

  function handleLogin(e) {
    e.preventDefault();
    if (!name.trim() || !pass.trim()) {
      setError("Please enter both fields.");
      return;
    }
    const found = users.find(u => u.name === name && u.password === pass);
    if (found) onLogin({ ...found, role });
    else setError("Invalid credentials.");
  }

  return (
    <div className="-m-4 lg:-m-6 flex items-center justify-center h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-school-navy p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex">

        {/* Left —" branding panel */}
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

        {/* Right —" form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-8">
          {/* Mobile header */}
          <div className="flex md:hidden items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-school-gold rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-gray-800">Super Admin —" Restricted Access</p>
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

// â"€â"€ Single Student Tool (Senior Admin) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const NAME_FIELDS  = ["firstName", "lastName", "fatherName", "motherName", "aadharName"];
const PHONE_FIELDS = ["mobile1", "mobile2"];

function validateStudentForm(form) {
  const errors = {};
  NAME_FIELDS.forEach(key => {
    if (form[key] && !isValidName(form[key])) errors[key] = "Enter a valid name";
  });
  // mobile1 is required; mobile2 is optional
  if (!isValidPhone(form.mobile1)) errors.mobile1 = "Enter a valid 10-digit mobile number";
  if (form.mobile2 && !isValidPhone(form.mobile2)) errors.mobile2 = "Enter a valid 10-digit mobile number";
  if (form.aadharNo && !isValidAadhar(form.aadharNo)) errors.aadharNo = "Enter a valid 12-digit Aadhar number";
  return errors;
}

function SingleStudentTool({ students }) {
  const [selClass, setSelClass] = useState("");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState({});
  const [saved,    setSaved]    = useState(false);
  const [errors,   setErrors]   = useState({});

  const [photo,        setPhoto]        = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [checkedDocs,  setCheckedDocs]  = useState({});
  const [uploadedFiles,setUploadedFiles]= useState({});
  const [customDocs,   setCustomDocs]   = useState([]);
  const photoRef = useRef(null);

  function resetMedia() {
    setPhoto(null); setPhotoPreview(null);
    setCheckedDocs({}); setUploadedFiles({}); setCustomDocs([]);
  }
  function selectStudent(st) { setSelected(st); setForm({...st}); setSaved(false); setErrors({}); resetMedia(); }
  function goBack()           { setSelected(null); resetMedia(); }

  function handleSave() {
    const errs = validateStudentForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  }

  function handlePhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f); setPhotoPreview(URL.createObjectURL(f));
  }
  function toggleDoc(name) {
    const was = checkedDocs[name];
    setCheckedDocs(p=>({...p,[name]:!p[name]}));
    if (was) setUploadedFiles(p=>{ const n={...p}; delete n[name]; return n; });
  }
  function handleDocFile(name, e) {
    const f = e.target.files[0];
    if (f) setUploadedFiles(p=>({...p,[name]:f.name}));
  }
  function addCustomDoc()  { setCustomDocs(p=>[...p,{id:Date.now(),label:""}]); }
  function removeCustomDoc(id) { setCustomDocs(p=>p.filter(d=>d.id!==id)); }

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
        <button onClick={() => { setSelClass(""); setSearch(""); resetMedia(); }} className="text-school-navy text-sm font-semibold">â† Back</button>
        <span className="text-gray-400">/</span>
        <span className="text-sm font-bold text-gray-700">{selClass}</span>
        <span className="ml-auto text-xs text-gray-400">{inClass.length} students</span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" placeholder="Search by name, roll, or enroll no—¦" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-2">
        {inClass.map(st => (
          <button key={st.id} onClick={() => selectStudent(st)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-school-navy hover:bg-school-navy/5 transition-all text-left">
            <div className="w-10 h-10 rounded-full bg-school-gold flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{st.firstName[0]}{st.lastName[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{st.name}</p>
              <p className="text-xs text-gray-400">{st.enrollNo} Â· Roll {st.roll}</p>
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
        <button onClick={goBack} className="text-school-navy text-sm font-semibold">â† Back</button>
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
                    <FieldCell field={field} value={form[field.key]} onChange={v => { setForm({...form,[field.key]:v}); setErrors(p => ({...p, [field.key]:""})); }} error={errors[field.key]} />
                    {errors[field.key] && <p className="text-[11px] text-red-500 mt-1">{errors[field.key]}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* â"€â"€ Photo Upload â"€â"€ */}
      <div className="border-t border-gray-100 pt-5 mt-2">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Student Photo</h4>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 flex-shrink-0">
            {photoPreview ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover"/> : <Camera className="w-7 h-7 text-gray-300"/>}
          </div>
          <div>
            <input ref={photoRef} type="file" accept="image/jpg,image/jpeg,image/png" className="hidden" onChange={handlePhoto}/>
            <button type="button" onClick={()=>photoRef.current.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Upload className="w-4 h-4"/>{photo?"Change Photo":"Upload Photo"}
            </button>
            {photo && <button type="button" onClick={()=>{setPhoto(null);setPhotoPreview(null);}} className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>}
            <p className="text-xs text-gray-400 mt-1.5">JPG or PNG Â· Max 2MB</p>
          </div>
        </div>
      </div>

      {/* â"€â"€ Documents â"€â"€ */}
      <div className="border-t border-gray-100 pt-5">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Documents</h4>
        <div className="space-y-2">
          {DEFAULT_DOCS.map(docName=>(
            <div key={docName} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${checkedDocs[docName]?"bg-blue-50":"bg-white"}`} onClick={()=>toggleDoc(docName)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checkedDocs[docName]?"bg-school-navy border-school-navy":"border-gray-300"}`}>
                  {checkedDocs[docName]&&<Check className="w-2.5 h-2.5 text-white"/>}
                </div>
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                <span className="text-sm text-gray-700">{docName}</span>
                {uploadedFiles[docName]&&<span className="ml-auto text-xs text-green-600 font-medium truncate max-w-[130px]">✓ {uploadedFiles[docName]}</span>}
              </div>
              {checkedDocs[docName]&&(
                <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-school-navy cursor-pointer hover:bg-blue-50">
                    <Upload className="w-3 h-3"/>{uploadedFiles[docName]?"Change File":"Upload File"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e=>handleDocFile(docName,e)}/>
                  </label>
                </div>
              )}
            </div>
          ))}
          {customDocs.map(doc=>(
            <div key={doc.id} className="border border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0"/>
              <input type="text" placeholder="Document name—¦" value={doc.label} onChange={e=>setCustomDocs(p=>p.map(d=>d.id===doc.id?{...d,label:e.target.value}:d))} className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-300"/>
              {doc.label&&(
                <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  <Upload className="w-3 h-3"/>Upload
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e=>handleDocFile(doc.label,e)}/>
                </label>
              )}
              <button type="button" onClick={()=>removeCustomDoc(doc.id)} className="text-gray-300 hover:text-red-400"><X className="w-4 h-4"/></button>
            </div>
          ))}
          <button type="button" onClick={addCustomDoc} className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-school-navy hover:text-school-navy transition-colors">
            <Plus className="w-3.5 h-3.5"/>Add Another Document
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={handleSave} className="flex items-center gap-2 bg-school-navy text-white px-6 py-2.5 rounded-lg text-sm font-semibold"><Save className="w-4 h-4"/>Save Changes</button>
        <button onClick={() => { setForm({...selected}); setErrors({}); resetMedia(); }} className="flex items-center gap-2 border border-gray-200 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold"><RefreshCw className="w-4 h-4"/>Reset</button>
      </div>
    </div>
  );
}

// â"€â"€ Spreadsheet bulk editor (shared logic) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function SpreadsheetEditor({ students, title }) {
  const [selClass,      setSelClass]      = useState("All");
  const [search,        setSearch]        = useState("");
  const [selFields,     setSelFields]     = useState([]);
  const [showPicker,    setShowPicker]    = useState(true);
  const [edits,         setEdits]         = useState({});
  const [saved,         setSaved]         = useState(false);
  const ALL_GROUPS     = [...FIELD_GROUPS, PHOTO_GROUP, DOC_FIELDS_GROUP];
  const ALL_FIELDS_EXT = ALL_GROUPS.flatMap(g => g.fields);

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

  const selectedFields = ALL_FIELDS_EXT.filter(f => selFields.includes(f.key));

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
            {ALL_GROUPS.map(grp => {
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
          <input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy" placeholder="Search student—¦" value={search} onChange={e=>setSearch(e.target.value)}/>
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
          <p className="text-xs text-gray-300 mt-1">Pick from student info, photo, or documents</p>
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
                      <td key={field.key} className="px-2 py-2">
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

// â"€â"€ Fees Panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function FeesPanel() {
  const [feeRecs,  setFeeRecs]  = useState(DUMMY_FEE_RECORDS);
  const [expandId, setExpandId] = useState(null);
  const [editRec,  setEditRec]  = useState(null);
  const [clsF,     setClsF]     = useState("All");
  const [search,   setSearch]   = useState("");
  const [saved,    setSaved]    = useState(false);
  const [feeError, setFeeError] = useState("");

  const filtered = feeRecs.filter(r =>
    (clsF==="All"||r.cls===clsF) &&
    (r.name.toLowerCase().includes(search.toLowerCase())||r.enrollNo.toLowerCase().includes(search.toLowerCase()))
  );

  function openEdit(rec) { setExpandId(rec.id); setEditRec(JSON.parse(JSON.stringify(rec))); setFeeError(""); }

  function saveEdit() {
    const hasNegative = !isNonNegativeNumber(editRec.discount)
      || editRec.payments.some(p => !isNonNegativeNumber(p.amount) || !isNonNegativeNumber(p.paid));
    if (hasNegative) {
      setFeeError("Fee amounts and discount cannot be negative.");
      return;
    }
    setFeeError("");
    setFeeRecs(prev=>prev.map(r=>r.id===editRec.id?editRec:r));
    setSaved(true); setTimeout(()=>setSaved(false),2000);
    setExpandId(null); setEditRec(null);
  }

  // Clamp payment-term amount/paid fields to a non-negative number before they enter state.
  function updatePay(pIdx, key, val) {
    const safeVal = (key === "amount" || key === "paid")
      ? Math.max(0, Math.min(Number(val) || 0, 10000000))
      : val;
    setEditRec(prev => { const p=[...prev.payments]; p[pIdx]={...p[pIdx],[key]:safeVal}; return {...prev,payments:p}; });
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
      <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none" placeholder="Search—¦" value={search} onChange={e=>setSearch(e.target.value)}/></div>
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
                              <h4 className="text-sm font-bold text-gray-800">{rec.name} —" {rec.cls}</h4>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>Annual: ₹{editRec.totalFee.toLocaleString()}</span>
                                <span className="text-orange-600">Discount:
                                  <input type="number" min="0" className="ml-1 w-20 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" value={editRec.discount} onChange={e=>setEditRec({...editRec,discount:Math.max(0, Math.min(Number(e.target.value) || 0, 10000000))})}/>
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
                                        <td className="px-2 py-1.5"><input type="number" min="0" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-20 bg-white" value={p.amount} onChange={e=>updatePay(pIdx,"amount",Number(e.target.value))}/></td>
                                        <td className="px-2 py-1.5"><input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none bg-white" value={p.dueDate} onChange={e=>updatePay(pIdx,"dueDate",e.target.value)}/></td>
                                        <td className="px-2 py-1.5"><input type="number" min="0" className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-20 bg-white" value={p.paid} onChange={e=>updatePay(pIdx,"paid",Number(e.target.value))}/></td>
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
                            {feeError && <p className="text-xs text-red-500 font-semibold mb-2">{feeError}</p>}
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={addPayment} className="flex items-center gap-1.5 border border-dashed border-emerald-400 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-50"><Plus className="w-3.5 h-3.5"/>Add Payment</button>
                              <button onClick={saveEdit} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold"><Save className="w-3.5 h-3.5"/>Save</button>
                              <button onClick={()=>{setExpandId(null);setEditRec(null);setFeeError("");}} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-semibold"><X className="w-3.5 h-3.5"/>Cancel</button>
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
  );
}

// â"€â"€ Inventory Panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function InventoryPanel() {
  const masterItems   = useStore(s => s.studentInventoryItems);
  const addMasterItem = useStore(s => s.addStudentInventoryItem);
  const remMasterItem = useStore(s => s.removeStudentInventoryItem);

  const [tab,        setTab]        = useState("assets");
  const [assets,     setAssets]     = useState(DUMMY_ASSETS);
  const [stock,      setStock]      = useState(DUMMY_STOCK);
  const [stuInv,     setStuInv]     = useState(DUMMY_STUDENT_INVENTORY);
  const [clsF,       setClsF]       = useState("All");
  const [selStu,     setSelStu]     = useState(null);
  const [stuItems,   setStuItems]   = useState([]);
  const [expandId,   setExpandId]   = useState(null);
  const [histMode,   setHistMode]   = useState(null);
  const [stockEdit,  setStockEdit]  = useState(null);
  const [saved,      setSaved]      = useState("");
  const [newItem,    setNewItem]     = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
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
        {[{k:"assets",label:"Assets"},{k:"student",label:"Student Items"},{k:"stock",label:"Stock / Extra"},{k:"master",label:"Item Master"}].map(t=>(
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
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><History className="w-4 h-4 text-purple-600"/>Usage History —" {a.name}</h4>
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
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${it.given?"bg-green-100 text-green-700":"bg-gray-100 text-gray-400"}`}>{it.given?"✓":"âœ—"}</span>
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
          <button onClick={()=>setSelStu(null)} className="text-amber-700 text-sm font-semibold mb-4">â† Back to list</button>
          <h4 className="text-sm font-bold text-gray-800 mb-1">{selStu.name}</h4>
          <p className="text-xs text-gray-400 mb-4">{selStu.cls} Â· {selStu.enrollNo}</p>
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

      {/* Item Master tab — add/delete student inventory items */}
      {tab==="master" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">These are the master item names that appear in every student's profile and fee entry. Deleting an item removes it from the list permanently — only use this when an item is no longer issued to students.</p>
          </div>

          {/* Current items */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Current Items ({masterItems.length})</p>
            {masterItems.length === 0 && (
              <p className="text-sm text-gray-400">No items configured yet.</p>
            )}
            <div className="space-y-2">
              {masterItems.map((name) => (
                <div key={name} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Package className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"/>
                    <span className="text-sm font-semibold text-gray-800">{name}</span>
                  </div>
                  {confirmDel === name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-semibold">Delete &quot;{name}&quot;?</span>
                      <button
                        onClick={() => { remMasterItem(name); setConfirmDel(null); showSaved(`"${name}" removed from item master.`); }}
                        className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                      >Yes, Delete</button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className="px-3 py-1 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(name)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5"/>Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add new item */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Add New Item</p>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newItem.trim();
                if (!trimmed) return;
                addMasterItem(trimmed);
                setNewItem("");
                showSaved(`"${trimmed}" added to item master.`);
              }}
            >
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                placeholder="e.g. Sports Kit"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 w-56"
              />
              <button
                type="submit"
                disabled={!newItem.trim()}
                className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40"
              >
                <Plus className="w-4 h-4"/>Add Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// â"€â"€ Employee Panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// -- Salary Panel (Management Head only) -------------------------------------------
function SalaryPanel() {
  const employees      = useStore(s => s.employees);
  const salaries       = useStore(s => s.employeeSalaries);
  const updateSal      = useStore(s => s.updateEmployeeSalary);
  const salPayments    = useStore(s => s.salaryPayments);
  const addSalPayments = useStore(s => s.addSalaryPayments);
  const storeExpenses  = useStore(s => s.expenses);
  const setStoreExp    = useStore(s => s.setExpenses);

  const curMonth = new Date().toISOString().slice(0, 7);
  const [month,   setMonth]   = useState(curMonth);
  const [search,  setSearch]  = useState("");
  const [typeF,   setTypeF]   = useState("All");
  const [editId,  setEditId]  = useState(null);
  const [editVal, setEditVal] = useState("");

  const safeSalaries   = salaries    || {};
  const safePayments   = Array.isArray(salPayments) ? salPayments : [];
  const safeExpenses   = Array.isArray(storeExpenses) ? storeExpenses : [];

  const monthLabel = (m) => new Date(m + "-01").toLocaleDateString("en-IN", { month:"long", year:"numeric" });
  function getSal(emp)    { return safeSalaries[emp.empId] ?? 15000; }
  function isPaid(emp)    { return safePayments.some(p => p.empId === emp.empId && p.month === month); }
  function getPaidOn(emp) { return safePayments.find(p => p.empId === emp.empId && p.month === month)?.date; }

  const filtered = (employees.length > 0 ? employees : []).filter(e => {
    const mt = typeF === "All" || e.type === typeF;
    const ms = !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.empId||"").toLowerCase().includes(search.toLowerCase());
    return mt && ms;
  });

  const totalPayroll    = filtered.reduce((s,e) => s + getSal(e), 0);
  const paidThisMonth   = filtered.filter(e => isPaid(e));
  const unpaidThisMonth = filtered.filter(e => !isPaid(e));

  function fmtAmt(n)  { return "\u20b9" + Number(n).toLocaleString("en-IN"); }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } }

  function saveSalary(empId) {
    const v = parseInt(editVal, 10);
    if (!isNaN(v) && v > 0) updateSal(empId, v);
    setEditId(null);
  }

  function payOne(emp) {
    const amount = getSal(emp);
    const date   = new Date().toISOString().split("T")[0];
    addSalaryPayments([{ id: Date.now(), empId: emp.empId, empName: emp.name, month, amount, date, paidBy:"Sunil Pradhan" }]);
    setStoreExp([{ id: Date.now()+1, title:"Salary \u2014 "+monthLabel(month)+" \u2014 "+emp.name, category:"Salary", amount, date, paidBy:"Sunil Pradhan", note:(emp.designation||"")+" \u00b7 "+emp.empId }, ...safeExpenses]);
  }

  function payAll() {
    if (unpaidThisMonth.length === 0) return;
    const date = new Date().toISOString().split("T")[0];
    const newPay = unpaidThisMonth.map((emp,i) => ({ id:Date.now()+i, empId:emp.empId, empName:emp.name, month, amount:getSal(emp), date, paidBy:"Sunil Pradhan" }));
    const newExp = unpaidThisMonth.map((emp,i) => ({ id:Date.now()+10000+i, title:"Salary \u2014 "+monthLabel(month)+" \u2014 "+emp.name, category:"Salary", amount:getSal(emp), date, paidBy:"Sunil Pradhan", note:(emp.designation||"")+" \u00b7 "+emp.empId }));
    addSalaryPayments(newPay);
    setStoreExp([...newExp, ...safeExpenses]);
  }

  if (employees.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
      <Users className="w-10 h-10 text-gray-200"/>
      <p className="text-sm font-medium">No employee data yet.</p>
      <p className="text-xs">Visit the <span className="font-semibold text-school-navy">Employee</span> module first.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2">
          <IndianRupee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0"/>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"/>
        </div>
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none" placeholder="Search staff..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white" value={typeF} onChange={e=>setTypeF(e.target.value)}>
          <option value="All">All Types</option>
          <option value="management">Management</option>
          <option value="teaching">Teaching</option>
          <option value="non-teaching">Non-Teaching</option>
          <option value="media">Media</option>
        </select>
        {unpaidThisMonth.length > 0 && (
          <button onClick={payAll} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <IndianRupee className="w-3.5 h-3.5"/> Pay All Unpaid ({unpaidThisMonth.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Total Payroll",  value:fmtAmt(totalPayroll),                                  bg:"bg-emerald-50", color:"text-emerald-700" },
          { label:"Paid This Month",value:fmtAmt(paidThisMonth.reduce((s,e)=>s+getSal(e),0)),   bg:"bg-green-50",   color:"text-green-700"   },
          { label:"Pending Staff",  value:unpaidThisMonth.length+" staff",                        bg:"bg-amber-50",   color:"text-amber-700"   },
          { label:"Total Staff",    value:filtered.length,                                         bg:"bg-blue-50",    color:"text-blue-700"    },
        ].map(({label,value,bg,color})=>(
          <div key={label} className={bg+" rounded-xl px-4 py-3"}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
            <p className={"text-lg font-bold "+color}>{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs" style={{minWidth:"700px"}}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["Emp ID","Name","Type","Designation","Monthly Salary","Status","Paid On","Action"].map(h=>(
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(emp=>{
              const paid=isPaid(emp), paidOn=getPaidOn(emp), sal=getSal(emp), editing=editId===emp.id;
              return (
                <tr key={emp.id} className={"transition-colors "+(paid?"bg-green-50/40":"hover:bg-gray-50/60")}>
                  <td className="px-3 py-2.5 font-mono text-gray-500">{emp.empId}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{emp.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold "+(emp.type==="teaching"?"bg-blue-100 text-blue-700":emp.type==="management"?"bg-purple-100 text-purple-700":emp.type==="media"?"bg-rose-100 text-rose-700":"bg-gray-100 text-gray-600")}>{emp.type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{emp.designation||"\u2014"}</td>
                  <td className="px-3 py-2.5">
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <input type="number" className="border border-emerald-300 rounded px-2 py-1 w-24 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus
                          onKeyDown={e=>{ if(e.key==="Enter") saveSalary(emp.empId); if(e.key==="Escape") setEditId(null); }}/>
                        <button onClick={()=>saveSalary(emp.empId)} className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"><Check className="w-3 h-3"/></button>
                        <button onClick={()=>setEditId(null)} className="p-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800">{fmtAmt(sal)}</span>
                        {!paid && <button onClick={()=>{ setEditId(emp.id); setEditVal(String(sal)); }} className="p-0.5 rounded text-gray-300 hover:text-emerald-600 transition-colors"><Pencil className="w-3 h-3"/></button>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{paid?<span className="flex items-center gap-1 text-green-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5"/>Paid</span>:<span className="text-amber-600 font-semibold">Pending</span>}</td>
                  <td className="px-3 py-2.5 text-gray-400">{paidOn?fmtDate(paidOn):"\u2014"}</td>
                  <td className="px-3 py-2.5">{!paid&&<button onClick={()=>payOne(emp)} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors">Pay</button>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={4} className="px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Total ({filtered.length} staff)</td>
              <td className="px-3 py-2.5 font-bold text-emerald-700">{fmtAmt(totalPayroll)}</td>
              <td colSpan={3}/>
            </tr>
          </tfoot>
        </table>
      </div>

      {paidThisMonth.length > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">{monthLabel(month)} \u2014 {paidThisMonth.length} staff paid \u00b7 {fmtAmt(paidThisMonth.reduce((s,e)=>s+getSal(e),0))} total</p>
          <div className="flex flex-wrap gap-2">
            {paidThisMonth.map(emp=>(
              <span key={emp.id} className="bg-white border border-green-200 text-green-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">{emp.name} \u00b7 {fmtAmt(getSal(emp))}</span>
            ))}
          </div>
        </div>
      )}

      {/* \u2500\u2500 All Months Payment History \u2500\u2500 */}
      <AllMonthsHistory salPayments={safePayments} monthLabel={monthLabel} fmtAmt={fmtAmt} fmtDate={fmtDate}/>
    </div>
  );
}

function AllMonthsHistory({ salPayments, monthLabel, fmtAmt, fmtDate }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  if (salPayments.length === 0) return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 text-center text-gray-400 text-sm">
      No salary payments recorded yet.
    </div>
  );

  // Group by month, sort descending
  const grouped = {};
  salPayments.forEach(p => {
    if (!grouped[p.month]) grouped[p.month] = [];
    grouped[p.month].push(p);
  });
  const months = Object.keys(grouped).sort().reverse();

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <History className="w-4 h-4 text-gray-400"/> All Months Payment History
        <span className="text-xs font-normal text-gray-400">({months.length} month{months.length!==1?"s":""})</span>
      </p>
      {months.map(m => {
        const payments  = grouped[m];
        const total     = payments.reduce((s,p) => s+p.amount, 0);
        const isOpen    = expandedMonth === m;
        return (
          <div key={m} className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => setExpandedMonth(isOpen ? null : m)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <IndianRupee className="w-4 h-4 text-emerald-600"/>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{monthLabel(m)}</p>
                  <p className="text-xs text-gray-400">{payments.length} staff paid</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-emerald-700">{fmtAmt(total)}</span>
                <ChevronDown className={"w-4 h-4 text-gray-400 transition-transform "+(isOpen?"rotate-180":"")}/>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Emp ID</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Amount</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Paid On</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-500">Paid By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p,i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2 font-mono text-gray-400">{p.empId}</td>
                        <td className="px-4 py-2 font-semibold text-gray-800">{p.empName}</td>
                        <td className="px-4 py-2 font-bold text-emerald-700">{fmtAmt(p.amount)}</td>
                        <td className="px-4 py-2 text-gray-500">{fmtDate(p.date)}</td>
                        <td className="px-4 py-2 text-gray-500">{p.paidBy}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500">Total</td>
                      <td colSpan={3} className="px-4 py-2 font-bold text-emerald-700">{fmtAmt(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmployeePanel() {
  const storeEmployees    = useStore(s => s.employees);
  const setStoreEmployees = useStore(s => s.setEmployees);
  const salaries          = useStore(s => s.employeeSalaries);
  const updateSal         = useStore(s => s.updateEmployeeSalary);

  const employees = storeEmployees;

  const [search, setSearch] = useState("");
  const [typeF,  setTypeF]  = useState("All");
  const [editId, setEditId] = useState(null);
  const [form,   setForm]   = useState({});
  const [saved,  setSaved]  = useState(false);

  const TYPE_COLORS = {
    teaching:      "bg-blue-100 text-blue-700",
    "non-teaching":"bg-gray-100 text-gray-600",
    management:    "bg-purple-100 text-purple-700",
  };

  const filtered = employees.filter(e => {
    const matchType = typeF === "All" || e.type === typeF;
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.designation||"").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  function saveEdit() {
    const { salary: salVal, ...empFields } = form;
    const updated = employees.map(e => e.id === editId ? { ...e, ...empFields } : e);
    setStoreEmployees(updated);
    const emp = employees.find(e => e.id === editId);
    if (emp && salVal && !isNaN(Number(salVal)) && Number(salVal) > 0) {
      updateSal(emp.empId, Number(salVal));
    }
    setEditId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
        <Users className="w-10 h-10 text-gray-200"/>
        <p className="text-sm font-medium">No employee data yet.</p>
        <p className="text-xs">Visit the <span className="font-semibold text-school-navy">Employee</span> module first to load staff data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none" placeholder="Search by name or designation…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" value={typeF} onChange={e=>setTypeF(e.target.value)}>
          <option value="All">All Types</option>
          <option value="management">Management</option>
          <option value="teaching">Teaching</option>
          <option value="non-teaching">Non-Teaching</option>
        </select>
        <span className="text-xs text-gray-400 font-medium">{filtered.length} of {employees.length} staff</span>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2.5 mb-3 text-sm">
          <CheckCircle2 className="w-4 h-4"/>Employee record updated!
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["Emp ID","Name","Type","Designation","Phone","Email","Salary / Month","Status","Join Date",""].map(h=>(
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <>
                <tr key={emp.id} className={`border-b border-gray-100 hover:bg-gray-50 ${editId===emp.id?"bg-purple-50/30":""}`}>
                  <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{emp.empId}</td>
                  <td className="px-3 py-2 font-semibold text-gray-800">{emp.name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${TYPE_COLORS[emp.type]||"bg-gray-100 text-gray-600"}`}>
                      {emp.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{emp.designation||"—"}</td>
                  <td className="px-3 py-2 text-gray-600">{emp.phone||"—"}</td>
                  <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{emp.email||"—"}</td>
                  <td className="px-3 py-2 text-emerald-700 font-semibold">
                    {salaries[emp.empId] ? "₹"+Number(salaries[emp.empId]).toLocaleString("en-IN") : <span className="text-gray-300 text-[10px]">Not set</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.status==="Active"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{emp.joiningDate||"—"}</td>
                  <td className="px-3 py-2">
                    <button onClick={()=>editId===emp.id?setEditId(null):(setEditId(emp.id),setForm({ phone:emp.phone, email:emp.email, designation:emp.designation, status:emp.status, joiningDate:emp.joiningDate, salary: salaries[emp.empId]||"" }))}
                      className="flex items-center gap-1 text-purple-700 font-semibold hover:text-purple-900">
                      <Pencil className="w-3.5 h-3.5"/>{editId===emp.id?"Close":"Edit"}
                    </button>
                  </td>
                </tr>
                {editId===emp.id && (
                  <tr key={`ee-${emp.id}`}>
                    <td colSpan={10} className="px-4 py-4 bg-purple-50/30 border-b border-purple-100">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                        {[
                          {l:"Phone",          f:"phone",       t:"text"},
                          {l:"Email",          f:"email",       t:"text"},
                          {l:"Designation",    f:"designation", t:"text"},
                          {l:"Monthly Salary", f:"salary",      t:"number"},
                          {l:"Join Date",      f:"joiningDate", t:"date"},
                          {l:"Status",         f:"status",      t:"sel", opts:["Active","Inactive"]},
                        ].map(({l,f,t,opts})=>(
                          <div key={f} className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{l}</label>
                            {t==="sel"
                              ? <select className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" value={form[f]||""} onChange={e=>setForm({...form,[f]:e.target.value})}>{opts.map(o=><option key={o}>{o}</option>)}</select>
                              : <input type={t} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400" value={form[f]||""} onChange={e=>setForm({...form,[f]:e.target.value})}/>
                            }
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-semibold">
                          <Save className="w-3.5 h-3.5"/>Save Changes
                        </button>
                        <button onClick={()=>setEditId(null)} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-semibold">
                          <X className="w-3.5 h-3.5"/>Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <p className="text-center text-gray-400 py-8 text-sm">No employees match your search</p>}
      </div>
    </div>
  );
}

// â"€â"€ Pending IDs Panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function PendingDetailsPanel({ students }) {
  const [selFields, setSelFields] = useState([]);
  const [selClass,  setSelClass]  = useState("All");

  function toggleField(key) {
    setSelFields(p => p.includes(key) ? p.filter(k=>k!==key) : [...p,key]);
  }

  const activeFields = PENDING_ID_FIELDS.filter(f => selFields.includes(f.key));

  const filtered = selFields.length === 0 ? [] : students.filter(s =>
    (selClass==="All" || s.cls===selClass) &&
    selFields.some(key => !s[key])
  ).filter(s => selClass==="All" || s.cls===selClass);

  // â"€â"€ Export helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function exportExcel() {
    const rows = filtered.map(s => {
      const row = { Name:s.name, Class:s.cls, "Enroll No":s.enrollNo };
      PENDING_ID_FIELDS.forEach(f => { row[f.label] = s[f.key] || "MISSING"; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pending IDs");
    XLSX.writeFile(wb, "students_pending_ids.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(13);
    doc.text("Students with Pending Government IDs", 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Filters: ${activeFields.map(f=>f.label).join(", ") || "None"} Â· Class: ${selClass} Â· Total: ${filtered.length}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Name","Class","Enroll No",...PENDING_ID_FIELDS.map(f=>f.label)]],
      body: filtered.map(s=>[s.name,s.cls,s.enrollNo,...PENDING_ID_FIELDS.map(f=>s[f.key]||"—")]),
      styles: { fontSize:8 },
      headStyles: { fillColor:[30,58,95] },
      didParseCell(data) {
        if (data.section==="body" && data.column.index >= 3) {
          const val = data.cell.raw;
          if (!val || val==="—") data.cell.styles.textColor = [220,38,38];
        }
      },
    });
    doc.save("students_pending_ids.pdf");
  }

  const fieldBadge = (val) => val
    ? "bg-green-100 text-green-700 border border-green-200"
    : "bg-red-100 text-red-700 border border-red-200";

  return (
    <div className="space-y-4">
      {/* Field selector */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5"/> Select which IDs to check as pending
        </p>
        <div className="flex flex-wrap gap-3">
          {PENDING_ID_FIELDS.map(f=>{
            const on = selFields.includes(f.key);
            return (
              <button key={f.key} onClick={()=>toggleField(f.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${on?"bg-school-navy text-white border-school-navy shadow":"bg-white text-gray-600 border-gray-200 hover:border-school-navy"}`}>
                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${on?"bg-white border-white":"border-current"}`}>
                  {on&&<Check className="w-2.5 h-2.5 text-school-navy"/>}
                </div>
                {f.label}
              </button>
            );
          })}
        </div>
        {selFields.length>0&&(
          <p className="text-xs text-amber-600 mt-2.5">
            Showing students where <b>any of these are empty</b>: {activeFields.map(f=>f.label).join(", ")}
          </p>
        )}
      </div>

      {/* Class filter + export */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={selClass} onChange={e=>setSelClass(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy">
          <option value="All">All Classes</option>
          {CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <span className="text-xs text-gray-400 flex-1">
          {selFields.length===0 ? "Select at least one field above" : `${filtered.length} student${filtered.length!==1?"s":""} found`}
        </span>
        {filtered.length>0&&(
          <>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
              <Download className="w-4 h-4"/>Excel
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
              <Download className="w-4 h-4"/>PDF
            </button>
          </>
        )}
      </div>

      {/* Results table */}
      {selFields.length>0&&filtered.length===0&&(
        <div className="text-center py-10 bg-green-50 rounded-xl border border-green-200">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2"/>
          <p className="text-sm font-semibold text-green-700">All students have these IDs filled!</p>
        </div>
      )}

      {filtered.length>0&&(
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50">Student</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Class</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Enroll No</th>
                {PENDING_ID_FIELDS.map(f=>(
                  <th key={f.key} className={`px-4 py-3 text-left font-semibold whitespace-nowrap ${selFields.includes(f.key)?"text-school-navy":"text-gray-400"}`}>
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((st,idx)=>(
                <tr key={st.id} className={`border-b border-gray-100 ${idx%2===0?"bg-white":"bg-gray-50/40"}`}>
                  <td className={`px-4 py-3 font-semibold text-gray-800 whitespace-nowrap sticky left-0 ${idx%2===0?"bg-white":"bg-gray-50/40"}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-school-gold flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{st.firstName[0]}{st.lastName[0]}</div>
                      {st.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{st.cls}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{st.enrollNo}</td>
                  {PENDING_ID_FIELDS.map(f=>(
                    <td key={f.key} className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${fieldBadge(st[f.key])}`}>
                        {st[f.key] || "Missing"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// â"€â"€ Pending Tasks Panel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const PRIORITIES = [
  { key:"High",   color:"bg-red-100 text-red-700 border-red-200"    },
  { key:"Medium", color:"bg-amber-100 text-amber-700 border-amber-200" },
  { key:"Low",    color:"bg-green-100 text-green-700 border-green-200" },
];

// ── Import Students Panel ──────────────────────────────────────────────────────
const IMPORT_FIELDS = [
  { key:"firstName",        label:"First Name",                  required:true  },
  { key:"lastName",         label:"Last Name",                   required:true  },
  { key:"fatherName",       label:"Father Name",                 required:false },
  { key:"motherName",       label:"Mother Name",                 required:false },
  { key:"dob",              label:"Date of Birth (YYYY-MM-DD)",  required:false },
  { key:"gender",           label:"Gender (Male/Female/Other)",  required:true  },
  { key:"cls",              label:"Class",                       required:true  },
  { key:"section",          label:"Section (A/B/C)",             required:false },
  { key:"rollNo",           label:"Roll No",                     required:false },
  { key:"joinDate",         label:"Date of Joining (YYYY-MM-DD)",required:false },
  { key:"grNo",             label:"GR Number",                   required:false },
  { key:"mobile1",          label:"Mobile 1",                    required:false },
  { key:"mobile2",          label:"Mobile 2",                    required:false },
  { key:"address",          label:"Full Address",                required:false },
  { key:"religion",         label:"Religion",                    required:false },
  { key:"caste",            label:"Category / Caste",            required:false },
  { key:"aadharNo",         label:"Aadhar Number",               required:false },
  { key:"udise",            label:"UDISE Number",                required:false },
  { key:"pen",              label:"PEN Number",                  required:false },
  { key:"apaar",            label:"APAAR ID",                    required:false },
  { key:"lastSchoolName",   label:"Last School Name",            required:false },
  { key:"lastSchoolClass",  label:"Last School Class",           required:false },
];

const EXAMPLE_ROW = [
  "Arjun","Patel","Rajesh Patel","Meena Patel","2015-06-15",
  "Male","5th","A","1","2026-06-01","GR001",
  "9876543210","","12 Gandhi Nagar Surat",
  "Hindu","General","1234 5678 9012","","","",
  "City Primary School","4th",
];

const IMPORT_SESSION = "2026-27"; // controlled from Settings — matches the single Add Student form

function ImportStudentsPanel() {
  const fileRef = useRef(null);
  const students    = useStore(s => s.students);
  const addStudent  = useStore(s => s.addStudent);
  const [step,      setStep]      = useState("idle"); // idle | preview | done
  const [parsed,    setParsed]    = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const headers  = IMPORT_FIELDS.map(f => f.label);
    const required = IMPORT_FIELDS.map(f => f.required ? "Required *" : "Optional");
    const ws = XLSX.utils.aoa_to_sheet([headers, required, EXAMPLE_ROW]);
    ws["!cols"] = IMPORT_FIELDS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Student_Import_Template.xlsx");
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type:"binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:"" });

        if (rows.length < 3) { alert("File has no data rows. Please use the downloaded template."); return; }

        const headerRow = rows[0];
        // Build map: fieldKey → column index
        const colMap = {};
        IMPORT_FIELDS.forEach(f => {
          const idx = headerRow.findIndex(h => String(h).trim() === f.label);
          if (idx >= 0) colMap[f.key] = idx;
        });

        // Skip row 1 (headers) and row 2 (required hints / example)
        const dataRows = rows.slice(2);
        const result = [];
        const errs   = [];

        dataRows.forEach((row, i) => {
          if (row.every(c => !c)) return; // skip blank rows
          const s = { _row: i + 3, _errors: [] };
          IMPORT_FIELDS.forEach(f => {
            s[f.key] = colMap[f.key] !== undefined ? String(row[colMap[f.key]] ?? "").trim() : "";
          });

          if (!s.firstName) s._errors.push("First Name missing");
          if (!s.cls)       s._errors.push("Class missing");
          if (s.cls && !CLASSES.includes(s.cls)) s._errors.push(`Unknown class "${s.cls}"`);
          if (s.gender && !["Male","Female","Other"].includes(s.gender)) s._errors.push(`Invalid gender "${s.gender}"`);

          result.push(s);
          if (s._errors.length) errs.push(`Row ${s._row}: ${s._errors.join(", ")}`);
        });

        setParsed(result);
        setRowErrors(errs);
        setStep("preview");
      } catch {
        alert("Could not read the file. Please use the downloaded template (.xlsx).");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  function confirmImport() {
    setImporting(true);
    setTimeout(() => {
      let nextEnrollment = Math.max(...students.map(s => parseInt(s.enrollment) || 0), 1000);
      const rollByClass = {};

      valid.forEach(s => {
        nextEnrollment += 1;
        const enrollment = String(nextEnrollment);

        const classKey = s.cls;
        if (rollByClass[classKey] === undefined) {
          const existingRolls = students
            .filter(st => st.std === classKey && st.status !== "Inactive" && st.status !== "Left")
            .map(st => parseInt(st.rollNo, 10) || 0);
          rollByClass[classKey] = existingRolls.length ? Math.max(...existingRolls) : 0;
        }
        rollByClass[classKey] += 1;
        const assignedRoll = s.rollNo || String(rollByClass[classKey]);

        const aadharFormatted = s.aadharNo
          ? s.aadharNo.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").trim()
          : "";

        const newStudent = {
          enrollment,
          name: `${s.firstName} ${s.lastName}`.trim(),
          photo: null,
          grNo: s.grNo || "",
          dateOfJoin: s.joinDate || "",
          admissionClass: s.cls,
          std: s.cls,
          section: s.section || "A",
          rollNo: assignedRoll,
          session: IMPORT_SESSION,
          fatherName: s.fatherName || "",
          motherName: s.motherName || "",
          mobile: s.mobile1 || "",
          mobile2: s.mobile2 || "",
          dob: s.dob || "",
          gender: s.gender || "",
          religion: s.religion || "",
          caste: s.caste || "General",
          address: s.address || "",
          aadhar: aadharFormatted,
          udise: s.udise || "",
          pen: s.pen || "",
          apaar: s.apaar || "",
          status: "Active",
          fees: { total: 0, paid: 0 },
          pendingDocs: [],
          pendingInventory: [],
          password: ((s.firstName || "STU").slice(0, 3) + enrollment).toUpperCase(),
          lastSchoolName: s.lastSchoolName || "",
          lastSchoolClass: s.lastSchoolClass || "",
        };
        addStudent(newStudent);
      });

      setImportedCount(valid.length);
      setImporting(false);
      setStep("done");
    }, 1200);
  }

  function reset() { setParsed([]); setRowErrors([]); setImportedCount(0); setStep("idle"); }

  const valid   = parsed.filter(s => s._errors.length === 0);
  const invalid = parsed.filter(s => s._errors.length  >  0);

  return (
    <div className="space-y-5">

      {/* ── Step: idle ── */}
      {step === "idle" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Step 1 — Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-white"/>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Step 1 — Download Template</p>
                <p className="text-xs text-blue-600 mt-0.5">Get the Excel sheet with all required column headers</p>
              </div>
            </div>
            <ul className="text-xs text-blue-700 space-y-1 pl-1">
              {["Contains all student fields (22 columns)","Row 2 shows which fields are required","Row 3 shows example data — replace with real data","Do not change column headers or order"].map(t => (
                <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0"/>{t}</li>
              ))}
            </ul>
            <button onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
              <Download className="w-4 h-4"/> Download Template (.xlsx)
            </button>
          </div>

          {/* Step 2 — Upload */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center flex-shrink-0">
                <Upload className="w-5 h-5 text-white"/>
              </div>
              <div>
                <p className="text-sm font-bold text-green-900">Step 2 — Upload Filled File</p>
                <p className="text-xs text-green-600 mt-0.5">Upload the template after filling in student data</p>
              </div>
            </div>
            <ul className="text-xs text-green-700 space-y-1 pl-1">
              {["Use only the downloaded template","Keep column headers exactly as is","One student per row starting from Row 3","Supports .xlsx and .xls files"].map(t => (
                <li key={t} className="flex items-start gap-1.5"><Check className="w-3 h-3 mt-0.5 flex-shrink-0"/>{t}</li>
              ))}
            </ul>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile}/>
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
              <Upload className="w-4 h-4"/> Select Excel File
            </button>
          </div>
        </div>
      )}

      {/* ── Step: preview ── */}
      {step === "preview" && (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4"/> {valid.length} valid student{valid.length !== 1 ? "s" : ""}
            </div>
            {invalid.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                <AlertCircle className="w-4 h-4"/> {invalid.length} row{invalid.length !== 1 ? "s" : ""} with errors
              </div>
            )}
            <span className="text-xs text-gray-400">{parsed.length} total rows parsed</span>
          </div>

          {/* Errors list */}
          {rowErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 max-h-36 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wide">Errors — these rows will be skipped</p>
              {rowErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0"/> {e}
                </p>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">Preview — First 10 valid rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-school-navy text-white">
                    {["#","Name","Class","Section","Father","Mobile","Gender"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valid.slice(0,10).map((s, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                      <td className="px-3 py-2 text-gray-400">{s._row}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{s.firstName} {s.lastName}</td>
                      <td className="px-3 py-2 text-school-navy font-semibold">{s.cls}</td>
                      <td className="px-3 py-2">{s.section || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{s.fatherName || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{s.mobile1 || "—"}</td>
                      <td className="px-3 py-2">{s.gender}</td>
                    </tr>
                  ))}
                  {valid.length > 10 && (
                    <tr><td colSpan={7} className="px-3 py-2 text-center text-xs text-gray-400">... and {valid.length - 10} more students</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
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
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Importing...</>
                : <><Upload className="w-4 h-4"/> Import {valid.length} Student{valid.length !== 1 ? "s" : ""}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Step: done ── */}
      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600"/>
          </div>
          <p className="text-xl font-bold text-gray-800">Import Successful!</p>
          <p className="text-sm text-gray-500">
            <span className="font-bold text-green-700">{importedCount} students</span> have been imported successfully with auto-assigned enrollment numbers.
            {invalid.length > 0 && <><br/><span className="text-red-500">{invalid.length} rows were skipped</span> due to errors.</>}
          </p>
          <button onClick={reset}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors">
            <Upload className="w-4 h-4"/> Import More Students
          </button>
        </div>
      )}
    </div>
  );
}

function PendingTasksPanel({ createdBy }) {
  const { pendingTasks, addTask, toggleTask, deleteTask } = useStore();
  const [text,     setText]     = useState("");
  const [priority, setPriority] = useState("High");
  const [showDone, setShowDone] = useState(false);

  const pending = pendingTasks.filter(t => !t.done);
  const done    = pendingTasks.filter(t =>  t.done);

  function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addTask(text.trim(), priority, createdBy);
    setText("");
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  const priBadge = (p) => PRIORITIES.find(x=>x.key===p)?.color ?? "";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-school-navy/5 to-transparent">
        <div className="w-8 h-8 rounded-lg bg-school-navy flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-4 h-4 text-white"/>
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-900">Important Pending Tasks</h2>
          <p className="text-xs text-gray-500 mt-0.5">Visible to all admins Â· Shown on dashboard</p>
        </div>
        {pending.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Add task form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="Write an important pending task—¦"
            className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white placeholder:text-gray-300"
          />
          <select
            value={priority}
            onChange={e=>setPriority(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy cursor-pointer"
          >
            {PRIORITIES.map(p=><option key={p.key}>{p.key}</option>)}
          </select>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white text-sm font-semibold rounded-xl hover:bg-school-navy-dark transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4"/>Add
          </button>
        </form>

        {/* Pending tasks list */}
        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-gray-400">
            <CheckCircle2 className="w-10 h-10 mb-2 text-green-300"/>
            <p className="text-sm font-medium text-gray-500">All caught up! No pending tasks.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(task=>(
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 group">
                <button
                  type="button"
                  onClick={()=>toggleTask(task.id)}
                  className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-school-navy flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium leading-snug">{task.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priBadge(task.priority)}`}>{task.priority}</span>
                    <span className="text-[10px] text-gray-400">by {task.createdBy} Â· {fmtDate(task.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={()=>deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded-lg transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Completed tasks toggle */}
        {done.length > 0 && (
          <div>
            <button
              type="button"
              onClick={()=>setShowDone(p=>!p)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showDone ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
              {showDone ? "Hide" : "Show"} completed ({done.length})
            </button>
            {showDone && (
              <div className="space-y-2 mt-2">
                {done.map(task=>(
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white group opacity-60">
                    <button
                      type="button"
                      onClick={()=>toggleTask(task.id)}
                      className="w-5 h-5 rounded-md border-2 border-green-400 bg-green-400 flex items-center justify-center flex-shrink-0 mt-0.5"
                    >
                      <Check className="w-3 h-3 text-white"/>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-400 line-through leading-snug">{task.text}</p>
                      <span className="text-[10px] text-gray-400">by {task.createdBy} Â· {fmtDate(task.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={()=>deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded-lg transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// â"€â"€ Super Admin Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function SuperAdminPage() {
  const [authUser,     setAuthUser]     = useState(null);
  const [activeTab,    setActiveTab]    = useState("single");
  const [mgmtTab,      setMgmtTab]      = useState("students");
  const [studentsSubTab, setStudentsSubTab] = useState("spreadsheet");

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

      {/* Pending Tasks —" visible to both roles */}
      <PendingTasksPanel createdBy={authUser.name} />

      {/* Senior Admin tabs */}
      {!isMgmt && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              {key:"single",  label:"Update Student",         icon:GraduationCap},
              {key:"bulk",    label:"Bulk Edit (Spreadsheet)", icon:Users},
              {key:"pending", label:"Pending IDs",             icon:Filter},
              {key:"import",  label:"Import Students",         icon:Upload},
            ].map(t=>{
              const Icon=t.icon; const isA=activeTab===t.key;
              return <button key={t.key} onClick={()=>setActiveTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isA?"bg-school-navy text-white shadow-md":"text-gray-600 hover:bg-gray-100"}`}><Icon className="w-4 h-4"/>{t.label}</button>;
            })}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {activeTab==="single"  && <SingleStudentTool students={DUMMY_STUDENTS}/>}
            {activeTab==="bulk"    && <SpreadsheetEditor students={DUMMY_STUDENTS} title="Bulk Edit Students"/>}
            {activeTab==="pending" && <PendingDetailsPanel students={DUMMY_STUDENTS}/>}
            {activeTab==="import"  && <ImportStudentsPanel/>}
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
            {mgmtTab==="students" && (
              <>
                {/* Students sub-tabs */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {[
                    {key:"spreadsheet", label:"Spreadsheet Edit",    icon:Users},
                    {key:"single",      label:"Single Student Update",icon:GraduationCap},
                    {key:"pending",     label:"Pending IDs",          icon:Filter},
                    {key:"import",      label:"Import Students",       icon:Upload},
                  ].map(t=>{
                    const Icon=t.icon; const isA=studentsSubTab===t.key;
                    return <button key={t.key} onClick={()=>setStudentsSubTab(t.key)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${isA?"bg-blue-600 text-white border-blue-600 shadow":"border-gray-200 text-gray-600 hover:border-blue-400 bg-white"}`}><Icon className="w-3.5 h-3.5"/>{t.label}</button>;
                  })}
                </div>
                {studentsSubTab==="spreadsheet" && <SpreadsheetEditor students={DUMMY_STUDENTS} title="Student Records"/>}
                {studentsSubTab==="single"      && <SingleStudentTool students={DUMMY_STUDENTS}/>}
                {studentsSubTab==="pending"     && <PendingDetailsPanel students={DUMMY_STUDENTS}/>}
                {studentsSubTab==="import"      && <ImportStudentsPanel/>}
              </>
            )}
            {mgmtTab==="fees"      && <FeesPanel/>}
            {mgmtTab==="inventory" && <InventoryPanel/>}
            {mgmtTab==="employee"  && <EmployeePanel/>}
            {mgmtTab==="salary"    && <SalaryPanel/>}
          </div>
        </>
      )}
    </div>
  );
}
