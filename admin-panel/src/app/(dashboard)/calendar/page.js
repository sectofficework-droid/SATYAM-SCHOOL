"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Flag } from "lucide-react";
import { getCalendarEvents, addCalendarEvent, deleteCalendarEvent } from "@/lib/calendarService";
import DateInputDMY from "@/components/DateInputDMY";

// Fixed-date national holidays only (same Gregorian date every year) - shown
// for reference alongside admin-added dates. Lunar festivals (Diwali, Holi,
// Eid, etc.) shift every year and aren't guessed here; add them below as a
// school event/holiday instead.
const FIXED_NATIONAL_HOLIDAYS = [
  { month: 1, day: 1, title: "New Year's Day" },
  { month: 1, day: 26, title: "Republic Day" },
  { month: 5, day: 1, title: "Labour Day" },
  { month: 8, day: 15, title: "Independence Day" },
  { month: 10, day: 2, title: "Gandhi Jayanti" },
  { month: 12, day: 25, title: "Christmas" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_TYPE_STYLE = {
  Holiday: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  Event:   { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Exam:    { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};

function pad(n) { return String(n).padStart(2, "0"); }

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Holiday");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const start = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${pad(month)}-${pad(lastDay)}`;
    getCalendarEvents(start, end).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function changeMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  const nationalThisMonth = FIXED_NATIONAL_HOLIDAYS.filter(h => h.month === month);

  async function handleAdd() {
    if (!eventDate || !title.trim()) { alert("Pick a date and enter a title."); return; }
    setSaving(true);
    try {
      await addCalendarEvent({ eventDate, title: title.trim(), eventType });
      setTitle(""); setEventDate("");
      load();
    } catch (e) {
      alert("Failed to add: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this calendar entry?")) return;
    try {
      await deleteCalendarEvent(id);
      load();
    } catch (e) {
      alert("Failed to delete: " + e.message);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-school-navy">Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Add school holidays, events and exam dates - shown in the teacher app&apos;s Calendar alongside India&apos;s national holidays.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-school-navy" /> Add a Date
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-44">
            <DateInputDMY value={eventDate} onChange={e => setEventDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
          </div>
          <input type="text" placeholder="Title, e.g. Diwali Vacation"
            value={title} onChange={e => setTitle(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy" />
          <select value={eventType} onChange={e => setEventType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-school-navy">
            <option value="Holiday">Holiday</option>
            <option value="Event">Event</option>
            <option value="Exam">Exam</option>
          </select>
          <button onClick={handleAdd} disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-school-navy text-white hover:bg-school-navy/90 disabled:opacity-50">
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-school-navy" />
          </button>
          <h2 className="text-sm font-bold text-school-navy flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-school-navy" />
          </button>
        </div>

        {nationalThisMonth.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {nationalThisMonth.map(h => (
              <div key={h.title} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <Flag className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800 font-medium">{pad(h.day)} {MONTH_NAMES[month - 1]}</span>
                <span className="text-sm text-amber-700">{h.title}</span>
                <span className="ml-auto text-[10px] font-semibold text-amber-600 uppercase tracking-wide">National Holiday</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
        ) : events.length === 0 && nationalThisMonth.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nothing on the calendar this month yet.</p>
        ) : events.length === 0 ? null : (
          <div className="flex flex-col gap-2">
            {events.map(ev => {
              const style = EVENT_TYPE_STYLE[ev.event_type] || EVENT_TYPE_STYLE.Event;
              const d = new Date(ev.event_date + "T00:00:00");
              return (
                <div key={ev.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${style.bg} ${style.border}`}>
                  <span className={`text-sm font-medium ${style.text}`}>{pad(d.getDate())} {MONTH_NAMES[month - 1]}</span>
                  <span className={`text-sm ${style.text}`}>{ev.title}</span>
                  <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>{ev.event_type}</span>
                  <button onClick={() => handleDelete(ev.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
