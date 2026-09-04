import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

class TeacherHomeworkPage extends StatefulWidget {
  final bool embedded;
  const TeacherHomeworkPage({super.key, this.embedded = false});
  @override
  State<TeacherHomeworkPage> createState() => _TeacherHomeworkPageState();
}

class _TeacherHomeworkPageState extends State<TeacherHomeworkPage> {
  // Mine = homework this teacher personally gave. Class Overview = every
  // homework given to their own class, by any teacher - only meaningful (and
  // only shown) for an actual class teacher, never a subject teacher who
  // merely teaches a class without class-teaching it.
  List<Map<String, dynamic>> _mineList = [];
  List<Map<String, dynamic>> _classList = [];
  bool _loading = true;
  bool _isClassTeacher = false;

  // Class -> subjects this teacher actually teaches there, from the real
  // Timetable (see SupabaseService.fetchTeacherSubjectsByClass) - drives the
  // Add Homework sheet's Subject dropdown so it only ever offers what this
  // teacher is actually scheduled to teach, not the whole school subject list.
  Map<String, List<String>> _classSubjectsFromTT = {};

  // 0 = Mine, 1 = Class Overview
  int _scope = 0;

  // Defaults to today so the list opens already narrowed to what's due
  // today - clearing it (the X button) falls back to showing everything in
  // the current scope. Replaces the old Active/Archive split entirely.
  DateTime? _filterDate = DateTime.now();

  List<Map<String, dynamic>> get _currentList => _scope == 0 ? _mineList : _classList;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final ownClass    = profile['class_name'] as String?;
    _isClassTeacher = ownClass != null && ownClass.isNotEmpty;

    final mine = employeeId != null
        ? await SupabaseService.fetchHomework(createdBy: employeeId)
        : <Map<String, dynamic>>[];
    final classWide = _isClassTeacher
        ? await SupabaseService.fetchHomework(classNames: [ownClass!])
        : <Map<String, dynamic>>[];

    final teacherName = profile['name'] as String?;
    final academicYear = await SupabaseService.fetchCurrentAcademicYearLabel();
    final classSubjects = (teacherName != null && academicYear != null)
        ? await SupabaseService.fetchTeacherSubjectsByClass(academicYear, teacherName)
        : <String, List<String>>{};

    if (mounted) setState(() {
      _mineList  = mine;
      _classList = classWide;
      _classSubjectsFromTT = classSubjects;
      if (!_isClassTeacher) _scope = 0;
      _loading = false;
    });
  }

  DateTime? _dueDate(Map<String, dynamic> hw) => DateTime.tryParse(hw['due_date'] ?? '');

  List<Map<String, dynamic>> get _shownList {
    var list = _currentList;
    if (_filterDate != null) {
      list = list.where((h) {
        final due = _dueDate(h);
        return due != null && due.year == _filterDate!.year && due.month == _filterDate!.month && due.day == _filterDate!.day;
      }).toList();
    }
    final result = List<Map<String, dynamic>>.from(list);
    result.sort((a, b) => (a['due_date'] ?? '').compareTo(b['due_date'] ?? ''));
    return result;
  }

  void _showAddSheet() {
    final descCtrl    = TextEditingController();
    DateTime? dueDate;
    final profile    = AuthService.to.profile.value ?? {};
    final myClasses  = teacherClasses(profile);
    // A teacher with real Timetable periods gets a single "Class - Subject"
    // picker limited to what they're actually scheduled to teach (e.g.
    // "5th - EVS", "1st - Math"), instead of picking class and subject
    // separately from every school subject. A teacher with no timetable
    // periods at all yet falls back to the old two-dropdown pickers.
    final classSubjectPairs = <({String className, String subject})>[
      for (final entry in _classSubjectsFromTT.entries)
        for (final subject in entry.value) (className: entry.key, subject: subject),
    ]..sort((a, b) {
        final byClass = allSchoolClasses.indexOf(a.className).compareTo(allSchoolClasses.indexOf(b.className));
        return byClass != 0 ? byClass : a.subject.compareTo(b.subject);
      });

    String? selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : (myClasses.isNotEmpty ? myClasses.first : allSchoolClasses.first);
    String? selectedSubject;
    String? selectedPairKey = classSubjectPairs.isNotEmpty
        ? '${classSubjectPairs.first.className}|${classSubjectPairs.first.subject}'
        : null;
    if (classSubjectPairs.isNotEmpty) {
      selectedClass   = classSubjectPairs.first.className;
      selectedSubject = classSubjectPairs.first.subject;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
        final subjectOptions = _classSubjectsFromTT[selectedClass!] ?? const <String>[];
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
                      gradient: LinearGradient(colors: [AppColors.amber, AppColors.amber.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.assignment_add, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Add Homework', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                    Text('Assign task to your class', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                  ])),
                  IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                ]),
                const SizedBox(height: 20),
                if (classSubjectPairs.isNotEmpty) ...[
                  DropdownButtonFormField<String>(
                    value: selectedPairKey,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Class & Subject', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                    items: classSubjectPairs.map((p) => DropdownMenuItem(
                      value: '${p.className}|${p.subject}',
                      child: Text('${p.className} - ${p.subject}', overflow: TextOverflow.ellipsis),
                    )).toList(),
                    onChanged: (v) => setS(() {
                      selectedPairKey = v;
                      final p = classSubjectPairs.firstWhere((p) => '${p.className}|${p.subject}' == v);
                      selectedClass   = p.className;
                      selectedSubject = p.subject;
                    }),
                  ),
                ] else ...[
                  DropdownButtonFormField<String>(
                    value: selectedClass,
                    decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                    items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                    onChanged: (v) => setS(() { selectedClass = v; selectedSubject = null; }),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    value: selectedSubject,
                    isExpanded: true,
                    hint: const Text('Select', style: TextStyle(fontSize: 13)),
                    decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                    items: (subjectOptions.isNotEmpty ? subjectOptions : schoolSubjects)
                        .map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
                    onChanged: (v) => setS(() => selectedSubject = v),
                  ),
                ],
                const SizedBox(height: 14),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description / Task', prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 40),
                    child: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20),
                  )),
                ),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now().add(const Duration(days: 1)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 30)),
                    );
                    if (d != null) setS(() => dueDate = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      border: Border.all(color: dueDate != null ? AppColors.navy : AppColors.border, width: dueDate != null ? 2 : 1),
                      borderRadius: BorderRadius.circular(12),
                      color: AppColors.card,
                    ),
                    child: Row(children: [
                      Icon(Icons.calendar_month_rounded, size: 20, color: dueDate != null ? AppColors.navy : AppColors.textHint),
                      const SizedBox(width: 10),
                      Text(
                        dueDate == null ? 'Select Due Date' : DateFormat('EEEE, d MMM yyyy').format(dueDate!),
                        style: TextStyle(color: dueDate == null ? AppColors.textHint : AppColors.text, fontWeight: dueDate != null ? FontWeight.w600 : FontWeight.normal),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () async {
                    if (descCtrl.text.isEmpty || dueDate == null || selectedClass == null || selectedSubject == null) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Please select a class, subject and fill description and due date'),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    await SupabaseService.createHomework({
                      'class':       selectedClass,
                      'subject':     selectedSubject,
                      'description': descCtrl.text.trim(),
                      'due_date':    DateFormat('yyyy-MM-dd').format(dueDate!),
                      'created_by':  profile['id'],
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
                      Text('Assign Homework', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
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

  @override
  Widget build(BuildContext context) {
    final shownList = _shownList;

    Widget listArea;
    if (_loading) {
      listArea = _buildShimmer();
    } else if (shownList.isEmpty) {
      listArea = _emptyState();
    } else {
      listArea = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          itemCount: shownList.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final hw    = shownList[i];
            final due   = DateTime.tryParse(hw['due_date'] ?? '');
            // REQ-BUG-007: due is parsed at midnight, so comparing it
            // against DateTime.now() (with time-of-day) marked today's own
            // due date as overdue as soon as the clock passed midnight.
            // Truncate "now" to date-only first, same fix as the student
            // app's _isPastDue.
            final today   = DateTime.now();
            final todayDate = DateTime(today.year, today.month, today.day);
            final overdue = due != null && due.isBefore(todayDate);
            final urgent  = due != null && !overdue && due.difference(todayDate).inDays <= 2;

            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: Duration(milliseconds: 300 + i * 50),
              curve: Curves.easeOut,
              builder: (_, v, child) => Opacity(opacity: v,
                child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: AppShadows.card,
                  border: overdue
                    ? Border.all(color: AppColors.red.withOpacity(.3))
                    : urgent
                      ? Border.all(color: AppColors.amber.withOpacity(.3))
                      : null,
                ),
                child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    width: 5,
                    decoration: BoxDecoration(
                      color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.green,
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                            color: overdue ? AppColors.redLight : urgent ? AppColors.amberLight : AppColors.greenLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.assignment_rounded,
                            color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.green,
                            size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          if ((hw['subject'] ?? '').isNotEmpty || (hw['class'] ?? '').isNotEmpty)
                            Wrap(spacing: 6, runSpacing: 4, children: [
                              if ((hw['class'] ?? '').isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: AppColors.greenLight, borderRadius: BorderRadius.circular(6)),
                                  child: Text('Class ${hw['class']}', style: const TextStyle(color: AppColors.green, fontSize: 11, fontWeight: FontWeight.w700)),
                                ),
                              if ((hw['subject'] ?? '').isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(6)),
                                  child: Text(hw['subject'], style: const TextStyle(color: AppColors.blue, fontSize: 11, fontWeight: FontWeight.w700)),
                                ),
                            ]),
                          Text(hw['description'] ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(Icons.schedule_rounded, size: 13,
                              color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.textLight),
                            const SizedBox(width: 4),
                            Text(
                              due == null ? '' : overdue
                                ? 'Overdue · ${DateFormat('d MMM').format(due)}'
                                : 'Due: ${DateFormat('d MMM yyyy').format(due)}',
                              style: TextStyle(fontSize: 12,
                                color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.textLight,
                                fontWeight: overdue || urgent ? FontWeight.w600 : FontWeight.normal),
                            ),
                          ]),
                        ])),
                      ]),
                    ),
                  ),
                ])),
              ),
            );
          },
        ),
      );
    }

    final body = Column(children: [
      if (_isClassTeacher) _buildScopeTabBar(),
      _buildDateFilter(),
      Expanded(child: listArea),
    ]);

    if (widget.embedded) {
      // A nested Scaffold's floatingActionButton can render behind/clipped
      // by the outer tab shell's custom bottom nav bar (extendBody: true) -
      // a Stack + Positioned button avoids depending on Scaffold's FAB
      // docking logic entirely.
      return Stack(children: [
        Positioned.fill(child: body),
        Positioned(
          // 72 clears the outer tab shell's custom bottom nav bar, which
          // this embedded page's body renders behind (extendBody: true).
          right: 16, bottom: 88,
          child: FloatingActionButton.extended(
            onPressed: _showAddSheet,
            backgroundColor: AppColors.navy,
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('Add', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ),
      ]);
    }
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Homework'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        backgroundColor: AppColors.navy,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Homework', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: body,
    );
  }

  // Mine vs Class Overview - only a real class teacher has anything to show
  // in Class Overview, so this whole row is hidden for a subject teacher
  // rather than shown disabled/empty.
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
      onTap: () => setState(() { _scope = index; _filterDate = DateTime.now(); }),
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

  // No date picked = every homework in the current scope. Picking one narrows
  // to just that day - replaces the old separate Active/Archive tabs.
  Widget _buildDateFilter() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Row(children: [
      Expanded(
        child: GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _filterDate ?? DateTime.now(),
              firstDate: DateTime.now().subtract(const Duration(days: 365)),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (picked != null) setState(() => _filterDate = picked);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              border: Border.all(color: _filterDate != null ? AppColors.navy : AppColors.border, width: _filterDate != null ? 2 : 1),
              borderRadius: BorderRadius.circular(10),
              color: AppColors.card,
            ),
            child: Row(children: [
              Icon(Icons.event_rounded, size: 16, color: _filterDate != null ? AppColors.navy : AppColors.textLight),
              const SizedBox(width: 8),
              Text(
                _filterDate == null ? 'Filter by due date' : DateFormat('d MMM yyyy').format(_filterDate!),
                style: TextStyle(fontSize: 12.5, color: AppColors.text, fontWeight: _filterDate != null ? FontWeight.w700 : FontWeight.w600),
              ),
            ]),
          ),
        ),
      ),
      if (_filterDate != null) ...[
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => setState(() => _filterDate = null),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.redLight, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.close_rounded, size: 16, color: AppColors.red),
          ),
        ),
      ],
    ]),
  );

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 86, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  Widget _emptyState() {
    final filtered = _filterDate != null;
    return Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 80, height: 80,
          decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
          child: Icon(filtered ? Icons.event_busy_rounded : Icons.assignment_outlined, color: AppColors.amber, size: 38),
        ),
        const SizedBox(height: 16),
        Text(filtered ? 'Nothing Due On This Date' : 'No Homework Found',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 8),
        Text(
          filtered
            ? 'Try a different date, or clear the filter to see everything.'
            : 'Tap the + button to assign homework to a class.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5),
        ),
      ]),
    ));
  }
}
