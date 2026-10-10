import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';
import '../../../../core/utils/official_exam_table_pdf.dart';

class TeacherOfficialExamsPage extends StatefulWidget {
  final bool embedded;
  const TeacherOfficialExamsPage({super.key, this.embedded = false});
  @override
  State<TeacherOfficialExamsPage> createState() => TeacherOfficialExamsPageState();
}

// Public (not _-prefixed) so an embedding parent (TeacherExamsPage) can hold
// a GlobalKey<TeacherOfficialExamsPageState> and drive the back-step flow
// itself - needed because this page is always used with embedded: true in
// practice (inside TeacherExamsPage's tab switcher), which skips this
// class's own Scaffold/AppBar entirely, so its own leading-icon back
// handling below never actually runs. Without this, the parent's default
// back button/system back gesture pops the WHOLE pushed route straight to
// wherever it was opened from (e.g. the dashboard), rather than stepping
// back one screen inside this exam-entry flow - confirmed as a real,
// reported bug (teacher fills one subject's marks, presses back, lands on
// the dashboard instead of the subject list).
class TeacherOfficialExamsPageState extends State<TeacherOfficialExamsPage> {
  // 'list' -> 'class' -> 'subject' -> 'entry' (Enter Marks scope)
  // 'list' -> 'overview' (My Class - All Subjects scope, class teachers only)
  String _step = 'list';

  List<Map<String, dynamic>> _exams = [];
  bool _loading = true;
  bool _isClassTeacher = false;
  String? _ownClassName;

  // 0 = Enter Marks, 1 = My Class - All Subjects
  int _scope = 0;

  Map<String, dynamic>? _selectedExam;
  String? _selectedClass;
  String? _selectedSubject;

  List<String> _subjects = [];
  bool _loadingSubjects = false;

  List<Map<String, dynamic>> _students = [];
  final Map<String, TextEditingController> _markCtrl = {};
  double _maxMarks = 50; // placeholder until _selectSubject's fetch resolves (REQ-BUG-075: school's real default)
  bool _loadingRoster = false;
  bool _saving = false;

  // REQ-BUG-067 (2026-10-04): _markCtrl.clear() alone leaked one
  // TextEditingController per student every time the teacher switched
  // subject/exam (this class never overrode dispose() either, so even
  // closing the page leaked whatever was left) - dispose each controller
  // before dropping it from the map.
  void _clearMarkControllers() {
    for (final c in _markCtrl.values) { c.dispose(); }
    _markCtrl.clear();
  }

  @override
  void dispose() {
    for (final c in _markCtrl.values) { c.dispose(); }
    super.dispose();
  }

  // Marks above max_marks (set by admin in Settings -> Exams) or negative -
  // reported by teachers as a bug (nothing stopped e.g. 90/50 being saved).
  // Tracked reactively so the field itself turns red as soon as it happens,
  // not just when Save is pressed.
  final Set<String> _invalidIds = {};

  bool _isMarkValid(String text) {
    if (text.isEmpty) return true;
    final v = double.tryParse(text);
    return v != null && v >= 0 && v <= _maxMarks;
  }

  void _onMarkChanged(String studentId, String value) {
    final nowInvalid = !_isMarkValid(value);
    if (nowInvalid != _invalidIds.contains(studentId)) {
      setState(() {
        if (nowInvalid) { _invalidIds.add(studentId); } else { _invalidIds.remove(studentId); }
      });
    }
  }

  List<String> _overviewSubjects = [];
  List<Map<String, dynamic>> _overviewSubjectsDetailed = []; // [{name, isOptional}] - for rank only
  Map<String, double> _overviewMaxMarks = {}; // subject_name -> max_marks, for rank only
  List<Map<String, dynamic>> _overviewStudents = [];
  List<Map<String, dynamic>> _overviewMarks = [];
  bool _loadingOverview = false;

  // 'subject' = grouped-by-subject list (optionally filtered to one
  // subject), 'table' = spreadsheet-style grid of every subject at once,
  // 'rank' = class-ranked list by percentage for this exam.
  String _overviewMode = 'subject';
  String? _overviewSubjectFilter;
  bool _exportingOverviewPdf = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile = AuthService.to.profile.value ?? {};
    _ownClassName = profile['class_name'] as String?;
    _isClassTeacher = _ownClassName != null && _ownClassName!.isNotEmpty;

    final exams = await SupabaseService.fetchOfficialExams();
    if (mounted) setState(() { _exams = exams; _loading = false; });
  }

  // Locked while today is before the exam's end date - unlocks the day of.
  bool _isLocked(Map<String, dynamic> exam) {
    final endDate = DateTime.tryParse(exam['end_date'] ?? '');
    if (endDate == null) return false;
    final today = DateTime.now();
    final todayDay = DateTime(today.year, today.month, today.day);
    final endDay = DateTime(endDate.year, endDate.month, endDate.day);
    return todayDay.isBefore(endDay);
  }

  void _selectExam(Map<String, dynamic> exam) {
    if (_isLocked(exam)) {
      final endDate = DateTime.tryParse(exam['end_date'] ?? '');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Marks can be entered once this exam ends'
            '${endDate != null ? " (${DateFormat('d MMM yyyy').format(endDate)})" : ""}.'),
        backgroundColor: AppColors.amber,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
      return;
    }
    setState(() { _selectedExam = exam; });
    if (_scope == 1 && _isClassTeacher) {
      setState(() { _step = 'overview'; _overviewMode = 'subject'; _overviewSubjectFilter = null; });
      _loadOverview();
    } else {
      setState(() => _step = 'class');
    }
  }

  void _selectClass(String className) {
    setState(() { _selectedClass = className; _step = 'subject'; _loadingSubjects = true; _subjects = []; });
    SupabaseService.fetchClassSubjects(className).then((subs) {
      if (mounted) setState(() { _subjects = subs; _loadingSubjects = false; });
    });
  }

  Future<void> _selectSubject(String subject) async {
    _clearMarkControllers();
    setState(() { _selectedSubject = subject; _step = 'entry'; _loadingRoster = true; _students = []; _invalidIds.clear(); });
    final examId = _selectedExam!['id'] as String;
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    final results = await Future.wait([
      SupabaseService.fetchClassStudentsByName(_selectedClass!),
      (employeeId != null && sessionToken != null)
          ? SupabaseService.fetchOfficialExamMarks(employeeId, sessionToken, examId, _selectedClass!, subject)
          : Future.value(<Map<String, dynamic>>[]),
      SupabaseService.fetchExamSubjectMaxMarks(examId, _selectedClass!, subject),
    ]);
    final students   = results[0] as List<Map<String, dynamic>>;
    final marks      = results[1] as List<Map<String, dynamic>>;
    final maxMarks   = results[2] as double;
    for (final m in marks) {
      final sid = m['student_id'] as String;
      _markCtrl[sid] = TextEditingController(text: '${m['marks_obtained'] ?? ''}');
    }
    for (final s in students) {
      _markCtrl.putIfAbsent(s['id'] as String, () => TextEditingController());
    }
    if (mounted) setState(() { _students = students; _maxMarks = maxMarks; _loadingRoster = false; });
  }

  Future<void> _saveMarks() async {
    final records = _students
        .where((s) => _markCtrl[s['id']]?.text.isNotEmpty == true)
        .map((s) {
          final sid = s['id'] as String;
          return {
            'exam_id':        _selectedExam!['id'],
            'student_id':     sid,
            'class_name':     _selectedClass,
            'subject_name':   _selectedSubject,
            'marks_obtained': double.tryParse(_markCtrl[sid]!.text) ?? 0,
          };
        }).toList();

    // A student left blank while everyone else in the class got a real mark
    // this save is saved as Absent by default, instead of being silently
    // skipped and left with no record at all - a straggler at save time
    // almost always means they didn't take the exam, not that the teacher
    // forgot them specifically.
    final autoAbsentStudents = records.isNotEmpty
        ? _students.where((s) => _markCtrl[s['id']]?.text.isNotEmpty != true).toList()
        : <Map<String, dynamic>>[];
    for (final s in autoAbsentStudents) {
      records.add({
        'exam_id':        _selectedExam!['id'],
        'student_id':     s['id'],
        'class_name':     _selectedClass,
        'subject_name':   _selectedSubject,
        'marks_obtained': 0,
        'is_absent':      true,
      });
    }

    // Reported bug: a mark above max_marks (set by admin) or negative saved
    // with no pushback. Block the save outright rather than silently
    // clamping - this is almost always a typo the teacher needs to notice,
    // not a value to quietly correct for them.
    final badCount = records.where((r) {
      final m = r['marks_obtained'] as num;
      return m < 0 || m > _maxMarks;
    }).length;
    if (badCount > 0) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$badCount mark${badCount == 1 ? '' : 's'} above the maximum '
            '(${_maxMarks.toStringAsFixed(0)}) or negative - fix the highlighted field${badCount == 1 ? '' : 's'} before saving.'),
        backgroundColor: AppColors.red,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
      return;
    }

    final profile   = AuthService.to.profile.value ?? {};
    final teacherId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    // REQ-BUG-066 (2026-10-04): this guard used to let the method fall
    // through to the unconditional "saved" success state below with no RPC
    // call ever made - a stale/null session silently discarded the marks
    // while the UI said it saved. Fail loudly instead, before the try block.
    if (teacherId == null || sessionToken == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Session error - please sign in again.'), backgroundColor: AppColors.red, behavior: SnackBarBehavior.floating));
      return;
    }
    setState(() => _saving = true);
    try {
      await SupabaseService.saveOfficialMarksBatch(teacherId, sessionToken, records);
      if (mounted) {
        final absentNote = autoAbsentStudents.isNotEmpty
            ? ' (${autoAbsentStudents.length} left blank marked Absent)'
            : '';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Row(children: [
            const Icon(Icons.check_circle, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Expanded(child: Text('Marks saved successfully!$absentNote')),
          ]),
          backgroundColor: AppColors.green,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Row(children: [
            Icon(Icons.error_outline, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Expanded(child: Text('Failed to save marks. Please try again.')),
          ]),
          backgroundColor: AppColors.red,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _loadOverview() async {
    setState(() => _loadingOverview = true);
    final className = _ownClassName!;
    final examId    = _selectedExam!['id'] as String;
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    final results = await Future.wait([
      SupabaseService.fetchClassSubjects(className),
      SupabaseService.fetchClassStudentsByName(className),
      (employeeId != null && sessionToken != null)
          ? SupabaseService.fetchOfficialExamMarksForClass(employeeId, sessionToken, examId, className)
          : Future.value(<Map<String, dynamic>>[]),
      SupabaseService.fetchClassSubjectsDetailed(className),
      SupabaseService.fetchExamSubjectConfigForClass(examId, className),
    ]);
    if (mounted) {
      setState(() {
      _overviewSubjects = results[0] as List<String>;
      _overviewStudents = results[1] as List<Map<String, dynamic>>;
      _overviewMarks    = results[2] as List<Map<String, dynamic>>;
      _overviewSubjectsDetailed = results[3] as List<Map<String, dynamic>>;
      _overviewMaxMarks = results[4] as Map<String, double>;
      _loadingOverview  = false;
    });
    }
  }

  String get _title {
    switch (_step) {
      case 'class':    return _selectedExam?['name'] ?? 'Select Class';
      case 'subject':  return _selectedClass ?? 'Select Subject';
      case 'entry':    return _selectedSubject ?? 'Enter Marks';
      case 'overview': return _selectedExam?['name'] ?? 'Class Overview';
      default:         return 'Official Exams';
    }
  }

  // Public API for the embedding parent (TeacherExamsPage) - see the class-
  // level comment above for why this is needed.
  bool get isAtRoot => _step == 'list';
  void goBack() => _goBack();

  void _goBack() {
    if (_step == 'entry') _clearMarkControllers();
    setState(() {
      switch (_step) {
        case 'class':
          _step = 'list'; _selectedExam = null;
          break;
        case 'subject':
          _step = 'class'; _subjects = [];
          break;
        case 'entry':
          _step = 'subject'; _students = [];
          break;
        case 'overview':
          _step = 'list'; _selectedExam = null;
          break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else {
      switch (_step) {
        case 'class':    body = _buildClassPicker(); break;
        case 'subject':  body = _buildSubjectPicker(); break;
        case 'entry':    body = _buildMarkEntry(); break;
        case 'overview': body = _buildOverview(); break;
        default:         body = _buildExamList();
      }
    }

    if (widget.embedded) return body;

    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: Text(_title),
        // Always shown, unlike relying on Flutter's automatic back button -
        // on the list step it leaves the page entirely, on every other step
        // it steps back one screen in the exam-entry flow.
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded),
          onPressed: _step == 'list' ? () => Navigator.of(context).pop() : _goBack,
        ),
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
      child: Container(height: 76, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  // Enter Marks vs My Class - All Subjects - only meaningful (and only
  // shown) for an actual class teacher.
  Widget _buildScopeTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withValues(alpha: .08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _scopeTabButton('Enter Marks', 0)),
        Expanded(child: _scopeTabButton('My Class — All Subjects', 1)),
      ]),
    ),
  );

  Widget _scopeTabButton(String label, int index) {
    final active = _scope == index;
    return GestureDetector(
      onTap: () => setState(() => _scope = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: active ? AppShadows.card : null,
        ),
        child: Center(child: Text(label, textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
      ),
    );
  }

  Widget _buildExamList() {
    final list = _exams.isEmpty
      ? _emptyState(icon: Icons.fact_check_rounded, title: 'No Exams Yet', subtitle: 'The school hasn\'t added any official exams yet.')
      : ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _exams.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final e = _exams[i];
            final startDate = DateTime.tryParse(e['start_date'] ?? '');
            final endDate = DateTime.tryParse(e['end_date'] ?? '');
            final locked = _isLocked(e);
            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: Duration(milliseconds: 300 + i * 60),
              curve: Curves.easeOut,
              builder: (_, v, child) => Opacity(opacity: v,
                child: Transform.translate(offset: Offset(0, 20 * (1 - v)), child: child)),
              child: GestureDetector(
                onTap: () => _selectExam(e),
                child: Opacity(
                  opacity: locked ? 0.65 : 1.0,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
                    child: Row(children: [
                      Container(
                        width: 50, height: 50,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [AppColors.lime, AppColors.lime.withValues(alpha: .6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.fact_check_rounded, color: Colors.white, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(e['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
                        const SizedBox(height: 4),
                        Wrap(spacing: 6, runSpacing: 4, children: [
                          _tag(locked ? 'Coming Soon' : 'Marks Entry Open', locked ? AppColors.amberLight : AppColors.greenLight, locked ? AppColors.amber : AppColors.green),
                        ]),
                        if (endDate != null) Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(children: [
                            const Icon(Icons.event_rounded, size: 11, color: AppColors.textHint),
                            const SizedBox(width: 4),
                            Text(
                              startDate != null
                                  ? '${DateFormat('d MMM').format(startDate)} – ${DateFormat('d MMM yyyy').format(endDate)}'
                                  : 'Ends ${DateFormat('d MMM yyyy').format(endDate)}',
                              style: const TextStyle(color: AppColors.textHint, fontSize: 11),
                            ),
                          ]),
                        ),
                      ])),
                      Icon(locked ? Icons.lock_outline_rounded : Icons.chevron_right_rounded, color: AppColors.textHint),
                    ]),
                  ),
                ),
              ),
            );
          },
        );

    return Column(children: [
      if (_isClassTeacher) _buildScopeTabBar(),
      Expanded(child: list),
    ]);
  }

  Widget _buildClassPicker() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: allSchoolClasses.length,
    separatorBuilder: (_, __) => const SizedBox(height: 8),
    itemBuilder: (_, i) {
      final cls = allSchoolClasses[i];
      return _pickerTile(icon: Icons.class_outlined, label: cls, onTap: () => _selectClass(cls));
    },
  );

  Widget _buildSubjectPicker() {
    if (_loadingSubjects) return const Center(child: CircularProgressIndicator(color: AppColors.navy));
    if (_subjects.isEmpty) {
      return _emptyState(
        icon: Icons.menu_book_outlined,
        title: 'No Subjects Configured',
        subtitle: 'No subjects have been added for $_selectedClass yet - ask admin to add them in Settings → Subjects.',
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _subjects.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final subject = _subjects[i];
        return _pickerTile(icon: Icons.book_outlined, label: subject, onTap: () => _selectSubject(subject));
      },
    );
  }

  Widget _pickerTile({required IconData icon, required String label, required VoidCallback onTap}) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card),
      child: Row(children: [
        Icon(icon, color: AppColors.navy, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
        const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
      ]),
    ),
  );

  Widget _buildMarkEntry() => Column(children: [
    Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: const BoxDecoration(gradient: AppColors.navyGradient, boxShadow: AppShadows.colored),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .15), borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.fact_check_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${_selectedExam?['name'] ?? ''} — $_selectedSubject', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
          Text('$_selectedClass  ·  Max Marks: ${_maxMarks.toStringAsFixed(0)} (set by admin)', style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: .15), borderRadius: BorderRadius.circular(8)),
          child: Text('${_students.length} students', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
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
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card),
                child: Row(children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppColors.navy, AppColors.navyMid], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(fullName.isNotEmpty ? fullName : (s['full_name'] ?? '—'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                    Text('GR: ${s['grno'] ?? s['enrollment_no'] ?? ''}', style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                  ])),
                  SizedBox(
                    width: 88,
                    child: TextField(
                      controller: _markCtrl[id],
                      onChanged: (v) => _onMarkChanged(id, v),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: _invalidIds.contains(id) ? AppColors.red : null),
                      decoration: InputDecoration(
                        hintText: '—',
                        hintStyle: const TextStyle(color: AppColors.textHint),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: _invalidIds.contains(id) ? AppColors.red : AppColors.border, width: _invalidIds.contains(id) ? 1.5 : 1),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: _invalidIds.contains(id) ? AppColors.red : AppColors.navy, width: 2),
                        ),
                        filled: true,
                        fillColor: AppColors.bg,
                        suffixText: '/${_maxMarks.toStringAsFixed(0)}',
                        suffixStyle: TextStyle(fontSize: 10, color: _invalidIds.contains(id) ? AppColors.red : AppColors.textHint),
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
            boxShadow: _saving ? [] : [BoxShadow(color: AppColors.navy.withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6))],
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

  Map<String, dynamic> get _overviewMarksLookup {
    final map = <String, dynamic>{};
    for (final m in _overviewMarks) {
      map['${m['subject_name']}|${m['student_id']}'] = m['marks_obtained'];
    }
    return map;
  }

  // Per-student total/percentage/rank for this one exam, across every
  // subject - mirrors the admin panel's getSingleExamMarksheet +
  // withRank (marksheetService.js): an optional subject (e.g. MIL (Odia))
  // never entered for a student is excluded from their total entirely
  // (not counted as a 0); an absent mark still counts toward the max but
  // not the obtained side; rank is by percentage (not raw total, since
  // totalMax can differ per student) with ties sharing a rank.
  List<Map<String, dynamic>> get _overviewRankList {
    final markByKey = <String, Map<String, dynamic>>{};
    for (final m in _overviewMarks) {
      markByKey['${m['subject_name']}|${m['student_id']}'] = m;
    }

    final rows = _overviewStudents.map((s) {
      final studentId = s['id'];
      double totalObtained = 0, totalMax = 0;
      for (final subject in _overviewSubjectsDetailed) {
        final name = subject['name'] as String;
        final isOptional = subject['isOptional'] == true;
        final mark = markByKey['$name|$studentId'];
        final entered = mark != null;
        if (isOptional && !entered) continue;
        final max = _overviewMaxMarks[name] ?? 50;
        final isAbsent = entered && mark['is_absent'] == true;
        final obtained = entered && !isAbsent ? ((mark['marks_obtained'] as num?)?.toDouble() ?? 0) : 0;
        totalObtained += obtained;
        totalMax += max;
      }
      final percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0.0;
      final fullName = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
      return {
        'studentId': studentId,
        'name': fullName.isNotEmpty ? fullName : (s['full_name'] ?? '—'),
        'totalObtained': totalObtained,
        'totalMax': totalMax,
        'percentage': percentage,
      };
    }).toList();

    rows.sort((a, b) => (b['percentage'] as double).compareTo(a['percentage'] as double));
    double round2(double p) => (p * 100).round() / 100;
    int rank = 0;
    double? prevPct;
    for (var i = 0; i < rows.length; i++) {
      final pct = round2(rows[i]['percentage'] as double);
      if (prevPct == null || pct != prevPct) rank = i + 1;
      rows[i]['rank'] = rank;
      prevPct = pct;
    }
    return rows;
  }

  Future<void> _downloadOverviewPdf() async {
    setState(() => _exportingOverviewPdf = true);
    try {
      final bytes = await buildOfficialExamTablePdf(
        examName: _selectedExam?['name'] ?? '',
        className: _ownClassName ?? '',
        subjects: _overviewSubjects,
        students: _overviewStudents,
        marks: _overviewMarks,
      );
      final safeExam = (_selectedExam?['name'] ?? 'Exam').toString().replaceAll(RegExp(r'[^\w\- ]'), '');
      await Printing.sharePdf(bytes: bytes, filename: '${safeExam}_${_ownClassName}_ClassOverview.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to generate PDF: $e'),
          backgroundColor: AppColors.red,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ));
      }
    } finally {
      if (mounted) setState(() => _exportingOverviewPdf = false);
    }
  }

  // Read-only: every subject's marks for the class teacher's own class,
  // regardless of which teacher entered them. Three modes: grouped-by-
  // subject (optionally filtered to one subject), a full spreadsheet-style
  // table of every subject at once (exportable to PDF), or the class rank
  // for this exam.
  Widget _buildOverview() {
    if (_loadingOverview) return const Center(child: CircularProgressIndicator(color: AppColors.navy));
    if (_overviewSubjects.isEmpty) {
      return _emptyState(icon: Icons.menu_book_outlined, title: 'No Subjects Configured', subtitle: 'No subjects have been added for $_ownClassName yet.');
    }
    return Column(children: [
      _buildOverviewModeTabBar(),
      if (_overviewMode == 'subject') _buildOverviewSubjectChips(),
      Expanded(child: _overviewMode == 'subject'
        ? _buildOverviewSubjectList()
        : _overviewMode == 'table'
          ? _buildOverviewTable()
          : _buildOverviewRankList()),
    ]);
  }

  Widget _buildOverviewModeTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withValues(alpha: .08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _overviewModeButton('By Subject', 'subject')),
        Expanded(child: _overviewModeButton('Full Table', 'table')),
        Expanded(child: _overviewModeButton('Rank', 'rank')),
      ]),
    ),
  );

  Widget _overviewModeButton(String label, String mode) {
    final active = _overviewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _overviewMode = mode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: active ? AppShadows.card : null,
        ),
        child: Center(child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
      ),
    );
  }

  Widget _buildOverviewSubjectChips() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _overviewSubjects.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final isAll = i == 0;
          final subject = isAll ? null : _overviewSubjects[i - 1];
          final selected = _overviewSubjectFilter == subject;
          return GestureDetector(
            onTap: () => setState(() => _overviewSubjectFilter = subject),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? AppColors.navy : AppColors.card,
                borderRadius: BorderRadius.circular(17),
                border: Border.all(color: selected ? AppColors.navy : AppColors.border),
              ),
              child: Center(child: Text(isAll ? 'All Subjects' : subject!,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: selected ? Colors.white : AppColors.text))),
            ),
          );
        },
      ),
    ),
  );

  Widget _buildOverviewSubjectList() {
    final marksLookup = _overviewMarksLookup;
    final subjects = _overviewSubjectFilter != null ? [_overviewSubjectFilter!] : _overviewSubjects;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: subjects.length,
      itemBuilder: (_, si) {
        final subject = subjects[si];
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8, left: 2),
              child: Text(subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navy)),
            ),
            Container(
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card),
              child: Column(children: _overviewStudents.asMap().entries.map((entry) {
                final i = entry.key;
                final s = entry.value;
                final fullName = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                final marks = marksLookup['$subject|${s['id']}'];
                final isLast = i == _overviewStudents.length - 1;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(border: isLast ? null : const Border(bottom: BorderSide(color: AppColors.border, width: 0.6))),
                  child: Row(children: [
                    SizedBox(width: 24, child: Text('${i + 1}', style: const TextStyle(color: AppColors.textHint, fontSize: 12, fontWeight: FontWeight.w700))),
                    Expanded(child: Text(fullName.isNotEmpty ? fullName : (s['full_name'] ?? '—'), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: AppColors.text))),
                    Text(marks != null ? '$marks' : '—', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: marks != null ? AppColors.navy : AppColors.textHint)),
                  ]),
                );
              }).toList()),
            ),
          ]),
        );
      },
    );
  }

  // Excel-style grid: every subject as its own column, one row per student.
  Widget _buildOverviewTable() {
    final marksLookup = _overviewMarksLookup;
    return Column(children: [
      Expanded(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.navy),
              headingTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5),
              dataTextStyle: const TextStyle(color: AppColors.text, fontSize: 12.5),
              columnSpacing: 20,
              border: TableBorder.all(color: AppColors.border, width: 0.6, borderRadius: BorderRadius.circular(10)),
              columns: [
                const DataColumn(label: Text('#')),
                const DataColumn(label: Text('Student Name')),
                ..._overviewSubjects.map((s) => DataColumn(label: Text(s))),
              ],
              rows: _overviewStudents.asMap().entries.map((entry) {
                final i = entry.key;
                final s = entry.value;
                final fullName = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                return DataRow(cells: [
                  DataCell(Text('${i + 1}')),
                  DataCell(Text(fullName.isNotEmpty ? fullName : (s['full_name'] ?? '—'))),
                  ..._overviewSubjects.map((subject) {
                    final marks = marksLookup['$subject|${s['id']}'];
                    return DataCell(Text(marks != null ? '$marks' : '—',
                      style: TextStyle(fontWeight: FontWeight.w700, color: marks != null ? AppColors.navy : AppColors.textHint)));
                  }),
                ]);
              }).toList(),
            ),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
        child: GestureDetector(
          onTap: _exportingOverviewPdf ? null : _downloadOverviewPdf,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            height: 52,
            decoration: BoxDecoration(
              gradient: _exportingOverviewPdf ? null : AppColors.navyGradient,
              color: _exportingOverviewPdf ? AppColors.textHint : null,
              borderRadius: BorderRadius.circular(14),
              boxShadow: _exportingOverviewPdf ? [] : [BoxShadow(color: AppColors.navy.withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6))],
            ),
            child: Center(child: _exportingOverviewPdf
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
              : const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text('Download PDF', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                ])),
          ),
        ),
      ),
    ]);
  }

  // Class rank for this exam, sorted best-first. See _overviewRankList for
  // the percentage/rank computation.
  Widget _buildOverviewRankList() {
    final rows = _overviewRankList;
    if (rows.isEmpty) {
      return _emptyState(icon: Icons.leaderboard_outlined, title: 'No Students', subtitle: 'No students found for $_ownClassName.');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final r = rows[i];
        final rank = r['rank'] as int;
        final isFirst = rank == 1;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isFirst ? AppColors.amber : AppColors.border, width: isFirst ? 1.5 : 1),
          ),
          child: Row(children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: isFirst ? AppColors.amberLight : AppColors.navy.withValues(alpha: .08),
                shape: BoxShape.circle,
              ),
              child: Center(child: Text('$rank',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: isFirst ? AppColors.amber : AppColors.navy))),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(r['name'] as String,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: AppColors.text))),
            Text('${(r['totalObtained'] as double).toStringAsFixed(0)}/${(r['totalMax'] as double).toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
            const SizedBox(width: 10),
            Text('${(r['percentage'] as double).toStringAsFixed(1)}%',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.navy)),
          ]),
        );
      },
    );
  }

  Widget _tag(String label, Color bg, Color fg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
    child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600)),
  );

  Widget _emptyState({required IconData icon, required String title, required String subtitle}) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.limeLight, shape: BoxShape.circle),
        child: Icon(icon, color: AppColors.lime, size: 38),
      ),
      const SizedBox(height: 16),
      Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
