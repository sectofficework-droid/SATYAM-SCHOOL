"use client";

import { useState, useEffect } from "react";
import { GraduationCap, IndianRupee, Activity } from "lucide-react";
import { getStudents } from "@/lib/sefStudentService";
import { getThisMonthCollection, getRecentPayments } from "@/lib/sefFeesService";

function fmtActivityDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return diff + " days ago";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export default function SefDashboardPage() {
  const [studentCount, setStudentCount] = useState(0);
  const [monthCollection, setMonthCollection] = useState(0);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStudents(), getThisMonthCollection(), getRecentPayments(6)])
      .then(([students, collection, payments]) => {
        setStudentCount(students.filter(s => s.status !== "Inactive").length);
        setMonthCollection(collection);
        setRecentPayments(payments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">SEF Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Satyam Education Foundation — tuition classes overview</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={GraduationCap} label="Active Students" value={studentCount}
              color="text-school-navy" bg="bg-school-navy/10" />
            <StatCard icon={IndianRupee} label="Collected This Month" value={`₹${monthCollection.toLocaleString("en-IN")}`}
              color="text-green-600" bg="bg-green-50" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-school-navy" /> Recent Fee Payments
            </h2>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-gray-400">No fee payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                        <IndianRupee className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.student?.name || "Student"}</p>
                        <p className="text-xs text-gray-400">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{fmtActivityDate(p.payment_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
