// Client-side helpers — upload/view go through the server API routes so the
// AWS secret key never reaches the browser. The browser only ever talks to S3
// using a short-lived presigned URL.

export async function uploadFileToS3(file, key) {
  const res = await fetch("/api/s3/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType: file.type }),
  });
  if (!res.ok) throw new Error("Could not get upload URL");
  const { uploadUrl } = await res.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    const body = await putRes.text().catch(() => "");
    throw new Error(`S3 upload failed (${putRes.status}): ${body.slice(0, 200)}`);
  }

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
