import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isAllowedKey(key) {
  return typeof key === "string" && (key.startsWith("students/") || key.startsWith("employees/"));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  const filename = params.get("filename");

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400, headers: CORS });
  }

  const commandInput = { Bucket: S3_BUCKET, Key: key };
  if (filename) {
    const safeFilename = filename.replace(/[\r\n"]/g, "").slice(0, 200);
    commandInput.ResponseContentDisposition = `inline; filename="${safeFilename}"`;
  }

  // ?serve=1 → streams image bytes directly with CORS headers (used by Flutter Web)
  if (params.get("serve") === "1") {
    const s3Res = await s3.send(new GetObjectCommand(commandInput));
    const bytes  = await s3Res.Body.transformToByteArray();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type":  s3Res.ContentType || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const command = new GetObjectCommand(commandInput);
  const viewUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.json({ viewUrl }, { headers: CORS });
}
