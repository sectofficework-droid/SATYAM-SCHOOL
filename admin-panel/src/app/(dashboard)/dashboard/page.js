"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  GraduationCap, Users, IndianRupee, TrendingUp, TrendingDown,
  Bell, ArrowUpRight, Package, AlertCircle, Calendar,
  UserCog, FileText, Activity, ChevronDown, ClipboardList,
  X, ShieldAlert,
} from "lucide-react";
import useStore from "@/lib/store";

// ── Dummy Data ────────────────────────────────────────────────

const classes = [
  "All Classes","Class 1","Class 2","Class 3","Class 4","Class 5",
  "Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12",
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function genStudentAttendance(cls) {
  const total = cls === "All Classes" ? 155 : 38;
  return weekDays.map((day) => ({
    day,
    Present: Math.floor(total * 0.88 + (total * 0.08 * (Math.sin(day.length) + 1) / 2)),
    Absent:  Math.floor(total * 0.07 + (total * 0.03 * (Math.cos(day.length) + 1) / 2)),
  }));
}

const employeeAttendanceData = weekDays.map((day) => ({
  day,
  Present: [62, 65, 60, 64, 63, 58][weekDays.indexOf(day)],
  Absent:  [4, 2, 6, 3, 4, 8][weekDays.indexOf(day)],
}));

const recentNotices = [
  { title: "Annual Sports Day — 20th May 2025",          date: "13 May", type: "Event",    dot: "bg-blue-400" },
  { title: "Unit Test Schedule Released for Class 9–12", date: "12 May", type: "Academic", dot: "bg-purple-400" },
  { title: "Summer Vacation from 1st June 2025",         date: "10 May", type: "Holiday",  dot: "bg-green-400" },
  { title: "Parent-Teacher Meeting on Saturday",         date: "8 May",  type: "Meeting",  dot: "bg-amber-400" },
];

const inventoryAlerts = [
  { item: "A4 Paper Reams",       stock: 12, min: 50 },
  { item: "Whiteboard Markers",   stock: 8,  min: 30 },
  { item: "Sports Footballs",     stock: 3,  min: 10 },
];

const recentActivities = [
  {
    icon: IndianRupee,
    iconStyle: "bg-green-50 text-green-600",
    title: "Fee Payment Received",
    detail: "Arjun Patel · Class 10-A · ₹8,500 (Annual Fee)",
    time: "2 min ago",
    by: "Admin",
  },
  {
    icon: UserCog,
    iconStyle: "bg-blue-50 text-blue-600",
    title: "Student Profile Updated",
    detail: "Priya Shah · Class 9-B · Contact & address updated",
    time: "18 min ago",
    by: "Admin",
  },
  {
    icon: GraduationCap,
    iconStyle: "bg-purple-50 text-purple-600",
    title: "New Student Admitted",
    detail: "Rohan Mehta · Class 11-A · Adm. No. 2025-156",
    time: "1 hr ago",
    by: "Admin",
  },
  {
    icon: IndianRupee,
    iconStyle: "bg-green-50 text-green-600",
    title: "Fee Payment Received",
    detail: "Sneha Desai · Class 8-C · ₹6,200 (Term Fee)",
    time: "2 hr ago",
    by: "Admin",
  },
  {
    icon: FileText,
    iconStyle: "bg-amber-50 text-amber-600",
    title: "Fee Structure Updated",
    detail: "Class 9 & 10 annual fee revised for 2025–26",
    time: "3 hr ago",
    by: "Super Admin",
  },
  {
    icon: UserCog,
    iconStyle: "bg-blue-50 text-blue-600",
    title: "Employee Profile Updated",
    detail: "Ravi Sharma · Subject assignment updated",
    time: "4 hr ago",
    by: "Admin",
  },
  {
    icon: IndianRupee,
    iconStyle: "bg-green-50 text-green-600",
    title: "Fee Payment Received",
    detail: "Kiran Patel · Class 7-B · ₹4,800 (Term Fee)",
    time: "5 hr ago",
    by: "Admin",
  },
];

// ── Helpers ───────────────────────────────────────────────────

const todayStr = new Date().toISOString().split("T")[0];

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Custom Tooltip ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const PRIORITY_BADGE = {
  High:   "bg-red-100 text-red-700 border border-red-200",
  Medium: "bg-amber-100 text-amber-700 border border-amber-200",
  Low:    "bg-green-100 text-green-700 border border-green-200",
};

// ── Login Popup ────────────────────────────────────────────────
function TasksPopup({ tasks, onClose, onToggle }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-school-navy to-school-navy-light px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-white"/>
            </div>
            <div>
              <p className="text-white font-bold text-base">Pending Tasks</p>
              <p className="text-white/60 text-xs mt-0.5">{tasks.length} task{tasks.length !== 1 ? "s" : ""} need attention</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors mt-0.5">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Task list */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-2.5">
          {tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
              <button
                onClick={() => onToggle(task.id)}
                className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-school-navy flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium leading-snug">{task.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
                  <span className="text-[10px] text-gray-400">by {task.createdBy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">Tasks remain until marked complete in Super Admin</p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-school-navy text-white text-sm font-semibold rounded-xl hover:bg-school-navy-dark transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedDate,  setSelectedDate]  = useState(todayStr);
  const [selectedClass, setSelectedClass] = useState("All Classes");

  const { pendingTasks, toggleTask, feePayments, expenses: storeExpenses } = useStore();
  const [showPopup, setShowPopup]   = useState(false);

  const pendingOnly = pendingTasks.filter(t => !t.done);

  // Show popup once per browser session if there are pending tasks
  useEffect(() => {
    if (pendingOnly.length > 0 && !sessionStorage.getItem("tasksPopupShown")) {
      setShowPopup(true);
      sessionStorage.setItem("tasksPopupShown", "1");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isToday   = selectedDate === todayStr;
  const dateLabel = isToday ? "Today" : formatDateLabel(selectedDate);

  const curMonth = new Date().toISOString().slice(0, 7);
  function fmtAmt(n) { return n === 0 ? "₹0" : "₹" + n.toLocaleString("en-IN"); }

  const feeMonthTotal = feePayments.filter(p => p.date.startsWith(curMonth)).reduce((s, p) => s + p.amount, 0);
  const feeDateTotal  = feePayments.filter(p => p.date === selectedDate).reduce((s, p) => s + p.amount, 0);
  const expMonthTotal = storeExpenses.filter(e => e.date.startsWith(curMonth)).reduce((s, e) => s + e.amount, 0);
  const expDateTotal  = storeExpenses.filter(e => e.date === selectedDate).reduce((s, e) => s + e.amount, 0);

  const studentChartData = useMemo(
    () => genStudentAttendance(selectedClass),
    [selectedClass]
  );

  return (
    <div className="space-y-6 max-w-screen-2xl">

      {/* Login popup — shows once per session if pending tasks exist */}
      {showPopup && (
        <TasksPopup
          tasks={pendingOnly}
          onClose={() => setShowPopup(false)}
          onToggle={(id) => { toggleTask(id); }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Good Morning, Admin</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Satyam Stars International School — Management Overview
          </p>
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-school-navy flex-shrink-0" />
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

        {/* 1 — Total Students */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">1,247</p>
          <p className="text-xs font-medium text-gray-500 mt-1">Total Students</p>
          <p className="text-xs mt-1.5 text-green-600">+12 this month</p>
        </div>

        {/* 2 — Total Staff */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">68</p>
          <p className="text-xs font-medium text-gray-500 mt-1">Total Staff</p>
          <p className="text-xs mt-1.5 text-green-600">+2 this month</p>
        </div>

        {/* 3 — Fee Collection */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{fmtAmt(feeMonthTotal)}</p>
          <p className="text-xs font-medium text-gray-500 mt-1">This Month&apos;s Fee Collection</p>
          <p className="text-xs mt-1.5 text-green-600">
            {dateLabel}: {feeDateTotal > 0 ? fmtAmt(feeDateTotal) : "No payments"}
          </p>
        </div>

        {/* 4 — Expenses */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{fmtAmt(expMonthTotal)}</p>
          <p className="text-xs font-medium text-gray-500 mt-1">This Month&apos;s Expenses</p>
          <p className="text-xs mt-1.5 text-red-500">
            {dateLabel}: {expDateTotal > 0 ? fmtAmt(expDateTotal) : "None"}
          </p>
        </div>
      </div>

      {/* ── Pending Tasks Card (shown only if tasks exist) ── */}
      {pendingOnly.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/60">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-red-600" />
              <h3 className="font-semibold text-gray-800 text-sm">Pending Tasks</h3>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingOnly.length}</span>
            </div>
            <button
              onClick={() => setShowPopup(true)}
              className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 transition-colors"
            >
              View All <ArrowUpRight className="w-3 h-3"/>
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingOnly.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => toggleTask(task.id)}
                  className="w-4 h-4 rounded border-2 border-gray-300 hover:border-school-navy flex-shrink-0 transition-colors"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{task.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">by {task.createdBy}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notices + Inventory ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Recent Notices */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-school-navy" />
              <h3 className="font-semibold text-gray-800 text-sm">Recent Notices</h3>
            </div>
            <button className="text-xs text-school-navy hover:text-school-gold font-medium flex items-center gap-1 transition-colors">
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentNotices.map((notice) => (
              <div key={notice.title} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${notice.dot} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate font-medium">{notice.title}</p>
                  <span className="text-xs text-gray-400">{notice.type}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                  {notice.date}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Package className="w-4 h-4 text-school-navy" />
            <h3 className="font-semibold text-gray-800 text-sm">Low Stock Alerts</h3>
          </div>
          <div className="p-4 space-y-3">
            {inventoryAlerts.map((alert) => {
              const pct = Math.round((alert.stock / alert.min) * 100);
              return (
                <div key={alert.item} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700 truncate flex-1">{alert.item}</p>
                    <span className="text-xs text-red-500 font-semibold ml-2">{alert.stock} left</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            <button className="w-full mt-2 text-xs text-school-navy hover:text-school-gold font-medium transition-colors text-center flex items-center justify-center gap-1">
              View Inventory <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Attendance Graphs ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Student Attendance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-school-navy" />
              <h3 className="font-semibold text-gray-800 text-sm">Student Attendance</h3>
            </div>
            {/* Class filter */}
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="appearance-none text-xs font-medium text-school-navy bg-blue-50 border border-blue-100 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none cursor-pointer"
              >
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-school-navy pointer-events-none" />
            </div>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Present" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Absent"  fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employee Attendance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-school-navy" />
              <h3 className="font-semibold text-gray-800 text-sm">Employee Attendance</h3>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">This Week</span>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeAttendanceData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Present" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Absent"  fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Recent Activities ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-school-navy" />
            <h3 className="font-semibold text-gray-800 text-sm">Recent Activities</h3>
            <span className="text-xs bg-school-navy text-white px-2 py-0.5 rounded-full">
              {recentActivities.length}
            </span>
          </div>
          <button className="text-xs text-school-navy hover:text-school-gold font-medium flex items-center gap-1 transition-colors">
            View All <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {recentActivities.map((activity, idx) => {
            const Icon = activity.icon;
            return (
              <div key={idx} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-xl ${activity.iconStyle} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{activity.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{activity.time}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    by <span className="font-medium text-school-navy">{activity.by}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
