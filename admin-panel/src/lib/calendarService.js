import supabase from "./supabase";

export async function getCalendarEvents(startDate, endDate) {
  let query = supabase.from("school_calendar_events").select("*").order("event_date");
  if (startDate) query = query.gte("event_date", startDate);
  if (endDate) query = query.lte("event_date", endDate);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addCalendarEvent({ eventDate, title, eventType }) {
  const { error } = await supabase.from("school_calendar_events").insert({
    event_date: eventDate,
    title,
    event_type: eventType,
  });
  if (error) throw error;
}

export async function deleteCalendarEvent(id) {
  const { error } = await supabase.from("school_calendar_events").delete().eq("id", id);
  if (error) throw error;
}
