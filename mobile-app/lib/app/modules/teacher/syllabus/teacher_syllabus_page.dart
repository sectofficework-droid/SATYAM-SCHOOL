import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

const _statuses = ['Not Started', 'In Progress', 'Completed'];

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

class _TeacherSyllabusPageState extends State<TeacherSyllabusPage> {
  // Mine = chapters this teacher personally added. Class Overview = every
  // chapter added for their own class, by any teacher - only meaningful
  // (and only shown) for an actual class teacher.
  List<Map<String, dynamic>> _mineChapters  = [];
  List<Map<String, dynamic>> _classChapters = [];
  bool _loading = true;
  bool _isClassTeacher = false;
  String? _employeeId;

  // 0 = Mine, 1 = Class Overview
  int _scope = 0;

  List<Map<String, dynamic>> get _currentChapters => _scope == 0 ? _mineChapters : _classChapters;

  @override
  void initState() { super.initState(); _load(); }

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

    if (mounted) setState(() {
      _mineChapters  = mine;
      _classChapters = classWide;
      if (!_isClassTeacher) _scope = 0;
      _loading = false;
    });
  }

  Future<void> _cycleStatus(Map<String, dynamic> chapter) async {
    if (chapter['teacher_id'] != _employeeId) return; // view-only for others' chapters
    final current = _statuses.indexOf(chapter['status'] ?? 'Not Started');
    final next = _statuses[(current + 1) % _statuses.length];
    setState(() => chapter['status'] = next);
    await SupabaseService.updateSyllabusStatus(chapter['id'] as String, next);
  }

  Future<void> _deleteChapter(Map<String, dynamic> chapter) async {
    await SupabaseService.deleteSyllabusChapter(chapter['id'] as String);
    _load();
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
    final profile     = AuthService.to.profile.value ?? {};
    String selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : allSchoolClasses.first;
    String selectedSubject = schoolSubjects.first;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
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
                    Text('Add Chapter', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                    Text('Add a chapter to your syllabus', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                  ])),
                  IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                ]),
                const SizedBox(height: 20),
                DropdownButtonFormField<String>(
                  value: selectedClass,
                  decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                  items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (v) => setS(() => selectedClass = v!),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: selectedSubject,
                  decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                  items: schoolSubjects.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                  onChanged: (v) => setS(() => selectedSubject = v!),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: chapterCtrl,
                  decoration: const InputDecoration(labelText: 'Chapter / Topic', prefixIcon: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20)),
                ),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () async {
                    if (chapterCtrl.text.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Please enter a chapter name'),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    await SupabaseService.createSyllabusChapter({
                      'teacher_id': profile['id'],
                      'class':      selectedClass,
                      'subject':    selectedSubject,
                      'chapter':    chapterCtrl.text.trim(),
                      'status':     'Not Started',
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
                      Text('Add Chapter', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                    ])),
                  ),
                ),
              ],
            ),
          ),
        ),
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
        Expanded(child: _buildList()),
      ]);
    }

    final fab = FloatingActionButton.extended(
      onPressed: _showAddChapterSheet,
      backgroundColor: AppColors.navy,
      icon: const Icon(Icons.add, color: Colors.white),
      label: const Text('Add Chapter', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
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

  Widget _buildList() {
    final grouped = _grouped(_currentChapters, includeClass: _scope == 0);
    if (grouped.isEmpty) {
      return _emptyState(
        title: _scope == 0 ? 'No Chapters Added' : 'No Syllabus Yet',
        subtitle: _scope == 0
          ? 'Tap "Add Chapter" below to start building your syllabus.'
          : 'No chapters have been added for your class yet.',
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
                final owned  = c['teacher_id'] == _employeeId;
                final status = (c['status'] ?? 'Not Started') as String;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: AppShadows.card,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(children: [
                    Expanded(child: Text(c['chapter'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
                    GestureDetector(
                      onTap: owned ? () => _cycleStatus(c) : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
                        child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    if (owned) ...[
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => _deleteChapter(c),
                        child: const Icon(Icons.delete_outline_rounded, color: AppColors.textHint, size: 20),
                      ),
                    ],
                  ]),
                );
              }),
            ]),
          );
        },
      ),
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
