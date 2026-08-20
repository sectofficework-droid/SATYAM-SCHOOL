"use client";

import { Menu, Bell, ChevronDown, Search, LogOut, TimerReset } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import useStore from "@/lib/store";
import supabase from "@/lib/supabase";
import { useIdleTimer } from "@/lib/idleTimerContext";

const pageTitles = {
  "/dashboard": { title: "Dashboard", sub: "School overview & quick stats" },
  "/student": { title: "Student Management", sub: "Manage student records & admissions" },
  "/fees": { title: "Fees Management", sub: "Fee collection, receipts & reports" },
  "/employee": { title: "Employee Management", sub: "Staff records & assignments" },
  "/inventory": { title: "Inventory Management", sub: "Stock, vendors & purchase tracking" },
  "/report": { title: "Reports", sub: "Attendance, fee & student reports" },
  "/settings": { title: "Settings", sub: "System configuration & preferences" },
  "/sef/dashboard": { title: "SEF Dashboard", sub: "Satyam Education Foundation overview" },
  "/sef/student": { title: "SEF Students", sub: "Tuition student records" },
  "/sef/fees": { title: "SEF Fees", sub: "Tuition fee collection" },
  "/sef/settings": { title: "SEF Settings", sub: "Satyam Education Foundation configuration" },
};

const ROLE_LABELS = { management: "Management Head", senior_admin: "Senior Admin", normal_admin: "Admin" };

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const authUser = useStore((state) => state.authUser);
  const clearAuthUser = useStore((state) => state.clearAuthUser);
  const activeOrg = useStore((state) => state.activeOrg);
  const setActiveOrg = useStore((state) => state.setActiveOrg);
  const idleSecondsLeft = useIdleTimer();

  const page = pageTitles[pathname] || pageTitles["/dashboard"];

  async function handleLogout() {
    // Local sign-out/redirect must happen even if the network call to
    // revoke the session server-side fails - otherwise a flaky request
    // leaves the still-valid token sitting in localStorage and the user
    // never actually gets logged out.
    try { await supabase.auth.signOut(); } catch {}
    clearAuthUser();
    // Full navigation, not router.replace() - instant since /login is
    // statically servable with no server round-trip, and it fully tears
    // down JS state so nothing can linger from the signed-out session.
    window.location.replace("/login");
  }

  function switchOrg(org) {
    if (org === activeOrg) return;
    setActiveOrg(org);
    router.push(org === "sef" ? "/sef/dashboard" : "/dashboard");
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

        {/* Org switcher — School / SEF */}
        <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          {["school", "sef"].map((org) => (
            <button
              key={org}
              onClick={() => switchOrg(org)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeOrg === org ? "bg-school-navy text-white shadow" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {org === "school" ? "School" : "SEF"}
            </button>
          ))}
        </div>

        {/* Idle auto-logout countdown — resets whenever there's activity */}
        <div
          title="Time left before auto-logout due to inactivity"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-school-navy text-xs font-semibold tabular-nums text-red-600"
        >
          <TimerReset className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatMMSS(idleSecondsLeft)}</span>
        </div>

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
