import supabase from "./supabase";

// SEF Inventory — stock tracking only (items + stock-in batches + stock-out
// usage), no assets/checkout sub-system (see sef_phase2_schema.sql).

export async function getItems() {
  const { data, error } = await supabase
    .from("sef_inventory_items")
    .select("*, sef_inventory_batches(qty), sef_inventory_usages(qty)")
    .order("name");
  if (error) throw error;
  return (data || []).map(item => {
    const totalIn = (item.sef_inventory_batches || []).reduce((s, b) => s + (b.qty || 0), 0);
    const totalUsed = (item.sef_inventory_usages || []).reduce((s, u) => s + (u.qty || 0), 0);
    return {
      id: item.id, name: item.name, unit: item.unit, lowStockAt: item.low_stock_at,
      totalIn, totalUsed, available: totalIn - totalUsed,
    };
  });
}

export async function addItem({ name, unit, lowStockAt }) {
  const { error } = await supabase.from("sef_inventory_items").insert({ name, unit, low_stock_at: lowStockAt || 10 });
  if (error) throw error;
}

export async function addBatch(itemId, { qty, receivedDate, receivedBy, note }) {
  const { error } = await supabase.from("sef_inventory_batches").insert({
    item_id: itemId, qty, received_date: receivedDate, received_by: receivedBy || null, note: note || null,
  });
  if (error) throw error;
}

export async function addUsage(itemId, { qty, usageDate, usedBy, note }) {
  const { error } = await supabase.from("sef_inventory_usages").insert({
    item_id: itemId, qty, usage_date: usageDate, used_by: usedBy || null, note: note || null,
  });
  if (error) throw error;
}

export async function getHistory(itemId) {
  const [{ data: batches }, { data: usages }] = await Promise.all([
    supabase.from("sef_inventory_batches").select("*").eq("item_id", itemId).order("received_date", { ascending: false }),
    supabase.from("sef_inventory_usages").select("*").eq("item_id", itemId).order("usage_date", { ascending: false }),
  ]);
  return { batches: batches || [], usages: usages || [] };
}
