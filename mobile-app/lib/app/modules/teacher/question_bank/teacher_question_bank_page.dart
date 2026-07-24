import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';
import 'teacher_create_paper_page.dart';

class TeacherQuestionBankPage extends StatefulWidget {
  const TeacherQuestionBankPage({super.key});
  @override
  State<TeacherQuestionBankPage> createState() => _TeacherQuestionBankPageState();
}

const List<String> _defaultChapters = [
  'Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5',
  'Chapter 6', 'Chapter 7', 'Chapter 8', 'Chapter 9', 'Chapter 10',
  'Chapter 11', 'Chapter 12',
];
const String _addChapterValue = '__add_chapter__';

class _TeacherQuestionBankPageState extends State<TeacherQuestionBankPage> {
  late String _selectedClass;
  String? _selectedSubject;
  String? _selectedChapter;
  bool _addingCustomChapter = false;
  final _customChapterCtrl = TextEditingController();
  List<String> _chapterSuggestions = [];

  List<Map<String, dynamic>> _questions = [];
  bool _loading = false;

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
    _customChapterCtrl.dispose();
    super.dispose();
  }

  String? get _employeeId => (AuthService.to.profile.value ?? {})['id'] as String?;

  List<String> get _chapterOptions {
    final set = <String>{..._defaultChapters, ..._chapterSuggestions};
    final list = set.toList();
    list.sort((a, b) {
      final an = int.tryParse(a.replaceFirst('Chapter ', ''));
      final bn = int.tryParse(b.replaceFirst('Chapter ', ''));
      if (an != null && bn != null) return an.compareTo(bn);
      if (an != null) return -1;
      if (bn != null) return 1;
      return a.compareTo(b);
    });
    return list;
  }

  Future<void> _onSubjectChanged(String? v) async {
    setState(() { _selectedSubject = v; _selectedChapter = null; _questions = []; _chapterSuggestions = []; });
    final employeeId = _employeeId;
    if (employeeId == null || v == null) return;
    final chapters = await SupabaseService.fetchQuestionChapters(
      teacherId: employeeId, className: _selectedClass, subject: v,
    );
    if (mounted) setState(() => _chapterSuggestions = chapters);
  }

  void _confirmCustomChapter() {
    final v = _customChapterCtrl.text.trim();
    if (v.isEmpty) return;
    setState(() { _selectedChapter = v; _addingCustomChapter = false; _customChapterCtrl.clear(); });
    _load();
  }

  Future<void> _load() async {
    final employeeId = _employeeId;
    if (employeeId == null || _selectedSubject == null || _selectedChapter == null) {
      setState(() => _questions = []);
      return;
    }
    setState(() => _loading = true);
    final questions = await SupabaseService.fetchQuestions(
      teacherId: employeeId,
      className: _selectedClass,
      subject: _selectedSubject!,
      chapter: _selectedChapter,
    );
    final chapters = await SupabaseService.fetchQuestionChapters(
      teacherId: employeeId, className: _selectedClass, subject: _selectedSubject!,
    );
    if (mounted) setState(() { _questions = questions; _chapterSuggestions = chapters; _loading = false; });
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final q in _questions) {
      final key = q['question_format'] == 'MCQ' ? 'MCQ' : '${q['marks']} Mark${q['marks'] == 1 ? '' : 's'}';
      map.putIfAbsent(key, () => []).add(q);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _grouped;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Question Bank'),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TeacherCreatePaperPage())),
            icon: const Icon(Icons.note_add_outlined, color: Colors.white, size: 18),
            label: const Text('Create Paper', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
        ],
      ),
      body: Column(children: [
        Container(
          color: AppColors.card,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(children: [
            Row(children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedClass,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Class', isDense: true,
                    prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                  items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) { setState(() => _selectedClass = v!); _onSubjectChanged(_selectedSubject); },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedSubject,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Subject', isDense: true,
                    prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                  hint: const Text('Select', style: TextStyle(fontSize: 13)),
                  items: schoolSubjects.map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: _onSubjectChanged,
                ),
              ),
            ]),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: _addingCustomChapter ? null : _selectedChapter,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Chapter', isDense: true,
                prefixIcon: Icon(Icons.bookmark_border_rounded, color: AppColors.navy, size: 20)),
              hint: Text(_selectedSubject == null ? 'Select a subject first' : 'Select', style: const TextStyle(fontSize: 13)),
              items: _selectedSubject == null ? [] : [
                ..._chapterOptions.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                const DropdownMenuItem(value: _addChapterValue, child: Text('+ Add New Chapter',
                  style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy))),
              ],
              onChanged: _selectedSubject == null ? null : (v) {
                if (v == _addChapterValue) {
                  setState(() => _addingCustomChapter = true);
                } else if (v != null) {
                  setState(() { _selectedChapter = v; _addingCustomChapter = false; });
                  _load();
                }
              },
            ),
            if (_addingCustomChapter) ...[
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _customChapterCtrl,
                    autofocus: true,
                    decoration: const InputDecoration(labelText: 'New Chapter Name', isDense: true,
                      prefixIcon: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20)),
                    onSubmitted: (_) => _confirmCustomChapter(),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: _confirmCustomChapter,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy, minimumSize: const Size(0, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Icon(Icons.check_rounded, color: Colors.white),
                ),
              ]),
            ],
          ]),
        ),
        const Divider(height: 1, color: AppColors.border),

        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : (_selectedSubject == null || _selectedChapter == null)
                  ? _emptyState('Select a subject and chapter to view or add questions.', Icons.menu_book_rounded)
                  : _questions.isEmpty
                      ? _emptyState('No questions yet for this class/subject/chapter.\nTap + to add one.', Icons.quiz_outlined)
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                          children: grouped.entries.map((entry) => _sectionGroup(entry.key, entry.value)).toList(),
                        ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: (_selectedSubject == null || _selectedChapter == null) ? null : () => _showAddSheet(),
        backgroundColor: (_selectedSubject == null || _selectedChapter == null) ? AppColors.textHint : AppColors.navy,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Question', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _emptyState(String msg, IconData icon) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.indigoLight, shape: BoxShape.circle),
        child: Icon(icon, color: AppColors.indigo, size: 38),
      ),
      const SizedBox(height: 16),
      Text(msg, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));

  Widget _sectionGroup(String label, List<Map<String, dynamic>> items) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 2),
        child: Text('$label  (${items.length})',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy)),
      ),
      ...items.map((q) => _questionCard(q)),
    ]),
  );

  Widget _questionCard(Map<String, dynamic> q) {
    final isMcq = q['question_format'] == 'MCQ';
    return GestureDetector(
      onTap: () => _showAddSheet(existing: q),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(q['question_text'] ?? '', style: const TextStyle(fontSize: 14, color: AppColors.text, fontWeight: FontWeight.w600)),
            if (isMcq && q['options'] is List) ...[
              const SizedBox(height: 6),
              ...List<Map<String, dynamic>>.from(q['options']).map((o) => Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('${o['label']}. ${o['text']}',
                  style: TextStyle(fontSize: 12, color: q['correct_option'] == o['label'] ? AppColors.green : AppColors.textLight,
                    fontWeight: q['correct_option'] == o['label'] ? FontWeight.w700 : FontWeight.normal)),
              )),
            ],
          ])),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red, size: 20),
            onPressed: () => _confirmDelete(q),
          ),
        ]),
      ),
    );
  }

  void _confirmDelete(Map<String, dynamic> q) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Delete Question?'),
      content: const Text('This cannot be undone.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        TextButton(
          onPressed: () async { await SupabaseService.deleteQuestion(q['id']); if (mounted) Navigator.pop(ctx); _load(); },
          child: const Text('Delete', style: TextStyle(color: AppColors.red)),
        ),
      ],
    ));
  }

  void _showAddSheet({Map<String, dynamic>? existing}) {
    final isEdit = existing != null;
    String format = existing?['question_format'] ?? 'Written';
    final marksCtrl = TextEditingController(text: existing?['marks']?.toString() ?? '1');
    final textCtrl = TextEditingController(text: existing?['question_text'] ?? '');
    final optionCtrls = List.generate(4, (i) {
      final label = String.fromCharCode(65 + i);
      final existingOptions = existing?['options'];
      String text = '';
      if (existingOptions is List) {
        final match = existingOptions.cast<Map>().firstWhere((o) => o['label'] == label, orElse: () => {});
        text = match['text']?.toString() ?? '';
      }
      return TextEditingController(text: text);
    });
    String? correctOption = existing?['correct_option'];
    String? error;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.88),
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                  Row(children: [
                    Expanded(child: Text(isEdit ? 'Edit Question' : 'Add Question',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text))),
                    IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _formatChip('Written', format, (v) => setS(() => format = v))),
                    const SizedBox(width: 8),
                    Expanded(child: _formatChip('MCQ', format, (v) => setS(() => format = v))),
                  ]),
                  const SizedBox(height: 14),
                  TextField(
                    controller: marksCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Marks', prefixIcon: Icon(Icons.star_border_rounded, color: AppColors.navy, size: 20)),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: textCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Question', prefixIcon: Padding(
                      padding: EdgeInsets.only(bottom: 40), child: Icon(Icons.help_outline_rounded, color: AppColors.navy, size: 20))),
                  ),
                  if (format == 'MCQ') ...[
                    const SizedBox(height: 16),
                    const Text('Options (mark the correct one)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight)),
                    const SizedBox(height: 8),
                    ...List.generate(4, (i) {
                      final label = String.fromCharCode(65 + i);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(children: [
                          Radio<String>(
                            value: label, groupValue: correctOption,
                            onChanged: (v) => setS(() => correctOption = v),
                            activeColor: AppColors.green,
                          ),
                          Expanded(child: TextField(
                            controller: optionCtrls[i],
                            decoration: InputDecoration(labelText: 'Option $label', isDense: true),
                          )),
                        ]),
                      );
                    }),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!, style: const TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: () async {
                      final marks = int.tryParse(marksCtrl.text.trim());
                      if (marks == null || marks <= 0) { setS(() => error = 'Enter a valid marks value.'); return; }
                      if (textCtrl.text.trim().isEmpty) { setS(() => error = 'Enter the question text.'); return; }
                      List<Map<String, String>>? options;
                      if (format == 'MCQ') {
                        options = List.generate(4, (i) => {'label': String.fromCharCode(65 + i), 'text': optionCtrls[i].text.trim()});
                        if (options.any((o) => o['text']!.isEmpty)) { setS(() => error = 'Fill in all 4 options.'); return; }
                        if (correctOption == null) { setS(() => error = 'Select the correct option.'); return; }
                      }

                      final employeeId = _employeeId;
                      if (employeeId == null) { setS(() => error = 'Session error - please sign in again.'); return; }

                      final data = {
                        'teacher_id': employeeId,
                        'class': _selectedClass,
                        'subject': _selectedSubject,
                        'chapter': _selectedChapter,
                        'question_format': format,
                        'marks': marks,
                        'question_text': textCtrl.text.trim(),
                        'options': format == 'MCQ' ? options : null,
                        'correct_option': format == 'MCQ' ? correctOption : null,
                      };
                      if (isEdit) {
                        await SupabaseService.updateQuestion(existing['id'], data);
                      } else {
                        await SupabaseService.createQuestion(data);
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
                      _load();
                    },
                    child: Container(
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(14),
                        boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                      ),
                      child: Center(child: Text(isEdit ? 'Save Changes' : 'Add to Bank',
                        style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _formatChip(String label, String selected, ValueChanged<String> onSelect) {
    final active = label == selected;
    return GestureDetector(
      onTap: () => onSelect(label),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? AppColors.navy : AppColors.border),
        ),
        child: Text(label, textAlign: TextAlign.center,
          style: TextStyle(color: active ? Colors.white : AppColors.text, fontWeight: FontWeight.w700, fontSize: 13)),
      ),
    );
  }
}
