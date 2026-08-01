"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getStudents } from "@/lib/studentService";
import { getS3ViewUrl } from "@/lib/s3Upload";
import { fmtDMY } from "@/lib/utils";
import { getMarksheetsForClass, EXAM_TYPES } from "@/lib/marksheetService";
import S3Image from "@/components/S3Image";
import {
  CreditCard, Award, FileText, Search, Download,
  Users, GraduationCap, X, CheckSquare, ChevronLeft, ChevronRight
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ADDR1   = "Swaminarayan Nagar - Bhidbhanjan Society";
const ADDR2   = "Pandesara - Udhna , Surat - 394210";
const PHONE   = "8200069671";

const CLASSES_LIST = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];

const SUB_TABS = [
  { key:"idcard",    label:"ID Card",   icon:CreditCard },
  { key:"marksheet", label:"Marksheet", icon:Award      },
  { key:"bonafide",  label:"Bonafide",  icon:FileText   },
  { key:"noc",       label:"NOC",       icon:FileText   },
  { key:"tc",        label:"TC",        icon:FileText   },
];

// Two fixed ID card designs, each the school's actual Canva-exported card
// (see "SCHOOL ID CARD 1.jpg" and "SCHOOL ID CARD 2.jpg") used directly as a
// background image so the design itself is pixel-identical to the original -
// these two colors are only needed for the small bits redrawn on top
// (the red nameplate in design 1, the navy name/class boxes in design 2).
const CARD_NAVY = "#1a2b6b";
const CARD_RED  = "#dc2626";

const CARD_DESIGNS = [
  { id:1, name:"Classic Portrait",  desc:"Gold-ring photo, red nameplate" },
  { id:2, name:"Trust Landscape",   desc:"CR80 card, navy header/footer"  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAddr(s) {
  return [s.roomPlotNo, s.address].filter(Boolean).join(", ") || "";
}

// Matches the school's actual physical Bonafide Certificate exactly (a
// pre-printed form: both gender options are shown with the wrong one struck
// through, and filled-in blanks are underlined) - see BONAFIED.pdf.
function isFemale(gender) {
  return (gender || "").trim().toLowerCase().startsWith("f");
}

const NUM_WORDS_ONES = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const NUM_WORDS_TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

// Plain compound-cardinal reading (e.g. 2021 -> "TWO THOUSAND TWENTY ONE"),
// matching how the school's certificate spells out the birth year - not the
// "twenty twenty-one" style some people read years aloud with.
function numberToWords(n) {
  if (n === 0) return "ZERO";
  if (n < 20) return NUM_WORDS_ONES[n];
  if (n < 100) return NUM_WORDS_TENS[Math.floor(n / 10)] + (n % 10 ? " " + NUM_WORDS_ONES[n % 10] : "");
  if (n < 1000) return NUM_WORDS_ONES[Math.floor(n / 100)] + " HUNDRED" + (n % 100 ? " " + numberToWords(n % 100) : "");
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  return numberToWords(thousands) + " THOUSAND" + (rest ? " " + numberToWords(rest) : "");
}

const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

function dobParts(dobIso) {
  const m = String(dobIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { words: "", dmy: "" };
  const [, y, mo, d] = m;
  const words = `${numberToWords(parseInt(d, 10))} ${MONTH_NAMES[parseInt(mo, 10) - 1]} ${numberToWords(parseInt(y, 10))}`;
  return { words, dmy: `${d}/${mo}/${y}` };
}

function fmtIssueDateDMY(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── Fetch image as base64 via blob (avoids CORS canvas issues) ────────────────
async function fetchBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch { return null; }
}

// ── Make circular PNG using canvas ────────────────────────────────────────────
async function circularBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const SZ = 400;
      const canvas = document.createElement("canvas");
      canvas.width = SZ; canvas.height = SZ;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.beginPath();
        ctx.arc(SZ/2, SZ/2, SZ/2, 0, Math.PI*2);
        ctx.clip();
        const sc = Math.max(SZ/img.width, SZ/img.height);
        ctx.drawImage(img, (SZ - img.width*sc)/2, (SZ - img.height*sc)/2, img.width*sc, img.height*sc);
        URL.revokeObjectURL(objUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
      img.src = objUrl;
    });
  } catch { return null; }
}

// ── Make rounded-square PNG using canvas (design 2's square photo box) ────────
async function roundedSquareBase64(url, radiusFrac = 0.08) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const SZ = 400;
      const canvas = document.createElement("canvas");
      canvas.width = SZ; canvas.height = SZ;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        const r = SZ * radiusFrac;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.arcTo(SZ, 0, SZ, SZ, r);
        ctx.arcTo(SZ, SZ, 0, SZ, r);
        ctx.arcTo(0, SZ, 0, 0, r);
        ctx.arcTo(0, 0, SZ, 0, r);
        ctx.closePath();
        ctx.clip();
        const sc = Math.max(SZ/img.width, SZ/img.height);
        ctx.drawImage(img, (SZ - img.width*sc)/2, (SZ - img.height*sc)/2, img.width*sc, img.height*sc);
        URL.revokeObjectURL(objUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
      img.src = objUrl;
    });
  } catch { return null; }
}

// ── jsPDF card drawing ────────────────────────────────────────────────────────
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

// Design 1 is the actual "SCHOOL ID CARD 1.jpg" Canva export used as a
// full-bleed background (591x1004px, so the card is drawn at that exact
// aspect ratio) - the decorative dot pattern, blob shapes, gold-ring photo
// frame, red nameplate outline, wave, and footer are all pixel-identical to
// the Canva design because they ARE that image. Only the parts that change
// per student (photo, name, and each info row's value) are drawn on top,
// each preceded by an opaquely-filled cover shape so the sample data baked
// into the template ("Jharana Patra", "123-456-7890", etc.) never shows
// through from underneath.
const CARD1_W = 79.5, CARD1_H = 135.1; // 591:1004 aspect ratio

async function drawCardDesign1(doc, s, bgB64, photoB64, cx, cy) {
  const W = CARD1_W, H = CARD1_H;
  const [rr, rg, rb] = rgb(CARD_RED);

  if (bgB64) {
    try { doc.addImage(bgB64, "JPEG", cx, cy, W, H); } catch {}
  }

  // ── Photo (inside the template's gold ring) ───────────────────
  const px = cx + 39.8, py = cy + 36.3;
  if (photoB64) {
    doc.setFillColor(255, 255, 255);
    doc.circle(px, py, 14.6, "F");
    try { doc.addImage(photoB64, "PNG", px-14.5, py-14.5, 29, 29); } catch {}
  }

  // ── Name (redraw the red pill, same shape/color as the template) ─
  doc.setFillColor(rr, rg, rb);
  doc.roundedRect(cx+8.7, cy+57.4, 61.6, 5.8, 2.9, 2.9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const nameStr = (s.name || "Student Name").toUpperCase();
  const nameFit = doc.splitTextToSize(nameStr, 57)[0];
  doc.text(nameFit, cx+39.5, cy+61, { align:"center" });

  // ── Info row values (labels are already printed on the template) ─
  const VALUE_X = cx+40.9, VALUE_W = 35.8;
  const infoRows = [
    { y:69.8, val: s.fatherName || "" },
    { y:74.8, val: s.motherName || "" },
    { y:79.8, val: fmtDMY(s.dob) || "" },
    { y:84.9, val: s.mobile || s.mobile1 || "" },
  ];
  doc.setFontSize(6.3);
  infoRows.forEach(row => {
    doc.setFillColor(255, 255, 255);
    doc.rect(VALUE_X, cy+row.y-3.9, VALUE_W, 4.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    const valLine = doc.splitTextToSize(": " + (row.val || "—"), VALUE_W)[0];
    doc.text(valLine, VALUE_X, cy+row.y);
  });

  // Address (may wrap onto a second/third line)
  doc.setFillColor(255, 255, 255);
  doc.rect(VALUE_X, cy+85.9, VALUE_W, 18.6, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
  const addrLines = doc.splitTextToSize(": " + (fmtAddr(s) || "—"), VALUE_W).slice(0, 3);
  addrLines.forEach((line, i) => doc.text(line, VALUE_X, cy+89.9+i*5));
}

// Design 2 is the actual "SCHOOL ID CARD 2.jpg" Canva export (1011x639px)
// used as a full-bleed background the same way design 1 is - the navy
// header/footer, trust name, school title, stripe accents and box outlines
// are all pixel-identical to the Canva design. Only the photo, name, class,
// and each info row's value are drawn on top, each preceded by an opaque
// cover shape.
const CARD2_W = 90, CARD2_H = 56.9; // 1011:639 aspect ratio

async function drawCardDesign2(doc, s, bgB64, photoB64, cx, cy) {
  const [nr, ng, nb] = rgb(CARD_NAVY);

  if (bgB64) {
    try { doc.addImage(bgB64, "JPEG", cx, cy, CARD2_W, CARD2_H); } catch {}
  }

  // ── Photo (inside the template's pale-blue box) ─────────────────
  const bx = cx+3.6, by = cy+17.7, bw = 18.7, bh = 23.2;
  if (photoB64) {
    try { doc.addImage(photoB64, "PNG", bx, by, bw, bh); } catch {}
  }

  // ── Name + Class boxes (redraw navy, same as the template) ───────
  const boxY = cy+17.8, boxH = 6.9;
  const nameX = cx+22.3, nameW = 41.2;
  const stdX = nameX+nameW+0.3, stdW = 12.5;
  doc.setFillColor(nr, ng, nb);
  doc.rect(nameX, boxY, nameW, boxH, "F");
  doc.rect(stdX, boxY, stdW, boxH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const nameFit = doc.splitTextToSize((s.name || "Student Name").toUpperCase(), nameW-4)[0];
  doc.text(nameFit, nameX+nameW/2, boxY+boxH/2+1.2, { align:"center" });
  doc.setFontSize(7);
  doc.text((s.std || "—").toUpperCase(), stdX+stdW/2, boxY+boxH/2+1.2, { align:"center" });

  // ── Info row values (labels are already printed on the template) ─
  const VALUE_X = cx+39.2, VALUE_W = 47.7;
  const infoRows = [
    { y:27.6, val: s.fatherName || "" },
    { y:30.8, val: s.motherName || "" },
    { y:34.0, val: fmtDMY(s.dob) || "" },
    { y:37.2, val: s.mobile || s.mobile1 || "" },
  ];
  doc.setFontSize(5.3);
  infoRows.forEach(row => {
    doc.setFillColor(245, 245, 245);
    doc.rect(VALUE_X, cy+row.y-2.6, VALUE_W, 3.0, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    const valLine = doc.splitTextToSize(": " + (row.val || "—"), VALUE_W)[0];
    doc.text(valLine, VALUE_X, cy+row.y);
  });
  doc.setFillColor(245, 245, 245);
  doc.rect(VALUE_X, cy+37.8, VALUE_W, 6.6, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
  const addrLines = doc.splitTextToSize(": " + (fmtAddr(s) || "—"), VALUE_W).slice(0, 2);
  addrLines.forEach((line, i) => doc.text(line, VALUE_X, cy+40.4+i*3.2));
}

async function drawCard(doc, s, designId, bgB64, photoB64, cx, cy) {
  if (designId === 2) return drawCardDesign2(doc, s, bgB64, photoB64, cx, cy);
  return drawCardDesign1(doc, s, bgB64, photoB64, cx, cy);
}

// ── Generate PDF ──────────────────────────────────────────────────────────────
// Design 1 is a portrait card (4 per A4 page); design 2 is a landscape
// CR80-style card (8 per A4 page, 2 columns x 4 rows) - and design 2's photo
// is a rounded square, not a circle, so it needs its own crop.
const DESIGN1_POSITIONS = [
  { cx:10,    cy:8   },
  { cx:99.5,  cy:8   },
  { cx:10,    cy:151.1 },
  { cx:99.5,  cy:151.1 },
];
const DESIGN2_POSITIONS = [0,1,2,3].flatMap(row =>
  [10, 110].map(cx => ({ cx, cy: 8 + row*70 }))
);

async function generatePDF(students, designId, onProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });

  const bgUrl = window.location.origin + (designId === 2 ? "/id-card-bg-2.jpg" : "/id-card-bg-1.jpg");
  const bgB64 = await fetchBase64(bgUrl);

  const positions  = designId === 2 ? DESIGN2_POSITIONS : DESIGN1_POSITIONS;
  const perPage    = positions.length;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    onProgress && onProgress(i+1, students.length);

    let photoUrl = "";
    if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo))||""; } catch {} }
    const photoB64 = photoUrl
      ? await (designId === 2 ? roundedSquareBase64(photoUrl, 0.02) : circularBase64(photoUrl))
      : null;

    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const { cx, cy } = positions[slot];

    await drawCard(doc, s, designId, bgB64, photoB64, cx, cy);
  }

  doc.save("ID_Cards_Satyam_Stars.pdf");
}

// ── Bonafide Certificate: matches the school's real pre-printed form
// (BONAFIED.pdf) - plain black-on-white, both gender options shown with the
// wrong one struck through, filled-in blanks underlined. Two identical
// copies stacked on one A4 page, same as the physical original (cut apart:
// one copy for the requester, one for the school's file).
//
// Body content is 3 paragraphs of individual word/phrase tokens (not
// pre-broken lines) so it can be reflowed to actually fill the available
// width at whatever font size is in use - fixed hand-picked line breaks
// left random gaps on some lines and ran tight on others once the page
// layout/font size changed from the original small reference form.
function bonafideParagraphs(s) {
  const female = isFemale(s.gender);
  const { words: dobWords, dmy: dobDmy } = dobParts(s.dob);
  const cls = s.std || "—";
  const session = s.session || "2026-27";
  const opt = (text, chosen) => ({ text, mode: chosen ? "plain" : "strike" });
  const fill = (text) => ({ text: text || "—", mode: "underline" });
  const words = (text) => text.split(" ").map(t => ({ text: t, mode: "plain" }));
  const w = (text) => ({ text, mode: "plain" });

  return [
    [
      ...words("This is to certify that"),
      opt("Mr.", !female), w("/"), opt("Ms:", female),
      fill((s.name || "").toUpperCase()),
      ...words("is a bonafide student of this school. Studying in Std."),
      fill(cls),
      w("(Year"), fill(session + ")"),
    ],
    [
      opt("His", !female), w("/"), opt("Her", female),
      ...words("birthdate as recorded in the General Register of School is"),
      fill(dobWords),
      w(`(${dobDmy || "—"})`),
    ],
    [
      ...words("To the best of my knowledge"),
      opt("he", !female), w("/"), opt("she", female),
      ...words("bears a good moral character."),
    ],
  ];
}

// Greedily wraps space-separated tokens (each styled plain/strike/underline)
// into lines that fit maxWidth - pure layout, no drawing (drawWrappedLines
// does the actual drawing from these pre-computed lines).
function wrapParagraph(doc, tokens, maxWidth) {
  const spaceWidth = doc.getTextWidth(" ");
  const lines = [];
  let current = [];
  let cx = 0;
  for (const tok of tokens) {
    const tw = doc.getTextWidth(tok.text);
    if (current.length && cx + tw > maxWidth) { lines.push(current); current = []; cx = 0; }
    current.push({ ...tok, width: tw });
    cx += tw + spaceWidth;
  }
  if (current.length) lines.push(current);
  return lines;
}

// Draws pre-wrapped lines, justified (both left and right edges flush,
// except a paragraph's last line which stays ragged like normal printed
// text). Each line is still drawn as ONE continuous string in a single text
// call - real, natively-spaced text, not several separate text draws
// positioned edge to edge by hand (which is what caused words to render
// glued together with no visible gap between them, e.g. "PANIGRAHIis").
// Justification is done by inserting extra literal space characters into
// that same string (spread across the gaps between words) rather than by
// drawing each word separately with custom gaps, which would reintroduce
// the same glued-word risk. Strike/underline decorations are overlaid in a
// second pass using the exact same gap widths, so they line up with
// whatever the text actually rendered at.
function drawWrappedLines(doc, lines, x, startY, lineHeight, maxWidth) {
  const spaceWidth = doc.getTextWidth(" ");
  let y = startY;
  lines.forEach((line, lineIdx) => {
    const isLastLine = lineIdx === lines.length - 1;
    const numGaps = line.length - 1;
    const naturalWidth = line.reduce((sum, t) => sum + t.width, 0) + spaceWidth * numGaps;
    const slack = maxWidth - naturalWidth;

    const gapSpaces = new Array(Math.max(numGaps, 0)).fill(1);
    if (!isLastLine && numGaps > 0 && slack > 0) {
      const extra = Math.round(slack / spaceWidth);
      for (let i = 0; i < extra; i++) gapSpaces[i % numGaps]++;
    }

    let lineText = line[0]?.text ?? "";
    for (let i = 1; i < line.length; i++) lineText += " ".repeat(gapSpaces[i - 1]) + line[i].text;
    doc.text(lineText, x, y);

    let cx = x;
    line.forEach((tok, i) => {
      if (tok.mode === "strike" || tok.mode === "underline") {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(tok.mode === "strike" ? 0.3 : 0.25);
        const decoY = tok.mode === "strike" ? y - 1.6 : y + 1;
        doc.line(cx, decoY, cx + tok.width, decoY);
      }
      cx += tok.width + (i < numGaps ? gapSpaces[i] * spaceWidth : 0);
    });
    y += lineHeight;
  });
  return y;
}

// Full A4 portrait page, with the school address added to the header. Each
// student gets TWO identical pages (not two boxes squeezed onto one page) -
// print with the browser/OS print dialog's "Pages per sheet: 2" option to
// get both copies on one physical sheet, same as the original two-copies-
// per-print intent, without fighting a cramped hand-built layout for it.
//
// Content starts a modest fixed distance from the top of the frame and
// flows down - it does NOT fill or center within the whole page. Whatever
// space is left below the footer just stays blank, which is fine.
function drawBonafidePage(doc, s, logoB64) {
  const PW = 210, PH = 297; // A4 mm
  const marginX = 20;
  const [nr, ng, nb] = rgb("#1a2b6b");
  const [gr, gg, gb] = rgb("#f59e0b");

  // Double-line frame, like a real certificate border.
  doc.setDrawColor(nr, ng, nb);
  doc.setLineWidth(1);
  doc.rect(10, 10, PW - 20, PH - 20, "S");
  doc.setLineWidth(0.3);
  doc.rect(13, 13, PW - 26, PH - 26, "S");

  // Letterhead: logo top-left, text block starting at the SAME top Y to
  // its right, flowing straight down (name -> rule -> address) - not
  // trying to vertically center the text against the logo's midpoint,
  // which repeatedly ended up misaligned in practice. Top-anchoring both
  // to a shared Y is simpler and far more predictable: the logo is a
  // little taller than the text block and extends a bit past the rule,
  // same as the school's own reference letterhead.
  //
  // The logo file itself is 1080x1200px (not square) - forcing it into a
  // square box was squashing it. Fixed height, width derived from the
  // real aspect ratio so it isn't distorted either way.
  const logoY = 20, logoH = 46, logoW = logoH * (1080 / 1200);
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", marginX, logoY, logoW, logoH); } catch {}
  }
  const textX = marginX + logoW + 12;
  const nameMaxWidth = PW - marginX - textX;

  // Each line's font size is measured and shrunk to fit textX..PW-marginX
  // (same idea as before - never assume a fixed size will fit). Starting
  // sizes are deliberately large/generous (this is meant to be a dominant
  // letterhead title, not small body text) - the loop only ever shrinks,
  // so there's no risk of it overflowing into the margin.
  function fitFontSize(text, startSize, minSize, maxWidth = nameMaxWidth) {
    let size = startSize;
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxWidth) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    return size;
  }

  doc.setFont("times", "bold");
  const size1 = fitFontSize("SATYAM STARS", 40, 22);
  const size2 = fitFontSize("INTERNATIONAL SCHOOL", 24, 14);
  const baseline1 = logoY + 13;
  const baseline2 = baseline1 + 11;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(size1);
  doc.text("SATYAM STARS", textX, baseline1);
  const width1 = doc.getTextWidth("SATYAM STARS");
  doc.setFontSize(size2);
  doc.text("INTERNATIONAL SCHOOL", textX, baseline2);
  const width2 = doc.getTextWidth("INTERNATIONAL SCHOOL");

  // Rule spans exactly the text's own width (the wider of the two lines),
  // not out to the page margin - it should align with where the name
  // actually ends, not run on past it.
  const ruleY = baseline2 + 5;
  const nameWidth = Math.max(width1, width2);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.line(textX, ruleY, textX + nameWidth, ruleY);

  // Address and phone as two separate lines, not one combined line -
  // fills the gap under the rule instead of leaving it mostly blank. Both
  // are fit to nameWidth specifically (the rule's own span), not the wider
  // nameMaxWidth, so neither one ever runs past the rule/name.
  doc.setFont("helvetica", "normal");
  const addrLine = `${ADDR1}, Pandesara, Surat - 394210`;
  const phoneLine = `Ph: ${PHONE}`;
  fitFontSize(addrLine, 10, 7, nameWidth);
  doc.text(addrLine, textX, ruleY + 6);
  // Phone is centered under the rule's own span (textX..textX+nameWidth),
  // not left-aligned like the address.
  fitFontSize(phoneLine, 10, 7, nameWidth);
  doc.text(phoneLine, textX + nameWidth / 2, ruleY + 12, { align: "center" });

  // Gold divider before the title, plus the existing one after it - equal
  // whitespace gap on both sides of the text itself (not equal baseline
  // distances, which would leave uneven-looking gaps since the gap above
  // has to clear the text's cap-height while the gap below doesn't).
  // Also never sit above the logo's own bottom edge (with a small
  // clearance) - the logo is taller than the text block, so a rule
  // positioned purely from the text side can end up under the logo.
  const preTitleRuleY = Math.max(ruleY + 21, logoY + logoH + 4);
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.6);
  doc.line(marginX, preTitleRuleY, PW - marginX, preTitleRuleY);

  const titleFontSize = 30;
  const titleCapHeight = titleFontSize * 0.72 * 0.3528;
  const titleGap = 6;
  const titleY = preTitleRuleY + titleGap + titleCapHeight;
  doc.setTextColor(nr, ng, nb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontSize);
  doc.text("BONAFIDE CERTIFICATE", PW / 2, titleY, { align: "center" });
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.6);
  doc.line(marginX, titleY + titleGap, PW - marginX, titleY + titleGap);
  const headerRuleY = titleY + titleGap;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  const bodyFontSize = 13.5;
  doc.setFontSize(bodyFontSize);
  const lineHeight = 8.6;
  const paraGap = 6.5;
  const left = marginX + 5;
  const bodyWidth = PW - marginX * 2 - 10;
  const wrappedParas = bonafideParagraphs(s).map(p => wrapParagraph(doc, p, bodyWidth));

  let y = headerRuleY + 16;
  wrappedParas.forEach((lines, i) => {
    y = drawWrappedLines(doc, lines, left, y, lineHeight, bodyWidth);
    if (i < wrappedParas.length - 1) y += paraGap;
  });

  // y is now where the NEXT body line would start, i.e. one lineHeight past
  // the last line actually drawn - so +2.2 lineHeights here puts the footer
  // a clear 2-3 lines below the real last line of content.
  const footerY = Math.min(y + lineHeight * 2.2, PH - 25);
  doc.setFontSize(12);
  doc.text(`DATE : ${fmtIssueDateDMY()}`, marginX + 5, footerY);
  doc.setFont("helvetica", "bold");
  doc.text("PRINCIPAL", PW - marginX - 5, footerY, { align: "right" });
}

async function generateBonafidePDF(students, onProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoUrl = window.location.origin + "/school-logo.jpg";
  const logoB64 = await fetchBase64(logoUrl);

  let firstPage = true;
  for (let i = 0; i < students.length; i++) {
    onProgress && onProgress(i + 1, students.length);
    for (let copy = 0; copy < 2; copy++) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawBonafidePage(doc, students[i], logoB64);
    }
  }
  doc.save("Bonafide_Certificates_Satyam_Stars.pdf");
}

// ── Marksheet: full A4 page per student ────────────────────────────────────────
// sheet comes from marksheetService.getMarksheetsForClass() - subjects/marks
// pulled live from the mobile app's exams/exam_marks tables (see that file
// for the matching rules and grading scale). sheet is null if the student's
// class has no subjects configured yet in Settings → Subjects.
function drawMarksheetPage(doc, s, sheet, logoB64, autoTable) {
  const PW = 210, PH = 297; // A4 mm
  const marginX = 15;

  doc.setDrawColor(...rgb("#1a2b6b"));
  doc.setLineWidth(1);
  doc.rect(10, 10, PW - 20, PH - 20, "S");
  doc.setLineWidth(0.3);
  doc.rect(13, 13, PW - 26, PH - 26, "S");

  // Letterhead
  const logoY = 18, logoH = 24, logoW = logoH * (1080 / 1200);
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", marginX, logoY, logoW, logoH); } catch {}
  }
  const textX = marginX + logoW + 8;
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...rgb("#1a2b6b"));
  doc.text("SATYAM STARS INTERNATIONAL SCHOOL", textX, logoY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${ADDR1}, Pandesara, Surat - 394210  ·  Ph: ${PHONE}`, textX, logoY + 16);

  const titleY = logoY + logoH + 8;
  doc.setDrawColor(...rgb("#f59e0b"));
  doc.setLineWidth(0.6);
  doc.line(marginX, titleY - 5, PW - marginX, titleY - 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...rgb("#1a2b6b"));
  doc.text("ANNUAL MARKSHEET", PW / 2, titleY + 2, { align: "center" });
  doc.line(marginX, titleY + 5, PW - marginX, titleY + 5);

  // Student info block
  const infoY = titleY + 15;
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  const infoLeft = [
    ["Name", s.name],
    ["Class", `${s.std}${s.section ? " - " + s.section : ""}`],
    ["Roll No.", s.rollNo || "—"],
  ];
  const infoRight = [
    ["Session", s.session || "—"],
    ["DOB", fmtDMY(s.dob) || "—"],
  ];
  infoLeft.forEach(([label, val], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginX, infoY + i * 7);
    doc.setFont("helvetica", "normal");
    doc.text(String(val || "—"), marginX + 28, infoY + i * 7);
  });
  infoRight.forEach(([label, val], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, PW / 2 + 5, infoY + i * 7);
    doc.setFont("helvetica", "normal");
    doc.text(String(val || "—"), PW / 2 + 30, infoY + i * 7);
  });

  let y = infoY + infoLeft.length * 7 + 8;

  if (!sheet || sheet.subjectRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("No subjects configured for this class yet — add them in Settings → Subjects.", marginX, y);
    return;
  }

  // Subjects grid
  autoTable(doc, {
    startY: y,
    head: [["Subject", ...EXAM_TYPES, "Total", "Obtained", "Grade"]],
    body: sheet.subjectRows.map(row => [
      row.subject,
      `${row.marks[0].obtained}/${row.marks[0].max}`,
      `${row.marks[1].obtained}/${row.marks[1].max}`,
      `${row.marks[2].obtained}/${row.marks[2].max}`,
      row.total,
      row.obtained,
      row.grade,
    ]),
    margin: { left: marginX, right: marginX },
    headStyles: { fillColor: rgb("#1a2b6b"), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, halign: "center" },
    bodyStyles: { fontSize: 8.5, halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = doc.lastAutoTable.finalY + 5;

  autoTable(doc, {
    startY: y,
    body: [["Total Marks", String(sheet.totalMax), String(sheet.totalObtained)]],
    theme: "grid",
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left" } },
  });
  y = doc.lastAutoTable.finalY + 8;

  autoTable(doc, {
    startY: y,
    head: [["Result", "Percentage", "Rank", "Grade", "Present Days"]],
    body: [[
      sheet.result,
      `${sheet.percentage.toFixed(2)}%`,
      String(sheet.rank),
      sheet.grade,
      `${sheet.present} / ${sheet.totalDays}`,
    ]],
    margin: { left: marginX, right: marginX },
    headStyles: { fillColor: [100, 100, 100], textColor: [255, 255, 255], fontSize: 8.5, halign: "center" },
    bodyStyles: { fontSize: 9.5, fontStyle: "bold", halign: "center" },
  });
  y = doc.lastAutoTable.finalY + 22;

  // Signatures
  const sigY = Math.min(y, PH - 28);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.line(marginX, sigY, marginX + 50, sigY);
  doc.text("Class Teacher's Sign.", marginX, sigY + 5);
  doc.line(PW - marginX - 50, sigY, PW - marginX, sigY);
  doc.text("Principal's Sign.", PW - marginX - 50, sigY + 5);
}

async function generateMarksheetPDF(targetStudents, allStudents, onProgress) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoUrl = window.location.origin + "/school-logo.jpg";
  const logoB64 = await fetchBase64(logoUrl);

  // Group by class so each class's full roster (needed for Rank) is only
  // fetched/computed once, even when several selected students share a class.
  const classGroups = {};
  targetStudents.forEach(s => {
    if (!classGroups[s.std]) classGroups[s.std] = [];
    classGroups[s.std].push(s);
  });
  const sheetByStudentId = {};
  for (const className of Object.keys(classGroups)) {
    const classmates = allStudents.filter(s => s.std === className);
    const sheets = await getMarksheetsForClass(classmates, className);
    sheets.forEach(sh => { sheetByStudentId[sh.studentId] = sh; });
  }

  for (let i = 0; i < targetStudents.length; i++) {
    const s = targetStudents[i];
    onProgress && onProgress(i + 1, targetStudents.length);
    if (i > 0) doc.addPage();
    drawMarksheetPage(doc, s, sheetByStudentId[s._studentId], logoB64, autoTable);
  }
  doc.save("Marksheets_Satyam_Stars.pdf");
}

// ── Marksheet: live preview (React, matches jsPDF output) ──────────────────────
function MarksheetPreview({ student, sheet, logoUrl, loading }) {
  const s = student || {};

  if (loading) {
    return (
      <div style={{ width: 280, aspectRatio: "210/297", display: "flex", alignItems: "center", justifyContent: "center", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", flexShrink: 0 }}>
        <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ width: 280, aspectRatio: "210/297", fontFamily: "Arial,Helvetica,sans-serif", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 7, border: "1.4px solid #1a2b6b" }} />
      <div style={{ position: "absolute", inset: 9, border: "0.5px solid #1a2b6b" }} />

      <div style={{ padding: "20px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 34, height: 34, flexShrink: 0 }}>
            {logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} /> : null}
          </div>
          <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, fontSize: 10.5, lineHeight: 1.15 }}>
            SATYAM STARS INTERNATIONAL SCHOOL
          </div>
        </div>
        <div style={{ borderTop: "1px solid #f59e0b", margin: "8px 0 6px" }} />
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#1a2b6b", margin: "2px 0 6px" }}>ANNUAL MARKSHEET</div>
        <div style={{ borderTop: "1px solid #f59e0b", margin: "0 0 8px" }} />

        <div style={{ fontSize: 8, lineHeight: 1.7, marginBottom: 8 }}>
          <div><b>Name:</b> {s.name}</div>
          <div>
            <b>Class:</b> {s.std}{s.section ? ` - ${s.section}` : ""} &nbsp;
            <b>Roll:</b> {s.rollNo || "—"} &nbsp;
            <b>Session:</b> {s.session || "—"}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 6.5 }}>
          <thead>
            <tr style={{ background: "#1a2b6b", color: "white" }}>
              <th style={{ padding: "3px 2px", textAlign: "left" }}>Subject</th>
              <th style={{ padding: "3px 2px" }}>Unit</th>
              <th style={{ padding: "3px 2px" }}>Half Yr</th>
              <th style={{ padding: "3px 2px" }}>Annual</th>
              <th style={{ padding: "3px 2px" }}>Total</th>
              <th style={{ padding: "3px 2px" }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {(sheet?.subjectRows || []).map((row, i) => (
              <tr key={row.subject} style={{ background: i % 2 ? "#f8fafc" : "white" }}>
                <td style={{ padding: "2.5px 2px", fontWeight: 700 }}>{row.subject}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.marks[0].obtained}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.marks[1].obtained}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.marks[2].obtained}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.obtained}/{row.total}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center", fontWeight: 700 }}>{row.grade}</td>
              </tr>
            ))}
            {(!sheet || sheet.subjectRows.length === 0) && (
              <tr><td colSpan={6} style={{ padding: 8, textAlign: "center", color: "#94a3b8", fontSize: 6.5 }}>
                No subjects configured for this class yet — add them in Settings → Subjects.
              </td></tr>
            )}
          </tbody>
        </table>

        {sheet && sheet.subjectRows.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 6.5, marginTop: 8, fontWeight: 700 }}>
            <span>{sheet.result}</span>
            <span>{sheet.percentage.toFixed(1)}%</span>
            <span>Rank {sheet.rank}</span>
            <span>{sheet.grade}</span>
            <span>{sheet.present}/{sheet.totalDays} days</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bonafide Certificate: live preview (React, matches jsPDF output) ──────────
// Shows one full page - the second printed page is identical.
function BonafidePreview({ student, logoUrl }) {
  const s = student || {};
  const paragraphs = bonafideParagraphs(s);
  const segStyle = (mode) => mode === "strike"
    ? { textDecoration: "line-through" }
    : mode === "underline"
      ? { textDecoration: "underline" }
      : undefined;

  return (
    <div style={{ width: 280, aspectRatio: "210/297", fontFamily: "Arial,Helvetica,sans-serif", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", flexShrink: 0, position: "relative" }}>
      <div style={{ position: "absolute", inset: 7, border: "1.4px solid #1a2b6b" }} />
      <div style={{ position: "absolute", inset: 9, border: "0.5px solid #1a2b6b" }} />

      {/* Content starts a fixed distance from the top and flows down - it
          isn't centered/stretched to fill the page; leftover space at the
          bottom is fine, matching drawBonafidePage(). */}
      <div style={{ padding: "22px 22px 0" }}>
        {/* Letterhead matches the school's own reference (Header.png):
            logo, then "SATYAM STARS" / "INTERNATIONAL SCHOOL" as two big
            serif lines, a black rule under them, then the address
            left-aligned at the same X as the name (not centered). */}
        {/* Top-anchored, not centered: logo and text block both start at
            the same top Y and flow straight down. Simpler and far more
            predictable than trying to vertically center the text against
            the logo's midpoint, which kept coming out misaligned. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 56, height: 56, flexShrink: 0 }}>
            {logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => e.target.style.display = "none"} /> : null}
          </div>
          {/* width: fit-content so the rule/address below shrink-wrap to
              the text's own widest line (matches drawBonafidePage()'s rule
              spanning textX..textX+nameWidth, not out to the page margin). */}
          <div style={{ width: "fit-content", maxWidth: "100%" }}>
            <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, fontSize: 23, lineHeight: 1.05, whiteSpace: "nowrap" }}>SATYAM STARS</div>
            <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, fontSize: 14, lineHeight: 1.1, marginTop: 2, whiteSpace: "nowrap" }}>INTERNATIONAL SCHOOL</div>
            <div style={{ borderTop: "1px solid black", margin: "5px 0 4px" }} />
            <div style={{ fontSize: 6.5, whiteSpace: "nowrap" }}>{ADDR1}, Pandesara, Surat - 394210</div>
            <div style={{ fontSize: 6.5, whiteSpace: "nowrap", textAlign: "center" }}>Ph: {PHONE}</div>
          </div>
        </div>

        {/* Gold divider before the title, plus the existing one after it -
            matches the two gold rules framing "BONAFIDE CERTIFICATE" on
            the PDF side. This one spans the full width (like the PDF's
            marginX..PW-marginX), unlike the black rule above which is
            indented to start under the name, not the logo. */}
        <div style={{ borderTop: "1px solid #f59e0b", margin: "8px 0 0" }} />
        <div style={{ textAlign: "center", margin: "10px 0" }}>
          <div style={{ fontWeight: 900, fontSize: 19, color: "#1a2b6b" }}>BONAFIDE CERTIFICATE</div>
        </div>
        <div style={{ borderTop: "1px solid #f59e0b", margin: "0 0 12px" }} />

        {/* Justified (both edges flush) except each paragraph's last line,
            matching drawWrappedLines() on the PDF side - the browser's own
            justify engine does the same job that function does manually. */}
        <div style={{ fontSize: 8, lineHeight: 1.85, color: "#111", textAlign: "justify" }}>
          {paragraphs.map((para, i) => (
            <p key={i} style={{ margin: "0 0 7px" }}>
              {para.map((seg, j) => <span key={j} style={segStyle(seg.mode)}>{seg.text} </span>)}
            </p>
          ))}
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", fontSize: 8.5 }}>
          <span>DATE : {fmtIssueDateDMY()}</span>
          <span style={{ fontWeight: 800 }}>PRINCIPAL</span>
        </div>
      </div>
    </div>
  );
}

// ── Live card preview (React component, matches jsPDF output) ─────────────────
// Both previews use the real "SCHOOL ID CARD *.jpg" Canva exports as a
// full-bleed background image, at their exact pixel aspect ratio, so the
// on-screen preview is pixel-identical to the actual template - only the
// photo/name/values are overlaid, mirroring the PDF drawing functions above.
function CardPreviewDesign1({ student }) {
  const s = student || {};
  const infoRows = [
    { val: s.fatherName || "—" },
    { val: s.motherName || "—" },
    { val: fmtDMY(s.dob) || "—" },
    { val: s.mobile || s.mobile1 || "—" },
  ];
  const W = 270, H = 459; // 591:1004 aspect ratio

  return (
    <div style={{ width:W, height:H, fontFamily:"Arial,Helvetica,sans-serif", position:"relative", overflow:"hidden", borderRadius:9, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", flexShrink:0 }}>
      <img src="/id-card-bg-1.jpg" alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }}/>

      {/* Photo (inside the template's gold ring) */}
      <div style={{ position:"absolute", top:73.3, left:85.1, width:100.4, height:100.4, borderRadius:"50%", overflow:"hidden", background:"#e5e7eb" }}>
        {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div style={{ width:"100%", height:"100%", background:"#d1d5db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, color:"#9ca3af" }}>👤</div>}
      </div>

      {/* Name (over the red pill) */}
      <div style={{ position:"absolute", top:195.3, left:29.7, width:209.3, height:19.7, borderRadius:9.9, background:CARD_RED, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"white", fontSize:13, fontWeight:900, letterSpacing:0.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", padding:"0 10px" }}>{(s.name||"Student Name").toUpperCase()}</span>
      </div>

      {/* Info row values (labels are already printed on the template) */}
      <div style={{ position:"absolute", top:230, left:139, width:122, background:"white" }}>
        {infoRows.map((row, i) => (
          <div key={i} style={{ height:17.1, display:"flex", alignItems:"center", fontSize:10.5, color:"#1f2937", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>: {row.val}</div>
        ))}
        <div style={{ minHeight:51, fontSize:10.5, color:"#1f2937", lineHeight:"17.1px" }}>: {fmtAddr(s) || "—"}</div>
      </div>
    </div>
  );
}

// Landscape CR80-style preview matching "SCHOOL ID CARD 2.jpg".
function CardPreviewDesign2({ student }) {
  const s = student || {};
  const infoRows = [
    { val: s.fatherName || "—" },
    { val: s.motherName || "—" },
    { val: fmtDMY(s.dob) || "—" },
    { val: s.mobile || s.mobile1 || "—" },
  ];
  const W = 400, H = 253; // 1011:639 aspect ratio

  return (
    <div style={{ width:W, height:H, fontFamily:"Arial,Helvetica,sans-serif", position:"relative", overflow:"hidden", borderRadius:8, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", flexShrink:0 }}>
      <img src="/id-card-bg-2.jpg" alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }}/>

      {/* Photo (inside the template's pale-blue box) */}
      <div style={{ position:"absolute", top:78.4, left:15.8, width:83.9, height:104.1, overflow:"hidden", background:"#e5e7eb" }}>
        {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div style={{ width:"100%", height:"100%", background:"#d1d5db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, color:"#9ca3af" }}>👤</div>}
      </div>

      {/* Name + Class (redraw navy, same as the template) */}
      <div style={{ position:"absolute", top:79.2, left:98.9, width:184.4, height:30.5, background:CARD_NAVY, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"white", fontSize:16, fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", padding:"0 8px" }}>{(s.name||"Student Name").toUpperCase()}</span>
      </div>
      <div style={{ position:"absolute", top:79.2, left:283.3, width:56.6, height:30.5, background:CARD_NAVY, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"white", fontSize:14, fontWeight:900 }}>{(s.std||"—").toUpperCase()}</span>
      </div>

      {/* Info row values (labels are already printed on the template) */}
      <div style={{ position:"absolute", top:114, left:174.1, width:212.1, background:"#f5f5f5" }}>
        {infoRows.map((row, i) => (
          <div key={i} style={{ height:14.3, display:"flex", alignItems:"center", fontSize:11, color:"#1f2937", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>: {row.val}</div>
        ))}
        <div style={{ minHeight:28.6, fontSize:11, color:"#1f2937", lineHeight:"14.3px" }}>: {fmtAddr(s) || "—"}</div>
      </div>
    </div>
  );
}

function CardPreview({ student, designId }) {
  return designId === 2
    ? <CardPreviewDesign2 student={student}/>
    : <CardPreviewDesign1 student={student}/>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [activeTab, setActiveTab]     = useState("idcard");
  const [students, setStudents]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState(new Set());
  const [designId, setDesignId]       = useState(1);
  const [generating, setGenerating]   = useState(false);
  const [progress, setProgress]       = useState({ done:0, total:0 });
  const [previewIdx, setPreviewIdx]   = useState(0);
  const [logoUrl, setLogoUrl]         = useState("");
  const [marksheetSheet, setMarksheetSheet]     = useState(null);
  const [marksheetLoading, setMarksheetLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStudents().then(d => setStudents(d||[])).catch(()=>{}).finally(()=>setLoading(false));
    setLogoUrl(window.location.origin + "/school-logo.jpg");
  }, []);

  const filtered = students.filter(s => {
    if (classFilter !== "All" && s.std !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.name||"").toLowerCase().includes(q) ||
             (s.enrollment||"").toLowerCase().includes(q) ||
             (s.fatherName||"").toLowerCase().includes(q);
    }
    return true;
  });

  const selectedStudents = students.filter(s => selected.has(s.enrollment));
  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.enrollment));
  const previewStudent = selectedStudents[previewIdx] || filtered[0] || null;

  // Marksheet data is pulled live from Supabase (exams/exam_marks), unlike
  // the ID Card/Bonafide previews which are pure transforms of the already-
  // loaded student list - Rank also needs the previewed student's whole
  // class, not just the ones selected, so this always fetches from `students`
  // (the full roster), not `selectedStudents`.
  useEffect(() => {
    if (activeTab !== "marksheet" || !previewStudent) { setMarksheetSheet(null); return; }
    let cancelled = false;
    setMarksheetLoading(true);
    const classmates = students.filter(s => s.std === previewStudent.std);
    getMarksheetsForClass(classmates, previewStudent.std)
      .then(sheets => {
        if (cancelled) return;
        setMarksheetSheet(sheets.find(sh => sh.studentId === previewStudent._studentId) || null);
      })
      .catch(() => { if (!cancelled) setMarksheetSheet(null); })
      .finally(() => { if (!cancelled) setMarksheetLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, previewStudent, students]);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach(s => next.delete(s.enrollment));
      else filtered.forEach(s => next.add(s.enrollment));
      return next;
    });
  }, [filtered, allSelected]);

  const toggleOne = useCallback((enr) => {
    setSelected(prev => { const n = new Set(prev); n.has(enr)?n.delete(enr):n.add(enr); return n; });
  }, []);

  const handleDownload = useCallback(async () => {
    const targets = selectedStudents;
    if (!targets.length) { alert("Please select at least one student."); return; }
    setGenerating(true);
    setProgress({ done:0, total:targets.length });
    try {
      await generatePDF(targets, designId, (done, total) => setProgress({ done, total }));
    } catch(e) {
      alert("PDF generation failed: " + e.message);
    } finally {
      setGenerating(false);
      setProgress({ done:0, total:0 });
    }
  }, [selectedStudents, designId]);

  const handleDownloadBonafide = useCallback(async () => {
    const targets = selectedStudents;
    if (!targets.length) { alert("Please select at least one student."); return; }
    setGenerating(true);
    setProgress({ done:0, total:targets.length });
    try {
      await generateBonafidePDF(targets, (done, total) => setProgress({ done, total }));
    } catch(e) {
      alert("PDF generation failed: " + e.message);
    } finally {
      setGenerating(false);
      setProgress({ done:0, total:0 });
    }
  }, [selectedStudents]);

  const handleDownloadMarksheet = useCallback(async () => {
    const targets = selectedStudents;
    if (!targets.length) { alert("Please select at least one student."); return; }
    setGenerating(true);
    setProgress({ done:0, total:targets.length });
    try {
      await generateMarksheetPDF(targets, students, (done, total) => setProgress({ done, total }));
    } catch(e) {
      alert("PDF generation failed: " + e.message);
    } finally {
      setGenerating(false);
      setProgress({ done:0, total:0 });
    }
  }, [selectedStudents, students]);

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate ID cards, certificates and official documents</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {SUB_TABS.map(({ key, label, icon:Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab===key?"border-school-navy text-school-navy":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {(activeTab === "noc" || activeTab === "tc") && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300"/>
          <p className="text-gray-500 font-medium">Coming Soon</p>
          {activeTab === "tc" && (
            <p className="text-xs text-gray-400 -mt-2">
              Transfer Certificates are generated per-student from each student's profile page in the meantime.
            </p>
          )}
        </div>
      )}

      {activeTab === "idcard" && (
        <div className="flex flex-col gap-5">

          {/* Design picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-school-navy"/> Select Card Design
            </h2>
            <div className="flex gap-3 flex-wrap">
              {CARD_DESIGNS.map(d => (
                <button key={d.id} onClick={() => setDesignId(d.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${designId===d.id?"border-school-navy shadow-md bg-school-navy/5":"border-gray-200 hover:border-gray-300"}`}>
                  <div style={{
                    width: d.id===2 ? 56 : 36, height: d.id===2 ? 36 : 56,
                    borderRadius:4, background: CARD_NAVY, boxShadow:"0 2px 6px rgba(0,0,0,0.25)",
                  }}/>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-gray-700">{d.name}</div>
                    <div className="text-[10px] text-gray-400">{d.desc}</div>
                  </div>
                  {designId===d.id && <div className="w-2 h-2 rounded-full bg-school-navy flex-shrink-0"/>}
                </button>
              ))}
            </div>
          </div>

          {/* Main content: list + preview */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* Student list */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" placeholder="Search by name, enrollment, father..." value={search}
                    onChange={e=>setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy"/>
                  {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5"/></button>}
                </div>
                <select value={classFilter} onChange={e=>{setClassFilter(e.target.value);setSelected(new Set());}}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-32">
                  <option value="All">All Classes</option>
                  {CLASSES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap">
                  <Users className="w-4 h-4"/>{filtered.length}
                </span>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-school-navy"/>
                    Select all {filtered.length}
                  </label>
                  {selected.size > 0 && <span className="text-xs text-school-navy font-semibold bg-school-navy/10 px-2.5 py-1 rounded-full">{selected.size} selected</span>}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin"/>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <GraduationCap className="w-10 h-10 text-gray-200"/>
                    <p className="text-sm text-gray-400">No students found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(s => {
                        const isSel = selected.has(s.enrollment);
                        return (
                          <tr key={s.enrollment} onClick={()=>{ toggleOne(s.enrollment); setPreviewIdx(0); }}
                            className={`cursor-pointer transition-colors ${isSel?"bg-school-navy/5":"hover:bg-gray-50"}`}>
                            <td className="px-4 py-2.5 w-10">
                              <input type="checkbox" checked={isSel} onChange={()=>{}} className="w-4 h-4 accent-school-navy"/>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                  {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400"/></div>}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                                  <div className="text-xs text-gray-400">{s.std}{s.section?" - "+s.section:""}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs hidden md:table-cell">{s.fatherName||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Live preview panel */}
            <div className="lg:w-80 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-4">
              <div className="text-sm font-semibold text-gray-700 self-start">Live Preview</div>

              {previewStudent ? (
                <>
                  <CardPreview student={previewStudent} designId={designId}/>
                  {selectedStudents.length > 1 && (
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <button onClick={()=>setPreviewIdx(i=>Math.max(0,i-1))} disabled={previewIdx===0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4"/>
                      </button>
                      <span>{previewIdx+1} / {selectedStudents.length}</span>
                      <button onClick={()=>setPreviewIdx(i=>Math.min(selectedStudents.length-1,i+1))} disabled={previewIdx===selectedStudents.length-1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-300">
                  <CreditCard className="w-16 h-16"/>
                  <p className="text-sm text-gray-400">Select a student to preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-school-navy"/>
              <span className="text-sm text-gray-600">
                <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size!==1?"s":""} selected
              </span>
              {selected.size > 0 && <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>}
            </div>

            {generating ? (
              <div className="flex items-center gap-3 bg-school-navy/5 px-5 py-2.5 rounded-lg">
                <div className="w-4 h-4 border-2 border-school-navy/30 border-t-school-navy rounded-full animate-spin"/>
                <span className="text-sm text-school-navy font-medium">
                  Generating {progress.done}/{progress.total} cards...
                </span>
              </div>
            ) : (
              <button onClick={handleDownload} disabled={selected.size===0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                <Download className="w-4 h-4"/>
                Download PDF ({selected.size} cards)
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            PDF downloads directly — 4 cards per A4 page (90mm × 140mm). Select students above then click Download PDF.
          </p>
        </div>
      )}

      {activeTab === "marksheet" && (
        <div className="flex flex-col gap-5">

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            Marks are pulled live from the mobile app — an exam only shows up here if it's named exactly
            {" "}{EXAM_TYPES.map((t, i) => <b key={t}>{i > 0 ? " / " : " "}&quot;{t}&quot;</b>)}{" "}
            (case-insensitive). Subjects come from Settings → Subjects — configure a class there first if it shows no subjects below.
          </div>

          {/* Main content: list + preview */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* Student list */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" placeholder="Search by name, enrollment, father..." value={search}
                    onChange={e=>setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy"/>
                  {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5"/></button>}
                </div>
                <select value={classFilter} onChange={e=>{setClassFilter(e.target.value);setSelected(new Set());}}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-32">
                  <option value="All">All Classes</option>
                  {CLASSES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap">
                  <Users className="w-4 h-4"/>{filtered.length}
                </span>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-school-navy"/>
                    Select all {filtered.length}
                  </label>
                  {selected.size > 0 && <span className="text-xs text-school-navy font-semibold bg-school-navy/10 px-2.5 py-1 rounded-full">{selected.size} selected</span>}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin"/>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <GraduationCap className="w-10 h-10 text-gray-200"/>
                    <p className="text-sm text-gray-400">No students found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(s => {
                        const isSel = selected.has(s.enrollment);
                        return (
                          <tr key={s.enrollment} onClick={()=>{ toggleOne(s.enrollment); setPreviewIdx(0); }}
                            className={`cursor-pointer transition-colors ${isSel?"bg-school-navy/5":"hover:bg-gray-50"}`}>
                            <td className="px-4 py-2.5 w-10">
                              <input type="checkbox" checked={isSel} onChange={()=>{}} className="w-4 h-4 accent-school-navy"/>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                  {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400"/></div>}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                                  <div className="text-xs text-gray-400">{s.std}{s.section?" - "+s.section:""}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs hidden md:table-cell">{s.fatherName||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Live preview panel */}
            <div className="lg:w-80 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-4">
              <div className="text-sm font-semibold text-gray-700 self-start">Live Preview</div>

              {previewStudent ? (
                <>
                  <MarksheetPreview student={previewStudent} sheet={marksheetSheet} logoUrl={logoUrl} loading={marksheetLoading}/>
                  {selectedStudents.length > 1 && (
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <button onClick={()=>setPreviewIdx(i=>Math.max(0,i-1))} disabled={previewIdx===0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4"/>
                      </button>
                      <span>{previewIdx+1} / {selectedStudents.length}</span>
                      <button onClick={()=>setPreviewIdx(i=>Math.min(selectedStudents.length-1,i+1))} disabled={previewIdx===selectedStudents.length-1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-300">
                  <Award className="w-16 h-16"/>
                  <p className="text-sm text-gray-400">Select a student to preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-school-navy"/>
              <span className="text-sm text-gray-600">
                <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size!==1?"s":""} selected
              </span>
              {selected.size > 0 && <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>}
            </div>

            {generating ? (
              <div className="flex items-center gap-3 bg-school-navy/5 px-5 py-2.5 rounded-lg">
                <div className="w-4 h-4 border-2 border-school-navy/30 border-t-school-navy rounded-full animate-spin"/>
                <span className="text-sm text-school-navy font-medium">
                  Generating {progress.done}/{progress.total} marksheets...
                </span>
              </div>
            ) : (
              <button onClick={handleDownloadMarksheet} disabled={selected.size===0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                <Download className="w-4 h-4"/>
                Download PDF ({selected.size} marksheet{selected.size!==1?"s":""})
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            One full A4 page per student. Rank is computed against the student&apos;s whole class, not just the students selected here.
          </p>
        </div>
      )}

      {activeTab === "bonafide" && (
        <div className="flex flex-col gap-5">

          {/* Main content: list + preview */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* Student list */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                  <input type="text" placeholder="Search by name, enrollment, father..." value={search}
                    onChange={e=>setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy"/>
                  {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5"/></button>}
                </div>
                <select value={classFilter} onChange={e=>{setClassFilter(e.target.value);setSelected(new Set());}}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-32">
                  <option value="All">All Classes</option>
                  {CLASSES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <span className="flex items-center gap-1.5 text-sm text-gray-500 whitespace-nowrap">
                  <Users className="w-4 h-4"/>{filtered.length}
                </span>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-school-navy"/>
                    Select all {filtered.length}
                  </label>
                  {selected.size > 0 && <span className="text-xs text-school-navy font-semibold bg-school-navy/10 px-2.5 py-1 rounded-full">{selected.size} selected</span>}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-40 gap-3">
                    <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin"/>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <GraduationCap className="w-10 h-10 text-gray-200"/>
                    <p className="text-sm text-gray-400">No students found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map(s => {
                        const isSel = selected.has(s.enrollment);
                        return (
                          <tr key={s.enrollment} onClick={()=>{ toggleOne(s.enrollment); setPreviewIdx(0); }}
                            className={`cursor-pointer transition-colors ${isSel?"bg-school-navy/5":"hover:bg-gray-50"}`}>
                            <td className="px-4 py-2.5 w-10">
                              <input type="checkbox" checked={isSel} onChange={()=>{}} className="w-4 h-4 accent-school-navy"/>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                  {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400"/></div>}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-800 text-sm">{s.name}</div>
                                  <div className="text-xs text-gray-400">{s.std}{s.section?" - "+s.section:""}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs hidden md:table-cell">{s.fatherName||"—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Live preview panel */}
            <div className="lg:w-80 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-4">
              <div className="text-sm font-semibold text-gray-700 self-start">Live Preview</div>

              {previewStudent ? (
                <>
                  <BonafidePreview student={previewStudent} logoUrl={logoUrl}/>
                  {selectedStudents.length > 1 && (
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <button onClick={()=>setPreviewIdx(i=>Math.max(0,i-1))} disabled={previewIdx===0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4"/>
                      </button>
                      <span>{previewIdx+1} / {selectedStudents.length}</span>
                      <button onClick={()=>setPreviewIdx(i=>Math.min(selectedStudents.length-1,i+1))} disabled={previewIdx===selectedStudents.length-1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-300">
                  <FileText className="w-16 h-16"/>
                  <p className="text-sm text-gray-400">Select a student to preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-school-navy"/>
              <span className="text-sm text-gray-600">
                <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size!==1?"s":""} selected
              </span>
              {selected.size > 0 && <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>}
            </div>

            {generating ? (
              <div className="flex items-center gap-3 bg-school-navy/5 px-5 py-2.5 rounded-lg">
                <div className="w-4 h-4 border-2 border-school-navy/30 border-t-school-navy rounded-full animate-spin"/>
                <span className="text-sm text-school-navy font-medium">
                  Generating {progress.done}/{progress.total} certificates...
                </span>
              </div>
            ) : (
              <button onClick={handleDownloadBonafide} disabled={selected.size===0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                <Download className="w-4 h-4"/>
                Download PDF ({selected.size * 2} pages, {selected.size} student{selected.size!==1?"s":""})
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            Each student gets 2 identical A4 pages — print with &quot;Pages per sheet: 2&quot; in your print dialog to get both copies on one physical sheet.
          </p>
        </div>
      )}
    </div>
  );
}
