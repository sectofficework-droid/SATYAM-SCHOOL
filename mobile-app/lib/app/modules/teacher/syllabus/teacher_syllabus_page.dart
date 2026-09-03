import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

const _statuses = ['Not Started', 'In Progress', 'Completed'];
const _editWindow = Duration(hours: 24);

Color _statusColor(String status) => switch (status) {
  'Completed'   => AppColors.green,
  'In Progress' => AppColors.amber,
  _             => AppColors.textHint,
};

Color _statusBg(String status) => switch (status) {
  'Completed'   => AppColors.greenLight,
  'In Progress' => AppColors.amberLight,
  _             => AppColors.border,
};

class TeacherSyllabusPage extends StatefulWidget {
  final bool embedded;
  const TeacherSyllabusPage({super.key, this.embedded = false});
  @override
  State<TeacherSyllabusPage> createState() => _TeacherSyllabusPageState();
}

// Per-(class,subject) lock state, derived from that section's chapters
// (locked is set on every chapter row together, see lockSyllabus) plus this
// teacher's own edit-request history.
typedef _SectionState = ({bool locked, Map<String, dynamic>? pending, Map<String, dynamic>? approvedWindow});

class _TeacherSyllabusPageState extends State<TeacherSyllabusPage> {
  // Mine = chapters this teacher personally added. Class Overview = every
  // chapter added for their own class, by any teacher - only meaningful
  // (and only shown) for an actual class teacher.
  List<Map<String, dynamic>> _mineChapters  = [];
  List<Map<String, dynamic>> _classChapters = [];
  Map<String, List<Map<String, dynamic>>> _subtopicsByChapter = {};
  List<Map<String, dynamic>> _myRequests = [];
  bool _loading = true;
  bool _isClassTeacher = false;
  String? _employeeId;

  // 0 = Mine, 1 = Class Overview
  int _scope = 0;

  final Set<String> _expanded = {}; // chapter ids currently showing subtopics

  // Ticks every 30s so any active 24h edit-window countdowns re-render -
  // a full Timer per section would be overkill for an hours-long window
  // (unlike the attendance module's 10-minute window, second precision
  // doesn't matter here).
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) { if (mounted) setState(() {}); });
  }

  @override
  void dispose() { _refreshTimer?.cancel(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final ownClass    = profile['class_name'] as String?;
    _employeeId = employeeId;
    _isClassTeacher = ownClass != null && ownClass.isNotEmpty;

    final mine = employeeId != null
        ? await SupabaseService.fetchSyllabus(teacherId: employeeId)
        : <Map<String, dynamic>>[];
    final classWide = _isClassTeacher
        ? await SupabaseService.fetchSyllabus(classNames: [ownClass!])
        : <Map<String, dynamic>>[];

    final allIds = {...mine.map((c) => c['id'] as String), ...classWide.map((c) => c['id'] as String)}.toList();
    final subtopics = await SupabaseService.fetchSubtopics(allIds);
    final subMap = <String, List<Map<String, dynamic>>>{};
    for (final s in subtopics) {
      subMap.putIfAbsent(s['chapter_id'] as String, () => []).add(s);
    }

    final requests = employeeId != null
        ? await SupabaseService.fetchMySyllabusEditRequests(employeeId)
        : <Map<String, dynamic>>[];

    if (mounted) setState(() {
      _mineChapters  = mine;
      _classChapters = classWide;
      _subtopicsByChapter = subMap;
      _myRequests = requests;
      if (!_isClassTeacher) _scope = 0;
      _loading = false;
    });
  }

  _SectionState _sectionState(String className, String subject) {
    final chapters = _mineChapters.where((c) => c['class'] == className && c['subject'] == subject);
    final locked = chapters.isNotEmpty && chapters.first['locked'] == true;

    Map<String, dynamic>? pending;
    Map<String, dynamic>? approved;
    DateTime? approvedAtOfApproved;
    for (final r in _myRequests) {
      if (r['class_name'] != className || r['subject_name'] != subject) continue;
      if (r['status'] == 'Pending' && pending == null) pending = r;
      if (r['status'] == 'Approved' && r['closed_at'] == null) {
        final approvedAt = DateTime.tryParse(r['approved_at']?.toString() ?? '');
        if (approvedAt != null && DateTime.now().difference(approvedAt) < _editWindow) {
          if (approved == null || approvedAt.isAfter(approvedAtOfApproved!)) {
            approved = r;
            approvedAtOfApproved = approvedAt;
          }
        }
      }
    }
    return (locked: locked, pending: pending, approvedWindow: approved);
  }

  // A chapter with subtopics has its own status computed from them instead
  // of being cycled directly - null means "no subtopics, use the chapter's
  // own stored status".
  String? _derivedStatus(List<Map<String, dynamic>> subtopics) {
    if (subtopics.isEmpty) return null;
    final statuses = subtopics.map((s) => (s['status'] ?? 'Not Started') as String).toList();
    if (statuses.every((s) => s == 'Completed')) return 'Completed';
    if (statuses.any((s) => s != 'Not Started')) return 'In Progress';
    return 'Not Started';
  }

  // A "leaf unit" is a subtopic if the chapter has any, else the chapter
  // itself - so a 3-subtopic chapter counts as 3 units toward growth, not 1.
  ({int total, int completed}) _leafCounts(List<Map<String, dynamic>> chapters) {
    int total = 0, completed = 0;
    for (final c in chapters) {
      final subs = _subtopicsByChapter[c['id']] ?? const [];
      if (subs.isEmpty) {
        total++;
        if ((c['status'] ?? '') == 'Completed') completed++;
      } else {
        total += subs.length;
        completed += subs.where((s) => (s['status'] ?? '') == 'Completed').length;
      }
    }
    return (total: total, completed: completed);
  }

  // Tapping a status badge you can't edit used to be a silent no-op
  // (onTap: null) - indistinguishable from the toggle being broken. This
  // gives that tap somewhere to go so it's clear it's read-only, not dead.
  void _explainReadOnlyStatus(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ));
  }

  Future<void> _cycleStatus(Map<String, dynamic> chapter) async {
    if (chapter['teacher_id'] != _employeeId) return; // view-only for others' chapters
    if ((_subtopicsByChapter[chapter['id']] ?? const []).isNotEmpty) return; // derived, not directly cycled
    final current = _statuses.indexOf(chapter['status'] ?? 'Not Started');
    final next = _statuses[(current + 1) % _statuses.length];
    setState(() => chapter['status'] = next);
    await SupabaseService.updateSyllabusStatus(chapter['id'] as String, next);
  }

  Future<void> _cycleSubtopicStatus(Map<String, dynamic> subtopic) async {
    final current = _statuses.indexOf(subtopic['status'] ?? 'Not Started');
    final next = _statuses[(current + 1) % _statuses.length];
    setState(() => subtopic['status'] = next);
    await SupabaseService.updateSubtopicStatus(subtopic['id'] as String, next);
  }

  Future<void> _deleteChapter(Map<String, dynamic> chapter) async {
    await SupabaseService.deleteSyllabusChapter(chapter['id'] as String);
    _load();
  }

  Future<void> _deleteSubtopic(Map<String, dynamic> subtopic) async {
    await SupabaseService.deleteSubtopic(subtopic['id'] as String);
    _load();
  }

  Future<void> _confirmLock(String className, String subject) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Lock Syllabus?', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.text)),
        content: Text(
          'This freezes the $subject syllabus for $className - chapters and subtopics can\'t be added, renamed, or removed after this. '
          'To make changes later you\'ll need to request admin approval. Progress marking stays available either way.',
          style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Lock', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm != true || _employeeId == null) return;
    await SupabaseService.lockSyllabus(teacherId: _employeeId!, className: className, subject: subject);
    _load();
  }

  Future<void> _saveAndLock(Map<String, dynamic> request) async {
    await SupabaseService.closeSyllabusEditWindow(request['id'] as String);
    _load();
  }

  Future<void> _openRequestEditSheet(String className, String subject) async {
    final reasonCtrl  = TextEditingController();
    final changesCtrl = TextEditingController();
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Request Syllabus Edit', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 6),
            Text('This asks admin to unlock the $subject syllabus for $className - once approved you get 24 hours to make changes.',
              style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
            const SizedBox(height: 16),
            TextField(
              controller: reasonCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Reason - e.g. curriculum revised for this term',
                filled: true, fillColor: AppColors.blueLight.withOpacity(.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: changesCtrl,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'What do you want to add/update? (optional)',
                filled: true, fillColor: AppColors.blueLight.withOpacity(.4),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, child: GestureDetector(
              onTap: () {
                if (reasonCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                    content: Text('Please enter a reason'),
                    behavior: SnackBarBehavior.floating,
                  ));
                  return;
                }
                Navigator.of(ctx).pop(true);
              },
              child: Container(
                height: 48,
                decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(12)),
                child: const Center(child: Text('Send Request',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
              ),
            )),
          ]),
        ),
      ),
    );

    if (result != true || _employeeId == null) return;
    await SupabaseService.submitSyllabusEditRequest(
      teacherId: _employeeId!,
      className: className,
      subject: subject,
      reason: reasonCtrl.text.trim(),
      requestedChanges: changesCtrl.text.trim().isEmpty ? null : changesCtrl.text.trim(),
    );
    _load();
  }

  void _showAddSubtopicsSheet(Map<String, dynamic> chapter) {
    final ctrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(
              width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
            )),
            Text('Add Subtopics — ${chapter['chapter']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
            const Text('One per line', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
            const SizedBox(height: 14),
            TextField(
              controller: ctrl,
              maxLines: 5,
              minLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'e.g.\nDefinition\nExamples\nPractice Problems'),
            ),
            const SizedBox(height: 14),
            GestureDetector(
              onTap: () async {
                final names = ctrl.text.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toSet().toList();
                if (names.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Enter at least one subtopic'),
                    behavior: SnackBarBehavior.floating,
                  ));
                  return;
                }
                await SupabaseService.createSubtopics(names.asMap().entries.map((e) => {
                  'chapter_id': chapter['id'],
                  'name':       e.value,
                  'status':     'Not Started',
                  'sort_order': e.key,
                }).toList());
                if (mounted) Navigator.pop(ctx);
                _load();
              },
              child: Container(
                height: 48,
                decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(12)),
                child: const Center(child: Text('Add Subtopics',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // Groups chapters by "Class · Subject" (Mine can span multiple classes) or
  // just "Subject" (Class Overview is already scoped to one class).
  Map<String, List<Map<String, dynamic>>> _grouped(List<Map<String, dynamic>> list, {required bool includeClass}) {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final c in list) {
      final key = includeClass
          ? '${c['class'] ?? ''} · ${c['subject'] ?? ''}'
          : (c['subject'] ?? '').toString();
      map.putIfAbsent(key, () => []).add(c);
    }
    return map;
  }

  void _showAddChapterSheet() {
    final chapterCtrl = TextEditingController();
    final profile  = AuthService.to.profile.value ?? {};
    final myClasses = teacherClasses(profile);
    String selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : (myClasses.isNotEmpty ? myClasses.first : allSchoolClasses.first);
    String? selectedSubject;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          final subjectOptions = teacherSubjectsForClass(profile, selectedClass);
          final sectionState = selectedSubject != null ? _sectionState(selectedClass, selectedSubject!) : null;
          final blocked = sectionState != null && sectionState.locked && sectionState.approvedWindow == null;
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
                        gradient: LinearGradient(colors: [AppColors.teal, AppColors.teal.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.menu_book_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Add Chapters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                      Text('Add one or several at once - one per line', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                    ])),
                    IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                  ]),
                  const SizedBox(height: 20),
                  DropdownButtonFormField<String>(
                    value: selectedClass,
                    decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                    items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                    onChanged: (v) => setS(() { selectedClass = v!; selectedSubject = null; }),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    value: selectedSubject,
                    isExpanded: true,
                    hint: const Text('Select', style: TextStyle(fontSize: 13)),
                    decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                    // Prefer this teacher's own mapped subjects for the class
                    // (most teachers have none set up - see teacherSubjectsForClass),
                    // falling back to every school-wide subject so this is
                    // always a dropdown, never free text.
                    items: (subjectOptions.isNotEmpty ? subjectOptions : schoolSubjects)
                        .map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
                    onChanged: (v) => setS(() => selectedSubject = v),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: chapterCtrl,
                    maxLines: 6,
                    minLines: 3,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      labelText: 'Chapters / Topics',
                      hintText: 'e.g.\nPhotosynthesis\nRespiration in Plants\nTransportation in Plants',
                      alignLabelWithHint: true,
                      prefixIcon: Padding(padding: EdgeInsets.only(bottom: 60), child: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: chapterCtrl,
                    builder: (_, value, __) {
                      final count = value.text.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).length;
                      return Text(count == 0 ? 'One line = one chapter' : '$count chapter${count == 1 ? '' : 's'} will be added',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textLight));
                    },
                  ),
                  if (blocked) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: AppColors.redLight, borderRadius: BorderRadius.circular(10)),
                      child: const Text(
                        'This subject\'s syllabus is locked. Open it below and use Request Edit instead.',
                        style: TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  GestureDetector(
                    onTap: blocked ? null : () async {
                      if ((selectedSubject ?? '').trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Please select a subject'),
                          behavior: SnackBarBehavior.floating,
                        ));
                        return;
                      }
                      final names = chapterCtrl.text.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toSet().toList();
                      if (names.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Enter at least one chapter name'),
                          behavior: SnackBarBehavior.floating,
                        ));
                        return;
                      }
                      await SupabaseService.createSyllabusChapters(names.map((name) => {
                        'teacher_id': profile['id'],
                        'class':      selectedClass,
                        'subject':    selectedSubject!.trim(),
                        'chapter':    name,
                        'status':     'Not Started',
                      }).toList());
                      if (mounted) Navigator.pop(ctx);
                      _load();
                    },
                    child: Opacity(
                      opacity: blocked ? .5 : 1,
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
                          Text('Add Chapters', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                        ])),
                      ),
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

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else {
      body = Column(children: [
        if (_isClassTeacher) _buildScopeTabBar(),
        _buildGrowthChips(),
        Expanded(child: _scope == 0 ? _buildMineList() : _buildClassList()),
      ]);
    }

    final fab = FloatingActionButton.extended(
      onPressed: _showAddChapterSheet,
      backgroundColor: AppColors.navy,
      icon: const Icon(Icons.add, color: Colors.white),
      label: const Text('Add Chapters', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
    );

    if (widget.embedded) {
      return Stack(children: [
        Positioned.fill(child: body),
        Positioned(right: 16, bottom: 88, child: fab),
      ]);
    }
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Syllabus'),
      ),
      floatingActionButton: fab,
      body: body,
    );
  }

  Widget _buildScopeTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withOpacity(.08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _scopeTabButton('Mine', 0)),
        Expanded(child: _scopeTabButton('Class Overview', 1)),
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
        child: Center(child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
      ),
    );
  }

  // ── Growth chips ────────────────────────────────────────────────────────

  Widget _buildGrowthChips() {
    if (_loading) return const SizedBox.shrink();
    final chips = <Widget>[];
    if (_scope == 0) {
      if (_mineChapters.isEmpty) return const SizedBox.shrink();
      chips.add(_growthChip('Overall', _leafCounts(_mineChapters), highlight: true));
      final groups = _grouped(_mineChapters, includeClass: true).entries.toList()..sort((a, b) => a.key.compareTo(b.key));
      chips.addAll(groups.map((e) => _growthChip(e.key, _leafCounts(e.value))));
    } else {
      if (_classChapters.isEmpty) return const SizedBox.shrink();
      chips.add(_growthChip('Class Overall', _leafCounts(_classChapters), highlight: true));
      final groups = _grouped(_classChapters, includeClass: false).entries.toList()..sort((a, b) => a.key.compareTo(b.key));
      chips.addAll(groups.map((e) => _growthChip(e.key, _leafCounts(e.value))));
    }
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: SizedBox(
        // ListView's own padding used to carry the top:12 gap, but that
        // padding eats into the cross-axis (height) budget a horizontal
        // list gives its children - combined with this app's font metrics
        // that left the chip's two-line Column just over its box, printing
        // a 1px bottom-overflow banner. Moving the gap out to this wrapping
        // Padding keeps the full 76px available to the chip content instead.
        height: 76,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: chips.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) => chips[i],
        ),
      ),
    );
  }

  Widget _growthChip(String label, ({int total, int completed}) counts, {bool highlight = false}) {
    final pct = counts.total == 0 ? 0.0 : counts.completed / counts.total * 100;
    final color = pct >= 75 ? AppColors.green : pct >= 40 ? AppColors.amber : AppColors.red;
    return Container(
      width: 108,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: highlight ? AppColors.navy : AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: highlight ? null : Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Text('${pct.toStringAsFixed(0)}%',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: highlight ? Colors.white : color)),
        const SizedBox(height: 2),
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: highlight ? Colors.white70 : AppColors.textLight)),
      ]),
    );
  }

  // ── Mine tab ─────────────────────────────────────────────────────────────

  Widget _buildMineList() {
    final grouped = _grouped(_mineChapters, includeClass: true);
    if (grouped.isEmpty) {
      return _emptyState(
        title: 'No Chapters Added',
        subtitle: 'Tap "Add Chapters" below to start building your syllabus.',
      );
    }
    final sections = grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: sections.length,
        itemBuilder: (_, i) {
          final chapters   = sections[i].value;
          final className  = chapters.first['class'] as String? ?? '';
          final subject    = chapters.first['subject'] as String? ?? '';
          final state      = _sectionState(className, subject);
          final editable   = !state.locked || state.approvedWindow != null;
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _sectionHeader(className, subject, state),
              const SizedBox(height: 8),
              ...chapters.map((c) => _chapterTile(c, owned: true, editable: editable)),
            ]),
          );
        },
      ),
    );
  }

  Widget _sectionHeader(String className, String subject, _SectionState state) {
    Widget trailing;
    if (!state.locked) {
      trailing = _smallButton('Lock', Icons.lock_outline_rounded, AppColors.navy, () => _confirmLock(className, subject));
    } else if (state.approvedWindow != null) {
      final approvedAt = DateTime.parse(state.approvedWindow!['approved_at'].toString());
      final remaining = _editWindow - DateTime.now().difference(approvedAt);
      final h = remaining.inHours.clamp(0, 24);
      final m = remaining.inMinutes.remainder(60).clamp(0, 59);
      trailing = Row(mainAxisSize: MainAxisSize.min, children: [
        _badge('${h}h ${m}m left', AppColors.green, AppColors.greenLight),
        const SizedBox(width: 6),
        _smallButton('Save & Lock', Icons.lock_rounded, AppColors.navy, () => _saveAndLock(state.approvedWindow!)),
      ]);
    } else if (state.pending != null) {
      trailing = _badge('Request Pending', AppColors.amber, AppColors.amberLight);
    } else {
      trailing = Row(mainAxisSize: MainAxisSize.min, children: [
        _badge('Locked', AppColors.textHint, AppColors.border),
        const SizedBox(width: 6),
        _smallButton('Request Edit', Icons.lock_open_rounded, AppColors.amber, () => _openRequestEditSheet(className, subject)),
      ]);
    }
    return Row(children: [
      Expanded(child: Text('$className · $subject', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navy))),
      trailing,
    ]);
  }

  Widget _badge(String label, Color color, Color bg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
    child: Text(label, style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w700)),
  );

  Widget _smallButton(String label, IconData icon, Color color, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: color.withOpacity(.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(.3))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w700)),
      ]),
    ),
  );

  // ── Class Overview tab ──────────────────────────────────────────────────

  Widget _buildClassList() {
    final grouped = _grouped(_classChapters, includeClass: false);
    if (grouped.isEmpty) {
      return _emptyState(title: 'No Syllabus Yet', subtitle: 'No chapters have been added for your class yet.');
    }
    final sections = grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: sections.length,
        itemBuilder: (_, i) {
          final section  = sections[i];
          final chapters = section.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8, left: 2),
                child: Text(section.key, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navy)),
              ),
              ...chapters.map((c) {
                final owned = c['teacher_id'] == _employeeId;
                // Only this exact chapter row's own lock flag - Class
                // Overview doesn't show the full request/window workflow
                // (that lives in the Mine tab); a locked+owned chapter here
                // just can't be deleted or grown new subtopics.
                final editable = owned && c['locked'] != true;
                return _chapterTile(c, owned: owned, editable: editable);
              }),
            ]),
          );
        },
      ),
    );
  }

  // ── Shared chapter/subtopic tile ────────────────────────────────────────

  Widget _chapterTile(Map<String, dynamic> chapter, {required bool owned, required bool editable}) {
    final id = chapter['id'] as String;
    final subtopics = _subtopicsByChapter[id] ?? const [];
    final derived = _derivedStatus(subtopics);
    final status = derived ?? ((chapter['status'] ?? 'Not Started') as String);
    final isOpen = _expanded.contains(id);
    final locked = chapter['locked'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() => isOpen ? _expanded.remove(id) : _expanded.add(id)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              if (locked) const Padding(padding: EdgeInsets.only(right: 6), child: Icon(Icons.lock_outline_rounded, size: 14, color: AppColors.textHint)),
              Expanded(child: Text(chapter['chapter'] ?? '',
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
              GestureDetector(
                onTap: (owned && derived == null)
                    ? () => _cycleStatus(chapter)
                    : () => _explainReadOnlyStatus(!owned
                        ? 'Only the teacher who added this chapter can update its status.'
                        : 'Update status via the subtopics below.'),
                child: Opacity(
                  opacity: (owned && derived == null) ? 1 : .55,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
                    child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
              if (owned && editable) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _deleteChapter(chapter),
                  child: const Icon(Icons.delete_outline_rounded, color: AppColors.textHint, size: 20),
                ),
              ],
              const SizedBox(width: 4),
              Icon(isOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: AppColors.textHint, size: 18),
            ]),
          ),
        ),
        if (isOpen) Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 8),
            ...subtopics.map((s) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                const SizedBox(width: 8),
                Expanded(child: Text(s['name'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.text))),
                GestureDetector(
                  onTap: owned
                      ? () => _cycleSubtopicStatus(s)
                      : () => _explainReadOnlyStatus('Only the teacher who added this chapter can update its status.'),
                  child: Opacity(
                    opacity: owned ? 1 : .55,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: _statusBg(s['status'] ?? 'Not Started'), borderRadius: BorderRadius.circular(6)),
                      child: Text(s['status'] ?? 'Not Started',
                        style: TextStyle(color: _statusColor(s['status'] ?? 'Not Started'), fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
                if (owned && editable) ...[
                  const SizedBox(width: 6),
                  GestureDetector(onTap: () => _deleteSubtopic(s), child: const Icon(Icons.close_rounded, size: 16, color: AppColors.textHint)),
                ],
              ]),
            )),
            if (subtopics.isEmpty) const Padding(
              padding: EdgeInsets.only(left: 8, bottom: 6),
              child: Text('No subtopics yet.', style: TextStyle(fontSize: 12, color: AppColors.textHint)),
            ),
            if (owned && editable) GestureDetector(
              onTap: () => _showAddSubtopicsSheet(chapter),
              child: const Padding(
                padding: EdgeInsets.only(top: 4, left: 8),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.add_circle_outline_rounded, size: 14, color: AppColors.navy),
                  SizedBox(width: 4),
                  Text('Add Subtopics', style: TextStyle(fontSize: 12, color: AppColors.navy, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 6,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 52, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
    ),
  );

  Widget _emptyState({required String title, required String subtitle}) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.menu_book_rounded, color: AppColors.navy, size: 38),
      ),
      const SizedBox(height: 16),
      Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      Text(subtitle, textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
