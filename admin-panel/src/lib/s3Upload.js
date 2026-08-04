// Client-side helpers — all S3 traffic goes through Next.js API routes so
// AWS credentials never reach the browser and no S3 CORS policy is needed.

export async function uploadFileToS3(file, key) {
  const form = new FormData();
  form.append("file", file);
  form.append("key", key);

  const res = await fetch("/api/s3/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (${res.status})`);
  }

  return key;
}

// Large files (e.g. an APK) can blow past Vercel's serverless request body
// limit if proxied through /api/s3/upload like uploadFileToS3 above - this
// PUTs straight from the browser to S3 via a short-lived presigned URL
// instead, so the file body never passes through the Next.js server.
export async function uploadFileToS3Presigned(file, key) {
  const res = await fetch("/api/s3/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType: file.type || "application/octet-stream" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Could not get an upload URL (${res.status})`);
  }
  const { uploadUrl } = await res.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload to S3 failed (${putRes.status})`);

  return key;
}

export async function getS3ViewUrl(key, filename) {
  if (!key) return null;
  let url = `/api/s3/view-url?key=${encodeURIComponent(key)}`;
  if (filename) url += `&filename=${encodeURIComponent(filename)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const { viewUrl } = await res.json();
  return viewUrl;
}

// Builds a human-friendly download name: "<enrollmentNo>_<firstName>_<docType>.<ext>"
export function buildDocDownloadName(enrollmentNo, fullName, docTypeName, key) {
  const firstName = String(fullName || "").trim().split(/\s+/)[0] || "student";
  const parts = [enrollmentNo, firstName, docTypeName]
    .map((p) => String(p || "").trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  const ext = key ? fileExt({ name: key }) : "pdf";
  return `${parts.join("_")}.${ext}`;
}

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fileExt(file) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "bin";
}
