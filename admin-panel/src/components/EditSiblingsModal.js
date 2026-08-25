"use client";

import { useState, useEffect } from "react";
import { X, Plus, Users } from "lucide-react";
import {
  getStudentByEnrollment, updateStudentSiblings, searchStudentsForSibling,
} from "@/lib/studentService";
import { getActiveClasses } from "@/lib/settingsService";

// Standalone "just the sibling link" editor - separate from the full Edit
// Student page on purpose, since that form has many other `required` fields
// a basic-import "Incomplete" student doesn't have filled in yet, which
// blocks the whole form from submitting even to just add a sibling.

function YesNoToggle({ value, onChange }) {
  return (
    <div className="flex gap-2 max-w-xs">
      {["Yes", "No"].map((opt) => (
        <button
          key={opt} type="button" onClick={() => onChange(opt === "Yes")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            (opt === "Yes" && value) || (opt === "No" && !value)
              ? "bg-school-navy text-white border-school-navy shadow-sm"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function EditSiblingsModal({ student, onClose, onSaved }) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [standards, setStandards] = useState([]);
  const [hasSibling, setHasSibling] = useState(false);
  const [siblings, setSiblings]     = useState([{ id: 1, cls: "", name: "", studentId: "" }]);
  const [optionsByRow, setOptionsByRow] = useState({});

  useEffect(() => {
    getActiveClasses().then(cls => setStandards(cls.map(c => c.name))).catch(() => {});
    getStudentByEnrollment(student.enrollment)
      .then(full => {
        const existing = (full.siblings || []).filter(s => s.name);
        setHasSibling(existing.length > 0);
        setSiblings(existing.length > 0
          ? existing.map((s, i) => ({ id: i + 1, cls: s.cls || "", name: s.name || "", studentId: s.studentId || "" }))
          : [{ id: 1, cls: "", name: "", studentId: "" }]);
      })
      .catch(err => setError(err.message || "Could not load current sibling info."))
      .finally(() => setLoading(false));
  }, [student.enrollment]);

  async function loadOptionsFor(rowId, cls) {
    const opts = await searchStudentsForSibling(cls, student._studentId).catch(() => []);
    setOptionsByRow(p => ({ ...p, [rowId]: opts }));
  }

  const addSibling    = () => setSiblings(p => [...p, { id: Date.now(), cls: "", name: "", studentId: "" }]);
  const removeSibling = (id) => setSiblings(p => p.filter(s => s.id !== id));
  const updateCls = (id, cls) => {
    setSiblings(p => p.map(s => s.id === id ? { ...s, cls, name: "", studentId: "" } : s));
    if (cls) loadOptionsFor(id, cls);
  };
  const selectStudent = (id, studentId) => {
    const picked = (optionsByRow[id] || []).find(o => o.studentId === studentId);
    setSiblings(p => p.map(s => s.id === id ? { ...s, studentId, name: picked?.name || "" } : s));
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateStudentSiblings(student._studentId, hasSibling ? siblings.filter(s => s.name) : []);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 sm:my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-school-navy" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800">Update Sibling</h3>
              <p className="text-xs text-gray-500">{student.name} · #{student.enrollment}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Does this student have a sibling already studying here?
                </label>
                <YesNoToggle
                  value={hasSibling}
                  onChange={(val) => { setHasSibling(val); if (val && siblings.length === 0) setSiblings([{ id: 1, cls: "", name: "", studentId: "" }]); }}
                />
              </div>

              {hasSibling && (
                <div className="space-y-3">
                  {siblings.map((sib, i) => (
                    <div key={sib.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sibling {i + 1}</p>
                        {siblings.length > 1 && (
                          <button type="button" onClick={() => removeSibling(sib.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sibling&apos;s Class</label>
                          <select
                            value={sib.cls}
                            onChange={(e) => updateCls(sib.id, e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white"
                          >
                            <option value="">Select Class</option>
                            {standards.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Sibling&apos;s Name</label>
                          <select
                            value={sib.studentId}
                            onChange={(e) => selectStudent(sib.id, e.target.value)}
                            disabled={!sib.cls}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-school-navy/20 bg-white disabled:bg-gray-100"
                          >
                            <option value="">
                              {!sib.cls ? "Select class first" : ((optionsByRow[sib.id]?.length ?? 0) > 0 ? "Select Student" : "No students found in this class")}
                            </option>
                            {(optionsByRow[sib.id] || []).map(o => (
                              <option key={o.studentId} value={o.studentId}>{o.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addSibling}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-school-navy/40 rounded-xl text-sm font-semibold text-school-navy hover:bg-blue-50 hover:border-school-navy transition-colors">
                    <Plus className="w-4 h-4" /> Add Another Sibling
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (hasSibling && siblings.every(s => !s.name))}
                  className="flex-1 px-5 py-2.5 bg-school-navy text-white rounded-xl text-sm font-bold hover:bg-school-navy/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
