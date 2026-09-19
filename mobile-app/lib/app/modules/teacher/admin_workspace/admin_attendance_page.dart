import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminAttendancePage extends StatefulWidget {
  const AdminAttendancePage({super.key});
  @override
  State<AdminAttendancePage> createState() => _AdminAttendancePageState();
}

class _AdminAttendancePageState extends State<AdminAttendancePage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Attendance'),
      body: Column(children: [
        Material(color: AppColors.card, child: TabBar(
          controller: _tabs, labelColor: AppColors.navy, unselectedLabelColor: AppColors.textLight,
          indicatorColor: AppColors.navy,
          tabs: const [Tab(text: 'Mark Attendance'), Tab(text: 'Edit Requests')],
        )),
        Expanded(child: TabBarView(controller: _tabs, children: [
          _MarkAttendanceTab(employeeId: _employeeId),
          _EditRequestsTab(employeeId: _employeeId),
        ])),
      ]),
    );
  }
}

class _MarkAttendanceTab extends StatefulWidget {
  final String employeeId;
  const _MarkAttendanceTab({required this.employeeId});
  @override
  State<_MarkAttendanceTab> createState() => _MarkAttendanceTabState();
}

class _MarkAttendanceTabState extends State<_MarkAttendanceTab> {
  List<Map<String, dynamic>> _classes = [];
  String? _selectedClass;
  List<Map<String, dynamic>> _students = [];
  final Map<String, String> _status = {};
  bool _loadingClasses = true;
  bool _loadingStudents = false;
  bool _saving = false;
  String? _error;
  final DateTime _date = DateTime.now();

  @override
  void initState() { super.initState(); _loadClasses(); }

  Future<void> _loadClasses() async {
    setState(() { _loadingClasses = true; _error = null; });
    try {
      final list = await StaffAdminService.classList(widget.employeeId);
      final names = <String>{};
      for (final c in list) { final n = c['className'] as String?; if (n != null) names.add(n); }
      if (mounted) {
        setState(() {
          _classes = names.map((n) => {'className': n}).toList();
          _loadingClasses = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load classes.'; _loadingClasses = false; });
    }
  }

  Future<void> _selectClass(String className) async {
    setState(() { _selectedClass = className; _loadingStudents = true; _students = []; _status.clear(); });
    try {
      final students = await StaffAdminService.classStudents(className);
      final dateStr = DateFormat('yyyy-MM-dd').format(_date);
      final existing = await StaffAdminService.classAttendance(widget.employeeId, className, dateStr);
      final existingMap = { for (final e in existing) e['student_id'] as String: e['status'] as String };
      if (mounted) {
        setState(() {
          _students = students;
          for (final s in students) { _status[s['id'] as String] = existingMap[s['id']] ?? 'P'; }
          _loadingStudents = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _loadingStudents = false; });
      if (mounted) showAdminSnack(context, 'Could not load roster for $className', isError: true);
    }
  }

  Future<void> _save() async {
    if (_selectedClass == null || _students.isEmpty) return;
    setState(() => _saving = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);
    final records = _students.map((s) => {
      'student_id': s['id'],
      'date': dateStr,
      'class': _selectedClass,
      'status': _status[s['id']] ?? 'P',
    }).toList();
    try {
      await StaffAdminService.markAttendance(widget.employeeId, records);
      if (mounted) showAdminSnack(context, 'Attendance saved for $_selectedClass');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save attendance.', isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingClasses) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _loadClasses);

    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: DropdownButtonFormField<String>(
          initialValue: _selectedClass,
          decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
          items: _classes.map((c) => DropdownMenuItem(value: c['className'] as String, child: Text(c['className'] as String))).toList(),
          onChanged: (v) { if (v != null) _selectClass(v); },
        ),
      ),
      if (_loadingStudents) const Expanded(child: AdminLoading())
      else if (_selectedClass == null) const Expanded(child: AdminEmptyState(
        icon: Icons.class_rounded, title: 'Pick a class', subtitle: 'Select a class above to mark attendance.'))
      else if (_students.isEmpty) const Expanded(child: AdminEmptyState(
        icon: Icons.people_outline_rounded, title: 'No students', subtitle: 'This class has no enrolled students.'))
      else Expanded(child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _students.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final s = _students[i];
          final id = s['id'] as String;
          final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
          return AdminCard(child: Row(children: [
            Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
            ToggleButtons(
              constraints: const BoxConstraints(minHeight: 32, minWidth: 44),
              isSelected: ['P', 'A'].map((v) => _status[id] == v).toList(),
              onPressed: (i) => setState(() => _status[id] = ['P', 'A'][i]),
              children: const [Text('Present'), Text('Absent')],
            ),
          ]));
        },
      )),
      if (_selectedClass != null && _students.isNotEmpty)
        Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(width: double.infinity, child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
            onPressed: _saving ? null : _save,
            child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Save Attendance'),
          )),
        ),
    ]);
  }
}

class _EditRequestsTab extends StatefulWidget {
  final String employeeId;
  const _EditRequestsTab({required this.employeeId});
  @override
  State<_EditRequestsTab> createState() => _EditRequestsTabState();
}

class _EditRequestsTabState extends State<_EditRequestsTab> {
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.attendanceEditRequests(widget.employeeId);
      if (mounted) setState(() { _requests = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load edit requests.'; _loading = false; });
    }
  }

  Future<void> _respond(Map<String, dynamic> req, bool approve) async {
    String? note;
    if (!approve) {
      note = await showModalBottomSheet<String>(
        context: context,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (ctx) {
          final ctrl = TextEditingController();
          return Padding(
            padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('Reject request', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Reject')),
            ]),
          );
        },
      );
      if (note == null) return;
    } else {
      final ok = await confirmAdminAction(context, title: 'Approve request',
        message: 'Allow ${req['teacher_name'] ?? 'this teacher'} to edit attendance for ${req['class_name']} on ${req['date']}?',
        confirmLabel: 'Approve');
      if (!ok) return;
    }
    try {
      await StaffAdminService.respondAttendanceEditRequest(widget.employeeId, req['id'] as String, approve: approve, adminNote: note);
      if (mounted) showAdminSnack(context, approve ? 'Request approved' : 'Request rejected');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to respond.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) { return const AdminLoading(); }
    if (_error != null) { return AdminErrorState(message: _error!, onRetry: _load); }
    if (_requests.isEmpty) {
      return const AdminEmptyState(
        icon: Icons.inbox_rounded, title: 'No pending requests', subtitle: 'Attendance edit requests will appear here.');
    }

    return RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _requests.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final r = _requests[i];
        return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${r['teacher_name'] ?? 'Unknown'} — ${r['class_name']}${r['section_name'] != null ? ' - ${r['section_name']}' : ''}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          Text('Date: ${r['date']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
          if ((r['reason'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('Reason: ${r['reason']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
          ],
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => _respond(r, false), child: const Text('Reject'))),
            const SizedBox(width: 10),
            Expanded(child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.green),
              onPressed: () => _respond(r, true), child: const Text('Approve'))),
          ]),
        ]));
      },
    ));
  }
}
