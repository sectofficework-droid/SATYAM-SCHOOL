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

export async function getInventoryItems(yearId) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*, inventory_batches(*), inventory_usages(*), student_inventory_assignments(status, student_enrollments(academic_year_id))")
    .order("name");
  if (error) throw error;
  return (data || []).map(row => {
    const filteredRow = yearId
      ? {
          ...row,
          student_inventory_assignments: (row.student_inventory_assignments || []).filter(
            a => a.student_enrollments?.academic_year_id === yearId
          ),
        }
      : row;
    return mapItem(filteredRow);
  });
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

// name/price only - total/issued are computed from batches/usages (see
// mapItem above), there's no single column to overwrite for those; adding a
// real batch/usage entry is how those actually change.
export async function updateInventoryItemBasics(id, { name, price }) {
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, price: Number(price) || 0 })
    .eq("id", id);
  if (error) throw error;
}

// Fails with a Postgres FK-violation (23503) if any student_inventory_assignments
// still reference this item - surfaced as a friendly error rather than letting
// the raw Postgres message through, since "Item Master" doesn't show that link.
export async function deleteInventoryItem(id) {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("This item is already assigned to one or more students and can't be deleted. Remove those assignments first.");
    }
    throw error;
  }
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
  const history = (row.asset_history || [])
    .map(h => ({
      id:     h.id,
      date:   h.date || "",
      action: h.action,
      from:   h.from_person || "",
      to:     h.to_person   || "",
      note:   h.note        || "",
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return {
    id:              row.id,
    name:            row.name,
    brand:           row.brand           || "",
    category:        row.category        || "",
    storageAddress:  row.storage_address || "",
    purchaseDate:    row.purchase_date   || "",
    value:           Number(row.value)   || 0,
    status:          row.status          || "Active",
    currentCheckout,
    checkouts,
    history,
  };
}

export async function getAssets() {
  const { data, error } = await supabase
    .from("assets")
    .select("*, asset_checkouts(*), asset_history(*)")
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
  return mapAsset({ ...data, asset_checkouts: [], asset_history: [] });
}

// name/brand kept separate from the table's display concatenation ("Name
// (Brand)") - callers must pass them back apart, not the combined string,
// or brand text would get baked into name on every edit.
export async function updateAsset(id, asset) {
  const { error } = await supabase
    .from("assets")
    .update({
      name:            asset.name,
      brand:           asset.brand          || null,
      category:        asset.category       || null,
      storage_address: asset.storageAddress || null,
      purchase_date:   asset.purchaseDate   || null,
      value:           Number(asset.value)  || 0,
      status:          asset.status         || "Active",
    })
    .eq("id", id);
  if (error) throw error;
}

// ── Asset History (freeform log) ─────────────────────────────────────────
// Separate from asset_checkouts (the Take/Return flow used elsewhere) -
// this is a manually-kept log for anything else worth recording against an
// asset (transferred, damaged, repaired, etc).

export async function addAssetHistoryEntry(assetId, entry) {
  const { data, error } = await supabase
    .from("asset_history")
    .insert({
      asset_id:    assetId,
      date:        entry.date || null,
      action:      entry.action || "Assigned",
      from_person: entry.from || null,
      to_person:   entry.to   || null,
      note:        entry.note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, date: data.date || "", action: data.action, from: data.from_person || "", to: data.to_person || "", note: data.note || "" };
}

export async function updateAssetHistoryEntry(id, entry) {
  const { error } = await supabase
    .from("asset_history")
    .update({
      date:        entry.date || null,
      action:      entry.action || "Assigned",
      from_person: entry.from || null,
      to_person:   entry.to   || null,
      note:        entry.note || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAssetHistoryEntry(id) {
  const { error } = await supabase.from("asset_history").delete().eq("id", id);
  if (error) throw error;
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
