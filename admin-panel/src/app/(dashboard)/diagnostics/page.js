"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, Search, CheckCircle2, Eye, ChevronDown, ChevronUp, Download, Power } from "lucide-react";
import { getDiagnosticReports, markDiagnosticReport, getDiagnosticsEnabled, setDiagnosticsEnabled } from "@/lib/diagnosticsService";
import useStore from "@/lib/store";

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE = {
  New:      "bg-amber-100 text-amber-700",
  Reviewed: "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
};

export default function DiagnosticsPage() {
  const authUser = useStore(s => s.authUser);
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter]       = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch]   = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId]   = useState(null);
  const [enabled, setEnabled] = useState(null); // null = not loaded yet
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  function load() {
    setLoading(true);
    getDiagnosticReports().then(setRows).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => {
    getDiagnosticsEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  async function handleToggleEnabled() {
    setTogglingEnabled(true);
    try {
      const next = !enabled;
      await setDiagnosticsEnabled(next, authUser?.name || "Admin");
      setEnabled(next);
    } catch (e) {
      alert("Failed to change logging switch: " + e.message);
    } finally {
      setTogglingEnabled(false);
    }
  }

  const filtered = useMemo(() => {
    let d = rows;
    if (appFilter !== "All") d = d.filter(r => r.app === appFilter);
    if (statusFilter !== "All") d = d.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        (r.user_name || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        JSON.stringify(r.log_entries || []).toLowerCase().includes(q)
      );
    }
    return d;
  }, [rows, appFilter, statusFilter, search]);

  const summary = useMemo(() => ({
    total: rows.length,
    new:   rows.filter(r => r.status === "New").length,
  }), [rows]);

  async function handleMark(id, status) {
    setBusyId(id);
    try {
      await markDiagnosticReport(id, status, authUser?.name || "Admin");
      load();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  // senior_admin/management only, matching this project's existing
  // "above normal_admin" gate (e.g. impersonation) — see AGENTS.md project section.
  const canDownload = authUser && authUser.role !== "normal_admin";

  function handleDownload() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Diagnostics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Problem reports from the mobile apps and errors captured automatically on the admin panel</p>
        </div>
        <div className="flex items-center gap-2">
          {canDownload && enabled !== null && (
            <button
              onClick={handleToggleEnabled}
              disabled={togglingEnabled}
              title="Automatic error logging — off by default; this is for active development/debugging, not for collecting what users do"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors ${
                enabled ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Power className="w-3.5 h-3.5" /> Logging: {enabled ? "ON" : "OFF"}
            </button>
          )}
          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-school-navy text-white text-xs font-semibold hover:bg-school-navy-dark disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {enabled === false && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-4 py-3">
          Automatic error logging is currently <strong>OFF</strong> — errors are not being auto-reported from any
          app. This is intentional (logging is for active development/debugging, not passive collection); reports
          submitted via "Report a Problem" in the mobile apps still come through regardless.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600 font-medium">Total</p>
          <p className="text-xl font-bold text-blue-700">{summary.total}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-600 font-medium">New</p>
          <p className="text-xl font-bold text-amber-700">{summary.new}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search by name, description, or log content..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy bg-white"
          />
        </div>
        <select value={appFilter} onChange={e => setAppFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy bg-white min-w-36">
          {["All", "admin-panel", "teacher", "student", "attendance"].map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy bg-white min-w-32">
          {["All", "New", "Reviewed", "Resolved"].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-gray-100">
          <Bug className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">No diagnostic reports match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {r.user_name || "Unknown"}
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{r.app}</span>
                    </p>
                    <p className="text-xs text-gray-400">{fmtDateTime(r.created_at)} · v{r.version || "?"} · {r.log_entries?.length || 0} entries</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>
                    {r.status}
                  </span>
                </div>

                {r.description && (
                  <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">{r.description}</p>
                )}

                {r.log_entries !== undefined && (
                  <button
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-school-navy mt-3"
                  >
                    {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {expanded ? "Hide" : "Show"} log entries
                  </button>
                )}
                {r.log_entries === undefined && (
                  <p className="text-xs text-gray-400 mt-3 italic">Full log entries are visible to senior_admin/management only.</p>
                )}

                {expanded && r.log_entries !== undefined && (
                  <pre className="mt-2 bg-gray-900 text-gray-100 text-[11px] rounded-xl p-4 overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(r.log_entries, null, 2)}
                  </pre>
                )}

                <div className="flex items-center gap-2 mt-4">
                  {r.status !== "Reviewed" && (
                    <button
                      onClick={() => handleMark(r.id, "Reviewed")}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50 disabled:opacity-40 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Mark Reviewed
                    </button>
                  )}
                  {r.status !== "Resolved" && (
                    <button
                      onClick={() => handleMark(r.id, "Resolved")}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 disabled:opacity-40 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
