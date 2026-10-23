import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import initialData from "@/data/onlineGeneralRegisterData.json";

// In-memory cache ensures runtime updates persist even if deployed on read-only environments
let runtimeData = {
  primary: [...initialData.primary],
  general: [...initialData.general],
};

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

export async function GET() {
  return NextResponse.json({
    success: true,
    data: runtimeData,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, section, updates } = body;

    if (!id || !section || !updates) {
      return NextResponse.json(
        { error: "Missing required fields: id, section, updates" },
        { status: 400 }
      );
    }

    const list = section === "primary" ? runtimeData.primary : runtimeData.general;
    const index = list.findIndex((x) => x.id === id);

    let updatedItem = null;
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updates,
        status: (updates.grNo || list[index].grNo) ? "Done" : "Pending",
      };
      updatedItem = list[index];
    } else {
      // New record added
      updatedItem = {
        id,
        section,
        session: updates.session || "2026-27",
        tcStatus: updates.tcStatus || "-",
        cls: updates.cls || "",
        grNo: updates.grNo || "",
        name: updates.name || "",
        mobile1: updates.mobile1 || "-",
        mobile2: updates.mobile2 || "-",
        dobSlash: updates.dobSlash || "-",
        doaSlash: updates.doaSlash || "-",
        doeSlash: updates.doeSlash || "-",
        aadharNo: updates.aadharNo || "-",
        udise: updates.udise || "-",
        pen: updates.pen || "-",
        apaar: updates.apaar || "-",
        remarks: updates.remarks || "-",
        documentsPending: updates.documentsPending || "-",
        status: updates.grNo ? "Done" : "Pending",
        ...updates,
      };
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
