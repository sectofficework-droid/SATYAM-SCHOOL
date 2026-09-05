import 'dart:convert';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

// Minimal .xlsx reader - just enough to pull raw cell values out of the
// first worksheet. Deliberately not a general spreadsheet library: the
// `excel` package on pub.dev can't be added to this project - every version
// of it depends on an `archive` release that conflicts with the `image`
// package the face-scan attendance feature already needs, so no version of
// `excel` resolves here. A .xlsx file is just a zip of XML parts though, and
// `archive`/`xml` are already in this project's dependency tree (via
// `image`/`pdf`), so this reads those parts directly instead of pulling in
// a second, incompatible library.
List<List<String>> readXlsxFirstSheet(Uint8List bytes) {
  final archive = ZipDecoder().decodeBytes(bytes);

  String? sharedStringsXml;
  String? sheetXml;
  int? bestSheetNum;
  for (final file in archive.files) {
    if (!file.isFile) continue;
    if (file.name == 'xl/sharedStrings.xml') {
      sharedStringsXml = utf8.decode(file.content as List<int>);
      continue;
    }
    final match = RegExp(r'^xl/worksheets/sheet(\d+)\.xml$').firstMatch(file.name);
    if (match != null) {
      final num = int.parse(match.group(1)!);
      if (bestSheetNum == null || num < bestSheetNum) {
        bestSheetNum = num;
        sheetXml = utf8.decode(file.content as List<int>);
      }
    }
  }
  if (sheetXml == null) return [];

  // Excel stores text as indices into a shared table rather than inline, so
  // this has to be built before the cells can be decoded.
  final sharedStrings = <String>[];
  if (sharedStringsXml != null) {
    final doc = XmlDocument.parse(sharedStringsXml);
    for (final si in doc.findAllElements('si')) {
      // A run can be split across multiple <r><t>...</t></r> pieces (rich
      // text) instead of one plain <t>...</t> - concatenating every <t>
      // under this <si> covers both.
      sharedStrings.add(si.findAllElements('t').map((t) => t.innerText).join());
    }
  }

  final doc = XmlDocument.parse(sheetXml);
  final rows = <List<String>>[];
  for (final rowEl in doc.findAllElements('row')) {
    final cellsByCol = <int, String>{};
    int maxCol = -1;
    for (final c in rowEl.findElements('c')) {
      final ref = c.getAttribute('r') ?? '';
      final col = _columnIndexFromRef(ref);
      if (col < 0) continue;
      final type = c.getAttribute('t');
      String value;
      if (type == 'inlineStr') {
        value = c.findElements('is').expand((el) => el.findElements('t')).map((t) => t.innerText).join();
      } else {
        final vElements = c.findElements('v');
        final raw = vElements.isNotEmpty ? vElements.first.innerText : '';
        if (type == 's') {
          final idx = int.tryParse(raw);
          value = (idx != null && idx >= 0 && idx < sharedStrings.length) ? sharedStrings[idx] : '';
        } else {
          value = raw;
        }
      }
      cellsByCol[col] = value;
      if (col > maxCol) maxCol = col;
    }
    rows.add(List<String>.generate(maxCol + 1, (i) => cellsByCol[i] ?? ''));
  }
  return rows;
}

// "A1" -> 0, "B3" -> 1, "AA1" -> 26 ... - the leading letters of a cell
// reference are a base-26 column code (row number is irrelevant here).
int _columnIndexFromRef(String ref) {
  int col = 0;
  var any = false;
  for (final ch in ref.codeUnits) {
    if (ch >= 65 && ch <= 90) {
      col = col * 26 + (ch - 64);
      any = true;
    } else {
      break;
    }
  }
  return any ? col - 1 : -1;
}
