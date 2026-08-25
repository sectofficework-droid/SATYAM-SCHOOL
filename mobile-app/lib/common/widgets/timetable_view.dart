import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

const List<String> _weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const List<String> _weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The admin panel's Timetable tab only defines 3 independent schedules
// (Mon–Wed / Thu–Fri / Saturday all share the same slots within themselves),
// not one per weekday - this maps the weekday the user picks down to
// whichever of those 3 day-groups actually holds its period definitions.
const Map<String, String> _weekdayToGroup = {
  'Monday': 'Mon – Wed', 'Tuesday': 'Mon – Wed', 'Wednesday': 'Mon – Wed',
  'Thursday': 'Thu – Fri', 'Friday': 'Thu – Fri',
  'Saturday': 'Saturday',
};

// Shared Timetable viewer for both apps - same weekday picker and period
// list, but what a period shows (subject+teacher for a student, class+
// subject for a teacher) is entirely up to the caller via buildFilled/
// buildEmpty, since that's the one thing that differs between them.
class TimetableView extends StatefulWidget {
  final Map<String, dynamic>? periodDefs;
  // Keyed "$dayGroup|$slotId" -> that slot's row (subject/teacher/class_name/...).
  final Map<String, Map<String, dynamic>> rowsByGroupSlot;
  final Widget Function(Map<String, dynamic> row) buildFilled;
  final Widget Function() buildEmpty;

  const TimetableView({
    super.key,
    required this.periodDefs,
    required this.rowsByGroupSlot,
    required this.buildFilled,
    required this.buildEmpty,
  });

  @override
  State<TimetableView> createState() => _TimetableViewState();
}

class _TimetableViewState extends State<TimetableView> {
  late String _selectedWeekday;

  @override
  void initState() {
    super.initState();
    // Defaults to today's schedule. If today is Sunday (no school), roll
    // forward to Monday instead of a blank day.
    final todayIndex = DateTime.now().weekday; // Mon=1 .. Sun=7
    _selectedWeekday = (todayIndex >= 1 && todayIndex <= 6) ? _weekdays[todayIndex - 1] : _weekdays.first;
  }

  @override
  Widget build(BuildContext context) {
    final group = _weekdayToGroup[_selectedWeekday]!;
    final slots = List<Map<String, dynamic>>.from(widget.periodDefs?[group] ?? const []);

    return Column(children: [
      _buildWeekdayChips(),
      Expanded(
        child: slots.isEmpty
            ? _emptyState()
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                itemCount: slots.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _slotTile(group, slots[i]),
              ),
      ),
    ]);
  }

  Widget _buildWeekdayChips() => SizedBox(
    height: 56,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      itemCount: _weekdays.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (_, i) {
        final day = _weekdays[i];
        final active = _selectedWeekday == day;
        return GestureDetector(
          onTap: () => setState(() => _selectedWeekday = day),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 52,
            decoration: BoxDecoration(
              color: active ? AppColors.navy : AppColors.card,
              borderRadius: BorderRadius.circular(12),
              boxShadow: active ? AppShadows.card : null,
              border: active ? null : Border.all(color: AppColors.border),
            ),
            child: Center(child: Text(_weekdayShort[i],
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
          ),
        );
      },
    ),
  );

  String _fmtTime(String? t) {
    if (t == null || t.isEmpty) return '';
    final parts = t.split(':');
    if (parts.length < 2) return t;
    return '${int.tryParse(parts[0]) ?? parts[0]}:${parts[1]}';
  }

  Widget _slotTile(String group, Map<String, dynamic> slot) {
    final isBreak = slot['isBreak'] == true;
    final label = (slot['label'] ?? '') as String;
    final timeRange = '${_fmtTime(slot['startTime'] as String?)} – ${_fmtTime(slot['endTime'] as String?)}';

    if (isBreak) {
      final isPrayer = label.toLowerCase().contains('prayer');
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.amberLight,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(children: [
          isPrayer
              ? const Text('🙏', style: TextStyle(fontSize: 16))
              : const Icon(Icons.free_breakfast_rounded, size: 16, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.amber))),
          Text(timeRange, style: const TextStyle(fontSize: 11.5, color: AppColors.amber, fontWeight: FontWeight.w600)),
        ]),
      );
    }

    final row = widget.rowsByGroupSlot['$group|${slot['id']}'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        Container(
          width: 50,
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(10)),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_fmtTime(slot['startTime'] as String?), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
            const Text('–', style: TextStyle(fontSize: 9, color: AppColors.textHint)),
            Text(_fmtTime(slot['endTime'] as String?), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(child: row != null ? widget.buildFilled(row) : widget.buildEmpty()),
      ]),
    );
  }

  Widget _emptyState() => const Center(child: Padding(
    padding: EdgeInsets.all(32),
    child: Text('No timetable published yet.', style: TextStyle(fontSize: 13, color: AppColors.textLight)),
  ));
}
