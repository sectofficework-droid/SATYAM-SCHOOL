"use client";

import { Menu, Bell, ChevronDown, Search, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import useStore from "@/lib/store";
import supabase from "@/lib/supabase";

const pageTitles = {
  "/dashboard": { title: "Dashboard", sub: "School overview & quick stats" },
  "/student": { title: "Student Management", sub: "Manage student records & admissions" },
  "/fees": { title: "Fees Management", sub: "Fee collection, receipts & reports" },
  "/employee": { title: "Employee Management", sub: "Staff records & assignments" },
  "/inventory": { title: "Inventory Management", sub: "Stock, vendors & purchase tracking" },
  "/report": { title: "Reports", sub: "Attendance, fee & student reports" },
  "/settings": { title: "Settings", sub: "System configuration & preferences" },
};

const ROLE_LABELS = { management: "Management Head", senior_admin: "Senior Admin", normal_admin: "Admin" };

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const authUser = useStore((state) => state.authUser);
  const clearAuthUser = useStore((state) => state.clearAuthUser);

  const page = pageTitles[pathname] || pageTitles["/dashboard"];

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAuthUser();
    router.replace("/login");
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0 shadow-sm">

      {/* Hamburger — mobile only */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-bold text-school-navy leading-tight truncate">
          {page.title}
        </h1>
        <p className="text-xs text-gray-400 hidden sm:block truncate">{page.sub}</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">

        {/* Search — hidden on small screens */}
        <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300 transition-colors text-sm w-44">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Search...</span>
        </button>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        {/* User chip */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl border border-transparent">
            <div className="w-7 h-7 rounded-full bg-school-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {authUser?.initials || "?"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-gray-800 leading-tight">
                {authUser?.name || "Admin"}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">
                {ROLE_LABELS[authUser?.role] || "Admin"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
