// Client-side compression so uploads stay small without a server round-trip.
// Images: canvas re-encode with iterative quality/size reduction.
// PDFs: rendered page-by-page to JPEG (via pdfjs-dist) and rebuilt with jsPDF —
// every PDF here is a scanned ID/certificate, so rasterizing is an accepted tradeoff.

const DEFAULT_MAX_BYTES = 1024 * 1024;
const MIN_DIMENSION = 500;

export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function loadDecodableImage(file) {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function compressImage(file, maxBytes) {
  const source = await loadDecodableImage(file);
  const naturalWidth = source.width;
  const naturalHeight = source.height;

  let width = naturalWidth;
  let height = naturalHeight;
  let quality = 0.92;
  let blob = await canvasToBlob(drawToCanvas(source, width, height), quality);

  let attempts = 0;
  while (blob.size > maxBytes && attempts < 10) {
    attempts++;
    if (quality > 0.5) {
      quality -= 0.12;
    } else if (Math.max(width, height) > MIN_DIMENSION) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
    } else {
      break; // already at quality floor and size floor — accept what we have
    }
    blob = await canvasToBlob(drawToCanvas(source, width, height), quality);
  }

  if (source.close) source.close(); // release ImageBitmap memory
  const baseName = file.name.replace(/\.[^./]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

async function compressPdf(file, maxBytes) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const numPages = pdf.numPages;
  // Floor the per-page budget so a many-page PDF doesn't get starved to unreadable output.
  const perPageBudget = Math.max(60 * 1024, Math.floor(maxBytes / numPages));

  const { jsPDF } = await import("jspdf");
  let doc = null;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    let approxSize = dataUrl.length * 0.75;
    let attempts = 0;
    while (approxSize > perPageBudget && quality > 0.3 && attempts < 8) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      approxSize = dataUrl.length * 0.75;
      attempts++;
    }

    const pageFormat = [viewport.width, viewport.height];
    if (!doc) {
      doc = new jsPDF({ unit: "px", format: pageFormat });
    } else {
      doc.addPage(pageFormat);
    }
    doc.addImage(dataUrl, "JPEG", 0, 0, viewport.width, viewport.height);
  }

  const blob = doc.output("blob");
  return new File([blob], file.name, { type: "application/pdf" });
}

// Returns the original file unchanged if it's already within budget.
export async function compressFile(file, maxBytes = DEFAULT_MAX_BYTES) {
  if (!file || file.size <= maxBytes) return file;

  if (file.type.startsWith("image/")) {
    return compressImage(file, maxBytes);
  }
  if (file.type === "application/pdf") {
    return compressPdf(file, maxBytes);
  }
  throw new Error(`Unsupported file type for compression: ${file.type}`);
}
