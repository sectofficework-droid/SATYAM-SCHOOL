"use client";

// Header entry point into the Reminder/Call-back system (REQ-FEAT-025) -
// separate from the existing Notifications bell (different semantics:
// recurring-nag + resolve, not read/unread). Opens the same global popup.

import { PhoneCall } from "lucide-react";
import { useReminders } from "@/contexts/ReminderContext";

export default function ReminderBell() {
  const { reminders, openPopup } = useReminders();
  if (reminders.length === 0) return null;

  return (
    <button
      onClick={openPopup}
      className="relative p-2.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
      title={`${reminders.length} call-back reminder${reminders.length !== 1 ? "s" : ""}`}
    >
      <PhoneCall className="w-4.5 h-4.5" />
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
        {reminders.length}
      </span>
    </button>
  );
}
