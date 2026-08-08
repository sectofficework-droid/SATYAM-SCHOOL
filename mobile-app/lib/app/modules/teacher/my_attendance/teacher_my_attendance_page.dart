import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../common/widgets/attendance_view.dart';

// UI only for now - shows dummy attendance data so the design can be
// reviewed before wiring it up to a real source (admin panel currently
// records employee attendance via its own Excel import, not a
// day-by-day table teachers write to themselves - how this screen's data
// will actually be populated is still to be decided).
class TeacherMyAttendancePage extends StatelessWidget {
  const TeacherMyAttendancePage({super.key});

  // Dummy pattern spanning the last 6 months (so the Yearly tab has more
  // than one card to show) - mostly present, the 6th/17th of each month
  // absent, Sundays skipped as a school holiday.
  List<Map<String, dynamic>> get _dummyRecords {
    final now = DateTime.now();
    final records = <Map<String, dynamic>>[];
    for (int back = 5; back >= 0; back--) {
      final month = DateTime(now.year, now.month - back, 1);
      final isCurrentMonth = back == 0;
      final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
      final lastDay = isCurrentMonth ? now.day : daysInMonth;
      for (int d = 1; d <= lastDay; d++) {
        final date = DateTime(month.year, month.month, d);
        if (date.weekday == DateTime.sunday) continue;
        final status = (d == 6 || d == 17) ? 'A' : 'P';
        records.add({'date': date.toIso8601String().substring(0, 10), 'status': status});
      }
    }
    return records;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
      title: const Text('My Attendance'),
    ),
    body: AttendanceView(records: _dummyRecords),
  );
}
