import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentHomeworkPage extends StatefulWidget {
  final bool embedded;
  const StudentHomeworkPage({super.key, this.embedded = false});
  @override
  State<StudentHomeworkPage> createState() => _StudentHomeworkPageState();
}

class _StudentHomeworkPageState extends State<StudentHomeworkPage> {
  List<Map<String, dynamic>> _list = [];
  bool _loading = true;

  // Homework is just a reminder for the student to do at home - once its due
  // date has passed there's nothing left to act on, so it drops out of the
  // main list automatically instead of sitting there looking like it's
  // still pending. It stays browsable in Archive.
  // 0 = Active (not past due yet), 1 = Archive (past due)
  int _tab = 0;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String?;
    final hw        = await SupabaseService.fetchHomework(className: className);
    setState(() { _list = hw; _loading = false; });
  }

  DateTime? _dueDate(Map<String, dynamic> hw) => DateTime.tryParse(hw['due_date'] ?? '');

  bool _isPastDue(Map<String, dynamic> hw) {
    final due = _dueDate(hw);
    if (due == null) return false;
    final today = DateTime.now();
    return due.isBefore(DateTime(today.year, today.month, today.day));
  }

  List<Map<String, dynamic>> get _activeList =>
      _list.where((h) => !_isPastDue(h)).toList()
        ..sort((a, b) => (a['due_date'] ?? '').compareTo(b['due_date'] ?? ''));

  List<Map<String, dynamic>> get _archiveList {
    final archived = _list.where(_isPastDue).toList()
      ..sort((a, b) => (b['due_date'] ?? '').compareTo(a['due_date'] ?? ''));
    return archived;
  }

  @override
  Widget build(BuildContext context) {
    final shownList = _tab == 0 ? _activeList : _archiveList;

    final list = _loading
        ? const Center(child: CircularProgressIndicator())
        : shownList.isEmpty
            ? Center(child: Text(
                _tab == 0 ? 'No homework assigned.' : 'No archived homework.',
                style: const TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: shownList.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final hw      = shownList[i];
                    final due     = DateTime.tryParse(hw['due_date'] ?? '');
                    final overdue = due != null && due.isBefore(DateTime.now());
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: overdue ? AppColors.red.withOpacity(.3) : AppColors.border),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: overdue ? AppColors.redLight : AppColors.amberLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.assignment,
                            color: overdue ? AppColors.red : AppColors.amber),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if ((hw['subject'] ?? '').isNotEmpty)
                              Text(hw['subject'], style: const TextStyle(
                                color: AppColors.navy, fontSize: 12, fontWeight: FontWeight.w600)),
                            Text(hw['description'] ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                            const SizedBox(height: 4),
                            Row(children: [
                              Icon(Icons.schedule, size: 13,
                                color: overdue ? AppColors.red : AppColors.textLight),
                              const SizedBox(width: 4),
                              Text(
                                due == null ? '' : 'Due: ${DateFormat('d MMM').format(due)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: overdue ? AppColors.red : AppColors.textLight,
                                  fontWeight: overdue ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                            ]),
                          ],
                        )),
                      ]),
                    );
                  },
                ),
              );

    final body = Column(children: [
      _buildTabBar(),
      Expanded(child: list),
    ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Homework'),
      ),
      body: body,
    );
  }

  Widget _buildTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.border.withOpacity(.4), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _tabButton('Active', 0, _activeList.length)),
        Expanded(child: _tabButton('Archive', 1, _archiveList.length)),
      ]),
    ),
  );

  Widget _tabButton(String label, int index, int count) {
    final active = _tab == index;
    return GestureDetector(
      onTap: () => setState(() => _tab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.card : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: active ? AppShadows.card : null,
        ),
        child: Center(child: Text('$label ($count)',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? AppColors.navy : AppColors.textLight))),
      ),
    );
  }
}
