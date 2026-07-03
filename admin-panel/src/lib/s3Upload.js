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
