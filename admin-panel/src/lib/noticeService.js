import supabase from "./supabase";

function mapFromDB(row) {
  return {
    id:           row.id,
    title:        row.title,
    content:      row.content      || "",
    type:         row.type,
    audience:     row.audience     || "Everyone",
    date:         row.posted_date,
    expiryDate:   row.expiry_date  || null,
    postedBy:     row.posted_by    || "",
    pinned:       row.pinned       ?? false,
    archived:     row.archived     ?? false,
    attachmentUrl: row.attachment_url || null,
  };
}

function mapToDB(n) {
  return {
    title:          n.title,
    content:        n.content,
    type:           n.type,
    audience:       n.audience,
    posted_date:    n.date,
    expiry_date:    n.expiryDate || null,
    posted_by:      n.postedBy   || null,
    pinned:         n.pinned     ?? false,
    archived:       n.archived   ?? false,
  };
}

export async function getNotices() {
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("pinned",      { ascending: false })
    .order("posted_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapFromDB);
}

export async function addNotice(n) {
  const { data, error } = await supabase
    .from("notices")
    .insert(mapToDB(n))
    .select()
    .single();
  if (error) throw error;
  return mapFromDB(data);
}

export async function updateNotice(id, changes) {
  const payload = {};
  if ("title"      in changes) payload.title        = changes.title;
  if ("content"    in changes) payload.content      = changes.content;
  if ("type"       in changes) payload.type         = changes.type;
  if ("audience"   in changes) payload.audience     = changes.audience;
  if ("date"       in changes) payload.posted_date  = changes.date;
  if ("expiryDate" in changes) payload.expiry_date  = changes.expiryDate || null;
  if ("postedBy"   in changes) payload.posted_by    = changes.postedBy;
  if ("pinned"     in changes) payload.pinned       = changes.pinned;
  if ("archived"   in changes) payload.archived     = changes.archived;

  const { data, error } = await supabase
    .from("notices")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapFromDB(data);
}

export async function deleteNotice(id) {
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) throw error;
}
