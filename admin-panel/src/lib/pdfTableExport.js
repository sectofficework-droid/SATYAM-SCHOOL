import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ── PDF table rendering (pdf-lib has no built-in table/autofit, so it's
// built by hand) - shared by every wide-table export in the app. ───────────
export const MM = 2.8346; // pdf-lib works in points; layout constants below are
                          // authored in the same mm figures the old jsPDF version used.

// No column is ever allowed to wrap onto a second line, every column is
// exactly as wide as its own longest value needs (not stretched, not
// squeezed to fit its neighbours), and every cell - header or body, any
// column - renders at the same single font size. Text width scales exactly
// linearly with font size for a given string, so if the natural (per-column,
// content-fit) widths don't all fit the page at the base size, the ONE size
// used everywhere is scaled down uniformly until they do - columns shrink
// together, not independently, so nothing ends up a different size.
export function computeColumnLayout({ columns, rows, availableWidth, headerFont, bodyFont, baseSize, cellPad }) {
  const n = columns.length;
  const contentWidths = columns.map((col, i) => {
    const labelW = headerFont.widthOfTextAtSize(String(col.label), baseSize);
    let maxBodyW = 0;
    for (const row of rows) {
      const w = bodyFont.widthOfTextAtSize(String(row[i] ?? ""), baseSize);
      if (w > maxBodyW) maxBodyW = w;
    }
    return Math.max(labelW, maxBodyW);
  });
  const contentTotal = contentWidths.reduce((a, b) => a + b, 0) || 1;
  const paddingTotal = n * cellPad * 2;

  // Padding stays fixed - only the text itself (which scales exactly
  // linearly with font size) is shrunk to make everything fit, so the
  // final column widths are an exact fit with no rounding slack that
  // could let one column's text bleed into the next. No floor on how
  // small the shared size can go: a report with enough columns (eg. the
  // 28-column UDISE Entry sheet) that a legibility floor would push the
  // table wider than the page - shoving trailing columns off the visible
  // page entirely - always resolves to the exact-fit size instead, however
  // small that ends up being.
  const size = Math.min(baseSize, Math.max(0.5, baseSize * Math.max(0, availableWidth - paddingTotal) / contentTotal));
  const scale = size / baseSize;
  const widths = contentWidths.map(w => w * scale + cellPad * 2);
  return { widths, size };
}

export function triggerPdfDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Full multi-page table PDF: navy title banner + amber sub-band, an optional
// summary/filter line block, content-fit columns (see computeColumnLayout
// above), zebra-striped rows, and a footer with page number - same visual
// language as every other PDF export in this app (see report/page.js's
// doExportPDF, which this was extracted from).
export async function renderTablePdf({
  bandLabel, columns, rows, infoLines = [], filename, landscape = true,
}) {
  const PAGE_W = landscape ? 842 : 595;
  const PAGE_H = landscape ? 595 : 842;
  const MARGIN = 14 * MM;

  const NAVY   = rgb(30 / 255, 58 / 255, 95 / 255);
  const AMBER  = rgb(245 / 255, 158 / 255, 11 / 255);
  const WHITE  = rgb(1, 1, 1);
  const GREY_T = rgb(60 / 255, 60 / 255, 60 / 255);
  const GREY_L = rgb(210 / 255, 210 / 255, 210 / 255);
  const ALT_BG = rgb(248 / 255, 250 / 255, 252 / 255);
  const FOOT_T = rgb(140 / 255, 140 / 255, 140 / 255);

  const pdfDoc = await PDFDocument.create();
  const fontR  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pdfColumns = columns.map(c => ({ label: c.label }));
  const bodyRows   = rows.map(row => columns.map(c => String(row[c.key] ?? "-")));

  const BASE_SIZE = 7, CELL_PAD = 3 * MM * 0.5;
  const availableWidth = PAGE_W - MARGIN * 2;
  const { widths: colWidths, size: cellSize } = computeColumnLayout({
    columns: pdfColumns, rows: bodyRows, availableWidth,
    headerFont: fontB, bodyFont: fontR, baseSize: BASE_SIZE, cellPad: CELL_PAD,
  });
  const colX = [MARGIN];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  const ROW_H = cellSize * 1.35 + CELL_PAD * 2;
  const FOOTER_ZONE = 34 * MM;
  const todayDisplay = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  let page, cursorY, pageNum = 0;

  function drawTableHeaderRow() {
    page.drawRectangle({ x: MARGIN, y: PAGE_H - cursorY - ROW_H, width: availableWidth, height: ROW_H, color: NAVY });
    pdfColumns.forEach((col, i) => {
      page.drawText(String(col.label), {
        x: colX[i] + CELL_PAD, y: PAGE_H - cursorY - CELL_PAD - cellSize,
        size: cellSize, font: fontB, color: WHITE,
      });
    });
    cursorY += ROW_H;
  }

  function drawFooter() {
    page.drawLine({ start: { x: MARGIN, y: 12 * MM }, end: { x: PAGE_W - MARGIN, y: 12 * MM }, thickness: 0.7, color: GREY_L });
    page.drawText("Satyam Stars International School  |  Surat, Gujarat  |  Confidential", {
      x: MARGIN, y: 7 * MM, size: 7, font: fontR, color: FOOT_T,
    });
    const pageLabel = `Page ${pageNum}  |  Generated: ${todayDisplay}`;
    const plw = fontR.widthOfTextAtSize(pageLabel, 7);
    page.drawText(pageLabel, { x: PAGE_W - MARGIN - plw, y: 7 * MM, size: 7, font: fontR, color: FOOT_T });
  }

  function newPage(withBanner) {
    if (page) drawFooter();
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageNum += 1;
    cursorY = MARGIN;
    if (withBanner) {
      page.drawRectangle({ x: 0, y: PAGE_H - 28 * MM, width: PAGE_W, height: 28 * MM, color: NAVY });
      const title = "Satyam Stars International School";
      page.drawText(title, { x: (PAGE_W - fontB.widthOfTextAtSize(title, 14)) / 2, y: PAGE_H - 10 * MM, size: 14, font: fontB, color: WHITE });
      const subtitle = "Surat, Gujarat  |  GSEB Board  |  English Medium";
      page.drawText(subtitle, { x: (PAGE_W - fontR.widthOfTextAtSize(subtitle, 8)) / 2, y: PAGE_H - 17 * MM, size: 8, font: fontR, color: WHITE });
      page.drawRectangle({ x: 0, y: PAGE_H - 29 * MM, width: PAGE_W, height: 7 * MM, color: AMBER });
      const bandText = bandLabel.toUpperCase();
      page.drawText(bandText, { x: (PAGE_W - fontB.widthOfTextAtSize(bandText, 9)) / 2, y: PAGE_H - 27 * MM, size: 9, font: fontB, color: WHITE });

      cursorY = 36 * MM;
      infoLines.forEach(line => {
        page.drawText(line, { x: MARGIN, y: PAGE_H - cursorY, size: 8, font: fontR, color: GREY_T });
        cursorY += 5 * MM;
      });
      cursorY += 1 * MM;
    }
    drawTableHeaderRow();
  }

  newPage(true);

  bodyRows.forEach((row, rIdx) => {
    if (cursorY + ROW_H > PAGE_H - FOOTER_ZONE) newPage(false);

    if (rIdx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: PAGE_H - cursorY - ROW_H, width: availableWidth, height: ROW_H, color: ALT_BG });
    }
    row.forEach((val, i) => {
      page.drawText(String(val), {
        x: colX[i] + CELL_PAD,
        y: PAGE_H - cursorY - CELL_PAD - cellSize,
        size: cellSize, font: fontR, color: GREY_T,
      });
    });
    page.drawRectangle({ x: MARGIN, y: PAGE_H - cursorY - ROW_H, width: availableWidth, height: ROW_H, borderColor: GREY_L, borderWidth: 0.5 });
    for (let i = 1; i < colX.length; i++) {
      page.drawLine({ start: { x: colX[i], y: PAGE_H - cursorY }, end: { x: colX[i], y: PAGE_H - cursorY - ROW_H }, thickness: 0.5, color: GREY_L });
    }
    cursorY += ROW_H;
  });

  drawFooter();

  const bytes = await pdfDoc.save();
  triggerPdfDownload(bytes, filename);
}
