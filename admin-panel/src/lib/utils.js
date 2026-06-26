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
