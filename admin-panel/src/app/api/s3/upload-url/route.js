Failed to run sql query: ERROR:  23514: new row for relation "inventory_items" violates check constraint "inventory_items_category_check"
DETAIL:  Failing row contains (2fd6717c-6d81-454b-8834-15c5bf48346f, Single Line Notebook, stock, Set, 10, null, 2026-06-17 07:11:25.257862+00).import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  return typeof key === "string" && (key.startsWith("students/") || key.startsWith("employees/"));
}

export async function POST(request) {
  const { key, contentType } = await request.json();

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({ uploadUrl });
}
