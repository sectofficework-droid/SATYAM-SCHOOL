"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Pin, PinOff, Pencil, Archive, ArchiveRestore, Trash2, Bell } from "lucide-react";
import { getNotices, addNotice, updateNotice, deleteNotice } from "@/lib/sefNoticeService";
import DateInputDMY from "@/components/DateInputDMY";

const IPT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-school-navy/20 focus:border-school-navy transition-colors bg-white";
const LBL = "block text-xs font-semibold text-gray-600 mb-1.5";

const NOTICE_TYPES = ["Academic", "Event", "Holiday", "Fee", "Circular", "General", "Urgent"];
const TYPE_DOT = {
  Academic: "bg-purple-400", Event: "bg-blue-400", Holiday: "bg-green-400",
  Fee: "bg-amber-400", Circular: "bg-indigo-400", General: "bg-gray-400", Urgent: "bg-red-400",
};

export default function SefNoticePage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active"); // active | archived
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal, setModal] = useState(null); // null | {} | notice

  const load = useCallback(() => {
    setLoading(true);
    getNotices().then(async (rows) => {
      const today = new Date().toISOString().slice(0, 10);
      const toExpire = rows.filter(n => !n.archived && n.expiry_date && n.expiry_date < today);
      await Promise.all(toExpire.map(n => updateNotice(n.id, { archived: true, pinned: false })));
      setNotices(toExpire.length ? await getNotices() : rows);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const filtered = useMemo(() => {
    return notices
      .filter(n => (tab === "active" ? !n.archived : n.archived))
      .filter(n => typeFilter === "All" || n.type === typeFilter);
  }, [notices, tab, typeFilter]);

  async function handleTogglePin(n) { await updateNotice(n.id, { pinned: !n.pinned }); load(); }
  async function handleToggleArchive(n) { await updateNotice(n.id, { archived: !n.archived, pinned: false }); load(); }
  async function handleDelete(n) { if (confirm("Delete this notice?")) { await deleteNotice(n.id); load(); } }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-school-navy">SEF Notice Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">Post, pin, and archive notices</p>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-school-navy text-white rounded-xl text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Post Notice
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm p-1.5">
          {["active", "archived"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-school-navy text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {t}
            </button>
          ))}
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          {NOTICE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center h-40 gap-2">
          <Bell className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">No notices here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(n => (
            <div key={n.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
              {n.pinned && <span className="text-[10px] font-bold text-school-gold uppercase">Pinned</span>}
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${TYPE_DOT[n.type] || "bg-gray-400"}`} />
                <span className="text-xs font-semibold text-gray-500">{n.type}</span>
              </div>
              <p className="text-sm font-bold text-gray-800">{n.title}</p>
              <p className="text-xs text-gray-600 line-clamp-3">{n.content}</p>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                <p className="text-[10px] text-gray-400">{n.posted_date}{n.posted_by ? ` · ${n.posted_by}` : ""}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTogglePin(n)} title={n.pinned ? "Unpin" : "Pin"} className="p-1.5 rounded-lg text-gray-400 hover:text-school-gold hover:bg-gray-50 transition-colors">
                    {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setModal(n)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-school-navy hover:bg-gray-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleToggleArchive(n)} title={n.archived ? "Restore" : "Archive"} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-gray-50 transition-colors">
                    {n.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleDelete(n)} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && <NoticeModal notice={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function NoticeModal({ notice, onClose, onSaved }) {
  const isEdit = !!notice.id;
  const [title, setTitle] = useState(notice.title || "");
  const [content, setContent] = useState(notice.content || "");
  const [type, setType] = useState(notice.type || "General");
  const [date, setDate] = useState(notice.posted_date || new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(notice.expiry_date || "");
  const [postedBy, setPostedBy] = useState(notice.posted_by || "");
  const [pinned, setPinned] = useState(notice.pinned || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (title.trim().length < 3) { setError("Title must be at least 3 characters"); return; }
    if (content.trim().length < 5) { setError("Content must be at least 5 characters"); return; }
    if (expiryDate && expiryDate < date) { setError("Expiry date must be on or after the posted date"); return; }
    setError(""); setSaving(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), type, date, expiryDate, postedBy, pinned };
      if (isEdit) await updateNotice(notice.id, payload);
      else await addNotice(payload);
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-800">{isEdit ? "Edit Notice" : "Post Notice"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div><label className={LBL}>Title *</label><input className={IPT} value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label className={LBL}>Content *</label><textarea rows={4} className={IPT} value={content} onChange={e => setContent(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Type *</label>
              <select className={IPT} value={type} onChange={e => setType(e.target.value)}>
                {NOTICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={LBL}>Posted By</label><input className={IPT} value={postedBy} onChange={e => setPostedBy(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LBL}>Posted Date *</label><DateInputDMY className={IPT} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label className={LBL}>Expiry Date</label><DateInputDMY className={IPT} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Pin this notice
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors shadow-sm disabled:opacity-60">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Post Notice"}
          </button>
        </div>
      </div>
    </div>
  );
}
