"use client";

// Global nagging popup for the Reminder/Call-back system (REQ-FEAT-025).
// Shows automatically on route change when active reminders exist (see
// ReminderProvider). Dismiss = close now, no DB write, reappears on the
// next navigation. Resolve = permanent, removes it from the list for good.

import { Bell, Phone, X, CheckCircle2 } from "lucide-react";
import { useReminders } from "@/contexts/ReminderContext";

export default function ReminderPopup() {
  const { reminders, popupOpen, dismiss, resolve } = useReminders();

  if (!popupOpen || reminders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-amber-50">
          <div className="flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-amber-600" />
            <h2 className="text-sm font-bold text-gray-800">
              {reminders.length} Reminder{reminders.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Dismiss for now">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {reminders.map(r => {
            const mobile = (r.mobile || "").replace(/[^\d+]/g, "");
            return (
              <div key={r.studentId} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {r.name} {r.grNo && <span className="text-xs text-gray-400 font-normal">· GR {r.grNo}</span>}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{r.message}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {mobile && (
                    <a
                      href={`tel:${mobile}`}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      title={`Call ${r.mobile}`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => resolve(r.studentId)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-school-navy text-white text-[11px] font-semibold hover:bg-school-navy/90 transition-colors"
                    title="Resolve permanently - never nag about this again"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolve</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <button
            onClick={dismiss}
            className="w-full py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Dismiss for now
          </button>
        </div>
      </div>
    </div>
  );
}
