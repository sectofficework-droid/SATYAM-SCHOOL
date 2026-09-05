// Shared helpers for the Excel-based student import tools (Super Admin's
// "Import Students" / "Replace Full Details", and the Student module's
// "Import Basic Details") - kept in one place so all three tools parse
// dates and fuzzy-match dropdown values identically.

// Excel entries commonly vary in case/spacing ("SR KG", "1ST", "MALE").
// Match loosely against the canonical lists above, then return the canonical form.
export function normalizeAgainstList(raw, list) {
  if (!raw) return raw;
  const key = raw.trim().toUpperCase().replace(/\./g, " ").replace(/\s+/g, " ");
  const match = list.find(c => c.toUpperCase().replace(/\./g, " ").replace(/\s+/g, " ") === key);
  return match || raw;
}

// Converts any common date format to YYYY-MM-DD for the database.
// Handles: JS Date objects, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, Excel serials, YYYY-MM-DD (passthrough).
// Returns null (never a garbage string) when the value can't be parsed, so a bad
// cell shows up as a missing date instead of silently corrupting the database.
export function normalizeDate(val) {
  if (!val) return null;
  // JS Date object (from XLSX cellDates:true). SheetJS constructs these so
  // that LOCAL getters recover the calendar date that was actually in the
  // cell — the object's UTC representation is intentionally offset by the
  // machine's timezone. Since this app is used from browsers in India, local
  // getters give the correct date; UTC getters would be off by a day.
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).replace(/\s+/g, " ").trim();
  if (!s) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY, DD-MM-YYYY or DD.MM.YYYY (India standard, day first) - date
  // columns are kept as plain Text in the import template (see the
  // sheet-formatting comment below) specifically so this is the only thing
  // that ever decides what the date means, instead of Excel's own
  // locale-dependent guess.
  const dmyMatch = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const dd = d.padStart(2, "0"), mm = m.padStart(2, "0");
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
    return `${y}-${mm}-${dd}`;
  }
  // Excel serial number
  const serial = Number(s);
  if (!isNaN(serial) && serial > 1000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    if (!isNaN(date.getTime())) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
    }
  }
  return null;
}
