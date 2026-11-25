import { create } from "zustand";
import { persist } from "zustand/middleware";

const useStore = create(
  persist(
    (set) => ({
      sidebarOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      closeSidebar: () => set({ sidebarOpen: false }),

      authUser: null,
      setAuthUser: (user) => set({ authUser: user }),
      clearAuthUser: () => set({ authUser: null }),

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

      // ── Employees ──────────────────────────────────────────────
      // REQ-SEC-034 (2026-11-20 full-system audit): this used to seed 15
      // real employees (names, designations, and one real phone+email)
      // directly in source, which ships in every client JS bundle - in a
      // repo with a documented history of being made public. Verified no
      // reader ever consumes this seed directly (every panel that shows
      // employees - EmployeePanel/SalaryPanel in super-admin.js,
      // employee/page.js itself - fetches its own list from the DB via
      // useState/an API call, not via `useStore(s => s.employees)`); the
      // seed was always overwritten before being relied on. Empty array is
      // behavior-identical to the real data for every current caller.
      employees: [],
      setEmployees: (list) => set({ employees: list }),

      // ── Active Classes ─────────────────────────────────────────
      activeClasses: [
        "JR KG","SR KG","Balvatika",
        "1st","2nd","3rd","4th","5th","6th","7th","8th","9th",
      ],
      activateClass:    (cls)  => set(s => ({ activeClasses: s.activeClasses.includes(cls) ? s.activeClasses : [...s.activeClasses, cls] })),
      deactivateClass:  (cls)  => set(s => ({ activeClasses: s.activeClasses.filter(c => c !== cls) })),
      setActiveClasses: (list) => set({ activeClasses: list }),

      // ── Timetable ──────────────────────────────────────────────
      // Period definitions (Prayer/Period/Recess timings per day-group) live
      // in Supabase now (school_profile.period_defs, via settingsService.js)
      // instead of here - they used to be Zustand-only, which meant an edit
      // only ever showed up on the browser that made it.

      // ── Employee Attendance Summary ───────────────────────────
      attendanceSummary: null,
      setAttendanceSummary: (data) => set({ attendanceSummary: data }),

      salaryPayments: [],
      addSalaryPayments: (payments) =>
        set((s) => ({ salaryPayments: [...s.salaryPayments, ...payments] })),

      // ── Expenses ──────────────────────────────────────────────
      // REQ-SEC-034 (2026-11-20 full-system audit): same issue as the
      // employees seed above - these 10 rows attributed real-looking
      // salary/expense figures to real named staff via `paidBy`, hardcoded
      // in a client-bundled file. Confirmed no reader consumes this seed
      // directly (dashboard/page.js and expenses/page.js both fetch their
      // own data from the DB). Empty array is behavior-identical.
      expenses: [],
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
    { name: "satyam-school-store", version: 8 }
  )
);

export default useStore;
