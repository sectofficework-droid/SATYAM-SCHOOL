"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { getStudents } from "@/lib/studentService";
import { getS3ViewUrl } from "@/lib/s3Upload";
import { fmtDMY, toIsoDateLocal } from "@/lib/utils";
import { normalizeDate } from "@/lib/importUtils";
import { getMarksheetsForClass, getSingleExamMarksheet, getCurrentOfficialExams } from "@/lib/marksheetService";
import { isExamUnlocked } from "@/lib/examService";
import S3Image from "@/components/S3Image";
import * as XLSX from "xlsx";
import {
  CreditCard, Award, FileText, Search, Download, FileSpreadsheet,
  Users, GraduationCap, X, CheckSquare, ChevronLeft, ChevronRight,
  Upload, AlertCircle, Printer, Trash2
} from "lucide-react";

import {
  TC_FIELDS,
  TC_SAMPLE_ROW,
  TC_STYLES,
  downloadTcTemplate,
  parseTcFile,
  studentToTcRow,
  generateSchoolLeavingCertificateHTML,
  generateSchoolLeavingCertificateSingle,
  generateSchoolLeavingCertificateSheet,
} from "@/lib/tcGenerator";

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

// Two fixed ID card designs:
// Design 1: Satyam Stars Official Portrait (matches "id card protrait template.png")
// Design 2: Trust Landscape CR80 card
const CARD_NAVY   = "#00296b";
const CARD_ORANGE = "#ff751f";
const CARD_RED    = "#dc2626";

const CARD_DESIGNS = [
  { id:1, name:"Portrait Card",    desc:"Satyam Stars Official Portrait (2026-27)" },
  { id:2, name:"Trust Landscape",  desc:"CR80 card, navy header/footer"  },
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

// ── Make rounded-rect PNG using canvas (design 2's photo box) ─────────────────
// `ratio` is the destination box's width/height (e.g. CARD2_PHOTO_W/CARD2_PHOTO_H)
// - the canvas is built at that same aspect ratio so jsPDF's addImage(bx,by,bw,bh)
// never has to stretch a square crop into a non-square box (that stretch used to
// squish every student's photo horizontally on Design 2's printed card, since the
// canvas here was previously hardcoded to a 400x400 square regardless of the
// destination box's shape).
async function roundedSquareBase64(url, { radiusFrac = 0.08, ratio = 1 } = {}) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const BASE = 400;
      const SW = ratio >= 1 ? BASE : Math.round(BASE * ratio);
      const SH = ratio >= 1 ? Math.round(BASE / ratio) : BASE;
      const canvas = document.createElement("canvas");
      canvas.width = SW; canvas.height = SH;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        const r = Math.min(SW, SH) * radiusFrac;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.arcTo(SW, 0, SW, SH, r);
        ctx.arcTo(SW, SH, 0, SH, r);
        ctx.arcTo(0, SH, 0, 0, r);
        ctx.arcTo(0, 0, SW, 0, r);
        ctx.closePath();
        ctx.clip();
        const sc = Math.max(SW/img.width, SH/img.height);
        ctx.drawImage(img, (SW - img.width*sc)/2, (SH - img.height*sc)/2, img.width*sc, img.height*sc);
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

// Shrinks the current font (assumes setFont/family already set) until `text`
// fits `maxWidth`, instead of overflowing it - needed for the class box,
// whose content ranges from "6TH" to "11TH - COMMERCE" (see CLASSES_LIST)
// at one fixed box width.
function fitFontSize(doc, text, maxWidth, startSize, minSize = 4.5) {
  let size = startSize;
  doc.setFontSize(size);
  while (doc.getTextWidth(text) > maxWidth && size > minSize) {
    size -= 0.3;
    doc.setFontSize(size);
  }
  return size;
}

// Design 1 matches "id card protrait template.png" (685x1157px, so the card is drawn
// at 80mm x 135.1mm on A4 portrait, 4 cards per page). The official template
// (/id-card-portrait-template.png) includes the school header, logo, orange frame border,
// signature, and footer. Only dynamic values (photo, student name, class pill, and info
// fields) are rendered on top, matching the template layout.
const CARD1_W = 80, CARD1_H = 135.1; // 685:1157 aspect ratio
const CARD1_PHOTO_W = 30.13, CARD1_PHOTO_H = 31.07;
const CARD1_PHOTO_RATIO = CARD1_PHOTO_W / CARD1_PHOTO_H;

async function drawCardDesign1(doc, s, bgB64, photoB64, cx, cy) {
  const W = CARD1_W, H = CARD1_H;

  if (bgB64) {
    try { doc.addImage(bgB64, "PNG", cx, cy, W, H); } catch {}
  }

  // ── Photo (inside the template's orange frame) ────────────────
  const bx = cx + 24.76, by = cy + 28.15, bw = CARD1_PHOTO_W, bh = CARD1_PHOTO_H;
  if (photoB64) {
    try { doc.addImage(photoB64, "PNG", bx, by, bw, bh); } catch {}
    // Crisp orange outline on top of photo
    doc.setDrawColor(255, 117, 31);
    doc.setLineWidth(0.7);
    doc.roundedRect(cx + 24.06, cy + 27.56, 31.53, 32.23, 4.67, 4.67, "S");
  }

  // ── Name (bold uppercase, centered below photo frame) ─────────
  doc.setFont("helvetica", "bold");
  const nameStr = (s.name || "Student Name").toUpperCase();
  fitFontSize(doc, nameStr, 58, 15, 8);
  doc.setTextColor(0, 0, 0);
  doc.text(nameStr, cx + 40.0, cy + 66.2, { align: "center" });

  // ── Class / STD Pill ──────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  const stdStr = "STD : " + (s.std || "—").toUpperCase();
  fitFontSize(doc, stdStr, 32, 10.5, 6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(stdStr, cx + 40.0, cy + 73.5, { align: "center" });

  // ── Info row values (labels & colons are already on the template) ─
  const VAL_X = cx + 35.8, VAL_W = 40.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);

  const father = (s.fatherName || "—").toUpperCase();
  const mother = (s.motherName || "—").toUpperCase();
  const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
  const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
    ? `${s.mobile}, ${s.mobile2}`
    : (s.mobile || s.mobile2 || "—")).toUpperCase();

  doc.text(doc.splitTextToSize(father, VAL_W)[0], VAL_X, cy + 78.48);
  doc.text(doc.splitTextToSize(mother, VAL_W)[0], VAL_X, cy + 83.74);
  doc.text(doc.splitTextToSize(dob, VAL_W)[0], VAL_X, cy + 89.00);
  doc.text(doc.splitTextToSize(mobile, VAL_W)[0], VAL_X, cy + 94.25);

  // Address (up to 3 lines)
  const addrStr = (fmtAddr(s) || "—").toUpperCase();
  const addrLines = doc.splitTextToSize(addrStr, VAL_W).slice(0, 3);
  addrLines.forEach((line, i) => {
    doc.text(line, VAL_X, cy + 99.50 + i * 5.14);
  });
}

// Design 2 is the landscape CR80 card (1011x639px, 90mm x 56.9mm on A4, 8 cards per page).
// The template (/id-card-bg-2.jpg) contains the navy header, school title, photo frame,
// navy name/class boxes, labels, and footer. Only dynamic student data is drawn on top.
const CARD2_W = 90, CARD2_H = 56.9; // 1011:639 aspect ratio
const CARD2_PHOTO_W = 17.4, CARD2_PHOTO_H = 21.5; // inner photo area, mm
const CARD2_PHOTO_RATIO = CARD2_PHOTO_W / CARD2_PHOTO_H;

async function drawCardDesign2(doc, s, bgB64, photoB64, cx, cy) {
  if (bgB64) {
    try { doc.addImage(bgB64, "JPEG", cx, cy, CARD2_W, CARD2_H); } catch {}
  }

  // ── Photo (inside the template's pale-blue box) ─────────────────
  const bx = cx + 4.3, by = cy + 18.9, bw = CARD2_PHOTO_W, bh = CARD2_PHOTO_H;
  if (photoB64) {
    try { doc.addImage(photoB64, "PNG", bx, by, bw, bh); } catch {}
  }

  // ── Name & Class ────────────────────────────────────────────────
  const boxY = cy + 18.6, boxH = 6.9;
  const nameX = cx + 22.1, nameW = 40.8;
  const stdX = nameX + nameW + 0.8, stdW = 13.0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const nameFit = doc.splitTextToSize((s.name || "Student Name").toUpperCase(), nameW - 4)[0];
  doc.text(nameFit, nameX + nameW / 2, boxY + boxH / 2 + 1.2, { align: "center" });

  const stdText = (s.std || "—").toUpperCase();
  fitFontSize(doc, stdText, stdW - 2, 7.5);
  doc.text(stdText, stdX + stdW / 2, boxY + boxH / 2 + 1.2, { align: "center" });

  // ── Info row values (labels & colons are already on the clean template) ─
  const VAL_X = cx + 43.6, VAL_W = 43.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(17, 24, 39);

  const father = (s.fatherName || "—").toUpperCase();
  const mother = (s.motherName || "—").toUpperCase();
  const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
  const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
    ? `${s.mobile}, ${s.mobile2}`
    : (s.mobile || s.mobile2 || "—")).toUpperCase();

  doc.text(doc.splitTextToSize(father, VAL_W)[0], VAL_X, cy + 28.2);
  doc.text(doc.splitTextToSize(mother, VAL_W)[0], VAL_X, cy + 32.5);
  doc.text(doc.splitTextToSize(dob, VAL_W)[0], VAL_X, cy + 36.8);
  doc.text(doc.splitTextToSize(mobile, VAL_W)[0], VAL_X, cy + 41.1);

  const addrStr = (fmtAddr(s) || "—").toUpperCase();
  const addrLines = doc.splitTextToSize(addrStr, VAL_W).slice(0, 2);
  addrLines.forEach((line, i) => {
    doc.text(line, VAL_X, cy + 45.4 + i * 4.3);
  });
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
  { cx:15,    cy:8   },
  { cx:115,   cy:8   },
  { cx:15,    cy:152 },
  { cx:115,   cy:152 },
];
const DESIGN2_POSITIONS = [0,1,2,3].flatMap(row =>
  [10, 110].map(cx => ({ cx, cy: 8 + row*70 }))
);

async function generatePDF(students, designId, onProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });

  const bgUrl = window.location.origin + (designId === 2 ? "/id-card-bg-2.jpg" : "/id-card-portrait-template.png");
  const bgB64 = await fetchBase64(bgUrl);

  const positions  = designId === 2 ? DESIGN2_POSITIONS : DESIGN1_POSITIONS;
  const perPage    = positions.length;

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    onProgress && onProgress(i+1, students.length);

    let photoUrl = "";
    if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo))||""; } catch {} }
    const photoB64 = photoUrl
      ? await (designId === 2
          ? roundedSquareBase64(photoUrl, { radiusFrac: 0.02, ratio: CARD2_PHOTO_RATIO })
          : roundedSquareBase64(photoUrl, { radiusFrac: 0.13, ratio: CARD1_PHOTO_RATIO }))
      : null;

    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const { cx, cy } = positions[slot];

    await drawCard(doc, s, designId, bgB64, photoB64, cx, cy);
  }

  doc.save("ID_Cards_Satyam_Stars.pdf");
}

// ── Download Single Card as high-resolution PNG ──────────────────────────────
async function downloadSingleCardPNG(student, designId = 1) {
  if (!student) return;
  const s = student;

  if (designId === 2) {
    const W = 1011, H = 639;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    await new Promise(r => { bgImg.onload = r; bgImg.onerror = r; bgImg.src = "/id-card-bg-2.jpg"; });
    ctx.drawImage(bgImg, 0, 0, W, H);

    let photoUrl = "";
    if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo)) || ""; } catch {} }
    if (photoUrl) {
      const pImg = new Image();
      pImg.crossOrigin = "anonymous";
      const ok = await new Promise(r => { pImg.onload = () => r(true); pImg.onerror = () => r(false); pImg.src = photoUrl; });
      if (ok) {
        const bx = 48, by = 212, bw = 195, bh = 241, br = 18;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, br);
        ctx.arcTo(bx, by + bh, bx, by, br);
        ctx.arcTo(bx, by, bx + bw, by, br);
        ctx.closePath();
        ctx.clip();
        const sc = Math.max(bw / pImg.width, bh / pImg.height);
        ctx.drawImage(pImg, bx + (bw - pImg.width * sc) / 2, by + (bh - pImg.height * sc) / 2, pImg.width * sc, pImg.height * sc);
        ctx.restore();
      }
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((s.name || "STUDENT NAME").toUpperCase(), 474, 249);
    ctx.fillText((s.std || "—").toUpperCase(), 785, 249);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 23px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const father = (s.fatherName || "—").toUpperCase();
    const mother = (s.motherName || "—").toUpperCase();
    const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
    const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
      ? `${s.mobile}, ${s.mobile2}`
      : (s.mobile || s.mobile2 || "—")).toUpperCase();

    ctx.fillText(father, 495, 320);
    ctx.fillText(mother, 495, 368);
    ctx.fillText(dob,    495, 415);
    ctx.fillText(mobile, 495, 463);

    // Address
    const addrStr = (fmtAddr(s) || "—").toUpperCase();
    const words = addrStr.split(" ");
    let line = "";
    let lineY = 511;
    const maxW = 480;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? " " : "") + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxW && line) {
        ctx.fillText(line, 495, lineY);
        line = words[n];
        lineY += 48;
        if (lineY > 565) break;
      } else {
        line = testLine;
      }
    }
    if (line && lineY <= 565) {
      ctx.fillText(line, 495, lineY);
    }

    const link = document.createElement("a");
    link.download = `${(s.name || "ID_Card").replace(/[^a-zA-Z0-9_-]/g, "_")}_Landscape_ID_Card.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    return;
  }

  // Portrait Template: 685 x 1157 matching "id card protrait template.png"
  const W = 685, H = 1157;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bgImg = new Image();
  bgImg.crossOrigin = "anonymous";
  await new Promise(r => { bgImg.onload = r; bgImg.onerror = r; bgImg.src = "/id-card-portrait-template.png"; });
  ctx.drawImage(bgImg, 0, 0, W, H);

  let photoUrl = "";
  if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo)) || ""; } catch {} }
  if (photoUrl) {
    const pImg = new Image();
    pImg.crossOrigin = "anonymous";
    const ok = await new Promise(r => { pImg.onload = () => r(true); pImg.onerror = () => r(false); pImg.src = photoUrl; });
    if (ok) {
      const px = 212, py = 241, pw = 258, ph = 266, pr = 34;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px + pr, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
      ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
      ctx.arcTo(px, py + ph, px, py, pr);
      ctx.arcTo(px, py, px + pw, py, pr);
      ctx.closePath();
      ctx.clip();
      const sc = Math.max(pw / pImg.width, ph / pImg.height);
      ctx.drawImage(pImg, px + (pw - pImg.width * sc) / 2, py + (ph - pImg.height * sc) / 2, pImg.width * sc, pImg.height * sc);
      ctx.restore();
    }
  }

  // Crisp orange outline on top of photo
  const fx = 206, fy = 236, fw = 270, fh = 276, fr = 40;
  ctx.strokeStyle = "#ff751f";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(fx + fr, fy);
  ctx.arcTo(fx + fw, fy, fx + fw, fy + fh, fr);
  ctx.arcTo(fx + fw, fy + fh, fx, fy + fh, fr);
  ctx.arcTo(fx, fy + fh, fx, fy, fr);
  ctx.arcTo(fx, fy, fx + fw, fy, fr);
  ctx.closePath();
  ctx.stroke();

  // Name
  ctx.fillStyle = "#000000";
  ctx.font = "900 36px 'Arial Narrow', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const nameStr = (s.name || "STUDENT NAME").toUpperCase();
  ctx.fillText(nameStr, 342.5, 548);

  // STD Pill
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STD : " + (s.std || "—").toUpperCase(), 342.5, 616);

  // Values (starting right after printed colon at x=306)
  ctx.fillStyle = "#000000";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const father = (s.fatherName || "—").toUpperCase();
  const mother = (s.motherName || "—").toUpperCase();
  const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
  const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
    ? `${s.mobile}, ${s.mobile2}`
    : (s.mobile || s.mobile2 || "—")).toUpperCase();

  ctx.fillText(father, 306, 672);
  ctx.fillText(mother, 306, 717);
  ctx.fillText(dob,    306, 762);
  ctx.fillText(mobile, 306, 807);

  // Address
  const addrStr = (fmtAddr(s) || "—").toUpperCase();
  const words = addrStr.split(" ");
  let line = "";
  let lineY = 852;
  const maxW = 335;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? " " : "") + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxW && line) {
      ctx.fillText(line, 306, lineY);
      line = words[n];
      lineY += 45;
      if (lineY > 945) break;
    } else {
      line = testLine;
    }
  }
  if (line && lineY <= 945) {
    ctx.fillText(line, 306, lineY);
  }

  const link = document.createElement("a");
  link.download = `${(s.name || "ID_Card").replace(/[^a-zA-Z0-9_-]/g, "_")}_ID_Card.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── Export for Canva Bulk Create ────────────────────────────────────────────
// Canva's own "Bulk Create" (data merge) feature can autofill a Canva
// template - including an image placeholder, if a column holds an image URL
// - from a spreadsheet, one card per row. This exports exactly that
// spreadsheet so the school can regenerate cards directly inside Canva
// instead of (or alongside) the in-app PDF generator. The photo links are S3
// presigned URLs valid for 1 hour (see /api/s3/view-url), so this should be
// uploaded to Canva's Bulk Create soon after exporting.
async function exportForCanva(students) {
  const rows = await Promise.all(students.map(async (s) => {
    let photoUrl = "";
    if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo)) || ""; } catch {} }
    return {
      "Photo":          photoUrl,
      "Name":           s.name || "",
      "Father's Name":  s.fatherName || "",
      "Mother's Name":  s.motherName || "",
      "DOB":            fmtDMY(s.dob) || "",
      "Mobile No":      s.mobile || s.mobile2 || "",
      "Address":        fmtAddr(s) || "",
      "Class":          (s.std || "") + (s.section ? ` - ${s.section}` : ""),
      "Enrollment No":  s.enrollment || "",
    };
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map(k => ({ wch: k === "Photo" ? 60 : 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ID Card Data");
  XLSX.writeFile(wb, `ID_Card_Data_For_Canva_${toIsoDateLocal(new Date())}.xlsx`);
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
  const left = marginX + 5;
  const bodyWidth = PW - marginX * 2 - 10;
  const bodyStartY = headerRuleY + 16;
  // Content below the body must still leave room for the paraGap(s) + the
  // "+2.2 lineHeight" footer gap + the footer line itself before hitting the
  // inner frame's bottom border (PH - 13) - this is the same budget the
  // footer's own Math.min(..., PH - 25) assumes. Longer student data (name,
  // address baked into the body text, etc.) can wrap into more lines than a
  // fixed font size allows for, so shrink the body font/line-height (same
  // pattern as the letterhead's fitFontSize above) until everything actually
  // fits that budget, instead of letting it silently run past the frame.
  const maxBodyBottom = PH - 45;
  const paragraphTokens = bonafideParagraphs(s);

  let bodyFontSize = 13.5;
  let lineHeight = 8.6;
  let paraGap = 6.5;
  let wrappedParas, endY;
  do {
    doc.setFontSize(bodyFontSize);
    wrappedParas = paragraphTokens.map(p => wrapParagraph(doc, p, bodyWidth));
    endY = bodyStartY;
    wrappedParas.forEach((lines, i) => {
      endY += lines.length * lineHeight;
      if (i < wrappedParas.length - 1) endY += paraGap;
    });
    if (endY <= maxBodyBottom || bodyFontSize <= 9.5) break;
    bodyFontSize -= 0.5;
    lineHeight -= 0.32;
    paraGap -= 0.24;
  } while (true);

  doc.setFontSize(bodyFontSize);
  let y = bodyStartY;
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
// pulled live from the official_exams/official_exam_marks tables (see that
// file for the grading scale). sheet is null if the student's class has no
// subjects configured yet in Settings → Subjects. examNames is the list of
// official exams (Settings → Exams), in display order, shown as columns.
//
// Shared letterhead/border/student-info block for both marksheet page types
// (combined "Final Marksheet" and a single exam) - returns the page metrics
// plus the y cursor to keep drawing from.
function drawMarksheetHeader(doc, s, title, logoB64) {
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
  doc.text(title, PW / 2, titleY + 2, { align: "center" });
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

  const y = infoY + infoLeft.length * 7 + 8;
  return { PW, PH, marginX, y };
}

function drawMarksheetPage(doc, s, sheet, examNames, logoB64, autoTable) {
  const { PW, PH, marginX, y: startY } = drawMarksheetHeader(doc, s, "FINAL MARKSHEET", logoB64);
  let y = startY;

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
    head: [["Subject", ...examNames, "Total", "Obtained", "Grade"]],
    body: sheet.subjectRows.map(row => [
      row.subject,
      ...row.marks.map(m => `${m.obtained}/${m.max}`),
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

// Same page shape as drawMarksheetPage, but for exactly one official exam -
// sheet comes from marksheetService.getSingleExamMarksheet(), whose
// subjectRows are {subject,obtained,max,grade} (no per-exam marks array).
function drawSingleExamMarksheetPage(doc, s, sheet, examName, logoB64, autoTable) {
  const { PW, PH, marginX, y: startY } = drawMarksheetHeader(doc, s, `${examName.toUpperCase()} MARKSHEET`, logoB64);
  let y = startY;

  if (!sheet || sheet.subjectRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("No subjects configured for this class yet — add them in Settings → Subjects.", marginX, y);
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [["Subject", "Obtained", "Max", "Grade"]],
    body: sheet.subjectRows.map(row => [row.subject, row.obtained, row.max, row.grade]),
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

async function generateMarksheetPDF(targetStudents, allStudents, mode, examId, officialExams, onProgress) {
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
    const sheets = mode === "single"
      ? await getSingleExamMarksheet(classmates, className, examId)
      : await getMarksheetsForClass(classmates, className);
    sheets.forEach(sh => { sheetByStudentId[sh.studentId] = sh; });
  }

  const examNames = officialExams.map(e => e.name);
  const examName = officialExams.find(e => e.id === examId)?.name || "";

  for (let i = 0; i < targetStudents.length; i++) {
    const s = targetStudents[i];
    onProgress && onProgress(i + 1, targetStudents.length);
    if (i > 0) doc.addPage();
    if (mode === "single") {
      drawSingleExamMarksheetPage(doc, s, sheetByStudentId[s._studentId], examName, logoB64, autoTable);
    } else {
      drawMarksheetPage(doc, s, sheetByStudentId[s._studentId], examNames, logoB64, autoTable);
    }
  }
  doc.save(mode === "single" ? `${examName.replace(/[\s/]+/g,"_")}_Marksheets_Satyam_Stars.pdf` : "Final_Marksheets_Satyam_Stars.pdf");
}

// ── Marksheet: live preview (React, matches jsPDF output) ──────────────────────
function MarksheetPreview({ student, sheet, mode, examNames, examName, logoUrl, loading }) {
  const s = student || {};
  const title = mode === "single" ? `${(examName || "").toUpperCase()} MARKSHEET` : "FINAL MARKSHEET";
  const colCount = mode === "single" ? 5 : (examNames?.length || 0) + 3;

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
        <div style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#1a2b6b", margin: "2px 0 6px" }}>{title}</div>
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
              {mode === "single" ? (
                <>
                  <th style={{ padding: "3px 2px" }}>Obtained</th>
                  <th style={{ padding: "3px 2px" }}>Max</th>
                </>
              ) : (
                (examNames || []).map(name => <th key={name} style={{ padding: "3px 2px" }}>{name}</th>)
              )}
              <th style={{ padding: "3px 2px" }}>Total</th>
              <th style={{ padding: "3px 2px" }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {(sheet?.subjectRows || []).map((row, i) => (
              <tr key={row.subject} style={{ background: i % 2 ? "#f8fafc" : "white" }}>
                <td style={{ padding: "2.5px 2px", fontWeight: 700 }}>{row.subject}</td>
                {mode === "single" ? (
                  <>
                    <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.obtained}</td>
                    <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{row.max}</td>
                  </>
                ) : (
                  row.marks.map((m, mi) => <td key={mi} style={{ padding: "2.5px 2px", textAlign: "center" }}>{m.obtained}</td>)
                )}
                <td style={{ padding: "2.5px 2px", textAlign: "center" }}>{mode === "single" ? `${row.obtained}/${row.max}` : `${row.obtained}/${row.total}`}</td>
                <td style={{ padding: "2.5px 2px", textAlign: "center", fontWeight: 700 }}>{row.grade}</td>
              </tr>
            ))}
            {(!sheet || sheet.subjectRows.length === 0) && (
              <tr><td colSpan={colCount} style={{ padding: 8, textAlign: "center", color: "#94a3b8", fontSize: 6.5 }}>
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
// Shows one full page - the second printed page is identical. Mirrors the
// PDF side's shrink-to-fit: long student data (name, address, etc.) can wrap
// the body paragraphs into more lines than the fixed base font size allows
// for, so a layout effect measures the actual rendered height against the
// card's inner border and shrinks the body font (lineHeight is unitless, so
// it scales down with it) until the content stops overflowing the frame.
function BonafidePreview({ student, logoUrl }) {
  const s = student || {};
  const paragraphs = bonafideParagraphs(s);
  const segStyle = (mode) => mode === "strike"
    ? { textDecoration: "line-through" }
    : mode === "underline"
      ? { textDecoration: "underline" }
      : undefined;

  const cardRef = useRef(null);
  const wrapperRef = useRef(null);
  const bodyRef = useRef(null);
  const BASE_BODY_FONT_SIZE = 8;
  const MIN_BODY_FONT_SIZE = 5.5;

  useLayoutEffect(() => {
    const card = cardRef.current, wrapper = wrapperRef.current, bodyEl = bodyRef.current;
    if (!card || !wrapper || !bodyEl) return;

    let fontSize = BASE_BODY_FONT_SIZE;
    bodyEl.style.fontSize = `${fontSize}px`;

    const cardBottom = card.getBoundingClientRect().bottom - 12;
    let guard = 0;
    while (wrapper.getBoundingClientRect().bottom > cardBottom && fontSize > MIN_BODY_FONT_SIZE && guard < 40) {
      fontSize -= 0.25;
      bodyEl.style.fontSize = `${fontSize}px`;
      guard++;
    }
  }, [s.enrollment, s.name, s.fatherName, s.gender, s.std, s.session, s.dob]);

  return (
    <div ref={cardRef} style={{ width: 280, aspectRatio: "210/297", fontFamily: "Arial,Helvetica,sans-serif", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", flexShrink: 0, position: "relative" }}>
      <div style={{ position: "absolute", inset: 7, border: "1.4px solid #1a2b6b" }} />
      <div style={{ position: "absolute", inset: 9, border: "0.5px solid #1a2b6b" }} />

      {/* Content starts a fixed distance from the top and flows down - it
          isn't centered/stretched to fill the page; leftover space at the
          bottom is fine, matching drawBonafidePage(). */}
      <div ref={wrapperRef} style={{ padding: "22px 22px 0" }}>
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
        <div ref={bodyRef} style={{ fontSize: BASE_BODY_FONT_SIZE, lineHeight: 1.85, color: "#111", textAlign: "justify" }}>
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
  const W = 270, H = 456; // 685:1157 aspect ratio (270 x 456)
  const sc = 270 / 685;

  const father = (s.fatherName || "—").toUpperCase();
  const mother = (s.motherName || "—").toUpperCase();
  const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
  const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
    ? `${s.mobile}, ${s.mobile2}`
    : (s.mobile || s.mobile2 || "—")).toUpperCase();
  const address = (fmtAddr(s) || "—").toUpperCase();

  return (
    <div style={{ width:W, height:H, fontFamily:"Arial,Helvetica,sans-serif", position:"relative", overflow:"hidden", borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", flexShrink:0 }}>
      <img src="/id-card-portrait-template.png" alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }}/>

      {/* Photo (inside the template's orange frame) */}
      <div style={{ position:"absolute", top: 241 * sc, left: 212 * sc, width: 258 * sc, height: 266 * sc, borderRadius: 34 * sc, overflow:"hidden", background:"#eef2f6" }}>
        {s.photo ? (
          <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/>
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, color:"#9ca3af" }}>👤</div>
        )}
      </div>
      {/* Crisp orange frame border overlay */}
      <div style={{ position:"absolute", top: 236 * sc, left: 206 * sc, width: 270 * sc, height: 276 * sc, borderRadius: 40 * sc, border:`${6 * sc}px solid #ff751f`, pointerEvents:"none" }}/>

      {/* Student Name (centered below photo frame) */}
      <div style={{ position:"absolute", top: 524 * sc, left: 10, width: W - 20, height: 48 * sc, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#000000", fontSize:14.5, fontWeight:900, letterSpacing:0.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontFamily:"'Arial Narrow', Arial, sans-serif" }}>
          {(s.name || "STUDENT NAME").toUpperCase()}
        </span>
      </div>

      {/* Class / STD Pill */}
      <div style={{ position:"absolute", top: 593 * sc, left: 194 * sc, width: 308 * sc, height: 46 * sc, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#ffffff", fontSize:10.5, fontWeight:900, letterSpacing:0.6 }}>
          STD : {(s.std || "—").toUpperCase()}
        </span>
      </div>

      {/* Info row values (labels & colons are already on the template) */}
      <div style={{ position:"absolute", top: 654 * sc, left: 306 * sc, width: (655 - 306) * sc, color:"#000000", fontWeight:700, fontSize:8.5, fontFamily:"Arial, Helvetica, sans-serif" }}>
        <div style={{ height: 45 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {father}
        </div>
        <div style={{ height: 45 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {mother}
        </div>
        <div style={{ height: 45 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {dob}
        </div>
        <div style={{ height: 45 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {mobile}
        </div>
        <div style={{ minHeight: 90 * sc, fontSize:8.5, lineHeight:`17.7px`, paddingTop: 3 * sc, overflow:"hidden" }}>
          {address}
        </div>
      </div>
    </div>
  );
}

// Landscape CR80-style preview matching "SCHOOL ID CARD 2.jpg".
function CardPreviewDesign2({ student }) {
  const s = student || {};
  const W = 400, H = 253; // 1011:639 aspect ratio
  const sc = W / 1011;

  const father = (s.fatherName || "—").toUpperCase();
  const mother = (s.motherName || "—").toUpperCase();
  const dob    = (fmtDMY(s.dob) || "—").toUpperCase();
  const mobile = ((s.mobile && s.mobile2 && s.mobile !== s.mobile2)
    ? `${s.mobile}, ${s.mobile2}`
    : (s.mobile || s.mobile2 || "—")).toUpperCase();
  const address = (fmtAddr(s) || "—").toUpperCase();

  return (
    <div style={{ width:W, height:H, fontFamily:"Arial,Helvetica,sans-serif", position:"relative", overflow:"hidden", borderRadius:8, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", flexShrink:0 }}>
      <img src="/id-card-bg-2.jpg" alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }}/>

      {/* Photo (inside the template's pale-blue box) */}
      <div style={{ position:"absolute", top: 212 * sc, left: 48 * sc, width: 195 * sc, height: 241 * sc, borderRadius: 8 * sc, overflow:"hidden", background:"#e5e7eb" }}>
        {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div style={{ width:"100%", height:"100%", background:"#d1d5db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:"#9ca3af" }}>👤</div>}
      </div>

      {/* Name + Class (centered in navy boxes on template) */}
      <div style={{ position:"absolute", top: 209 * sc, left: 244 * sc, width: 461 * sc, height: 80 * sc, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"white", fontSize: 13, fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", padding:"0 6px" }}>
          {(s.name || "Student Name").toUpperCase()}
        </span>
      </div>
      <div style={{ position:"absolute", top: 209 * sc, left: 712 * sc, width: 146 * sc, height: 80 * sc, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"white", fontSize: 12, fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {(s.std || "—").toUpperCase()}
        </span>
      </div>

      {/* Info row values (starting right after printed colon at x=495) */}
      <div style={{ position:"absolute", top: 300 * sc, left: 495 * sc, width: (1011 - 495 - 20) * sc, color:"#111827", fontWeight:700, fontSize: 9.5, lineHeight: 1 }}>
        <div style={{ height: 48 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {father}
        </div>
        <div style={{ height: 48 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {mother}
        </div>
        <div style={{ height: 48 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {dob}
        </div>
        <div style={{ height: 48 * sc, display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {mobile}
        </div>
        <div style={{ minHeight: 96 * sc, lineHeight: `${48 * sc * 0.95}px`, paddingTop: 3 * sc, overflow:"hidden" }}>
          {address}
        </div>
      </div>
    </div>
  );
}

function CardPreview({ student, designId }) {
  return designId === 2
    ? <CardPreviewDesign2 student={student}/>
    : <CardPreviewDesign1 student={student}/>;
}

function TcPreview({ row }) {
  const r = row || TC_SAMPLE_ROW;
  return (
    <div style={{
      width: 295,
      height: 209,
      overflow: "hidden",
      position: "relative",
      borderRadius: 8,
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      background: "white",
      flexShrink: 0,
      border: "1px solid #e5e7eb"
    }}>
      <style>{TC_STYLES}</style>
      <div
        style={{
          width: "297mm",
          height: "210mm",
          transform: "scale(0.2628)",
          transformOrigin: "top left",
          pointerEvents: "none"
        }}
        dangerouslySetInnerHTML={{ __html: generateSchoolLeavingCertificateSheet(r) }}
      />
    </div>
  );
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
  const [exportingCanva, setExportingCanva] = useState(false);
  const [progress, setProgress]       = useState({ done:0, total:0 });
  const [previewIdx, setPreviewIdx]   = useState(0);
  const [logoUrl, setLogoUrl]         = useState("");
  const [marksheetSheet, setMarksheetSheet]     = useState(null);
  const [marksheetLoading, setMarksheetLoading] = useState(false);
  const [marksheetMode, setMarksheetMode]       = useState("final"); // "final" | "single"
  const [selectedExamId, setSelectedExamId]     = useState("");
  const [officialExams, setOfficialExams]       = useState([]);
  const [tcMode, setTcMode]           = useState("students"); // "students" | "bulk"
  const [tcOptions, setTcOptions]     = useState({
    dateOfLeaving: "",
    reasonForLeaving: "TO STUDY ELSEWHERE",
    conduct: "VERY GOOD",
    progress: "VERY GOOD",
    attendancePresent: "",
    attendanceTotal: "",
  });
  const [tcRows, setTcRows]           = useState([]);
  const [tcFileName, setTcFileName]   = useState("");
  const [tcParsing, setTcParsing]     = useState(false);
  const [tcError, setTcError]         = useState("");
  const tcFileRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    getStudents().then(d => setStudents(d||[])).catch(()=>{}).finally(()=>setLoading(false));
    setLogoUrl(window.location.origin + "/school-logo.jpg");
  }, []);

  useEffect(() => {
    if (activeTab !== "marksheet") return;
    getCurrentOfficialExams().then(setOfficialExams).catch(() => setOfficialExams([]));
  }, [activeTab]);

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

  // Marksheet data is pulled live from Supabase (official_exams/
  // official_exam_marks), unlike the ID Card/Bonafide previews which are
  // pure transforms of the already-loaded student list - Rank also needs
  // the previewed student's whole class, not just the ones selected, so
  // this always fetches from `students` (the full roster), not
  // `selectedStudents`.
  useEffect(() => {
    if (activeTab !== "marksheet" || !previewStudent) { setMarksheetSheet(null); return; }
    if (marksheetMode === "single" && !selectedExamId) { setMarksheetSheet(null); return; }
    let cancelled = false;
    setMarksheetLoading(true);
    const classmates = students.filter(s => s.std === previewStudent.std);
    const fetchSheets = marksheetMode === "single"
      ? getSingleExamMarksheet(classmates, previewStudent.std, selectedExamId)
      : getMarksheetsForClass(classmates, previewStudent.std);
    fetchSheets
      .then(sheets => {
        if (cancelled) return;
        setMarksheetSheet(sheets.find(sh => sh.studentId === previewStudent._studentId) || null);
      })
      .catch(() => { if (!cancelled) setMarksheetSheet(null); })
      .finally(() => { if (!cancelled) setMarksheetLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, previewStudent, students, marksheetMode, selectedExamId]);

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

  const handleExportCanva = useCallback(async () => {
    const targets = selectedStudents;
    if (!targets.length) { alert("Please select at least one student."); return; }
    setExportingCanva(true);
    try {
      await exportForCanva(targets);
    } catch(e) {
      alert("Export failed: " + e.message);
    } finally {
      setExportingCanva(false);
    }
  }, [selectedStudents]);

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
    if (marksheetMode === "single" && !selectedExamId) { alert("Please select an exam first."); return; }
    setGenerating(true);
    setProgress({ done:0, total:targets.length });
    try {
      await generateMarksheetPDF(targets, students, marksheetMode, selectedExamId, officialExams, (done, total) => setProgress({ done, total }));
    } catch(e) {
      alert("PDF generation failed: " + e.message);
    } finally {
      setGenerating(false);
      setProgress({ done:0, total:0 });
    }
  }, [selectedStudents, students, marksheetMode, selectedExamId, officialExams]);

  const handleTcFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setTcParsing(true);
    setTcError("");
    try {
      const rows = await parseTcFile(file);
      setTcRows(rows);
      setTcFileName(file.name);
    } catch (err) {
      setTcRows([]);
      setTcFileName("");
      setTcError(err.message);
    } finally {
      setTcParsing(false);
    }
  }, []);

  const tcValidRows = tcRows.filter(r => r._errors.length === 0);

  const handlePrintTc = useCallback(() => {
    let targets = [];
    if (tcMode === "students") {
      if (!selectedStudents.length) {
        alert("Please select at least one student to print certificate.");
        return;
      }
      targets = selectedStudents.map(s => studentToTcRow(s, tcOptions));
    } else {
      if (!tcValidRows.length) {
        alert("Please upload a valid CSV/Excel file or fix errors to print.");
        return;
      }
      targets = tcValidRows;
    }
    const html = generateSchoolLeavingCertificateHTML(targets);
    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups to print the certificates."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }, [tcMode, selectedStudents, tcValidRows, tcOptions]);

  const clearTcRows = useCallback(() => {
    setTcRows([]);
    setTcFileName("");
    setTcError("");
  }, []);

  const tcPreviewRow = tcMode === "students"
    ? (previewStudent ? studentToTcRow(previewStudent, tcOptions) : TC_SAMPLE_ROW)
    : (tcValidRows[previewIdx] || tcRows[previewIdx] || TC_SAMPLE_ROW);

  const tcTotalCount = tcMode === "students" ? selectedStudents.length : tcValidRows.length;

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

      {activeTab === "noc" && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300"/>
          <p className="text-gray-500 font-medium">Coming Soon</p>
        </div>
      )}

      {activeTab === "tc" && (
        <div className="flex flex-col gap-5">
          {/* Header & Mode Switcher */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-school-navy"/> Transfer Certificate (School Leaving Certificate)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Generate official government-format School Leaving Certificates identical to reference document (LAKSHITA RAULA TC)
              </p>
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0 self-start sm:self-auto">
              <button onClick={() => { setTcMode("students"); setPreviewIdx(0); }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${tcMode==="students" ? "bg-white text-school-navy shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Select Students
              </button>
              <button onClick={() => { setTcMode("bulk"); setPreviewIdx(0); }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${tcMode==="bulk" ? "bg-white text-school-navy shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Bulk CSV / Excel
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left Column: Student Selection OR CSV Upload */}
            <div className="flex-1 flex flex-col gap-4">
              {tcMode === "students" ? (
                <>
                  {/* Options bar for Date of Leaving, Reason, etc. */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="text-xs font-semibold text-gray-700 mb-2.5">Certificate Issuance Options</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Date of Leaving</label>
                        <input
                          type="date"
                          value={tcOptions.dateOfLeaving}
                          onChange={e => setTcOptions(o => ({ ...o, dateOfLeaving: e.target.value }))}
                          placeholder="Defaults to Today"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Reason for Leaving</label>
                        <input
                          type="text"
                          value={tcOptions.reasonForLeaving}
                          onChange={e => setTcOptions(o => ({ ...o, reasonForLeaving: e.target.value }))}
                          placeholder="TO STUDY ELSEWHERE"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Progress</label>
                        <input
                          type="text"
                          value={tcOptions.progress}
                          onChange={e => setTcOptions(o => ({ ...o, progress: e.target.value }))}
                          placeholder="VERY GOOD"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Conduct</label>
                        <input
                          type="text"
                          value={tcOptions.conduct}
                          onChange={e => setTcOptions(o => ({ ...o, conduct: e.target.value }))}
                          placeholder="VERY GOOD"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Attendance — Present Days</label>
                        <input
                          type="text"
                          value={tcOptions.attendancePresent}
                          onChange={e => setTcOptions(o => ({ ...o, attendancePresent: e.target.value }))}
                          placeholder="Leave blank if unknown"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 mb-1 font-medium">Attendance — Total Days</label>
                        <input
                          type="text"
                          value={tcOptions.attendanceTotal}
                          onChange={e => setTcOptions(o => ({ ...o, attendanceTotal: e.target.value }))}
                          placeholder="Leave blank if unknown"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-school-navy"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Student list */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                                        <div className="text-xs text-gray-400">{s.std}{s.section?" - "+s.section:""} · Enr: {s.enrollment}</div>
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
                </>
              ) : (
                /* Bulk CSV / Excel Import */
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs text-gray-400 mb-4">
                      Upload a CSV or Excel file containing TC records to generate certificates in bulk for any student (including past students or paper records).
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <input ref={tcFileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleTcFileChange}/>
                      <button onClick={() => tcFileRef.current?.click()} disabled={tcParsing}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-50 transition-colors shadow-sm">
                        <Upload className="w-4 h-4"/>
                        {tcParsing ? "Reading…" : "Choose CSV / Excel File"}
                      </button>
                      <button onClick={downloadTcTemplate}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-school-navy text-school-navy text-sm font-medium hover:bg-school-navy/5 transition-colors">
                        <Download className="w-4 h-4"/> Download Sample CSV
                      </button>
                      {tcFileName && (
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5"/>{tcFileName}
                        </span>
                      )}
                      {tcRows.length > 0 && (
                        <button onClick={clearTcRows} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 ml-auto">
                          <Trash2 className="w-3.5 h-3.5"/>Clear
                        </button>
                      )}
                    </div>

                    {tcError && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{tcError}
                      </div>
                    )}
                  </div>

                  {tcRows.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-700">
                          {tcRows.length} row{tcRows.length!==1?"s":""} parsed
                        </span>
                        <span className="text-xs">
                          <span className="text-green-600 font-semibold">{tcValidRows.length} ready</span>
                          {tcRows.length - tcValidRows.length > 0 && (
                            <span className="text-red-500 font-semibold ml-2">{tcRows.length - tcValidRows.length} with errors</span>
                          )}
                        </span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Row</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Father's Name</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">Date of Leaving</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {tcRows.map((r, idx) => (
                              <tr key={r._row} onClick={() => setPreviewIdx(idx)}
                                className={`cursor-pointer transition-colors ${previewIdx === idx ? "bg-school-navy/5" : r._errors.length ? "bg-red-50/50" : "hover:bg-gray-50"}`}>
                                <td className="px-4 py-2 text-gray-400 text-xs">{r._row}</td>
                                <td className="px-3 py-2 font-medium text-gray-800">{r.name || "—"}</td>
                                <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{r.fatherName || "—"}</td>
                                <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{fmtDMY(r.dateOfLeaving) || "—"}</td>
                                <td className="px-3 py-2">
                                  {r._errors.length
                                    ? <span className="text-red-600 text-xs" title={r._errors.join("; ")}>
                                        <AlertCircle className="w-3.5 h-3.5 inline mr-1"/>{r._errors.length} error{r._errors.length!==1?"s":""}
                                      </span>
                                    : <span className="text-green-600 text-xs font-semibold">Ready</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Live Preview Panel */}
            <div className="lg:w-80 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-3">
              <div className="w-full flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Live Preview</span>
                <span className="text-[11px] text-gray-400 font-medium">Government Format</span>
              </div>

              {tcPreviewRow ? (
                <>
                  <TcPreview row={tcPreviewRow}/>
                  {tcTotalCount > 1 && (
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <button onClick={()=>setPreviewIdx(i=>Math.max(0,i-1))} disabled={previewIdx===0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4"/>
                      </button>
                      <span>{previewIdx+1} / {tcTotalCount}</span>
                      <button onClick={()=>setPreviewIdx(i=>Math.min(tcTotalCount-1,i+1))} disabled={previewIdx===tcTotalCount-1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-300">
                  <FileText className="w-16 h-16"/>
                  <p className="text-sm text-gray-400">Select a student or load CSV to preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-school-navy"/>
              <span className="text-sm text-gray-600">
                {tcMode === "students" ? (
                  <>
                    <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size!==1?"s":""} selected
                  </>
                ) : (
                  <>
                    <span className="font-bold text-school-navy">{tcValidRows.length}</span> certificate{tcValidRows.length!==1?"s":""} ready
                  </>
                )}
              </span>
              {tcMode === "students" && selected.size > 0 && (
                <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3 h-3"/>Clear
                </button>
              )}
            </div>

            <button
              onClick={handlePrintTc}
              disabled={tcMode === "students" ? selected.size === 0 : !tcValidRows.length}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4"/>
              Print Certificate{((tcMode === "students" ? selected.size : tcValidRows.length) !== 1) ? "s" : ""} (
                {tcMode === "students" ? selected.size : tcValidRows.length}
              )
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            One full A4 landscape page per certificate (duplicate 2-up with scissor cut line for student &amp; office filing).
          </p>
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
                  <button
                    onClick={() => downloadSingleCardPNG(previewStudent, designId)}
                    className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                    title="Download this student's card as a high-resolution PNG image"
                  >
                    <Download className="w-3.5 h-3.5 text-school-navy"/>
                    Download Card (PNG)
                  </button>
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
              <div className="flex items-center gap-2">
                <button onClick={handleExportCanva} disabled={selected.size===0 || exportingCanva}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-school-navy text-school-navy text-sm font-medium hover:bg-school-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <FileSpreadsheet className="w-4 h-4"/>
                  {exportingCanva ? "Exporting…" : "Export for Canva"}
                </button>
                <button onClick={handleDownload} disabled={selected.size===0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                  <Download className="w-4 h-4"/>
                  Download PDF ({selected.size} cards)
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            {designId === 2
              ? "PDF downloads directly — 8 cards per A4 page (landscape, 90mm × 56.9mm)."
              : "PDF downloads directly — 4 cards per A4 page (portrait, 80mm × 135.1mm)."}
            {" "}Select students above, then Download PDF for the in-app card, or Export for Canva to regenerate
            in Canva's own Bulk Create (the photo links in that export expire after 1 hour, so upload it soon after exporting).
          </p>
        </div>
      )}

      {activeTab === "marksheet" && (
        <div className="flex flex-col gap-5">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              <button onClick={() => setMarksheetMode("final")}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${marksheetMode==="final" ? "bg-white text-school-navy shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Final Marksheet
              </button>
              <button onClick={() => setMarksheetMode("single")}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${marksheetMode==="single" ? "bg-white text-school-navy shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Single Exam
              </button>
            </div>

            {marksheetMode === "single" && (
              <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-48">
                <option value="">Select an exam…</option>
                {officialExams.map(ex => (
                  <option key={ex.id} value={ex.id} disabled={!isExamUnlocked(ex)}>
                    {ex.name}{!isExamUnlocked(ex) ? ` (locked until ${fmtDMY(ex.end_date)})` : ""}
                  </option>
                ))}
              </select>
            )}

            <p className="text-xs text-gray-400">
              {marksheetMode === "final"
                ? "Shows every official exam side by side per subject, with a grand total. Manage exams in Settings → Exams."
                : "Shows one exam's marks alone. Locked exams (before their end date) can’t be picked yet."}
              {" "}Subjects come from Settings → Subjects.
            </p>
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
                  <MarksheetPreview
                    student={previewStudent} sheet={marksheetSheet}
                    mode={marksheetMode}
                    examNames={officialExams.map(e => e.name)}
                    examName={officialExams.find(e => e.id === selectedExamId)?.name}
                    logoUrl={logoUrl} loading={marksheetLoading}
                  />
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
              <button onClick={handleDownloadMarksheet} disabled={selected.size===0 || (marksheetMode==="single" && !selectedExamId)}
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
