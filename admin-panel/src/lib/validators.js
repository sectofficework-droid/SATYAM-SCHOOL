// ── Shared form-validation helpers used across the admin panel ──
// Every function returns true/false (or a normalized boolean check) so callers
// build their own field-keyed error-message objects in a consistent shape:
//   const errors = {};
//   if (!isValidName(form.firstName)) errors.firstName = "Enter a valid name";
//   setErrors(errors); if (Object.keys(errors).length) return;

export function isNonEmpty(v) {
  return typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null && v !== "";
}

export function isValidEmail(v) {
  if (!isNonEmpty(v)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

// Indian mobile numbers: 10 digits, starting 6-9.
export function isValidPhone(v) {
  if (!isNonEmpty(v)) return false;
  return /^[6-9]\d{9}$/.test(String(v).trim());
}

export function isValidPincode(v) {
  if (!isNonEmpty(v)) return false;
  return /^\d{6}$/.test(String(v).trim());
}

export function isValidAadharFormat(v) {
  if (!isNonEmpty(v)) return false;
  return /^\d{12}$/.test(String(v).replace(/\s/g, ""));
}

// Verhoeff checksum — the algorithm UIDAI uses for the 12th Aadhar digit.
const VERHOEFF_D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const VERHOEFF_P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

export function isValidAadharChecksum(v) {
  const digits = String(v).replace(/\s/g, "");
  if (!/^\d{12}$/.test(digits)) return false;
  let c = 0;
  const arr = digits.split("").reverse().map(Number);
  for (let i = 0; i < arr.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][arr[i]]];
  return c === 0;
}

export function isValidAadhar(v) {
  return isValidAadharFormat(v) && isValidAadharChecksum(v);
}

// Letters, spaces, apostrophes, hyphens, dots — typical name characters.
export function isValidName(v, { min = 2, max = 60 } = {}) {
  if (!isNonEmpty(v)) return false;
  const t = v.trim();
  return t.length >= min && t.length <= max && /^[A-Za-z][A-Za-z\s'.-]*$/.test(t);
}

export function isValidAddressText(v, { min = 3, max = 200 } = {}) {
  if (!isNonEmpty(v)) return false;
  const t = v.trim();
  return t.length >= min && t.length <= max;
}

export function isPositiveAmount(v, max = 10000000) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= max;
}

export function isNonNegativeNumber(v, max = 10000000) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max;
}

export function isValidPercentage(v) {
  if (!isNonEmpty(v)) return false;
  const n = Number(String(v).replace("%", ""));
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function isValidYearFormat(v) {
  return /^\d{4}-\d{2}$/.test(String(v).trim());
}

// date-order helpers — both args are "YYYY-MM-DD" strings.
export function isDateOnOrBefore(a, b) {
  if (!a || !b) return true;
  return new Date(a) <= new Date(b);
}
export function isDateOnOrAfter(a, b) {
  if (!a || !b) return true;
  return new Date(a) >= new Date(b);
}
export function isPastOrTodayDate(v) {
  if (!isNonEmpty(v)) return false;
  return new Date(v) <= new Date(new Date().toDateString());
}

export const MAX_LEN = { short: 60, medium: 120, long: 500 };

export function isValidLength(v, max, min = 0) {
  if (!isNonEmpty(v) && min > 0) return false;
  const len = (v || "").toString().trim().length;
  return len >= min && len <= max;
}

export function isStrongPassword(v, min = 6) {
  return isNonEmpty(v) && String(v).trim().length >= min;
}

export const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
export const MAX_DOC_SIZE_MB = 5;

export function isValidUploadFile(file) {
  if (!file) return true; // optional uploads stay optional — only validate type/size if present
  const sizeOk = file.size <= MAX_DOC_SIZE_MB * 1024 * 1024;
  const typeOk = ALLOWED_DOC_TYPES.includes(file.type);
  return sizeOk && typeOk;
}

export function hasNoErrors(errors) {
  return Object.keys(errors).length === 0;
}
