import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Attendance page -> Overview tab
// (attendanceService.js getAttendanceOverviewForDate/
// sendBulkAttendanceReminders) - which section's attendance is marked/not
// marked for a date, with a "Notify All" bulk reminder to class teachers.
// The same tab's Holidays feature needed no new work - it's
// AdminYearPlanningPage's school_calendar_events table. Senior Admin/
// Management only.
class AdminAttendanceOverviewPage extends StatefulWidget {
  const AdminAttendanceOverviewPage({super.key});
  @override
  State<AdminAttendanceOverviewPage> createState() => _AdminAttendanceOverviewPageState();
}

class _AdminAttendanceOverviewPageState extends State<AdminAttendanceOverviewPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  DateTime _date = DateTime.now();
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;
  bool _notifying = false;

  @override
  void initState() { super.initState(); _load(); }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_date);

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await StaffAdminService.attendanceOverview(_employeeId, _dateStr);
      if (mounted) setState(() { _rows = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load the overview.'; _loading = false; });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2024, 1, 1), lastDate: DateTime.now());
    if (picked != null) { setState(() => _date = picked); _load(); }
  }

  Future<void> _notifyAll() async {
    final unmarked = _rows.where((r) => r['o_status'] != 'Marked' && r['o_teacher_id'] != null).length;
    if (unmarked == 0) { showAdminSnack(context, 'Everyone has marked attendance already.'); return; }
    final ok = await confirmAdminAction(context, title: 'Notify teachers',
      message: 'Send a reminder to $unmarked class teacher(s) who have not marked attendance for $_dateStr?', confirmLabel: 'Notify All');
    if (!ok) return;
    setState(() => _notifying = true);
    try {
      final result = await StaffAdminService.sendAttendanceReminders(_employeeId, _dateStr);
      if (mounted) showAdminSnack(context, 'Sent ${result['o_sent']}, skipped ${result['o_skipped']} (already notified today)');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to send reminders.', isError: true);
    } finally {
      if (mounted) setState(() => _notifying = false);
    }
  }

  static const _statusColors = {'Marked': AppColors.green, 'Partial': AppColors.amber, 'Not Marked': AppColors.red, 'Empty': AppColors.textLight};

  @override
  Widget build(BuildContext context) {
    final unmarkedCount = _rows.where((r) => r['o_status'] != 'Marked').length;
    return Scaffold(
      appBar: AdminAppBar(title: 'Attendance Overview', actions: [
        IconButton(icon: const Icon(Icons.calendar_today_rounded), onPressed: _pickDate),
      ]),
      body: Column(children: [
        Container(
          width: double.infinity, color: AppColors.card,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [
            Expanded(child: Text(DateFormat('EEE, d MMM yyyy').format(_date), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy))),
            if (!_loading && unmarkedCount > 0)
              TextButton.icon(
                onPressed: _notifying ? null : _notifyAll,
                icon: _notifying ? const SizedBox(height: 14, width: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.notifications_active_rounded, size: 16),
                label: Text('Notify All ($unmarkedCount)'),
              ),
          ]),
        ),
        Expanded(child: _loading
          ? const AdminLoading()
          : _error != null
            ? AdminErrorState(message: _error!, onRetry: _load)
            : _rows.isEmpty
              ? const AdminEmptyState(icon: Icons.fact_check_outlined, title: 'No sections found', subtitle: 'No active class sections with students enrolled.')
              : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = _rows[i];
                    final status = r['o_status'] as String? ?? '';
                    final color = _statusColors[status] ?? AppColors.textLight;
                    return AdminCard(child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${r['o_class_name']} - ${r['o_section_name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        Text('${r['o_teacher_name'] ?? 'No class teacher'} • ${r['o_marked_count']}/${r['o_total_students']} marked', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                      ])),
                      AdminStatusPill(label: status, color: color, light: color.withValues(alpha: .15)),
                    ]));
                  },
                )),
        ),
      ]),
    );
  }
}
