import supabase from "./supabase";

// ── Inventory Items (Stock) ───────────────────────────────────────

function mapItem(row) {
  const batches = (row.inventory_batches || []).map(b => ({
    id:       b.id,
    qty:      b.qty,
    date:     b.received_date,
    by:       b.received_by || "",
    note:     b.note        || "",
    location: b.storage_location || "",
  }));
  const usages = (row.inventory_usages || []).map(u => ({
    id:      u.id,
    qty:     u.qty,
    date:    u.usage_date,
    purpose: u.purpose,
    by:      u.used_by || "",
    note:    u.note    || "",
  }));
  // Count from actual assignment records (not usage records) so notebooks
  // and pre-fix assignments are included without needing usage entries.
  const studentsGiven = (row.student_inventory_assignments || [])
    .filter(a => a.status === "Given")
    .length;

  return {
    id:             row.id,
    name:           row.name,
    category:       row.category,
    unit:           row.unit,
    lowStockAt:     row.low_stock_at,
    storageAddress: row.storage_address || "",
    batches,
    usages,
    studentsGiven,
    studentsTotal:  0, // set from caller using enrolled student count
  };
}

export async function getInventoryItems() {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, inventory_batches(*), inventory_usages(*), student_inventory_assignments(status)")
    .order("name");
  if (error) throw error;
  return (data || []).map(mapItem);
}

export async function addInventoryItem(item) {
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      name:            item.name,
      category:        item.category,
      unit:            item.unit     || "Pcs",
      low_stock_at:    item.lowStockAt || 10,
      storage_address: item.storageAddress || null,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...mapItem({ ...data, inventory_batches: [], inventory_usages: [] }) };
}

export async function updateItemAddress(id, storageAddress) {
  const { error } = await supabase
    .from("inventory_items")
    .update({ storage_address: storageAddress || null })
    .eq("id", id);
  if (error) throw error;
}

export async function addBatch(itemId, batch) {
  const { data, error } = await supabase
    .from("inventory_batches")
    .insert({
      item_id:          itemId,
      qty:              batch.qty,
      received_date:    batch.date,
      received_by:      batch.by   || null,
      note:             batch.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id:       data.id,
    qty:      data.qty,
    date:     data.received_date,
    by:       data.received_by || "",
    note:     data.note        || "",
    location: "",
  };
}

export async function addUsage(itemId, usage) {
  const { data, error } = await supabase
    .from("inventory_usages")
    .insert({
      item_id:    itemId,
      qty:        usage.qty,
      usage_date: usage.date,
      purpose:    usage.purpose,
      used_by:    usage.by   || null,
      note:       usage.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id:      data.id,
    qty:     data.qty,
    date:    data.usage_date,
    purpose: data.purpose,
    by:      data.used_by || "",
    note:    data.note    || "",
  };
}

// ── Assets ────────────────────────────────────────────────────────

function mapAsset(row) {
  const checkouts = (row.asset_checkouts || []).map(c => ({
    id:         c.id,
    takenBy:    c.taken_by,
    purpose:    c.purpose,
    takenDate:  c.taken_date,
    returnDate: c.return_date || null,
  }));
  const currentCheckout = checkouts.find(c => !c.returnDate) || null;
  return {
    id:              row.id,
    name:            row.name,
    brand:           row.brand           || "",
    storageAddress:  row.storage_address || "",
    currentCheckout,
    checkouts,
  };
}

export async function getAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select("*, asset_checkouts(*)")
    .order("name");
  if (error) throw error;
  return (data || []).map(mapAsset);
}

export async function addAsset(asset) {
  const { data, error } = await supabase
    .from("assets")
    .insert({
      name:            asset.name,
      brand:           asset.brand           || null,
      storage_address: asset.storageAddress  || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapAsset({ ...data, asset_checkouts: [] });
}

export async function takeAsset(assetId, checkout) {
  const { data, error } = await supabase
    .from("asset_checkouts")
    .insert({
      asset_id:   assetId,
      taken_by:   checkout.takenBy,
      purpose:    checkout.purpose,
      taken_date: checkout.takenDate,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id:         data.id,
    takenBy:    data.taken_by,
    purpose:    data.purpose,
    takenDate:  data.taken_date,
    returnDate: null,
  };
}

export async function returnAsset(checkoutId, returnDate) {
  const { error } = await supabase
    .from("asset_checkouts")
    .update({ return_date: returnDate })
    .eq("id", checkoutId);
  if (error) throw error;
}
