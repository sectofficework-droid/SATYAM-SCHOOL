import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_YEAR_PLAN_EVENTS } from "./yearPlanData";

const useStore = create(
  persist(
    (set) => ({
      sidebarOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      user: {
        name: "Admin User",
        role: "Super Admin",
        email: "admin@satyamstars.edu.in",
        initials: "AU",
      },

      // ── Academic Year ──────────────────────────────────────────
      readmissionDate: "2026-03-15",
      setReadmissionDate: (date) => set({ readmissionDate: date }),
      yearEndApplied: null,
      setYearEndApplied: (date) => set({ yearEndApplied: date }),

      // ── Session Fees Structure ─────────────────────────────────
      sessionFeesStructure: {
        "2025-26": {
          "JR.KG":14000,"SR.KG":14000,"Balvatika":14500,
          "1st":15000,"2nd":15200,"3rd":15400,"4th":15700,"5th":16000,
          "6th":16300,"7th":16500,"8th":16800,"9th":17000,"10th":17500,
          "11th - Commerce":18500,"12th - Commerce":18500,
        },
        "2026-27": {
          "JR.KG":14500,"SR.KG":14500,"Balvatika":15000,
          "1st":15500,"2nd":15700,"3rd":15900,"4th":16200,"5th":16500,
          "6th":16800,"7th":17000,"8th":17300,"9th":17500,"10th":18000,
          "11th - Commerce":19000,"12th - Commerce":19000,
        },
      },
      setSessionFeesStructure: (session, amounts) => set((s) => ({
        sessionFeesStructure: { ...s.sessionFeesStructure, [session]: amounts },
      })),

      // ── Uniform Fees ───────────────────────────────────────────
      uniformFees: {},
      setUniformFees: (fees) => set({ uniformFees: fees }),

      // ── Old Student Discount ────────────────────────────────────
      oldStudentDiscount: 1000,
      setOldStudentDiscount: (amount) => set({ oldStudentDiscount: amount }),

      // ── Employees ──────────────────────────────────────────────
      // Seeded with core staff so Super Admin Salary panel works without visiting Employee module first
      employees: [
        { id:1,  empId:"EMP001", name:"Sunil Pradhan",     type:"management",  designation:"Principal",           department:"Administration",        gender:"Male",   phone:"9876543210", email:"sunil@satyamstars.edu.in", status:"Active", joiningDate:"2015-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:2,  empId:"EMP002", name:"Rajesh Biswal",     type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:3,  empId:"EMP003", name:"BK Debiprasad Das", type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:4,  empId:"EMP004", name:"Sandeep Pradhan",   type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:5,  empId:"EMP005", name:"Gaurang Polai",     type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:6,  empId:"EMP006", name:"Kishan Swain",      type:"media",       designation:"Social Media Manager", department:"Media & Communications",gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:7,  empId:"EMP007", name:"Rudra Prasad Muni", type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:8,  empId:"EMP008", name:"Ayeshkant Rout",    type:"non-teaching",designation:"Admin",                department:"Administration",        gender:"Male",   phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:11, empId:"EMP011", name:"Pami Pradhan",      type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:12, empId:"EMP012", name:"Rashmita Patra",    type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:13, empId:"EMP013", name:"Priti Singh",       type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:14, empId:"EMP014", name:"Janki Das",         type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:15, empId:"EMP015", name:"Shivani Pradhan",   type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:16, empId:"EMP016", name:"Smurti Panda",      type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:17, empId:"EMP017", name:"Manisha Biswal",    type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:18, empId:"EMP018", name:"Parvati Polai",     type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:19, empId:"EMP019", name:"Sita Gouda",        type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:20, empId:"EMP020", name:"Kabita Panigrahi",  type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:21, empId:"EMP021", name:"Barsha Pradhan",    type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:22, empId:"EMP022", name:"Liza Patra",        type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:23, empId:"EMP023", name:"Laxmi Behera",      type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:24, empId:"EMP024", name:"Pragyan Panda",     type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:25, empId:"EMP025", name:"Priyanka Bisoyi",   type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:26, empId:"EMP026", name:"Priyanka Padhi",    type:"teaching",    designation:"Class Teacher",        department:"Primary",               gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
        { id:27, empId:"EMP027", name:"Rina Gouda",        type:"non-teaching",designation:"Care Taker",           department:"Non-Teaching",          gender:"Female", phone:"",          email:"",                         status:"Active", joiningDate:"2026-06-01", documents:[], subjectMappings:[], classTeacherOf:null },
      ],
      setEmployees: (list) => set({ employees: list }),

      // ── Role Permissions ──────────────────────────────────────
      rolePermissions: {},
      setRolePermissions: (perms) => set({ rolePermissions: perms }),

      // ── Active Classes ─────────────────────────────────────────
      activeClasses: [
        "JR KG","SR KG","Balvatika",
        "1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
      ],
      activateClass:   (cls) => set(s => ({ activeClasses: s.activeClasses.includes(cls) ? s.activeClasses : [...s.activeClasses, cls] })),
      deactivateClass: (cls) => set(s => ({ activeClasses: s.activeClasses.filter(c => c !== cls) })),

      // ── Timetable ──────────────────────────────────────────────
      timetables: {},
      setTimetables: (data) => set({ timetables: data }),

      // Per-day-group period definitions. Each group has its own independent
      // ordered list so admins can add/remove/reorder periods/breaks per group.
      periodDefs: {
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
      },
      setPeriodDefs: (defs) => set({ periodDefs: defs }),

      // ── Employee Salaries (management-only) ───────────────────
      employeeSalaries: {
        EMP001: 45000, EMP002: 25000, EMP003: 22000, EMP004: 22000,
        EMP005: 20000, EMP006: 18000, EMP007: 20000, EMP008: 20000,
        EMP011: 24000, EMP012: 23000, EMP013: 23000, EMP014: 22000,
        EMP015: 22000, EMP016: 22000, EMP017: 22000, EMP018: 22000,
        EMP019: 22000, EMP020: 22000, EMP021: 22000, EMP022: 22000,
        EMP023: 22000, EMP024: 22000, EMP025: 22000, EMP026: 22000,
        EMP027: 15000,
      },
      updateEmployeeSalary: (empId, amount) =>
        set((s) => ({ employeeSalaries: { ...s.employeeSalaries, [empId]: amount } })),

      salaryPayments: [],
      addSalaryPayments: (payments) =>
        set((s) => ({ salaryPayments: [...s.salaryPayments, ...payments] })),

      // ── Expenses ──────────────────────────────────────────────
      expenses: [
        { id:101, title:"Staff Salary — June 2026",      category:"Salary",         amount:185000, date:"2026-06-01", paidBy:"Sunil Pradhan",    note:"Monthly salary for all staff" },
        { id:102, title:"Electricity Bill — May 2026",   category:"Utilities",      amount:12400,  date:"2026-05-28", paidBy:"Gaurang Polai",     note:"" },
        { id:103, title:"Annual Sports Day Setup",       category:"Events",         amount:28000,  date:"2026-05-15", paidBy:"Sandeep Pradhan",   note:"Stage, decoration & prizes" },
        { id:104, title:"Classroom Furniture Repair",    category:"Maintenance",    amount:9500,   date:"2026-05-10", paidBy:"Rajesh Biswal",     note:"6 desks repaired" },
        { id:105, title:"Stationery & Office Supplies",  category:"Supplies",       amount:6200,   date:"2026-05-05", paidBy:"Gaurang Polai",     note:"" },
        { id:106, title:"Water & Sewage Bill",           category:"Utilities",      amount:3800,   date:"2026-04-30", paidBy:"Gaurang Polai",     note:"" },
        { id:107, title:"Projector Installation",        category:"Infrastructure", amount:42000,  date:"2026-04-20", paidBy:"Sunil Pradhan",     note:"2 classrooms" },
        { id:108, title:"School Bus Fuel — April",       category:"Transport",      amount:15600,  date:"2026-04-30", paidBy:"Rudra Prasad Muni", note:"" },
        { id:109, title:"PTM Refreshments",              category:"Events",         amount:4200,   date:"2026-04-15", paidBy:"BK Debiprasad Das", note:"" },
        { id:110, title:"Cleaning Material",             category:"Supplies",       amount:2800,   date:"2026-04-10", paidBy:"Ayeshkant Rout",    note:"" },
      ],
      setExpenses: (list) => set({ expenses: list }),

      // ── Fee Payments (flat list for dashboard totals) ──────────
      feePayments: [
        { id:1, date:"2026-06-05", amount:8500  },
        { id:2, date:"2026-10-12", amount:5000  },
        { id:3, date:"2026-06-10", amount:17500 },
        { id:4, date:"2026-06-08", amount:9000  },
        { id:5, date:"2026-06-12", amount:14500 },
      ],
      setFeePayments: (list) => set({ feePayments: list }),
      addFeePayment: (p) => set((s) => ({ feePayments: [...s.feePayments, { id: Date.now(), ...p }] })),

      // ── Students ──────────────────────────────────────────────
      students: [
        { enrollment:"1001", name:"Arjun Patel", photo:null, grNo:"GR-001", dateOfJoin:"01 Jun 2023", admissionClass:"8th", std:"9th", section:"A", rollNo:"1", session:"2025-26", fatherName:"Rajesh", motherName:"Meena", mobile:"9876543210", dob:"15 Jan 2010", gender:"Male", password:"ARJ1001", aadhar:"1234 5678 9012", udise:"24180100101", pen:"", apaar:"", status:"Active", fees:{ total:48000, paid:36000 }, pendingDocs:["Father's Aadhar Card", "Mother's Aadhar Card", "Leaving Certificate"], pendingInventory:["Notebook Set"], lastSchoolName:"St. Xavier's Primary", tcUploaded:false },
        { enrollment:"1002", name:"Priya Shah", photo:null, grNo:"GR-002", dateOfJoin:"15 Jun 2023", admissionClass:"8th", std:"8th", section:"B", rollNo:"1", session:"2025-26", fatherName:"Amit", motherName:"Kavita", mobile:"9765432100", dob:"22 Mar 2011", gender:"Female", password:"PRI1002", aadhar:"", udise:"", pen:"", apaar:"123456789012", status:"Active", fees:{ total:44000, paid:44000 }, pendingDocs:[], pendingInventory:["Uniform Set"] },
        { enrollment:"1003", name:"Rohan Mehta", photo:null, grNo:"GR-003", dateOfJoin:"10 Apr 2022", admissionClass:"9th", std:"10th", section:"A", rollNo:"1", session:"2025-26", fatherName:"Suresh", motherName:"Asha", mobile:"9654321098", dob:"08 Jul 2009", gender:"Male", password:"ROH1003", aadhar:"9876 5432 1098", udise:"", pen:"12345678901", apaar:"", status:"Active", fees:{ total:52000, paid:20000 }, pendingDocs:["Birth Certificate", "Marksheet", "Leaving Certificate"], pendingInventory:["ID Card"], lastSchoolName:"City High School", tcUploaded:false },
        { enrollment:"1004", name:"Sneha Desai", photo:null, grNo:"GR-004", dateOfJoin:"05 Jun 2024", admissionClass:"6th", std:"7th", section:"C", rollNo:"1", session:"2025-26", fatherName:"Kishore", motherName:"Hetal", mobile:"9543210987", dob:"30 Nov 2011", gender:"Female", password:"SNE1004", aadhar:"", udise:"", pen:"", apaar:"", status:"Active", fees:{ total:40000, paid:0 }, pendingDocs:["Birth Certificate"], pendingInventory:["Bag", "Uniform Set"] },
        { enrollment:"1005", name:"Dev Joshi", photo:null, grNo:"GR-005", dateOfJoin:"12 Jun 2024", admissionClass:"JR.KG", std:"SR.KG", section:"A", rollNo:"1", session:"2025-26", fatherName:"Prakash", motherName:"Ruchita", mobile:"9432109876", dob:"14 Sep 2020", gender:"Male", password:"DEV1005", aadhar:"", udise:"", pen:"", apaar:"", status:"Active", fees:{ total:35000, paid:35000 }, pendingDocs:["Birth Certificate"], pendingInventory:[] },
      ],
      setStudents: (listOrUpdater) => set((s) => ({
        students: typeof listOrUpdater === "function" ? listOrUpdater(s.students) : listOrUpdater,
      })),
      addStudent: (student) => set((s) => ({ students: [...s.students, student] })),

      // ── Student Inventory Items (master list) ─────────────────
      studentInventoryItems: ["Bag", "Uniform Set", "Book Set", "Notebook Set", "ID Card", "School Diary"],
      addStudentInventoryItem: (name) => set((s) => ({
        studentInventoryItems: s.studentInventoryItems.includes(name)
          ? s.studentInventoryItems
          : [...s.studentInventoryItems, name],
      })),
      removeStudentInventoryItem: (name) => set((s) => ({
        studentInventoryItems: s.studentInventoryItems.filter((i) => i !== name),
      })),

      // ── Fee Reminder Templates ────────────────────────────────
      feeReminderTemplates: {
        en: "Dear Parent,\n{name} (Class {class}, Roll {roll}) has {amount} school fees pending.\nPlease pay on or before {date}.\nThank you,\nSatyam Stars International School, Surat",
        hi: "प्रिय अभिभावक,\n{name} (कक्षा {class}, रोल {roll}) की {amount} स्कूल फीस बाकी है।\nकृपया {date} तक जमा करें।\nधन्यवाद,\nसत्यम स्टार्स इंटरनेशनल स्कूल, सूरत",
        or: "ପ୍ରିୟ ଅଭିଭାବକ,\n{name} (ଶ୍ରେଣୀ {class}, ରୋଲ {roll}) ର {amount} ସ୍କୁଲ ଶୁଳ୍କ ବାକି ଅଛି।\nଦଯାକରି {date} ପୂର୍ବରୁ ଦିଅନ୍ତୁ।\nଧନ୍ୟବାଦ,\nସତ୍ୟମ ଷ୍ଟାର୍ସ ଇଣ୍ଟରନ୍ୟାସନାଲ ସ୍କୁଲ, ସୁରାଟ",
      },
      setFeeReminderTemplates: (t) => set({ feeReminderTemplates: t }),

      // ── Pending Tasks ──────────────────────────────────────────
      pendingTasks: [],

      addTask: (text, priority, createdBy) =>
        set((state) => ({
          pendingTasks: [
            { id: Date.now(), text, priority, createdBy, createdAt: new Date().toISOString(), done: false },
            ...state.pendingTasks,
          ],
        })),

      toggleTask: (id) =>
        set((state) => ({
          pendingTasks: state.pendingTasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t
          ),
        })),

      deleteTask: (id) =>
        set((state) => ({
          pendingTasks: state.pendingTasks.filter((t) => t.id !== id),
        })),

      // ── Year Planning ────────────────────────────────────────
      yearPlanEvents: SEED_YEAR_PLAN_EVENTS,
      addYearPlanEvent: (event) =>
        set((s) => ({ yearPlanEvents: [...s.yearPlanEvents, { id: `ev${Date.now()}`, ...event }] })),
      updateYearPlanEvent: (id, patch) =>
        set((s) => ({
          yearPlanEvents: s.yearPlanEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      deleteYearPlanEvent: (id) =>
        set((s) => ({ yearPlanEvents: s.yearPlanEvents.filter((e) => e.id !== id) })),
    }),
    { name: "satyam-school-store", version: 8 }
  )
);

export default useStore;
