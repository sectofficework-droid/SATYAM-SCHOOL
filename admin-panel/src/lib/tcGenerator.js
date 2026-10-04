import * as XLSX from "xlsx";
import { normalizeDate } from "./importUtils.js";
import { fmtDMY } from "./utils.js";
import { TC_LOGO_BASE64, TC_SARASWATI_BASE64 } from "./tcAssets.js";

// REQ-SEC-015 (2026-10-04 audit): generateSchoolLeavingCertificateSingle
// interpolates student fields straight into an HTML string with no
// escaping, rendered via dangerouslySetInnerHTML elsewhere - TC data can
// be bulk-imported from an uploaded spreadsheet or typed by any admin with
// student-write access, so a payload like <img src=x onerror=...> in
// "Remarks"/"Reason for Leaving" would execute JS in whichever admin's
// browser later opens that student's TC. Every other PDF in this codebase
// goes through pdf-lib primitives instead of HTML injection - this file is
// the one exception that needs escaping at the point of interpolation.
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export const TC_FIELDS = [
  { key: "certificateNo",      label: "Certificate No",                                required: true  },
  { key: "registerNo",         label: "Register No. of the Pupil",                     required: false },
  { key: "udiseNo",            label: "U-DISE Number of the Student",                  required: false },
  { key: "name",                label: "Name of the Pupil",                            required: true  },
  { key: "fatherName",         label: "Father's Name",                                 required: true  },
  { key: "motherName",         label: "Mother's Name",                                 required: false },
  { key: "aadhar",              label: "Pupil Aadhar No",                              required: false },
  { key: "religion",            label: "Religion",                                     required: false },
  { key: "caste",                label: "Caste / Category",                            required: false },
  { key: "placeOfBirth",       label: "Place of Birth",                                required: false },
  { key: "dob",                  label: "Date of Birth (DD-MM-YYYY)",                  required: true,  isDate: true },
  { key: "lastSchoolAttended", label: "Last School Attended",                          required: false },
  { key: "dateOfAdmission",    label: "Date of Admission (DD-MM-YYYY)",                required: false, isDate: true },
  { key: "progress",            label: "Progress",                                     required: false },
  { key: "conduct",              label: "Conduct",                                     required: false },
  { key: "attendancePresent",  label: "Attendance - Present Days",                     required: false },
  { key: "attendanceTotal",    label: "Attendance - Total Days",                       required: false },
  { key: "attendanceClass",    label: "Attendance - In Class",                         required: false },
  { key: "attendanceFrom",      label: "Attendance - From",                            required: false },
  { key: "dateOfLeaving",      label: "Date of Leaving (DD-MM-YYYY)",                  required: true,  isDate: true },
  { key: "passedExamText",      label: "Passed Examination (e.g. YES, STD 1ST PASSED)", required: false },
  { key: "promotedText",        label: "Promoted To (e.g. YES, PROMOTED TO STD 2ND)",  required: false },
  { key: "studyingClassSince", label: "Class Studying & Since When",                   required: false },
  { key: "reasonForLeaving",    label: "Reason for Leaving",                           required: true  },
  { key: "pen",                  label: "Student's PEN",                              required: false },
  { key: "remarks",              label: "Remarks",                                    required: false },
];

export const TC_SAMPLE_ROW = {
  certificateNo: "SSIS/6724/140",
  registerNo: "140",
  udiseNo: "242241000672520057",
  name: "LAKSHITA RAULA",
  fatherName: "SURYA RAULA",
  motherName: "ANITA RAULA",
  aadhar: "273693183592",
  religion: "HINDU",
  caste: "GENERAL",
  placeOfBirth: "BERHAMPUR,GANJAM,ODISHA",
  dob: "2018-10-28",
  lastSchoolAttended: "SATYAM STARS INTERNATIONAL SCHOOL",
  dateOfAdmission: "2025-06-06",
  progress: "VERY GOOD",
  conduct: "VERY GOOD",
  attendancePresent: "210",
  attendanceTotal: "235",
  attendanceClass: "1ST",
  attendanceFrom: "JUNE 2025",
  dateOfLeaving: "2026-09-17",
  passedExamText: "YES, STD 1ST PASSED",
  promotedText: "YES, PROMOTED TO STD 2ND",
  studyingClassSince: "STD 1ST FROM 6 JUN 2025",
  reasonForLeaving: "TO STUDY ELSEWHERE",
  pen: "23169819416",
  remarks: "PROMOTED TO STD 2ND",
};

const NUM_WORDS_ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const NUM_WORDS_TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

export function numberToWords(n) {
  if (n === 0) return "ZERO";
  if (n < 20) return NUM_WORDS_ONES[n];
  if (n < 100) return NUM_WORDS_TENS[Math.floor(n / 10)] + (n % 10 ? "-" + NUM_WORDS_ONES[n % 10] : "");
  if (n < 1000) return NUM_WORDS_ONES[Math.floor(n / 100)] + " HUNDRED" + (n % 100 ? " " + numberToWords(n % 100) : "");
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return numberToWords(thousands) + " THOUSAND" + (rest ? " " + numberToWords(rest) : "");
}

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

export function dobParts(dobVal) {
  if (!dobVal) return { words: "", dmy: "" };
  let y, mo, d;
  const isoMatch = String(dobVal).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dmyMatch = String(dobVal).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (isoMatch) {
    [, y, mo, d] = isoMatch;
  } else if (dmyMatch) {
    [, d, mo, y] = dmyMatch;
  } else {
    return { words: "", dmy: String(dobVal) };
  }
  const dayNum = parseInt(d, 10);
  const monthNum = parseInt(mo, 10);
  const yearNum = parseInt(y, 10);
  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
    return { words: "", dmy: String(dobVal) };
  }
  const dd = String(dayNum).padStart(2, "0");
  const mm = String(monthNum).padStart(2, "0");
  const words = `${numberToWords(dayNum)} ${MONTH_NAMES[monthNum - 1]} ${numberToWords(yearNum)}`;
  return { words, dmy: `${dd}/${mm}/${yearNum}` };
}

export function fmtTcDate(d) {
  if (!d) return "";
  const isoMatch = String(d).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dmyMatch = String(d).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (isoMatch) return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`;
  if (dmyMatch) return `${dmyMatch[1].padStart(2, "0")}/${dmyMatch[2].padStart(2, "0")}/${dmyMatch[3]}`;
  return String(d);
}

const CLASS_PROMOTION_MAP = {
  "JR.KG": "SR.KG",
  "SR.KG": "Balvatika",
  "Balvatika": "1ST",
  "1st": "2ND",
  "2nd": "3RD",
  "3rd": "4TH",
  "4th": "5TH",
  "5th": "6TH",
  "6th": "7TH",
  "7th": "8TH",
  "8th": "9TH",
  "9th": "10TH",
  "10th": "11TH - COMMERCE",
  "11th - Commerce": "12TH - COMMERCE",
  "12th - Commerce": "PASSED OUT",
};

export function studentToTcRow(student, overrides = {}) {
  const std = (student.std || "").trim();
  const stdUpper = std ? std.toUpperCase() : "1ST";
  const nextClass = CLASS_PROMOTION_MAP[std] || (stdUpper ? `STD ${stdUpper}` : "2ND");

  const todayIso = new Date().toISOString().split("T")[0];
  const dateOfLeaving = overrides.dateOfLeaving || todayIso;

  const admDate = student.dateOfJoin || student.admissionDate || "2025-06-06";
  const admFormatted = fmtTcDate(admDate);
  const admDayMonthYear = admFormatted ? admFormatted.replace(/\//g, " / ") : "6 / 06 / 2025";

  const religion = student.religion || "HINDU";
  const caste = student.caste || "GENERAL";

  return {
    certificateNo: overrides.certificateNo || (student.enrollment ? `SSIS/6724/${student.enrollment}` : "SSIS/6724/140"),
    registerNo: overrides.registerNo || student.enrollment || student.grNo || "140",
    udiseNo: student.udise || "242241000672520057",
    name: (student.name || "").toUpperCase(),
    fatherName: (student.fatherName || "").toUpperCase(),
    motherName: (student.motherName || "").toUpperCase(),
    aadhar: student.aadhar ? student.aadhar.replace(/\s+/g, "") : "",
    religion: religion.toUpperCase(),
    caste: caste.toUpperCase(),
    placeOfBirth: (student.placeOfBirth || [student.birthCity, student.birthDistrict, student.birthState].filter(Boolean).join(",") || "BERHAMPUR,GANJAM,ODISHA").toUpperCase(),
    dob: student.dob || "",
    lastSchoolAttended: overrides.lastSchoolAttended || "SATYAM STARS INTERNATIONAL SCHOOL",
    dateOfAdmission: admDayMonthYear,
    progress: overrides.progress || "VERY GOOD",
    conduct: overrides.conduct || "VERY GOOD",
    // REQ-BUG-037: no fabricated fallback — a blank field on the printed TC
    // is honest and visible; a hardcoded "210"/"235" printed as if real
    // isn't. The admin supplies the real figures via tcOptions.
    attendancePresent: overrides.attendancePresent || "",
    attendanceTotal: overrides.attendanceTotal || "",
    attendanceClass: stdUpper,
    attendanceFrom: overrides.attendanceFrom || (student.session || "JUNE 2025"),
    dateOfLeaving: dateOfLeaving,
    passedExamText: overrides.passedExamText || (stdUpper ? `YES, STD ${stdUpper} PASSED` : "YES, STD 1ST PASSED"),
    promotedText: overrides.promotedText || `YES, PROMOTED TO STD ${nextClass.toUpperCase()}`,
    studyingClassSince: overrides.studyingClassSince || (stdUpper ? `STD ${stdUpper} FROM 6 JUN 2025` : "STD 1ST FROM 6 JUN 2025"),
    reasonForLeaving: (overrides.reasonForLeaving || student.deactivateReason || "TO STUDY ELSEWHERE").toUpperCase(),
    pen: student.pen || "23169819416",
    remarks: overrides.remarks || `PROMOTED TO STD ${nextClass.toUpperCase()}`,
    _errors: [],
  };
}

export function downloadTcTemplate() {
  const headerRow = TC_FIELDS.map(f => f.label);
  const sampleRow = TC_FIELDS.map(f => TC_SAMPLE_ROW[f.key] || "");
  const ws = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TC Data");
  XLSX.writeFile(wb, "TC_Bulk_Import_Template.csv");
}

function stripHint(label) {
  return String(label).replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

export function parseTcFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary", cellDates: true, raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 2) { reject(new Error("File has no data rows. Please use the downloaded template.")); return; }
        const headerRow = rows[0];
        const colMap = {};
        TC_FIELDS.forEach(f => {
          const idx = headerRow.findIndex(h => stripHint(h) === stripHint(f.label));
          if (idx >= 0) colMap[f.key] = idx;
        });
        const dataRows = rows.slice(1).filter(row => row.some(c => c !== "" && c !== undefined && c !== null));
        if (!dataRows.length) { reject(new Error("No data rows found in the file.")); return; }

        const result = dataRows.map((row, i) => {
          const r = { _row: i + 2, _errors: [] };
          TC_FIELDS.forEach(f => {
            const raw = colMap[f.key] !== undefined ? (row[colMap[f.key]] ?? "") : "";
            if (f.isDate) {
              r[f.key] = raw ? (normalizeDate(raw) || "") : "";
              r["_raw_" + f.key] = raw instanceof Date ? raw.toDateString() : String(raw).trim();
            } else {
              r[f.key] = raw instanceof Date ? (normalizeDate(raw) || "") : String(raw).trim();
            }
          });
          TC_FIELDS.filter(f => f.required && !r[f.key]).forEach(f => r._errors.push(`${stripHint(f.label)} is required`));
          TC_FIELDS.filter(f => f.isDate && !r[f.key] && r["_raw_" + f.key]).forEach(f =>
            r._errors.push(`${stripHint(f.label)} "${r["_raw_" + f.key]}" is not a valid date`));
          return r;
        });
        resolve(result);
      } catch {
        reject(new Error("Could not read the file. Please use the downloaded template (.csv or .xlsx)."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsBinaryString(file);
  });
}



export function generateSchoolLeavingCertificateSingle(r) {
  const { words: dobWords, dmy: dobDmy } = dobParts(r.dob);
  const admissionDmy = r.dateOfAdmission ? fmtTcDate(r.dateOfAdmission) : "";
  const leavingDmy = r.dateOfLeaving ? fmtTcDate(r.dateOfLeaving) : "";
  const religionCaste = [r.religion, r.caste].filter(Boolean).map(esc).join(" , ");

  return `
  <div class="tc-page">
    <!-- Top & Body Box -->
    <div class="tc-box-main">
      <!-- Header -->
      <div class="tc-header">
        <img src="${TC_LOGO_BASE64}" class="tc-logo-left" alt="School Logo"/>
        <div class="tc-header-center">
          <div class="tc-trust-name">SATYAM EDUCATION CHARITABLE TRUST (E-8941) MANAGED</div>
          <div class="tc-school-name">SATYAM STARS INTERNATIONAL SCHOOL</div>
          <div class="tc-school-address">Swaminarayan Nagar, Bhidbhajan, Pandesara, Surat-394221.</div>
        </div>
        <img src="${TC_SARASWATI_BASE64}" class="tc-logo-right" alt="Saraswati Maa"/>
      </div>

      <!-- Title: SCHOOL LEAVING CERTIFICATE -->
      <div class="tc-title-wrap">
        <div class="tc-title-text">SCHOOL LEAVING CERTIFICATE</div>
      </div>

      <!-- Body -->
      <div class="tc-body">
        <!-- DISE Code Pill -->
        <div class="tc-dise-wrap">
          <div class="tc-dise-pill">SCHOOL DISE CODE - 24224100067</div>
        </div>

        <!-- Certificate No and Register No -->
        <div class="tc-row" style="margin-bottom: 2px;">
          <span class="tc-lbl" style="font-weight: 700;">Certificate No:</span>
          <span class="tc-line tc-val-center" style="flex: 0 0 180px;">${esc(r.certificateNo) || "&nbsp;"}</span>
          <span style="flex: 1;"></span>
          <span class="tc-lbl" style="font-weight: 700;">Register No. of the pupil :</span>
          <span class="tc-line tc-val-center" style="flex: 1;">${esc(r.registerNo) || "&nbsp;"}</span>
        </div>

        <!-- U-DISE -->
        <div class="tc-row">
          <span class="tc-lbl">U-DISE Number of the Student :</span>
          <span class="tc-line tc-val-left">${esc(r.udiseNo) || "&nbsp;"}</span>
        </div>

        <!-- 1. Name -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>1. Name of the Pupil</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.name) || "&nbsp;"}</span>
        </div>

        <!-- 2. Father -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>2. Father&rsquo;s Name</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.fatherName) || "&nbsp;"}</span>
        </div>

        <!-- 3. Mother -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>3. Mother&rsquo;s Name</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.motherName) || "&nbsp;"}</span>
        </div>

        <!-- 4. Aadhar -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>4. Pupil Aadhar No.</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.aadhar) || "&nbsp;"}</span>
        </div>

        <!-- 5. Religion and Caste -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>5. Religion and Caste</span><span>:</span></span>
          <span class="tc-line tc-val-left">${religionCaste || "&nbsp;"}</span>
        </div>

        <!-- 6. Place of Birth -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>6. Place of Birth</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.placeOfBirth) || "&nbsp;"}</span>
        </div>

        <!-- 7. DOB -->
        <div class="tc-row">
          <span class="tc-lbl">7. Date of Birth ( in Christian Era ) as per Admission Register ( in Figures ) :</span>
          <span class="tc-line tc-val-center" style="flex: 1;">${dobDmy || "&nbsp;"}</span>
        </div>

        <div class="tc-row">
          <span class="tc-col-lbl" style="width: 170px; padding-left: 16px;"><span>( in Words )</span><span>:</span></span>
          <span class="tc-line tc-val-left">${dobWords || "&nbsp;"}</span>
        </div>

        <!-- 8. Last School Attended -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>8. Last School Attended</span><span>:</span></span>
          <span class="tc-line tc-val-left">${esc(r.lastSchoolAttended) || "SATYAM STARS INTERNATIONAL SCHOOL"}</span>
        </div>

        <!-- 9. Date of Admission -->
        <div class="tc-row">
          <span class="tc-col-lbl"><span>9. Date of Admission</span><span>:</span></span>
          <span class="tc-line tc-val-left">${admissionDmy || "&nbsp;"}</span>
        </div>

        <!-- 10 & 11. Progress and Conduct -->
        <div class="tc-row">
          <span class="tc-lbl">10. Progress :</span>
          <span class="tc-line tc-val-center" style="flex: 1; margin-right: 16px;">${esc(r.progress) || "VERY GOOD"}</span>
          <span class="tc-lbl">11. Conduct :</span>
          <span class="tc-line tc-val-center" style="flex: 1;">${esc(r.conduct) || "VERY GOOD"}</span>
        </div>

        <!-- 12. Attendance -->
        <div class="tc-row">
          <span class="tc-lbl">12. Attendance :</span>
          <span class="tc-line tc-val-center" style="flex: 0 0 65px; margin: 0 4px;">${esc(r.attendancePresent) || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">Out of</span>
          <span class="tc-line tc-val-center" style="flex: 0 0 65px; margin: 0 4px;">${esc(r.attendanceTotal) || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">in Class</span>
          <span class="tc-line tc-val-center" style="flex: 0 0 75px; margin: 0 4px;">${esc(r.attendanceClass) || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">From</span>
          <span class="tc-line tc-val-center" style="flex: 1; margin-left: 4px;">${esc(r.attendanceFrom) || "&nbsp;"}</span>
        </div>

        <!-- 13. Date of Leaving -->
        <div class="tc-row">
          <span class="tc-lbl">13. Date of Leaving the School :</span>
          <span class="tc-line tc-val-left">${leavingDmy || "&nbsp;"}</span>
        </div>

        <!-- 14. Exam Passed / Promoted -->
        <div class="tc-row">
          <span class="tc-lbl">14. Whether he/she has Passed the examination</span>
          <span class="tc-line tc-val-left">${esc(r.passedExamText) || "&nbsp;"}</span>
        </div>

        <div class="tc-row">
          <span class="tc-lbl" style="padding-left: 20px;">or Promoted to the next Higher Class</span>
          <span class="tc-line tc-val-left">${esc(r.promotedText) || "&nbsp;"}</span>
        </div>

        <!-- 15. Class Studying Since -->
        <div class="tc-row">
          <span class="tc-lbl">15. Class in which Studying and Since When</span>
          <span class="tc-line tc-val-left">${esc(r.studyingClassSince) || "&nbsp;"}</span>
        </div>

        <!-- 16. Reason -->
        <div class="tc-row">
          <span class="tc-lbl">16. Reason for Leaving The School</span>
          <span class="tc-line tc-val-left">${esc(r.reasonForLeaving) || "TO STUDY ELSEWHERE"}</span>
        </div>

        <!-- 17. PEN -->
        <div class="tc-row">
          <span class="tc-lbl">17. Student&rsquo;s PEN ( Permanent Education Number )</span>
          <span class="tc-line tc-val-left">${esc(r.pen) || "&nbsp;"}</span>
        </div>

        <!-- 18. Remarks -->
        <div class="tc-row">
          <span class="tc-lbl">18. Remarks</span>
          <span class="tc-line tc-val-left">${esc(r.remarks) || "&nbsp;"}</span>
        </div>
      </div>
    </div>

    <!-- Footer Box (Signatures & Rustication Warning) -->
    <div class="tc-box-footer">
      <div class="tc-sig-section">
        <div class="tc-footer-left">
          <div class="tc-sig-row">
            <span class="tc-sig-lbl">Checked by</span>
            <span class="tc-sig-line">&nbsp;</span>
          </div>
          <div class="tc-sig-row">
            <span class="tc-sig-lbl">Class Teacher</span>
            <span class="tc-sig-line">&nbsp;</span>
          </div>
          <div class="tc-sig-row">
            <span class="tc-sig-lbl">Date</span>
            <span class="tc-sig-line" style="text-align: left; padding-left: 16px;">${leavingDmy || "&nbsp;"}</span>
          </div>
        </div>
        <div class="tc-footer-right">
          Signature of Principal
        </div>
      </div>
      <div class="tc-rustication-note">
        (No change in entry in this certificate shall be made except by the authority issuing it any infringement of this requirement is liable to involve the the imposition of a penalty such as that of rustication)
      </div>
    </div>
  </div>`;
}

export const TC_STYLES = `
  @page {
    size: A4 landscape;
    margin: 0;
  }
  .tc-landscape-sheet,
  .tc-landscape-sheet * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  .tc-landscape-sheet {
    width: 297mm;
    height: 210mm;
    max-height: 210mm;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    page-break-after: always;
    page-break-inside: avoid;
    overflow: hidden;
    position: relative;
    background: #fff;
  }
  .tc-landscape-sheet:last-child {
    page-break-after: avoid;
  }
  .tc-half-pane {
    flex: 1;
    height: 210mm;
    max-height: 210mm;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .tc-scaled-card {
    width: 210mm;
    height: 297mm;
    transform: scale(0.685);
    transform-origin: center center;
    flex-shrink: 0;
  }
  .tc-scissor-divider {
    width: 8mm;
    height: 200mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }
  .tc-cut-line {
    width: 0;
    flex: 1;
    border-left: 1.5px dashed #777;
  }
  .tc-cut-icon {
    font-size: 16px;
    line-height: 1;
    color: #444;
    padding: 6px 0;
    transform: rotate(90deg);
    user-select: none;
  }
  .tc-page {
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    margin: 0 auto;
    padding: 8mm 12mm 7mm 12mm;
    background: #fff;
    page-break-inside: avoid;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      width: 297mm !important;
      height: 210mm !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .tc-landscape-sheet {
      width: 297mm !important;
      height: 210mm !important;
      max-height: 210mm !important;
      page-break-after: always !important;
      page-break-inside: avoid !important;
      overflow: hidden !important;
    }
    .tc-landscape-sheet:last-child {
      page-break-after: auto !important;
    }
    .tc-page {
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      margin: 0 !important;
    }
  }
  .tc-box-main {
    border: 2px solid #000;
    padding: 8px 14px 10px 14px;
    display: flex;
    flex-direction: column;
    flex: 1;
    background: #fff;
    box-sizing: border-box;
  }
  .tc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 5px;
    border-bottom: 1.5px solid #000;
  }
  .tc-logo-left {
    width: 68px;
    height: 76px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .tc-logo-right {
    width: 58px;
    height: 76px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .tc-header-center {
    flex: 1;
    text-align: center;
    padding: 0 6px;
    overflow: hidden;
  }
  .tc-trust-name {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: #000;
    white-space: nowrap;
  }
  .tc-school-name {
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 23px;
    font-weight: 900;
    letter-spacing: 0.4px;
    color: #000;
    white-space: nowrap;
    margin: 2px 0 3px;
  }
  .tc-school-address {
    font-size: 12.5px;
    font-weight: 500;
    color: #000;
    white-space: nowrap;
  }
  .tc-title-wrap {
    text-align: center;
    padding: 5px 0 4px;
    border-bottom: 2px solid #000;
  }
  .tc-title-text {
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #000;
  }
  .tc-dise-wrap {
    text-align: center;
    padding: 5px 0 3px;
  }
  .tc-dise-pill {
    display: inline-block;
    border: 1.5px solid #000;
    border-radius: 14px;
    padding: 2px 28px;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #000;
  }
  .tc-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 2px;
    box-sizing: border-box;
  }
  .tc-row {
    display: flex;
    align-items: flex-end;
    font-size: 13.5px;
    line-height: 1.25;
    color: #000;
    width: 100%;
    min-height: 24px;
  }
  .tc-col-lbl {
    width: 170px;
    display: inline-flex;
    justify-content: space-between;
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 13.5px;
    font-weight: 600;
    color: #000;
    padding-right: 6px;
  }
  .tc-lbl {
    font-weight: 600;
    white-space: nowrap;
    color: #000;
    flex-shrink: 0;
    font-size: 13.5px;
    margin-right: 6px;
  }
  .tc-line {
    flex: 1;
    border-bottom: 1.2px solid #000;
    display: inline-block;
    font-weight: 700;
    font-size: 13.5px;
    letter-spacing: 0.3px;
    color: #000;
    text-transform: uppercase;
    box-sizing: border-box;
    min-height: 18px;
  }
  .tc-val-left {
    text-align: left;
    padding: 0 14px 1px;
  }
  .tc-val-center {
    text-align: center;
    padding: 0 4px 1px;
  }
  .tc-box-footer {
    border: 2px solid #000;
    margin-top: 5px;
    padding: 8px 14px 6px 14px;
    background: #fff;
    box-sizing: border-box;
  }
  .tc-sig-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .tc-footer-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13.5px;
  }
  .tc-sig-row {
    display: flex;
    align-items: flex-end;
  }
  .tc-sig-lbl {
    font-size: 13.5px;
    font-weight: 600;
    color: #000;
    width: 110px;
    flex-shrink: 0;
  }
  .tc-sig-line {
    width: 240px;
    border-bottom: 1.2px solid #000;
    text-align: center;
    font-weight: 700;
    font-size: 13.5px;
    color: #000;
    padding-bottom: 1px;
  }
  .tc-footer-right {
    font-size: 13.5px;
    font-weight: 600;
    color: #000;
    padding-bottom: 2px;
  }
  .tc-rustication-note {
    text-align: center;
    font-size: 10.5px;
    line-height: 1.35;
    color: #000;
    margin-top: 8px;
    padding: 0 8px;
    font-family: Arial, Helvetica, sans-serif;
  }
`;

export function generateSchoolLeavingCertificateSheet(r) {
  const single = generateSchoolLeavingCertificateSingle(r);
  return `
  <div class="tc-landscape-sheet">
    <div class="tc-half-pane">
      <div class="tc-scaled-card">
        ${single}
      </div>
    </div>
    <div class="tc-scissor-divider">
      <div class="tc-cut-line"></div>
      <div class="tc-cut-icon">&#9986;</div>
      <div class="tc-cut-line"></div>
    </div>
    <div class="tc-half-pane">
      <div class="tc-scaled-card">
        ${single}
      </div>
    </div>
  </div>`;
}

export function generateSchoolLeavingCertificateHTML(rows) {
  const pagesHTML = rows.map(r => generateSchoolLeavingCertificateSheet(r)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>School Leaving Certificate</title>
<style>
${TC_STYLES}
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
}
