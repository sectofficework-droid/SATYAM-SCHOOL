import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  return (
    typeof key === "string" &&
    (key.startsWith("students/") || key.startsWith("employees/"))
  );
}

export async function POST(request) {
  // Check env vars first so the error is obvious
  if (!process.env.AWS_ACCESS_KEY_ID)    return NextResponse.json({ error: "Missing env: AWS_ACCESS_KEY_ID" },    { status: 500 });
  if (!process.env.AWS_SECRET_ACCESS_KEY) return NextResponse.json({ error: "Missing env: AWS_SECRET_ACCESS_KEY" }, { status: 500 });
  if (!process.env.AWS_REGION)           return NextResponse.json({ error: "Missing env: AWS_REGION" },           { status: 500 });
  if (!process.env.AWS_S3_BUCKET_NAME)   return NextResponse.json({ error: "Missing env: AWS_S3_BUCKET_NAME" },   { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const key = formData.get("key");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!isAllowedKey(key)) {
      return NextResponse.json({ error: "Invalid key: " + String(key) }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    return NextResponse.json({ key });
  } catch (err) {
    console.error("S3 upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
