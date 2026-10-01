import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Settings -> Exams tab (ExamsTab.js) -
// Official Exams CRUD + per-class/subject max marks, and read-only Monthly
// Test visibility (teachers still create Monthly Tests from the app; admin
// here only sets the default full marks and can see what's scheduled).
// Senior Admin/Management only.
class AdminExamsPage extends StatefulWidget {
  const AdminExamsPage({super.key});
  @override
  State<AdminExamsPage> createState() => _AdminExamsPageState();
}

class _AdminExamsPageState extends State<AdminExamsPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Exams'),
      body: Column(children: [
        Material(color: AppColors.card, child: TabBar(
          controller: _tabs, labelColor: AppColors.navy, unselectedLabelColor: AppColors.textLight, indicatorColor: AppColors.navy,
          tabs: const [Tab(text: 'Official Exams'), Tab(text: 'Monthly Tests')],
        )),
        Expanded(child: TabBarView(controller: _tabs, children: [
          _OfficialExamsTab(employeeId: _employeeId),
          _MonthlyTestsTab(employeeId: _employeeId),
        ])),
      ]),
    );
  }
}

// ── Official Exams ───────────────────────────────────────────────────────────
class _OfficialExamsTab extends StatefulWidget {
  final String employeeId;
  const _OfficialExamsTab({required this.employeeId});
  @override
  State<_OfficialExamsTab> createState() => _OfficialExamsTabState();
}

class _OfficialExamsTabState extends State<_OfficialExamsTab> {
  List<Map<String, dynamic>> _exams = [];
  List<Map<String, dynamic>> _classes = [];
  Map<String, List<String>> _classSubjects = {};
  String? _academicYearId;
  bool _loading = true;
  String? _error;
  String? _expandedId;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        StaffAdminService.getAcademicYears(),
        StaffAdminService.getActiveClasses(widget.employeeId),
        StaffAdminService.getClassSubjects(),
      ]);
      final years = results[0];
      final classes = results[1];
      final subjects = results[2];
      final current = years.firstWhere((y) => y['is_current'] == true, orElse: () => years.isNotEmpty ? years.last : {});
      final yearId = current['id'] as String?;
      final subjMap = <String, List<String>>{};
      for (final s in subjects) {
        (subjMap[s['class_name'] as String] ??= []).add(s['subject_name'] as String);
      }
      final exams = await StaffAdminService.getOfficialExams(academicYearId: yearId);
      exams.sort((a, b) => ((a['sort_order'] as num?) ?? 0).compareTo((b['sort_order'] as num?) ?? 0));
      if (mounted) {
        setState(() {
          _academicYearId = yearId; _classes = classes; _classSubjects = subjMap; _exams = exams; _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load exams.'; _loading = false; });
    }
  }

  bool _isUnlocked(Map<String, dynamic> exam) {
    final end = exam['end_date'] as String?;
    if (end == null) return false;
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    return today.compareTo(end) >= 0;
  }

  Future<void> _openAddForm() async {
    final nameCtrl = TextEditingController();
    final marksCtrl = TextEditingController(text: '100');
    DateTime? start;
    DateTime? end;

    final saved = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add Exam', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 14),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'e.g. First Unit Test', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showDatePicker(context: ctx, initialDate: DateTime.now(), firstDate: DateTime(2024), lastDate: DateTime(2035)); if (p != null) setSheet(() => start = p); },
            child: Text(start == null ? 'Start date' : DateFormat('yyyy-MM-dd').format(start!))),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showDatePicker(context: ctx, initialDate: start ?? DateTime.now(), firstDate: DateTime(2024), lastDate: DateTime(2035)); if (p != null) setSheet(() => end = p); },
            child: Text(end == null ? 'End date' : DateFormat('yyyy-MM-dd').format(end!))),
          const SizedBox(height: 10),
          TextField(controller: marksCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Full Marks', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () {
              if (nameCtrl.text.trim().isEmpty) { showAdminSnack(ctx, 'Enter an exam name.', isError: true); return; }
              if (start == null || end == null) { showAdminSnack(ctx, 'Pick a start and end date.', isError: true); return; }
              if (DateFormat('yyyy-MM-dd').format(end!).compareTo(DateFormat('yyyy-MM-dd').format(start!)) < 0) {
                showAdminSnack(ctx, "End date can't be before start date.", isError: true); return;
              }
              Navigator.pop(ctx, true);
            },
            child: const Text('Add Exam'),
          ),
        ])),
      )),
    );

    if (saved != true) return;
    final fullMarks = int.tryParse(marksCtrl.text) ?? 100;
    try {
      final exam = await StaffAdminService.createOfficialExam(widget.employeeId,
        name: nameCtrl.text.trim(), startDate: DateFormat('yyyy-MM-dd').format(start!), endDate: DateFormat('yyyy-MM-dd').format(end!),
        academicYearId: _academicYearId, sortOrder: _exams.length);
      final rows = <Map<String, dynamic>>[];
      _classSubjects.forEach((className, subjects) {
        for (final s in subjects) { rows.add({'className': className, 'subjectName': s, 'maxMarks': fullMarks}); }
      });
      await StaffAdminService.saveExamSubjectMaxMarksBulk(widget.employeeId, exam['id'] as String, rows);
      if (mounted) showAdminSnack(context, 'Exam added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add exam.', isError: true);
    }
  }

  Future<void> _editExam(Map<String, dynamic> exam) async {
    final nameCtrl = TextEditingController(text: exam['name'] as String? ?? '');
    DateTime? start = exam['start_date'] != null ? DateTime.tryParse(exam['start_date'] as String) : null;
    DateTime? end = exam['end_date'] != null ? DateTime.tryParse(exam['end_date'] as String) : null;

    final saved = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Edit Exam', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 14),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showDatePicker(context: ctx, initialDate: start ?? DateTime.now(), firstDate: DateTime(2024), lastDate: DateTime(2035)); if (p != null) setSheet(() => start = p); },
            child: Text(start == null ? 'Start date' : DateFormat('yyyy-MM-dd').format(start!))),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () async { final p = await showDatePicker(context: ctx, initialDate: end ?? DateTime.now(), firstDate: DateTime(2024), lastDate: DateTime(2035)); if (p != null) setSheet(() => end = p); },
            child: Text(end == null ? 'End date' : DateFormat('yyyy-MM-dd').format(end!))),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () {
              if (nameCtrl.text.trim().isEmpty || start == null || end == null) { showAdminSnack(ctx, 'Fill every field.', isError: true); return; }
              Navigator.pop(ctx, true);
            },
            child: const Text('Save'),
          ),
        ])),
      )),
    );

    if (saved != true) return;
    try {
      await StaffAdminService.updateOfficialExam(widget.employeeId, exam['id'] as String,
        name: nameCtrl.text.trim(), startDate: DateFormat('yyyy-MM-dd').format(start!), endDate: DateFormat('yyyy-MM-dd').format(end!),
        sortOrder: (exam['sort_order'] as num?)?.toInt() ?? 0);
      if (mounted) showAdminSnack(context, 'Exam updated');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save.', isError: true);
    }
  }

  Future<void> _deleteExam(Map<String, dynamic> exam) async {
    final ok = await confirmAdminAction(context, title: 'Delete exam',
      message: 'Delete "${exam['name']}"? This also deletes every mark entered for it. This cannot be undone.', confirmLabel: 'Delete');
    if (!ok) return;
    try {
      await StaffAdminService.deleteOfficialExam(widget.employeeId, exam['id'] as String);
      if (mounted) setState(() => _exams.removeWhere((e) => e['id'] == exam['id']));
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to delete.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _load);
    return Stack(children: [
      _exams.isEmpty
        ? const AdminEmptyState(icon: Icons.emoji_events_outlined, title: 'No exams yet', subtitle: 'Tap + to add the school\'s official exams.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            itemCount: _exams.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final exam = _exams[i];
              final unlocked = _isUnlocked(exam);
              final isOpen = _expandedId == exam['id'];
              return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(unlocked ? Icons.lock_open_rounded : Icons.lock_outline_rounded, size: 18, color: unlocked ? AppColors.green : AppColors.amber),
                  const SizedBox(width: 10),
                  Expanded(child: GestureDetector(
                    onTap: () => setState(() => _expandedId = isOpen ? null : exam['id'] as String),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(exam['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      Text('${exam['start_date']} to ${exam['end_date']} • ${unlocked ? "Marks entry open" : "Coming soon"}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                    ]),
                  )),
                  IconButton(icon: const Icon(Icons.edit_outlined, size: 18), onPressed: () => _editExam(exam)),
                  IconButton(icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.red), onPressed: () => _deleteExam(exam)),
                ]),
                if (isOpen) _ExamSubjectConfig(employeeId: widget.employeeId, examId: exam['id'] as String, classes: _classes, classSubjects: _classSubjects),
              ]));
            },
          )),
      Positioned(right: 16, bottom: 16, child: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _openAddForm, child: const Icon(Icons.add_rounded, color: Colors.white))),
    ]);
  }
}

class _ExamSubjectConfig extends StatefulWidget {
  final String employeeId, examId;
  final List<Map<String, dynamic>> classes;
  final Map<String, List<String>> classSubjects;
  const _ExamSubjectConfig({required this.employeeId, required this.examId, required this.classes, required this.classSubjects});
  @override
  State<_ExamSubjectConfig> createState() => _ExamSubjectConfigState();
}

class _ExamSubjectConfigState extends State<_ExamSubjectConfig> {
  String? _selectedClass;
  Map<String, int> _config = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _selectedClass = widget.classes.isNotEmpty ? widget.classes.first['name'] as String : null;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await StaffAdminService.getExamSubjectConfig(widget.examId);
      final map = <String, int>{};
      for (final r in rows) {
        if (r['class_name'] == _selectedClass) map[r['subject_name'] as String] = (r['max_marks'] as num).toInt();
      }
      if (mounted) setState(() { _config = map; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveSubject(String subject, String value) async {
    final marks = int.tryParse(value);
    if (marks == null || marks <= 0) return;
    setState(() => _config[subject] = marks);
    try {
      await StaffAdminService.saveExamSubjectMaxMarks(widget.employeeId, widget.examId, _selectedClass!, subject, marks);
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final subjects = widget.classSubjects[_selectedClass] ?? [];
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Divider(),
        const Text('Max Marks per Subject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textLight)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _selectedClass,
          decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          items: widget.classes.map((c) => DropdownMenuItem(value: c['name'] as String, child: Text(c['name'] as String))).toList(),
          onChanged: (v) { if (v != null) { setState(() => _selectedClass = v); _load(); } },
        ),
        const SizedBox(height: 10),
        if (_loading) const Padding(padding: EdgeInsets.all(8), child: AdminLoading())
        else if (subjects.isEmpty) const Text('No subjects configured for this class yet.', style: TextStyle(fontSize: 11, color: AppColors.textLight))
        else Wrap(spacing: 8, runSpacing: 8, children: subjects.map((s) => SizedBox(
          width: 110,
          child: TextFormField(
            initialValue: '${_config[s] ?? 100}',
            decoration: InputDecoration(labelText: s, isDense: true, border: const OutlineInputBorder()),
            keyboardType: TextInputType.number,
            onFieldSubmitted: (v) => _saveSubject(s, v),
            onTapOutside: (_) {},
          ),
        )).toList()),
      ]),
    );
  }
}

// ── Monthly Tests ────────────────────────────────────────────────────────────
class _MonthlyTestsTab extends StatefulWidget {
  final String employeeId;
  const _MonthlyTestsTab({required this.employeeId});
  @override
  State<_MonthlyTestsTab> createState() => _MonthlyTestsTabState();
}

class _MonthlyTestsTabState extends State<_MonthlyTestsTab> {
  int _maxMarks = 25;
  bool _maxMarksLoading = true;
  List<Map<String, dynamic>> _tests = [];
  bool _testsLoading = true;
  String? _expandedId;
  final Map<String, List<Map<String, dynamic>>> _marksByExam = {};

  @override
  void initState() { super.initState(); _loadMaxMarks(); _loadTests(); }

  Future<void> _loadMaxMarks() async {
    try {
      final v = await StaffAdminService.getMonthlyTestMaxMarks();
      if (mounted) setState(() { _maxMarks = v; _maxMarksLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _maxMarksLoading = false);
    }
  }

  Future<void> _loadTests() async {
    setState(() => _testsLoading = true);
    try {
      final rows = await StaffAdminService.monthlyTests(widget.employeeId);
      if (mounted) setState(() { _tests = rows; _testsLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _testsLoading = false);
    }
  }

  Future<void> _saveMaxMarks(String value) async {
    final marks = int.tryParse(value);
    if (marks == null || marks <= 0) return;
    try {
      await StaffAdminService.saveMonthlyTestMaxMarks(widget.employeeId, marks);
      if (mounted) showAdminSnack(context, 'Saved');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save.', isError: true);
    }
  }

  Future<void> _toggleExpand(String examId) async {
    if (_expandedId == examId) { setState(() => _expandedId = null); return; }
    setState(() => _expandedId = examId);
    if (!_marksByExam.containsKey(examId)) {
      try {
        final marks = await StaffAdminService.monthlyTestMarks(widget.employeeId, examId);
        if (mounted) setState(() => _marksByExam[examId] = marks);
      } catch (e) { /* leave empty */ }
    }
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy');
    return RefreshIndicator(color: AppColors.navy, onRefresh: () async { await _loadMaxMarks(); await _loadTests(); },
      child: ListView(padding: const EdgeInsets.all(16), children: [
        AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Monthly Test — Default Full Marks', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          const Text('The teacher still picks class, subject and date — this only sets the marks cap.', style: TextStyle(fontSize: 11, color: AppColors.textLight)),
          const SizedBox(height: 10),
          _maxMarksLoading ? const AdminLoading() : SizedBox(width: 120, child: TextFormField(
            initialValue: '$_maxMarks',
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Full Marks', border: OutlineInputBorder(), isDense: true),
            onFieldSubmitted: _saveMaxMarks,
            onTapOutside: (_) {},
          )),
        ])),
        const SizedBox(height: 16),
        const Text('Scheduled Tests', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        const SizedBox(height: 8),
        if (_testsLoading) const AdminLoading()
        else if (_tests.isEmpty) const AdminEmptyState(icon: Icons.quiz_outlined, title: 'No monthly tests yet', subtitle: 'Tests teachers schedule from the app will appear here.')
        else ..._tests.map((t) {
          final isOpen = _expandedId == t['o_id'];
          final marks = _marksByExam[t['o_id']] ?? [];
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AdminCard(onTap: () => _toggleExpand(t['o_id'] as String), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t['o_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 2),
              Text('${t['o_class']} • ${t['o_subject']} • ${t['o_date'] != null ? df.format(DateTime.parse(t['o_date'] as String)) : 'No date'} • Max ${t['o_max_marks']} • by ${t['o_teacher_name'] ?? '—'}',
                style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
              if (isOpen) Padding(
                padding: const EdgeInsets.only(top: 10),
                child: marks.isEmpty
                  ? const Text('No marks entered yet.', style: TextStyle(fontSize: 11, color: AppColors.textLight))
                  : Column(children: marks.map((m) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text(m['o_name'] as String? ?? '—', style: const TextStyle(fontSize: 12)),
                        Text('${m['o_marks'] ?? '—'} / ${t['o_max_marks']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
                      ]),
                    )).toList()),
              ),
            ])),
          );
        }),
      ]),
    );
  }
}
