"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Layers, Plus, Pencil, Trash2, ChevronDown, ChevronUp, RefreshCw,
  ArrowRightLeft, Check, X, Users,
} from "lucide-react";
import useStore from "@/lib/store";
import useConfirm from "@/components/ConfirmDialog";
import {
  getPhases, getPhaseEntries, createEmptyBatch, renameBatch, deleteBatch,
  deletePhaseEntry, moveEntryToBatch, recomputeBatchCount,
} from "@/lib/studentPhaseService";

const SOURCE_LABELS = {
  add_student_form:      "Add Student (single)",
  import_students:        "Super Admin - Import Students",
  replace_full_details:   "Super Admin - Replace Full Details",
  basic_details_import:   "Import Basic Details",
  manual:                  "Created manually",
};

// REQ-FEAT-021 (2026-10-22) - Batch management, Settings. Follow-up to
// making batch selection in BatchSelector.js manual-only (default "No
// Batch") - this is where the admin creates an empty batch ahead of time,
// renames one, deletes one outright, or moves/removes individual student
// entries after the fact. Lives in Settings (senior_admin/management only,
// same gate as every other tab here) rather than the read-only "Entry
// Batches" report tile under /report, which stays download-only.
export default function EntryBatchesTab() {
  const authUser = useStore(s => s.authUser);
  const { confirm, ConfirmDialog } = useConfirm();

  const [phases,   setPhases]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState(null); // phase id currently open
  const [entries,  setEntries]  = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const [creating,  setCreating]  = useState(false);
  const [newType,   setNewType]   = useState("Added");
  const [newLabel,  setNewLabel]  = useState("");
  const [saving,    setSaving]    = useState(false);

  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState("");

  const [movingEntry, setMovingEntry] = useState(null); // entry row being moved
  const [moveTarget,  setMoveTarget]  = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getPhases().then(setPhases).catch(e => setError(e.message || "Failed to load batches.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(phase) {
    if (expanded === phase.id) { setExpanded(null); return; }
    setExpanded(phase.id);
    setEntriesLoading(true);
    try {
      setEntries(await getPhaseEntries(phase.id));
    } catch (e) {
      setError(e.message || "Failed to load batch entries.");
    } finally {
      setEntriesLoading(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setError("");
    try {
      await createEmptyBatch({ type: newType, label: newLabel.trim(), createdBy: authUser?.id });
      setCreating(false);
      setNewLabel("");
      setNewType("Added");
      load();
    } catch (e) {
      setError(e.message || "Failed to create batch.");
    } finally {
      setSaving(false);
    }
  }

  function startRename(phase) {
    setRenamingId(phase.id);
    setRenameText(phase.label || "");
  }

  async function saveRename(phase) {
    try {
      await renameBatch(phase.id, renameText.trim());
      setRenamingId(null);
      load();
    } catch (e) {
      setError(e.message || "Failed to rename batch.");
    }
  }

  async function handleDeleteBatch(phase) {
    const ok = await confirm(
      `Delete Batch ${phase.phase_number}${phase.label ? ` ("${phase.label}")` : ""}? This permanently removes all ${phase.student_count} student entr${phase.student_count === 1 ? "y" : "ies"} recorded in it, including their locked UDISE/PEN snapshot data. It does NOT touch the live student records themselves, and cannot be undone.`,
      { title: "Delete Batch", confirmLabel: "Delete Batch" }
    );
    if (!ok) return;
    try {
      await deleteBatch(phase.id);
      if (expanded === phase.id) setExpanded(null);
      load();
    } catch (e) {
      setError(e.message || "Failed to delete batch.");
    }
  }

  async function handleRemoveEntry(entry, phase) {
    const ok = await confirm(
      `Remove ${entry.snapshot?.firstName || "this student"} ${entry.snapshot?.lastName || ""} from Batch ${phase.phase_number}? This deletes their locked snapshot from this batch only - their live student record is untouched. Cannot be undone.`,
      { title: "Remove from Batch", confirmLabel: "Remove" }
    );
    if (!ok) return;
    try {
      await deletePhaseEntry(entry.id, phase.id);
      setEntries(await getPhaseEntries(phase.id));
      load();
    } catch (e) {
      setError(e.message || "Failed to remove entry.");
    }
  }

  async function handleMoveEntry(entry, fromPhase) {
    if (!moveTarget) return;
    try {
      await moveEntryToBatch({ entryId: entry.id, fromPhaseId: fromPhase.id, toPhaseId: moveTarget });
      setMovingEntry(null);
      setMoveTarget("");
      setEntries(await getPhaseEntries(fromPhase.id));
      load();
    } catch (e) {
      setError(e.message || "Failed to move entry.");
    }
  }

  async function handleRecompute(phase) {
    try {
      await recomputeBatchCount(phase.id);
      load();
    } catch (e) {
      setError(e.message || "Failed to recompute count.");
    }
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading batches…</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500 max-w-2xl">
          Batches group students submitted together to UDISE/PEN (see the
          <span className="font-semibold"> Entry Batches</span> report under Reports for downloads).
          Nothing creates a batch automatically anymore - <span className="font-semibold">Add Student,
          Import Students, Replace Full Details and Basic Details Import</span> only add a student into
          a batch when one is explicitly picked. Use this page to create a batch ahead of time, rename
          it, or clean up/move entries afterward.
        </p>
        <button onClick={() => setCreating(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy/90 transition-colors flex-shrink-0">
          <Plus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {creating && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="Added">Added</option>
              <option value="Replaced">Replaced</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Label (optional)</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder='e.g. "Oct FD Batch 3"'
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-school-navy text-white text-sm font-semibold disabled:opacity-60">
            <Check className="w-4 h-4" /> {saving ? "Creating…" : "Create"}
          </button>
          <button onClick={() => { setCreating(false); setNewLabel(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {phases.length === 0 && !error && (
        <p className="text-sm text-gray-400">No batches yet. Create one above, or it'll be created automatically the next time you pick "+ Start New Batch" while adding/importing/replacing students.</p>
      )}

      {phases.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            <Layers className="w-4 h-4 text-school-navy" /> {phases.length} batch{phases.length !== 1 ? "es" : ""}
          </div>
          <div className="divide-y divide-gray-100">
            {phases.map(p => {
              const otherBatchesSameType = phases.filter(x => x.id !== p.id && x.phase_type === p.phase_type);
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => toggleExpand(p)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {expanded === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {renamingId === p.id ? (
                        <div className="flex items-center gap-2">
                          <input value={renameText} onChange={e => setRenameText(e.target.value)} autoFocus
                            placeholder="Batch label"
                            className="px-2 py-1 border border-gray-200 rounded-lg text-sm flex-1 max-w-xs" />
                          <button onClick={() => saveRename(p)} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">Batch {p.phase_number}</span>
                          {p.label && <span className="text-sm text-gray-500">— {p.label}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.phase_type === "Added" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{p.phase_type}</span>
                          <button onClick={() => startRename(p)} className="text-gray-400 hover:text-school-navy"><Pencil className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {SOURCE_LABELS[p.source] || p.source} · {p.student_count} student{p.student_count !== 1 ? "s" : ""} · {new Date(p.created_at).toLocaleString()} · {p.created_by?.name || "—"}
                      </p>
                    </div>

                    <button onClick={() => handleRecompute(p)} title="Recompute student count from actual entries"
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-school-navy px-2 py-1.5 rounded-lg hover:bg-gray-50 flex-shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" /> Recompute
                    </button>
                    <button onClick={() => handleDeleteBatch(p)} title="Delete batch"
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>

                  {expanded === p.id && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                      {entriesLoading && <p className="text-xs text-gray-400">Loading entries…</p>}
                      {!entriesLoading && entries.length === 0 && (
                        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> No students in this batch yet.</p>
                      )}
                      {!entriesLoading && entries.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-gray-500 text-xs uppercase">
                              <tr>
                                <th className="text-left py-1.5 pr-3">Student</th>
                                <th className="text-left py-1.5 pr-3">Enrollment No</th>
                                <th className="text-left py-1.5 pr-3">Class</th>
                                <th className="text-right py-1.5">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map(e => (
                                <tr key={e.id} className="border-t border-gray-200">
                                  <td className="py-1.5 pr-3 text-gray-800">{`${e.snapshot?.firstName || ""} ${e.snapshot?.lastName || ""}`.trim() || "—"}</td>
                                  <td className="py-1.5 pr-3 text-gray-600">{e.enrollment_no || "—"}</td>
                                  <td className="py-1.5 pr-3 text-gray-600">{e.snapshot?.cls || "—"}</td>
                                  <td className="py-1.5 text-right">
                                    {movingEntry === e.id ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <select value={moveTarget} onChange={ev => setMoveTarget(ev.target.value)}
                                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white">
                                          <option value="">Move to…</option>
                                          {otherBatchesSameType.map(b => (
                                            <option key={b.id} value={b.id}>{b.label ? `${b.label} — ` : ""}Batch {b.phase_number}</option>
                                          ))}
                                        </select>
                                        <button onClick={() => handleMoveEntry(e, p)} disabled={!moveTarget} className="text-green-600 hover:text-green-700 disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => { setMovingEntry(null); setMoveTarget(""); }} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-3">
                                        <button onClick={() => { setMovingEntry(e.id); setMoveTarget(""); }} disabled={otherBatchesSameType.length === 0}
                                          title={otherBatchesSameType.length === 0 ? `No other ${p.phase_type} batch to move into` : "Move to another batch"}
                                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-school-navy disabled:opacity-40 disabled:hover:text-gray-500">
                                          <ArrowRightLeft className="w-3.5 h-3.5" /> Move
                                        </button>
                                        <button onClick={() => handleRemoveEntry(e, p)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                                          <Trash2 className="w-3.5 h-3.5" /> Remove
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  );
}
