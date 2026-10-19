import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';
import '../../../routes/app_routes.dart';

// REQ-FEAT-020 (2026-10-19) - user: "add module Notebook - mam will click
// class todays date then those class students name will be loaded and
// class will be in header row; by default the notebook cell will be ticked
// (that student notebook is complete) if any students notebook is
// incomplete then it will be unticked and it will autosave". Clarified:
// one grid per class+date - student names frozen down the left, every
// subject of that class (class_subjects, not a per-teacher subject list)
// frozen across the top. Each cell autosaves on tap, no batch Save button.
// Any teacher may open any class (same "any class" philosophy as homework/
// exams/syllabus/daily-log) - date defaults to today but is picker-editable.
class TeacherNotebookPage extends StatefulWidget {
  const TeacherNotebookPage({super.key});
  @override
  State<TeacherNotebookPage> createState() => _TeacherNotebookPageState();
}

// Hand-rolled scroll-sync (no new package): two independent controllers
// whose offsets are mirrored onto each other, used once for the vertical
// pairing (frozen student column <-> grid body) and once for the
// horizontal pairing (frozen subject header row <-> grid body).
class _SyncedScroll {
  final ScrollController frozen = ScrollController();
  final ScrollController body = ScrollController();
  bool _syncing = false;

  _SyncedScroll() {
    frozen.addListener(() => _mirror(frozen, body));
    body.addListener(() => _mirror(body, frozen));
  }

  void _mirror(ScrollController from, ScrollController to) {
    if (_syncing || !to.hasClients || !from.hasClients) return;
    final target = from.offset.clamp(0.0, to.position.maxScrollExtent);
    if ((to.offset - target).abs() < 0.5) return;
    _syncing = true;
    to.jumpTo(target);
    _syncing = false;
  }

  void dispose() {
    frozen.dispose();
    body.dispose();
  }
}

class _TeacherNotebookPageState extends State<TeacherNotebookPage> {
  static const double _cornerWidth = 128;
  static const double _colWidth = 96;
  static const double _rowHeight = 52;
  static const double _headerHeight = 48;

  String? _className;
  DateTime _date = DateTime.now();

  List<Map<String, dynamic>> _students = [];
  List<String> _subjects = [];
  // studentId -> subject -> complete (default true).
  final Map<String, Map<String, bool>> _state = {};
  final Set<String> _savingCells = {}; // "studentId|subject" currently saving

  bool _loading = false;

  late final _SyncedScroll _vSync = _SyncedScroll();
  late final _SyncedScroll _hSync = _SyncedScroll();

  @override
  void initState() {
    super.initState();
    final profile = AuthService.to.profile.value ?? {};
    _className = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : allSchoolClasses.first;
    _loadGrid();
  }

  @override
  void dispose() {
    _vSync.dispose();
    _hSync.dispose();
    super.dispose();
  }

  Future<void> _loadGrid() async {
    if (_className == null) return;
    setState(() { _loading = true; _students = []; _subjects = []; _state.clear(); });
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);

    final students = await SupabaseService.fetchClassStudentsByName(_className!);
    final subjects = await SupabaseService.fetchClassSubjects(_className!);
    final existing = (employeeId != null && sessionToken != null)
        ? await SupabaseService.fetchNotebookLog(employeeId, sessionToken, _className!, dateStr)
        : <Map<String, dynamic>>[];

    final state = <String, Map<String, bool>>{};
    for (final s in students) {
      final id = s['id'] as String;
      state[id] = {for (final subj in subjects) subj: true};
    }
    for (final r in existing) {
      final id = r['student_id'] as String?;
      final subj = r['subject'] as String?;
      final complete = r['complete'] as bool?;
      if (id == null || subj == null || complete == null) continue;
      state.putIfAbsent(id, () => {for (final subj in subjects) subj: true});
      state[id]![subj] = complete;
    }

    if (!mounted) return;
    setState(() {
      _students = students;
      _subjects = subjects;
      _state.addAll(state);
      _loading = false;
    });
  }

  Future<void> _toggleCell(String studentId, String subject) async {
    final current = _state[studentId]?[subject] ?? true;
    final next = !current;
    final cellKey = '$studentId|$subject';
    setState(() {
      _state[studentId] = {...(_state[studentId] ?? {}), subject: next};
      _savingCells.add(cellKey);
    });

    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    if (employeeId == null || sessionToken == null || _className == null) {
      if (!mounted) return;
      setState(() {
        _state[studentId] = {...(_state[studentId] ?? {}), subject: current};
        _savingCells.remove(cellKey);
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Session error - please sign in again.'), backgroundColor: AppColors.red, behavior: SnackBarBehavior.floating));
      return;
    }

    try {
      await SupabaseService.saveNotebookEntry(
        employeeId: employeeId,
        sessionToken: sessionToken,
        className: _className!,
        subject: subject,
        date: DateFormat('yyyy-MM-dd').format(_date),
        studentId: studentId,
        complete: next,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _state[studentId] = {...(_state[studentId] ?? {}), subject: current};
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Failed to save: $e'), backgroundColor: AppColors.red, behavior: SnackBarBehavior.floating));
    } finally {
      if (mounted) setState(() => _savingCells.remove(cellKey));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Notebook'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bar_chart_rounded, color: Colors.white),
            tooltip: 'Notebook Report',
            onPressed: () => Get.toNamed(Routes.teacherNotebookReport),
          ),
        ],
      ),
      body: Column(children: [
        _buildPickerBar(),
        const Divider(height: 1, color: AppColors.border),
        Expanded(child: _buildGrid()),
      ]),
    );
  }

  Widget _buildPickerBar() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(children: [
        DropdownButtonFormField<String>(
          initialValue: _className,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder(), isDense: true),
          items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
          onChanged: (v) {
            if (v == null) return;
            setState(() => _className = v);
            _loadGrid();
          },
        ),
        const SizedBox(height: 10),
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.calendar_month_rounded, color: AppColors.indigo, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(DateFormat('EEEE, d MMMM yyyy').format(_date),
            style: const TextStyle(fontSize: 13, color: AppColors.text, fontWeight: FontWeight.w700))),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context, initialDate: _date,
                firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now(),
              );
              if (picked != null && mounted) {
                setState(() => _date = picked);
                await _loadGrid();
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(10)),
              child: const Text('Change', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _buildGrid() {
    if (_loading) {
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: 8,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(0xFFE2E8F0),
          highlightColor: const Color(0xFFF8FAFC),
          child: Container(height: 48, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
        ),
      );
    }
    if (_students.isEmpty) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
            child: const Icon(Icons.groups_rounded, color: AppColors.amber, size: 38),
          ),
          const SizedBox(height: 16),
          const Text('No Students Found', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        ]),
      ));
    }
    if (_subjects.isEmpty) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
            child: const Icon(Icons.menu_book_rounded, color: AppColors.amber, size: 38),
          ),
          const SizedBox(height: 16),
          const Text('No Subjects Configured', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 8),
          const Text('This class has no subjects set up yet.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
        ]),
      ));
    }

    return Padding(
      padding: const EdgeInsets.all(12),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          boxShadow: AppShadows.card,
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          // Frozen header row: corner cell + scrollable subject headers.
          SizedBox(
            height: _headerHeight,
            child: Row(children: [
              _cornerCell(),
              Expanded(
                child: SingleChildScrollView(
                  controller: _hSync.frozen,
                  scrollDirection: Axis.horizontal,
                  physics: const ClampingScrollPhysics(),
                  child: Row(children: _subjects.map(_subjectHeaderCell).toList()),
                ),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppColors.border),
          // Body: frozen student-name column + scrollable grid of cells.
          Expanded(
            child: Row(children: [
              SizedBox(
                width: _cornerWidth,
                child: SingleChildScrollView(
                  controller: _vSync.frozen,
                  physics: const ClampingScrollPhysics(),
                  child: Column(children: [
                    for (int i = 0; i < _students.length; i++) _studentNameCell(_students[i], i),
                  ]),
                ),
              ),
              const VerticalDivider(width: 1, color: AppColors.border),
              Expanded(
                child: SingleChildScrollView(
                  controller: _vSync.body,
                  physics: const ClampingScrollPhysics(),
                  child: SingleChildScrollView(
                    controller: _hSync.body,
                    scrollDirection: Axis.horizontal,
                    physics: const ClampingScrollPhysics(),
                    child: Column(
                      children: _students.map((s) => Row(
                        children: _subjects.map((subject) => _cell(s['id'] as String, subject)).toList(),
                      )).toList(),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _cornerCell() => Container(
    width: _cornerWidth,
    alignment: Alignment.centerLeft,
    padding: const EdgeInsets.symmetric(horizontal: 12),
    color: AppColors.blueLight,
    child: Text(_className ?? '', overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.navy)),
  );

  Widget _subjectHeaderCell(String subject) => Container(
    width: _colWidth,
    alignment: Alignment.center,
    padding: const EdgeInsets.symmetric(horizontal: 4),
    color: AppColors.blueLight,
    child: Text(subject, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy)),
  );

  Widget _studentNameCell(Map<String, dynamic> student, int index) {
    final name = '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}'.trim();
    return Container(
      width: _cornerWidth,
      height: _rowHeight,
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      color: index.isEven ? AppColors.card : AppColors.bg,
      child: Text(name.isNotEmpty ? name : '—', overflow: TextOverflow.ellipsis, maxLines: 2,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text)),
    );
  }

  Widget _cell(String studentId, String subject) {
    final complete = _state[studentId]?[subject] ?? true;
    final saving = _savingCells.contains('$studentId|$subject');
    final rowIndex = _students.indexWhere((s) => s['id'] == studentId);
    return GestureDetector(
      onTap: saving ? null : () => _toggleCell(studentId, subject),
      child: Container(
        width: _colWidth,
        height: _rowHeight,
        alignment: Alignment.center,
        color: rowIndex.isEven ? AppColors.card : AppColors.bg,
        child: saving
            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textLight))
            : Icon(
                complete ? Icons.check_circle_rounded : Icons.cancel_rounded,
                color: complete ? AppColors.green : AppColors.red,
                size: 22,
              ),
      ),
    );
  }
}
