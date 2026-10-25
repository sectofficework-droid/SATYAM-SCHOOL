import { NextResponse } from "next/server";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";
import initialData from "@/data/onlineGeneralRegisterData.json";

// REQ-BUG-077 (2026-10-25): Online General Register storage moved from the
// in-memory cache + runtime rewrite of a git-tracked JSON file (silent
// write failures on Vercel serverless, per-instance divergence, tracked-
// file mutation — see route history) to the Supabase table
// `online_general_register` (created by
// mobile-app/SUPABASE_ONLINE_GENERAL_REGISTER.sql — additive, run once).
// The admin-panel route uses the service-role client (same pattern as
// api/kiosk-settings), RLS+policy on the table is defense-in-depth since
// service role bypasses it.
//
// AUTO-SEED: on the first successful read, if the table has zero rows and
// online_general_register_meta shows no prior seed, this route upserts
// the bundled JSON snapshot (idempotent, onConflict ignoreDuplicates).
// This keeps the seed data out of any PII-bearing tracked SQL file.
//
// DEGRADATION CONTRACT (deliberate, no fake success): if the table is
// unavailable (migration not applied yet, DB offline, transient
// PostgREST error), GET still answers success with the bundled snapshot
// plus a top-level `warning` string explaining the fallback — so the
// page keeps working ahead of the migration — but ALL writes return an
// explicit 500 telling the caller to apply the migration. Never
// falls back to a fake write.
//
// REQ-SEC-022 guard kept identical: getAdminClient() +
// requireAdminSession() on all 3 handlers. Zero mobile callers
// re-verified 2026-10-25 (grep mobile-app/lib: no references).
// REQ-BUG-078 validation kept identical: section checked to exactly
// "primary"/"general"; client `updates` keys filtered to the 16
// registered fields; sections/field lists shared with the DB mapping.

const TABLE = "online_general_register";
const META_TABLE = "online_general_register_meta";

// camelCase route/UI field -> snake_case DB column (mapping shared by
// seed/update/read so JSON contract at this route's edge never changes).
const FIELD_MAP = [
  ["session", "session"],
  ["tcStatus", "tc_status"],
  ["cls", "cls"],
  ["grNo", "gr_no"],
  ["name", "name"],
  ["mobile1", "mobile1"],
  ["mobile2", "mobile2"],
  ["dobSlash", "dob_slash"],
  ["doaSlash", "doa_slash"],
  ["doeSlash", "doe_slash"],
  ["aadharNo", "aadhar_no"],
  ["udise", "udise"],
  ["pen", "pen"],
  ["apaar", "apaar"],
  ["remarks", "remarks"],
  ["documentsPending", "documents_pending"],
];

function toDbRow(record, section) {
  const row = {
    id: String(record.id),
    section,
    status: record.status || "Pending",
    updated_at: new Date().toISOString(),
  };
  for (const [field, column] of FIELD_MAP) {
    if (record[field] !== undefined) row[column] = record[field];
  }
  return row;
}

function fromDbRow(row) {
  const item = { id: row.id, section: row.section, status: row.status };
  for (const [field, column] of FIELD_MAP) {
    if (row[column] === null || row[column] === undefined) {
      item[field] = "-"; // bundled-seed default; keeps the JSON contract stable
    } else {
      item[field] = row[column];
    }
  }
  return item;
}

function bundledDataset() {
  return {
    primary: initialData.primary.map((r) => ({ ...r })),
    general: initialData.general.map((r) => ({ ...r })),
  };
}

function isTableMissing(error) {
  // PostgREST reports a missing relation as code 42P01 or a schema-cache
  // "Could not find the table ... in the schema cache" message.
  return (
    error?.code === "42P01" ||
    (typeof error?.message === "string" &&
      /could not find the table .* in the schema cache/i.test(error.message))
  );
}

function migrationHint() {
  return "online_general_register table unavailable — apply mobile-app/SUPABASE_ONLINE_GENERAL_REGISTER.sql (Supabase Dashboard → SQL Editor) once; reads currently serve the bundled snapshot instead";
}

// First-read seeding (best effort): zero rows + no prior seed marker ->
// upsert the bundled snapshot then mark seeded. Upserts are idempotent so
// a concurrent request racing this one can't duplicate rows or double-mark.
async function maybeSeed(supabaseAdmin) {
  try {
    const { count, error } = await supabaseAdmin
      .from(TABLE)
      .select("id", { count: "exact", head: true });
    if (error || (count || 0) > 0) return;
    const { data: meta } = await supabaseAdmin
      .from(META_TABLE)
      .select("seeded_at")
      .eq("id", "default")
      .maybeSingle();
    if (meta?.seeded_at) return;
    const rows = [
      ...initialData.primary.map((r) => toDbRow(r, "primary")),
      ...initialData.general.map((r) => toDbRow(r, "general")),
    ];
    if (rows.length) {
      const { error: seedErr } = await supabaseAdmin
        .from(TABLE)
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (seedErr) return; // marker stays unwritten -> next read retries
    }
    await supabaseAdmin
      .from(META_TABLE)
      .upsert({ id: "default" }, { onConflict: "id", ignoreDuplicates: true });
  } catch (err) {
    console.warn("online-general-register seed attempt failed:", err?.message);
  }
}

async function readDataset(supabaseAdmin) {
  const { data, error } = await supabaseAdmin.from(TABLE).select("*");
  if (error) return { dbError: error };
  const primary = [];
  const general = [];
  for (const row of data) {
    const item = fromDbRow(row);
    if (item.section === "primary") primary.push(item);
    else general.push(item);
  }
  return { primary, general };
}

// REQ-SEC-022: identical guard for all three handlers, mirroring the
// REQ-SEC-012 auth block in api/kiosk-settings/route.js line-for-line.
async function authorizeAdmin(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return { errorResponse: NextResponse.json(
      { error: "Server configuration error: missing service key" },
      { status: 500 }
    ) };
  }
  const { errorResponse } = await requireAdminSession(request, supabaseAdmin);
  if (errorResponse) return { errorResponse };
  return { supabaseAdmin };
}

export async function GET(request) {
  const { errorResponse, supabaseAdmin } = await authorizeAdmin(request);
  if (errorResponse) return errorResponse;

  await maybeSeed(supabaseAdmin);
  const result = await readDataset(supabaseAdmin);
  if (result.dbError) {
    console.warn(
      "online-general-register read fell back to bundled snapshot:",
      result.dbError.message
    );
    return NextResponse.json({
      success: true,
      data: bundledDataset(),
      warning: migrationHint(),
    });
  }

  return NextResponse.json({
    success: true,
    data: { primary: result.primary, general: result.general },
  });
}

export async function POST(request) {
  const { errorResponse, supabaseAdmin } = await authorizeAdmin(request);
  if (errorResponse) return errorResponse;
  try {
    const body = await request.json();
    const { id, section, updates } = body;

    if (!id || !section || !updates || typeof updates !== "object" || Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Missing required fields: id, section, updates" },
        { status: 400 }
      );
    }

    if (section !== "primary" && section !== "general") {
      return NextResponse.json(
        { error: 'Invalid section: must be exactly "primary" or "general"' },
        { status: 400 }
      );
    }

    // REQ-BUG-078 (2): drop keys outside the registered field list
    // instead of persisting whatever the client sent.
    const safeUpdates = {};
    for (const [field] of FIELD_MAP) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field];
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .eq("section", section)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    let updatedItem;
    if (existing) {
      // Merge onto the stored record (mirrors the original in-place
      // update) and recompute status from the merged grNo — same
      // observable rule as before: grNo present ⇒ Done.
      const camelExisting = fromDbRow(existing);
      camelExisting.section = section;
      updatedItem = { ...camelExisting, ...safeUpdates };
      updatedItem.status = (safeUpdates.grNo ?? camelExisting.grNo)
        ? "Done"
        : "Pending";
      const { error: updateErr } = await supabaseAdmin
        .from(TABLE)
        .update(toDbRow(updatedItem, section))
        .eq("id", id)
        .eq("section", section);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      // New record added — same per-field defaults as the original
      // create branch; approved fields flow in through the whitelist.
      const defaults = {
        session: "2026-27",
        tcStatus: "-",
        cls: "",
        grNo: "",
        name: "",
        mobile1: "-",
        mobile2: "-",
        dobSlash: "-",
        doaSlash: "-",
        doeSlash: "-",
        aadharNo: "-",
        udise: "-",
        pen: "-",
        apaar: "-",
        remarks: "-",
        documentsPending: "-",
      };
      updatedItem = { id, section, ...defaults, ...safeUpdates };
      updatedItem.status = updatedItem.grNo ? "Done" : "Pending";
      const { error: insertErr } = await supabaseAdmin
        .from(TABLE)
        .insert(toDbRow(updatedItem, section));
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (err) {
    console.error("API error in online-general-register:", err);
    return NextResponse.json({ error: err.message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { errorResponse, supabaseAdmin } = await authorizeAdmin(request);
  if (errorResponse) return errorResponse;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const section = searchParams.get("section");

    if (!id || !section) {
      return NextResponse.json(
        { error: "Missing required fields: id, section" },
        { status: 400 }
      );
    }

    if (section !== "primary" && section !== "general") {
      return NextResponse.json(
        { error: 'Invalid section: must be exactly "primary" or "general"' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from(TABLE)
      .select("id")
      .eq("id", id)
      .eq("section", section)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("section", section);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API error in online-general-register DELETE:", err);
    return NextResponse.json({ error: err.message || "Failed to delete" }, { status: 500 });
  }
}
