"use client";

import { useEffect, useState } from "react";
import { getPhases } from "@/lib/studentPhaseService";

// REQ-FEAT-019 follow-up (2026-10-19) - "while doing new entry, new import,
// new replacement, i should be able to select batch". Shown at every save/
// import point so the admin can pick an existing batch to add into,
// matching the real workflow of a single physical batch of documents
// sometimes being processed across more than one save session.
//
// REQ-FEAT-021 correction (2026-10-22) - two things changed from the
// original: (1) this is now a THREE-way choice defaulting to "— No Batch —"
// (value "none"), not "+ Start New Batch" - every single Add/Edit/Update
// save was silently minting a new 1-student batch because "start new" was
// the default and nothing stopped it being recorded automatically. Nothing
// is recorded unless the admin explicitly picks either "+ Start New Batch"
// or an existing one. (2) per the user's own follow-up ("the selection was
// mainly for import / replacement or new entry so batch selection should
// be show there"), this component is now only rendered on the
// import/replacement/new-entry tools (Add Student, Import Students,
// Replace Full Details, Basic Details Import) - the single-student Edit
// Student / Super-Admin Update Student tools dropped it entirely and no
// longer record phases at all, since a routine edit to an existing record
// was never part of the "physical document batch" workflow this models.
//
// value contract: "none" (default, don't record) | "" (start a new batch)
// | an existing student_import_phases.id.
export default function BatchSelector({ phaseType, value, onChange, className = "" }) {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    getPhases()
      .then(all => setBatches(all.filter(p => p.phase_type === phaseType)))
      .catch(() => {});
  }, [phaseType]);

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Add to Batch</label>
      <select value={value ?? "none"} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
        <option value="none">— No Batch —</option>
        <option value="">+ Start New Batch</option>
        {batches.map(b => (
          <option key={b.id} value={b.id}>
            {b.label ? `${b.label} — ` : ""}Batch {b.phase_number} - {b.student_count} student{b.student_count !== 1 ? "s" : ""} - {new Date(b.created_at).toLocaleDateString()}
          </option>
        ))}
      </select>
    </div>
  );
}
