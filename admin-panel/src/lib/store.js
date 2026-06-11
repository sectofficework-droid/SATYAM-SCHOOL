import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      readmissionDate: null,
      setReadmissionDate: (date) => set({ readmissionDate: date }),

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

      timeSlots: [
        { id:"prayer", label:"PRAYER",   time:"9:00 – 9:20",   special:true  },
        { id:"p1",     label:"Period 1", time:"9:20 – 10:20"                  },
        { id:"p2",     label:"Period 2", time:"10:20 – 11:10"                 },
        { id:"recess", label:"RECESS",   time:"11:10 – 11:40", special:true  },
        { id:"p3",     label:"Period 3", time:"11:40 – 12:30"                 },
        { id:"p4",     label:"Period 4", time:"12:30 – 1:20"                  },
        { id:"p5",     label:"Period 5", time:"1:20 – 2:00"                   },
      ],
      setTimeSlots: (slots) => set({ timeSlots: slots }),

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
    }),
    { name: "satyam-school-store", version: 2 }
  )
);

export default useStore;
