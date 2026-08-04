import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

// Landscape spreadsheet-style table: one row per student, one column per
// subject - the "whole class, all subjects" export from the Official Exams
// class-teacher overview. Same navy/gold branding as question_paper_pdf.dart.
final _navy = PdfColor.fromInt(0xFF1a2b6b);
final _gold = PdfColor.fromInt(0xFFf59e0b);

Future<Uint8List> buildOfficialExamTablePdf({
  required String examName,
  required String className,
  required List<String> subjects,
  required List<Map<String, dynamic>> students,
  required List<Map<String, dynamic>> marks,
}) async {
  final doc = pw.Document();
  final helvetica = pw.Font.helvetica();
  final helveticaBold = pw.Font.helveticaBold();

  final marksLookup = <String, dynamic>{};
  for (final m in marks) {
    marksLookup['${m['subject_name']}|${m['student_id']}'] = m['marks_obtained'];
  }

  final headers = <String>['#', 'Student Name', ...subjects];
  final rows = <List<String>>[];
  for (var i = 0; i < students.length; i++) {
    final s = students[i];
    final fullName = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
    final row = <String>['${i + 1}', fullName.isNotEmpty ? fullName : (s['full_name']?.toString() ?? '—')];
    for (final subject in subjects) {
      final m = marksLookup['$subject|${s['id']}'];
      row.add(m != null ? '$m' : '—');
    }
    rows.add(row);
  }

  final cellAlignments = <int, pw.Alignment>{0: pw.Alignment.center};
  for (var i = 2; i < headers.length; i++) {
    cellAlignments[i] = pw.Alignment.center;
  }

  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4.landscape,
    margin: const pw.EdgeInsets.fromLTRB(20, 18, 20, 18),
    header: (context) => context.pageNumber == 1
        ? pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('SATYAM STARS INTERNATIONAL SCHOOL', style: pw.TextStyle(font: helveticaBold, fontSize: 15, color: _navy)),
            pw.SizedBox(height: 4),
            pw.Container(height: 1.2, color: _gold),
            pw.SizedBox(height: 8),
            pw.Text('$examName  ·  Class $className  ·  Class Overview', style: pw.TextStyle(font: helveticaBold, fontSize: 12)),
            pw.SizedBox(height: 10),
          ])
        : pw.SizedBox(),
    build: (context) => [
      pw.TableHelper.fromTextArray(
        headers: headers,
        data: rows,
        headerStyle: pw.TextStyle(font: helveticaBold, fontSize: 9, color: PdfColors.white),
        headerDecoration: pw.BoxDecoration(color: _navy),
        headerAlignment: pw.Alignment.center,
        cellStyle: pw.TextStyle(font: helvetica, fontSize: 8.5),
        cellAlignment: pw.Alignment.centerLeft,
        cellAlignments: cellAlignments,
        cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.4),
        oddRowDecoration: const pw.BoxDecoration(color: PdfColors.grey100),
      ),
    ],
  ));

  return doc.save();
}
