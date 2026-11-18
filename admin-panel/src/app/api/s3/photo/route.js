import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import s3, { S3_BUCKET } from "@/lib/s3";
import { withDiagnostics } from "@/lib/apiDiagnostics";
import { getAdminClient, requireAdminSession } from "@/lib/apiAuth";

function isAllowedKey(key) {
  return typeof key === "string" &&
    (key.startsWith("students/") || key.startsWith("employees/"));
}

// REQ-SEC-013: had zero authentication. No caller found anywhere in
// admin-panel or mobile-app (grepped both) - gated as admin-only rather
// than left open, since "unused today" isn't a reason to leave a working
// exploit path live.
export const GET = withDiagnostics(async function GET(request) {
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500 });
  const { errorResponse } = await requireAdminSession(request, supabaseAdmin);
  if (errorResponse) return errorResponse;

  const key = new URL(request.url).searchParams.get("key");

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  const url     = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.redirect(url);
});
