import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";
import { withDiagnostics } from "@/lib/apiDiagnostics";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";

function isAllowedKey(key) {
  return typeof key === "string" && (key.startsWith("students/") || key.startsWith("employees/") || key.startsWith("app/") || key.startsWith("gr-book/") || key.startsWith("sef-students/") || key.startsWith("sef-employees/"));
}

// REQ-SEC-013: had zero authentication. No mobile caller (grepped
// mobile-app/lib for "/api/s3/upload-url" - none), so a plain admin-only
// gate is safe here (unlike /api/s3/upload and /view-url, which mobile
// does call and need the dual-mode check instead).
export const POST = withDiagnostics(async function POST(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { errorResponse } = await requireAdminSession(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

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
});
