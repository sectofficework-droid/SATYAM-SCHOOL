import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';

// UI only for now - shows dummy attendance data so the design can be
// reviewed before wiring it up to a real source (admin panel currently
// records employee attendance via its own Excel import, not a
// day-by-day table teachers write to themselves - how this screen's data
// will actually be populated is still to be decided).
class TeacherMyAttendancePage extends StatefulWidget {
  const TeacherMyAttendancePage({super.key});
  @override
  State<TeacherMyAttendancePage> createState() => _TeacherMyAttendancePageState();
}

class _TeacherMyAttendancePageState extends State<TeacherMyAttendancePage> {
  int _monthOffset = 0; // 0 = current month, 1 = previous, ...

  DateTime get _month {
    final now = DateTime.now();
    return DateTime(now.year, now.month - _monthOffset, 1);
  }

  List<Map<String, dynamic>> get _records {
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final now = DateTime.now();
    final isCurrentMonth = _month.year == now.year && _month.month == now.month;
    final lastDay = isCurrentMonth ? now.day : daysInMonth;

    final records = <Map<String, dynamic>>[];
    for (int d = 1; d <= lastDay; d++) {
      final date = DateTime(_month.year, _month.month, d);
      if (date.weekday == DateTime.sunday) continue; // school holiday, not counted
      // Dummy pattern: mostly present, the 6th/17th of the month absent -
      // just enough variation to preview both states without real data.
      final status = (d == 6 || d == 17) ? 'A' : 'P';
      records.add({'date': date, 'status': status});
    }
    return records.reversed.toList();
  }

  int get _total => _records.length;
  int get _present => _records.where((r) => r['status'] == 'P').length;
  int get _absent => _records.where((r) => r['status'] == 'A').length;
  double get _pct => _total == 0 ? 0 : _present / _total * 100;

  @override
  Widget build(BuildContext context) {
    final records = _records;

    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Attendance'),
      ),
      body: Column(children: [
        // Summary
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: AppColors.navyGradient,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.3), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('${_pct.toStringAsFixed(0)}%',
                style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
              const SizedBox(width: 8),
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text('Attendance', style: TextStyle(color: Colors.white60, fontSize: 14)),
              ),
            ]),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: _pct / 100,
                backgroundColor: Colors.white.withOpacity(.2),
                color: _pct >= 75 ? AppColors.green : AppColors.amber,
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 18),
            Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _statPill('Present', '$_present', AppColors.green),
              _statPill('Absent', '$_absent', AppColors.red),
              _statPill('Total', '$_total', Colors.white70),
            ]),
          ]),
        ),

        // Month selector
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(children: [
            IconButton(
              onPressed: () => setState(() => _monthOffset++),
              icon: const Icon(Icons.chevron_left_rounded, color: AppColors.navy),
            ),
            Expanded(
              child: Text(DateFormat('MMMM yyyy').format(_month),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text)),
            ),
            IconButton(
              onPressed: _monthOffset == 0 ? null : () => setState(() => _monthOffset--),
              icon: Icon(Icons.chevron_right_rounded, color: _monthOffset == 0 ? AppColors.textHint : AppColors.navy),
            ),
          ]),
        ),

        // Record list
        Expanded(
          child: records.isEmpty
            ? const Center(child: Text('No records for this month', style: TextStyle(color: AppColors.textLight)))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: records.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final r = records[i];
                  final date = r['date'] as DateTime;
                  final status = r['status'] as String;
                  final present = status == 'P';
                  final color = present ? AppColors.green : AppColors.red;
                  final bg = present ? AppColors.greenLight : AppColors.redLight;
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: AppShadows.card,
                    ),
                    child: Row(children: [
                      Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
                        child: Icon(present ? Icons.check_rounded : Icons.close_rounded, color: color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(DateFormat('EEEE').format(date),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.text)),
                        Text(DateFormat('d MMMM yyyy').format(date),
                          style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                      ])),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
                        child: Text(present ? 'Present' : 'Absent',
                          style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11.5)),
                      ),
                    ]),
                  );
                },
              ),
        ),
      ]),
    );
  }

  Widget _statPill(String label, String value, Color color) => Column(children: [
    Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w700)),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
  ]);
}
