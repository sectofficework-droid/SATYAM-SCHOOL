import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";
import initialData from "@/data/onlineGeneralRegisterData.json";

// REQ-SEC-022 (2026-10-24 scan, fixed 2026-10-25): this route shipped with
// ZERO authentication on GET/POST/DELETE - anyone who could reach the
// deployed URL could read the full register (416 students incl. Aadhaar -
// see REQ-SEC-021) or create/update/delete records. Mirrors the
// REQ-SEC-012 fix pattern from kiosk-settings/staff-attendance:
// getAdminClient() + requireAdminSession() per handler. Safe to apply the
// web-session helper because this route has ZERO mobile callers (grepped
// mobile-app/lib for this path - no mobile code references it; the
// consumer is government-entry/page.js via onlineGrService.js, which now
// uses authedFetch so the two halves of the auth contract match).
//
// REQ-BUG-078 (same scan): (1) `section` is now validated to exactly
// "primary"|"general" instead of a truthy ternary that silently fell
// through to "general" on typos; (2) incoming `updates` keys are
// whitelist-filtered to the register's real fields so arbitrary
// client-supplied keys are no longer persisted raw.
//
// KNOWN LIMITATION (REQ-BUG-077, still open): persistence rides on this
// file's in-memory cache + a best-effort write to a git-tracked JSON file.
// On Vercel serverless that write fails silently and per-instance caches
// diverge - a real storage decision (Supabase table etc.) is pending with
// the user; do NOT treat the persistToFile() path as reliable.

// In-memory cache ensures runtime updates persist even if deployed on read-only environments
let runtimeData = {
  primary: [...initialData.primary],
  general: [...initialData.general],
};

// REQ-BUG-078 (2): every field this register's records actually carry.
// "id"/"section"/"status" are NOT updatable here - status is computed
// from grNo below (see both branches), matching the original behavior.
const UPDATABLE_FIELDS = [
  "session", "tcStatus", "cls", "grNo", "name",
  "mobile1", "mobile2", "dobSlash", "doaSlash", "doeSlash",
  "aadharNo", "udise", "pen", "apaar", "remarks", "documentsPending",
];

// Shared by POST/DELETE - the original routes fell through to "general"
// on any misspelled section value (REQ-BUG-078 (1)).
function pickSectionList(section) {
  if (section === "primary") return runtimeData.primary;
  if (section === "general") return runtimeData.general;
  return null;
}

function getFilePath() {
  return path.join(process.cwd(), "src", "data", "onlineGeneralRegisterData.json");
}

function persistToFile() {
  try {
    const filePath = getFilePath();
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      primary: runtimeData.primary,
      general: runtimeData.general,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    // Read-only filesystem in some deployment environments (e.g. Vercel serverless)
    console.warn("Could not write onlineGeneralRegisterData to disk:", err?.message);
  }
}

// REQ-SEC-022: identical guard for all three handlers, mirroring the
// REQ-SEC-012 auth block in api/kiosk-settings/route.js line-for-line.
async function authorizeAdmin(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server configuration error: missing service key" },
      { status: 500 }
    );
  }
  const { errorResponse } = await requireAdminSession(request, supabaseAdmin);
  if (errorResponse) return { errorResponse };
  return { supabaseAdmin };
}

export async function GET(request) {
  const { errorResponse } = await authorizeAdmin(request);
  if (errorResponse) return errorResponse;

  return NextResponse.json({
    success: true,
    data: runtimeData,
  });
}

export async function POST(request) {
  const { errorResponse } = await authorizeAdmin(request);
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

    const list = pickSectionList(section);
    if (!list) {
      return NextResponse.json(
        { error: 'Invalid section: must be exactly "primary" or "general"' },
        { status: 400 }
      );
    }

    // REQ-BUG-078 (2): drop keys outside the registered field list
    // instead of persisting whatever the client sent.
    const safeUpdates = {};
    for (const key of UPDATABLE_FIELDS) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    const index = list.findIndex((x) => x.id === id);

    let updatedItem = null;
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...safeUpdates,
        status: (safeUpdates.grNo || list[index].grNo) ? "Done" : "Pending",
      };
      updatedItem = list[index];
    } else {
      // New record added
      const newRecord = {
        id,
        section,
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
      // Defaults above mirror the original per-field fallbacks; approved
      // fields flow in only through the whitelist.
      updatedItem = { ...newRecord, ...safeUpdates };
      updatedItem.id = id;
      updatedItem.section = section;
      updatedItem.status = updatedItem.grNo ? "Done" : "Pending";
      list.push(updatedItem);
    }

    persistToFile();

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
  const { errorResponse } = await authorizeAdmin(request);
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

    const list = pickSectionList(section);
    if (!list) {
      return NextResponse.json(
        { error: 'Invalid section: must be exactly "primary" or "general"' },
        { status: 400 }
      );
    }

    const index = list.findIndex((x) => x.id === id);
    if (index < 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    list.splice(index, 1);
    persistToFile();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("API error in online-general-register DELETE:", err);
    return NextResponse.json({ error: err.message || "Failed to delete" }, { status: 500 });
  }
}
