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
      employees: [],
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
    { name: "satyam-school-store" }
  )
);

export default useStore;
