import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile view of the web admin panel's Staff Attendance (Kiosk) report
// (admin-panel/src/lib/reportService.js getStaffAttendanceForReport) - a
// date-range-scoped daily list, not the full report-builder UI. PDF/Monthly
// Register export deliberately stays web-only (see governance work log).
// Senior Admin/Management only.
class AdminStaffAttendanceReportPage extends StatefulWidget {
  const AdminStaffAttendanceReportPage({super.key});
  @override
  State<AdminStaffAttendanceReportPage> createState() => _AdminStaffAttendanceReportPageState();
}

class _AdminStaffAttendanceReportPageState extends State<AdminStaffAttendanceReportPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  DateTime _from = DateTime.now().subtract(const Duration(days: 6));
  DateTime _to = DateTime.now();
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await StaffAdminService.kioskAttendanceReport(_employeeId,
        fromDate: DateFormat('yyyy-MM-dd').format(_from), toDate: DateFormat('yyyy-MM-dd').format(_to));
      if (mounted) setState(() { _rows = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load the attendance report.'; _loading = false; });
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context, firstDate: DateTime(2025, 1, 1), lastDate: DateTime.now(),
      initialDateRange: DateTimeRange(start: _from, end: _to));
    if (picked != null) {
      setState(() { _from = picked.start; _to = picked.end; });
      _load();
    }
  }

  static const _statusLabels = {'P': 'Present', 'A': 'Absent', 'L': 'Leave', 'H': 'Holiday'};
  static const _statusColors = {'P': AppColors.green, 'A': AppColors.red, 'L': AppColors.amber, 'H': AppColors.blue};

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM');
    final tf = DateFormat('h:mm a');
    return Scaffold(
      appBar: AdminAppBar(title: 'Staff Attendance', actions: [
        IconButton(icon: const Icon(Icons.date_range_rounded), onPressed: _pickRange),
      ]),
      body: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: AppColors.card,
          child: Text('${df.format(_from)} — ${df.format(_to)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy)),
        ),
        Expanded(child: _loading
          ? const AdminLoading()
          : _error != null
            ? AdminErrorState(message: _error!, onRetry: _load)
            : _rows.isEmpty
              ? const AdminEmptyState(icon: Icons.event_busy_rounded, title: 'No records', subtitle: 'No attendance records in this date range.')
              : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = _rows[i];
                    final status = r['o_status'] as String? ?? '';
                    final checkIn = r['o_check_in_at'] != null ? DateTime.tryParse(r['o_check_in_at'] as String)?.toLocal() : null;
                    final checkOut = r['o_check_out_at'] != null ? DateTime.tryParse(r['o_check_out_at'] as String)?.toLocal() : null;
                    final isLate = r['o_is_late'] as bool?;
                    final lateMinutes = (r['o_late_minutes'] as num?)?.toInt();
                    final hours = (r['o_hours_worked'] as num?)?.toDouble() ?? 0;
                    return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(r['o_name'] as String? ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                        AdminStatusPill(label: _statusLabels[status] ?? status, color: _statusColors[status] ?? AppColors.textLight, light: (_statusColors[status] ?? AppColors.textLight).withValues(alpha: .15)),
                      ]),
                      const SizedBox(height: 2),
                      Text('${r['o_emp_code'] ?? ''} • ${r['o_designation'] ?? ''}${(r['o_department'] ?? '').toString().isNotEmpty ? ' • ${r['o_department']}' : ''}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                      const SizedBox(height: 8),
                      Row(children: [
                        Text(df.format(DateTime.parse(r['o_date'] as String)), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        const SizedBox(width: 10),
                        if (checkIn != null) Text('In ${tf.format(checkIn)}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                        if (checkOut != null) ...[const SizedBox(width: 8), Text('Out ${tf.format(checkOut)}', style: const TextStyle(fontSize: 12, color: AppColors.textLight))],
                      ]),
                      if (isLate == true) Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('Late by $lateMinutes min', style: const TextStyle(fontSize: 11, color: AppColors.red, fontWeight: FontWeight.w600))),
                      if (hours > 0) Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('${hours.toStringAsFixed(1)} hrs worked', style: const TextStyle(fontSize: 11, color: AppColors.textLight))),
                    ]));
                  },
                )),
        ),
      ]),
    );
  }
}
