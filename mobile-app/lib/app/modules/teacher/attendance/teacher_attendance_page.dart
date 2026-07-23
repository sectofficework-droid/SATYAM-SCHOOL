import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
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
  final Map<String, String> _status = {};
  bool _loading = true;
  bool _saving  = false;
  bool _saved   = false;
  DateTime _date = DateTime.now();

  @override
  void initState() { super.initState(); _loadStudents(); }

  Future<void> _loadStudents() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final sectionId  = profile['class_teacher_of_section_id']?.toString() ?? '';
    if (sectionId.isEmpty) { setState(() => _loading = false); return; }
    final students = await SupabaseService.fetchClassStudents(sectionId);
    if (mounted) setState(() {
      _students = students;
      for (final s in students) _status[s['id'] as String] ??= 'P';
      _loading = false;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final profile   = AuthService.to.profile.value ?? {};
    final teacherId = profile['id'] as String?;
    final className = profile['class_name'] as String? ?? '';
    final dateStr   = DateFormat('yyyy-MM-dd').format(_date);
    final records   = _students.map((s) => {
      'student_id': s['id'],
      'date':       dateStr,
      'status':     _status[s['id'] as String] ?? 'P',
      'class':      className,
      'marked_by':  teacherId,
    }).toList();
    await SupabaseService.saveAttendanceBatch(records);
    if (mounted) {
      setState(() { _saving = false; _saved = true; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Row(children: [
          Icon(Icons.check_circle, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text('Attendance saved!'),
        ]),
        backgroundColor: AppColors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
      Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _saved = false); });
    }
  }

  int get _presentCount => _status.values.where((v) => v == 'P').length;
  int get _absentCount  => _status.values.where((v) => v == 'A').length;

  @override
  Widget build(BuildContext context) {
    Widget body;

    if (_loading) {
      body = _buildShimmer();
    } else if (_students.isEmpty) {
      body = _emptyState();
    } else {
      final total   = _students.length;
      final percent = total > 0 ? _presentCount / total : 0.0;

      body = Column(children: [
        // Date + stats header
        Container(
          color: AppColors.card,
          child: Column(children: [
            // Date picker bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.calendar_month_rounded, color: AppColors.navy, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(DateFormat('EEEE').format(_date),
                    style: const TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w500)),
                  Text(DateFormat('d MMMM yyyy').format(_date),
                    style: const TextStyle(fontSize: 15, color: AppColors.text, fontWeight: FontWeight.w700)),
                ])),
                GestureDetector(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime.now().subtract(const Duration(days: 30)),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) setState(() => _date = picked);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: AppColors.navyGradient,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text('Change', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                  ),
                ),
              ]),
            ),

            // Progress bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(children: [
                Row(children: [
                  Text('$_presentCount / $total present',
                    style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                  const Spacer(),
                  Text('${(percent * 100).toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700,
                      color: percent >= 0.75 ? AppColors.green : percent >= 0.5 ? AppColors.amber : AppColors.red,
                    )),
                ]),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: percent,
                    minHeight: 6,
                    backgroundColor: AppColors.border,
                    valueColor: AlwaysStoppedAnimation(
                      percent >= 0.75 ? AppColors.green : percent >= 0.5 ? AppColors.amber : AppColors.red,
                    ),
                  ),
                ),
              ]),
            ),

            // P / A / L summary chips
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
              child: Row(children: [
                _summaryChip('Present', _presentCount, AppColors.green, AppColors.greenLight),
                const SizedBox(width: 8),
                _summaryChip('Absent',  _absentCount,  AppColors.red,   AppColors.redLight),
              ]),
            ),
            const Divider(height: 1, color: AppColors.border),
          ]),
        ),

        // Student list
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            itemCount: _students.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final s   = _students[i];
              final id  = s['id'] as String;
              final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
              final status = _status[id] ?? 'P';

              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: AppShadows.card,
                  border: Border.all(
                    color: status == 'A' ? AppColors.red.withOpacity(.2)
                         : AppColors.green.withOpacity(.15),
                    width: 1,
                  ),
                ),
                child: Row(children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.navy, AppColors.navyMid],
                        begin: Alignment.topLeft, end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(child: Text('${i + 1}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name.isNotEmpty ? name : (s['full_name'] ?? '—'),
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                    Text('GR: ${s['grno'] ?? ''}  ·  Roll: ${s['roll_no'] ?? ''}',
                      style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                  ])),
                  Row(children: ['P', 'A'].map((v) {
                    final active = status == v;
                    final color  = v == 'P' ? AppColors.green : AppColors.red;
                    return Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: GestureDetector(
                        onTap: () => setState(() => _status[id] = v),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            color: active ? color : color.withOpacity(.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: active ? color : color.withOpacity(.3)),
                          ),
                          child: Center(child: Text(v,
                            style: TextStyle(
                              color: active ? Colors.white : color,
                              fontWeight: FontWeight.w800, fontSize: 13,
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
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: GestureDetector(
            onTap: _saving ? null : _save,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 52,
              decoration: BoxDecoration(
                gradient: _saving ? null : (_saved
                  ? const LinearGradient(colors: [AppColors.green, Color(0xFF059669)])
                  : AppColors.navyGradient),
                color: _saving ? AppColors.textHint : null,
                borderRadius: BorderRadius.circular(14),
                boxShadow: _saving ? [] : [
                  BoxShadow(
                    color: (_saved ? AppColors.green : AppColors.navy).withOpacity(.35),
                    blurRadius: 16, offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Center(child: _saving
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(_saved ? Icons.check_rounded : Icons.save_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(_saved ? 'Saved!' : 'Save Attendance',
                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                  ])),
            ),
          ),
        ),
      ]);
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Mark Attendance'),
      ),
      body: body,
    );
  }

  Widget _summaryChip(String label, int count, Color color, Color bg) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Column(children: [
        Text('$count', style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
        Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
      ]),
    ),
  );

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 8,
    separatorBuilder: (_, __) => const SizedBox(height: 8),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 68, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.groups_rounded, color: AppColors.navy, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Class Assigned', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Ask admin to assign a class to your profile.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
