import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';
import '../../../../core/utils/question_paper_pdf.dart';

const List<String> _weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

class TeacherCreatePaperPage extends StatefulWidget {
  const TeacherCreatePaperPage({super.key});
  @override
  State<TeacherCreatePaperPage> createState() => _TeacherCreatePaperPageState();
}

class _TeacherCreatePaperPageState extends State<TeacherCreatePaperPage> {
  String _paperType = 'Exam';
  late String _selectedClass;
  String? _selectedSubject;
  List<String> _chapters = [];
  final Set<String> _selectedChapters = {};
  List<Map<String, dynamic>> _questions = [];
  final Set<String> _selectedQuestionIds = {};
  bool _loadingQuestions = false;

  final _titleCtrl = TextEditingController();
  final _fullMarksCtrl = TextEditingController();
  int _durationHours = 1;
  int _durationMinutes = 0;
  DateTime? _examDate;
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    final profile = AuthService.to.profile.value ?? {};
    _selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : allSchoolClasses.first;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _fullMarksCtrl.dispose();
    super.dispose();
  }

  String? get _employeeId => (AuthService.to.profile.value ?? {})['id'] as String?;

  Future<void> _loadChapters() async {
    setState(() { _chapters = []; _selectedChapters.clear(); _questions = []; _selectedQuestionIds.clear(); });
    final employeeId = _employeeId;
    if (employeeId == null || _selectedSubject == null) return;
    final chapters = await SupabaseService.fetchQuestionChapters(
      teacherId: employeeId, className: _selectedClass, subject: _selectedSubject!,
    );
    if (mounted) setState(() => _chapters = chapters);
  }

  Future<void> _loadQuestions() async {
    final employeeId = _employeeId;
    if (employeeId == null || _selectedSubject == null || _selectedChapters.isEmpty) {
      setState(() { _questions = []; _selectedQuestionIds.clear(); });
      return;
    }
    setState(() => _loadingQuestions = true);
    final questions = await SupabaseService.fetchQuestionsForChapters(
      teacherId: employeeId, className: _selectedClass, subject: _selectedSubject!,
      chapters: _selectedChapters.toList(),
    );
    if (mounted) setState(() {
      _questions = questions;
      _selectedQuestionIds.clear(); // default: none selected
      _loadingQuestions = false;
    });
  }

  void _toggleChapter(String c) {
    setState(() => _selectedChapters.contains(c) ? _selectedChapters.remove(c) : _selectedChapters.add(c));
    _loadQuestions();
  }

  void _toggleQuestion(String id) {
    setState(() => _selectedQuestionIds.contains(id) ? _selectedQuestionIds.remove(id) : _selectedQuestionIds.add(id));
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final q in _questions) {
      final key = q['question_format'] == 'MCQ' ? 'MCQ' : '${q['marks']} Mark${q['marks'] == 1 ? '' : 's'}';
      map.putIfAbsent(key, () => []).add(q);
    }
    return map;
  }

  List<Map<String, dynamic>> get _selectedQuestions =>
      _questions.where((q) => _selectedQuestionIds.contains(q['id'])).toList();

  int get _computedFullMarks => _selectedQuestions.fold(0, (s, q) => s + (q['marks'] as num).toInt());

  int get _fullMarks {
    final override = int.tryParse(_fullMarksCtrl.text.trim());
    return override ?? _computedFullMarks;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _examDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _examDate = picked);
  }

  Future<void> _generate() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a title for the paper.')));
      return;
    }
    if (_selectedQuestionIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Select at least one question.')));
      return;
    }
    final employeeId = _employeeId;
    if (employeeId == null) return;

    setState(() => _generating = true);
    try {
      final durationTotal = _paperType == 'Exam' ? _durationHours * 60 + _durationMinutes : null;
      final paperRow = await SupabaseService.createQuestionPaper({
        'teacher_id': employeeId,
        'paper_type': _paperType,
        'title': _titleCtrl.text.trim(),
        'class': _selectedClass,
        'subject': _selectedSubject,
        'duration_minutes': durationTotal != null && durationTotal > 0 ? durationTotal : null,
        'exam_date': _paperType == 'Exam' ? _examDate?.toIso8601String().split('T').first : null,
        'full_marks': _fullMarks,
      });
      await SupabaseService.saveQuestionPaperItems(
        paperRow['id'] as String, _selectedQuestions.map((q) => q['id'] as String).toList(),
      );

      Uint8List? logoBytes;
      try {
        final data = await rootBundle.load('assets/images/school_logo.jpg');
        logoBytes = data.buffer.asUint8List();
      } catch (_) {}

      final bytes = await buildQuestionPaperPdf(
        paper: {
          'paperType': _paperType,
          'title': _titleCtrl.text.trim(),
          'class': _selectedClass,
          'subject': _selectedSubject,
          'durationMinutes': durationTotal,
          'examDate': _examDate,
          'fullMarks': _fullMarks,
        },
        questions: _selectedQuestions,
        logoBytes: logoBytes,
      );

      final safeTitle = _titleCtrl.text.trim().replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_');
      await Printing.sharePdf(bytes: bytes, filename: '$safeTitle.pdf');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Paper generated and saved.')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to generate paper: $e')));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _grouped;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Create Paper'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _card('What do you want to create?', Icons.edit_note_rounded, [
            Row(children: [
              Expanded(child: _typeChip('Exam')),
              const SizedBox(width: 10),
              Expanded(child: _typeChip('Assignment')),
            ]),
          ]),
          const SizedBox(height: 14),
          _card('Class & Subject', Icons.class_outlined, [
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedClass,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Class', isDense: true),
                  items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) { setState(() => _selectedClass = v!); _loadChapters(); },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedSubject,
                  isExpanded: true,
                  hint: const Text('Select', style: TextStyle(fontSize: 13)),
                  decoration: const InputDecoration(labelText: 'Subject', isDense: true),
                  items: schoolSubjects.map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) { setState(() => _selectedSubject = v); _loadChapters(); },
                ),
              ),
            ]),
          ]),
          if (_selectedSubject != null) ...[
            const SizedBox(height: 14),
            _card('Chapters', Icons.bookmark_border_rounded, [
              if (_chapters.isEmpty)
                const Text('No questions saved yet for this class/subject.', style: TextStyle(fontSize: 13, color: AppColors.textLight))
              else
                Wrap(spacing: 8, runSpacing: 8, children: _chapters.map((c) {
                  final active = _selectedChapters.contains(c);
                  return GestureDetector(
                    onTap: () => _toggleChapter(c),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: active ? AppColors.navy : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: active ? AppColors.navy : AppColors.border),
                      ),
                      child: Text(c, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                        color: active ? Colors.white : AppColors.text)),
                    ),
                  );
                }).toList()),
            ]),
          ],
          if (_loadingQuestions) ...[
            const SizedBox(height: 24),
            const Center(child: CircularProgressIndicator()),
          ],
          if (!_loadingQuestions && _questions.isNotEmpty) ...[
            const SizedBox(height: 14),
            _card('Questions (${_selectedQuestionIds.length}/${_questions.length} selected)', Icons.quiz_outlined, [
              ...grouped.entries.map((entry) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${entry.key}  (${entry.value.length})',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
                  const SizedBox(height: 6),
                  ...entry.value.map((q) {
                    final checked = _selectedQuestionIds.contains(q['id']);
                    return GestureDetector(
                      onTap: () => _toggleQuestion(q['id'] as String),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: checked ? AppColors.navy.withOpacity(.06) : AppColors.card,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: checked ? AppColors.navy.withOpacity(.3) : AppColors.border),
                        ),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Icon(checked ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                            size: 18, color: checked ? AppColors.navy : AppColors.textHint),
                          const SizedBox(width: 8),
                          Expanded(child: Text('${q['question_text']}  (${q['marks']} Mark${q['marks'] == 1 ? '' : 's'})',
                            style: const TextStyle(fontSize: 13, color: AppColors.text))),
                        ]),
                      ),
                    );
                  }),
                ]),
              )),
            ]),
          ],
          if (_questions.isNotEmpty) ...[
            const SizedBox(height: 14),
            _card('Paper Details', Icons.description_outlined, [
              TextField(
                controller: _titleCtrl,
                decoration: InputDecoration(
                  labelText: _paperType == 'Exam' ? 'e.g. Mid Term Examination' : 'e.g. Chapter 5 Assignment',
                  isDense: true,
                ),
              ),
              if (_paperType == 'Exam') ...[
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickDate,
                      icon: const Icon(Icons.calendar_today_rounded, size: 16),
                      label: Text(_examDate == null
                          ? 'Pick Date'
                          : '${_examDate!.day.toString().padLeft(2, '0')}-${_examDate!.month.toString().padLeft(2, '0')}-${_examDate!.year}'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(8)),
                      child: Text(_examDate == null ? '—' : _weekdays[_examDate!.weekday - 1],
                        style: const TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ]),
                const SizedBox(height: 14),
                const Text('Duration', style: TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: _durationHours,
                      isExpanded: true,
                      decoration: const InputDecoration(isDense: true),
                      items: List.generate(7, (h) => h).map((h) => DropdownMenuItem(value: h, child: Text('$h hour${h == 1 ? '' : 's'}'))).toList(),
                      onChanged: (v) => setState(() => _durationHours = v!),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: _durationMinutes,
                      isExpanded: true,
                      decoration: const InputDecoration(isDense: true),
                      items: [0, 10, 15, 20, 30, 40, 45, 50].map((m) => DropdownMenuItem(value: m, child: Text('$m minutes'))).toList(),
                      onChanged: (v) => setState(() => _durationMinutes = v!),
                    ),
                  ),
                ]),
              ],
              const SizedBox(height: 14),
              TextField(
                controller: _fullMarksCtrl,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(labelText: 'Full Marks (auto: $_computedFullMarks)', isDense: true),
              ),
              const SizedBox(height: 18),
              GestureDetector(
                onTap: _generating ? null : _generate,
                child: Container(
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: AppColors.navyGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                  ),
                  child: Center(
                    child: _generating
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.4))
                        : Text('Generate PDF (Full Marks: $_fullMarks)',
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _typeChip(String label) {
    final active = _paperType == label;
    return GestureDetector(
      onTap: () => setState(() => _paperType = label),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? AppColors.navy : AppColors.border),
        ),
        child: Text(label, textAlign: TextAlign.center,
          style: TextStyle(color: active ? Colors.white : AppColors.text, fontWeight: FontWeight.w700, fontSize: 13)),
      ),
    );
  }

  Widget _card(String title, IconData icon, List<Widget> children) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, size: 16, color: AppColors.navy),
        const SizedBox(width: 8),
        Expanded(child: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.text))),
      ]),
      const SizedBox(height: 12),
      ...children,
    ]),
  );
}
