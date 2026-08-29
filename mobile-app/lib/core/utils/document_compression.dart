import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

// Compresses a document down to maxBytes if it's currently over that size -
// the Dart equivalent of admin-panel/src/lib/fileCompression.js's two paths
// (canvas re-encode for images, rasterize-then-rebuild for PDFs), using
// packages already in this project (image, pdf, printing) rather than
// pulling in a new dependency just for this. Returns the original bytes
// unchanged if already within budget - same as the JS version's early return.
Future<Uint8List> compressDocumentBytes(Uint8List bytes, String extension, {int maxBytes = 2 * 1024 * 1024}) async {
  if (bytes.length <= maxBytes) return bytes;
  final ext = extension.toLowerCase();
  if (ext == 'pdf') return _compressPdf(bytes, maxBytes);
  if (ext == 'jpg' || ext == 'jpeg' || ext == 'png') return _compressImage(bytes, maxBytes);
  return bytes; // unsupported type - callers already restrict the file picker to pdf/jpg/jpeg/png
}

Uint8List _compressImage(Uint8List bytes, int maxBytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return bytes; // not a decodable image - leave as-is rather than throw
  var image = decoded;
  var quality = 92;
  var out = Uint8List.fromList(img.encodeJpg(image, quality: quality));
  var attempts = 0;
  while (out.length > maxBytes && attempts < 10) {
    attempts++;
    if (quality > 50) {
      quality -= 12;
    } else if (image.width > 500 && image.height > 500) {
      image = img.copyResize(image, width: (image.width * 0.85).round());
    } else {
      break; // already at quality floor and size floor - accept what we have
    }
    out = Uint8List.fromList(img.encodeJpg(image, quality: quality));
  }
  return out;
}

Future<Uint8List> _compressPdf(Uint8List bytes, int maxBytes) async {
  const dpi = 100.0;
  final pageImages = <Uint8List>[];
  final pageSizesPt = <PdfPoint>[];
  await for (final page in Printing.raster(bytes, dpi: dpi)) {
    pageImages.add(await page.toPng());
    // page.width/height are pixels at the chosen dpi - convert back to
    // points (1 inch = 72 points) so the rebuilt PDF keeps the original
    // page's physical size instead of drifting with the raster resolution.
    pageSizesPt.add(PdfPoint(page.width / dpi * PdfPageFormat.inch, page.height / dpi * PdfPageFormat.inch));
  }
  if (pageImages.isEmpty) return bytes;

  // Floor the per-page budget so a many-page PDF doesn't get starved to
  // unreadable output - same reasoning as the admin panel's compressPdf().
  final perPageBudget = (maxBytes / pageImages.length).floor().clamp(60 * 1024, maxBytes);

  final doc = pw.Document();
  for (var i = 0; i < pageImages.length; i++) {
    final jpg = _compressImage(pageImages[i], perPageBudget);
    final size = pageSizesPt[i];
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat(size.x, size.y),
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Image(pw.MemoryImage(jpg), fit: pw.BoxFit.fill),
    ));
  }
  return doc.save();
}
