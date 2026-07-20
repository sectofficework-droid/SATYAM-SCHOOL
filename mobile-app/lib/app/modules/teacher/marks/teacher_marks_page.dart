import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

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
  bool _loading       = true;
  bool _loadingRoster = false;
  bool _saving        = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _selExam = null; _students = []; });
    final profile    = AuthService.to.profile.value ?? {};
    final classes    = teacherClasses(profile);
    final employeeId = profile['id'] as String?;
    final exams      = await SupabaseService.fetchExams(classNames: classes, createdBy: employeeId);
    if (mounted) setState(() { _exams = exams; _loading = false; });
  }

  // Marks can only be entered on or after the exam date - not before, even
  // if the exam was already created for a future date.
  bool _isUpcoming(Map<String, dynamic> exam) {
    final d = exam['date'] as String?;
    if (d == null || d.isEmpty) return false;
    final examDate = DateTime.tryParse(d);
    if (examDate == null) return false;
    final today = DateTime.now();
    final examDay = DateTime(examDate.year, examDate.month, examDate.day);
    final todayDay = DateTime(today.year, today.month, today.day);
    return examDay.isAfter(todayDay);
  }

  Future<void> _selectExam(Map<String, dynamic> exam) async {
    if (_isUpcoming(exam)) {
      final d = DateTime.tryParse(exam['date'] as String);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Marks can be entered on or after the exam date'
            '${d != null ? " (${DateFormat('d MMM yyyy').format(d)})" : ""}.'),
        backgroundColor: AppColors.amber,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
      return;
    }
    setState(() { _selExam = exam; _markCtrl.clear(); _students = []; _loadingRoster = true; });

    final profile     = AuthService.to.profile.value ?? {};
    final sectionId   = profile['class_teacher_of_section_id']?.toString();
    final myClassName = profile['class_name'] as String?;
    final examClass   = exam['class'] as String?;

    // Use the section-accurate roster when it's the exam for the teacher's
    // own class-teacher section; otherwise (a class they teach as subject
    // teacher, or a class they created this exam for) look the class up by
    // name, since subject teachers don't have a section_id for it.
    final students = (sectionId != null && sectionId.isNotEmpty && examClass == myClassName)
        ? await SupabaseService.fetchClassStudents(sectionId)
        : (examClass != null ? await SupabaseService.fetchClassStudentsByName(examClass) : <Map<String, dynamic>>[]);

    final marks = await SupabaseService.fetchExamMarks(exam['id'] as String);
    for (final m in marks) {
      final sid = m['student_id'] as String;
      _markCtrl[sid] = TextEditingController(text: '${m['marks_obtained'] ?? ''}');
    }
    for (final s in students) {
      _markCtrl.putIfAbsent(s['id'] as String, () => TextEditingController());
    }
    if (mounted) setState(() { _students = students; _loadingRoster = false; });
  }

  void _showCreateExamSheet() {
    final nameCtrl = TextEditingController();
    final maxCtrl  = TextEditingController(text: '100');
    final profile  = AuthService.to.profile.value ?? {};
    final myClasses = teacherClasses(profile);
    String? selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : (myClasses.isNotEmpty ? myClasses.first : null);
    String? selectedSubject;
    DateTime? examDate;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          final subjectOptions = selectedClass != null ? teacherSubjectsForClass(profile, selectedClass!) : <String>[];
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(child: Container(
                    width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
                  )),
                  Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [AppColors.purple, AppColors.purple.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.grading_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Create Exam', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                      Text('Set up a new test for your class', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                    ])),
                    IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                  ]),
                  const SizedBox(height: 20),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Exam Name (e.g. Unit Test 1)', prefixIcon: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20)),
                  ),
                  const SizedBox(height: 14),
                  if (myClasses.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.redLight, borderRadius: BorderRadius.circular(10)),
                      child: const Text(
                        'No classes are assigned to you yet. Ask admin to set your Subject/Class mapping.',
                        style: TextStyle(color: AppColors.red, fontSize: 12),
                      ),
                    )
                  else
                    DropdownButtonFormField<String>(
                      value: selectedClass,
                      decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                      items: myClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                      onChanged: (v) => setS(() { selectedClass = v; selectedSubject = null; }),
                    ),
                  const SizedBox(height: 14),
                  if (subjectOptions.isNotEmpty)
                    DropdownButtonFormField<String>(
                      value: selectedSubject,
                      decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                      items: subjectOptions.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                      onChanged: (v) => setS(() => selectedSubject = v),
                    )
                  else
                    TextField(
                      onChanged: (v) => selectedSubject = v,
                      decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                    ),
                  const SizedBox(height: 14),
                  GestureDetector(
                    onTap: () async {
                      final d = await showDatePicker(
                        context: ctx,
                        initialDate: DateTime.now(),
                        firstDate: DateTime.now().subtract(const Duration(days: 30)),
                        lastDate: DateTime.now().add(const Duration(days: 180)),
                      );
                      if (d != null) setS(() => examDate = d);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        border: Border.all(color: examDate != null ? AppColors.navy : AppColors.border, width: examDate != null ? 2 : 1),
                        borderRadius: BorderRadius.circular(12),
                        color: AppColors.card,
                      ),
                      child: Row(children: [
                        Icon(Icons.calendar_month_rounded, size: 20, color: examDate != null ? AppColors.navy : AppColors.textHint),
                        const SizedBox(width: 10),
                        Text(
                          examDate == null ? 'Exam Date (optional)' : DateFormat('EEEE, d MMM yyyy').format(examDate!),
                          style: TextStyle(color: examDate == null ? AppColors.textHint : AppColors.text, fontWeight: examDate != null ? FontWeight.w600 : FontWeight.normal),
                        ),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: maxCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Max Marks', prefixIcon: Icon(Icons.numbers_rounded, color: AppColors.navy, size: 20)),
                  ),
                  const SizedBox(height: 20),
                  GestureDetector(
                    onTap: () async {
                      if (nameCtrl.text.trim().isEmpty || selectedClass == null || (selectedSubject ?? '').trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Please fill exam name, class, and subject'),
                          behavior: SnackBarBehavior.floating,
                        ));
                        return;
                      }
                      await SupabaseService.createExam({
                        'name':       nameCtrl.text.trim(),
                        'class':      selectedClass,
                        'subject':    selectedSubject!.trim(),
                        'date':       examDate != null ? DateFormat('yyyy-MM-dd').format(examDate!) : null,
                        'max_marks':  double.tryParse(maxCtrl.text) ?? 100,
                        'created_by': profile['id'],
                      });
                      if (mounted) Navigator.pop(ctx);
                      _load();
                    },
                    child: Container(
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: AppColors.navyGradient,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                      ),
                      child: const Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.add_circle_outline_rounded, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text('Create Exam', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                      ])),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
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

    // "Create Exam" is only offered on the exam list, not while entering marks.
    final fab = _selExam == null
        ? FloatingActionButton.extended(
            onPressed: _showCreateExamSheet,
            backgroundColor: AppColors.navy,
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('Create Exam', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          )
        : null;

    if (widget.embedded) {
      // A nested Scaffold's floatingActionButton can render behind/clipped
      // by the outer tab shell's custom bottom nav bar (extendBody: true) -
      // a Stack + Positioned button avoids depending on Scaffold's FAB
      // docking logic entirely.
      return Stack(children: [
        Positioned.fill(child: body),
        // 88 clears the outer tab shell's custom bottom nav bar, which this
        // embedded page's body renders behind (extendBody: true).
        if (fab != null) Positioned(right: 16, bottom: 88, child: fab),
      ]);
    }
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: Text(_selExam == null ? 'Exam Marks' : _selExam!['name'] ?? 'Enter Marks'),
        leading: _selExam != null
            ? IconButton(icon: const Icon(Icons.arrow_back_ios_rounded), onPressed: () => setState(() { _selExam = null; _markCtrl.clear(); }))
            : null,
      ),
      floatingActionButton: fab,
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
      subtitle: 'Tap "Create Exam" below to set up a test for one of your classes.',
    );

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _exams.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final e = _exams[i];
        final date    = e['date'] != null ? DateTime.tryParse(e['date']) : null;
        final upcoming = _isUpcoming(e);
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: Duration(milliseconds: 300 + i * 60),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(opacity: v,
            child: Transform.translate(offset: Offset(0, 20 * (1 - v)), child: child)),
          child: GestureDetector(
            onTap: () => _selectExam(e),
            child: Opacity(
              opacity: upcoming ? 0.65 : 1.0,
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
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      if ((e['class'] ?? '').toString().isNotEmpty)
                        _tag('Class ${e['class']}', AppColors.greenLight, AppColors.green),
                      _tag(e['subject'] ?? '', AppColors.blueLight, AppColors.blue),
                      _tag('Max: ${e['max_marks'] ?? ''}', AppColors.amberLight, AppColors.amber),
                      if (upcoming)
                        _tag('Upcoming', AppColors.amberLight, AppColors.amber),
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
                Icon(upcoming ? Icons.lock_outline_rounded : Icons.chevron_right_rounded, color: AppColors.textHint),
              ]),
            ),
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
        child: _loadingRoster
          ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
          : _students.isEmpty
          ? _emptyState(icon: Icons.people_outline, title: 'No Students', subtitle: 'No students found for this class.')
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
