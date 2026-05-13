import { create } from "zustand";

const useStore = create((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  user: {
    name: "Admin User",
    role: "Super Admin",
    email: "admin@satyamstars.edu.in",
    initials: "AU",
  },
}));

export default useStore;
