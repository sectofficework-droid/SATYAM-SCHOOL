"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  GraduationCap, Users, IndianRupee, TrendingUp, TrendingDown,
  Bell, ArrowUpRight, Package, AlertCircle, Calendar,
  Activity, ClipboardList,
} from "lucide-react";
import { getDashboardStats, getRecentNotices, getInventoryAlerts, getRecentActivities, getStudentAttendanceSummary } from "@/lib/dashboardService";
import { getDashboardTasks } from "@/lib/taskService";
import useStore from "@/lib/store";
import DateInputDMY from "@/components/DateInputDMY";

// ── Dummy Data ────────────────────────────────────────────────


const EMP_TYPE_LABEL = {
  teaching:      "Teaching",
  "non-teaching": "Non-Teaching",
  management:    "Management",
  media:         "Media",
};

function buildEmpChartData(grouped) {
  const order = ["management", "teaching", "non-teaching", "media"];
  const keys  = [...new Set([...order, ...Object.keys(grouped)])];
  return keys
    .filter(k => grouped[k])
    .map(k => ({
      day:     EMP_TYPE_LABEL[k] || k,
      Present: grouped[k].count > 0 ? Math.round(grouped[k].Present / grouped[k].count) : 0,
      Absent:  grouped[k].count > 0 ? Math.round(grouped[k].Absent  / grouped[k].count) : 0,
    }));
}

const CLASS_ORDER = [
  "JR KG", "SR KG", "Balvatika",
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
  "11th Commerce", "12th Commerce",
];

function buildStudentChartData(grouped) {
  const keys = [...new Set([...CLASS_ORDER, ...Object.keys(grouped)])];
  return keys
    .filter(k => grouped[k])
    .map(k => ({
      day:     k,
      Present: grouped[k].Present,
      Absent:  grouped[k].Absent,
    }));
}

const NOTICE_DOT = {
  Event:    "bg-blue-400",
  Academic: "bg-purple-400",
  Holiday:  "bg-green-400",
  Meeting:  "bg-amber-400",
  General:  "bg-gray-400",
  Circular: "bg-indigo-400",
};

function fmtNoticeDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const ACTIVITY_ICON = {
  fee:   { Icon: IndianRupee,  style: "bg-green-50 text-green-600"  },
  admit: { Icon: GraduationCap, style: "bg-purple-50 text-purple-600" },
};

function fmtActivityDate(dateStr) {
  if (!dateStr) return "";
  const d    = new Date(dateStr.length > 10 ? dateStr : dateStr + "T00:00:00");
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return diff + " days ago";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Helpers ───────────────────────────────────────────────────

const todayStr = new Date().toISOString().split("T")[0];

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTaskDeadline(deadline, deadlineTime) {
  if (!deadline) return null;
  const date = new Date(deadline + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (!deadlineTime) return date;
  const [h, m] = deadlineTime.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${date}, ${h12}:${String(m).padStart(2,"0")} ${ampm}`;
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

// ── Main Component ─────────────────────────────────────────────
export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const attendanceSummary = useStore(s => s.attendanceSummary);

  const [dbTotalStudents,  setDbTotalStudents]  = useState(null);
  const [dbTotalStaff,     setDbTotalStaff]     = useState(null);
  const [dbFeePayments,    setDbFeePayments]     = useState([]);
  const [dbExpenses,       setDbExpenses]        = useState([]);
  const [dbNotices,          setDbNotices]          = useState([]);
  const [dbPinnedTasks,      setDbPinnedTasks]      = useState([]);
  const [dbInventoryAlerts,  setDbInventoryAlerts]  = useState(null);
  const [dbRecentActivities, setDbRecentActivities] = useState(null);
  const [dbStudentAttendance, setDbStudentAttendance] = useState(null);

  useEffect(() => {
    getDashboardStats().then(s => {
      setDbTotalStudents(s.totalStudents);
      setDbTotalStaff(s.totalStaff);
      setDbFeePayments(s.feePayments);
      setDbExpenses(s.expenses);
    }).catch(() => {});
    getRecentNotices().then(setDbNotices).catch(() => {});
    getDashboardTasks().then(setDbPinnedTasks).catch(() => {});
    getInventoryAlerts().then(setDbInventoryAlerts).catch(() => {});
    getRecentActivities().then(setDbRecentActivities).catch(() => {});
  }, []);

  // Re-fetched whenever the date picker changes, same as the fee/expense
  // "for this date" figures below.
  useEffect(() => {
    setDbStudentAttendance(null);
    getStudentAttendanceSummary(selectedDate).then(setDbStudentAttendance).catch(() => {});
  }, [selectedDate]);

  const isToday   = selectedDate === todayStr;
  const dateLabel = isToday ? "Today" : formatDateLabel(selectedDate);

  const curMonth = new Date().toISOString().slice(0, 7);
  function fmtAmt(n) { return n === 0 ? "₹0" : "₹" + n.toLocaleString("en-IN"); }

  const feeMonthTotal = dbFeePayments.filter(p => p.date?.startsWith(curMonth)).reduce((s, p) => s + p.amount, 0);
  const feeDateTotal  = dbFeePayments.filter(p => p.date === selectedDate).reduce((s, p) => s + p.amount, 0);
  const expMonthTotal = dbExpenses.filter(e => e.date?.startsWith(curMonth)).reduce((s, e) => s + e.amount, 0);
  const expDateTotal  = dbExpenses.filter(e => e.date === selectedDate).reduce((s, e) => s + e.amount, 0);

  const empChartData = useMemo(
    () => attendanceSummary?.grouped ? buildEmpChartData(attendanceSummary.grouped) : [],
    [attendanceSummary]
  );

  const studentChartData = useMemo(
    () => dbStudentAttendance?.grouped ? buildStudentChartData(dbStudentAttendance.grouped) : [],
    [dbStudentAttendance]
  );

  return (
    <div className="space-y-6 max-w-screen-2xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{(() => { const h = new Date().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; })()}, Admin</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Satyam Stars International School — Management Overview
          </p>
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-school-navy flex-shrink-0" />
          <DateInputDMY
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
          <p className="text-2xl font-bold text-gray-800">
            {dbTotalStudents !== null ? dbTotalStudents.toLocaleString("en-IN") : "—"}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-1">Total Students</p>
          <p className="text-xs mt-1.5 text-gray-400">Current academic year</p>
        </div>

        {/* 2 — Total Staff */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {dbTotalStaff !== null ? dbTotalStaff : "—"}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-1">Total Staff</p>
          <p className="text-xs mt-1.5 text-gray-400">Active employees</p>
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

      {/* ── Pinned Tasks ── */}
      {dbPinnedTasks.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-school-navy/20 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-school-navy/5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-school-navy" />
              <h3 className="font-semibold text-gray-800 text-sm">Pinned Tasks</h3>
              <span className="bg-school-navy text-white text-xs font-bold px-2 py-0.5 rounded-full">{dbPinnedTasks.length}</span>
            </div>
            <a href="/tasks" className="text-xs text-school-navy hover:text-school-gold font-semibold flex items-center gap-1 transition-colors">
              View All <ArrowUpRight className="w-3 h-3"/>
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {dbPinnedTasks.map(task => {
              const priorityBadge = task.priority === "High" ? "bg-red-100 text-red-700" : task.priority === "Low" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
              const statusBadge   = task.status === "In Progress" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600";
              return (
                <div key={task.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{task.title}</p>
                    {task.assignedTo?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{task.assignedTo.join(", ")}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${priorityBadge}`}>{task.priority}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge}`}>{task.status}</span>
                  {task.deadline && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:block flex items-center gap-1">
                      <Calendar className="w-3 h-3 inline-block"/> {fmtTaskDeadline(task.deadline, task.deadlineTime)}
                    </span>
                  )}
                </div>
              );
            })}
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
            <a href="/notice" className="text-xs text-school-navy hover:text-school-gold font-medium flex items-center gap-1 transition-colors">
              View All <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="divide-y divide-gray-50">
            {dbNotices.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No notices posted yet</div>
            ) : dbNotices.map((notice) => (
              <div key={notice.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className={`w-2 h-2 rounded-full ${NOTICE_DOT[notice.type] || "bg-gray-400"} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate font-medium">{notice.title}</p>
                  <span className="text-xs text-gray-400">{notice.type}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                  {fmtNoticeDate(notice.posted_date)}
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
            {dbInventoryAlerts === null ? (
              <div className="py-4 text-center text-gray-400 text-xs">Loading…</div>
            ) : dbInventoryAlerts.length === 0 ? (
              <div className="py-4 text-center text-gray-400 text-xs">No low-stock items</div>
            ) : dbInventoryAlerts.map((alert) => {
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
            <a href="/inventory" className="w-full mt-2 text-xs text-school-navy hover:text-school-gold font-medium transition-colors text-center flex items-center justify-center gap-1">
              View Inventory <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* ── Attendance Graphs ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Student Attendance — marked from the teacher app, grouped by class for the selected date */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center px-5 py-4 border-b border-gray-100 gap-2">
            <GraduationCap className="w-4 h-4 text-school-navy" />
            <h3 className="font-semibold text-gray-800 text-sm">Student Attendance</h3>
            <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">{dateLabel}</span>
          </div>
          {studentChartData.length > 0 ? (
            <div className="p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Present" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Absent"  fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ height: 260 }}>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No Attendance Marked</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                No teacher has marked student attendance for {dateLabel.toLowerCase() === "today" ? "today" : dateLabel} yet.
              </p>
            </div>
          )}
        </div>

        {/* Employee Attendance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-school-navy" />
              <h3 className="font-semibold text-gray-800 text-sm">Employee Attendance</h3>
            </div>
            {attendanceSummary
              ? <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg truncate max-w-[160px]">{attendanceSummary.period}</span>
              : <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">No data</span>
            }
          </div>
          {empChartData.length > 0 ? (
            <div className="p-4" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={empChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} label={{ value: "Avg Days", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#9ca3af" } }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Present" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="Absent"  fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ height: 260 }}>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Users className="w-7 h-7 text-indigo-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No Attendance Data</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Import attendance from the <a href="/employee" className="text-school-navy underline font-medium">Employee</a> module to see the chart here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activities ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-school-navy" />
            <h3 className="font-semibold text-gray-800 text-sm">Recent Activities</h3>
            {dbRecentActivities !== null && dbRecentActivities.length > 0 && (
              <span className="text-xs bg-school-navy text-white px-2 py-0.5 rounded-full">
                {dbRecentActivities.length}
              </span>
            )}
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {dbRecentActivities === null ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : dbRecentActivities.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">No recent activities</div>
          ) : dbRecentActivities.map((activity, idx) => {
            const { Icon, style } = ACTIVITY_ICON[activity.type] || { Icon: Activity, style: "bg-gray-50 text-gray-500" };
            return (
              <div key={idx} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-xl ${style} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{activity.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{fmtActivityDate(activity.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
