import supabase from "./supabase";

export async function getQueries() {
  const { data, error } = await supabase
    .from("queries_suggestions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function replyToQuery(id, reply) {
  const { error } = await supabase
    .from("queries_suggestions")
    .update({
      admin_reply: reply,
      status: "Resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markQueryResolved(id) {
  const { error } = await supabase
    .from("queries_suggestions")
    .update({ status: "Resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reopenQuery(id) {
  const { error } = await supabase
    .from("queries_suggestions")
    .update({ status: "Pending", resolved_at: null })
    .eq("id", id);
  if (error) throw error;
}
