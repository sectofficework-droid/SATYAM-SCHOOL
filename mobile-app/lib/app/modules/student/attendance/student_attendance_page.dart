import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentAttendancePage extends StatefulWidget {
  final bool embedded;
  const StudentAttendancePage({super.key, this.embedded = false});
  @override
  State<StudentAttendancePage> createState() => _StudentAttendancePageState();
}

class _StudentAttendancePageState extends State<StudentAttendancePage> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;

  int get _total    => _records.length;
  int get _present  => _records.where((r) => r['status'] == 'P').length;
  int get _absent   => _records.where((r) => r['status'] == 'A').length;
  double get _pct   => _total == 0 ? 0 : _present / _total * 100;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final studentId = profile['id'] as String? ?? '';
    final records   = await SupabaseService.fetchStudentAttendance(studentId);
    setState(() { _records = records; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            // Summary
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.navy,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(children: [
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('${_pct.toStringAsFixed(1)}%',
                    style: const TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w700)),
                  const SizedBox(width: 8),
                  const Text('Attendance', style: TextStyle(color: Colors.white60, fontSize: 14)),
                ]),
                const SizedBox(height: 12),
                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _pct / 100,
                    backgroundColor: Colors.white.withOpacity(.2),
                    color: _pct >= 75 ? AppColors.green : AppColors.red,
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                  _statPill('Present', '$_present', AppColors.green),
                  _statPill('Absent', '$_absent', AppColors.red),
                  _statPill('Total', '$_total', Colors.white70),
                ]),
              ]),
            ),

            if (_pct < 75 && _total > 0)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.redLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.red.withOpacity(.3)),
                ),
                child: const Row(children: [
                  Icon(Icons.warning_amber, color: AppColors.red, size: 18),
                  SizedBox(width: 8),
                  Expanded(child: Text('Attendance below 75%. Please be regular.',
                    style: TextStyle(color: AppColors.red, fontSize: 13))),
                ]),
              ),

            // Record list
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Row(children: [
                SizedBox(width: 80, child: Text('Date', style: TextStyle(color: AppColors.textLight, fontSize: 12, fontWeight: FontWeight.w600))),
                Text('Status', style: TextStyle(color: AppColors.textLight, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: _records.length,
                itemBuilder: (_, i) {
                  final r    = _records[i];
                  final date = DateTime.tryParse(r['date'] ?? '');
                  final st   = r['status'] as String? ?? '';
                  final color= st == 'P' ? AppColors.green : AppColors.red;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(children: [
                      SizedBox(width: 80,
                        child: Text(date == null ? '' : DateFormat('d MMM').format(date),
                          style: const TextStyle(fontSize: 13, color: AppColors.text))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: color.withOpacity(.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          st == 'P' ? 'Present' : 'Absent',
                          style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12),
                        ),
                      ),
                    ]),
                  );
                },
              ),
            ),
          ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Attendance'),
      ),
      body: body,
    );
  }

  Widget _statPill(String label, String value, Color color) => Column(children: [
    Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w700)),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
  ]);
}
