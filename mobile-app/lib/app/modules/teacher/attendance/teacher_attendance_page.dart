import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherAttendancePage extends StatefulWidget {
  final bool embedded;
  const TeacherAttendancePage({super.key, this.embedded = false});
  @override
  State<TeacherAttendancePage> createState() => _TeacherAttendancePageState();
}

class _TeacherAttendancePageState extends State<TeacherAttendancePage> {
  List<Map<String, dynamic>> _students = [];
  final Map<String, String> _status = {}; // studentId → 'P'|'A'|'L'
  bool _loading = true;
  bool _saving  = false;
  bool _saved   = false;
  DateTime _date = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadStudents();
  }

  Future<void> _loadStudents() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_assigned'] as String? ?? '';
    if (className.isEmpty) { setState(() => _loading = false); return; }
    final students = await SupabaseService.fetchClassStudents(className);
    setState(() {
      _students = students;
      for (final s in students) _status[s['id'] as String] ??= 'P';
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final profile   = AuthService.to.profile.value ?? {};
    final teacherId = profile['id'] as String?;
    final dateStr   = DateFormat('yyyy-MM-dd').format(_date);
    final records   = _students.map((s) => {
      'student_id': s['id'],
      'date':       dateStr,
      'status':     _status[s['id'] as String] ?? 'P',
      'class':      profile['class_assigned'],
      'marked_by':  teacherId,
    }).toList();
    await SupabaseService.saveAttendanceBatch(records);
    setState(() { _saving = false; _saved = true; });
    Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _saved = false); });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _students.isEmpty
            ? const Center(child: Text('No class assigned to your profile.',
                style: TextStyle(color: AppColors.textLight)))
            : Column(children: [
                // Date selector
                Container(
                  color: AppColors.card,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(children: [
                    const Icon(Icons.calendar_today, size: 18, color: AppColors.navy),
                    const SizedBox(width: 8),
                    Text(DateFormat('EEEE, d MMM yyyy').format(_date),
                      style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text)),
                    const Spacer(),
                    TextButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime.now().subtract(const Duration(days: 30)),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) setState(() => _date = picked);
                      },
                      child: const Text('Change'),
                    ),
                  ]),
                ),

                // Summary chips
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(children: [
                    _chip('P', AppColors.green,  _status.values.where((v) => v == 'P').length),
                    const SizedBox(width: 8),
                    _chip('A', AppColors.red,    _status.values.where((v) => v == 'A').length),
                    const SizedBox(width: 8),
                    _chip('L', AppColors.amber,  _status.values.where((v) => v == 'L').length),
                  ]),
                ),

                // Student list
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    itemCount: _students.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final s  = _students[i];
                      final id = s['id'] as String;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(children: [
                          CircleAvatar(
                            radius: 18, backgroundColor: AppColors.blueLight,
                            child: Text('${i + 1}', style: const TextStyle(
                              color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 13)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s['full_name'] ?? '',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              Text(s['enrollment_no'] ?? '',
                                style: const TextStyle(color: AppColors.textLight, fontSize: 12)),
                            ],
                          )),
                          // P / A / L buttons
                          Row(children: ['P', 'A', 'L'].map((v) {
                            final active = _status[id] == v;
                            final color  = v == 'P' ? AppColors.green : v == 'A' ? AppColors.red : AppColors.amber;
                            return Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: GestureDetector(
                                onTap: () => setState(() => _status[id] = v),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 150),
                                  width: 34, height: 34,
                                  decoration: BoxDecoration(
                                    color: active ? color : color.withOpacity(.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Center(child: Text(v,
                                    style: TextStyle(
                                      color: active ? Colors.white : color,
                                      fontWeight: FontWeight.w700, fontSize: 13,
                                    ))),
                                ),
                              ),
                            );
                          }).toList()),
                        ]),
                      );
                    },
                  ),
                ),

                // Save button
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(width: 18, height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Icon(_saved ? Icons.check : Icons.save),
                    label: Text(_saved ? 'Saved!' : _saving ? 'Saving...' : 'Save Attendance'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _saved ? AppColors.green : AppColors.navy,
                    ),
                  ),
                ),
              ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: const Text('Mark Attendance')),
      body: body,
    );
  }

  Widget _chip(String label, Color color, int count) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: color.withOpacity(.1),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: color.withOpacity(.3)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 6),
      Text('$count $label', style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
    ]),
  );
}
