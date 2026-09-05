import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/timetable_view.dart';

// Read-only: shows this teacher's own schedule - for each period, which
// class they need to be teaching (or free), built entirely from what the
// admin panel's Settings → Timetable has published. Matched by name against
// the timetable grid's free-text teacher field (no teacher_id FK there).
class TeacherTimetablePage extends StatefulWidget {
  final bool embedded;
  const TeacherTimetablePage({super.key, this.embedded = false});
  @override
  State<TeacherTimetablePage> createState() => _TeacherTimetablePageState();
}

class _TeacherTimetablePageState extends State<TeacherTimetablePage> {
  Map<String, dynamic>? _periodDefs;
  Map<String, dynamic>? _dayGroupWeekdays;
  Map<String, List<Map<String, dynamic>>> _rowsByGroupSlot = {};
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile      = AuthService.to.profile.value ?? {};
    final teacherName  = profile['name'] as String? ?? '';

    final year = await SupabaseService.fetchCurrentAcademicYearLabel();
    final defs = await SupabaseService.fetchPeriodDefs();
    final weekdaysMap = await SupabaseService.fetchDayGroupWeekdays();
    final rows = (year != null && teacherName.isNotEmpty)
        ? await SupabaseService.fetchTimetableForTeacher(year, teacherName)
        : <Map<String, dynamic>>[];

    // A merged teacher genuinely has two rows for the same group+slot (one
    // per merged class) - appending (not overwriting) so both show up
    // instead of one silently replacing the other.
    final map = <String, List<Map<String, dynamic>>>{};
    for (final r in rows) {
      map.putIfAbsent('${r['day_group']}|${r['slot_id']}', () => []).add(r);
    }
    if (mounted) {
      setState(() {
      _periodDefs = defs;
      _dayGroupWeekdays = weekdaysMap;
      _rowsByGroupSlot = map;
      _loading = false;
    });
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : TimetableView(
            periodDefs: _periodDefs,
            dayGroupWeekdays: _dayGroupWeekdays,
            rowsByGroupSlot: _rowsByGroupSlot,
            buildFilled: (rows) {
              final classNames = rows.map((r) => (r['class_name'] ?? '').toString()).where((c) => c.isNotEmpty).join(' & ');
              final subject = (rows.first['subject'] ?? '').toString();
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Class $classNames',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
                if (subject.isNotEmpty)
                  Text(subject, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
              ]);
            },
            buildEmpty: () => const Text('Free — not teaching', style: TextStyle(fontSize: 13, color: AppColors.textHint, fontStyle: FontStyle.italic)),
          );

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Timetable'),
      ),
      body: body,
    );
  }
}
