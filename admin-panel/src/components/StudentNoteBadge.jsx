"use client";

// General-purpose Admin Note per student (REQ-FEAT-024) - shared, reusable
// badge+popover used on the Student list, Government Entry, and Documents
// pages. One free-text note per student, latest-state only.

import { useState } from "react";
import { StickyNote, X, Check, RefreshCw, ChevronDown, BellRing } from "lucide-react";
import { upsertStudentAdminNote, setManualReminder } from "@/lib/studentService";
import { useReminders } from "@/contexts/ReminderContext";
import useStore from "@/lib/store";

// Quick-select phrases - just a typing shortcut, not a fixed category: picking
// one appends plain text into the note, which stays free-form either way.
const QUICK_NOTES = [
  "Government Entry: age not valid",
  "Government Entry: documents mismatch",
  "Only for study (not for Govt Entry)",
  "TC received but student not yet released",
  "Awaiting parent response",
  "Follow up next admission cycle",
];

export default function StudentNoteBadge({ studentId, note, onSaved, align = "left" }) {
  const authUser = useStore(s => s.authUser);
  const { refresh: refreshReminders } = useReminders();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [alsoRemind, setAlsoRemind] = useState(false);
  const [saving, setSaving] = useState(false);

  const openPopover = () => {
    setDraft(note || "");
    setAlsoRemind(false);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const handleQuickPick = (e) => {
    const phrase = e.target.value;
    e.target.value = ""; // reset so the same phrase can be picked again
    if (!phrase) return;
    setDraft(d => (d && d.trim() ? `${d.trim()}; ${phrase}` : phrase));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertStudentAdminNote(studentId, { note: draft, updatedBy: authUser?.id });
      if (alsoRemind) {
        await setManualReminder(studentId, draft, authUser?.id);
        refreshReminders();
      }
      onSaved?.(studentId, draft);
      setOpen(false);
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const hasNote = Boolean(note && note.trim());

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={openPopover}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border cursor-pointer transition-colors max-w-[140px] ${
          hasNote
            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
            : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
        }`}
        title={hasNote ? note : "Add a note"}
      >
        <StickyNote className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{hasNote ? note : "Add note"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-300 p-2.5 z-50 space-y-2 text-xs select-none`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-800 text-[11px]">Admin Note</span>
              <button onClick={close} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="relative">
              <select
                defaultValue=""
                onChange={handleQuickPick}
                className="w-full text-[10.5px] font-semibold text-slate-600 border border-slate-300 rounded px-1.5 py-1 pr-5 focus:outline-none focus:border-school-navy cursor-pointer appearance-none bg-white"
              >
                <option value="" disabled>Quick select a note...</option>
                {QUICK_NOTES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Age not valid for Govt Entry, TC received but not released..."
              rows={3}
              className="w-full text-[11px] border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:border-school-navy resize-none"
            />

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoRemind}
                onChange={(e) => setAlsoRemind(e.target.checked)}
                className="accent-amber-600 w-3 h-3 cursor-pointer"
              />
              <BellRing className="w-3 h-3 text-amber-600 flex-shrink-0" />
              <span className="text-[10.5px] font-semibold text-slate-600">Also set as a reminder</span>
            </label>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1 py-1 bg-school-navy hover:bg-school-navy-dark text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              <span>Save</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
