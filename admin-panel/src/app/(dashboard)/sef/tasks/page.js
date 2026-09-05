"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, ClipboardList, Pencil, Trash2, Check } from "lucide-react";
import { getTasks, addTask, updateTask, deleteTask } from "@/lib/sefTaskService";
import { getEmployees } from "@/lib/sefEmployeeService";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Pending", "In Progress", "Completed"];
const PRIORITY_COLOR = { High: "border-l-red-500", Medium: "border-l-amber-500", Low: "border-l-gray-300" };
const STATUS_BADGE = { Pending: "bg-gray-100 text-gray-600", "In Progress": "bg-amber-100 text-amber-700", Completed: "bg-green-100 text-green-700" };

function nextStatus(s) { return STATUSES[Math.min(STATUSES.indexOf(s) + 1, STATUSES.length - 1)]; }

export default function SefTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modal, setModal] = useState(null); // null | {} | task
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getTasks(), getEmployees()]).then(([t, e]) => { setTasks(t); setEmployees(e.filter(x => x.status !== "Inactive")); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const counts = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "Pending").length,
    inProgress: tasks.filter(t => t.status === "In Progress").length,
    completed: tasks.filter(t => t.status === "Completed").length,
  };

  async function handleAdvance(t) {
    await updateTask(t.id, {
      title: t.title, description: t.description, deadlineDate: t.deadline_date, deadlineTime: t.deadline_time,
      priority: t.priority, status: nextStatus(t.status), showOnDashboard: t.show_on_dashboard,
      assigneeIds: (t.sef_task_assignees || []).map(a => a.employee?.id).filter(Boolean),
    });
    load();
  }

  async function handleDelete() { await deleteTask(deleteId); setDeleteId(null); load(); }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-school-navy">SEF Task Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign and track staff tasks</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Total", counts.total, "text-school-navy"], ["Pending", counts.pending, "text-gray-500"], ["In Progress", counts.inProgress, "text-amber-600"], ["Completed", counts.completed, "text-green-600"]].map(([label, val, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-40" />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="All">All Priority</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center h-40 gap-2">
          <ClipboardList className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">No tasks found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <div key={t.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 border-l-4 ${PRIORITY_COLOR[t.priority]} flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-800">{t.title}</p>
              {t.description && <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                {(t.sef_task_assignees || []).map(a => a.employee && (
                  <span key={a.employee.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-school-navy/10 text-school-navy">{a.employee.name}</span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                <p className="text-[10px] text-gray-400">Due {t.deadline_date}</p>
                {t.status !== "Completed" && (
                  <button onClick={() => handleAdvance(t)} className="flex items-center gap-1 text-xs font-semibold text-school-navy hover:underline">
                    <Check className="w-3 h-3" /> Mark as {nextStatus(t.status)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <TaskModal task={modal} employees={employees} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-sm text-gray-700 mb-4">Delete this task?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, employees, onClose, onSaved }) {
  const isEdit = !!task.id;
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [deadlineDate, setDeadlineDate] = useState(task.deadline_date || "");
  const [priority, setPriority] = useState(task.priority || "Medium");
  const [status, setStatus] = useState(task.status || "Pending");
  const [showOnDashboard, setShowOnDashboard] = useState(task.show_on_dashboard || false);
  const [assigneeIds, setAssigneeIds] = useState(new Set((task.sef_task_assignees || []).map(a => a.employee?.id).filter(Boolean)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleAssignee(id) { setAssigneeIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function handleSave() {
    if (title.trim().length < 3) { setError("Title must be at least 3 characters"); return; }
    if (!deadlineDate) { setError("Select a deadline date"); return; }
    if (assigneeIds.size === 0) { setError("Assign to at least one staff member"); return; }
    setError(""); setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), deadlineDate, priority, status, showOnDashboard, assigneeIds: [...assigneeIds] };
      if (isEdit) await updateTask(task.id, payload);
      else await addTask(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? "Edit Task" : "Add Task"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div><label className={LBL}>Title *</label><input className={IPT} value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label className={LBL}>Description</label><textarea rows={3} className={IPT} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div>
            <label className={LBL}>Assign To *</label>
            <div className="border border-gray-200 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1">
              {employees.length === 0 ? <p className="text-xs text-gray-400 px-2 py-1">No staff found</p> : employees.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={assigneeIds.has(e.id)} onChange={() => toggleAssignee(e.id)} /> {e.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Deadline *</label><DateInputDMY className={IPT} value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} /></div>
            <div>
              <label className={LBL}>Priority</label>
              <select className={IPT} value={priority} onChange={e => setPriority(e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
            </div>
          </div>
          {isEdit && (
            <div>
              <label className={LBL}>Status</label>
              <div className="flex gap-2">
                {STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${status === s ? "bg-school-navy text-white border-school-navy" : "border-gray-200 text-gray-600"}`}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showOnDashboard} onChange={e => setShowOnDashboard(e.target.checked)} /> Pin to Dashboard
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
