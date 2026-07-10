import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
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
  bool _loading = true;
  bool _saving  = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _selExam = null; });
    final profile    = AuthService.to.profile.value ?? {};
    final className  = profile['class_name'] as String? ?? '';       // fixed: was class_assigned
    final sectionId  = profile['class_teacher_of_section_id']?.toString() ?? '';
    final exams      = await SupabaseService.fetchExams(className: className);
    final students   = sectionId.isNotEmpty
        ? await SupabaseService.fetchClassStudents(sectionId)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _exams = exams; _students = students; _loading = false; });
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
    if (mounted) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Row(children: [
          Icon(Icons.check_circle, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text('Marks saved successfully!'),
        ]),
        backgroundColor: AppColors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else if (_selExam == null) {
      body = _buildExamList();
    } else {
      body = _buildMarkEntry();
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: Text(_selExam == null ? 'Exam Marks' : _selExam!['name'] ?? 'Enter Marks'),
        leading: _selExam != null
            ? IconButton(icon: const Icon(Icons.arrow_back_ios_rounded), onPressed: () => setState(() { _selExam = null; _markCtrl.clear(); }))
            : null,
      ),
      body: body,
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 76, decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  Widget _buildExamList() {
    if (_exams.isEmpty) return _emptyState(
      icon: Icons.grading_rounded,
      title: 'No Exams Found',
      subtitle: 'Exams for your class will appear here once created by the admin.',
    );

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _exams.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final e = _exams[i];
        final date = e['date'] != null ? DateTime.tryParse(e['date']) : null;
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: Duration(milliseconds: 300 + i * 60),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(opacity: v,
            child: Transform.translate(offset: Offset(0, 20 * (1 - v)), child: child)),
          child: GestureDetector(
            onTap: () => _selectExam(e),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppShadows.card,
              ),
              child: Row(children: [
                Container(
                  width: 50, height: 50,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.purple, AppColors.purple.withOpacity(.6)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.grading_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(e['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
                    const SizedBox(height: 3),
                    Row(children: [
                      _tag(e['subject'] ?? '', AppColors.blueLight, AppColors.blue),
                      const SizedBox(width: 6),
                      _tag('Max: ${e['max_marks'] ?? ''}', AppColors.amberLight, AppColors.amber),
                    ]),
                    if (date != null) Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(children: [
                        const Icon(Icons.calendar_today_rounded, size: 11, color: AppColors.textHint),
                        const SizedBox(width: 4),
                        Text(DateFormat('d MMM yyyy').format(date),
                          style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
                      ]),
                    ),
                  ],
                )),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
              ]),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMarkEntry() {
    final maxMarks = _selExam!['max_marks'] ?? 100;
    return Column(children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: const BoxDecoration(
          gradient: AppColors.navyGradient,
          boxShadow: AppShadows.colored,
        ),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: Colors.white.withOpacity(.15), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.grading_rounded, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_selExam!['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
            Text('${_selExam!['subject'] ?? ''}  ·  Max Marks: $maxMarks',
              style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: Colors.white.withOpacity(.15), borderRadius: BorderRadius.circular(8)),
            child: Text('${_students.length} students',
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
      Expanded(
        child: _students.isEmpty
          ? _emptyState(icon: Icons.people_outline, title: 'No Students', subtitle: 'No students found for your class.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _students.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final s  = _students[i];
                final id = s['id'] as String;
                final fullName = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: AppShadows.card,
                  ),
                  child: Row(children: [
                    Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.navy, AppColors.navyMid],
                          begin: Alignment.topLeft, end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(child: Text('${i + 1}',
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800))),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(fullName.isNotEmpty ? fullName : (s['full_name'] ?? '—'),
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                      Text('GR: ${s['grno'] ?? s['enrollment_no'] ?? ''}',
                        style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                    ])),
                    SizedBox(
                      width: 88,
                      child: TextField(
                        controller: _markCtrl[id],
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                        decoration: InputDecoration(
                          hintText: '—',
                          hintStyle: const TextStyle(color: AppColors.textHint),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppColors.navy, width: 2),
                          ),
                          filled: true,
                          fillColor: AppColors.bg,
                          suffixText: '/$maxMarks',
                          suffixStyle: const TextStyle(fontSize: 10, color: AppColors.textHint),
                        ),
                      ),
                    ),
                  ]),
                );
              },
            ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
        child: GestureDetector(
          onTap: _saving ? null : _saveMarks,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 52,
            decoration: BoxDecoration(
              gradient: _saving ? null : AppColors.navyGradient,
              color: _saving ? AppColors.textHint : null,
              borderRadius: BorderRadius.circular(14),
              boxShadow: _saving ? [] : [
                BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6)),
              ],
            ),
            child: Center(child: _saving
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
              : const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.save_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text('Save All Marks', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                ])),
          ),
        ),
      ),
    ]);
  }

  Widget _tag(String label, Color bg, Color fg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
    child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
  );

  Widget _emptyState({required IconData icon, required String title, required String subtitle}) =>
    Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
          child: Icon(icon, color: AppColors.navy, size: 38),
        ),
        const SizedBox(height: 16),
        Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 8),
        Text(subtitle, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
      ]),
    ));
}
