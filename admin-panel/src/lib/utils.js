import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Converts "YYYY-MM-DD" → "DD-MM-YYYY". Returns "—" for empty/invalid values.
export function fmtDMY(dateStr) {
  if (!dateStr) return "—";
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// A Date's own calendar date as "YYYY-MM-DD", read from its LOCAL
// getFullYear/getMonth/getDate. Deliberately NOT d.toISOString().slice(0,10):
// toISOString() converts to UTC first, and for any positive UTC offset (IST
// is UTC+5:30) that rolls a local midnight back onto the previous UTC
// calendar day - "today" (or any local-date arithmetic built on it) reads as
// yesterday until ~5:30am IST, and date-stepping math silently loses a day.
export function toIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
