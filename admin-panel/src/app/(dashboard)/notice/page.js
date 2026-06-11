"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Bell, Plus, Search, Trash2, X, Pin, PinOff,
  ChevronDown, Pencil, Archive, ArchiveRestore,
  Calendar, Users, Clock,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────
const NOTICE_TYPES = ["Academic", "Event", "Holiday", "Fee", "Circular", "General", "Urgent"];
const AUDIENCES    = ["Everyone", "All Students", "All Staff", "Parents", "Management"];

const TYPE_COLOR = {
  Academic:  "bg-blue-100 text-blue-700 border-blue-200",
  Event:     "bg-pink-100 text-pink-700 border-pink-200",
  Holiday:   "bg-green-100 text-green-700 border-green-200",
  Fee:       "bg-amber-100 text-amber-700 border-amber-200",
  Circular:  "bg-purple-100 text-purple-700 border-purple-200",
  General:   "bg-gray-100 text-gray-600 border-gray-200",
  Urgent:    "bg-red-100 text-red-700 border-red-200",
};

const TYPE_DOT = {
  Academic: "bg-blue-400", Event: "bg-pink-400", Holiday: "bg-green-400",
  Fee: "bg-amber-400", Circular: "bg-purple-400", General: "bg-gray-400", Urgent: "bg-red-500",
};

const POSTED_BY_LIST = [
  "Sunil Pradhan", "Rajesh Biswal", "BK Debiprasad Das",
  "Sandeep Pradhan", "Gaurang Polai",
];

const TODAY = new Date().toISOString().split("T")[0];
let _nextId = 200;
function uid() { return _nextId++; }

const INITIAL_NOTICES = [
  {
    id: uid(), title: "Annual Sports Day — 25th June 2026",
    content: "The Annual Sports Day will be held on 25th June 2026 at the school ground. All students must report by 8:00 AM in their house colour T-shirts. Parents are cordially invited.",
    type: "Event", audience: "Everyone", date: "2026-06-10", expiryDate: "2026-06-25",
    postedBy: "Sunil Pradhan", pinned: true, archived: false,
  },
  {
    id: uid(), title: "Fee Payment Reminder — Last Date 20th June",
    content: "This is a reminder that the last date for fee payment for the academic year 2026-27 is 20th June 2026. Students with pending fees will not receive admit cards.",
    type: "Fee", audience: "Parents", date: "2026-06-08", expiryDate: "2026-06-20",
    postedBy: "Gaurang Polai", pinned: false, archived: false,
  },
  {
    id: uid(), title: "Summer Vacation from 1st July 2026",
    content: "School will remain closed for summer vacation from 1st July 2026 to 31st July 2026. School will reopen on 1st August 2026 as per academic schedule.",
    type: "Holiday", audience: "Everyone", date: "2026-06-05", expiryDate: "2026-07-31",
    postedBy: "Sunil Pradhan", pinned: false, archived: false,
  },
  {
    id: uid(), title: "Staff Meeting — 15th June 2026",
    content: "All teaching and non-teaching staff are required to attend the monthly staff meeting on 15th June 2026 at 4:00 PM in the conference hall. Attendance is mandatory.",
    type: "Circular", audience: "All Staff", date: "2026-06-03", expiryDate: "2026-06-15",
    postedBy: "Rajesh Biswal", pinned: false, archived: false,
  },
  {
    id: uid(), title: "New Academic Timetable Effective 12th June",
    content: "The revised timetable for the academic year 2026-27 will be effective from 12th June 2026. Class teachers will distribute printed copies to students.",
    type: "Academic", audience: "Everyone", date: "2026-06-01", expiryDate: "2026-06-12",
    postedBy: "BK Debiprasad Das", pinned: false, archived: false,
  },
];

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return d; }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00") - new Date(TODAY + "T00:00:00");
  return Math.ceil(diff / 86400000);
}

// ── Notice Form Modal ───────────────────────────────────────────
function NoticeModal({ initial, onClose, onSave }) {
  const editing = !!initial;
  const [title,    setTitle]    = useState(initial?.title    ?? "");
  const [content,  setContent]  = useState(initial?.content  ?? "");
  const [type,     setType]     = useState(initial?.type     ?? NOTICE_TYPES[0]);
  const [audience, setAudience] = useState(initial?.audience ?? AUDIENCES[0]);
  const [date,       setDate]       = useState(initial?.date       ?? TODAY);
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [postedBy,   setPostedBy]   = useState(initial?.postedBy   ?? POSTED_BY_LIST[0]);
  const [pinned,     setPinned]     = useState(initial?.pinned     ?? false);

  const valid = title.trim() && content.trim() && date;

  function handleSave() {
    if (!valid) return;
    onSave({
      id: initial?.id ?? uid(),
      title: title.trim(), content: content.trim(),
      type, audience, date, expiryDate: expiryDate || null, postedBy, pinned,
      archived: initial?.archived ?? false,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">{editing ? "Edit Notice" : "Post New Notice"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500"/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title *</label>
            <input className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
              placeholder="Notice title…" value={title} onChange={e => setTitle(e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type *</label>
              <div className="relative">
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white pr-9">
                  {NOTICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Audience *</label>
              <div className="relative">
                <select value={audience} onChange={e => setAudience(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white pr-9">
                  {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Posted Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Posted By</label>
              <div className="relative">
                <select value={postedBy} onChange={e => setPostedBy(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy bg-white pr-9">
                  {POSTED_BY_LIST.map(p => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Event / Expiry Date <span className="text-gray-400 font-normal">(optional — notice auto-archives after this date)</span>
            </label>
            <div className="relative">
              <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
              <input type="date" value={expiryDate} min={date || TODAY} onChange={e => setExpiryDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Content *</label>
            <textarea rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Write the notice content here…"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy resize-none leading-relaxed"/>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={() => setPinned(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${pinned ? "bg-school-navy" : "bg-gray-200"} relative`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pinned ? "translate-x-5" : "translate-x-0.5"}`}/>
            </div>
            <span className="text-sm text-gray-600 font-medium">Pin this notice to the top</span>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy-dark transition-colors disabled:opacity-40">
            {editing ? "Save Changes" : "Post Notice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notice Card ─────────────────────────────────────────────────
function NoticeCard({ notice, onEdit, onDelete, onTogglePin, onToggleArchive }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${notice.pinned ? "border-school-navy/30" : "border-gray-100"} ${notice.archived ? "opacity-60" : ""}`}>
      {notice.pinned && (
        <div className="bg-school-navy px-4 py-1.5 flex items-center gap-1.5">
          <Pin className="w-3 h-3 text-white/70"/>
          <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Pinned</span>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_DOT[notice.type]}`}/>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_COLOR[notice.type]}`}>{notice.type}</span>
              <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{notice.audience}</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{notice.title}</h3>
            <p className={`text-xs text-gray-500 mt-1.5 leading-relaxed ${!expanded ? "line-clamp-2" : ""}`}>{notice.content}</p>
            {notice.content.length > 100 && (
              <button onClick={() => setExpanded(v => !v)} className="text-[11px] text-school-navy font-semibold mt-1 hover:underline">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </div>
        {notice.expiryDate && (() => {
          const d = daysUntil(notice.expiryDate);
          if (d === null) return null;
          const cls = d <= 0
            ? "bg-red-100 text-red-700 border-red-200"
            : d <= 3
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : "bg-gray-100 text-gray-500 border-gray-200";
          const label = d < 0
            ? "Expired"
            : d === 0
            ? "Expires today"
            : `Expires in ${d} day${d !== 1 ? "s" : ""}`;
          return (
            <div className={`flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full border text-[10px] font-bold w-fit ${cls}`}>
              <Clock className="w-3 h-3 flex-shrink-0"/>{label} · {fmtDate(notice.expiryDate)}
            </div>
          );
        })()}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{fmtDate(notice.date)}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{notice.postedBy.split(" ")[0]}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onTogglePin(notice.id)} title={notice.pinned ? "Unpin" : "Pin"}
              className="p-1.5 rounded-lg text-gray-400 hover:text-school-navy hover:bg-school-navy/5 transition-colors">
              {notice.pinned ? <PinOff className="w-3.5 h-3.5"/> : <Pin className="w-3.5 h-3.5"/>}
            </button>
            <button onClick={() => onEdit(notice)} title="Edit"
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Pencil className="w-3.5 h-3.5"/>
            </button>
            <button onClick={() => onToggleArchive(notice.id)} title={notice.archived ? "Restore" : "Archive"}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
              {notice.archived ? <ArchiveRestore className="w-3.5 h-3.5"/> : <Archive className="w-3.5 h-3.5"/>}
            </button>
            <button onClick={() => onDelete(notice.id)} title="Delete"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function NoticePage() {
  const [notices,    setNotices]    = useState(INITIAL_NOTICES);
  const [tab,        setTab]        = useState("active");   // active | archived

  // Auto-archive notices whose expiryDate has passed
  useEffect(() => {
    setNotices(prev => {
      const updated = prev.map(n =>
        !n.archived && n.expiryDate && n.expiryDate < TODAY
          ? { ...n, archived: true, pinned: false }
          : n
      );
      const changed = updated.some((n, i) => n.archived !== prev[i].archived);
      return changed ? updated : prev;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modal,      setModal]      = useState(null);       // null | "new" | notice-object (edit)

  const visible = useMemo(() => {
    const base = notices.filter(n => tab === "archived" ? n.archived : !n.archived);
    return base
      .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
      .filter(n => typeFilter === "all" || n.type === typeFilter)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
  }, [notices, tab, search, typeFilter]);

  const activeCount   = notices.filter(n => !n.archived).length;
  const archivedCount = notices.filter(n =>  n.archived).length;
  const pinnedCount   = notices.filter(n => !n.archived && n.pinned).length;

  function saveNotice(data) {
    setNotices(prev => {
      const exists = prev.find(n => n.id === data.id);
      return exists ? prev.map(n => n.id === data.id ? data : n) : [data, ...prev];
    });
    setModal(null);
  }

  function deleteNotice(id) {
    if (confirm("Delete this notice permanently?")) setNotices(prev => prev.filter(n => n.id !== id));
  }

  function togglePin(id)     { setNotices(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)); }
  function toggleArchive(id) { setNotices(prev => prev.map(n => n.id === id ? { ...n, archived: !n.archived, pinned: false } : n)); }

  return (
    <>
      {modal && (
        <NoticeModal
          initial={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={saveNotice}
        />
      )}

      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Notice Board</h2>
            <p className="text-sm text-gray-500 mt-0.5">Post and manage school announcements &amp; circulars</p>
          </div>
          <button onClick={() => setModal("new")}
            className="flex items-center gap-2 bg-school-navy hover:bg-school-navy-dark text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4"/> Post Notice
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active",   value: activeCount,   icon: Bell,         bg: "bg-blue-50",   color: "text-blue-600"  },
            { label: "Pinned",   value: pinnedCount,   icon: Pin,          bg: "bg-amber-50",  color: "text-amber-600" },
            { label: "Archived", value: archivedCount, icon: Archive,      bg: "bg-gray-100",  color: "text-gray-500"  },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`}/>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-xl font-bold text-gray-800">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Active / Archived tabs */}
          <div className="flex gap-2 border-b border-gray-100 pb-3">
            {[["active","Active","text-blue-600"],["archived","Archived","text-gray-500"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === k ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-100"
                }`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
              <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy"
                placeholder="Search notices…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[["all","All"], ...NOTICE_TYPES.map(t => [t, t])].map(([k, l]) => (
                <button key={k} onClick={() => setTypeFilter(k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    typeFilter === k ? "bg-school-navy text-white border-school-navy" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>{l}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium ml-auto">{visible.length} notice{visible.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Notice Cards */}
        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-center gap-3">
            <Bell className="w-10 h-10 text-gray-200"/>
            <p className="text-gray-400 font-medium text-sm">No notices found.</p>
            {tab === "active" && <button onClick={() => setModal("new")} className="text-school-navy text-sm font-semibold hover:underline">Post the first notice</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(n => (
              <NoticeCard
                key={n.id} notice={n}
                onEdit={setModal}
                onDelete={deleteNotice}
                onTogglePin={togglePin}
                onToggleArchive={toggleArchive}
              />
            ))}
          </div>
        )}

      </div>
    </>
  );
}
