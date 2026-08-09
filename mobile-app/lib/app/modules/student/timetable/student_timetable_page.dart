import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/timetable_view.dart';

// Read-only: shows this student's own class's weekly schedule, built
// entirely from what the admin panel's Settings → Timetable has published.
class StudentTimetablePage extends StatefulWidget {
  final bool embedded;
  const StudentTimetablePage({super.key, this.embedded = false});
  @override
  State<StudentTimetablePage> createState() => _StudentTimetablePageState();
}

class _StudentTimetablePageState extends State<StudentTimetablePage> {
  Map<String, dynamic>? _periodDefs;
  Map<String, Map<String, dynamic>> _rowsByGroupSlot = {};
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String? ?? '';

    final year = await SupabaseService.fetchCurrentAcademicYearLabel();
    final defs = await SupabaseService.fetchPeriodDefs();
    final rows = (year != null && className.isNotEmpty)
        ? await SupabaseService.fetchTimetableForClass(year, className)
        : <Map<String, dynamic>>[];

    final map = <String, Map<String, dynamic>>{};
    for (final r in rows) {
      map['${r['day_group']}|${r['slot_id']}'] = r;
    }
    if (mounted) setState(() { _periodDefs = defs; _rowsByGroupSlot = map; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : TimetableView(
            periodDefs: _periodDefs,
            rowsByGroupSlot: _rowsByGroupSlot,
            // Teacher name intentionally not shown to students here.
            buildFilled: (row) => Text((row['subject'] ?? '').toString().isEmpty ? 'Free Period' : row['subject'],
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
            buildEmpty: () => const Text('Free Period', style: TextStyle(fontSize: 13, color: AppColors.textHint, fontStyle: FontStyle.italic)),
          );

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Timetable'),
      ),
      body: body,
    );
  }
}
