"use client";

import { useState, useEffect, useCallback } from "react";
import { getStudents } from "@/lib/studentService";
import { getS3ViewUrl } from "@/lib/s3Upload";
import S3Image from "@/components/S3Image";
import {
  CreditCard, Award, FileText, Search, Printer,
  Users, Eye, GraduationCap, Filter, X, CheckSquare
} from "lucide-react";

const SCHOOL_TRUST = "Satyam Education Charitable Trust (E-8941)";
const SCHOOL_ADDR = "Swaminarayan Nagar - Bhidbhanjan Society, Pandesara - Udhna, Surat - 394210";
const SCHOOL_PHONE = "8200069691";

const CLASSES_LIST = [
  "JR.KG","SR.KG","Balvatika",
  "1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th",
  "11th - Commerce","12th - Commerce",
];

const DESIGNS = [
  { id: 1, name: "Satyam Classic", desc: "Navy & Orange", hdr: "#1e3a5f", acc: "#f97316", gld: "#f59e0b" },
  { id: 2, name: "Royal Blue",     desc: "Blue & Silver",  hdr: "#1a237e", acc: "#90caf9", gld: "#ffd700" },
  { id: 3, name: "Forest Green",   desc: "Green & Gold",   hdr: "#1b5e20", acc: "#f59e0b", gld: "#f59e0b" },
  { id: 4, name: "Maroon Heritage",desc: "Maroon & Gold",  hdr: "#7b1a1a", acc: "#d4af37", gld: "#d4af37" },
  { id: 5, name: "Clean Minimal",  desc: "White & Navy",   hdr: "#1e3a5f", acc: "#1e3a5f", gld: "#1e3a5f" },
];

const SUB_TABS = [
  { key: "idcard",    label: "ID Card",    icon: CreditCard },
  { key: "marksheet", label: "Marksheet",  icon: Award      },
  { key: "bonafide",  label: "Bonafide",   icon: FileText   },
  { key: "noc",       label: "NOC",        icon: FileText   },
  { key: "tc",        label: "TC",         icon: FileText   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDOB(dob) {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return String(dob);
  return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
}
function fmtAddr(s) {
  return [s.roomPlotNo, s.address].filter(Boolean).join(", ") || "—";
}
function esc(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function photoEl(url, circular) {
  const shape = circular ? "border-radius:50%;" : "";
  const avatar = `<div style="width:100%;height:100%;${shape}background:#e5e7eb;display:flex;align-items:center;justify-content:center;"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='50%' fill='#9ca3af'><path d='M12 12c2.66 0 4.8-2.14 4.8-4.8S14.66 2.4 12 2.4 7.2 4.54 7.2 7.2 9.34 12 12 12zm0 2.4c-3.21 0-9.6 1.61-9.6 4.8v2.4h19.2v-2.4c0-3.19-6.39-4.8-9.6-4.8z'/></svg></div>`;
  if (!url) return avatar;
  return `<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;${shape}" onerror="this.parentNode.innerHTML='${avatar.replace(/'/g,"&#39;")}'"/>`;
}

// ── Card designs ──────────────────────────────────────────────────────────────

function card1(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  return `<div style="width:92mm;height:135mm;overflow:hidden;border-radius:3.5mm;box-shadow:0 1.5mm 5mm rgba(0,0,0,0.25);display:flex;flex-direction:column;background:white;font-family:Arial,sans-serif;">
  <div style="background:#1e3a5f;position:relative;overflow:hidden;flex-shrink:0;padding:2.5mm 3mm 0;">
    <div style="position:absolute;top:-6mm;right:-6mm;width:28mm;height:28mm;background:#f97316;border-radius:50%;opacity:0.85;"></div>
    <div style="position:absolute;top:-3mm;right:3mm;width:18mm;height:18mm;background:#f97316;border-radius:50%;opacity:0.45;"></div>
    <div style="position:relative;z-index:2;display:flex;align-items:flex-start;gap:2mm;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" style="width:10mm;height:10mm;border-radius:50%;object-fit:cover;border:0.5mm solid #f59e0b;flex-shrink:0;" onerror="this.style.display='none'"/>` : `<div style="width:10mm;height:10mm;border-radius:50%;background:#f97316;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:white;font-size:4.5mm;font-weight:900;">S</div>`}
      <div style="flex:1;min-width:0;">
        <div style="color:#fbbf24;font-size:1.7mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
        <div style="color:white;font-size:4mm;font-weight:900;line-height:1;letter-spacing:0.3mm;">SATYAM STARS</div>
        <div style="color:#fbbf24;font-size:2.8mm;font-weight:700;letter-spacing:0.2mm;">INTERNATIONAL SCHOOL</div>
      </div>
    </div>
    <div style="position:relative;z-index:2;text-align:center;color:#fbbf24;font-size:2.2mm;padding:1mm 0 2mm;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
  </div>
  <div style="display:flex;justify-content:center;padding:2.5mm 0 1.5mm;background:white;flex-shrink:0;">
    <div style="width:22mm;height:22mm;border-radius:50%;border:1.5mm solid #f59e0b;padding:0.8mm;box-shadow:0 0 0 0.5mm #f97316;overflow:hidden;">${photoEl(s._photo, true)}</div>
  </div>
  <div style="background:#f97316;text-align:center;padding:1.2mm 3mm;color:white;font-weight:800;font-size:3mm;text-transform:uppercase;letter-spacing:0.3mm;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name||"Student Name")}</div>
  <div style="background:#fef3c7;text-align:center;padding:0.7mm;color:#92400e;font-size:2.5mm;font-weight:600;flex-shrink:0;">Class: ${esc(s.std||"—")}${s.section ? " - " + esc(s.section) : ""} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</div>
  <div style="flex:1;padding:1.5mm 3mm;display:flex;flex-direction:column;gap:1.3mm;background:white;overflow:hidden;">
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Father:</span> <b style="color:#111;">${esc(s.fatherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;border-radius:50%;background:#ec4899;flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Mother:</span> <b style="color:#111;">${esc(s.motherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;border-radius:50%;background:#10b981;flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">DOB:</span> <b style="color:#111;">${fmtDOB(s.dob)}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Phone:</span> <b style="color:#111;">${esc(s.mobile||s.mobile1||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;border-radius:50%;background:#8b5cf6;flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:1.9mm;line-height:1.3;overflow:hidden;"><span style="color:#6b7280;">Addr:</span> <b style="color:#111;">${esc(fmtAddr(s))}</b></div></div>
  </div>
  <div style="background:#1e3a5f;padding:1.5mm 3mm;flex-shrink:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><div style="color:#f97316;font-size:1.9mm;font-weight:700;">PRINCIPAL</div><div style="color:#fbbf24;font-size:1.6mm;">Enr: ${esc(s.enrollment||"—")}</div></div>
    <div style="color:#94a3b8;font-size:1.55mm;text-align:center;margin-top:0.3mm;">${esc(SCHOOL_ADDR)}</div>
    <div style="color:#94a3b8;font-size:1.55mm;text-align:center;">Ph: ${SCHOOL_PHONE}</div>
  </div>
</div>`;
}

function card2(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  return `<div style="width:92mm;height:135mm;overflow:hidden;border-radius:3.5mm;box-shadow:0 1.5mm 5mm rgba(0,0,0,0.25);display:flex;flex-direction:column;background:white;font-family:Arial,sans-serif;">
  <div style="background:linear-gradient(160deg,#0d1b3e 0%,#1565c0 100%);padding:3mm;flex-shrink:0;text-align:center;">
    <div style="display:flex;justify-content:center;margin-bottom:1mm;">${logoUrl ? `<img src="${esc(logoUrl)}" style="width:10mm;height:10mm;border-radius:50%;object-fit:cover;border:0.5mm solid #90caf9;" onerror="this.style.display='none'"/>` : `<div style="width:10mm;height:10mm;border-radius:50%;background:#1565c0;border:0.5mm solid #90caf9;display:flex;align-items:center;justify-content:center;color:white;font-size:4.5mm;font-weight:900;">S</div>`}</div>
    <div style="color:#90caf9;font-size:1.7mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:4mm;font-weight:900;letter-spacing:0.5mm;line-height:1.1;">SATYAM STARS</div>
    <div style="color:#90caf9;font-size:2.8mm;font-weight:700;">INTERNATIONAL SCHOOL</div>
    <div style="color:#ffd700;font-size:2.2mm;margin-top:1mm;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
  </div>
  <div style="background:#f0f4f8;display:flex;justify-content:center;padding:2.5mm 0 1.5mm;flex-shrink:0;">
    <div style="width:22mm;height:22mm;border:1.5mm solid #c0c0c0;box-shadow:0 0 0 0.5mm #9e9e9e;overflow:hidden;">${photoEl(s._photo, false)}</div>
  </div>
  <div style="background:#1565c0;text-align:center;padding:1.2mm 3mm;color:white;font-weight:800;font-size:3mm;text-transform:uppercase;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name||"Student Name")}</div>
  <div style="background:#e3f2fd;text-align:center;padding:0.7mm;color:#1565c0;font-size:2.5mm;font-weight:600;flex-shrink:0;">Class: ${esc(s.std||"—")}${s.section ? " - " + esc(s.section) : ""} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</div>
  <div style="flex:1;padding:1.5mm 3mm;display:flex;flex-direction:column;gap:1.3mm;background:white;overflow:hidden;">
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:1mm;height:auto;background:#1565c0;align-self:stretch;flex-shrink:0;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Father:</span> <b style="color:#111;">${esc(s.fatherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:1mm;height:auto;background:#1565c0;align-self:stretch;flex-shrink:0;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Mother:</span> <b style="color:#111;">${esc(s.motherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:1mm;height:auto;background:#1565c0;align-self:stretch;flex-shrink:0;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">DOB:</span> <b style="color:#111;">${fmtDOB(s.dob)}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:1mm;height:auto;background:#1565c0;align-self:stretch;flex-shrink:0;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Phone:</span> <b style="color:#111;">${esc(s.mobile||s.mobile1||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:1mm;height:auto;background:#1565c0;align-self:stretch;flex-shrink:0;"></div><div style="font-size:1.9mm;line-height:1.3;overflow:hidden;"><span style="color:#6b7280;">Addr:</span> <b style="color:#111;">${esc(fmtAddr(s))}</b></div></div>
  </div>
  <div style="background:#0d1b3e;padding:1.5mm 3mm;flex-shrink:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><div style="color:#90caf9;font-size:1.9mm;font-weight:700;">PRINCIPAL</div><div style="color:#ffd700;font-size:1.6mm;">Enr: ${esc(s.enrollment||"—")}</div></div>
    <div style="color:#90caf9;font-size:1.55mm;text-align:center;margin-top:0.3mm;">${esc(SCHOOL_ADDR)}</div>
    <div style="color:#90caf9;font-size:1.55mm;text-align:center;">Ph: ${SCHOOL_PHONE}</div>
  </div>
</div>`;
}

function card3(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  return `<div style="width:92mm;height:135mm;overflow:hidden;border-radius:3.5mm;box-shadow:0 1.5mm 5mm rgba(0,0,0,0.25);display:flex;flex-direction:column;background:white;font-family:Arial,sans-serif;">
  <div style="background:#1b5e20;position:relative;overflow:hidden;flex-shrink:0;padding:2.5mm 3mm 0;">
    <div style="position:absolute;top:-5mm;right:-5mm;width:22mm;height:22mm;background:#f59e0b;opacity:0.25;transform:rotate(45deg);"></div>
    <div style="position:absolute;bottom:-4mm;left:-4mm;width:18mm;height:18mm;background:#f59e0b;opacity:0.2;transform:rotate(45deg);"></div>
    <div style="position:relative;z-index:2;display:flex;align-items:flex-start;gap:2mm;">
      ${logoUrl ? `<img src="${esc(logoUrl)}" style="width:10mm;height:10mm;border-radius:50%;object-fit:cover;border:0.5mm solid #f59e0b;flex-shrink:0;" onerror="this.style.display='none'"/>` : `<div style="width:10mm;height:10mm;border-radius:50%;background:#2e7d32;border:0.5mm solid #f59e0b;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#f59e0b;font-size:4.5mm;font-weight:900;">S</div>`}
      <div style="flex:1;min-width:0;">
        <div style="color:#a5d6a7;font-size:1.7mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
        <div style="color:white;font-size:4mm;font-weight:900;line-height:1;letter-spacing:0.3mm;">SATYAM STARS</div>
        <div style="color:#f59e0b;font-size:2.8mm;font-weight:700;">INTERNATIONAL SCHOOL</div>
      </div>
    </div>
    <div style="position:relative;z-index:2;text-align:center;color:#f59e0b;font-size:2.2mm;padding:1mm 0 2mm;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
  </div>
  <div style="display:flex;justify-content:center;padding:2.5mm 0 1.5mm;background:white;flex-shrink:0;">
    <div style="width:22mm;height:22mm;border-radius:50%;border:1.5mm solid #f59e0b;padding:0.8mm;box-shadow:0 0 0 0.5mm #1b5e20;overflow:hidden;">${photoEl(s._photo, true)}</div>
  </div>
  <div style="background:#2e7d32;text-align:center;padding:1.2mm 3mm;color:#f59e0b;font-weight:800;font-size:3mm;text-transform:uppercase;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name||"Student Name")}</div>
  <div style="background:#e8f5e9;text-align:center;padding:0.7mm;color:#1b5e20;font-size:2.5mm;font-weight:600;flex-shrink:0;">Class: ${esc(s.std||"—")}${s.section ? " - " + esc(s.section) : ""} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</div>
  <div style="flex:1;padding:1.5mm 3mm;display:flex;flex-direction:column;gap:1.3mm;background:white;overflow:hidden;">
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;background:#f59e0b;transform:rotate(45deg);flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Father:</span> <b style="color:#111;">${esc(s.fatherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;background:#f59e0b;transform:rotate(45deg);flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Mother:</span> <b style="color:#111;">${esc(s.motherName||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;background:#f59e0b;transform:rotate(45deg);flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">DOB:</span> <b style="color:#111;">${fmtDOB(s.dob)}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;background:#f59e0b;transform:rotate(45deg);flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:2mm;line-height:1.4;"><span style="color:#6b7280;">Phone:</span> <b style="color:#111;">${esc(s.mobile||s.mobile1||"—")}</b></div></div>
    <div style="display:flex;gap:1.5mm;align-items:flex-start;"><div style="width:3mm;height:3mm;background:#f59e0b;transform:rotate(45deg);flex-shrink:0;margin-top:0.8mm;"></div><div style="font-size:1.9mm;line-height:1.3;overflow:hidden;"><span style="color:#6b7280;">Addr:</span> <b style="color:#111;">${esc(fmtAddr(s))}</b></div></div>
  </div>
  <div style="background:#1b5e20;padding:1.5mm 3mm;flex-shrink:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><div style="color:#f59e0b;font-size:1.9mm;font-weight:700;">PRINCIPAL</div><div style="color:#a5d6a7;font-size:1.6mm;">Enr: ${esc(s.enrollment||"—")}</div></div>
    <div style="color:#a5d6a7;font-size:1.55mm;text-align:center;margin-top:0.3mm;">${esc(SCHOOL_ADDR)}</div>
    <div style="color:#a5d6a7;font-size:1.55mm;text-align:center;">Ph: ${SCHOOL_PHONE}</div>
  </div>
</div>`;
}

function card4(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  return `<div style="width:92mm;height:135mm;overflow:hidden;border-radius:3.5mm;box-shadow:0 1.5mm 5mm rgba(0,0,0,0.25);display:flex;flex-direction:column;background:white;font-family:'Georgia',serif;">
  <div style="background:#7b1a1a;border-bottom:1.5mm solid #d4af37;padding:2.5mm 3mm;flex-shrink:0;text-align:center;position:relative;">
    <div style="position:absolute;top:1mm;left:2mm;right:2mm;border-top:0.4mm solid #d4af37;"></div>
    <div style="display:flex;justify-content:center;margin-bottom:1mm;">${logoUrl ? `<img src="${esc(logoUrl)}" style="width:10mm;height:10mm;border-radius:50%;object-fit:cover;border:0.5mm solid #d4af37;" onerror="this.style.display='none'"/>` : `<div style="width:10mm;height:10mm;border-radius:50%;background:#5d1212;border:0.5mm solid #d4af37;display:flex;align-items:center;justify-content:center;color:#d4af37;font-size:4.5mm;font-weight:900;">S</div>`}</div>
    <div style="color:#e8c97a;font-size:1.7mm;line-height:1.3;">${esc(SCHOOL_TRUST)}</div>
    <div style="color:white;font-size:4mm;font-weight:900;letter-spacing:0.5mm;line-height:1.1;">SATYAM STARS</div>
    <div style="color:#d4af37;font-size:2.8mm;font-weight:700;letter-spacing:0.3mm;">INTERNATIONAL SCHOOL</div>
    <div style="color:#d4af37;font-size:2.2mm;margin-top:0.5mm;letter-spacing:0.8mm;">&#9733; ${session} &#9733;</div>
    <div style="position:absolute;bottom:1.5mm;left:2mm;right:2mm;border-bottom:0.4mm solid #d4af37;"></div>
  </div>
  <div style="display:flex;justify-content:center;padding:2mm 0 1.5mm;background:#fdf8f0;flex-shrink:0;">
    <div style="width:22mm;height:22mm;border-radius:50%;border:1.5mm solid #d4af37;padding:0.8mm;box-shadow:0 0 0 0.5mm #7b1a1a,0 0 0 1mm #d4af37;overflow:hidden;">${photoEl(s._photo, true)}</div>
  </div>
  <div style="background:#7b1a1a;text-align:center;padding:1.2mm 3mm;color:#d4af37;font-weight:900;font-size:3mm;text-transform:uppercase;letter-spacing:0.5mm;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name||"Student Name")}</div>
  <div style="background:#fdf8f0;border-bottom:0.3mm solid #d4af37;text-align:center;padding:0.7mm;color:#7b1a1a;font-size:2.5mm;font-weight:700;flex-shrink:0;">Class: ${esc(s.std||"—")}${s.section ? " - " + esc(s.section) : ""} &nbsp;|&nbsp; Roll: ${esc(s.rollNo||"—")}</div>
  <div style="flex:1;padding:1.5mm 3mm;display:flex;flex-direction:column;gap:0;background:white;overflow:hidden;">
    ${[["Father",s.fatherName],["Mother",s.motherName],["DOB",fmtDOB(s.dob)],["Phone",s.mobile||s.mobile1||"—"],["Addr",fmtAddr(s)]].map(([lbl,val],i)=>`<div style="display:flex;gap:2mm;align-items:flex-start;padding:1mm 0;${i<4?"border-bottom:0.3mm solid #f5e6c8;":""}"><span style="color:#7b1a1a;font-size:1.9mm;font-weight:700;flex-shrink:0;min-width:10mm;">${lbl}:</span><span style="font-size:1.9mm;color:#111;line-height:1.4;">${esc(String(val||"—"))}</span></div>`).join("")}
  </div>
  <div style="background:#7b1a1a;border-top:1mm solid #d4af37;padding:1.5mm 3mm;flex-shrink:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;"><div style="color:#d4af37;font-size:1.9mm;font-weight:700;letter-spacing:0.3mm;">PRINCIPAL</div><div style="color:#e8c97a;font-size:1.6mm;">Enr: ${esc(s.enrollment||"—")}</div></div>
    <div style="color:#e8c97a;font-size:1.55mm;text-align:center;margin-top:0.3mm;">${esc(SCHOOL_ADDR)}</div>
    <div style="color:#e8c97a;font-size:1.55mm;text-align:center;">Ph: ${SCHOOL_PHONE}</div>
  </div>
</div>`;
}

function card5(s, logoUrl) {
  const session = esc(s.session || "2025-26");
  return `<div style="width:92mm;height:135mm;overflow:hidden;border-radius:3.5mm;box-shadow:0 1.5mm 5mm rgba(0,0,0,0.2);display:flex;flex-direction:column;background:white;border:0.3mm solid #e0e0e0;font-family:Arial,sans-serif;">
  <div style="background:#1e3a5f;height:2mm;flex-shrink:0;"></div>
  <div style="padding:2mm 3mm;flex-shrink:0;display:flex;align-items:center;gap:2mm;border-bottom:0.3mm solid #e0e0e0;">
    ${logoUrl ? `<img src="${esc(logoUrl)}" style="width:10mm;height:10mm;border-radius:50%;object-fit:cover;border:0.5mm solid #1e3a5f;flex-shrink:0;" onerror="this.style.display='none'"/>` : `<div style="width:10mm;height:10mm;border-radius:50%;background:#f1f5f9;border:0.5mm solid #1e3a5f;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#1e3a5f;font-size:4.5mm;font-weight:900;">S</div>`}
    <div>
      <div style="color:#64748b;font-size:1.6mm;">${esc(SCHOOL_TRUST)}</div>
      <div style="color:#1e3a5f;font-size:3.5mm;font-weight:900;letter-spacing:0.3mm;">SATYAM STARS INT. SCHOOL</div>
      <div style="color:#64748b;font-size:1.8mm;">&#9733; ${session} &#9733;</div>
    </div>
  </div>
  <div style="display:flex;gap:3mm;padding:2.5mm 3mm;background:#f8fafc;flex-shrink:0;border-bottom:0.3mm solid #e0e0e0;align-items:center;">
    <div style="width:20mm;height:20mm;border:0.8mm solid #1e3a5f;flex-shrink:0;overflow:hidden;">${photoEl(s._photo, false)}</div>
    <div>
      <div style="color:#1e3a5f;font-size:3.2mm;font-weight:800;text-transform:uppercase;line-height:1.2;">${esc(s.name||"Student Name")}</div>
      <div style="color:#475569;font-size:2.3mm;margin-top:0.5mm;">Class: <b style="color:#1e3a5f;">${esc(s.std||"—")}${s.section ? " - " + esc(s.section) : ""}</b></div>
      <div style="color:#475569;font-size:2mm;">Roll: <b style="color:#1e3a5f;">${esc(s.rollNo||"—")}</b> &nbsp; Enr: <b style="color:#1e3a5f;">${esc(s.enrollment||"—")}</b></div>
    </div>
  </div>
  <div style="flex:1;padding:1.5mm 3mm;display:flex;flex-direction:column;gap:0;background:white;overflow:hidden;">
    ${[["Father's Name",s.fatherName],["Mother's Name",s.motherName],["Date of Birth",fmtDOB(s.dob)],["Phone",s.mobile||s.mobile1||"—"],["Address",fmtAddr(s)]].map(([lbl,val],i)=>`<div style="display:flex;gap:1mm;padding:1mm 0;${i<4?"border-bottom:0.3mm solid #f1f5f9;":""}"><span style="color:#1e3a5f;font-size:2mm;font-weight:700;flex-shrink:0;min-width:22mm;">${esc(lbl)}:</span><span style="font-size:2mm;color:#334155;line-height:1.4;">${esc(String(val||"—"))}</span></div>`).join("")}
  </div>
  <div style="border-top:0.3mm solid #e0e0e0;padding:1.2mm 3mm;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
    <div style="color:#1e3a5f;font-size:1.9mm;font-weight:700;">PRINCIPAL</div>
    <div style="color:#64748b;font-size:1.6mm;">Ph: ${SCHOOL_PHONE}</div>
  </div>
  <div style="color:#94a3b8;font-size:1.5mm;text-align:center;padding:0.5mm 2mm;background:#f8fafc;flex-shrink:0;">${esc(SCHOOL_ADDR)}</div>
  <div style="background:#1e3a5f;height:2mm;flex-shrink:0;"></div>
</div>`;
}

const CARD_FNS = [null, card1, card2, card3, card4, card5];

// ── Print HTML wrapper ────────────────────────────────────────────────────────

function generatePrintHTML(students, designId, logoUrl) {
  const pages = [];
  for (let i = 0; i < students.length; i += 4) {
    const chunk = students.slice(i, i + 4);
    const cards = chunk.map(s => `<div class="card-slot">${CARD_FNS[designId](s, logoUrl)}</div>`).join("");
    pages.push(`<div class="page">${cards}</div>`);
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ID Cards — Satyam Stars International School</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 8mm; }
body { background: #888; font-size: 0; }
.page {
  display: grid;
  grid-template-columns: repeat(2, 92mm);
  grid-template-rows: repeat(2, 135mm);
  gap: 5mm;
  page-break-after: always;
  background: white;
  padding: 0;
  width: 194mm;
  margin: 0 auto;
}
.page:last-child { page-break-after: auto; }
.card-slot { page-break-inside: avoid; }
@media print {
  body { background: white; }
  .page { margin: 0; box-shadow: none; }
}
@media screen {
  body { padding: 10mm; }
  .page { margin: 0 auto 10mm; box-shadow: 0 2mm 8mm rgba(0,0,0,0.3); }
}
</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("idcard");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [designId, setDesignId] = useState(1);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStudents()
      .then(data => setStudents(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s => {
    if (classFilter !== "All" && s.std !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.enrollment || "").toLowerCase().includes(q) ||
        (s.fatherName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.enrollment));

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach(s => next.delete(s.enrollment));
      } else {
        filtered.forEach(s => next.add(s.enrollment));
      }
      return next;
    });
  }, [filtered, allSelected]);

  const toggleOne = useCallback((enr) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(enr)) next.delete(enr); else next.add(enr);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async (previewOnly = false) => {
    const targets = students.filter(s => selected.has(s.enrollment));
    if (targets.length === 0) { alert("Please select at least one student."); return; }

    setGenerating(true);
    try {
      const logoUrl = window.location.origin + "/school-logo.jpg";
      const withPhotos = await Promise.all(
        targets.map(async (s) => {
          let _photo = "";
          if (s.photo) {
            try { _photo = (await getS3ViewUrl(s.photo)) || ""; } catch {}
          }
          return { ...s, _photo };
        })
      );

      const list = previewOnly ? withPhotos.slice(0, 1) : withPhotos;
      const html = generatePrintHTML(list, designId, logoUrl);
      const win = window.open("", "_blank");
      if (!win) { alert("Please allow pop-ups to generate the PDF."); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      if (!previewOnly) setTimeout(() => win.print(), 800);
    } finally {
      setGenerating(false);
    }
  }, [students, selected, designId]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate ID cards, certificates, and official documents</p>
      </div>

      {/* Sub-module tabs */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-school-navy text-school-navy"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Coming soon for non-idcard tabs */}
      {activeTab !== "idcard" && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <FileText className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">Coming Soon</p>
          <p className="text-sm text-gray-400">This module is under development</p>
        </div>
      )}

      {/* ID Card section */}
      {activeTab === "idcard" && (
        <div className="flex flex-col gap-5">
          {/* Design picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-school-navy" /> Select Card Design
            </h2>
            <div className="flex gap-3 flex-wrap">
              {DESIGNS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDesignId(d.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    designId === d.id
                      ? "border-school-navy shadow-md scale-105"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Mini design preview */}
                  <div
                    className="w-14 h-20 rounded-lg overflow-hidden relative flex flex-col shadow"
                    style={{ background: d.id === 5 ? "white" : d.hdr, border: d.id === 5 ? `2px solid ${d.hdr}` : "none" }}
                  >
                    <div className="h-7 flex items-center justify-center px-1" style={{ background: d.hdr }}>
                      <div className="text-center">
                        <div style={{ color: d.acc, fontSize: "3px", fontWeight: "bold", letterSpacing: "0.5px" }}>SATYAM STARS</div>
                        <div style={{ color: d.gld, fontSize: "2.5px" }}>INT. SCHOOL</div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-white px-1">
                      <div className="w-6 h-6 rounded-full border-2 bg-gray-100" style={{ borderColor: d.gld }} />
                      <div className="w-full h-2 rounded text-center flex items-center justify-center" style={{ background: d.acc }}>
                        <span style={{ color: "white", fontSize: "2.5px", fontWeight: "bold" }}>NAME</span>
                      </div>
                      <div className="w-full flex flex-col gap-0.5 mt-0.5">
                        {[1,2,3].map(i => <div key={i} className="w-full h-0.5 rounded" style={{ background: "#e5e7eb" }} />)}
                      </div>
                    </div>
                    <div className="h-3 flex items-center justify-center" style={{ background: d.hdr }}>
                      <span style={{ color: d.acc, fontSize: "2.5px" }}>SCHOOL ADDRESS</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold text-gray-700">{d.name}</div>
                    <div className="text-[10px] text-gray-400">{d.desc}</div>
                  </div>
                  {designId === d.id && (
                    <div className="w-2 h-2 rounded-full bg-school-navy" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Filters + Student list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, enrollment, father's name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-school-navy"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <select
                value={classFilter}
                onChange={e => { setClassFilter(e.target.value); setSelected(new Set()); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-school-navy min-w-36"
              >
                <option value="All">All Classes</option>
                {CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap">
                <Users className="w-4 h-4" />
                <span>{filtered.length} students</span>
              </div>
            </div>

            {/* Select all row */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-school-navy"
                  />
                  Select all {filtered.length} students
                </label>
                {selected.size > 0 && (
                  <span className="text-xs text-school-navy font-semibold bg-school-navy/10 px-2.5 py-1 rounded-full">
                    {selected.size} selected
                  </span>
                )}
              </div>
            )}

            {/* Student list */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-8 h-8 border-2 border-school-navy/20 border-t-school-navy rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading students...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <GraduationCap className="w-10 h-10 text-gray-200" />
                  <p className="text-sm text-gray-400">No students found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                    <tr>
                      <th className="w-10 px-4 py-2.5 text-left"></th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Class</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Father</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Enrollment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(s => {
                      const isSelected = selected.has(s.enrollment);
                      return (
                        <tr
                          key={s.enrollment}
                          className={`cursor-pointer transition-colors ${isSelected ? "bg-school-navy/5" : "hover:bg-gray-50"}`}
                          onClick={() => toggleOne(s.enrollment)}
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 accent-school-navy"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                                {s.photo ? (
                                  <S3Image s3Key={s.photo} alt={s.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <GraduationCap className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <span className="font-medium text-gray-800">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{s.std}{s.section ? ` - ${s.section}` : ""}</td>
                          <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">{s.fatherName || "—"}</td>
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
              <div className="flex items-center gap-2 text-sm">
                <CheckSquare className="w-4 h-4 text-school-navy" />
                <span className="text-gray-600">
                  <span className="font-bold text-school-navy">{selected.size}</span> student{selected.size !== 1 ? "s" : ""} selected
                </span>
              </div>
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleGenerate(true)}
                disabled={selected.size === 0 || generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-school-navy text-school-navy text-sm font-medium hover:bg-school-navy/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => handleGenerate(false)}
                disabled={selected.size === 0 || generating}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-school-navy text-white text-sm font-medium hover:bg-school-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {generating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                {generating ? "Preparing..." : `Generate PDF (${selected.size})`}
              </button>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-400 text-center -mt-2">
            A print dialog will open. Choose "Save as PDF" in your browser to download the ID cards.
            &nbsp;4 cards per A4 page.
          </p>
        </div>
      )}
    </div>
  );
}
