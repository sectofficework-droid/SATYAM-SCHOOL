"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Flag, PartyPopper, Sparkles, Users, FileText, Palmtree, Moon, Sun, Gift, Star,
  CalendarDays, CalendarHeart, BookOpenCheck, PenSquare, GraduationCap, School, Trophy,
  Music, Camera, Cake, Heart, X, Trash2, Download, FileSpreadsheet, Save, RotateCcw,
} from "lucide-react";
import { YEAR_PLAN_CATEGORIES, YEAR_PLAN_ICON_CHOICES, ACADEMIC_MONTHS, SEED_YEAR_PLAN_EVENTS } from "@/lib/yearPlanData";
import { isValidLength } from "@/lib/validators";
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, bulkAddCalendarEvents, resetCalendarEvents } from "@/lib/calendarService";

const ICONS = {
  Flag, PartyPopper, Sparkles, Users, FileText, Palmtree, Moon, Sun, Gift, Star,
  CalendarDays, CalendarHeart, BookOpenCheck, PenSquare, GraduationCap, School, Trophy,
  Music, Camera, Cake, Heart,
};

const CAT_BY_KEY = Object.fromEntries(YEAR_PLAN_CATEGORIES.map(c => [c.key, c]));
const WEEKDAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(year, month, day) { return `${year}-${pad(month)}-${pad(day)}`; }
function weekdayOf(year, month, day) { return WEEKDAYS[new Date(year, month - 1, day).getDay()]; }

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
}

export default function YearPlanningTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { mode:"add", date } | { mode:"edit", event }
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      let data = await getCalendarEvents();
      // First time this table is used: seed it with the verified 2026-27
      // calendar instead of leaving the admin to re-enter ~80 events by
      // hand (this used to live only in the browser's localStorage).
      if (data.length === 0) {
        await bulkAddCalendarEvents(SEED_YEAR_PLAN_EVENTS);
        data = await getCalendarEvents();
      }
      setEvents(data);
    } catch {
      // leave events empty - the grid still renders, just without data
    } finally {
      setLoading(false);
    }
  }

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => { (map[e.date] ||= []).push(e); });
    return map;
  }, [events]);

  function openAdd(date)   { setModal({ mode:"add", date, category: YEAR_PLAN_CATEGORIES[0].key, label:"", icon:"" }); setModalError(""); }
  function openEdit(ev)    { setModal({ mode:"edit", id: ev.id, date: ev.date, category: ev.category, label: ev.label, icon: ev.icon || "" }); setModalError(""); }
  function closeModal()    { setModal(null); setModalError(""); }

  async function saveModal() {
    if (!isValidLength(modal.label, 60, 1)) {
      setModalError("Event name must be 1-60 characters.");
      return;
    }
    const label = modal.label.trim();
    const duplicate = events.some(e =>
      e.date === modal.date && e.label.toLowerCase() === label.toLowerCase() &&
      (modal.mode !== "edit" || e.id !== modal.id)
    );
    if (duplicate) {
      setModalError("An event with this name already exists on this date.");
      return;
    }
    const payload = { date: modal.date, category: modal.category, label, icon: modal.icon || null };
    setSaving(true);
    try {
      if (modal.mode === "add") await addCalendarEvent(payload);
      else await updateCalendarEvent(modal.id, payload);
      closeModal();
      await load();
    } catch (e) {
      setModalError("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeModal() {
    if (modal.mode === "edit") {
      setSaving(true);
      try {
        await deleteCalendarEvent(modal.id);
      } finally {
        setSaving(false);
      }
    }
    closeModal();
    load();
  }

  async function resetToOfficialCalendar() {
    if (!confirm(
      "This replaces EVERY date currently on the calendar with the school's official 2026-27 planning data. " +
      "Any manual additions or edits you've made will be lost. Continue?"
    )) return;
    setResetting(true);
    try {
      await resetCalendarEvents(SEED_YEAR_PLAN_EVENTS);
      await load();
    } catch (e) {
      alert("Failed to reset: " + e.message);
    } finally {
      setResetting(false);
    }
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a3" });
    const pw = doc.internal.pageSize.width;
    doc.setFontSize(16); doc.setTextColor(30,58,95);
    doc.text("Satyam Stars International School — Annual Planning 2026-27", pw/2, 32, { align:"center" });

    const head = [["DATE", ...ACADEMIC_MONTHS.map(m => m.label.toUpperCase())]];
    const body = [];
    const cellCats = []; // parallel matrix of category keys (or null) per body cell, excluding the date column

    for (let day = 1; day <= 31; day++) {
      const row = [String(day)];
      const catRow = [];
      ACADEMIC_MONTHS.forEach(m => {
        if (day > m.days) { row.push("-"); catRow.push(null); return; }
        const key = dateKey(m.year, m.month, day);
        const dayEvents = eventsByDate[key] || [];
        const wd = weekdayOf(m.year, m.month, day);
        const cat = dayEvents[0]?.category || (wd === "SUN" ? "sunday" : null);
        const text = dayEvents.length ? `${wd}\n${dayEvents.map(e => e.label).join(" + ")}` : wd;
        row.push(text);
        catRow.push(cat);
      });
      body.push(row);
      cellCats.push(catRow);
    }

    autoTable(doc, {
      head, body, startY: 46,
      theme:"grid",
      styles: { fontSize:6.5, cellPadding:2.5, overflow:"linebreak", valign:"top" },
      headStyles: { fillColor:[30,58,95], textColor:[255,255,255], fontStyle:"bold", fontSize:8, halign:"center" },
      columnStyles: { 0:{ cellWidth:24, fontStyle:"bold", halign:"center", textColor:[30,58,95] } },
      didParseCell(data) {
        if (data.section !== "body" || data.column.index === 0) return;
        const cat = cellCats[data.row.index][data.column.index - 1];
        if (cat) {
          const [r,g,b] = hexToRgb(CAT_BY_KEY[cat].color);
          data.cell.styles.fillColor = [r,g,b];
          data.cell.styles.textColor = [255,255,255];
        }
      },
      margin: { left:24, right:24 },
    });

    let ly = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(9); doc.setTextColor(30,58,95);
    doc.text("Colour Allotment:", 24, ly);
    let lx = 110;
    YEAR_PLAN_CATEGORIES.forEach(c => {
      const [r,g,b] = hexToRgb(c.color);
      doc.setFillColor(r,g,b);
      doc.rect(lx, ly - 8, 12, 12, "F");
      doc.setFontSize(8); doc.setTextColor(60,60,60);
      doc.text(c.label, lx + 16, ly);
      lx += 16 + doc.getTextWidth(c.label) + 18;
    });

    doc.save("Annual_Planning_2026-27.pdf");
  }

  function exportExcel() {
    const data = [["DATE", ...ACADEMIC_MONTHS.map(m => m.label.toUpperCase())]];
    for (let day = 1; day <= 31; day++) {
      const row = [day];
      ACADEMIC_MONTHS.forEach(m => {
        if (day > m.days) { row.push(""); return; }
        const key = dateKey(m.year, m.month, day);
        const dayEvents = eventsByDate[key] || [];
        const wd = weekdayOf(m.year, m.month, day);
        row.push(dayEvents.length ? `${wd} - ${dayEvents.map(e => e.label).join(" + ")}` : wd);
      });
      data.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch:6 }, ...ACADEMIC_MONTHS.map(() => ({ wch:24 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Year Planning");
    XLSX.writeFile(wb, "Annual_Planning_2026-27.xlsx");
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Annual Planning 2026-27</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click any date cell to add an event. Click an existing event to edit or remove it.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetToOfficialCalendar} disabled={resetting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50">
              <RotateCcw className="w-4 h-4"/> {resetting ? "Resetting..." : "Reset to Official Calendar"}
            </button>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:border-school-navy/40 hover:text-school-navy transition-colors">
              <FileSpreadsheet className="w-4 h-4"/> Excel
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-school-navy text-white text-sm font-semibold hover:bg-school-navy/90 transition-colors shadow-sm">
              <Download className="w-4 h-4"/> PDF
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-gray-100">
          {YEAR_PLAN_CATEGORIES.map(c => {
            const Icon = ICONS[c.icon];
            return (
              <div key={c.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${c.light}`}>
                <Icon className={`w-3.5 h-3.5 ${c.text}`}/>
                <span className={`text-xs font-semibold ${c.text}`}>{c.label}</span>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Loading calendar...</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full" style={{ tableLayout:"fixed" }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-school-navy text-white text-xs font-bold py-2 px-2 border border-gray-200 w-12 z-10">DATE</th>
                {ACADEMIC_MONTHS.map(m => (
                  <th key={m.label} className="bg-school-navy text-white text-xs font-bold py-2 px-1 border border-gray-200" style={{ minWidth:110 }}>
                    {m.label.slice(0,3).toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length:31 }, (_, i) => i + 1).map(day => (
                <tr key={day}>
                  <td className="sticky left-0 bg-gray-50 text-center text-xs font-bold text-school-navy border border-gray-200 z-10">{day}</td>
                  {ACADEMIC_MONTHS.map(m => {
                    if (day > m.days) {
                      return <td key={m.label} className="border border-gray-100 bg-gray-50 text-center text-gray-300 text-xs">—</td>;
                    }
                    const key = dateKey(m.year, m.month, day);
                    const dayEvents = eventsByDate[key] || [];
                    const wd = weekdayOf(m.year, m.month, day);
                    const cellBg = dayEvents.length
                      ? CAT_BY_KEY[dayEvents[0].category].light
                      : (wd === "SUN" ? CAT_BY_KEY.sunday.light : "bg-white");
                    return (
                      <td key={m.label} onClick={() => openAdd(key)}
                        className={`align-top border border-gray-100 p-1 text-[10px] cursor-pointer hover:ring-2 hover:ring-school-navy/30 ${cellBg}`}>
                        <div className={`font-semibold ${wd === "SUN" ? CAT_BY_KEY.sunday.text : "text-gray-400"}`}>{wd}</div>
                        {dayEvents.map(ev => {
                          const cat = CAT_BY_KEY[ev.category];
                          const Icon = ICONS[ev.icon] || ICONS[cat.icon];
                          return (
                            <div key={ev.id} onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                              className={`mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 ${cat.chip} ${cat.text}`}>
                              <Icon className="w-2.5 h-2.5 flex-shrink-0"/>
                              <span className="truncate leading-tight">{ev.label}</span>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-gray-800">{modal.mode === "add" ? "Add Event" : "Edit Event"}</h4>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-xs text-gray-400">{modal.date}</p>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Category</label>
              <div className="flex flex-wrap gap-2">
                {YEAR_PLAN_CATEGORIES.map(c => {
                  const Icon = ICONS[c.icon];
                  const active = modal.category === c.key;
                  return (
                    <button key={c.key} onClick={() => setModal(m => ({ ...m, category:c.key }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active ? `${c.chip} ${c.text} border-transparent` : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      <Icon className="w-3.5 h-3.5"/> {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Event Name</label>
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-school-navy w-full"
                value={modal.label}
                onChange={(e) => { setModal(m => ({ ...m, label:e.target.value })); setModalError(""); }}
                placeholder="e.g. Independence Day"
                maxLength={60}
              />
              {modalError && <p className="text-xs text-red-500 mt-1">{modalError}</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Icon (optional)</label>
              <div className="flex flex-wrap gap-2">
                {YEAR_PLAN_ICON_CHOICES.map(name => {
                  const Icon = ICONS[name];
                  const active = modal.icon === name;
                  return (
                    <button key={name} onClick={() => setModal(m => ({ ...m, icon: active ? "" : name }))}
                      className={`p-2 rounded-lg border transition-colors ${active ? "border-school-navy bg-school-navy/10 text-school-navy" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}>
                      <Icon className="w-4 h-4"/>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {modal.mode === "edit" ? (
                <button onClick={removeModal} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4"/> Delete
                </button>
              ) : <span/>}
              <div className="flex gap-2">
                <button onClick={closeModal} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={saveModal} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4"/> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
