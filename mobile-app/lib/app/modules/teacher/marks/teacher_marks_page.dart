import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherMarksPage extends StatefulWidget {
  final bool embedded;
  const TeacherMarksPage({super.key, this.embedded = false});
  @override
  State<TeacherMarksPage> createState() => _TeacherMarksPageState();
}

class _TeacherMarksPageState extends State<TeacherMarksPage> {
  List<Map<String, dynamic>> _exams    = [];
  List<Map<String, dynamic>> _students = [];
  Map<String, dynamic>?      _selExam;
  final Map<String, TextEditingController> _markCtrl = {};
  bool _loading  = true;
  bool _saving   = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_assigned'] as String? ?? '';
    final exams     = await SupabaseService.fetchExams(className: className);
    final students  = await SupabaseService.fetchClassStudents(className);
    setState(() { _exams = exams; _students = students; _loading = false; });
  }

  Future<void> _selectExam(Map<String, dynamic> exam) async {
    setState(() { _selExam = exam; _markCtrl.clear(); });
    final marks = await SupabaseService.fetchExamMarks(exam['id'] as String);
    for (final m in marks) {
      final sid = m['student_id'] as String;
      _markCtrl[sid] = TextEditingController(text: '${m['marks_obtained'] ?? ''}');
    }
    for (final s in _students) {
      _markCtrl.putIfAbsent(s['id'] as String, () => TextEditingController());
    }
    setState(() {});
  }

  Future<void> _saveMarks() async {
    setState(() => _saving = true);
    final profile   = AuthService.to.profile.value ?? {};
    final teacherId = profile['id'] as String?;
    final records   = _students
        .where((s) => _markCtrl[s['id']]?.text.isNotEmpty == true)
        .map((s) {
          final sid = s['id'] as String;
          return {
            'exam_id':        _selExam!['id'],
            'student_id':     sid,
            'marks_obtained': double.tryParse(_markCtrl[sid]!.text) ?? 0,
            'entered_by':     teacherId,
          };
        }).toList();
    await SupabaseService.saveMarksBatch(records);
    setState(() => _saving = false);
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Marks saved!'), backgroundColor: AppColors.green));
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _selExam == null
            ? _examList()
            : _markEntry();

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Exam Marks'),
        leading: _selExam != null
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => setState(() => _selExam = null))
            : null,
      ),
      body: body,
    );
  }

  Widget _examList() => _exams.isEmpty
      ? const Center(child: Text('No exams found.', style: TextStyle(color: AppColors.textLight)))
      : ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _exams.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final e = _exams[i];
            return GestureDetector(
              onTap: () => _selectExam(e),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.grading, color: AppColors.navy),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text('${e['subject'] ?? ''} · Max: ${e['max_marks'] ?? ''}',
                        style: const TextStyle(color: AppColors.textLight, fontSize: 12)),
                      if (e['date'] != null)
                        Text(DateFormat('d MMM yyyy').format(DateTime.parse(e['date'])),
                          style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
                    ],
                  )),
                  const Icon(Icons.chevron_right, color: AppColors.textHint),
                ]),
              ),
            );
          },
        );

  Widget _markEntry() => Column(
    children: [
      Container(
        color: AppColors.navy,
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          const Icon(Icons.grading, color: Colors.white, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_selExam!['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              Text('Max Marks: ${_selExam!['max_marks'] ?? ''}',
                style: const TextStyle(color: Colors.white60, fontSize: 12)),
            ],
          )),
        ]),
      ),
      Expanded(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _students.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final s  = _students[i];
            final id = s['id'] as String;
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(children: [
                CircleAvatar(
                  radius: 16, backgroundColor: AppColors.blueLight,
                  child: Text('${i + 1}', style: const TextStyle(
                    color: AppColors.navy, fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s['full_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                    Text(s['enrollment_no'] ?? '', style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                  ],
                )),
                SizedBox(
                  width: 80,
                  child: TextField(
                    controller: _markCtrl[id],
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(
                      hintText: 'Marks',
                      contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    ),
                  ),
                ),
              ]),
            );
          },
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: ElevatedButton.icon(
          onPressed: _saving ? null : _saveMarks,
          icon: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.save),
          label: Text(_saving ? 'Saving...' : 'Save All Marks'),
        ),
      ),
    ],
  );
}
