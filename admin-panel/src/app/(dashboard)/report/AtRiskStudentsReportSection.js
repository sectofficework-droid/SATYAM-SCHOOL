"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, CheckCircle2, RefreshCw } from "lucide-react";
import supabase from "@/lib/supabase";
import useConfirm from "@/components/ConfirmDialog";

const SIGNAL_LABELS = {
  exam: "Exam performance",
  daily_log: "Daily progress",
  attendance: "Attendance",
};

const STATUS_FILTERS = [
  { key: "open", label: "Open (New + Acknowledged)" },
  { key: "New", label: "New" },
  { key: "Acknowledged", label: "Acknowledged" },
  { key: "Resolved", label: "Resolved" },
];

// REQ-FEAT-018 (2026-10-18) - Principal/admin-facing counterpart to the
// Teacher app's AtRiskStudentsCard: a school-wide view across every class
// of students flagged by the same three signals (exam average, daily-log
// incompletes, attendance), so a principal can decide when it's time to
// loop in a parent rather than relying on each class teacher noticing on
// their own. Re-evaluates (evaluate_student_risk_flags(NULL) - every
// class) on load/refresh so this is never stale, then reads
// student_risk_flags directly (admin panel is authenticated + is_admin_
// user()-gated on that table, same RLS pattern as student_daily_log).
export default function AtRiskStudentsReportSection() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async (runEvaluation) => {
    setLoading(true);
    setError("");
    if (runEvaluation) {
      setEvaluating(true);
      const { error: evalErr } = await supabase.rpc("evaluate_student_risk_flags", { p_class_name: null });
      setEvaluating(false);
      if (evalErr) { setError(evalErr.message || "Failed to re-evaluate."); setLoading(false); return; }
    }
    let query = supabase.from("student_risk_flags")
      .select("id, student_id, class_name, signal, detail, status, flagged_at, students(first_name, last_name, grno)")
      .order("flagged_at", { ascending: false });
    query = statusFilter === "open" ? query.in("status", ["New", "Acknowledged"]) : query.eq("status", statusFilter);
    const { data, error: err } = await query;
    if (err) { setError(err.message || "Failed to load."); setRows([]); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(true); }, [load]);

  // A student can trip more than one signal at once (low attendance AND
  // poor exam results AND incomplete daily log, say) - group the flat
  // per-(student, signal) rows so the table shows them adjacent under one
  // rowspan'd student cell with an issue-count badge, instead of looking
  // like unrelated duplicate entries for the same name (user-reported gap,
  // 2026-10-18).
  const groups = [];
  const groupIndex = new Map();
  for (const r of rows) {
    let g = groupIndex.get(r.student_id);
    if (!g) { g = { student: r.students, rows: [] }; groupIndex.set(r.student_id, g); groups.push(g); }
    g.rows.push(r);
  }

  async function resolveFlag(id) {
    const ok = await confirm("Mark this student's flag as Resolved? This records that it's been handled (e.g. parents already informed, or the issue is no longer current).");
    if (!ok) return;
    setResolving(id);
    const { error: err } = await supabase.from("student_risk_flags")
      .update({ status: "Resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    setResolving(null);
    if (err) { setError(err.message || "Failed to resolve."); return; }
    setRows(rows => statusFilter === "Resolved" || statusFilter === "open"
      ? rows.map(r => r.id === id ? { ...r, status: "Resolved" } : r).filter(r => statusFilter !== "open" || r.status !== "Resolved")
      : rows.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === f.key ? "bg-school-navy text-white border-school-navy" : "bg-white text-gray-600 border-gray-200 hover:border-school-navy/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors disabled:opacity-60">
          <RefreshCw className={`w-3 h-3 ${evaluating ? "animate-spin text-school-navy" : ""}`}/>
          {evaluating ? "Re-evaluating..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-gray-400">No students match this filter.</p>
      )}

      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            <Flag className="w-4 h-4 text-school-navy" /> {groups.length} students flagged
            {rows.length !== groups.length && <span className="text-gray-400 font-normal">· {rows.length} issues total</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Student</th>
                  <th className="text-left px-3 py-2">Class</th>
                  <th className="text-left px-3 py-2">Signal</th>
                  <th className="text-left px-3 py-2">Detail</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Flagged</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => g.rows.map((r, i) => (
                  <tr key={r.id} className={`border-t border-gray-100 ${g.rows.length > 1 ? "bg-red-50/40" : ""}`}>
                    {i === 0 && (
                      <td className="px-3 py-2 font-medium text-gray-800 align-top" rowSpan={g.rows.length}>
                        <div className="flex items-center gap-1.5">
                          {g.rows.length > 1 && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                              {g.rows.length}
                            </span>
                          )}
                          <span>
                            {`${g.student?.first_name || ""} ${g.student?.last_name || ""}`.trim() || "—"}
                            {g.student?.grno && <span className="text-gray-400 font-normal"> · {g.student.grno}</span>}
                          </span>
                        </div>
                      </td>
                    )}
                    {i === 0 && (
                      <td className="px-3 py-2 text-gray-600 align-top" rowSpan={g.rows.length}>{r.class_name}</td>
                    )}
                    <td className="px-3 py-2 text-gray-600">{SIGNAL_LABELS[r.signal] || r.signal}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-sm">{r.detail}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === "New" ? "bg-red-100 text-red-700"
                        : r.status === "Acknowledged" ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{new Date(r.flagged_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status !== "Resolved" && (
                        <button onClick={() => resolveFlag(r.id)} disabled={resolving === r.id}
                          className="flex items-center gap-1 text-xs text-school-navy hover:underline disabled:opacity-50 ml-auto">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {resolving === r.id ? "Resolving..." : "Resolve"}
                        </button>
                      )}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
