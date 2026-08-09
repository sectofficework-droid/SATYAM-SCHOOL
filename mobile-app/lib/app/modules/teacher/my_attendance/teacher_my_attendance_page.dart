import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
      title: const Text('My Attendance'),
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : AttendanceView(records: _records, showLeave: true),
  );
}
