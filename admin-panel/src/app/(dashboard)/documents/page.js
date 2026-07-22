"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getStudents } from "@/lib/studentService";
import { getS3ViewUrl } from "@/lib/s3Upload";
import { fmtDMY } from "@/lib/utils";
import S3Image from "@/components/S3Image";
import {
  CreditCard, Award, FileText, Search, Download,
  Users, GraduationCap, X, CheckSquare, ChevronLeft, ChevronRight
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const TRUST   = "Satyam Education Charitable Trust ( E-8941 )";
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

const DESIGNS = [
  { id:1, name:"Satyam Classic", desc:"Navy & Orange",  hdr:"#1a2b6b", acc:"#f97316", gld:"#f59e0b" },
  { id:2, name:"Royal Navy",     desc:"Navy & Gold",    hdr:"#0f172a", acc:"#eab308", gld:"#facc15" },
  { id:3, name:"Forest Green",   desc:"Green & Gold",   hdr:"#14532d", acc:"#16a34a", gld:"#f59e0b" },
  { id:4, name:"Deep Purple",    desc:"Purple & Gold",  hdr:"#3b0764", acc:"#7c3aed", gld:"#f59e0b" },
  { id:5, name:"Clean Minimal",  desc:"White & Navy",   hdr:"#1e3a5f", acc:"#3b82f6", gld:"#1e3a5f" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAddr(s) {
  return [s.roomPlotNo, s.address].filter(Boolean).join(", ") || "";
}

// Bonafide Certificate uses the same navy/gold brand colors as the "Satyam
// Classic" ID card design, so the two document types read as one family
// rather than each looking like a different app.
const BONAFIDE_COLOR = { hdr: "#1a2b6b", acc: "#f97316", gld: "#f59e0b" };

function pronouns(gender) {
  const g = (gender || "").trim().toLowerCase();
  if (g.startsWith("f")) return { title: "Ms.", parentTitle: "Mrs.", child: "Daughter", poss: "Her", subj: "She" };
  return { title: "Mr.", parentTitle: "Mr.", child: "Son", poss: "His", subj: "He" };
}

function fmtIssueDate(d = new Date()) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
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

// ── jsPDF card drawing ────────────────────────────────────────────────────────
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

async function drawCard(doc, s, design, logoB64, photoB64, cx, cy) {
  const W = 90, H = 140;
  const d = design;
  const [hr, hg, hb] = rgb(d.hdr);
  const [ar, ag, ab] = rgb(d.acc);
  const [gr, gg, gb] = rgb(d.gld);

  // ── Header background ──────────────────────────────────────────
  doc.setFillColor(hr, hg, hb);
  doc.rect(cx, cy, W, 51, "F");

  // ── Wave curves (gold then orange) ───────────────────────────
  if (d.id !== 5) {
    // Gold wave
    doc.setFillColor(gr, gg, gb);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.75 }));
    doc.lines([[22,-20,44,-38,72,-46],[0,8],[-22,20,-44,38,-62,38]], cx+18, cy+51, [1,1], "F", true);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));

    // Accent wave
    doc.setFillColor(ar, ag, ab);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.85 }));
    doc.lines([[18,-18,38,-33,62,-41],[0,9],[-18,18,-38,33,-52,32]], cx+28, cy+51, [1,1], "F", true);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
  }

  // ── Logo circle ──────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.circle(cx+13, cy+14, 10, "F");
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", cx+3, cy+4, 20, 20); } catch {}
  }

  // ── School name text ─────────────────────────────────────────
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 220, 220);
  doc.text(TRUST, cx+26, cy+6.5);

  doc.setFontSize(d.id===5 ? 15 : 20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("SATYAM STARS", cx+26, cy+17);

  doc.setFontSize(11);
  doc.setTextColor(gr, gg, gb);
  doc.text("INTERNATIONAL SCHOOL", cx+26, cy+24.5);

  // Year with lines
  const session = s.session || "2025-26";
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.25);
  doc.line(cx+26, cy+29.5, cx+48, cy+29.5);
  doc.setFontSize(8);
  doc.setTextColor(gr, gg, gb);
  doc.text("★ " + session + " ★", cx+58, cy+30.5, { align:"center" });
  doc.line(cx+69, cy+29.5, cx+87, cy+29.5);

  // ── Photo circle ──────────────────────────────────────────────
  const px = cx+45, py = cy+49;
  doc.setFillColor(ar, ag, ab);
  doc.circle(px, py, 19, "F");
  doc.setFillColor(gr, gg, gb);
  doc.circle(px, py, 17, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(px, py, 15, "F");
  if (photoB64) {
    try { doc.addImage(photoB64, "PNG", px-14, py-14, 28, 28); } catch {}
  } else {
    doc.setFillColor(209, 213, 219);
    doc.circle(px, py, 14, "F");
  }

  // ── White body ───────────────────────────────────────────────
  const bodyY = cy+50;
  if (d.id === 5) {
    doc.setFillColor(248, 250, 252);
  } else {
    doc.setFillColor(255, 255, 255);
  }
  doc.rect(cx, bodyY, W, H-50-13, "F");

  // Diagonal stripes watermark
  if (d.id !== 5) {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.15);
    for (let i = -10; i < 20; i++) {
      const ox = i * 6;
      doc.line(cx + ox, bodyY, cx + ox + (H-50), bodyY + (H-50));
    }
  }

  // ── Name ribbon ───────────────────────────────────────────────
  const ry = cy+71;
  // Left blue notch
  doc.setFillColor(hr, hg, hb);
  doc.triangle(cx+2, ry+5, cx+7, ry, cx+7, ry+10, "F");
  // Main ribbon
  doc.setFillColor(ar, ag, ab);
  doc.rect(cx+6, ry, 78, 10, "F");
  // Right blue notch
  doc.setFillColor(hr, hg, hb);
  doc.triangle(cx+84, ry, cx+84, ry+10, cx+88, ry+5, "F");
  // Name text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  const nameStr = (s.name || "Student Name").toUpperCase();
  doc.text(nameStr, cx+45, ry+6.8, { align:"center", maxWidth:70 });

  // ── Class strip ───────────────────────────────────────────────
  doc.setFillColor(gr, gg, gb);
  doc.rect(cx+5, ry+10, 80, 5.5, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hr, hg, hb);
  const clsStr = "Class: " + (s.std||"—") + (s.section?" - "+s.section:"") + "   |   Roll: " + (s.rollNo||"—");
  doc.text(clsStr, cx+45, ry+14.2, { align:"center" });

  // ── Info rows ─────────────────────────────────────────────────
  const rows = [
    { color:[29,78,216],   label:"Father's Name", val: s.fatherName||""  },
    { color:[234,88,12],   label:"Mother's Name", val: s.motherName||""  },
    { color:[146,64,14],   label:"Date of Birth", val: fmtDMY(s.dob) },
    { color:[29,78,216],   label:"Phone",          val: s.mobile||s.mobile1||"" },
    { color:[220,38,38],   label:"Address",        val: fmtAddr(s)||""   },
  ];
  const infoY = ry + 18;
  rows.forEach((row, i) => {
    const iry = infoY + i*7.6;
    doc.setFillColor(...row.color);
    doc.circle(cx+7, iry+3, 3.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(row.label, cx+12.5, iry+2.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const val = ": " + (row.val || "—");
    const valLine = doc.splitTextToSize(val, 68)[0];
    doc.text(valLine, cx+12.5, iry+5.8);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(cx+3, iry+7.2, cx+87, iry+7.2);
  });

  // ── PRINCIPAL ─────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ar, ag, ab);
  doc.text("PRINCIPAL", cx+45, cy+127, { align:"center" });

  // ── Footer ────────────────────────────────────────────────────
  doc.setFillColor(hr, hg, hb);
  doc.rect(cx, cy+128, W, 12, "F");
  // Location circle
  doc.setFillColor(ar, ag, ab);
  doc.circle(cx+5.5, cy+134, 3.2, "F");
  // Address
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(ADDR1, cx+10.5, cy+132.5);
  doc.text(ADDR2, cx+10.5, cy+135.5);
  // Divider
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(cx+56, cy+129.5, cx+56, cy+138.5);
  // Phone circle
  doc.setFillColor(ar, ag, ab);
  doc.circle(cx+60, cy+134, 3.2, "F");
  // Phone number
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(PHONE, cx+65, cy+135);

  // Card border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(cx, cy, W, H, 2, 2, "S");
}

// ── Generate PDF ──────────────────────────────────────────────────────────────
async function generatePDF(students, design, onProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });

  const logoUrl = window.location.origin + "/school-logo.jpg";
  const logoB64 = await fetchBase64(logoUrl);

  const positions = [
    { cx:10, cy:8.5  },
    { cx:105, cy:8.5 },
    { cx:10, cy:153  },
    { cx:105, cy:153 },
  ];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    onProgress && onProgress(i+1, students.length);

    let photoUrl = "";
    if (s.photo) { try { photoUrl = (await getS3ViewUrl(s.photo))||""; } catch {} }
    const photoB64 = photoUrl ? await circularBase64(photoUrl) : null;

    const slot = i % 4;
    if (i > 0 && slot === 0) doc.addPage();
    const { cx, cy } = positions[slot];

    await drawCard(doc, s, design, logoB64, photoB64, cx, cy);
  }

  doc.save("ID_Cards_Satyam_Stars.pdf");
}

// ── Bonafide Certificate: jsPDF drawing (one full A4 page per student) ────────
function drawBonafideCert(doc, s, logoB64) {
  const PW = 210, PH = 297; // A4 mm
  const [hr, hg, hb] = rgb(BONAFIDE_COLOR.hdr);
  const [ar, ag, ab] = rgb(BONAFIDE_COLOR.acc);
  const [gr, gg, gb] = rgb(BONAFIDE_COLOR.gld);
  const p = pronouns(s.gender);

  // Outer decorative border
  doc.setDrawColor(hr, hg, hb);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, PW - 16, PH - 16, "S");
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.4);
  doc.rect(11, 11, PW - 22, PH - 22, "S");

  // Header band
  doc.setFillColor(hr, hg, hb);
  doc.rect(11, 11, PW - 22, 34, "F");
  if (logoB64) {
    doc.setFillColor(255, 255, 255);
    doc.circle(30, 28, 12, "F");
    try { doc.addImage(logoB64, "JPEG", 20, 18, 20, 20); } catch {}
  }
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 220, 220);
  doc.text(TRUST, 48, 21);
  doc.setFontSize(19);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("SATYAM STARS", 48, 30);
  doc.setFontSize(12);
  doc.setTextColor(gr, gg, gb);
  doc.text("INTERNATIONAL SCHOOL", 48, 37);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`${ADDR1}, ${ADDR2}  |  Ph: ${PHONE}`, PW - 15, 40, { align: "right" });

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hr, hg, hb);
  doc.text("BONAFIDE CERTIFICATE", PW / 2, 62, { align: "center" });
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.6);
  doc.line(PW / 2 - 38, 66, PW / 2 + 38, 66);

  // Date of issue
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${fmtIssueDate()}`, PW - 20, 78, { align: "right" });

  // Body paragraph
  const cls = (s.std || "—") + (s.section ? " - " + s.section : "");
  const session = s.session || "2025-26";
  const body =
    `This is to certify that ${p.title} ${(s.name || "").toUpperCase()}, ${p.child} of ` +
    `${p.parentTitle} ${(s.fatherName || "—").toUpperCase()}, bearing Enrollment No. ${s.enrollment || "—"}, ` +
    `is a bonafide student of SATYAM STARS INTERNATIONAL SCHOOL, studying in Class ${cls} ` +
    `during the academic session ${session}.\n\n` +
    `As per our school records, ${p.poss.toLowerCase()} Date of Birth is ${fmtDMY(s.dob) || "—"}.\n\n` +
    `This certificate is issued upon request, for whatever purpose it may serve.`;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(body, PW - 50);
  doc.text(lines, 25, 95, { lineHeightFactor: 1.9 });

  // Signature block
  const sigY = PH - 55;
  doc.setDrawColor(ar, ag, ab);
  doc.setFillColor(ar, ag, ab);
  doc.circle(PW - 40, sigY - 4, 12, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("SCHOOL\nSEAL", PW - 40, sigY - 6, { align: "center", lineHeightFactor: 1.2 });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(PW - 65, sigY + 14, PW - 20, sigY + 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(hr, hg, hb);
  doc.text("PRINCIPAL", PW - 42.5, sigY + 20, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Satyam Stars International School", PW - 42.5, sigY + 25, { align: "center" });

  // Footer band
  doc.setFillColor(hr, hg, hb);
  doc.rect(11, PH - 24, PW - 22, 13, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(`${ADDR1}, ${ADDR2}`, PW / 2, PH - 18.5, { align: "center" });
  doc.text(`Phone: ${PHONE}`, PW / 2, PH - 14, { align: "center" });
}

async function generateBonafidePDF(students, onProgress) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoUrl = window.location.origin + "/school-logo.jpg";
  const logoB64 = await fetchBase64(logoUrl);

  for (let i = 0; i < students.length; i++) {
    onProgress && onProgress(i + 1, students.length);
    if (i > 0) doc.addPage();
    drawBonafideCert(doc, students[i], logoB64);
  }
  doc.save("Bonafide_Certificates_Satyam_Stars.pdf");
}

// ── Bonafide Certificate: live preview (React, matches jsPDF output) ──────────
function BonafidePreview({ student, logoUrl }) {
  const s = student || {};
  const p = pronouns(s.gender);
  const cls = (s.std || "—") + (s.section ? " - " + s.section : "");
  const session = s.session || "2025-26";
  const { hdr, acc, gld } = BONAFIDE_COLOR;

  return (
    <div style={{ width: 280, aspectRatio: "210/297", fontFamily: "Arial,Helvetica,sans-serif", position: "relative", background: "white", boxShadow: "0 4px 20px rgba(0,0,0,0.35)", border: `2px solid ${hdr}`, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 6, border: `1px solid ${gld}` }} />

      {/* Header */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, height: 46, background: hdr, display: "flex", alignItems: "center", padding: "0 10px", gap: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "white", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} /> : <span style={{ color: hdr, fontWeight: 900 }}>S</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 5.5 }}>{TRUST}</div>
          <div style={{ color: "white", fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>SATYAM STARS</div>
          <div style={{ color: gld, fontSize: 8, fontWeight: 800 }}>INTERNATIONAL SCHOOL</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ position: "absolute", top: 66, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ color: hdr, fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>BONAFIDE CERTIFICATE</div>
        <div style={{ margin: "4px auto 0", width: 70, height: 2, background: gld }} />
      </div>

      <div style={{ position: "absolute", top: 84, right: 18, fontSize: 7, color: "#475569" }}>Date: {fmtIssueDate()}</div>

      {/* Body */}
      <div style={{ position: "absolute", top: 96, left: 20, right: 20, fontSize: 7.5, lineHeight: 1.9, color: "#1e293b", textAlign: "justify" }}>
        This is to certify that <b>{p.title} {(s.name || "—").toUpperCase()}</b>, {p.child} of{" "}
        <b>{p.parentTitle} {(s.fatherName || "—").toUpperCase()}</b>, bearing Enrollment No.{" "}
        <b>{s.enrollment || "—"}</b>, is a bonafide student of <b>SATYAM STARS INTERNATIONAL SCHOOL</b>,
        {" "}studying in Class <b>{cls}</b> during the academic session <b>{session}</b>.
        <br /><br />
        As per our school records, {p.poss.toLowerCase()} Date of Birth is <b>{fmtDMY(s.dob) || "—"}</b>.
        <br /><br />
        This certificate is issued upon request, for whatever purpose it may serve.
      </div>

      {/* Signature */}
      <div style={{ position: "absolute", bottom: 46, right: 22, textAlign: "center" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: acc, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", color: "white", fontSize: 5.5, fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>SCHOOL<br />SEAL</div>
        <div style={{ width: 60, borderTop: "1px solid #94a3b8", marginBottom: 3 }} />
        <div style={{ fontSize: 8, fontWeight: 800, color: hdr }}>PRINCIPAL</div>
      </div>

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, height: 14, background: hdr, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
        <div style={{ color: "white", fontSize: 5.5 }}>{ADDR1}, {ADDR2}</div>
        <div style={{ color: "white", fontSize: 5.5 }}>Phone: {PHONE}</div>
      </div>
    </div>
  );
}

// ── Live card preview (React component, matches jsPDF output) ─────────────────
function CardPreview({ student, design, photoUrl, logoUrl }) {
  const s = student || {};
  const d = design;
  const cls = (s.std||"—") + (s.section?" - "+s.section:"");
  const session = s.session || "2025-26";

  const infoRows = [
    { bg: "#1d4ed8", label:"Father's Name", val: s.fatherName||"—" },
    { bg: "#ea580c", label:"Mother's Name", val: s.motherName||"—" },
    { bg: "#92400e", label:"Date of Birth", val: fmtDMY(s.dob) },
    { bg: "#1d4ed8", label:"Phone",          val: s.mobile||s.mobile1||"—" },
    { bg: "#dc2626", label:"Address",        val: fmtAddr(s)||"—" },
  ];

  return (
    <div style={{ width:270, height:420, fontFamily:"Arial,Helvetica,sans-serif", position:"relative", overflow:"hidden", borderRadius:9, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", flexShrink:0 }}>
      {/* Header */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:153, background:d.hdr, overflow:"hidden" }}>
        {/* Wave SVG */}
        <svg style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%" }} viewBox="0 0 90 51" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M 18,51 C 40,31 62,13 90,5 L 90,13 C 62,22 40,42 18,51 Z" fill={d.gld} opacity="0.75"/>
          <path d="M 28,51 C 50,33 70,16 90,10 L 90,19 C 70,26 50,44 28,51 Z" fill={d.acc} opacity="0.85"/>
          {[1,2,3,4].map(r=>[79,85].map(cx=><circle key={cx+"-"+r} cx={cx} cy={r*4} r="1" fill={d.gld} opacity="0.6"/>))}
        </svg>
        {/* Logo */}
        <div style={{ position:"absolute", top:12, left:9, width:60, height:60, borderRadius:"50%", background:"white", overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.3)" }}>
          {logoUrl ? <img src={logoUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.target.style.display="none"}/> : <div style={{ width:"100%", height:"100%", background:"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", color:d.hdr, fontSize:24, fontWeight:900 }}>S</div>}
        </div>
        {/* School name */}
        <div style={{ position:"absolute", top:10, left:76, right:9 }}>
          <div style={{ color:"rgba(255,255,255,0.8)", fontSize:6, lineHeight:1.3 }}>{TRUST}</div>
          <div style={{ color:"white", fontSize:22, fontWeight:900, lineHeight:0.95, letterSpacing:1 }}>SATYAM STARS</div>
          <div style={{ color:d.gld, fontSize:13, fontWeight:800, lineHeight:1 }}>INTERNATIONAL SCHOOL</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
            <div style={{ flex:1, height:1, background:d.gld, opacity:0.7 }}/>
            <div style={{ color:d.gld, fontSize:8, fontWeight:700, letterSpacing:2 }}>★ {session} ★</div>
            <div style={{ flex:1, height:1, background:d.gld, opacity:0.7 }}/>
          </div>
        </div>
      </div>

      {/* Photo circle */}
      <div style={{ position:"absolute", top:90, left:"50%", transform:"translateX(-50%)", width:108, height:108, borderRadius:"50%", background:d.acc, display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, boxShadow:"0 2px 10px rgba(0,0,0,0.3)" }}>
        <div style={{ width:98, height:98, borderRadius:"50%", background:d.gld, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:86, height:86, borderRadius:"50%", overflow:"hidden", background:"#e5e7eb" }}>
            {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div style={{ width:"100%", height:"100%", background:"#d1d5db", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, color:"#9ca3af" }}>👤</div>}
          </div>
        </div>
      </div>

      {/* White body */}
      <div style={{ position:"absolute", top:150, left:0, right:0, bottom:39, background:d.id===5?"#f8fafc":"white", overflow:"hidden" }}>
        {/* Diagonal stripes */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(-45deg,transparent,transparent 12px,rgba(0,0,0,0.02) 12px,rgba(0,0,0,0.02) 14px)" }}/>

        {/* Name ribbon */}
        <div style={{ position:"absolute", top:57, left:0, right:0 }}>
          <div style={{ position:"relative", margin:"0 6px", height:30, display:"flex", alignItems:"center" }}>
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:16, background:d.hdr, clipPath:"polygon(0 50%,100% 0,100% 100%)" }}/>
            <div style={{ position:"absolute", left:12, right:12, top:0, bottom:0, background:d.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"white", fontSize:11, fontWeight:900, textTransform:"uppercase", letterSpacing:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", padding:"0 12px" }}>{s.name||"Student Name"}</span>
            </div>
            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:16, background:d.hdr, clipPath:"polygon(0 0,0 100%,100% 50%)" }}/>
          </div>
          <div style={{ margin:"0 15px", background:d.gld, height:15, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"0 0 6px 6px" }}>
            <span style={{ color:d.hdr, fontSize:7, fontWeight:800 }}>Class: {cls} &nbsp;|&nbsp; Roll: {s.rollNo||"—"}</span>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ position:"absolute", top:108, left:10, right:18 }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"3px 0", borderBottom:"1px solid #e5e7eb" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:row.bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>
                {["👨","👩","📅","📞","📍"][i]}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:6, fontWeight:700, color:"#1e293b" }}>{row.label}</div>
                <div style={{ fontSize:6, color:"#475569", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>: {row.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Principal */}
        <div style={{ position:"absolute", bottom:6, left:0, right:0, textAlign:"center" }}>
          <span style={{ color:d.acc, fontSize:8, fontWeight:800, letterSpacing:3 }}>PRINCIPAL</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:39, background:d.hdr, display:"flex", alignItems:"center", padding:"0 8px", gap:6 }}>
        <div style={{ width:18, height:18, borderRadius:"50%", background:d.acc, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>📍</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"white", fontSize:5.5, whiteSpace:"nowrap" }}>{ADDR1}</div>
          <div style={{ color:"white", fontSize:5.5, whiteSpace:"nowrap" }}>{ADDR2}</div>
        </div>
        <div style={{ width:1, height:24, background:"rgba(255,255,255,0.3)", flexShrink:0 }}/>
        <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, paddingLeft:6 }}>
          <div style={{ width:18, height:18, borderRadius:"50%", background:d.acc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>📞</div>
          <span style={{ color:"white", fontSize:11, fontWeight:800 }}>{PHONE}</span>
        </div>
      </div>
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
  const [progress, setProgress]       = useState({ done:0, total:0 });
  const [previewIdx, setPreviewIdx]   = useState(0);
  const [logoUrl, setLogoUrl]         = useState("");

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
  const currentDesign = DESIGNS.find(d => d.id === designId) || DESIGNS[0];
  const previewStudent = selectedStudents[previewIdx] || filtered[0] || null;

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
      await generatePDF(targets, currentDesign, (done, total) => setProgress({ done, total }));
    } catch(e) {
      alert("PDF generation failed: " + e.message);
    } finally {
      setGenerating(false);
      setProgress({ done:0, total:0 });
    }
  }, [selectedStudents, currentDesign]);

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

      {(activeTab === "marksheet" || activeTab === "noc" || activeTab === "tc") && (
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
              {DESIGNS.map(d => (
                <button key={d.id} onClick={() => setDesignId(d.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${designId===d.id?"border-school-navy shadow-md bg-school-navy/5":"border-gray-200 hover:border-gray-300"}`}>
                  <div style={{ width:44, height:68, borderRadius:4, overflow:"hidden", background:d.hdr, boxShadow:"0 2px 6px rgba(0,0,0,0.25)", position:"relative" }}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:26, background:d.hdr, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1, padding:3 }}>
                      <div style={{ color:"white", fontSize:5, fontWeight:900, letterSpacing:0.5 }}>SATYAM STARS</div>
                      <div style={{ color:d.gld, fontSize:4 }}>INT. SCHOOL</div>
                      <div style={{ color:d.gld, fontSize:3.5 }}>★ 2025-26 ★</div>
                    </div>
                    <div style={{ position:"absolute", top:15, left:"50%", transform:"translateX(-50%)", width:20, height:20, borderRadius:"50%", border:`2px solid ${d.gld}`, background:d.acc }} />
                    <div style={{ position:"absolute", top:36, left:3, right:3, height:8, background:d.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:"white", fontSize:4, fontWeight:700 }}>NAME</span>
                    </div>
                    <div style={{ position:"absolute", top:46, left:3, right:3, display:"flex", flexDirection:"column", gap:1.5 }}>
                      {[0,1,2].map(i=><div key={i} style={{ height:2, background:"#e5e7eb", borderRadius:1 }}/>)}
                    </div>
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10, background:d.hdr }} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700">{d.name}</div>
                    <div className="text-[10px] text-gray-400">{d.desc}</div>
                  </div>
                  {designId===d.id && <div className="w-2 h-2 rounded-full bg-school-navy"/>}
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
                  <CardPreview student={previewStudent} design={currentDesign} logoUrl={logoUrl}/>
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
                Download PDF ({selected.size} certificate{selected.size!==1?"s":""})
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            PDF downloads directly — one certificate per A4 page. Select students above then click Download PDF.
          </p>
        </div>
      )}
    </div>
  );
}
