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

export async function addCalendarEvent({ date, category, label, icon, classes }) {
  const { data, error } = await supabase.from("school_calendar_events")
    .insert({ event_date: date, category, title: label, icon: icon || null, applies_to_classes: classes?.length ? classes : null })
    .select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateCalendarEvent(id, { date, category, label, icon, classes }) {
  const payload = { event_date: date, category, title: label, icon: icon || null };
  // Only touch applies_to_classes when the caller actually knows about it -
  // Year Planning's own edit modal never passes `classes` at all, and must
  // not silently wipe a scope the Attendance module's Holidays tab set.
  if (classes !== undefined) payload.applies_to_classes = classes.length ? classes : null;
  const { error } = await supabase.from("school_calendar_events")
    .update(payload)
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

// Wipes every calendar entry and reloads the current SEED_YEAR_PLAN_EVENTS -
// use when the seed data itself was corrected and whatever's already in
// Supabase (auto-seeded from an earlier, wrong version, or otherwise) needs
// to be replaced outright, not merged with.
export async function resetCalendarEvents(events) {
  const { error: delErr } = await supabase.from("school_calendar_events")
    .delete().not("id", "is", null);
  if (delErr) throw delErr;
  await bulkAddCalendarEvents(events);
}

function mapRow(row) {
  return { id: row.id, date: row.event_date, category: row.category, label: row.title, icon: row.icon, classes: row.applies_to_classes || null };
}
