// Marksheet document generator (REQ-FEAT-008, 2026-10-09) - built as a raw
// HTML/CSS string rendered via the browser's own print-to-PDF, the same
// pattern tcGenerator.js already uses for the Transfer Certificate (and the
// pattern the reference `marksheet_template.html` the user supplied was
// itself built around), instead of drawing onto a jsPDF canvas. One source
// of truth (buildMarksheetView + generateMarksheetPageHTML) feeds both the
// live preview (scaled, dangerouslySetInnerHTML) and the print window, so
// they can never drift apart the way a separately-maintained jsPDF
// renderer and React preview could.
//
// Marks data itself still comes entirely from marksheetService.js
// (getMarksheetsForClass / getSingleExamMarksheet) - this file only knows
// how to lay the already-computed sheet out on the page.

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const ADDR_LINE = "Swaminarayan Nagar - Bhidbhanjan Society, Pandesara - Udhna, Surat - 394221";
const PHONE = "8200069671";
const EMAIL = "satyamstarsinternational@gmail.com";

const PHONE_ICON_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="none" stroke="#222" stroke-width="2"/>
  <path d="M9.3 6.8c.4-.3 1-.2 1.2.3l.9 2c.2.4.1.8-.2 1.1l-.8.7c.6 1.3 1.6 2.3 2.9 2.9l.7-.8c.3-.3.7-.4 1.1-.2l2 .9c.5.2.6.8.3 1.2l-.8 1c-.5.6-1.3.8-2 .6-3.2-1-5.6-3.4-6.6-6.6-.2-.7 0-1.5.6-2z" fill="#222"/>
</svg>`;
const ADDR_ICON_SVG = `<svg width="14" height="17" viewBox="0 0 18 22" aria-hidden="true">
  <path d="M9 0C4.3 0 .5 3.8.5 8.5 .5 14.6 9 22 9 22s8.5-7.4 8.5-13.5C17.5 3.8 13.7 0 9 0z" fill="#E8453C"/>
  <circle cx="9" cy="8.5" r="3.2" fill="#fff"/>
</svg>`;
const EMAIL_ICON_SVG = `<svg width="17" height="14" viewBox="0 0 24 18" aria-hidden="true">
  <rect x="1" y="1" width="22" height="16" rx="2" fill="none" stroke="#222" stroke-width="2"/>
  <path d="M2 2.5l10 8 10-8" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function fmtNum(n) {
  const num = Number(n) || 0;
  return (Math.round(num * 100) / 100).toString();
}

function fmtTodayDmy() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// First given name only ("MAYUR BEHERUK" -> "Mayur") - reads as a natural
// personalized remark rather than the full formal name; falls back to a
// generic noun if the student record has no name at all.
function firstName(fullName) {
  const first = String(fullName || "").trim().split(/\s+/)[0];
  if (!first) return "The student";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// 1-2 line remark auto-generated from the student's name + already-computed
// grade/result - no free-text data source exists for a teacher-written
// remark, so rather than leave the box blank this gives a short,
// personalized, grade-tiered comment. Tiers match marksheetService.js's
// gradeFor() boundaries (A1>=91, A2>=81, B1>=71, B2>=61, C1>=51, C2>=41,
// D>=33, else E/Fail) so the remark never disagrees with the grade printed
// next to it. (Final render is all-caps via .ms-sheet's text-transform
// regardless of the case used here.)
const AUTO_REMARKS = {
  A1: n => `${n} has delivered an outstanding performance across all subjects. Keep up the excellent work!`,
  A2: n => `${n} has performed very well this term, with consistent effort shown throughout.`,
  B1: n => `${n} has put in a good performance overall. A little more focus can help achieve even better results.`,
  B2: n => `${n}'s performance is satisfactory. More consistent effort is needed to improve further.`,
  C1: n => `${n}'s performance is average. Regular practice and revision are recommended.`,
  C2: n => `${n}'s performance is below average and needs focused attention in weaker subjects.`,
  D: n => `${n} has just managed to pass. Performance needs considerable improvement.`,
};
export function generateAutoRemark(studentName, grade, result) {
  const n = firstName(studentName);
  if (result === "Fail") return `${n}'s performance is below the passing standard and needs immediate attention and support.`;
  const tmpl = AUTO_REMARKS[grade];
  return tmpl ? tmpl(n) : "";
}

// Normalizes one marksheetService sheet (the "final" shape has
// subjectRows[].marks[] - one entry per official exam; the "single" shape
// has a flat obtained/max/grade per subject) plus the student record into
// the flat view-model the HTML builder below renders.
export function buildMarksheetView(student, sheet, mode, examNames, examName, logoUrl) {
  const s = student || {};
  const title = mode === "single"
    ? `${(examName || "").toUpperCase()} MARKSHEET`
    : "FINAL MARKSHEET";

  const examColumns = mode === "single" ? null : (examNames || []);
  // REQ-FEAT-009: an admin-marked absence prints "AB" in place of the
  // numeric cell(s) (matching the reference template's documented AB
  // behavior, already handled by subjectsTableHTML below) - in Final mode
  // that's just the one exam's cell, since the row's overall grade is an
  // aggregate across all exams; in Single Exam mode the row *is* that one
  // exam, so the grade itself also prints "AB".
  const subjectRows = (sheet?.subjectRows || []).map((row, i) => ({
    no: i + 1,
    name: row.subject,
    cells: mode === "single"
      ? [fmtNum(row.max), row.isAbsent ? "AB" : fmtNum(row.obtained)]
      : [...row.marks.map(m => m.isAbsent ? "AB" : `${fmtNum(m.obtained)}/${fmtNum(m.max)}`), fmtNum(row.total), fmtNum(row.obtained)],
    grade: mode === "single" && row.isAbsent ? "AB" : row.grade,
  }));

  const hasData = !!(sheet && sheet.subjectRows && sheet.subjectRows.length);

  return {
    logoUrl: logoUrl || "",
    title,
    examColumns,
    // Formal "Student Name" field: given name + father's name + surname
    // (e.g. "Mayur Harihar Beheruk"), the official naming convention this
    // school's families use - not just the bare first+last `s.name` the
    // rest of the admin panel shows. Falls back to `s.name` if the
    // separate firstName/fatherName/lastName fields aren't populated.
    studentName: [s.firstName, s.fatherName, s.lastName].filter(Boolean).join(" ") || s.name || "",
    className: `${s.std || ""}${s.section ? " - " + s.section : ""}`,
    rollNo: s.rollNo || "—",
    session: s.session || "—",
    subjectRows,
    totalMax: sheet?.totalMax ?? 0,
    totalObtained: sheet?.totalObtained ?? 0,
    percentage: sheet?.percentage ?? 0,
    grade: sheet?.grade ?? "—",
    result: sheet?.result ?? "—",
    rank: sheet?.rank ?? "—",
    // REQ-FEAT-009: an admin-set remark (Documents → Marksheet → Edit)
    // takes priority over the auto-generated grade-tiered one.
    remark: hasData ? (sheet.adminRemark || generateAutoRemark(s.firstName || s.name, sheet.grade, sheet.result)) : "",
    hasData,
    date: fmtTodayDmy(),
  };
}

function subjectsTableHTML(d) {
  const examCols = d.examColumns; // null for a single-exam marksheet
  const colHeaders = examCols
    ? ["No.", "Subject", ...examCols.map(esc), "Total", "Obtained", "Grade"]
    : ["No.", "Subject", "Full Marks", "Marks Obtained", "Grade"];

  const headRow = colHeaders.map((h, i) => {
    const style = i === 0 ? ' style="width:32px"' : i === 1 ? ' style="text-align:left;padding-left:10px"' : "";
    return `<th${style}>${h}</th>`;
  }).join("");

  const bodyRows = d.subjectRows.map(row => {
    const dataCells = row.cells.map(c => {
      const isAbsent = String(c).trim().toUpperCase() === "AB";
      return `<td class="${isAbsent ? "ms-ab" : "ms-ob"}">${esc(c)}</td>`;
    }).join("");
    const gradeAbsent = String(row.grade).trim().toUpperCase() === "AB";
    return `<tr>
      <td>${row.no}</td>
      <td class="ms-sub">${esc(row.name)}</td>
      ${dataCells}
      <td class="${gradeAbsent ? "ms-ab" : "ms-ob"}">${esc(row.grade)}</td>
    </tr>`;
  }).join("");

  const blankMiddle = examCols ? "<td></td>".repeat(examCols.length) : "";
  const footCells = `<td></td><td class="ms-sub">GRAND TOTAL</td>${blankMiddle}<td class="ms-ob">${fmtNum(d.totalMax)}</td><td class="ms-ob">${fmtNum(d.totalObtained)}</td><td class="ms-ob">${esc(d.grade)}</td>`;

  return `
  <table class="ms-table">
    <thead><tr>${headRow}</tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="${colHeaders.length}" style="color:#555;padding:14px;text-align:center">No subjects configured for this class yet — add them in Settings &rarr; Subjects.</td></tr>`}</tbody>
    <tfoot><tr class="ms-total">${footCells}</tr></tfoot>
  </table>`;
}

// One full A4 page for one student. d comes from buildMarksheetView().
export function generateMarksheetPageHTML(d) {
  return `
  <div class="ms-sheet">
    <header class="ms-header">
      <div class="ms-logo-slot">${d.logoUrl ? `<img class="ms-logo" src="${esc(d.logoUrl)}" alt="School Logo"/>` : ""}</div>
      <div class="ms-head-text">
        <p class="ms-trust">SATYAM EDUCATION CHARITABLE TRUST (E-8941)</p>
        <h1 class="ms-school-1">SATYAM STARS</h1>
        <h2 class="ms-school-2">INTERNATIONAL SCHOOL</h2>
        <div class="ms-addr-row">
          <span class="ms-addr">${ADDR_ICON_SVG}${esc(ADDR_LINE)}</span>
        </div>
        <div class="ms-contact">
          <span class="ms-phone">${PHONE_ICON_SVG}${PHONE}</span>
          <span class="ms-email">${EMAIL_ICON_SVG}${esc(EMAIL)}</span>
        </div>
      </div>
      <div class="ms-logo-slot" aria-hidden="true"></div>
    </header>

    <div class="ms-rule"><div class="a"></div><div class="b"></div></div>

    <div class="ms-band">
      <div class="ms-band-col">
        <span class="ms-band-label">Progress Report</span>
        <span class="ms-t">${esc(d.title)}</span>
      </div>
      <div class="ms-band-div"></div>
      <div class="ms-band-col ms-band-year">
        <span class="ms-band-label">Academic Year</span>
        <span class="ms-y">${esc(d.session)}</span>
      </div>
    </div>

    <section class="ms-details">
      <div class="ms-field ms-field-full"><label>Student Name :</label><div class="ms-fill">${esc(d.studentName)}</div></div>
      <div class="ms-field"><label>Class :</label><div class="ms-fill">${esc(d.className)}</div></div>
      <div class="ms-field"><label>Roll No. :</label><div class="ms-fill">${esc(d.rollNo)}</div></div>
      <div class="ms-field"><label>Date :</label><div class="ms-fill">${esc(d.date)}</div></div>
    </section>

    ${subjectsTableHTML(d)}
    <p class="ms-note">AB = Absent</p>

    <section class="ms-summary">
      <div class="ms-box"><span class="ms-k">PERCENTAGE</span><span class="ms-v">${d.percentage.toFixed(2)}%</span></div>
      <div class="ms-box"><span class="ms-k">OVERALL GRADE</span><span class="ms-v">${esc(d.grade)}</span></div>
      <div class="ms-box"><span class="ms-k">RESULT</span><span class="ms-v">${esc(d.result)}</span></div>
      <div class="ms-box"><span class="ms-k">CLASS RANK</span><span class="ms-v">${esc(d.rank)}</span></div>
      <div class="ms-box"><span class="ms-k">TOTAL MARKS</span><span class="ms-v">${fmtNum(d.totalObtained)} / ${fmtNum(d.totalMax)}</span></div>
    </section>

    <section class="ms-lower">
      <div class="ms-remarks">
        <h3>Remark</h3>
        ${d.remark ? `<p class="ms-remarks-txt">${esc(d.remark)}</p>` : ""}
      </div>
    </section>

    <div class="ms-spacer"></div>

    <section class="ms-signs">
      <div><div class="ms-sl"></div>Class Teacher</div>
      <div><div class="ms-sl"></div>Exam Co-Ordinator</div>
      <div><div class="ms-sl"></div>Principal</div>
    </section>

    <section class="ms-gscale">
      <div class="ms-gsh">Grading<br>Scale</div>
      <div class="ms-g"><b>A1</b><span>91&ndash;100%</span></div>
      <div class="ms-g"><b>A2</b><span>81&ndash;90%</span></div>
      <div class="ms-g"><b>B1</b><span>71&ndash;80%</span></div>
      <div class="ms-g"><b>B2</b><span>61&ndash;70%</span></div>
      <div class="ms-g"><b>C1</b><span>51&ndash;60%</span></div>
      <div class="ms-g"><b>C2</b><span>41&ndash;50%</span></div>
      <div class="ms-g"><b>D</b><span>33&ndash;40%</span></div>
      <div class="ms-g"><b>E</b><span>Below 33%</span></div>
    </section>
  </div>`;
}

export const MARKSHEET_STYLES = `
  .ms-sheet, .ms-sheet * { box-sizing: border-box; }
  .ms-sheet {
    width: 210mm; height: 297mm; max-height: 297mm; margin: 0 auto; background: #fff;
    padding: 9mm 10mm 8mm; display: flex; flex-direction: column; gap: 9px;
    border: 6px double #1B2A5E; overflow: hidden; page-break-inside: avoid; page-break-after: always;
    font-family: 'Source Sans 3', Arial, sans-serif; color: #111;
    /* Whole document in capitals, matching this school's other printed
       documents (ID card, Transfer Certificate) - purely visual, so
       dynamic fields (student name, subjects, remarks) are automatically
       covered regardless of how the data was actually typed/stored. */
    text-transform: uppercase;
  }
  .ms-sheet:last-child { page-break-after: auto; }

  /* logo-slot is mirrored (one real, one empty aria-hidden) on either side
     of ms-head-text at the same fixed width, so the text block is centered
     on the full page width instead of the leftover space after a
     left-only logo - without the mirror, the text visibly drifted right
     of true center and left a lopsided gap. */
  .ms-header { display: flex; align-items: center; gap: 12px; }
  .ms-logo-slot { width: 100px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .ms-logo { width: 92px; height: auto; }
  .ms-head-text { flex: 1 1 auto; min-width: 0; text-align: center; }
  .ms-trust { font-family: 'Open Sans', Arial, sans-serif; font-weight: 800; font-size: 15px; letter-spacing: .2px; margin: 0; white-space: nowrap; }
  .ms-school-1, .ms-school-2 {
    font-family: 'Libre Baskerville', 'Times New Roman', serif; font-weight: 700;
    margin: 0; line-height: 1.06; letter-spacing: 1px; white-space: nowrap;
  }
  .ms-school-1 { font-size: 49px; margin-top: 3px; }
  .ms-school-2 { font-size: 33px; }
  .ms-addr-row { display: flex; justify-content: center; align-items: center; margin-top: 6px; font-family: 'Open Sans', Arial, sans-serif; }
  .ms-contact { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 4px; font-family: 'Open Sans', Arial, sans-serif; }
  .ms-addr-row span, .ms-contact span { display: inline-flex; align-items: center; gap: 6px; }
  .ms-phone { font-weight: 800; font-size: 14.5px; }
  .ms-email { font-weight: 700; font-size: 14.5px; text-transform: lowercase; }
  /* 11px (up from the original 10.5px) - sized close to, just under,
     "INTERNATIONAL SCHOOL"'s width above it, with normal word-spacing. */
  .ms-addr { font-weight: 700; font-size: 11px; white-space: nowrap; }

  .ms-rule { display: flex; flex-direction: column; gap: 2px; }
  .ms-rule .a { height: 3px; background: #1B2A5E; }
  .ms-rule .b { height: 2px; background: #C62828; }

  .ms-band {
    display: flex; justify-content: space-between; align-items: center; gap: 14px;
    padding: 7px 18px; color: #fff; border-radius: 6px;
    background: linear-gradient(135deg, #1B2A5E 0%, #28397a 100%);
    border-bottom: 3px solid #C62828;
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
  }
  .ms-band-col { display: flex; flex-direction: column; line-height: 1.25; gap: 1px; }
  .ms-band-year { align-items: flex-end; text-align: right; }
  .ms-band-div { width: 1px; align-self: stretch; margin: 2px 0; background: rgba(255,255,255,.3); }
  /* White, not a color accent, for the small band labels - this document
     is routinely printed in black & white, and a mid-tone color (the
     original gold) can lose contrast against the navy background once a
     printer driver converts it to grayscale, while white never does. */
  .ms-band-label { font-family: 'Open Sans', Arial, sans-serif; font-weight: 700; font-size: 9.5px; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(255,255,255,.88); }
  .ms-band .ms-t { font-family: 'Libre Baskerville', serif; font-weight: 700; font-size: 18px; letter-spacing: .3px; white-space: nowrap; }
  .ms-band .ms-y { font-size: 16.5px; font-weight: 700; white-space: nowrap; }

  .ms-details { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 20px; row-gap: 5px; font-size: 15px; }
  .ms-field { display: flex; align-items: flex-end; gap: 6px; min-height: 22px; }
  .ms-field-full { grid-column: span 3; }
  .ms-field label { font-weight: 700; white-space: nowrap; }
  .ms-fill { flex-grow: 1; min-width: 0; overflow-wrap: anywhere; border-bottom: 1px dotted #555; min-height: 18px; padding: 0 4px; font-weight: 600; }

  .ms-table { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: auto; }
  .ms-table thead tr { background: #1B2A5E; color: #fff; height: 33px; font-size: 12.5px; }
  .ms-table th { border: 1px solid #1B2A5E; font-weight: 700; padding: 2px 4px; }
  .ms-table td { border: 1px solid #8A93A8; height: 29px; text-align: center; padding: 1px 3px; }
  .ms-table td.ms-sub { text-align: left; padding-left: 10px; font-weight: 600; }
  .ms-table td.ms-ob { font-weight: 700; }
  .ms-table td.ms-ab { color: #C62828; font-weight: 700; }
  .ms-table tbody tr:nth-child(even) { background: #F2F5FB; }
  .ms-table tr.ms-total { background: #E3E8F3 !important; font-weight: 700; height: 33px; }
  .ms-table tr.ms-total td.ms-sub { color: #1B2A5E; }

  .ms-note { margin: -3px 0 0; font-size: 12px; color: #444; text-align: right; }

  .ms-gscale { display: grid; grid-template-columns: 70px repeat(8, 1fr); border: 1px solid #8A93A8; border-radius: 4px; overflow: hidden; font-size: 12px; }
  .ms-gsh { background: #1B2A5E; color: #fff; font-weight: 700; font-size: 11.5px; line-height: 1.1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 3px; }
  .ms-g { white-space: nowrap; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 2px; border-left: 1px solid #8A93A8; background: #F7F9FC; gap: 1px; }
  .ms-g b { font-size: 14px; color: #1B2A5E; }

  .ms-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  /* Same fieldset-legend treatment as Remark/School Stamp above: the
     label sits on the box outline, and the value is centered in the
     cleared interior instead of bottom-right. */
  .ms-box { position: relative; border: 1.5px solid #1B2A5E; border-radius: 4px; height: 54px; padding: 0 5px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .ms-box .ms-k { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 5px; font-size: 11.5px; font-weight: 800; color: #1B2A5E; letter-spacing: .3px; white-space: nowrap; }
  .ms-box .ms-v { font-size: 18px; font-weight: 800; text-align: center; white-space: nowrap; }

  /* "Remark" sits ON the box outline (fieldset-legend style: a
     white-backed label straddling the border line). No dedicated School
     Stamp box - the remark area runs the full width, auto-filled with a
     1-2 line grade-tiered comment (no free-text data source exists for a
     teacher-written one), and the open space below it (before the
     signature row) is left clear so there's real room to sign and apply
     the physical stamp there. */
  .ms-lower { display: flex; gap: 16px; }
  .ms-remarks { position: relative; flex-grow: 1; min-width: 0; border: 1px solid #8A93A8; border-radius: 4px; padding: 14px 14px 8px; min-height: 68px; box-sizing: border-box; }
  .ms-remarks h3 { position: absolute; top: -8px; left: 10px; margin: 0; padding: 0 6px; background: #fff; font-size: 13.5px; color: #1B2A5E; }
  .ms-remarks-txt { margin: 0; font-size: 13.5px; font-weight: 600; line-height: 1.45; }

  .ms-spacer { flex-grow: 1; }

  .ms-signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; text-align: center; font-size: 13.5px; font-weight: 700; }
  .ms-signs .ms-sl { height: 24px; border-bottom: 1px solid #333; margin-bottom: 5px; display: flex; align-items: flex-end; justify-content: center; font-weight: 600; padding-bottom: 2px; }

  @page { size: A4; margin: 0; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    .ms-sheet { margin: 0; }
    .ms-sheet, .ms-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const MARKSHEET_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Open+Sans:wght@600;700;800&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">`;

// views: array of buildMarksheetView() results, one per student - wraps
// them all into a single printable document (one A4 page each).
export function generateMarksheetHTML(views) {
  const pagesHTML = views.map(generateMarksheetPageHTML).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Marksheet</title>
${MARKSHEET_FONTS_LINK}
<style>${MARKSHEET_STYLES}</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
}
