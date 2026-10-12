"use client";

import { useEffect, useState } from "react";
import { Power, ToggleLeft } from "lucide-react";
import useStore from "@/lib/store";
import { listFeatureFlags, setFeatureFlag } from "@/lib/featureFlagsService";

// Add an entry here for each tool that's hidden-by-default behind a flag -
// the row renders itself from this list, so switching a tool back on later
// needs no new UI, just this one line plus the matching `key` row already
// seeded in feature_flags (see SUPABASE_FEATURE_FLAGS.sql).
const KNOWN_FLAGS = [
  {
    key:   "import_basic_details",
    label: "Import Basic Details",
    description: "Bulk-create students from a basic-info spreadsheet - the \"Import Basic Details\" button on the Student page. Was only needed for the initial data load; hidden by default since a mistaken bulk import is hard to undo.",
  },
];

function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FeatureTogglesTab() {
  const authUser = useStore(s => s.authUser);
  const [rows, setRows] = useState({});     // key -> { enabled, updated_by, updated_at }
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);

  function load() {
    setLoading(true);
    listFeatureFlags()
      .then(data => setRows(Object.fromEntries(data.map(r => [r.key, r]))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleToggle(key) {
    const current = !!rows[key]?.enabled;
    setBusyKey(key);
    try {
      await setFeatureFlag(key, !current, authUser?.name || "Admin");
      load();
    } catch (e) {
      alert("Failed to change setting: " + (e?.message || "Unknown error"));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-school-navy/10 flex items-center justify-center flex-shrink-0">
          <ToggleLeft className="w-4.5 h-4.5 text-school-navy" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Feature Toggles</h3>
          <p className="text-xs text-gray-500">
            Tools that are hidden by default because they were only needed once, or carry some risk if used carelessly. Turn one on here only when you actually need it.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {KNOWN_FLAGS.map(f => {
          const row     = rows[f.key];
          const enabled = !!row?.enabled;
          const busy    = busyKey === f.key;
          return (
            <div key={f.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{f.description}</p>
                {row?.updated_at && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Last changed {fmtDateTime(row.updated_at)}{row.updated_by ? ` by ${row.updated_by}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggle(f.key)}
                disabled={busy}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors flex-shrink-0 ${
                  enabled ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Power className="w-3.5 h-3.5" /> {enabled ? "ON" : "OFF"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
