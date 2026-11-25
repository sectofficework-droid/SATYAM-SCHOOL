import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3, { S3_BUCKET } from "@/lib/s3";
import { withDiagnostics } from "@/lib/apiDiagnostics";
import { getAdminClient, requireAdminOrMobileSession } from "@/lib/apiAuth";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isAllowedKey(key) {
  return typeof key === "string" && (key.startsWith("students/") || key.startsWith("employees/") || key.startsWith("gr-book/") || key.startsWith("question-bank/"));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// REQ-SEC-013: had zero authentication - anyone who knew or guessed a key
// got a working presigned URL to that file. Mobile (s3_upload_service.dart)
// calls this with no Supabase Auth session, so employeeId/sessionToken
// query params are accepted as an alternative to the Bearer header - see
// requireAdminOrMobileSession.
export const GET = withDiagnostics(async function GET(request) {
  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  const filename = params.get("filename");

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) return NextResponse.json({ error: "Server configuration error: missing service key" }, { status: 500, headers: CORS });
  // REQ-SEC (2026-11-20 full-system audit): the mobile caller used to send
  // employeeId/sessionToken as query-string params, more likely than a
  // header to end up in server/proxy access logs. Mobile now sends them as
  // headers instead; query params are kept as a fallback only for any
  // other caller still using the old shape.
  const { errorResponse } = await requireAdminOrMobileSession(request, supabaseAdmin, {
    subjectType: "teacher",
    subjectId: request.headers.get("x-employee-id") || params.get("employeeId"),
    sessionToken: request.headers.get("x-session-token") || params.get("sessionToken"),
  });
  if (errorResponse) return errorResponse;

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400, headers: CORS });
  }

  const commandInput = { Bucket: S3_BUCKET, Key: key };
  if (filename) {
    const safeFilename = filename.replace(/[\r\n"]/g, "").slice(0, 200);
    commandInput.ResponseContentDisposition = `inline; filename="${safeFilename}"`;
  }

  const command = new GetObjectCommand(commandInput);
  const viewUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  // ?serve=1 → proxies image bytes through Vercel with CORS headers (used by Flutter Web)
  if (params.get("serve") === "1") {
    const s3Res = await fetch(viewUrl);
    const bytes  = await s3Res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type":  s3Res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return NextResponse.json({ viewUrl }, { headers: CORS });
});
