import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

// REQ-FEAT-020 follow-up (2026-10-19) - user: "every subject is assigned 10
// marks if ticked total will be counted towards how much time the notebook
// is checked (different date)". Report over notebook_log for a class + date
// range: per student per subject, how many times it was checked complete
// (marks = checks * 10) out of how many times it was checked at all, plus
// an overall per-student total across every subject. Marks are computed
// here from fetch_notebook_report's raw counts, not stored anywhere.
class TeacherNotebookReportPage extends StatefulWidget {
  const TeacherNotebookReportPage({super.key});
  @override
  State<TeacherNotebookReportPage> createState() => _TeacherNotebookReportPageState();
}

class _TeacherNotebookReportPageState extends State<TeacherNotebookReportPage> {
  static const int _marksPerCheck = 10;

  String? _className;
  DateTime _from = DateTime.now().subtract(const Duration(days: 6));
  DateTime _to = DateTime.now();

  bool _loading = false;
  List<Map<String, dynamic>> _students = [];
  List<String> _subjects = [];
  // studentId -> subject -> (done, total)
  final Map<String, Map<String, ({int done, int total})>> _counts = {};

  @override
  void initState() {
    super.initState();
    final profile = AuthService.to.profile.value ?? {};
    _className = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : allSchoolClasses.first;
    _load();
  }

  Future<void> _load() async {
    if (_className == null) return;
    setState(() { _loading = true; _students = []; _subjects = []; _counts.clear(); });
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;

    final students = await SupabaseService.fetchClassStudentsByName(_className!);
    final subjects = await SupabaseService.fetchClassSubjects(_className!);
    final rows = (employeeId != null && sessionToken != null)
        ? await SupabaseService.fetchNotebookReport(
            employeeId, sessionToken, _className!,
            DateFormat('yyyy-MM-dd').format(_from),
            DateFormat('yyyy-MM-dd').format(_to),
          )
        : <Map<String, dynamic>>[];

    final counts = <String, Map<String, ({int done, int total})>>{};
    for (final r in rows) {
      final id = r['student_id'] as String?;
      final subject = r['subject'] as String?;
      if (id == null || subject == null) continue;
      final done = (r['checks_done'] as num?)?.toInt() ?? 0;
      final total = (r['checks_total'] as num?)?.toInt() ?? 0;
      counts.putIfAbsent(id, () => {})[subject] = (done: done, total: total);
    }

    if (!mounted) return;
    setState(() {
      _students = students;
      _subjects = subjects;
      _counts.addAll(counts);
      _loading = false;
    });
  }

  ({int done, int total}) _overall(String studentId) {
    final bySubject = _counts[studentId] ?? {};
    var done = 0, total = 0;
    for (final c in bySubject.values) { done += c.done; total += c.total; }
    return (done: done, total: total);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Notebook Report'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(children: [
        _buildFilterBar(),
        const Divider(height: 1, color: AppColors.border),
        Expanded(child: _buildBody()),
      ]),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(children: [
        DropdownButtonFormField<String>(
          initialValue: _className,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder(), isDense: true),
          items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
          onChanged: (v) {
            if (v == null) return;
            setState(() => _className = v);
            _load();
          },
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _dateField('From', _from, (d) {
            setState(() => _from = d);
            _load();
          }, last: _to)),
          const SizedBox(width: 10),
          Expanded(child: _dateField('To', _to, (d) {
            setState(() => _to = d);
            _load();
          }, first: _from)),
        ]),
      ]),
    );
  }

  Widget _dateField(String label, DateTime value, ValueChanged<DateTime> onPicked, {DateTime? first, DateTime? last}) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
          context: context, initialDate: value,
          firstDate: first ?? DateTime.now().subtract(const Duration(days: 365)),
          lastDate: last ?? DateTime.now(),
        );
        if (picked != null) onPicked(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder(), isDense: true),
        child: Text(DateFormat('d MMM yyyy').format(value), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: 6,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(0xFFE2E8F0),
          highlightColor: const Color(0xFFF8FAFC),
          child: Container(height: 72, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
        ),
      );
    }
    if (_students.isEmpty || _subjects.isEmpty) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
            child: const Icon(Icons.auto_stories_rounded, color: AppColors.amber, size: 38),
          ),
          const SizedBox(height: 16),
          Text(_students.isEmpty ? 'No Students Found' : 'No Subjects Configured',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        ]),
      ));
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      itemCount: _students.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final s = _students[i];
        final id = s['id'] as String;
        final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
        final overall = _overall(id);
        final overallMarks = overall.done * _marksPerCheck;
        final overallMax = overall.total * _marksPerCheck;

        return Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppShadows.card,
            border: Border.all(color: AppColors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.navy, AppColors.navyMid],
                      begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(child: Text('${i + 1}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(name.isNotEmpty ? name : '—',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(8)),
                  child: Text('$overallMarks/$overallMax marks',
                    style: const TextStyle(color: AppColors.indigo, fontWeight: FontWeight.w700, fontSize: 12)),
                ),
              ]),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: _subjects.map((subject) {
                final c = _counts[id]?[subject] ?? (done: 0, total: 0);
                final marks = c.done * _marksPerCheck;
                final max = c.total * _marksPerCheck;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text('$subject: $marks/$max',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textLight)),
                );
              }).toList()),
            ]),
          ),
        );
      },
    );
  }
}
