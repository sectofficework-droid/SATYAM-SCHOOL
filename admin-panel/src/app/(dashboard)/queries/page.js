"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, CheckCircle2, RotateCcw, Send, GraduationCap, User } from "lucide-react";
import { getQueries, replyToQuery, markQueryResolved, reopenQuery } from "@/lib/queryService";

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function QueriesPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch]   = useState("");
  const [replyDrafts, setReplyDrafts] = useState({}); // { [id]: text }
  const [busyId, setBusyId]   = useState(null);

  function load() {
    setLoading(true);
    getQueries().then(setRows).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    let d = rows;
    if (roleFilter !== "All") d = d.filter(r => r.user_type === roleFilter.toLowerCase());
    if (statusFilter !== "All") d = d.filter(r => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        (r.user_name || "").toLowerCase().includes(q) ||
        (r.message || "").toLowerCase().includes(q) ||
        (r.class_name || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [rows, roleFilter, statusFilter, search]);

  const summary = useMemo(() => ({
    total:    rows.length,
    pending:  rows.filter(r => r.status === "Pending").length,
    resolved: rows.filter(r => r.status === "Resolved").length,
  }), [rows]);

  async function handleReply(id) {
    const reply = (replyDrafts[id] || "").trim();
    if (!reply) return;
    setBusyId(id);
    try {
      await replyToQuery(id, reply);
      setReplyDrafts(prev => ({ ...prev, [id]: "" }));
      load();
    } catch (e) {
      alert("Failed to save reply: " + e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkResolved(id) {
    setBusyId(id);
    try { await markQueryResolved(id); load(); }
    catch (e) { alert("Failed: " + e.message); }
    finally { setBusyId(null); }
  }

  async function handleReopen(id) {
    setBusyId(id);
    try { await reopenQuery(id); load(); }
    catch (e) { alert("Failed: " + e.message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Queries & Suggestions</h2>
        <p className="text-sm text-gray-500 mt-0.5">Submitted by teachers and students from the mobile app</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600 font-medium">Total</p>
          <p className="text-xl font-bold text-blue-700">{summary.total}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-600 font-medium">Pending</p>
          <p className="text-xl font-bold text-amber-700">{summary.pending}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-xs text-green-600 font-medium">Resolved</p>
          <p className="text-xl font-bold text-green-700">{summary.resolved}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search by name, class, or message..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy bg-white"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy bg-white min-w-32">
          {["All", "Teacher", "Student"].map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy bg-white min-w-32">
          {["All", "Pending", "Resolved"].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-gray-100">
          <MessageSquareText className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">No queries or suggestions match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const resolved = r.status === "Resolved";
            const isTeacher = r.user_type === "teacher";
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isTeacher ? "bg-indigo-50" : "bg-blue-50"}`}>
                      {isTeacher ? <User className="w-4 h-4 text-indigo-600" /> : <GraduationCap className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {r.user_name || "Unknown"}
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{r.user_type}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {r.class_name ? `${r.class_name} · ` : ""}{fmtDateTime(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${resolved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.status}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">{r.message}</p>

                {r.admin_reply && (
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-semibold text-school-navy mb-1">Your Reply</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.admin_reply}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  {!resolved && (
                    <>
                      <input
                        type="text" placeholder="Write a reply (optional) and resolve..."
                        value={replyDrafts[r.id] || ""}
                        onChange={e => setReplyDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy"
                      />
                      <button
                        onClick={() => handleReply(r.id)}
                        disabled={busyId === r.id || !(replyDrafts[r.id] || "").trim()}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-school-navy text-white text-xs font-semibold hover:bg-school-navy-dark disabled:opacity-40 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> Reply & Resolve
                      </button>
                      <button
                        onClick={() => handleMarkResolved(r.id)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50 disabled:opacity-40 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    </>
                  )}
                  {resolved && (
                    <button
                      onClick={() => handleReopen(r.id)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reopen
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
