"use client";

import { useState, useEffect, useCallback } from "react";
import { getStudents } from "@/lib/studentService";
import { getS3ViewUrl } from "@/lib/s3Upload";
import S3Image from "@/components/S3Image";
import { CreditCard, Award, FileText, Search, Printer, Users, Eye, GraduationCap, X, CheckSquare } from "lucide-react";

// ── School constants ──────────────────────────────────────────────────────────
const SCHOOL_TRUST = "Satyam Education Charitable Trust ( E-8941 )";
const SCHOOL_ADDR1 = "Swaminarayan Nagar - Bhidbhanjan Society";
const SCHOOL_ADDR2 = "Pandesara - Udhna , Surat - 394210";
const SCHOOL_PHONE = "8200069671";

const CLASSES_LIST = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];

const DESIGNS = [
  { id: 1, name: "Satyam Classic",  desc: "Navy & Orange",  hdr: "#1a2b6b", acc: "#f97316", gld: "#f59e0b" },
  { id: 2, name: "Royal Navy",      desc: "Navy & Gold",    hdr: "#0f172a", acc: "#eab308", gld: "#facc15" },
  { id: 3, name: "Forest Green",    desc: "Green & Gold",   hdr: "#14532d", acc: "#22c55e", gld: "#f59e0b" },
  { id: 4, name: "Deep Purple",     desc: "Purple & Gold",  hdr: "#3b0764", acc: "#a855f7", gld: "#f59e0b" },
  { id: 5, name: "Clean Minimal",   desc: "White & Navy",   hdr: "#1e3a5f", acc: "#1e3a5f", gld: "#1e3a5f" },
];

const SUB_TABS = [
  { key: "idcard",    label: "ID Card",   icon: CreditCard },
  { key: "marksheet", label: "Marksheet", icon: Award      },
  { key: "bonafide",  label: "Bonafide",  icon: FileText   },
  { key: "noc",       label: "NOC",       icon: FileText   },
  { key: "tc",        label: "TC",        icon: FileText   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDOB(dob) {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return String(dob);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function fmtAddr(s) {
  return [s.roomPlotNo, s.address].filter(Boolean).join(", ") || "";
}
function esc(v) {
  return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── SVG icons (inline, print-safe) ───────────────────────────────────────────
const P_PERSON   = "M12 12c2.66 0 4.8-2.14 4.8-4.8S14.66 2.4 12 2.4 7.2 4.54 7.2 7.2 9.34 12 12 12zm0 2.4c-3.21 0-9.6 1.61-9.6 4.8v2.4h19.2v-2.4c0-3.19-6.39-4.8-9.6-4.8z";
const P_MOTHER   = "M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm-1 12h2l1 4-2 1-2-1 1-4zm-6 6.5C5 18.6 7.7 17 12 17s7 1.6 7 3.5V22H5v-1.5z";
const P_CAL      = "M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z";
const P_PHONE    = "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";
const P_LOC      = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

function ico(path, sz="4mm", fill="white") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}" style="width:${sz};height:${sz};display:block;"><path d="${path}"/></svg>`;
}
function icoBubble(bg, path) {
  return `<div style="width:7.5mm;height:7.5mm;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ico(path,"4.2mm")}</div>`;
}

// ── Shared photo circle ───────────────────────────────────────────────────────
function photoCircle(url, ring1="#f97316", ring2="#f59e0b", sz=36) {
  const img = url
    ? `<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;background:#d1d5db;display:flex;align-items:center;justify-content:center;">${ico(P_PERSON,"45%","#9ca3af")}</div>`;
  const s2 = sz - 3.5, s3 = sz - 6;
  return `<div style="width:${sz}mm;height:${sz}mm;border-radius:50%;background:${ring1};display:flex;align-items:center;justify-content:center;box-shadow:0 2mm 8mm rgba(0,0,0,0.35);">
<div style="width:${s2}mm;height:${s2}mm;border-radius:50%;background:${ring2};display:flex;align-items:center;justify-content:center;">
<div style="width:${s3}mm;height:${s3}mm;border-radius:50%;overflow:hidden;background:white;">${img}</div>
</div></div>`;
}

// ── Info row ─────────────────────────────────────────────────────────────────
function infoRow(bg, iconPath, label, value) {
  return `<div style="display:flex;align-items:center;gap:2.5mm;padding:1.2mm 0;border-bottom:0.4mm solid #e5e7eb;">
  ${icoBubble(bg, iconPath)}
  <div style="flex:1;min-width:0;">
    <div style="font-size:2.3mm;font-weight:700;color:#1e293b;line-height:1.2;">${esc(label)}</div>
    <div style="font-size:2.1mm;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">: ${esc(value||"—")}</div>
  </div>
</div>`;
}

// ── CARD 1 — Satyam Classic (matches demo) ───────────────────────────────────
function card1(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  const name    = esc(s.name || "Student Name");
  const cls     = esc(s.std || "—") + (s.section ? " - " + esc(s.section) : "");

  return `<div style="width:90mm;height:140mm;position:relative;overflow:hidden;border-radius:3mm;box-shadow:0 3mm 12mm rgba(0,0,0,0.4);font-family:Arial,Helvetica,sans-serif;">

<!-- HEADER -->
<div style="position:absolute;top:0;left:0;right:0;height:51mm;background:#1a2b6b;overflow:hidden;">
  <!-- Wave decoration -->
  <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 90 51" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="M 18,51 C 35,32 58,12 90,4 L 90,13 C 58,22 37,42 18,51 Z" fill="#f59e0b" opacity="0.8"/>
    <path d="M 28,51 C 46,34 68,16 90,8 L 90,18 C 68,27 48,46 28,51 Z" fill="#f97316"/>
    <circle cx="80" cy="3" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="85" cy="3" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="80" cy="7" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="85" cy="7" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="80" cy="11" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="85" cy="11" r="1" fill="#f59e0b" opacity="0.7"/>
    <circle cx="80" cy="15" r="1" fill="#f59e0b" opacity="0.5"/>
    <circle cx="85" cy="15" r="1" fill="#f59e0b" opacity="0.5"/>
    <circle cx="3" cy="30" r="1" fill="#f97316" opacity="0.5"/>
    <circle cx="7" cy="30" r="1" fill="#f97316" opacity="0.5"/>
    <circle cx="3" cy="34" r="1" fill="#f97316" opacity="0.5"/>
    <circle cx="7" cy="34" r="1" fill="#f97316" opacity="0.5"/>
    <circle cx="3" cy="38" r="1" fill="#f97316" opacity="0.5"/>
    <circle cx="7" cy="38" r="1" fill="#f97316" opacity="0.5"/>
  </svg>
  <!-- School logo -->
  <div style="position:absolute;top:4mm;left:3mm;width:20mm;height:20mm;border-radius:50%;background:white;overflow:hidden;box-shadow:0 1mm 4mm rgba(0,0,0,0.3);z-index:3;">
    ${logoUrl ? `<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>` : `<div style="width:100%;height:100%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#1a2b6b;font-size:8mm;font-weight:900;">S</div>`}
  </div>
  <!-- School info -->
  <div style="position:absolute;top:3mm;left:25mm;right:3mm;z-index:3;">
    <div style="color:rgba(255,255,255,0.8);font-size:2mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:9mm;font-weight:900;line-height:0.92;letter-spacing:0.5mm;text-shadow:0 1mm 3mm rgba(0,0,0,0.3);">SATYAM STARS</div>
    <div style="color:#f59e0b;font-size:5.2mm;font-weight:800;line-height:1;letter-spacing:0.2mm;">INTERNATIONAL SCHOOL</div>
    <div style="display:flex;align-items:center;gap:1.5mm;margin-top:1.5mm;">
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.7;"></div>
      <div style="color:#f59e0b;font-size:3.2mm;font-weight:700;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.7;"></div>
    </div>
  </div>
</div>

<!-- PHOTO (centered, overlapping header+body) -->
<div style="position:absolute;top:30mm;left:50%;transform:translateX(-50%);z-index:10;">
  ${photoCircle(s._photo,"#f97316","#f59e0b",38)}
</div>

<!-- WHITE BODY -->
<div style="position:absolute;top:50mm;left:0;right:0;bottom:13mm;background:white;overflow:hidden;">
  <div style="position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent,transparent 4mm,rgba(0,0,0,0.022) 4mm,rgba(0,0,0,0.022) 4.8mm);"></div>
  <!-- right dots -->
  <svg style="position:absolute;right:2mm;bottom:18mm;" viewBox="0 0 12 24" width="5mm" xmlns="http://www.w3.org/2000/svg">
    <circle cx="3" cy="4" r="1.2" fill="#1a2b6b" opacity="0.35"/>
    <circle cx="9" cy="4" r="1.2" fill="#1a2b6b" opacity="0.35"/>
    <circle cx="3" cy="10" r="1.2" fill="#1a2b6b" opacity="0.35"/>
    <circle cx="9" cy="10" r="1.2" fill="#1a2b6b" opacity="0.35"/>
    <circle cx="3" cy="16" r="1.2" fill="#1a2b6b" opacity="0.35"/>
    <circle cx="9" cy="16" r="1.2" fill="#1a2b6b" opacity="0.35"/>
  </svg>

  <!-- NAME RIBBON (at 20mm from white body = 70mm from card top) -->
  <div style="position:absolute;top:20mm;left:0;right:0;">
    <div style="position:relative;margin:0 2mm;height:10mm;display:flex;align-items:center;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:5.5mm;background:#1a2b6b;clip-path:polygon(0 50%,100% 0,100% 100%);"></div>
      <div style="position:absolute;left:4mm;right:4mm;top:0;bottom:0;background:#f97316;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:4.2mm;font-weight:900;text-transform:uppercase;letter-spacing:0.4mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4mm;">${name}</span>
      </div>
      <div style="position:absolute;right:0;top:0;bottom:0;width:5.5mm;background:#1a2b6b;clip-path:polygon(0 0,0 100%,100% 50%);"></div>
    </div>
    <div style="margin:0 5mm;background:#f59e0b;height:5mm;display:flex;align-items:center;justify-content:center;border-radius:0 0 2mm 2mm;">
      <span style="color:#1a2b6b;font-size:2.6mm;font-weight:800;">Class: ${cls} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</span>
    </div>
  </div>

  <!-- INFO ROWS -->
  <div style="position:absolute;top:37mm;left:3.5mm;right:6mm;">
    ${infoRow("#1d4ed8", P_PERSON,  "Father's Name", s.fatherName)}
    ${infoRow("#ea580c", P_MOTHER,  "Mother's Name", s.motherName)}
    ${infoRow("#92400e", P_CAL,     "Date of Birth", fmtDOB(s.dob))}
    ${infoRow("#1d4ed8", P_PHONE,   "Phone",         s.mobile||s.mobile1||"")}
    ${infoRow("#dc2626", P_LOC,     "Address",       fmtAddr(s))}
  </div>

  <!-- PRINCIPAL -->
  <div style="position:absolute;bottom:2mm;left:0;right:0;text-align:center;">
    <span style="color:#f97316;font-size:3mm;font-weight:800;letter-spacing:1.5mm;">PRINCIPAL</span>
  </div>
</div>

<!-- FOOTER -->
<div style="position:absolute;bottom:0;left:0;right:0;height:13mm;background:#1a2b6b;display:flex;align-items:center;padding:0 2.5mm;gap:2mm;">
  <div style="width:6mm;height:6mm;border-radius:50%;background:#f97316;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ico(P_LOC,"3.8mm")}</div>
  <div style="flex:1;min-width:0;">
    <div style="color:white;font-size:1.8mm;line-height:1.4;white-space:nowrap;">${SCHOOL_ADDR1}</div>
    <div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR2}</div>
  </div>
  <div style="width:0.3mm;height:8mm;background:rgba(255,255,255,0.3);flex-shrink:0;"></div>
  <div style="display:flex;align-items:center;gap:1.5mm;flex-shrink:0;padding-left:2mm;">
    <div style="width:6mm;height:6mm;border-radius:50%;background:#f97316;display:flex;align-items:center;justify-content:center;">${ico(P_PHONE,"3.8mm")}</div>
    <span style="color:white;font-size:3.5mm;font-weight:800;white-space:nowrap;">${SCHOOL_PHONE}</span>
  </div>
</div>

</div>`;
}

// ── CARD 2 — Royal Navy (dark + gold, diamond photo frame) ──────────────────
function card2(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  const img = s._photo
    ? `<img src="${esc(s._photo)}" style="width:100%;height:100%;object-fit:cover;"/>`
    : `<div style="width:100%;height:100%;background:#1e293b;display:flex;align-items:center;justify-content:center;">${ico(P_PERSON,"40%","#64748b")}</div>`;
  const cls = esc(s.std||"—")+(s.section?" - "+esc(s.section):"");
  return `<div style="width:90mm;height:140mm;position:relative;overflow:hidden;border-radius:3mm;box-shadow:0 3mm 12mm rgba(0,0,0,0.4);font-family:Arial,Helvetica,sans-serif;background:#0f172a;">

<!-- Gold top border stripe -->
<div style="position:absolute;top:0;left:0;right:0;height:1.5mm;background:linear-gradient(90deg,#eab308,#fbbf24,#eab308);z-index:5;"></div>

<!-- HEADER -->
<div style="position:absolute;top:1.5mm;left:0;right:0;height:50mm;background:#0f172a;overflow:hidden;">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,#1e3a5f,#0f172a);"></div>
  <!-- Decorative hex pattern -->
  <svg style="position:absolute;top:0;right:0;width:50%;height:100%;opacity:0.08;" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke="#eab308" stroke-width="2"/>
    <polygon points="50,18 82,36 82,64 50,82 18,64 18,36" fill="none" stroke="#eab308" stroke-width="1.5"/>
  </svg>
  <!-- Logo -->
  <div style="position:absolute;top:6mm;left:50%;transform:translateX(-50%);width:14mm;height:14mm;border-radius:50%;background:white;overflow:hidden;border:0.8mm solid #eab308;z-index:3;">
    ${logoUrl?`<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#0f172a;font-size:6mm;font-weight:900;">S</div>`}
  </div>
  <!-- School text -->
  <div style="position:absolute;top:22mm;left:0;right:0;text-align:center;z-index:3;padding:0 3mm;">
    <div style="color:#94a3b8;font-size:1.9mm;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:7.5mm;font-weight:900;letter-spacing:0.5mm;line-height:1;">SATYAM STARS</div>
    <div style="color:#eab308;font-size:4.5mm;font-weight:800;letter-spacing:0.3mm;">INTERNATIONAL SCHOOL</div>
    <div style="color:#eab308;font-size:2.8mm;font-weight:600;margin-top:1mm;letter-spacing:1.5mm;">&#9733; ${session} &#9733;</div>
  </div>
</div>

<!-- GOLD DIVIDER -->
<div style="position:absolute;top:51.5mm;left:0;right:0;height:0.5mm;background:linear-gradient(90deg,transparent,#eab308 20%,#eab308 80%,transparent);z-index:5;"></div>

<!-- PHOTO (square with gold frame) -->
<div style="position:absolute;top:54mm;left:50%;transform:translateX(-50%);width:30mm;height:30mm;background:#eab308;padding:1.5mm;z-index:10;">
  <div style="width:100%;height:100%;overflow:hidden;">${img}</div>
</div>
<!-- Gold corner decorations -->
<div style="position:absolute;top:52.5mm;left:calc(50% - 16.5mm);width:3mm;height:3mm;border-top:0.8mm solid #fbbf24;border-left:0.8mm solid #fbbf24;z-index:11;"></div>
<div style="position:absolute;top:52.5mm;right:calc(50% - 16.5mm);width:3mm;height:3mm;border-top:0.8mm solid #fbbf24;border-right:0.8mm solid #fbbf24;z-index:11;"></div>
<div style="position:absolute;top:85.5mm;left:calc(50% - 16.5mm);width:3mm;height:3mm;border-bottom:0.8mm solid #fbbf24;border-left:0.8mm solid #fbbf24;z-index:11;"></div>
<div style="position:absolute;top:85.5mm;right:calc(50% - 16.5mm);width:3mm;height:3mm;border-bottom:0.8mm solid #fbbf24;border-right:0.8mm solid #fbbf24;z-index:11;"></div>

<!-- NAME + CLASS -->
<div style="position:absolute;top:88mm;left:0;right:0;text-align:center;padding:0 5mm;">
  <div style="color:white;font-size:5mm;font-weight:900;text-transform:uppercase;letter-spacing:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name||"Student Name")}</div>
  <div style="display:inline-block;background:#eab308;color:#0f172a;font-size:2.5mm;font-weight:700;padding:0.8mm 4mm;margin-top:1mm;border-radius:1mm;">Class: ${cls} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</div>
</div>

<!-- GOLD DIVIDER 2 -->
<div style="position:absolute;top:98mm;left:5mm;right:5mm;height:0.4mm;background:#eab308;opacity:0.5;"></div>

<!-- INFO ROWS -->
<div style="position:absolute;top:100mm;left:4mm;right:4mm;">
  ${[["Father's Name",s.fatherName,"#eab308"],[" Mother's Name",s.motherName,"#eab308"],["Date of Birth",fmtDOB(s.dob),"#eab308"],["Phone",s.mobile||s.mobile1||"","#eab308"],["Address",fmtAddr(s),"#eab308"]].map(([lbl,val,c])=>`
  <div style="display:flex;gap:2mm;padding:1.2mm 0;border-bottom:0.3mm solid rgba(234,179,8,0.2);">
    <span style="color:${c};font-size:2.2mm;font-weight:700;min-width:22mm;flex-shrink:0;">${esc(lbl)}</span>
    <span style="color:#94a3b8;font-size:2.1mm;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">: ${esc(val||"—")}</span>
  </div>`).join("")}
</div>

<!-- PRINCIPAL -->
<div style="position:absolute;bottom:14mm;left:0;right:0;text-align:center;">
  <span style="color:#eab308;font-size:3mm;font-weight:800;letter-spacing:1.5mm;">PRINCIPAL</span>
</div>

<!-- FOOTER -->
<div style="position:absolute;bottom:0;left:0;right:0;height:13mm;background:#0d1117;border-top:0.5mm solid #eab308;display:flex;align-items:center;justify-content:center;gap:3mm;">
  ${ico(P_LOC,"4mm","#eab308")}
  <span style="color:#94a3b8;font-size:1.9mm;">${SCHOOL_ADDR1}, ${SCHOOL_ADDR2}</span>
  <span style="color:#eab308;font-size:3mm;font-weight:700;">${SCHOOL_PHONE}</span>
</div>
</div>`;
}

// ── CARD 3 — Forest Green (wave + gold) ──────────────────────────────────────
function card3(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  const cls = esc(s.std||"—")+(s.section?" - "+esc(s.section):"");
  return `<div style="width:90mm;height:140mm;position:relative;overflow:hidden;border-radius:3mm;box-shadow:0 3mm 12mm rgba(0,0,0,0.4);font-family:Arial,Helvetica,sans-serif;">

<!-- HEADER -->
<div style="position:absolute;top:0;left:0;right:0;height:51mm;background:#14532d;overflow:hidden;">
  <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 90 51" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="M 20,51 C 38,33 62,14 90,5 L 90,14 C 62,24 40,44 20,51 Z" fill="#f59e0b" opacity="0.7"/>
    <path d="M 32,51 C 50,35 72,18 90,10 L 90,20 C 72,29 52,47 32,51 Z" fill="#22c55e" opacity="0.6"/>
    <circle cx="4" cy="28" r="1.2" fill="#f59e0b" opacity="0.5"/><circle cx="8" cy="28" r="1.2" fill="#f59e0b" opacity="0.5"/>
    <circle cx="4" cy="33" r="1.2" fill="#f59e0b" opacity="0.5"/><circle cx="8" cy="33" r="1.2" fill="#f59e0b" opacity="0.5"/>
    <circle cx="4" cy="38" r="1.2" fill="#f59e0b" opacity="0.5"/><circle cx="8" cy="38" r="1.2" fill="#f59e0b" opacity="0.5"/>
    <circle cx="81" cy="4" r="1.2" fill="#f59e0b" opacity="0.6"/><circle cx="86" cy="4" r="1.2" fill="#f59e0b" opacity="0.6"/>
    <circle cx="81" cy="9" r="1.2" fill="#f59e0b" opacity="0.6"/><circle cx="86" cy="9" r="1.2" fill="#f59e0b" opacity="0.6"/>
    <circle cx="81" cy="14" r="1.2" fill="#f59e0b" opacity="0.4"/><circle cx="86" cy="14" r="1.2" fill="#f59e0b" opacity="0.4"/>
  </svg>
  <!-- Logo -->
  <div style="position:absolute;top:4mm;left:3mm;width:20mm;height:20mm;border-radius:50%;background:white;overflow:hidden;box-shadow:0 1mm 4mm rgba(0,0,0,0.3);z-index:3;">
    ${logoUrl?`<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`:`<div style="width:100%;height:100%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;color:#14532d;font-size:8mm;font-weight:900;">S</div>`}
  </div>
  <!-- School info -->
  <div style="position:absolute;top:3mm;left:25mm;right:3mm;z-index:3;">
    <div style="color:rgba(255,255,255,0.8);font-size:2mm;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:9mm;font-weight:900;line-height:0.92;letter-spacing:0.5mm;">SATYAM STARS</div>
    <div style="color:#f59e0b;font-size:5.2mm;font-weight:800;line-height:1;">INTERNATIONAL SCHOOL</div>
    <div style="display:flex;align-items:center;gap:1.5mm;margin-top:1.5mm;">
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.6;"></div>
      <div style="color:#f59e0b;font-size:3.2mm;font-weight:700;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.6;"></div>
    </div>
  </div>
</div>

<!-- PHOTO -->
<div style="position:absolute;top:30mm;left:50%;transform:translateX(-50%);z-index:10;">
  ${photoCircle(s._photo,"#22c55e","#f59e0b",38)}
</div>

<!-- WHITE BODY -->
<div style="position:absolute;top:50mm;left:0;right:0;bottom:13mm;background:#f0fdf4;overflow:hidden;">
  <div style="position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent,transparent 4mm,rgba(0,0,0,0.018) 4mm,rgba(0,0,0,0.018) 4.8mm);"></div>
  <!-- NAME RIBBON -->
  <div style="position:absolute;top:20mm;left:0;right:0;">
    <div style="position:relative;margin:0 2mm;height:10mm;display:flex;align-items:center;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:5.5mm;background:#14532d;clip-path:polygon(0 50%,100% 0,100% 100%);"></div>
      <div style="position:absolute;left:4mm;right:4mm;top:0;bottom:0;background:#16a34a;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:4.2mm;font-weight:900;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4mm;">${esc(s.name||"Student Name")}</span>
      </div>
      <div style="position:absolute;right:0;top:0;bottom:0;width:5.5mm;background:#14532d;clip-path:polygon(0 0,0 100%,100% 50%);"></div>
    </div>
    <div style="margin:0 5mm;background:#f59e0b;height:5mm;display:flex;align-items:center;justify-content:center;border-radius:0 0 2mm 2mm;">
      <span style="color:#14532d;font-size:2.6mm;font-weight:800;">Class: ${cls} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</span>
    </div>
  </div>
  <!-- INFO ROWS -->
  <div style="position:absolute;top:37mm;left:3.5mm;right:6mm;">
    ${infoRow("#1d4ed8",P_PERSON,"Father's Name",s.fatherName)}
    ${infoRow("#ea580c",P_MOTHER,"Mother's Name",s.motherName)}
    ${infoRow("#92400e",P_CAL,"Date of Birth",fmtDOB(s.dob))}
    ${infoRow("#14532d",P_PHONE,"Phone",s.mobile||s.mobile1||"")}
    ${infoRow("#dc2626",P_LOC,"Address",fmtAddr(s))}
  </div>
  <div style="position:absolute;bottom:2mm;left:0;right:0;text-align:center;">
    <span style="color:#16a34a;font-size:3mm;font-weight:800;letter-spacing:1.5mm;">PRINCIPAL</span>
  </div>
</div>

<!-- FOOTER -->
<div style="position:absolute;bottom:0;left:0;right:0;height:13mm;background:#14532d;display:flex;align-items:center;padding:0 2.5mm;gap:2mm;">
  <div style="width:6mm;height:6mm;border-radius:50%;background:#22c55e;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ico(P_LOC,"3.8mm")}</div>
  <div style="flex:1;min-width:0;"><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR1}</div><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR2}</div></div>
  <div style="width:0.3mm;height:8mm;background:rgba(255,255,255,0.3);"></div>
  <div style="display:flex;align-items:center;gap:1.5mm;padding-left:2mm;flex-shrink:0;">
    <div style="width:6mm;height:6mm;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;">${ico(P_PHONE,"3.8mm")}</div>
    <span style="color:white;font-size:3.5mm;font-weight:800;">${SCHOOL_PHONE}</span>
  </div>
</div>
</div>`;
}

// ── CARD 4 — Deep Purple (premium) ───────────────────────────────────────────
function card4(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  const cls = esc(s.std||"—")+(s.section?" - "+esc(s.section):"");
  return `<div style="width:90mm;height:140mm;position:relative;overflow:hidden;border-radius:3mm;box-shadow:0 3mm 12mm rgba(0,0,0,0.4);font-family:Arial,Helvetica,sans-serif;">

<!-- HEADER -->
<div style="position:absolute;top:0;left:0;right:0;height:51mm;background:linear-gradient(135deg,#3b0764,#6b21a8);overflow:hidden;">
  <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 90 51" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="M 20,51 C 38,33 62,14 90,5 L 90,14 C 62,24 40,44 20,51 Z" fill="#f59e0b" opacity="0.55"/>
    <path d="M 32,51 C 50,35 72,18 90,10 L 90,20 C 72,29 52,47 32,51 Z" fill="#a855f7" opacity="0.45"/>
    <circle cx="81" cy="4" r="1.2" fill="#f59e0b" opacity="0.6"/><circle cx="86" cy="4" r="1.2" fill="#f59e0b" opacity="0.6"/>
    <circle cx="81" cy="9" r="1.2" fill="#f59e0b" opacity="0.6"/><circle cx="86" cy="9" r="1.2" fill="#f59e0b" opacity="0.6"/>
    <circle cx="81" cy="14" r="1.2" fill="#f59e0b" opacity="0.4"/><circle cx="86" cy="14" r="1.2" fill="#f59e0b" opacity="0.4"/>
  </svg>
  <!-- Logo -->
  <div style="position:absolute;top:4mm;left:3mm;width:20mm;height:20mm;border-radius:50%;background:white;overflow:hidden;box-shadow:0 1mm 4mm rgba(0,0,0,0.4);z-index:3;">
    ${logoUrl?`<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`:`<div style="width:100%;height:100%;background:#faf5ff;display:flex;align-items:center;justify-content:center;color:#3b0764;font-size:8mm;font-weight:900;">S</div>`}
  </div>
  <!-- School info -->
  <div style="position:absolute;top:3mm;left:25mm;right:3mm;z-index:3;">
    <div style="color:rgba(255,255,255,0.8);font-size:2mm;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:9mm;font-weight:900;line-height:0.92;letter-spacing:0.5mm;">SATYAM STARS</div>
    <div style="color:#f59e0b;font-size:5.2mm;font-weight:800;line-height:1;">INTERNATIONAL SCHOOL</div>
    <div style="display:flex;align-items:center;gap:1.5mm;margin-top:1.5mm;">
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.6;"></div>
      <div style="color:#f59e0b;font-size:3.2mm;font-weight:700;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
      <div style="flex:1;height:0.4mm;background:#f59e0b;opacity:0.6;"></div>
    </div>
  </div>
</div>

<!-- PHOTO -->
<div style="position:absolute;top:30mm;left:50%;transform:translateX(-50%);z-index:10;">
  ${photoCircle(s._photo,"#a855f7","#f59e0b",38)}
</div>

<!-- WHITE BODY -->
<div style="position:absolute;top:50mm;left:0;right:0;bottom:13mm;background:white;overflow:hidden;">
  <div style="position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent,transparent 4mm,rgba(0,0,0,0.02) 4mm,rgba(0,0,0,0.02) 4.8mm);"></div>
  <!-- NAME RIBBON -->
  <div style="position:absolute;top:20mm;left:0;right:0;">
    <div style="position:relative;margin:0 2mm;height:10mm;display:flex;align-items:center;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:5.5mm;background:#3b0764;clip-path:polygon(0 50%,100% 0,100% 100%);"></div>
      <div style="position:absolute;left:4mm;right:4mm;top:0;bottom:0;background:#7c3aed;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:4.2mm;font-weight:900;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4mm;">${esc(s.name||"Student Name")}</span>
      </div>
      <div style="position:absolute;right:0;top:0;bottom:0;width:5.5mm;background:#3b0764;clip-path:polygon(0 0,0 100%,100% 50%);"></div>
    </div>
    <div style="margin:0 5mm;background:#f59e0b;height:5mm;display:flex;align-items:center;justify-content:center;border-radius:0 0 2mm 2mm;">
      <span style="color:#3b0764;font-size:2.6mm;font-weight:800;">Class: ${cls} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</span>
    </div>
  </div>
  <!-- INFO ROWS -->
  <div style="position:absolute;top:37mm;left:3.5mm;right:6mm;">
    ${infoRow("#1d4ed8",P_PERSON,"Father's Name",s.fatherName)}
    ${infoRow("#ea580c",P_MOTHER,"Mother's Name",s.motherName)}
    ${infoRow("#92400e",P_CAL,"Date of Birth",fmtDOB(s.dob))}
    ${infoRow("#7c3aed",P_PHONE,"Phone",s.mobile||s.mobile1||"")}
    ${infoRow("#dc2626",P_LOC,"Address",fmtAddr(s))}
  </div>
  <div style="position:absolute;bottom:2mm;left:0;right:0;text-align:center;">
    <span style="color:#7c3aed;font-size:3mm;font-weight:800;letter-spacing:1.5mm;">PRINCIPAL</span>
  </div>
</div>

<!-- FOOTER -->
<div style="position:absolute;bottom:0;left:0;right:0;height:13mm;background:linear-gradient(135deg,#3b0764,#6b21a8);display:flex;align-items:center;padding:0 2.5mm;gap:2mm;">
  <div style="width:6mm;height:6mm;border-radius:50%;background:#f59e0b;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ico(P_LOC,"3.8mm","#3b0764")}</div>
  <div style="flex:1;min-width:0;"><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR1}</div><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR2}</div></div>
  <div style="width:0.3mm;height:8mm;background:rgba(255,255,255,0.3);"></div>
  <div style="display:flex;align-items:center;gap:1.5mm;padding-left:2mm;flex-shrink:0;">
    <div style="width:6mm;height:6mm;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;">${ico(P_PHONE,"3.8mm","#3b0764")}</div>
    <span style="color:white;font-size:3.5mm;font-weight:800;">${SCHOOL_PHONE}</span>
  </div>
</div>
</div>`;
}

// ── CARD 5 — Clean Minimal (modern, white) ───────────────────────────────────
function card5(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  const cls = esc(s.std||"—")+(s.section?" - "+esc(s.section):"");
  const img = s._photo
    ? `<img src="${esc(s._photo)}" style="width:100%;height:100%;object-fit:cover;"/>`
    : `<div style="width:100%;height:100%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;">${ico(P_PERSON,"45%","#94a3b8")}</div>`;
  return `<div style="width:90mm;height:140mm;position:relative;overflow:hidden;border-radius:3mm;box-shadow:0 3mm 12mm rgba(0,0,0,0.3);font-family:Arial,Helvetica,sans-serif;background:white;border:0.4mm solid #e2e8f0;">

<!-- Top navy accent bar -->
<div style="position:absolute;top:0;left:0;right:0;height:3mm;background:#1e3a5f;"></div>
<!-- Left accent stripe -->
<div style="position:absolute;top:3mm;left:0;width:2mm;height:40mm;background:#1e3a5f;"></div>

<!-- HEADER (white with school name) -->
<div style="position:absolute;top:3mm;left:2mm;right:0;height:28mm;display:flex;align-items:center;gap:3mm;padding:0 3mm;">
  <div style="width:18mm;height:18mm;border-radius:50%;overflow:hidden;flex-shrink:0;border:0.8mm solid #1e3a5f;">
    ${logoUrl?`<img src="${esc(logoUrl)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`:`<div style="width:100%;height:100%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#1e3a5f;font-size:7mm;font-weight:900;">S</div>`}
  </div>
  <div>
    <div style="color:#64748b;font-size:1.8mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:#1e3a5f;font-size:6mm;font-weight:900;line-height:1;letter-spacing:0.3mm;">SATYAM STARS</div>
    <div style="color:#1e3a5f;font-size:3.8mm;font-weight:700;line-height:1;">INTERNATIONAL SCHOOL</div>
    <div style="color:#94a3b8;font-size:2.2mm;margin-top:0.5mm;">&#9733; ${session} &#9733;</div>
  </div>
</div>

<!-- Divider -->
<div style="position:absolute;top:31mm;left:2mm;right:3mm;height:0.4mm;background:#e2e8f0;"></div>
<div style="position:absolute;top:31mm;left:2mm;width:30mm;height:0.4mm;background:#1e3a5f;"></div>

<!-- PHOTO + NAME AREA -->
<div style="position:absolute;top:33mm;left:2mm;right:0;height:32mm;display:flex;align-items:center;gap:4mm;padding:0 4mm;">
  <!-- Square photo -->
  <div style="width:26mm;height:26mm;flex-shrink:0;overflow:hidden;border:1.5mm solid #1e3a5f;">${img}</div>
  <!-- Name + class -->
  <div style="flex:1;min-width:0;">
    <div style="color:#0f172a;font-size:4.5mm;font-weight:900;text-transform:uppercase;line-height:1.1;word-break:break-word;">${esc(s.name||"Student Name")}</div>
    <div style="margin-top:2mm;display:inline-block;background:#1e3a5f;color:white;font-size:2.5mm;font-weight:700;padding:1mm 3mm;border-radius:1mm;">Class ${cls}</div>
    <div style="color:#64748b;font-size:2.2mm;margin-top:1.5mm;">Roll No: <b style="color:#1e3a5f;">${esc(s.rollNo||"—")}</b></div>
    <div style="color:#64748b;font-size:2mm;margin-top:0.5mm;">Enr: <b style="color:#1e3a5f;">${esc(s.enrollment||"—")}</b></div>
  </div>
</div>

<!-- Divider 2 -->
<div style="position:absolute;top:66mm;left:3mm;right:3mm;height:0.4mm;background:#e2e8f0;"></div>

<!-- INFO ROWS -->
<div style="position:absolute;top:68mm;left:3mm;right:3mm;">
  ${[["Father",s.fatherName,"#1d4ed8",P_PERSON],["Mother",s.motherName,"#ea580c",P_MOTHER],["Date of Birth",fmtDOB(s.dob),"#92400e",P_CAL],["Phone",s.mobile||s.mobile1||"","#1e3a5f",P_PHONE],["Address",fmtAddr(s),"#dc2626",P_LOC]].map(([lbl,val,col,ipath])=>`
  <div style="display:flex;align-items:center;gap:2.5mm;padding:1.2mm 0;border-bottom:0.3mm solid #f1f5f9;">
    <div style="width:6.5mm;height:6.5mm;border-radius:50%;background:${col};flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ico(ipath,"3.8mm")}</div>
    <div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:1mm;overflow:hidden;">
      <span style="color:#1e3a5f;font-size:2.2mm;font-weight:700;flex-shrink:0;">${esc(lbl)}:</span>
      <span style="color:#475569;font-size:2.1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(val||"—")}</span>
    </div>
  </div>`).join("")}
</div>

<!-- PRINCIPAL -->
<div style="position:absolute;bottom:14mm;left:0;right:0;text-align:center;">
  <span style="color:#1e3a5f;font-size:3mm;font-weight:800;letter-spacing:1.5mm;">PRINCIPAL</span>
</div>

<!-- FOOTER -->
<div style="position:absolute;bottom:0;left:0;right:0;height:13mm;background:#1e3a5f;display:flex;align-items:center;padding:0 2.5mm;gap:2mm;">
  <div style="width:6mm;height:6mm;border-radius:50%;background:#3b82f6;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${ico(P_LOC,"3.8mm")}</div>
  <div style="flex:1;min-width:0;"><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR1}</div><div style="color:white;font-size:1.8mm;white-space:nowrap;">${SCHOOL_ADDR2}</div></div>
  <div style="width:0.3mm;height:8mm;background:rgba(255,255,255,0.3);"></div>
  <div style="display:flex;align-items:center;gap:1.5mm;padding-left:2mm;flex-shrink:0;">
    <div style="width:6mm;height:6mm;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;">${ico(P_PHONE,"3.8mm")}</div>
    <span style="color:white;font-size:3.5mm;font-weight:800;">${SCHOOL_PHONE}</span>
  </div>
</div>
</div>`;
}

const CARD_FNS = [null, card1, card2, card3, card4, card5];

// ── Print HTML ────────────────────────────────────────────────────────────────
function generatePrintHTML(students, designId, logoUrl) {
  const pages = [];
  for (let i = 0; i < students.length; i += 4) {
    const cards = students.slice(i, i+4).map(s =>
      `<div style="page-break-inside:avoid;">${CARD_FNS[designId](s, logoUrl)}</div>`
    ).join("");
    pages.push(`<div class="pg">${cards}</div>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ID Cards</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
@page{size:A4 portrait;margin:8mm;}
body{background:#888;font-size:0;}
.pg{display:grid;grid-template-columns:repeat(2,90mm);grid-template-rows:repeat(2,140mm);gap:5mm;page-break-after:always;background:white;width:185mm;margin:0 auto;}
.pg:last-child{page-break-after:auto;}
@media screen{body{padding:10mm;}.pg{margin:0 auto 10mm;box-shadow:0 2mm 10mm rgba(0,0,0,0.4);}}
@media print{body{background:white;}.pg{box-shadow:none;}}
</style></head><body>${pages.join("")}</body></html>`;
}

// ── Page Component ────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [activeTab, setActiveTab]   = useState("idcard");
  const [students, setStudents]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(new Set());
  const [designId, setDesignId]     = useState(1);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStudents().then(d => setStudents(d||[])).catch(()=>{}).finally(()=>setLoading(false));
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

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.enrollment));

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

  const handleGenerate = useCallback(async (previewOnly=false) => {
    const targets = students.filter(s => selected.has(s.enrollment));
    if (!targets.length) { alert("Please select at least one student."); return; }
    setGenerating(true);
    try {
      const logoUrl = window.location.origin + "/school-logo.jpg";
      const withPhotos = await Promise.all(targets.map(async s => {
        let _photo = "";
        if (s.photo) { try { _photo = (await getS3ViewUrl(s.photo))||""; } catch {} }
        return { ...s, _photo };
      }));
      const html = generatePrintHTML(previewOnly ? withPhotos.slice(0,1) : withPhotos, designId, logoUrl);
      const win = window.open("","_blank");
      if (!win) { alert("Please allow pop-ups to generate the PDF."); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      if (!previewOnly) setTimeout(() => win.print(), 900);
    } finally { setGenerating(false); }
  }, [students, selected, designId]);

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate ID cards, certificates and official documents</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab===key?"border-school-navy text-school-navy":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab !== "idcard" && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">Coming Soon</p>
          <p className="text-sm text-gray-400">This module is under development</p>
        </div>
      )}

      {activeTab === "idcard" && (
        <div className="flex flex-col gap-5">

          {/* Design picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-school-navy" /> Select Card Design
            </h2>
            <div className="flex gap-4 flex-wrap">
              {DESIGNS.map(d => (
                <button key={d.id} onClick={() => setDesignId(d.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${designId===d.id?"border-school-navy shadow-md":"border-gray-200 hover:border-gray-300"}`}>
                  {/* Mini card preview */}
                  <div style={{ width:56, height:88, position:"relative", overflow:"hidden", borderRadius:4,
                    background: d.id===5?"white":d.hdr,
                    border: d.id===5?`2px solid ${d.hdr}`:"none",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }}>
                    {/* Header */}
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:32, background:d.hdr, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"3px 4px" }}>
                      <div style={{ color:d.acc=="#1e3a5f"?"white":d.acc, fontSize:5, fontWeight:900, lineHeight:1.1, fontFamily:"Arial" }}>SATYAM STARS</div>
                      <div style={{ color:d.gld, fontSize:3.5, fontFamily:"Arial" }}>INT. SCHOOL</div>
                      <div style={{ color:d.gld, fontSize:3, fontFamily:"Arial" }}>★ 2025-26 ★</div>
                    </div>
                    {/* Photo circle */}
                    <div style={{ position:"absolute", top:20, left:"50%", transform:"translateX(-50%)", width:22, height:22, borderRadius:"50%", background:d.acc, border:`2px solid ${d.gld}`, zIndex:5 }} />
                    {/* Name ribbon */}
                    <div style={{ position:"absolute", top:44, left:2, right:2, height:6, background:d.acc, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:"white", fontSize:3, fontFamily:"Arial", fontWeight:700 }}>STUDENT NAME</span>
                    </div>
                    {/* Info rows */}
                    <div style={{ position:"absolute", top:52, left:3, right:3, display:"flex", flexDirection:"column", gap:2 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ height:3, background:"#f1f5f9", borderRadius:1 }} />)}
                    </div>
                    {/* Footer */}
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:10, background:d.hdr, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:d.gld, fontSize:3, fontFamily:"Arial" }}>SCHOOL FOOTER</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700">{d.name}</div>
                    <div className="text-[10px] text-gray-400">{d.desc}</div>
                  </div>
                  {designId===d.id && <div className="w-2 h-2 rounded-full bg-school-navy" />}
                </button>
              ))}
            </div>
          </div>

          {/* Filters + Student list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search by name, enrollment, father name..." value={search}
                  onChange={e=>setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy" />
                {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5"/></button>}
              </div>
              <select value={classFilter} onChange={e=>{setClassFilter(e.target.value);setSelected(new Set());}}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-36">
                <option value="All">All Classes</option>
                {CLASSES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                <Users className="w-4 h-4"/>{filtered.length} students
              </div>
            </div>

            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-school-navy" />
                  Select all {filtered.length} students
                </label>
                {selected.size > 0 && (
                  <span className="text-xs text-school-navy font-semibold bg-school-navy/10 px-2.5 py-1 rounded-full">{selected.size} selected</span>
                )}
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading students...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <GraduationCap className="w-10 h-10 text-gray-200"/>
                  <p className="text-sm text-gray-400">No students found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                    <tr>
                      <th className="w-10 px-4 py-2.5"></th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Class</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Father</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Enrollment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(s => {
                      const isSel = selected.has(s.enrollment);
                      return (
                        <tr key={s.enrollment} onClick={()=>toggleOne(s.enrollment)}
                          className={`cursor-pointer transition-colors ${isSel?"bg-school-navy/5":"hover:bg-gray-50"}`}>
                          <td className="px-4 py-2.5">
                            <input type="checkbox" checked={isSel} onChange={()=>{}} className="w-4 h-4 accent-school-navy" />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                {s.photo ? <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-4 h-4 text-gray-400"/></div>}
                              </div>
                              <span className="font-medium text-gray-800">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{s.std}{s.section?` - ${s.section}`:""}</td>
                          <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">{s.fatherName||"—"}</td>
                          <td className="px-3 py-2.5 text-gray-500 font-mono text-xs hidden lg:table-cell">{s.enrollment}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-school-navy" />
              <span className="text-sm text-gray-600">
                <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size!==1?"s":""} selected
              </span>
              {selected.size > 0 && (
                <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="w-3 h-3"/> Clear
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>handleGenerate(true)} disabled={selected.size===0||generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-school-navy text-school-navy text-sm font-medium hover:bg-school-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Eye className="w-4 h-4"/> Preview
              </button>
              <button onClick={()=>handleGenerate(false)} disabled={selected.size===0||generating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                {generating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Printer className="w-4 h-4"/>}
                {generating ? "Preparing..." : `Generate PDF (${selected.size})`}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center -mt-2">
            Print dialog opens automatically. Choose "Save as PDF" to download. 4 cards per A4 page (90mm × 140mm each).
          </p>
        </div>
      )}
    </div>
  );
}
