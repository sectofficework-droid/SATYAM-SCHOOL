import * as XLSX from "xlsx";
import { normalizeDate } from "./importUtils.js";
import { fmtDMY } from "./utils.js";
import { TC_LOGO_BASE64, TC_SARASWATI_BASE64 } from "./tcAssets.js";

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
    attendancePresent: overrides.attendancePresent || "210",
    attendanceTotal: overrides.attendanceTotal || "235",
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
  const religionCaste = [r.religion, r.caste].filter(Boolean).join(" , ");

  return `
  <div class="tc-page">
    <div class="tc-cert-box">
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

      <!-- Title & DISE code -->
      <div class="tc-title-dise-wrap">
        <div class="tc-title-pill">SCHOOL LEAVING CERTIFICATE</div>
        <div class="tc-dise-code">SCHOOL DISE CODE - 24224100067</div>
      </div>

      <div class="tc-body">
        <!-- Certificate No and Register No -->
        <div class="tc-row" style="margin-bottom: 2px;">
          <span class="tc-bold-lbl">Certificate No:</span>
          <span class="tc-line" style="flex: 0 0 170px;">${r.certificateNo || "&nbsp;"}</span>
          <span style="flex: 1;"></span>
          <span class="tc-bold-lbl">Register No. of the pupil :</span>
          <span class="tc-line" style="flex: 0 0 160px;">${r.registerNo || "&nbsp;"}</span>
        </div>

        <!-- U-DISE -->
        <div class="tc-row">
          <span class="tc-lbl">U-DISE Number of the Student :</span>
          <span class="tc-line">${r.udiseNo || "&nbsp;"}</span>
        </div>

        <!-- 1. Name -->
        <div class="tc-row">
          <span class="tc-lbl">1. Name of the Pupil :</span>
          <span class="tc-line">${r.name || "&nbsp;"}</span>
        </div>

        <!-- 2. Father -->
        <div class="tc-row">
          <span class="tc-lbl">2. Father&rsquo;s Name :</span>
          <span class="tc-line">${r.fatherName || "&nbsp;"}</span>
        </div>

        <!-- 3. Mother -->
        <div class="tc-row">
          <span class="tc-lbl">3. Mother&rsquo;s Name :</span>
          <span class="tc-line">${r.motherName || "&nbsp;"}</span>
        </div>

        <!-- 4. Aadhar -->
        <div class="tc-row">
          <span class="tc-lbl">4. Pupil Aadhar No. :</span>
          <span class="tc-line">${r.aadhar || "&nbsp;"}</span>
        </div>

        <!-- 5. Religion and Caste -->
        <div class="tc-row">
          <span class="tc-lbl">5. Religion and Caste :</span>
          <span class="tc-line">${religionCaste || "&nbsp;"}</span>
        </div>

        <!-- 6. Place of Birth -->
        <div class="tc-row">
          <span class="tc-lbl">6. Place of Birth :</span>
          <span class="tc-line">${r.placeOfBirth || "&nbsp;"}</span>
        </div>

        <!-- 7. DOB -->
        <div class="tc-row">
          <span class="tc-lbl">7. Date of Birth ( in Christian Era ) as per Admission Register ( in Figures ) :</span>
          <span class="tc-line" style="flex: 1;">${dobDmy || "&nbsp;"}</span>
        </div>

        <div class="tc-row tc-sub">
          <span class="tc-lbl">( in Words ) :</span>
          <span class="tc-line" style="flex: 1;">${dobWords || "&nbsp;"}</span>
        </div>

        <!-- 8. Last School Attended -->
        <div class="tc-row">
          <span class="tc-lbl">8. Last School Attended :</span>
          <span class="tc-line">${r.lastSchoolAttended || "SATYAM STARS INTERNATIONAL SCHOOL"}</span>
        </div>

        <!-- 9. Date of Admission -->
        <div class="tc-row">
          <span class="tc-lbl">9. Date of Admission :</span>
          <span class="tc-line">${admissionDmy || "&nbsp;"}</span>
        </div>

        <!-- 10 & 11. Progress and Conduct -->
        <div class="tc-row">
          <span class="tc-lbl">10. Progress :</span>
          <span class="tc-line" style="flex: 1; margin-right: 16px;">${r.progress || "VERY GOOD"}</span>
          <span class="tc-lbl">11. Conduct :</span>
          <span class="tc-line" style="flex: 1;">${r.conduct || "VERY GOOD"}</span>
        </div>

        <!-- 12. Attendance -->
        <div class="tc-row">
          <span class="tc-lbl">12. Attendance :</span>
          <span class="tc-line" style="flex: 0 0 65px; margin: 0 4px;">${r.attendancePresent || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">Out of</span>
          <span class="tc-line" style="flex: 0 0 65px; margin: 0 4px;">${r.attendanceTotal || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">in Class</span>
          <span class="tc-line" style="flex: 0 0 75px; margin: 0 4px;">${r.attendanceClass || "&nbsp;"}</span>
          <span class="tc-lbl" style="margin: 0 4px;">From</span>
          <span class="tc-line" style="flex: 1; margin-left: 4px;">${r.attendanceFrom || "&nbsp;"}</span>
        </div>

        <!-- 13. Date of Leaving -->
        <div class="tc-row">
          <span class="tc-lbl">13. Date of Leaving the School :</span>
          <span class="tc-line">${leavingDmy || "&nbsp;"}</span>
        </div>

        <!-- 14. Exam Passed / Promoted -->
        <div class="tc-row">
          <span class="tc-lbl">14. Whether he/she has Passed the examination</span>
          <span class="tc-line">${r.passedExamText || "&nbsp;"}</span>
        </div>

        <div class="tc-row tc-sub">
          <span class="tc-lbl">or Promoted to the next Higher Class</span>
          <span class="tc-line">${r.promotedText || "&nbsp;"}</span>
        </div>

        <!-- 15. Class Studying Since -->
        <div class="tc-row">
          <span class="tc-lbl">15. Class in which Studying and Since When</span>
          <span class="tc-line">${r.studyingClassSince || "&nbsp;"}</span>
        </div>

        <!-- 16. Reason -->
        <div class="tc-row">
          <span class="tc-lbl">16. Reason for Leaving The School</span>
          <span class="tc-line">${r.reasonForLeaving || "TO STUDY ELSEWHERE"}</span>
        </div>

        <!-- 17. PEN -->
        <div class="tc-row">
          <span class="tc-lbl">17. Student&rsquo;s PEN ( Permanent Education Number )</span>
          <span class="tc-line">${r.pen || "&nbsp;"}</span>
        </div>

        <!-- 18. Remarks -->
        <div class="tc-row">
          <span class="tc-lbl">18. Remarks</span>
          <span class="tc-line">${r.remarks || "&nbsp;"}</span>
        </div>
      </div>

      <!-- Signatures Footer -->
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
            <span class="tc-sig-line">${leavingDmy || "&nbsp;"}</span>
          </div>
        </div>
        <div class="tc-footer-right">
          Signature of Principal
        </div>
      </div>
    </div>

    <!-- Rustication Warning Note outside border -->
    <div class="tc-rustication-note">
      (No change in entry in this certificate shall be made except by the authority issuing it any infringement of this requirement is liable to involve the the imposition of a penalty such as that of rustication)
    </div>
  </div>`;
}

export const TC_STYLES = `
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  .tc-page {
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    margin: 0 auto;
    padding: 8mm 12mm 6mm 12mm;
    background: #fff;
    page-break-after: always;
    page-break-inside: avoid;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    overflow: hidden;
  }
  .tc-page:last-child {
    page-break-after: avoid;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      width: 210mm !important;
      height: 297mm !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .tc-page {
      width: 210mm !important;
      height: 297mm !important;
      max-height: 297mm !important;
      padding: 8mm 12mm 6mm 12mm !important;
      margin: 0 !important;
      page-break-after: always !important;
      page-break-inside: avoid !important;
      overflow: hidden !important;
    }
    .tc-page:last-child {
      page-break-after: auto !important;
    }
  }
  .tc-cert-box {
    border: 2px solid #000;
    padding: 8px 14px 10px 14px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: 1;
    background: #fff;
    box-sizing: border-box;
  }
  .tc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 2px solid #000;
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
  .tc-title-dise-wrap {
    text-align: center;
    padding: 8px 0 6px;
    border-bottom: 2px solid #000;
  }
  .tc-title-pill {
    display: inline-block;
    border: 2px solid #000;
    border-radius: 20px;
    padding: 4px 34px;
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #000;
    margin-bottom: 6px;
  }
  .tc-dise-code {
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #000;
  }
  .tc-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6px 0;
    box-sizing: border-box;
  }
  .tc-row {
    display: flex;
    align-items: flex-end;
    font-size: 13.5px;
    line-height: 1.25;
    color: #000;
    width: 100%;
    min-height: 25px;
  }
  .tc-row.tc-sub {
    padding-left: 20px;
  }
  .tc-bold-lbl {
    font-weight: 700;
    white-space: nowrap;
    color: #000;
    flex-shrink: 0;
    font-size: 13.5px;
    margin-right: 6px;
  }
  .tc-lbl {
    font-weight: 500;
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
    text-align: center;
    font-weight: 700;
    font-size: 13.5px;
    letter-spacing: 0.3px;
    color: #000;
    text-transform: uppercase;
    padding: 0 4px 1px;
    box-sizing: border-box;
    min-height: 18px;
  }
  .tc-sig-section {
    border-top: 2px solid #000;
    padding: 10px 4px 2px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .tc-footer-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 13.5px;
  }
  .tc-sig-row {
    display: flex;
    align-items: flex-end;
  }
  .tc-sig-lbl {
    font-size: 13.5px;
    font-weight: 500;
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
    font-size: 14.5px;
    font-weight: 700;
    color: #000;
    padding-bottom: 4px;
  }
  .tc-rustication-note {
    text-align: center;
    font-size: 10px;
    line-height: 1.35;
    color: #111;
    margin-top: 6px;
    padding: 0 12px;
    font-family: Arial, Helvetica, sans-serif;
  }
`;

export function generateSchoolLeavingCertificateHTML(rows) {
  const pagesHTML = rows.map(r => generateSchoolLeavingCertificateSingle(r)).join("");

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
