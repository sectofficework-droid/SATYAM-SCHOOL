import { NextResponse } from "next/server";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";

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
// REQ-SEC-021 (2026-11-20 full-system audit, re-confirmed): the bundled
// JSON snapshot this route used to import (`src/data/
// onlineGeneralRegisterData.json`) held 416+ real students' PII including
// Aadhaar numbers, shipped in the server bundle, in a repo with a
// documented history of being toggled public. Live-verified the table is
// fully seeded (461 rows, 138 primary + 323 general) and this GET handler
// already prefers it over any fallback — the "seed confirmed" condition
// TODO.md's own REQ-BUG-077 follow-up was waiting for. Removed the import
// and the file itself; the auto-seed-on-first-read and stale-snapshot-on-
// DB-outage fallback this used to provide are both gone as a result (DB
// errors now surface as a real error instead of masking with stale data -
// a deliberate tradeoff, correct now that the DB is confirmed the live
// source of truth). The optional git-history purge (the PII was public for
// ~2 days before, per TODO.md) is a separate, destructive decision left to
// the user.
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

function getTodaySlash() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

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
  const item = {
    id: row.id,
    section: row.section,
    status: row.status,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
  for (const [field, column] of FIELD_MAP) {
    if (row[column] === null || row[column] === undefined) {
      item[field] = "-"; // bundled-seed default; keeps the JSON contract stable
    } else {
      item[field] = row[column];
    }
  }
  return item;
}

function parseGrNum(gr) {
  if (!gr) return 0;
  const m = String(gr).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function sortRegisterRows(rows) {
  return rows.sort((a, b) => {
    const na = parseGrNum(a.grNo);
    const nb = parseGrNum(b.grNo);
    if (na !== nb) return na - nb;
    return String(a.grNo || "").localeCompare(String(b.grNo || ""), undefined, { numeric: true });
  });
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
  sortRegisterRows(primary);
  sortRegisterRows(general);
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

  const result = await readDataset(supabaseAdmin);
  if (result.dbError) {
    console.error("online-general-register read failed:", result.dbError.message);
    return NextResponse.json({ error: result.dbError.message }, { status: 500 });
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

    // Fast-path: if grNo is not changing (e.g. UDISE, PEN, remarks, doe updates),
    // update the existing row directly in a single DB query returning * without fetching first.
    if (!safeUpdates.grNo) {
      const dbRowUpdates = { updated_at: new Date().toISOString() };
      for (const [field, col] of FIELD_MAP) {
        if (safeUpdates[field] !== undefined) dbRowUpdates[col] = safeUpdates[field];
      }
      const { data: directUpdated, error: directErr } = await supabaseAdmin
        .from(TABLE)
        .update(dbRowUpdates)
        .eq("id", id)
        .eq("section", section)
        .select("*")
        .maybeSingle();

      if (!directErr && directUpdated) {
        return NextResponse.json({
          success: true,
          item: fromDbRow(directUpdated),
        });
      }
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
    const regLabel = section === "primary" ? "PR No" : "GR No";

    if (existing) {
      // Validate that grNo is not already taken by another student in this section only if grNo changed
      const grNoChanged = safeUpdates.grNo && safeUpdates.grNo !== "-" &&
        safeUpdates.grNo.trim().toLowerCase() !== String(existing.gr_no || "").trim().toLowerCase();

      if (grNoChanged) {
        const { data: dupGr } = await supabaseAdmin
          .from(TABLE)
          .select("id, name, cls, gr_no")
          .eq("section", section)
          .ilike("gr_no", safeUpdates.grNo.trim())
          .neq("id", id)
          .maybeSingle();

        if (dupGr) {
          return NextResponse.json(
            { error: `This ${regLabel} (${safeUpdates.grNo}) is already assigned to ${dupGr.name}${dupGr.cls ? ` (${dupGr.cls})` : ""}. You first need to change that student's ${regLabel} to assign this ${regLabel} to this student.` },
            { status: 409 }
          );
        }
      }

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
      // Check if student already exists in this section (prevent duplicate row creation for the same student)
      let existingStudentRecord = null;
      if (safeUpdates.aadharNo && safeUpdates.aadharNo !== "-") {
        const { data: byAadhar } = await supabaseAdmin
          .from(TABLE)
          .select("*")
          .eq("section", section)
          .eq("aadhar_no", safeUpdates.aadharNo.trim())
          .neq("id", id)
          .maybeSingle();
        if (byAadhar) existingStudentRecord = byAadhar;
      }
      if (!existingStudentRecord && safeUpdates.name && safeUpdates.cls) {
        const { data: byName } = await supabaseAdmin
          .from(TABLE)
          .select("*")
          .eq("section", section)
          .ilike("name", safeUpdates.name.trim())
          .ilike("cls", safeUpdates.cls.trim())
          .neq("id", id)
          .maybeSingle();
        if (byName) existingStudentRecord = byName;
      }

      if (existingStudentRecord) {
        // Student already exists in this section — update their existing record in-place instead of creating a duplicate row!
        const camelExisting = fromDbRow(existingStudentRecord);
        camelExisting.section = section;
        updatedItem = { ...camelExisting, ...safeUpdates };
        updatedItem.status = (safeUpdates.grNo ?? camelExisting.grNo)
          ? "Done"
          : "Pending";
        const { error: updateErr } = await supabaseAdmin
          .from(TABLE)
          .update(toDbRow(updatedItem, section))
          .eq("id", existingStudentRecord.id)
          .eq("section", section);
        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          item: updatedItem,
        });
      }

      // Truly new student: validate that grNo is not already taken by another row in this section
      if (safeUpdates.grNo && safeUpdates.grNo !== "-") {
        const { data: dupGr } = await supabaseAdmin
          .from(TABLE)
          .select("id, name, cls, gr_no")
          .eq("section", section)
          .ilike("gr_no", safeUpdates.grNo.trim())
          .neq("id", id)
          .maybeSingle();

        if (dupGr) {
          return NextResponse.json(
            { error: `This ${regLabel} (${safeUpdates.grNo}) is already assigned to ${dupGr.name}${dupGr.cls ? ` (${dupGr.cls})` : ""}. You first need to change that student's ${regLabel} to assign this ${regLabel} to this student.` },
            { status: 409 }
          );
        }
      }

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
        doeSlash: getTodaySlash(),
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
