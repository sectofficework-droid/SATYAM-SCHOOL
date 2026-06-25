import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  return typeof key === "string" && (key.startsWith("students/") || key.startsWith("employees/"));
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  const filename = params.get("filename");

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const commandInput = { Bucket: S3_BUCKET, Key: key };
  if (filename) {
    const safeFilename = filename.replace(/[\r\n"]/g, "").slice(0, 200);
    commandInput.ResponseContentDisposition = `inline; filename="${safeFilename}"`;
  }

  const command = new GetObjectCommand(commandInput);
  const viewUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return NextResponse.json({ viewUrl });
}
