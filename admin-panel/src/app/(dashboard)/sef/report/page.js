"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, GraduationCap, IndianRupee, Users, Package } from "lucide-react";
import { getStudentsForReport, getFeesForReport, getEmployeesForReport, getInventoryForReport } from "@/lib/sefReportService";

const REPORTS = [
  { key: "student", label: "Student Report", icon: GraduationCap },
  { key: "fees", label: "Fee Collection", icon: IndianRupee },
  { key: "employee", label: "Employee Report", icon: Users },
  { key: "inventory", label: "Inventory Report", icon: Package },
];

function exportXlsx(rows, headers, fileName) {
  import("xlsx").then(XLSX => {
    const aoa = [headers.map(h => h.label), ...rows.map(r => headers.map(h => r[h.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, fileName.slice(0, 31));
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

const CONFIGS = {
  student: {
    load: getStudentsForReport,
    headers: [
      { key: "name", label: "Name" }, { key: "std", label: "Std" }, { key: "medium", label: "Medium" },
      { key: "school_name", label: "School" }, { key: "mobile_1", label: "Mobile 1" }, { key: "status", label: "Status" },
    ],
  },
  fees: {
    load: getFeesForReport,
    headers: [
      { key: "studentName", label: "Student" }, { key: "std", label: "Std" },
      { key: "amount", label: "Amount" }, { key: "payment_date", label: "Date" }, { key: "received_by", label: "Received By" },
    ],
    map: rows => rows.map(r => ({ ...r, studentName: r.student?.name || "", std: r.student?.std || "" })),
  },
  employee: {
    load: getEmployeesForReport,
    headers: [
      { key: "name", label: "Name" }, { key: "role_type", label: "Role" }, { key: "designation", label: "Designation" },
      { key: "phone", label: "Phone" }, { key: "status", label: "Status" }, { key: "latestSalaryAmount", label: "Latest Salary" },
    ],
    map: rows => rows.map(r => ({ ...r, latestSalaryAmount: r.latestSalary?.amount ?? "" })),
  },
  inventory: {
    load: getInventoryForReport,
    headers: [
      { key: "name", label: "Item" }, { key: "unit", label: "Unit" }, { key: "totalIn", label: "Total In" },
      { key: "totalUsed", label: "Total Used" }, { key: "available", label: "Available" }, { key: "status", label: "Status" },
    ],
  },
};

export default function SefReportPage() {
  const [type, setType] = useState("student");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const cfg = CONFIGS[type];

  const load = useCallback(() => {
    setLoading(true);
    cfg.load().then(data => setRows(cfg.map ? cfg.map(data) : data)).catch(() => setRows([])).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-school-navy">SEF Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Student, fee, employee, and inventory reports</p>
        </div>
        <button onClick={() => exportXlsx(rows, cfg.headers, REPORTS.find(r => r.key === type).label.replace(/\s+/g, "_"))}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 w-fit overflow-x-auto">
        {REPORTS.map(r => {
          const Icon = r.icon;
          return (
            <button key={r.key} onClick={() => setType(r.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${type === r.key ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Icon className="w-4 h-4" /> {r.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">No data yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {cfg.headers.map(h => <th key={h.key} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {cfg.headers.map(h => <td key={h.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">{String(r[h.key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
