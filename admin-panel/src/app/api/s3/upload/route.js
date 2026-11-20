import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3, { S3_BUCKET } from "@/lib/s3";
import { withDiagnostics } from "@/lib/apiDiagnostics";
import logger from "@/lib/logger";
import { getAdminClient, requireAdminOrMobileSession } from "@/lib/apiAuth";

function isAllowedKey(key) {
  return (
    typeof key === "string" &&
    (key.startsWith("students/") || key.startsWith("employees/") || key.startsWith("gr-book/") || key.startsWith("question-bank/"))
  );
}

// REQ-SEC-013: had zero authentication - anyone who could reach the
// deployed URL could overwrite any file at any allowed key prefix. Mobile
// (s3_upload_service.dart) calls this route directly with no Supabase Auth
// session, so a plain requireAdminSession would wrongly reject every
// mobile upload - requireAdminOrMobileSession accepts either a real admin
// session OR the mobile caller's own employeeId+sessionToken (form
// fields), verified the same way the rest of the mobile app's RPCs are.
export const POST = withDiagnostics(async function POST(request) {
  // Check env vars first so the error is obvious
  if (!process.env.AWS_ACCESS_KEY_ID)    return NextResponse.json({ error: "Missing env: AWS_ACCESS_KEY_ID" },    { status: 500 });
  if (!process.env.AWS_SECRET_ACCESS_KEY) return NextResponse.json({ error: "Missing env: AWS_SECRET_ACCESS_KEY" }, { status: 500 });
  if (!process.env.AWS_REGION)           return NextResponse.json({ error: "Missing env: AWS_REGION" },           { status: 500 });
  if (!process.env.AWS_S3_BUCKET_NAME)   return NextResponse.json({ error: "Missing env: AWS_S3_BUCKET_NAME" },   { status: 500 });

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const key = formData.get("key");
    const employeeId = formData.get("employeeId");
    const sessionToken = formData.get("sessionToken");

    const { errorResponse } = await requireAdminOrMobileSession(request, supabaseAdmin, {
      subjectType: "teacher", subjectId: employeeId, sessionToken,
    });
    if (errorResponse) return errorResponse;

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
    logger.error("S3 upload error", { stack: err?.stack, message: err?.message });
    const detail = [
      err.name,
      err.Code || err.code,
      err.message,
      err.$metadata?.httpStatusCode ? `HTTP ${err.$metadata.httpStatusCode}` : null,
      `Bucket: ${S3_BUCKET}`,
      `Region: ${process.env.AWS_REGION}`,
    ].filter(Boolean).join(" | ");
    return NextResponse.json({ error: detail }, { status: 500 });
  }
});
