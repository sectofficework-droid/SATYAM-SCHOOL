import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherTasksPage extends StatefulWidget {
  final bool embedded;
  const TeacherTasksPage({super.key, this.embedded = false});
  @override
  State<TeacherTasksPage> createState() => _TeacherTasksPageState();
}

class _TeacherTasksPageState extends State<TeacherTasksPage> {
  List<Map<String, dynamic>> _assignments = [];
  String? _employeeId;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final list = employeeId != null
        ? await SupabaseService.fetchTeacherTasks(employeeId)
        : <Map<String, dynamic>>[];
    // Sort by deadline (soonest first), tasks without a deadline last.
    list.sort((a, b) {
      final da = (a['task']?['deadline_date'] as String?) ?? '';
      final db = (b['task']?['deadline_date'] as String?) ?? '';
      if (da.isEmpty && db.isEmpty) return 0;
      if (da.isEmpty) return 1;
      if (db.isEmpty) return -1;
      return da.compareTo(db);
    });
    if (mounted) setState(() { _assignments = list; _employeeId = employeeId; _loading = false; });
  }

  // task_assignees has a composite key (task_id, employee_id) - no row id -
  // so a status update is addressed by that pair.
  Future<void> _updateStatus(String taskId, String newStatus) async {
    final employeeId = _employeeId;
    if (employeeId == null) return;
    await SupabaseService.updateTaskAssigneeStatus(taskId, employeeId, newStatus);
    if (!mounted) return;
    setState(() {
      final idx = _assignments.indexWhere((a) => a['task_id'] == taskId);
      if (idx != -1) _assignments[idx]['status'] = newStatus;
    });
  }

  @override
  Widget build(BuildContext context) {
    Widget body;

    if (_loading) {
      body = _buildShimmer();
    } else if (_assignments.isEmpty) {
      body = _emptyState();
    } else {
      body = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _assignments.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 300 + i * 50),
            curve: Curves.easeOut,
            builder: (_, v, child) => Opacity(opacity: v,
              child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
            child: _TaskCard(
              assignment: _assignments[i],
              onStatusChange: (status) => _updateStatus(_assignments[i]['task_id'] as String, status),
            ),
          ),
        ),
      );
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Tasks'),
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
      child: Container(height: 120, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.task_alt_rounded, color: AppColors.navy, size: 38)),
      const SizedBox(height: 16),
      const Text('No Tasks Assigned', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Tasks assigned to you by admin will appear here.', style: TextStyle(fontSize: 13, color: AppColors.textLight)),
    ]),
  ));
}

class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> assignment;
  final void Function(String status) onStatusChange;
  const _TaskCard({required this.assignment, required this.onStatusChange});

  Map<String, dynamic> get _task => Map<String, dynamic>.from(assignment['task'] ?? {});
  String get _status => (assignment['status'] as String?) ?? 'Pending';

  Color get _priorityColor {
    final p = (_task['priority'] ?? '').toString();
    if (p == 'High') return AppColors.red;
    if (p == 'Low') return AppColors.blue;
    return AppColors.amber;
  }

  Color get _priorityLight {
    final p = (_task['priority'] ?? '').toString();
    if (p == 'High') return AppColors.redLight;
    if (p == 'Low') return AppColors.blueLight;
    return AppColors.amberLight;
  }

  bool get _overdue {
    if (_status == 'Completed') return false;
    final d = _task['deadline_date'] as String?;
    if (d == null || d.isEmpty) return false;
    final t = _task['deadline_time'] as String?;
    final deadline = (t != null && t.isNotEmpty)
        ? DateTime.tryParse('${d}T$t')
        : DateTime.tryParse('${d}T23:59:59');
    return deadline != null && deadline.isBefore(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final date = _task['deadline_date'] != null && (_task['deadline_date'] as String).isNotEmpty
      ? DateTime.tryParse(_task['deadline_date'] as String)
      : null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppShadows.card,
        border: _overdue ? Border.all(color: AppColors.red.withOpacity(.3)) : null,
      ),
      child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          width: 5,
          decoration: BoxDecoration(
            color: _overdue ? AppColors.red : _priorityColor,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
          ),
        ),
        Expanded(child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: _priorityLight, borderRadius: BorderRadius.circular(6)),
                child: Text('${_task['priority'] ?? 'Medium'}',
                  style: TextStyle(color: _priorityColor, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
              const Spacer(),
              if (_overdue)
                Text('Overdue', style: const TextStyle(color: AppColors.red, fontSize: 11, fontWeight: FontWeight.w700))
              else if (date != null)
                Row(children: [
                  const Icon(Icons.schedule_rounded, size: 12, color: AppColors.textHint),
                  const SizedBox(width: 4),
                  Text(DateFormat('d MMM yyyy').format(date),
                    style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
                ]),
            ]),
            const SizedBox(height: 8),
            Text('${_task['title'] ?? ''}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
            if ((_task['description'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('${_task['description']}', maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.4)),
            ],
            const SizedBox(height: 12),
            _buildStatusControl(),
          ]),
        )),
      ])),
    );
  }

  Widget _buildStatusControl() {
    if (_status == 'Completed') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.greenLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.green.withOpacity(.3)),
        ),
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.check_circle_rounded, size: 15, color: AppColors.green),
          SizedBox(width: 6),
          Text('Completed', style: TextStyle(color: AppColors.green, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      );
    }
    if (_status == 'In Progress') {
      return Row(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.blueLight,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.autorenew_rounded, size: 14, color: AppColors.blue),
            SizedBox(width: 5),
            Text('In Progress', style: TextStyle(color: AppColors.blue, fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: GestureDetector(
            onTap: () => onStatusChange('Completed'),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.green,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Center(child: Text('Mark Completed',
                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
            ),
          ),
        ),
      ]);
    }
    // Pending
    return GestureDetector(
      onTap: () => onStatusChange('In Progress'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          gradient: AppColors.navyGradient,
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.play_arrow_rounded, size: 16, color: Colors.white),
          SizedBox(width: 4),
          Text('Start Task', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }
}
