"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  IndianRupee,
  Users,
  Package,
  BarChart3,
  Settings,
  ShieldCheck,
  ClipboardList,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useStore from "@/lib/store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student", label: "Student", icon: GraduationCap },
  { href: "/fees", label: "Fees", icon: IndianRupee },
  { href: "/employee", label: "Employee", icon: Users },
  { href: "/inventory", label: "Inventory Management", icon: Package },
  { href: "/report", label: "Report", icon: BarChart3 },
  { href: "/tasks", label: "Task Management", icon: ClipboardList },
  { href: "/settings", label: "Setting", icon: Settings },
  { href: "/super-admin", label: "Super Admin", icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, closeSidebar, user } = useStore();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-school-navy flex flex-col z-30",
          "transition-transform duration-300 ease-in-out",
          "lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / School Branding */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-school-gold rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-white font-bold text-sm">Satyam Stars</p>
              <p className="text-white/50 text-xs">International School</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-white/40 hover:text-white transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-none">
          <p className="px-5 text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
            Main Menu
          </p>
          <ul className="space-y-0.5 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-school-gold text-white shadow-md shadow-school-gold/30"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile + Logout */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-school-gold flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.initials || "AU"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                {user?.name || "Admin User"}
              </p>
              <p className="text-white/45 text-[10px] truncate">
                {user?.role || "Super Admin"}
              </p>
            </div>
            <button
              className="text-white/40 hover:text-red-400 transition-colors p-1"
              title="Logout"
              onClick={() => window.location.href = "/login"}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
