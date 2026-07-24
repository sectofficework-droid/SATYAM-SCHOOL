import supabase from "./supabase";

// Backs the Settings > Year Planning tab AND the teacher app's Calendar -
// Year Planning is the single source of truth for school calendar dates,
// stored in Supabase (not just the admin's own browser) so every admin and
// the teacher app all see the same data.

export async function getCalendarEvents(startDate, endDate) {
  let query = supabase.from("school_calendar_events").select("*").order("event_date");
  if (startDate) query = query.gte("event_date", startDate);
  if (endDate) query = query.lte("event_date", endDate);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function addCalendarEvent({ date, category, label, icon }) {
  const { data, error } = await supabase.from("school_calendar_events")
    .insert({ event_date: date, category, title: label, icon: icon || null })
    .select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateCalendarEvent(id, { date, category, label, icon }) {
  const { error } = await supabase.from("school_calendar_events")
    .update({ event_date: date, category, title: label, icon: icon || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCalendarEvent(id) {
  const { error } = await supabase.from("school_calendar_events").delete().eq("id", id);
  if (error) throw error;
}

// One-time migration helper: bulk-loads the seed year-plan events into
// Supabase the first time the table is empty, so the admin doesn't have to
// re-enter ~80 events by hand after the storage moved off localStorage.
export async function bulkAddCalendarEvents(events) {
  if (!events.length) return;
  const rows = events.map(e => ({
    event_date: e.date, category: e.category, title: e.label, icon: e.icon || null,
  }));
  const { error } = await supabase.from("school_calendar_events").insert(rows);
  if (error) throw error;
}

function mapRow(row) {
  return { id: row.id, date: row.event_date, category: row.category, label: row.title, icon: row.icon };
}
