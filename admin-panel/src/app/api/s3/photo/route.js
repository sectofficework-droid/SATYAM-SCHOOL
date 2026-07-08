import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3, { S3_BUCKET } from "@/lib/s3";

function isAllowedKey(key) {
  return typeof key === "string" &&
    (key.startsWith("students/") || key.startsWith("employees/"));
}

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");

  if (!isAllowedKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const command  = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const s3Res    = await s3.send(command);
    const bytes    = await s3Res.Body.transformToByteArray();
    const mimeType = s3Res.ContentType || "image/jpeg";

    return new Response(bytes, {
      headers: {
        "Content-Type":                mimeType,
        "Cache-Control":               "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
