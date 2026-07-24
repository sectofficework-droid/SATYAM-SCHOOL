import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

// Mirrors the Bonafide Certificate's letterhead design (admin panel,
// documents/page.js) so every school document shares the same look - Times
// New Roman school name, navy title, gold rules.
final _navy = PdfColor.fromInt(0xFF1a2b6b);
final _gold = PdfColor.fromInt(0xFFf59e0b);

const List<String> _weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

String _fmtDuration(int? totalMinutes) {
  if (totalMinutes == null || totalMinutes == 0) return '';
  final h = totalMinutes ~/ 60;
  final m = totalMinutes % 60;
  if (h > 0 && m > 0) return '$h hr $m min';
  if (h > 0) return '$h hr';
  return '$m min';
}

String _fmtDate(DateTime d) {
  final dd = d.day.toString().padLeft(2, '0');
  final mm = d.month.toString().padLeft(2, '0');
  return '$dd/$mm/${d.year}';
}

String _marksLabel(num m) => '($m Mark${m == 1 ? '' : 's'})';

Future<Uint8List> buildQuestionPaperPdf({
  required Map<String, dynamic> paper,
  required List<Map<String, dynamic>> questions,
  Uint8List? logoBytes,
}) async {
  final doc = pw.Document();
  final times = pw.Font.times();
  final timesBold = pw.Font.timesBold();
  final helvetica = pw.Font.helvetica();
  final helveticaBold = pw.Font.helveticaBold();
  final helveticaOblique = pw.Font.helveticaOblique();
  final logoImage = logoBytes != null ? pw.MemoryImage(logoBytes) : null;

  final mcq = questions.where((q) => q['question_format'] == 'MCQ').toList();
  final written = questions.where((q) => q['question_format'] != 'MCQ').toList()
    ..sort((a, b) => (a['marks'] as num).compareTo(b['marks'] as num));

  final writtenByMarks = <num, List<Map<String, dynamic>>>{};
  for (final q in written) {
    (writtenByMarks[q['marks'] as num] ??= []).add(q);
  }
  final marksKeys = writtenByMarks.keys.toList()..sort();

  int qNum = 1;
  final sections = <pw.Widget>[];

  if (mcq.isNotEmpty) {
    sections.add(pw.Padding(
      padding: const pw.EdgeInsets.only(top: 8, bottom: 6),
      child: pw.Text('Section A - Multiple Choice Questions',
          style: pw.TextStyle(font: helveticaBold, fontSize: 11)),
    ));
    for (final q in mcq) {
      sections.add(_questionBlock(qNum++, q, helvetica));
    }
  }

  for (final marks in marksKeys) {
    final group = writtenByMarks[marks]!;
    final sectionLetter = String.fromCharCode(65 + (mcq.isNotEmpty ? 1 : 0) + marksKeys.indexOf(marks));
    sections.add(pw.Padding(
      padding: const pw.EdgeInsets.only(top: 8, bottom: 6),
      child: pw.Text('Section $sectionLetter - $marks Mark${marks == 1 ? '' : 's'} Questions',
          style: pw.TextStyle(font: helveticaBold, fontSize: 11)),
    ));
    for (final q in group) {
      sections.add(_questionBlock(qNum++, q, helvetica));
    }
  }

  sections.add(pw.Padding(
    padding: const pw.EdgeInsets.only(top: 14),
    child: pw.Center(
      child: pw.Text('* * * All the Best * * *', style: pw.TextStyle(font: helveticaOblique, fontSize: 9)),
    ),
  ));

  doc.addPage(pw.MultiPage(
    pageFormat: PdfPageFormat.a4,
    margin: const pw.EdgeInsets.fromLTRB(16, 14, 16, 14),
    header: (context) => context.pageNumber == 1
        ? _letterhead(paper, logoImage, times, timesBold, helvetica, helveticaBold)
        : pw.SizedBox(),
    build: (context) => sections,
  ));

  return doc.save();
}

pw.Widget _questionBlock(int qNum, Map<String, dynamic> q, pw.Font helvetica) {
  final text = '$qNum. ${q['question_text']} ${_marksLabel(q['marks'] as num)}';
  final options = q['options'];
  return pw.Padding(
    padding: const pw.EdgeInsets.only(bottom: 6),
    child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Text(text, style: pw.TextStyle(font: helvetica, fontSize: 10)),
      if (q['question_format'] == 'MCQ' && options is List)
        ...options.map((o) => pw.Padding(
              padding: const pw.EdgeInsets.only(left: 10, top: 2),
              child: pw.Text('${o['label']}. ${o['text']}', style: pw.TextStyle(font: helvetica, fontSize: 9.5)),
            )),
    ]),
  );
}

pw.Widget _letterhead(
  Map<String, dynamic> paper,
  pw.MemoryImage? logo,
  pw.Font times,
  pw.Font timesBold,
  pw.Font helvetica,
  pw.Font helveticaBold,
) {
  final examDate = paper['examDate'] as DateTime?;
  final paperType = paper['paperType'] as String;

  return pw.Column(children: [
    pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      if (logo != null) pw.Image(logo, width: 40, height: 44.4, fit: pw.BoxFit.contain),
      pw.SizedBox(width: 10),
      pw.Expanded(
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('SATYAM STARS', style: pw.TextStyle(font: timesBold, fontSize: 18)),
          pw.Text('INTERNATIONAL SCHOOL', style: pw.TextStyle(font: timesBold, fontSize: 11)),
          pw.SizedBox(height: 3),
          pw.Container(height: 1, width: 220, color: PdfColors.black),
          pw.SizedBox(height: 3),
          pw.Text('Swaminarayan Nagar - Bhidbhanjan Society, Pandesara, Surat - 394210',
              style: pw.TextStyle(font: helvetica, fontSize: 7)),
          pw.Text('Ph: 8200069671', style: pw.TextStyle(font: helvetica, fontSize: 7)),
        ]),
      ),
    ]),
    pw.SizedBox(height: 6),
    pw.Container(height: 1.2, color: _gold),
    pw.SizedBox(height: 6),
    pw.Center(
      child: pw.Text(paper['title'].toString().toUpperCase(),
          style: pw.TextStyle(font: helveticaBold, fontSize: 15, color: _navy)),
    ),
    pw.Center(
      child: pw.Text(paperType == 'Exam' ? 'Question Paper' : 'Assignment',
          style: pw.TextStyle(font: helvetica, fontSize: 9.5)),
    ),
    pw.SizedBox(height: 6),
    pw.Container(height: 1.2, color: _gold),
    pw.SizedBox(height: 8),
    pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.6)),
      child: pw.Column(children: [
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text('Class: ${paper['class']}', style: pw.TextStyle(font: helveticaBold, fontSize: 9.5)),
          pw.Text('Subject: ${paper['subject']}', style: pw.TextStyle(font: helveticaBold, fontSize: 9.5)),
          pw.Text('Full Marks: ${paper['fullMarks']}', style: pw.TextStyle(font: helveticaBold, fontSize: 9.5)),
        ]),
        if (paperType == 'Exam')
          pw.Padding(
            padding: const pw.EdgeInsets.only(top: 4),
            child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
              if (examDate != null)
                pw.Text('Date: ${_fmtDate(examDate)} (${_weekdays[examDate.weekday - 1]})',
                    style: pw.TextStyle(font: helveticaBold, fontSize: 9.5)),
              if (paper['durationMinutes'] != null)
                pw.Text('Time: ${_fmtDuration(paper['durationMinutes'] as int?)}',
                    style: pw.TextStyle(font: helveticaBold, fontSize: 9.5)),
            ]),
          ),
      ]),
    ),
    pw.SizedBox(height: 10),
  ]);
}
