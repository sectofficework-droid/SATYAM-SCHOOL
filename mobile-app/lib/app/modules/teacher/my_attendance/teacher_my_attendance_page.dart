import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/attendance_view.dart';

// Read-only: this teacher's own day-by-day attendance (Present/Absent/
// Leave), marked by admin or auto-marked 'L' when a leave request is
// approved (see "My Leave").
class TeacherMyAttendancePage extends StatefulWidget {
  const TeacherMyAttendancePage({super.key});
  @override
  State<TeacherMyAttendancePage> createState() => _TeacherMyAttendancePageState();
}

class _TeacherMyAttendancePageState extends State<TeacherMyAttendancePage> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final records = employeeId != null
        ? await SupabaseService.fetchEmployeeAttendance(employeeId)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _records = records; _loading = false; });
  }

  // Today's row, if any - carries the face-punch check-in/check-out times
  // (fetchEmployeeAttendance already select()s every column, so these come
  // through with no extra query).
  Map<String, dynamic>? get _todayRecord {
    final today = DateTime.now();
    for (final r in _records) {
      final d = DateTime.tryParse((r['date'] ?? '').toString());
      if (d != null && d.year == today.year && d.month == today.month && d.day == today.day) return r;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
      title: const Text('My Attendance'),
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : Column(children: [
            _buildTodayPunchBanner(),
            Expanded(child: AttendanceView(records: _records, showLeave: true)),
          ]),
  );

  Widget _buildTodayPunchBanner() {
    final today = _todayRecord;
    final checkIn  = DateTime.tryParse((today?['check_in_at']  ?? '').toString());
    final checkOut = DateTime.tryParse((today?['check_out_at'] ?? '').toString());
    if (checkIn == null && checkOut == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Expanded(child: _punchTimeTile('Check In', checkIn)),
        Container(width: 1, height: 32, color: AppColors.indigo.withValues(alpha: .2)),
        Expanded(child: _punchTimeTile('Check Out', checkOut)),
      ]),
    );
  }

  Widget _punchTimeTile(String label, DateTime? time) => Column(children: [
    Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.indigo)),
    const SizedBox(height: 4),
    Text(time == null ? '—' : DateFormat('h:mm a').format(time),
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
  ]);
}
