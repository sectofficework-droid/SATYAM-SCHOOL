import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherDailyTasksPage extends StatefulWidget {
  final bool embedded;
  const TeacherDailyTasksPage({super.key, this.embedded = false});
  @override
  State<TeacherDailyTasksPage> createState() => _TeacherDailyTasksPageState();
}

class _TeacherDailyTasksPageState extends State<TeacherDailyTasksPage> {
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  String? _employeeId;
  final Set<String> _busyIds = {};

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile = AuthService.to.profile.value ?? {};
    _employeeId = profile['id'] as String?;
    final tasks = _employeeId != null
        ? await SupabaseService.fetchDailyTasksForEmployee(_employeeId!)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _tasks = tasks; _loading = false; });
  }

  Future<void> _toggle(Map<String, dynamic> task) async {
    final id = task['id'] as String;
    final employeeId = _employeeId;
    if (employeeId == null || _busyIds.contains(id)) return;
    // REQ-BUG-008: must capture the original value itself, not just a
    // wasDone bool derived from it - the optimistic setState below
    // overwrites task['completedAt'], so reconstructing the rollback from
    // wasDone alone was a no-op when un-marking (both branches evaluated to
    // the already-nulled value).
    final originalCompletedAt = task['completedAt'];
    final wasDone = originalCompletedAt != null;

    setState(() {
      _busyIds.add(id);
      task['completedAt'] = wasDone ? null : DateTime.now().toIso8601String();
    });
    try {
      if (wasDone) {
        await SupabaseService.unmarkDailyTaskDone(id, employeeId);
      } else {
        await SupabaseService.markDailyTaskDone(id, employeeId);
      }
    } catch (_) {
      if (mounted) setState(() => task['completedAt'] = originalCompletedAt);
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator(color: AppColors.navy));
    } else if (_tasks.isEmpty) {
      body = _emptyState();
    } else {
      final done = _tasks.where((t) => t['completedAt'] != null).length;
      body = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                const Icon(Icons.checklist_rounded, color: Colors.white, size: 28),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('$done of ${_tasks.length} done today',
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                  const Text('Tick each task off as you complete it', style: TextStyle(color: Colors.white70, fontSize: 12)),
                ])),
              ]),
            ),
            const SizedBox(height: 14),
            ..._tasks.map((task) {
              final id = task['id'] as String;
              final title = (task['title'] ?? '').toString();
              final description = (task['description'] ?? '').toString();
              final completedAt = task['completedAt'] as String?;
              final done = completedAt != null;
              final time = done ? DateTime.tryParse(completedAt) : null;

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: GestureDetector(
                  onTap: () => _toggle(task),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: AppShadows.card,
                      border: Border.all(color: done ? AppColors.green.withValues(alpha: .4) : AppColors.border),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 26, height: 26,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: done ? AppColors.green : Colors.transparent,
                          border: Border.all(color: done ? AppColors.green : AppColors.textHint, width: 2),
                        ),
                        child: done ? const Icon(Icons.check_rounded, color: Colors.white, size: 17) : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(title, style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text,
                          decoration: done ? TextDecoration.lineThrough : null,
                          decorationColor: AppColors.textLight,
                        )),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(description, style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
                        ],
                        if (done && time != null) ...[
                          const SizedBox(height: 5),
                          Text('Done at ${DateFormat('h:mm a').format(time)}',
                            style: const TextStyle(fontSize: 11.5, color: AppColors.green, fontWeight: FontWeight.w600)),
                        ],
                      ])),
                      if (_busyIds.contains(id)) ...[
                        const SizedBox(width: 8),
                        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.navy)),
                      ],
                    ]),
                  ),
                ),
              );
            }),
          ],
        ),
      );
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Daily Tasks'),
      ),
      body: body,
    );
  }

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.greenLight, shape: BoxShape.circle),
        child: const Icon(Icons.checklist_rounded, color: AppColors.green, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Daily Tasks', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Admin hasn\'t assigned any daily routine tasks to you yet.',
        textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
