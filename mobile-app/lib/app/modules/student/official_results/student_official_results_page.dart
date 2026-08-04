import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentOfficialResultsPage extends StatefulWidget {
  final bool embedded;
  const StudentOfficialResultsPage({super.key, this.embedded = false});
  @override
  State<StudentOfficialResultsPage> createState() => _StudentOfficialResultsPageState();
}

class _StudentOfficialResultsPageState extends State<StudentOfficialResultsPage> {
  List<Map<String, dynamic>> _results = [];
  bool _loading = true;
  final Set<String> _expanded = {};

  @override
  void initState() { super.initState(); _load(); }

  bool _isLocked(Map<String, dynamic> exam) {
    final endDate = DateTime.tryParse(exam['end_date'] ?? '');
    if (endDate == null) return false;
    final today = DateTime.now();
    final todayDay = DateTime(today.year, today.month, today.day);
    final endDay = DateTime(endDate.year, endDate.month, endDate.day);
    return todayDay.isBefore(endDay);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String? ?? '';
    final studentId = profile['id'] as String? ?? '';

    final exams    = await SupabaseService.fetchOfficialExams();
    final subjects = className.isNotEmpty ? await SupabaseService.fetchClassSubjects(className) : <String>[];

    final results = <Map<String, dynamic>>[];
    for (final exam in exams) {
      if (_isLocked(exam)) { results.add({...exam, 'locked': true, 'subjectRows': <Map<String, dynamic>>[]}); continue; }

      final examId = exam['id'] as String;
      final marksRows = className.isNotEmpty
          ? await SupabaseService.fetchOfficialExamMarksForClass(examId, className)
          : <Map<String, dynamic>>[];
      final maxBySubject = className.isNotEmpty
          ? await SupabaseService.fetchExamSubjectConfigForClass(examId, className)
          : <String, double>{};

      final myMarks = <String, double>{};
      for (final m in marksRows) {
        if (m['student_id'] == studentId && m['marks_obtained'] != null) {
          myMarks[m['subject_name'] as String] = (m['marks_obtained'] as num).toDouble();
        }
      }

      double totalObtained = 0, totalMax = 0;
      final subjectRows = subjects.map((subject) {
        final max = maxBySubject[subject] ?? 100;
        final obtained = myMarks[subject];
        if (obtained != null) { totalObtained += obtained; totalMax += max; }
        return {'subject': subject, 'obtained': obtained, 'max': max};
      }).toList();

      results.add({
        ...exam,
        'locked': false,
        'subjectRows': subjectRows,
        'totalObtained': totalObtained,
        'totalMax': totalMax,
        'anyMarked': subjectRows.any((r) => r['obtained'] != null),
      });
    }
    if (mounted) setState(() { _results = results; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : _results.isEmpty
            ? const Center(child: Text('No official exams yet.', style: TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                color: AppColors.navy,
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _results.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _buildExamCard(_results[i]),
                ),
              );

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Official Results'),
      ),
      body: body,
    );
  }

  Widget _buildExamCard(Map<String, dynamic> exam) {
    final id     = exam['id'] as String;
    final locked = exam['locked'] == true;
    final startDate = DateTime.tryParse(exam['start_date'] ?? '');
    final endDate = DateTime.tryParse(exam['end_date'] ?? '');
    final subjectRows = List<Map<String, dynamic>>.from(exam['subjectRows'] ?? []);
    final anyMarked = exam['anyMarked'] == true;
    final totalObtained = (exam['totalObtained'] as num?)?.toDouble() ?? 0;
    final totalMax      = (exam['totalMax'] as num?)?.toDouble() ?? 0;
    final pct = (!locked && anyMarked && totalMax > 0) ? totalObtained / totalMax * 100 : null;
    final color = pct == null ? AppColors.textHint
        : pct >= 75 ? AppColors.green : pct >= 50 ? AppColors.amber : AppColors.red;
    final isOpen = _expanded.contains(id);

    return Container(
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        GestureDetector(
          onTap: locked || !anyMarked && subjectRows.isEmpty ? null : () => setState(() {
            isOpen ? _expanded.remove(id) : _expanded.add(id);
          }),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(exam['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                  if (locked)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.amberLight, borderRadius: BorderRadius.circular(6)),
                      child: const Text('Coming Soon', style: TextStyle(color: AppColors.amber, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                ]),
                if (endDate != null)
                  Text(
                    startDate != null
                        ? '${DateFormat('d MMM').format(startDate)} – ${DateFormat('d MMM yyyy').format(endDate)}'
                        : DateFormat('d MMM yyyy').format(endDate),
                    style: const TextStyle(color: AppColors.textHint, fontSize: 11),
                  ),
              ])),
              if (!locked) Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(!anyMarked ? 'Not marked yet' : '${totalObtained.toStringAsFixed(0)} / ${totalMax.toStringAsFixed(0)}',
                    style: TextStyle(fontSize: anyMarked ? 18 : 12, fontWeight: FontWeight.w700, color: anyMarked ? color : AppColors.textHint)),
                  if (anyMarked) Text('${pct!.toStringAsFixed(1)}%', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
              if (!locked && subjectRows.isNotEmpty) ...[
                const SizedBox(width: 6),
                Icon(isOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: AppColors.textHint),
              ],
            ]),
          ),
        ),
        if (isOpen && !locked) Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: Column(children: subjectRows.map((row) {
            final obtained = row['obtained'] as double?;
            final max = row['max'] as double;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                Expanded(child: Text(row['subject'] as String, style: const TextStyle(fontSize: 13, color: AppColors.text))),
                Text(obtained != null ? '${obtained.toStringAsFixed(0)} / ${max.toStringAsFixed(0)}' : 'Pending',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: obtained != null ? AppColors.text : AppColors.textHint)),
              ]),
            );
          }).toList()),
        ),
      ]),
    );
  }
}
