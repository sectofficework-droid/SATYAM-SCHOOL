import supabase from "./supabase";

// SEF Notice Board — same shape as the school's notices table.

export async function getNotices() {
  const { data, error } = await supabase
    .from("sef_notices")
    .select("*")
    .order("pinned", { ascending: false })
    .order("posted_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addNotice(n) {
  const { error } = await supabase.from("sef_notices").insert({
    title: n.title, content: n.content, type: n.type,
    posted_date: n.date, expiry_date: n.expiryDate || null,
    posted_by: n.postedBy || null, pinned: !!n.pinned,
  });
  if (error) throw error;
}

export async function updateNotice(id, changes) {
  const payload = {};
  if ("title" in changes) payload.title = changes.title;
  if ("content" in changes) payload.content = changes.content;
  if ("type" in changes) payload.type = changes.type;
  if ("date" in changes) payload.posted_date = changes.date;
  if ("expiryDate" in changes) payload.expiry_date = changes.expiryDate || null;
  if ("postedBy" in changes) payload.posted_by = changes.postedBy;
  if ("pinned" in changes) payload.pinned = changes.pinned;
  if ("archived" in changes) payload.archived = changes.archived;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase.from("sef_notices").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteNotice(id) {
  const { error } = await supabase.from("sef_notices").delete().eq("id", id);
  if (error) throw error;
}
