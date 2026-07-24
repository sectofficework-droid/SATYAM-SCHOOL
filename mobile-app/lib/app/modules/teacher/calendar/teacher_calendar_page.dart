import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/year_plan_categories.dart';

const List<String> _monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const List<String> _weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class TeacherCalendarPage extends StatefulWidget {
  const TeacherCalendarPage({super.key});
  @override
  State<TeacherCalendarPage> createState() => _TeacherCalendarPageState();
}

class _TeacherCalendarPageState extends State<TeacherCalendarPage> {
  late DateTime _visibleMonth;
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month, 1);
    _loadMonth();
  }

  Future<void> _loadMonth() async {
    setState(() => _loading = true);
    final rangeStart = _visibleMonth;
    final rangeEnd = DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0);
    final events = await SupabaseService.fetchCalendarEvents(rangeStart, rangeEnd);
    if (mounted) setState(() { _events = events; _loading = false; });
  }

  void _changeMonth(int delta) {
    setState(() => _visibleMonth = DateTime(_visibleMonth.year, _visibleMonth.month + delta, 1));
    _loadMonth();
  }

  List<Map<String, dynamic>> _eventsOn(int day) => _events.where((e) {
    final d = DateTime.tryParse(e['event_date'] ?? '');
    return d != null && d.day == day;
  }).toList();

  void _showDaySheet(int day) {
    final date = DateTime(_visibleMonth.year, _visibleMonth.month, day);
    final dayEvents = _eventsOn(day);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            Text('${date.day} ${_monthNames[date.month - 1]} ${date.year}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
            const SizedBox(height: 16),
            if (dayEvents.isEmpty)
              const Text('Nothing marked on this day.', style: TextStyle(fontSize: 13, color: AppColors.textLight))
            else
              ...dayEvents.map((e) {
                final cat = categoryFor(e['category'] as String?);
                return _sheetRow(cat.icon, cat.color, e['title'] ?? '', cat.label);
              }),
          ],
        ),
      ),
    );
  }

  Widget _sheetRow(IconData icon, Color color, String title, String subtitle) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(children: [
      Container(
        width: 38, height: 38,
        decoration: BoxDecoration(color: color.withOpacity(.12), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: color, size: 18),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
        Text(subtitle, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
      ])),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final firstDay = _visibleMonth;
    final daysInMonth = DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0).day;
    final leadingOffset = firstDay.weekday % 7; // Sun=0 .. Sat=6
    final now = DateTime.now();
    final isCurrentMonth = now.year == _visibleMonth.year && now.month == _visibleMonth.month;

    final categoriesThisMonth = <String>{ for (final e in _events) (e['category'] as String?) ?? 'holiday' };

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Calendar'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), boxShadow: AppShadows.card),
            child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                IconButton(onPressed: () => _changeMonth(-1), icon: const Icon(Icons.chevron_left_rounded, color: AppColors.navy)),
                Text('${_monthNames[_visibleMonth.month - 1]} ${_visibleMonth.year}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                IconButton(onPressed: () => _changeMonth(1), icon: const Icon(Icons.chevron_right_rounded, color: AppColors.navy)),
              ]),
              const SizedBox(height: 8),
              Row(children: _weekdayShort.map((w) => Expanded(
                child: Center(child: Text(w, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textLight))),
              )).toList()),
              const SizedBox(height: 6),
              if (_loading)
                const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
              else
                GridView.count(
                  crossAxisCount: 7,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    ...List.generate(leadingOffset, (_) => const SizedBox()),
                    ...List.generate(daysInMonth, (i) {
                      final day = i + 1;
                      final isToday = isCurrentMonth && now.day == day;
                      final dayEvents = _eventsOn(day);
                      final dotColors = dayEvents.map((e) => categoryFor(e['category'] as String?).color).toSet().toList();
                      return GestureDetector(
                        onTap: () => _showDaySheet(day),
                        child: Container(
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: isToday ? AppColors.navy : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text('$day', style: TextStyle(
                              fontSize: 13, fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                              color: isToday ? Colors.white : AppColors.text,
                            )),
                            const SizedBox(height: 2),
                            SizedBox(
                              height: 5,
                              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: dotColors.take(3).map((c) => Container(
                                width: 4, height: 4, margin: const EdgeInsets.symmetric(horizontal: 1),
                                decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                              )).toList()),
                            ),
                          ]),
                        ),
                      );
                    }),
                  ],
                ),
            ]),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), boxShadow: AppShadows.card),
            child: Wrap(spacing: 16, runSpacing: 10, children: [
              for (final cat in yearPlanCategories)
                if (categoriesThisMonth.contains(cat.key))
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: cat.color, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text(cat.label, style: const TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w600)),
                  ]),
              if (categoriesThisMonth.isEmpty)
                const Text('Nothing marked this month.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
            ]),
          ),
        ],
      ),
    );
  }
}
