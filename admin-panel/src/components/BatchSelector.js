"use client";

import { useEffect, useState } from "react";
import { getPhases } from "@/lib/studentPhaseService";

// REQ-FEAT-019 follow-up (2026-10-19) - "while doing new entry, new import,
// new replacement, i should be able to select batch". Shown at every save/
// import point (single Add/Edit Student, and the three bulk import tools)
// so the admin can either start a new batch (default) or add these
// students into an existing one - matching the real workflow of a single
// physical batch of documents sometimes being processed across more than
// one save session.
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
      <select value={value || ""} onChange={e => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
        <option value="">+ Start New Batch</option>
        {batches.map(b => (
          <option key={b.id} value={b.id}>
            Batch {b.phase_number} - {b.student_count} student{b.student_count !== 1 ? "s" : ""} - {new Date(b.created_at).toLocaleDateString()}
          </option>
        ))}
      </select>
    </div>
  );
}
