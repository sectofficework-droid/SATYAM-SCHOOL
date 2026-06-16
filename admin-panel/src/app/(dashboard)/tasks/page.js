"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ClipboardList, Plus, Search, Calendar, User,
  CheckCircle2, Clock, AlertCircle, X,
  Pencil, Trash2, ArrowRight, CheckCheck, TrendingUp,
  ChevronDown, Check,
} from "lucide-react";
import { isValidLength } from "@/lib/validators";

// ── Constants ──────────────────────────────────────────────────
const STAFF_MEMBERS = [
  // Admin
  "Rajesh Biswal",
  "BK Debiprasad Das",
  "Sandeep Pradhan",
  "Gaurang Polai",
  "Rudra Prasad Muni",
  "Ayeshkant Rout",
  // Teachers
  "Pami Pradhan",
  "Rashmita Patra",
  "Priti Singh",
  "Janki Das",
  "Shivani Pradhan",
  "Smurti Panda",
  "Manisha Biswal",
  "Parvati Polai",
  "Sita Gouda",
  "Kabita Panigrahi",
  "Barsha Pradhan",
  "Liza Patra",
  "Laxmi Behera",
  "Pragyan Panda",
  "Priyanka Bisoyi",
  "Priyanka Padhi",
  // Care Taker
  "Rina Gouda",
];

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

const TODAY = new Date().toISOString().split("T")[0];

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

// ── Dummy Data ─────────────────────────────────────────────────
const INITIAL_TASKS = [
  {
    id:1, title:"Prepare class timetable for 2026-27",
    description:"Create and distribute the class timetable for all sections before the new academic year begins.",
    assignedTo:["Pami Pradhan","Shivani Pradhan"], priority:"High", status:"In Progress",
    deadline:"2026-06-10", deadlineTime:"17:00", createdAt:"2026-06-01",
  },
  {
    id:2, title:"Collect pending fee forms from parents",
    description:"Follow up with parents of students with outstanding fee forms from the previous year.",
    assignedTo:["Rajesh Biswal"], priority:"High", status:"Pending",
    deadline:"2026-06-08", deadlineTime:"12:00", createdAt:"2026-06-03",
  },
  {
    id:3, title:"Update student attendance register",
    description:"Verify and update physical attendance registers for all classes for May 2026.",
    assignedTo:["Rashmita Patra"], priority:"Medium", status:"Completed",
    deadline:"2026-06-05", deadlineTime:"", createdAt:"2026-05-28",
  },
  {
    id:4, title:"Inventory check for new academic year",
    description:"Count and record all textbooks, notebooks, and stationery available in the inventory room.",
    assignedTo:["Sandeep Pradhan","Gaurang Polai"], priority:"Medium", status:"Pending",
    deadline:"2026-06-12", deadlineTime:"15:00", createdAt:"2026-06-04",
  },
  {
    id:5, title:"Submit board exam results to principal",
    description:"Compile and submit the 10th and 12th board exam result summary to the principal office.",
    assignedTo:["Priti Singh","Janki Das"], priority:"Low", status:"Pending",
    deadline:"2026-06-15", deadlineTime:"10:00", createdAt:"2026-06-05",
  },
];

// ── Staff Multi-Select ─────────────────────────────────────────
function StaffMultiSelect({ selected, onChange, error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(name) {
    onChange(selected.includes(name)
      ? selected.filter(s => s !== name)
      : [...selected, name]
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(s => (
            <span key={s} className="flex items-center gap-1 bg-school-navy/10 text-school-navy text-xs font-semibold px-2 py-1 rounded-lg">
              {s}
              <button type="button" onClick={() => toggle(s)}
                className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3"/>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
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

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
          {STAFF_MEMBERS.map(s => {
            const isSelected = selected.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggle(s)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 text-sm transition-colors text-left ${isSelected ? "bg-school-navy/5" : ""}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? "bg-school-navy border-school-navy" : "border-gray-300"
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5 text-white"/>}
                </div>
                <span className={isSelected ? "font-semibold text-school-navy" : "text-gray-700"}>{s}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────
function TaskModal({ task, onClose, onSave }) {
  const isEdit = !!task?.id;
  const blank  = {
    title:"", description:"", assignedTo:[], priority:"Medium",
    deadline:"", deadlineTime:"", status:"Pending",
  };
  const [form,   setForm]   = useState(task?.id ? { ...task } : blank);
  const [errors, setErrors] = useState({});

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.title.trim())           e.title      = "Title is required";
    else if (!isValidLength(form.title, 100, 3))
                                       e.title      = "Title must be between 3 and 100 characters";
    if (form.description && !isValidLength(form.description, 1000))
                                       e.description = "Description must be 1000 characters or fewer";
    if (!form.assignedTo.length)      e.assignedTo = "Select at least one staff member";
    if (!form.deadline)               e.deadline   = "Deadline date is required";
    else if (!isEdit && new Date(form.deadline) < new Date(new Date().toDateString()))
                                       e.deadline   = "Deadline cannot be in the past";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (validate()) onSave(form);
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

          {/* Assign To (multi-select) */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Assign To <span className="text-red-500">*</span>
            </label>
            <StaffMultiSelect
              selected={form.assignedTo}
              onChange={val => { setForm(p => ({...p, assignedTo: val})); setErrors(p => ({...p, assignedTo:""})); }}
              error={errors.assignedTo}
            />
            {errors.assignedTo && <p className="text-xs text-red-500 mt-1">{errors.assignedTo}</p>}
          </div>

          {/* Deadline date + time */}
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
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                <input type="time"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                  value={form.deadlineTime}
                  onChange={set("deadlineTime")}
                />
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

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm">
              {isEdit ? "Update Task" : "Assign Task"}
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
  const [tasks,     setTasks]     = useState(INITIAL_TASKS);
  const [modal,     setModal]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [statusF,   setStatusF]   = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [assigneeF, setAssigneeF] = useState("All");
  const [deleteId,  setDeleteId]  = useState(null);

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
    if (statusF   !== "All" && eff !== statusF)                   return false;
    if (priorityF !== "All" && t.priority !== priorityF)          return false;
    if (assigneeF !== "All" && !assignees.includes(assigneeF))    return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle    = t.title.toLowerCase().includes(q);
      const inAssignee = assignees.some(a => a.toLowerCase().includes(q));
      if (!inTitle && !inAssignee) return false;
    }
    return true;
  }), [tasks, statusF, priorityF, assigneeF, search]);

  function handleSave(form) {
    if (form.id) {
      setTasks(prev => prev.map(t => t.id === form.id ? { ...form } : t));
    } else {
      setTasks(prev => [{ ...form, id: Date.now(), createdAt: TODAY }, ...prev]);
    }
    setModal(null);
  }

  function handleDelete(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setDeleteId(null);
  }

  function handleStatusChange(id, status) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }

  const STAT_CARDS = [
    { label:"Total",       value:stats.total,      bg:"bg-school-navy", sub:"text-white/70",        val:"text-white"      },
    { label:"Pending",     value:stats.pending,     bg:"bg-amber-50 border border-amber-200",    sub:"text-amber-600",  val:"text-amber-700"  },
    { label:"In Progress", value:stats.inProgress,  bg:"bg-indigo-50 border border-indigo-200",  sub:"text-indigo-600", val:"text-indigo-700" },
    { label:"Completed",   value:stats.completed,   bg:"bg-green-50 border border-green-200",    sub:"text-green-600",  val:"text-green-700"  },
    { label:"Overdue",     value:stats.overdue,     bg:"bg-red-50 border border-red-200",        sub:"text-red-600",    val:"text-red-700"    },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Task Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Assign tasks to staff, set deadlines and track progress</p>
        </div>
        <button onClick={() => setModal("add")}
          className="flex items-center gap-2 bg-school-navy text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm flex-shrink-0">
          <Plus className="w-4 h-4"/> Assign Task
        </button>
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
          {STAFF_MEMBERS.map(s => <option key={s}>{s}</option>)}
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
