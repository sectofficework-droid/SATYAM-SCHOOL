"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ClipboardList, Plus, Search, Calendar, User,
  CheckCircle2, Clock, AlertCircle, X,
  Pencil, Trash2, ArrowRight, CheckCheck, TrendingUp,
  ChevronDown, Check, RefreshCw,
} from "lucide-react";
import { isValidLength } from "@/lib/validators";
import {
  getTasks, addTask, updateTask, deleteTask,
  updateTaskStatus, getEmployeesForTasks,
} from "@/lib/taskService";

// ── Constants ──────────────────────────────────────────────────
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES   = ["Pending", "In Progress", "Completed"];

const PRIORITY_STYLES = {
  High:   { border:"border-l-red-500",   badge:"bg-red-100 text-red-700"     },
  Medium: { border:"border-l-amber-500", badge:"bg-amber-100 text-amber-700"  },
  Low:    { border:"border-l-blue-400",  badge:"bg-blue-100 text-blue-700"    },
};

const STATUS_STYLES = {
  "Pending":     { badge:"bg-gray-100 text-gray-600",     Icon: Clock         },
  "In Progress": { badge:"bg-indigo-100 text-indigo-700", Icon: TrendingUp    },
  "Completed":   { badge:"bg-green-100 text-green-700",   Icon: CheckCircle2  },
  "Overdue":     { badge:"bg-red-100 text-red-700",       Icon: AlertCircle   },
};

// ── Helpers ────────────────────────────────────────────────────
function isOverdue(task) {
  if (task.status === "Completed") return false;
  if (!task.deadline) return false;
  const dt = task.deadlineTime
    ? new Date(`${task.deadline}T${task.deadlineTime}:00`)
    : new Date(`${task.deadline}T23:59:59`);
  return dt < new Date();
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDeadline(deadline, deadlineTime) {
  if (!deadline) return "—";
  return deadlineTime ? `${fmtDate(deadline)}, ${fmtTime(deadlineTime)}` : fmtDate(deadline);
}

function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date(new Date().toDateString())) / 86400000);
}

// ── Staff Multi-Select ─────────────────────────────────────────
function StaffMultiSelect({ employees, selected, onChange, error }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref      = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch("");
  }, [open]);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(emp) {
    onChange(selected.includes(emp.name)
      ? selected.filter(n => n !== emp.name)
      : [...selected, emp.name]
    );
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(name => (
            <span key={name} className="flex items-center gap-1 bg-school-navy/10 text-school-navy text-xs font-semibold px-2 py-1 rounded-lg">
              {name}
              <button type="button" onClick={() => onChange(selected.filter(n => n !== name))}
                className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3"/>
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 border rounded-xl text-sm text-left transition-colors ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
        <span className={`flex-1 ${selected.length ? "text-gray-700 font-medium" : "text-gray-400"}`}>
          {selected.length ? `${selected.length} staff selected` : "Select staff members..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}/>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search staff..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
              />
            </div>
          </div>
          {/* Employee list */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400">No staff match &quot;{search}&quot;</p>
            )}
            {filtered.map(emp => {
              const isSelected = selected.includes(emp.name);
              return (
                <button key={emp.id} type="button" onClick={() => toggle(emp)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 text-sm transition-colors text-left ${isSelected ? "bg-school-navy/5" : ""}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? "bg-school-navy border-school-navy" : "border-gray-300"
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white"/>}
                  </div>
                  <span className={isSelected ? "font-semibold text-school-navy" : "text-gray-700"}>{emp.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────
function TaskModal({ task, employees, onClose, onSave }) {
  const isEdit = !!task?.id;
  const blank  = {
    title:"", description:"", assignedTo:[], priority:"Medium",
    deadline:"", deadlineTime:"", status:"Pending", showOnDashboard: false,
  };
  const [form,    setForm]    = useState(task?.id ? { ...task } : blank);
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // AM/PM time helpers — form stores 24h "HH:MM", picker shows 12h
  const [rawH, rawM] = form.deadlineTime ? form.deadlineTime.split(":").map(Number) : [null, null];
  const tHour = rawH !== null ? (rawH % 12 || 12) : "";
  const tMin  = rawM !== null ? String(rawM).padStart(2, "0") : "00";
  const tAmpm = rawH !== null ? (rawH >= 12 ? "PM" : "AM") : "AM";

  function setTime(h12, m, ampm) {
    if (h12 === "" || h12 === null) { setForm(p => ({ ...p, deadlineTime: "" })); return; }
    const n = Number(h12);
    const h24 = ampm === "PM" ? (n === 12 ? 12 : n + 12) : (n === 12 ? 0 : n);
    setForm(p => ({ ...p, deadlineTime: `${String(h24).padStart(2,"0")}:${m}` }));
  }

  function validate() {
    const e = {};
    if (!form.title.trim())          e.title      = "Title is required";
    else if (!isValidLength(form.title, 100, 3))
                                      e.title      = "Title must be between 3 and 100 characters";
    if (form.description && !isValidLength(form.description, 1000))
                                      e.description = "Description must be 1000 characters or fewer";
    if (!form.assignedTo.length)     e.assignedTo = "Select at least one staff member";
    if (!form.deadline)              e.deadline   = "Deadline date is required";
    else if (!isEdit && new Date(form.deadline) < new Date(new Date().toDateString()))
                                      e.deadline   = "Deadline cannot be in the past";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      // Resolve selected names → employee IDs
      const assigneeIds = form.assignedTo
        .map(name => employees.find(e => e.name === name)?.id)
        .filter(Boolean);
      await onSave({ ...form, assigneeIds });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        <div className="bg-school-navy px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-school-gold"/>
            <p className="text-white font-bold">{isEdit ? "Edit Task" : "Assign New Task"}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy ${errors.title ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              placeholder="Enter task title"
              value={form.title}
              onChange={e => { set("title")(e); setErrors(p => ({...p, title:""})); }}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea rows={3}
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none ${errors.description ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              placeholder="Task details (optional)"
              value={form.description}
              onChange={e => { set("description")(e); setErrors(p => ({...p, description:""})); }}
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Assign To <span className="text-red-500">*</span>
            </label>
            <StaffMultiSelect
              employees={employees}
              selected={form.assignedTo}
              onChange={val => { setForm(p => ({...p, assignedTo: val})); setErrors(p => ({...p, assignedTo:""})); }}
              error={errors.assignedTo}
            />
            {errors.assignedTo && <p className="text-xs text-red-500 mt-1">{errors.assignedTo}</p>}
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Deadline <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                <input type="date"
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy ${errors.deadline ? "border-red-400" : "border-gray-200"}`}
                  value={form.deadline}
                  onChange={e => { set("deadline")(e); setErrors(p => ({...p, deadline:""})); }}
                />
              </div>
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                <select
                  value={tHour}
                  onChange={e => setTime(e.target.value, tMin, tAmpm)}
                  className="text-sm bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="">--</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {tHour !== "" && <>
                  <span className="text-gray-400 text-sm font-bold">:</span>
                  <select
                    value={tMin}
                    onChange={e => setTime(tHour, e.target.value, tAmpm)}
                    className="text-sm bg-transparent focus:outline-none cursor-pointer"
                  >
                    {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex ml-0.5 border border-gray-200 rounded-lg overflow-hidden">
                    {["AM","PM"].map(ap => (
                      <button key={ap} type="button"
                        onClick={() => setTime(tHour, tMin, ap)}
                        className={`px-2 py-0.5 text-xs font-bold transition-colors ${tAmpm===ap ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-100"}`}
                      >{ap}</button>
                    ))}
                  </div>
                </>}
              </div>
            </div>
            {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline}</p>}
            <p className="text-xs text-gray-400 mt-1">Time is optional — if not set, end of day applies</p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} type="button"
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    form.priority === p
                      ? p === "High"   ? "bg-red-500 border-red-500 text-white"
                      : p === "Medium" ? "bg-amber-500 border-amber-500 text-white"
                                       : "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Status — edit only */}
          {isEdit && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Status</label>
              <div className="flex gap-2">
                {STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(prev => ({ ...prev, status: s }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                      form.status === s
                        ? "bg-school-navy border-school-navy text-white"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Show on Dashboard */}
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, showOnDashboard: !p.showOnDashboard }))}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
              form.showOnDashboard
                ? "border-school-navy bg-school-navy/5 text-school-navy"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              form.showOnDashboard ? "border-school-navy bg-school-navy" : "border-gray-300"
            }`}>
              {form.showOnDashboard && <Check className="w-3 h-3 text-white"/>}
            </div>
            Pin to Dashboard
            <span className="ml-auto text-xs font-normal text-gray-400">Visible on main dashboard</span>
          </button>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
              {saving ? "Saving…" : isEdit ? "Update Task" : "Assign Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ──────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const overdue         = isOverdue(task);
  const effectiveStatus = overdue ? "Overdue" : task.status;
  const ps              = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium;
  const ss              = STATUS_STYLES[effectiveStatus]  || STATUS_STYLES.Pending;
  const { Icon: SIcon } = ss;
  const days            = daysLeft(task.deadline);
  const nextStatus      = task.status === "Pending" ? "In Progress"
                        : task.status === "In Progress" ? "Completed"
                        : null;
  const assignees       = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm border-l-4 ${ps.border} hover:shadow-md transition-all flex flex-col`}>
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Top: badges + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ps.badge}`}>
              {task.priority}
            </span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ss.badge}`}>
              <SIcon className="w-3 h-3"/>{effectiveStatus}
            </span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => onEdit(task)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-school-navy hover:bg-school-navy/10 transition-colors">
              <Pencil className="w-3.5 h-3.5"/>
            </button>
            <button onClick={() => onDelete(task.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-bold text-gray-800 leading-snug">{task.title}</p>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{task.description}</p>
        )}

        {/* Assignees */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map(name => (
              <div key={name} title={name}
                className="w-6 h-6 rounded-full bg-school-navy border-2 border-white flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {name.charAt(0)}
              </div>
            ))}
            {assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-[10px] font-bold flex-shrink-0">
                +{assignees.length - 3}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-600 font-medium truncate">
            {assignees.length === 1 ? assignees[0] : `${assignees.length} staff assigned`}
          </span>
        </div>

        {/* Deadline */}
        <div className={`flex items-center gap-1 text-xs font-semibold mt-auto ${
          overdue ? "text-red-600"
          : days !== null && days <= 2 ? "text-amber-600"
          : "text-gray-400"
        }`}>
          <Calendar className="w-3 h-3 flex-shrink-0"/>
          {overdue     ? `Overdue · ${fmtDeadline(task.deadline, task.deadlineTime)}`
          : days === 0 ? `Due Today${task.deadlineTime ? `, ${fmtTime(task.deadlineTime)}` : ""}`
          : days === 1 ? `Due Tomorrow${task.deadlineTime ? `, ${fmtTime(task.deadlineTime)}` : ""}`
          : fmtDeadline(task.deadline, task.deadlineTime)}
        </div>

        {/* Progress button */}
        {task.status !== "Completed" && nextStatus && (
          <button onClick={() => onStatusChange(task.id, nextStatus)}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              nextStatus === "In Progress"
                ? "border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
            }`}>
            <ArrowRight className="w-3.5 h-3.5"/> Mark as {nextStatus}
          </button>
        )}
        {task.status === "Completed" && (
          <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-green-700 bg-green-50 border border-green-200">
            <CheckCheck className="w-3.5 h-3.5"/> Completed
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks,     setTasks]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [statusF,   setStatusF]   = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [assigneeF, setAssigneeF] = useState("All");
  const [deleteId,  setDeleteId]  = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, empData] = await Promise.all([getTasks(), getEmployeesForTasks()]);
      setTasks(taskData);
      setEmployees(empData);
    } catch (e) {
      console.error("Tasks loadAll error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const stats = useMemo(() => ({
    total:      tasks.length,
    pending:    tasks.filter(t => t.status === "Pending"     && !isOverdue(t)).length,
    inProgress: tasks.filter(t => t.status === "In Progress" && !isOverdue(t)).length,
    completed:  tasks.filter(t => t.status === "Completed").length,
    overdue:    tasks.filter(t => isOverdue(t)).length,
  }), [tasks]);

  const filtered = useMemo(() => tasks.filter(t => {
    const eff       = isOverdue(t) ? "Overdue" : t.status;
    const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
    if (statusF   !== "All" && eff !== statusF)                 return false;
    if (priorityF !== "All" && t.priority !== priorityF)        return false;
    if (assigneeF !== "All" && !assignees.includes(assigneeF))  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !assignees.some(a => a.toLowerCase().includes(q)))
        return false;
    }
    return true;
  }), [tasks, statusF, priorityF, assigneeF, search]);

  async function handleSave(form) {
    try {
      if (form.id) {
        const updated = await updateTask(form.id, form);
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await addTask(form);
        setTasks(prev => [created, ...prev]);
      }
      setModal(null);
    } catch (e) {
      console.error("Save task error:", e);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error("Delete task error:", e);
    }
    setDeleteId(null);
  }

  async function handleStatusChange(id, status) {
    try {
      await updateTaskStatus(id, status);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (e) {
      console.error("Status change error:", e);
    }
  }

  const STAT_CARDS = [
    { label:"Total",       value:stats.total,       bg:"bg-school-navy", sub:"text-white/70",        val:"text-white"      },
    { label:"Pending",     value:stats.pending,     bg:"bg-amber-50 border border-amber-200",    sub:"text-amber-600",  val:"text-amber-700"  },
    { label:"In Progress", value:stats.inProgress,  bg:"bg-indigo-50 border border-indigo-200",  sub:"text-indigo-600", val:"text-indigo-700" },
    { label:"Completed",   value:stats.completed,   bg:"bg-green-50 border border-green-200",    sub:"text-green-600",  val:"text-green-700"  },
    { label:"Overdue",     value:stats.overdue,     bg:"bg-red-50 border border-red-200",        sub:"text-red-600",    val:"text-red-700"    },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">
      Loading tasks…
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Task Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Assign tasks to staff, set deadlines and track progress</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll}
            className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:border-school-navy hover:text-school-navy transition-colors">
            <RefreshCw className="w-4 h-4"/>
          </button>
          <button onClick={() => setModal("add")}
            className="flex items-center gap-2 bg-school-navy text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm flex-shrink-0">
            <Plus className="w-4 h-4"/> Assign Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${s.val}`}>{s.value}</p>
            <p className={`text-xs font-semibold mt-0.5 ${s.sub}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
          <input
            className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white"
            placeholder="Search tasks or staff..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none bg-white cursor-pointer"
          value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="All">All Status</option>
          {["Pending","In Progress","Completed","Overdue"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none bg-white cursor-pointer"
          value={priorityF} onChange={e => setPriorityF(e.target.value)}>
          <option value="All">All Priority</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none bg-white cursor-pointer"
          value={assigneeF} onChange={e => setAssigneeF(e.target.value)}>
          <option value="All">All Staff</option>
          {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 font-medium -mt-1">
          Showing {filtered.length} of {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Task Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-300"/>
          </div>
          <p className="text-gray-500 font-semibold">No tasks found</p>
          <p className="text-gray-400 text-sm mt-1">
            {search || statusF !== "All" || priorityF !== "All" || assigneeF !== "All"
              ? "Try adjusting your filters"
              : "Click \"Assign Task\" to create the first task"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task}
              onEdit={t => setModal(t)}
              onDelete={id => setDeleteId(id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(modal === "add" || (modal && modal.id)) && (
        <TaskModal
          task={modal === "add" ? null : modal}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600"/>
            </div>
            <p className="font-bold text-gray-800 mb-1">Delete Task?</p>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
