// Shared UDISE/PEN government-portal eligibility rules — single source of
// truth for "is this student ready to be entered into the UDISE/PEN
// government portals" and "what's blocking it". Extracted 2026-11-26: this
// logic used to live only inside government-entry/page.js's `decorate()`/
// `eligibilityFns`, and the Documents page's "Incomplete" tag
// (StudentDocumentsSection.jsx, added 2026-11-23) re-implemented a
// simplified, DIFFERENT version by hand instead of calling it — the two
// pages disagreed on which students were "done" (e.g. a student whose
// UDISE is legitimately "Active in other school", or whose PEN is
// correctly "Not Defined", still showed as "Incomplete" on Documents even
// though Government Entry already treats them as resolved; "GR No not
// set" was flagged as an incompleteness reason on Documents even though
// GR number is not part of UDISE/PEN eligibility at all). Both pages now
// call these same functions so the rule can't drift between them again.
//
// Note: the two pages fetch students via different queries (studentService
// .js's getStudents()/mapToStudent() vs reportService.js's
// getStudentsForReport()) with different field names for the same
// underlying columns (e.g. `deactivateReason` vs `remarks`, both really
// student_enrollments.deactivate_reason) - that data-fetching duplication
// is a separate, bigger concern not addressed here. These functions take
// plain primitives/booleans instead of a whole student object specifically
// so each page can keep adapting its own shape without this rule needing
// to know about either one.
//
// 2026-11-26 follow-up (user request): eligibility simplified to a pure
// document check - batch membership and the Aadhar/reg-no *text* fields are
// no longer part of whether a student counts as "eligible", because
// Government Entry now walks the admin through fixing those from inside the
// entry flow itself (fill-in-the-blanks prompts + a batch-assignment/edit
// step) instead of just showing a disabled button. UDISE needs a Birth
// Certificate or Transfer/Leaving Certificate document uploaded; PEN needs
// that same certificate AND a Student Aadhar Card document uploaded.
// `inAnyBatch`/`certAvailable`(text)/`aadharAvailable` still exist as
// exported helpers because the entry-flow gate (built in government-entry/
// page.js) still needs them to decide what to prompt for - they're just no
// longer inputs to the eligibility decision itself.

export const OTHER_SCHOOL_TAG_REGEX = /<!--OTHER_SCHOOL:({[\s\S]*?})-->/;

// A free-text remarks/deactivate_reason field can carry a hidden JSON tag
// recording that a student is enrolled in another school for UDISE/PEN
// purposes (set via government-entry's own "Mark Active in Other School"
// flow). Returns null if no tag is present or it doesn't parse.
export function parseOtherSchoolRemarks(remarksStr) {
  if (!remarksStr || typeof remarksStr !== "string") return null;
  const match = remarksStr.match(OTHER_SCHOOL_TAG_REGEX);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// "Done" | "Active in other school" | "Pending"
export function getUdiseStatus(udiseValue, remarksValue) {
  const otherSchoolData = parseOtherSchoolRemarks(remarksValue);
  const isOtherSchool = Boolean(
    (udiseValue && String(udiseValue).trim().toLowerCase().includes("active in other school")) ||
    (otherSchoolData && (otherSchoolData.portal === "udise" || otherSchoolData.portal === "both" || otherSchoolData.udiseActive))
  );
  if (isOtherSchool) return "Active in other school";
  if (udiseValue && String(udiseValue).trim() && String(udiseValue).trim() !== "-") return "Done";
  return "Pending";
}

// "Done" | "Active in other school" | "Not Defined" | "Pending"
export function getPenStatus(penValue, remarksValue) {
  const otherSchoolData = parseOtherSchoolRemarks(remarksValue);
  const isOtherSchool = Boolean(
    (penValue && String(penValue).trim().toLowerCase().includes("active in other school")) ||
    (otherSchoolData && (otherSchoolData.portal === "pen" || otherSchoolData.portal === "both" || otherSchoolData.penActive || (!otherSchoolData.portal && (!penValue || penValue === "-"))))
  );
  if (isOtherSchool) return "Active in other school";
  if (penValue && String(penValue).trim() && String(penValue).trim() !== "Not Defined") return "Done";
  if (penValue && String(penValue).trim() === "Not Defined") return "Not Defined";
  return "Pending";
}

// Birth Certificate (reg no or uploaded) OR Transfer/Leaving Certificate
// counts as the one "proof of prior schooling" document either portal
// needs. Callers compute hasBirthCertDoc/hasTcDoc themselves (the two
// pages match documents differently: government-entry checks
// document_types.name === "Birth Certificate" exactly on `student_
// documents`, Documents page substring-matches `documents[].name` via its
// own matchDocByCategory) - only the final boolean combination is shared.
export function hasRequiredCertificate({ birthCertRegNo, hasBirthCertDoc, hasTcDoc, lastSchoolName, lastSchoolGrNo }) {
  return Boolean(
    String(birthCertRegNo || "").trim() ||
    hasBirthCertDoc ||
    hasTcDoc ||
    String(lastSchoolName || "").trim() ||
    String(lastSchoolGrNo || "").trim()
  );
}

export function isAadharAvailable(aadharValue) {
  return Boolean(String(aadharValue || "").trim());
}

// { eligible, reason }. Document-only: a Birth Certificate or Transfer/
// Leaving Certificate upload is the one thing that makes a student
// eligible for UDISE entry - batch assignment and the reg-no text field
// are handled by the entry-flow gate once the admin starts the entry, not
// by this check.
export function getUdiseEligibility({ udiseStatus, hasBirthCertDoc, hasTcDoc }) {
  if (udiseStatus === "Done" || udiseStatus === "Active in other school") return { eligible: true, reason: "" };
  if (!hasBirthCertDoc && !hasTcDoc) {
    return { eligible: false, reason: "Missing Birth Certificate or Transfer Certificate upload" };
  }
  return { eligible: true, reason: "" };
}

// { eligible, reason }. Document-only: same certificate requirement as
// UDISE, plus a Student Aadhar Card upload. Batch assignment and the
// Aadhar name/number text fields are handled by the entry-flow gate once
// the admin starts the entry, not by this check.
export function getPenEligibility({ penStatus, hasBirthCertDoc, hasTcDoc, hasAadharDoc }) {
  if (penStatus === "Done" || penStatus === "Not Defined" || penStatus === "Active in other school") return { eligible: true, reason: "" };
  const missing = [];
  if (!hasBirthCertDoc && !hasTcDoc) missing.push("Birth Certificate or Transfer Certificate upload");
  if (!hasAadharDoc) missing.push("Student Aadhar Card upload");
  if (missing.length > 0) return { eligible: false, reason: `Missing ${missing.join(", ")}` };
  return { eligible: true, reason: "" };
}
