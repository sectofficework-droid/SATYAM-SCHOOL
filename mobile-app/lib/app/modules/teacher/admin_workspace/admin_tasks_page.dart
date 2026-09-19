import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminTasksPage extends StatefulWidget {
  const AdminTasksPage({super.key});
  @override
  State<AdminTasksPage> createState() => _AdminTasksPageState();
}

class _AdminTasksPageState extends State<AdminTasksPage> {
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.tasks(_employeeId);
      if (mounted) setState(() { _tasks = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load tasks.'; _loading = false; });
    }
  }

  Future<void> _createTask() async {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final assigneeCtrl = TextEditingController();
    List<Map<String, dynamic>> selected = [];
    List<Map<String, dynamic>> results = [];
    String priority = 'Medium';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('New Task', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: descCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: priority,
            decoration: const InputDecoration(labelText: 'Priority', border: OutlineInputBorder()),
            items: const ['Low', 'Medium', 'High'].map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
            onChanged: (v) => setSheet(() => priority = v ?? priority),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: assigneeCtrl,
            decoration: const InputDecoration(labelText: 'Search assignee', border: OutlineInputBorder()),
            onChanged: (v) async {
              if (v.trim().length < 2) return;
              final r = await StaffAdminService.searchEmployees(_employeeId, v.trim());
              setSheet(() => results = r);
            },
          ),
          const SizedBox(height: 6),
          if (results.isNotEmpty) SizedBox(height: 120, child: ListView(children: results.map((e) => ListTile(
            dense: true,
            title: Text(e['name'] as String? ?? ''),
            trailing: selected.any((s) => s['id'] == e['id']) ? const Icon(Icons.check, color: AppColors.green) : null,
            onTap: () => setSheet(() {
              if (!selected.any((s) => s['id'] == e['id'])) selected.add(e);
            }),
          )).toList())),
          if (selected.isNotEmpty) Wrap(spacing: 6, children: selected.map((e) => Chip(
            label: Text(e['name'] as String? ?? ''),
            onDeleted: () => setSheet(() => selected.removeWhere((s) => s['id'] == e['id'])),
          )).toList()),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () => Navigator.pop(ctx, true), child: const Text('Create Task')),
        ])),
      )),
    );

    if (saved != true || titleCtrl.text.trim().isEmpty) return;
    try {
      await StaffAdminService.createTask(_employeeId,
        title: titleCtrl.text.trim(), description: descCtrl.text.trim(), priority: priority,
        assigneeIds: selected.map((e) => e['id'] as String).toList());
      if (mounted) showAdminSnack(context, 'Task created');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to create task.', isError: true);
    }
  }

  Future<void> _manage(Map<String, dynamic> t) async {
    final status = t['status'] as String? ?? 'Pending';
    final action = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          if (status != 'Completed')
            ListTile(leading: const Icon(Icons.check_circle_outline_rounded), title: const Text('Mark Completed'), onTap: () => Navigator.pop(ctx, 'Completed'))
          else
            ListTile(leading: const Icon(Icons.undo_rounded), title: const Text('Reopen'), onTap: () => Navigator.pop(ctx, 'Pending')),
          ListTile(leading: const Icon(Icons.delete_outline_rounded, color: AppColors.red),
            title: const Text('Delete Task', style: TextStyle(color: AppColors.red)), onTap: () => Navigator.pop(ctx, 'delete')),
        ]),
      ),
    );
    if (action == null || !mounted) return;
    try {
      if (action == 'delete') {
        final ok = await confirmAdminAction(context, title: 'Delete task', message: 'This cannot be undone.', confirmLabel: 'Delete');
        if (!ok) return;
        await StaffAdminService.deleteTask(_employeeId, t['id'] as String);
      } else {
        await StaffAdminService.updateTaskStatus(_employeeId, t['id'] as String, action);
      }
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Action failed.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Tasks'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _createTask, child: const Icon(Icons.add)),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _tasks.isEmpty ? const AdminEmptyState(icon: Icons.task_alt_rounded, title: 'No tasks', subtitle: 'Tap + to create one.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _tasks.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final t = _tasks[i];
              final completed = t['status'] == 'Completed';
              final assignees = (t['assignees'] as List?)?.cast<Map>() ?? [];
              return AdminCard(onTap: () => _manage(t), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(t['title'] as String? ?? '', style: TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13,
                    decoration: completed ? TextDecoration.lineThrough : null,
                    color: completed ? AppColors.textLight : AppColors.text))),
                  AdminStatusPill(label: t['status'] as String? ?? '', color: completed ? AppColors.green : AppColors.blue,
                    light: completed ? AppColors.greenLight : AppColors.blueLight),
                ]),
                if (t['deadline_date'] != null) ...[
                  const SizedBox(height: 4),
                  Text('Due ${DateFormat('d MMM').format(DateTime.parse(t['deadline_date'] as String))}', style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
                ],
                if (assignees.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(assignees.map((a) => a['name']).join(', '), style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ],
              ]));
            },
          )),
    );
  }
}
