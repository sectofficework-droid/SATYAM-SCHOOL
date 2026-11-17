"use client";

// Recurring reminder/call-back system (REQ-FEAT-025) - mounted once at the
// dashboard layout level so it works from any page. Auto-shows the popup on
// every route change when active reminders exist. "Dismiss" just hides the
// popup for now (no DB write - it will reappear on the next navigation,
// which is the intended nag). "Resolve" permanently silences one reminder.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getActiveReminders, resolveReminder } from "@/lib/studentService";
import useStore from "@/lib/store";

const ReminderContext = createContext(null);

export function ReminderProvider({ children }) {
  const authUser = useStore(s => s.authUser);
  const pathname = usePathname();
  const [reminders, setReminders] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await getActiveReminders();
      setReminders(rows);
      return rows;
    } catch (err) {
      console.error("Failed to fetch active reminders:", err);
      return [];
    }
  }, []);

  // Re-check on every route change and auto-pop if anything is active.
  useEffect(() => {
    refresh().then(rows => {
      if (rows.length > 0) setPopupOpen(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const openPopup = useCallback(() => {
    refresh();
    setPopupOpen(true);
  }, [refresh]);

  const dismiss = useCallback(() => setPopupOpen(false), []);

  const resolve = useCallback(async (studentId) => {
    await resolveReminder(studentId, authUser?.id);
    setReminders(prev => prev.filter(r => r.studentId !== studentId));
  }, [authUser]);

  return (
    <ReminderContext.Provider value={{ reminders, popupOpen, openPopup, dismiss, resolve, refresh }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminders must be used within a ReminderProvider");
  return ctx;
}
