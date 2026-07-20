import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentMarksPage extends StatefulWidget {
  final bool embedded;
  const StudentMarksPage({super.key, this.embedded = false});
  @override
  State<StudentMarksPage> createState() => _StudentMarksPageState();
}

class _StudentMarksPageState extends State<StudentMarksPage> {
  List<Map<String, dynamic>> _exams  = [];
  List<Map<String, dynamic>> _marks  = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  // Marks aren't entered until on/after the exam date - show a clear
  // "Upcoming" state for such exams instead of an unexplained blank score.
  bool _isUpcoming(Map<String, dynamic> exam) {
    final d = exam['date'] as String?;
    if (d == null || d.isEmpty) return false;
    final examDate = DateTime.tryParse(d);
    if (examDate == null) return false;
    final today    = DateTime.now();
    final examDay  = DateTime(examDate.year, examDate.month, examDate.day);
    final todayDay = DateTime(today.year, today.month, today.day);
    return examDay.isAfter(todayDay);
  }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String? ?? '';
    final studentId = profile['id'] as String? ?? '';

    final exams = await SupabaseService.fetchExams(className: className);
    // Collect all marks for this student across all exams
    final List<Map<String, dynamic>> allMarks = [];
    for (final e in exams) {
      final marks = await SupabaseService.fetchExamMarks(e['id'] as String);
      final myMark = marks.where((m) => m['student_id'] == studentId).toList();
      if (myMark.isNotEmpty) {
        allMarks.add({...e, 'obtained': myMark.first['marks_obtained']});
      } else {
        allMarks.add({...e, 'obtained': null});
      }
    }
    setState(() { _exams = exams; _marks = allMarks; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _marks.isEmpty
            ? const Center(child: Text('No exam results yet.', style: TextStyle(color: AppColors.textLight)))
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _marks.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final m       = _marks[i];
                  final upcoming = _isUpcoming(m);
                  final max     = (m['max_marks'] as num?)?.toDouble() ?? 100;
                  final obt     = upcoming ? null : (m['obtained'] as num?)?.toDouble();
                  final pct     = obt == null ? null : obt / max * 100;
                  final color   = pct == null ? AppColors.textHint
                      : pct >= 75 ? AppColors.green : pct >= 50 ? AppColors.amber : AppColors.red;
                  final date    = DateTime.tryParse(m['date'] ?? '');

                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(child: Text(m['name'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                                if (upcoming)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: AppColors.amberLight, borderRadius: BorderRadius.circular(6)),
                                    child: const Text('Upcoming',
                                      style: TextStyle(color: AppColors.amber, fontSize: 11, fontWeight: FontWeight.w700)),
                                  ),
                              ]),
                              Text('${m['subject'] ?? ''} · Max: ${max.toInt()}',
                                style: const TextStyle(color: AppColors.textLight, fontSize: 12)),
                              if (date != null)
                                Text(DateFormat('d MMM yyyy').format(date),
                                  style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
                            ],
                          )),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(upcoming ? 'Not held' : (obt == null ? '—' : '${obt.toStringAsFixed(0)}'),
                                style: TextStyle(
                                  fontSize: upcoming ? 13 : 28,
                                  fontWeight: FontWeight.w700,
                                  color: upcoming ? AppColors.textHint : color,
                                )),
                              if (!upcoming)
                                Text('/ ${max.toInt()}',
                                  style: const TextStyle(color: AppColors.textLight, fontSize: 12)),
                            ],
                          ),
                        ]),
                        if (pct != null) ...[
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: pct / 100,
                              color: color,
                              backgroundColor: color.withOpacity(.15),
                              minHeight: 6,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('${pct.toStringAsFixed(1)}%',
                            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ],
                    ),
                  );
                },
              );

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Results'),
      ),
      body: body,
    );
  }
}
