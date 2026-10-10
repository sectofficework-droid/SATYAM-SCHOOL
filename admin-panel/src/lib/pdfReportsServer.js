import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

const ADDR1 = "Swaminarayan Nagar - Bhidbhanjan Society";
const PHONE = "8200069671";
const MM = 72 / 25.4; // mm -> pt

function fmtDMY(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtAddr(s) {
  return [s.roomPlotNo, s.address].filter(Boolean).join(", ") || "—";
}

function readPublicFile(relPath) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", relPath));
  } catch {
    return null;
  }
}

// ── ID Card (Design 1 only — the school's default portrait card; Design 2
// and the Canva bulk-export path from the web page are deliberately not
// ported here, disclosed in the build report) ──────────────────────────────
export async function generateIdCardPdf(students) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const bgBytes = readPublicFile("id-card-portrait-template.png");
  const bg = bgBytes ? await doc.embedPng(bgBytes) : null;

  const W = 80 * MM, H = 135.1 * MM;
  const positions = [
    { x: 15 * MM, y: 297 * MM - 8 * MM - H },
    { x: 115 * MM, y: 297 * MM - 8 * MM - H },
    { x: 15 * MM, y: 297 * MM - 152 * MM - H },
    { x: 115 * MM, y: 297 * MM - 152 * MM - H },
  ];

  let page = null;
  for (let i = 0; i < students.length; i++) {
    const slot = i % 4;
    if (slot === 0) page = doc.addPage([210 * MM, 297 * MM]);
    const s = students[i];
    const { x: cx, y: cy } = positions[slot];

    if (bg) page.drawImage(bg, { x: cx, y: cy, width: W, height: H });

    const name = (s.name || "Student Name").toUpperCase();
    page.drawText(name, { x: cx + 10 * MM, y: cy + H - 66.2 * MM, size: 11, font, color: rgb(0, 0, 0) });
    page.drawText("STD : " + (s.std || "—").toUpperCase(), {
      x: cx + 20 * MM, y: cy + H - 73.5 * MM, size: 9, font, color: rgb(1, 1, 1),
    });

    const lines = [
      `Father: ${(s.fatherName || "—").toUpperCase()}`,
      `Mother: ${(s.motherName || "—").toUpperCase()}`,
      `DOB: ${fmtDMY(s.dob)}`,
      `Mobile: ${(s.mobile || s.mobile2 || "—")}`,
      `Addr: ${fmtAddr(s)}`,
    ];
    lines.forEach((line, i2) => {
      page.drawText(line.slice(0, 40), {
        x: cx + 10 * MM, y: cy + H - (78.5 + i2 * 5.2) * MM, size: 6.5, font,
      });
    });
  }
  return doc.save();
}

// ── Bonafide Certificate (plain text layout — the physical pre-printed form's
// strike-through/underline styling from the web generator is simplified to
// plain text here, disclosed in the build report) ──────────────────────────
export async function generateBonafidePdf(students) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const PW = 210 * MM, PH = 297 * MM;

  for (const s of students) {
    for (let copy = 0; copy < 2; copy++) {
      const page = doc.addPage([PW, PH]);
      page.drawRectangle({ x: 10 * MM, y: 10 * MM, width: PW - 20 * MM, height: PH - 20 * MM, borderColor: rgb(0.1, 0.17, 0.42), borderWidth: 1.5 });

      page.drawText("SATYAM STARS INTERNATIONAL SCHOOL", { x: 25 * MM, y: PH - 30 * MM, size: 16, font: fontBold, color: rgb(0.1, 0.17, 0.42) });
      page.drawText(`${ADDR1}, Pandesara, Surat - 394210   Ph: ${PHONE}`, { x: 25 * MM, y: PH - 37 * MM, size: 9, font });
      page.drawText("BONAFIDE CERTIFICATE", { x: PW / 2 - 45 * MM, y: PH - 55 * MM, size: 18, font: fontBold, color: rgb(0.1, 0.17, 0.42) });

      const female = (s.gender || "").trim().toLowerCase().startsWith("f");
      const dobDmy = fmtDMY(s.dob);
      const body = [
        `This is to certify that ${female ? "Ms." : "Mr."} ${(s.name || "—").toUpperCase()} is a bonafide`,
        `student of this school, studying in Std. ${s.std || "—"} (Year ${s.session || "2026-27"}).`,
        ``,
        `${female ? "Her" : "His"} birthdate as recorded in the General Register of School is ${dobDmy}.`,
        ``,
        `To the best of my knowledge ${female ? "she" : "he"} bears a good moral character.`,
      ];
      body.forEach((line, i) => {
        page.drawText(line, { x: 25 * MM, y: PH - 75 * MM - i * 7 * MM, size: 12, font });
      });

      page.drawText(`DATE: ${new Date().toLocaleDateString("en-GB")}`, { x: 25 * MM, y: 30 * MM, size: 10, font });
      page.drawText("PRINCIPAL", { x: PW - 55 * MM, y: 30 * MM, size: 11, font: fontBold });
    }
  }
  return doc.save();
}

// ── Transfer Certificate (field list — the web generator's full pre-printed
// register-style TC layout isn't ported; this renders the same TC_FIELDS
// data as a plain certificate letter, disclosed in the build report) ───────
export async function generateTcPdf(row) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const PW = 210 * MM, PH = 297 * MM;
  const page = doc.addPage([PW, PH]);

  page.drawRectangle({ x: 10 * MM, y: 10 * MM, width: PW - 20 * MM, height: PH - 20 * MM, borderColor: rgb(0.1, 0.17, 0.42), borderWidth: 1.5 });
  page.drawText("SATYAM STARS INTERNATIONAL SCHOOL", { x: 25 * MM, y: PH - 30 * MM, size: 16, font: fontBold, color: rgb(0.1, 0.17, 0.42) });
  page.drawText("TRANSFER CERTIFICATE", { x: PW / 2 - 45 * MM, y: PH - 50 * MM, size: 18, font: fontBold, color: rgb(0.1, 0.17, 0.42) });

  let y = PH - 70 * MM;
  for (const [label, value] of Object.entries(row)) {
    page.drawText(`${label}: ${value ?? "—"}`, { x: 25 * MM, y, size: 10, font });
    y -= 7 * MM;
    if (y < 25 * MM) break;
  }
  return doc.save();
}

// ── Marksheet (table of subject rows — reuses marksheetService's computed
// sheet shape; full official letterhead/signature styling simplified) ──────
export async function generateMarksheetPdf(s, sheet, examNames) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const PW = 210 * MM, PH = 297 * MM;
  const page = doc.addPage([PW, PH]);
  const marginX = 20 * MM;

  page.drawText("SATYAM STARS INTERNATIONAL SCHOOL", { x: marginX, y: PH - 25 * MM, size: 15, font: fontBold, color: rgb(0.1, 0.17, 0.42) });
  page.drawText("FINAL MARKSHEET", { x: marginX, y: PH - 33 * MM, size: 12, font: fontBold });
  page.drawText(`Name: ${s.name}    Class: ${s.std}${s.section ? " - " + s.section : ""}    Roll No: ${s.rollNo || "—"}`, {
    x: marginX, y: PH - 45 * MM, size: 10, font,
  });

  if (!sheet || !sheet.subjectRows?.length) {
    page.drawText("No subjects configured for this class.", { x: marginX, y: PH - 60 * MM, size: 10, font });
    return doc.save();
  }

  let y = PH - 60 * MM;
  const header = ["Subject", ...examNames, "Total", "Obtained", "Grade"];
  const colW = (PW - 2 * marginX) / header.length;
  header.forEach((h, i) => page.drawText(h, { x: marginX + i * colW, y, size: 8, font: fontBold }));
  y -= 6 * MM;

  sheet.subjectRows.forEach((row) => {
    const cells = [row.subject, ...row.marks.map((m) => `${m.obtained}/${m.max}`), String(row.total), String(row.obtained), row.grade];
    cells.forEach((c, i) => page.drawText(String(c), { x: marginX + i * colW, y, size: 8, font }));
    y -= 5.5 * MM;
  });

  y -= 6 * MM;
  page.drawText(`Result: ${sheet.result}   Percentage: ${sheet.percentage.toFixed(2)}%   Grade: ${sheet.grade}`, {
    x: marginX, y, size: 9, font: fontBold,
  });

  return doc.save();
}

// ── Generic tabular report (Attendance / Salary) ────────────────────────────
export async function generateTabularPdf(title, columns, rows) {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const PW = 210 * MM, PH = 297 * MM;
  const marginX = 15 * MM;
  const rowH = 6 * MM;
  const colW = (PW - 2 * marginX) / columns.length;

  let page = doc.addPage([PW, PH]);
  let y = PH - 25 * MM;
  page.drawText(title, { x: marginX, y, size: 14, font: fontBold, color: rgb(0.1, 0.17, 0.42) });
  y -= 12 * MM;

  const drawHeader = () => {
    columns.forEach((c, i) => page.drawText(c, { x: marginX + i * colW, y, size: 8, font: fontBold }));
    y -= rowH;
  };
  drawHeader();

  for (const row of rows) {
    if (y < 20 * MM) {
      page = doc.addPage([PW, PH]);
      y = PH - 25 * MM;
      drawHeader();
    }
    row.forEach((cell, i) => page.drawText(String(cell ?? "—").slice(0, 28), { x: marginX + i * colW, y, size: 7.5, font }));
    y -= rowH;
  }

  return doc.save();
}
