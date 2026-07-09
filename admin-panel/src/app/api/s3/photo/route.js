import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  return typeof key === "string" &&
    (key.startsWith("students/") || key.startsWith("employees/"));
}

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const url     = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.redirect(url);
}
