import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

const List<String> _monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const List<String> _weekdayShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Cycled per month card on the Yearly tab - purely decorative, same idea as
// the pastel accent colors used on the dashboard's StatCard grid.
const List<Color> _monthAccents = [
  AppColors.orange, AppColors.teal, AppColors.amber, AppColors.blue, AppColors.pink, AppColors.indigo,
];
const List<Color> _monthAccentLights = [
  AppColors.orangeLight, AppColors.tealLight, AppColors.amberLight, AppColors.blueLight, AppColors.pinkLight, AppColors.indigoLight,
];

// Shared Monthly / Yearly attendance viewer for both the student app's "My
// Attendance" and the teacher app's "My Attendance" - same shape of data
// (a list of {date, status} records, status 'P' or 'A'), same look, so the
// calendar-grid and percent-ring logic isn't built twice. Purely
// presentational - the parent page owns fetching/refreshing `records`.
class AttendanceView extends StatefulWidget {
  final List<Map<String, dynamic>> records;
  const AttendanceView({super.key, required this.records});

  @override
  State<AttendanceView> createState() => _AttendanceViewState();
}

class _AttendanceViewState extends State<AttendanceView> {
  // 0 = Monthly, 1 = Yearly
  int _tab = 0;
  late DateTime _visibleMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month, 1);
  }

  Map<DateTime, String> get _statusByDay {
    final map = <DateTime, String>{};
    for (final r in widget.records) {
      final d = DateTime.tryParse((r['date'] ?? '').toString());
      final s = r['status'] as String?;
      if (d == null || s == null) continue;
      map[DateTime(d.year, d.month, d.day)] = s;
    }
    return map;
  }

  @override
  Widget build(BuildContext context) => Column(children: [
    _buildTabBar(),
    Expanded(child: _tab == 0 ? _MonthlyTab(visibleMonth: _visibleMonth, statusByDay: _statusByDay,
      onChangeMonth: (m) => setState(() => _visibleMonth = m)) : _YearlyTab(records: widget.records)),
  ]);

  Widget _buildTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withOpacity(.08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _tabButton('Monthly', 0)),
        Expanded(child: _tabButton('Yearly', 1)),
      ]),
    ),
  );

  Widget _tabButton(String label, int index) {
    final active = _tab == index;
    return GestureDetector(
      onTap: () => setState(() => _tab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: active ? AppShadows.card : null,
        ),
        child: Center(child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
      ),
    );
  }
}

// ── Monthly: calendar grid + stat tiles for one month ──────────────────────

class _MonthlyTab extends StatelessWidget {
  final DateTime visibleMonth;
  final Map<DateTime, String> statusByDay;
  final ValueChanged<DateTime> onChangeMonth;
  const _MonthlyTab({required this.visibleMonth, required this.statusByDay, required this.onChangeMonth});

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(visibleMonth.year, visibleMonth.month + 1, 0).day;
    final leadingOffset = DateTime(visibleMonth.year, visibleMonth.month, 1).weekday % 7; // Sun=0..Sat=6
    final now = DateTime.now();
    final isCurrentMonth = now.year == visibleMonth.year && now.month == visibleMonth.month;

    int present = 0, absent = 0;
    for (int d = 1; d <= daysInMonth; d++) {
      final status = statusByDay[DateTime(visibleMonth.year, visibleMonth.month, d)];
      if (status == 'P') present++;
      if (status == 'A') absent++;
    }
    final marked = present + absent;
    final presentPct = marked == 0 ? 0.0 : present / marked * 100;
    final absentPct  = marked == 0 ? 0.0 : absent / marked * 100;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), boxShadow: AppShadows.card),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              IconButton(
                onPressed: () => onChangeMonth(DateTime(visibleMonth.year, visibleMonth.month - 1)),
                icon: const Icon(Icons.chevron_left_rounded, color: AppColors.navy),
              ),
              Text('${_monthNames[visibleMonth.month - 1]} ${visibleMonth.year}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
              IconButton(
                onPressed: isCurrentMonth ? null : () => onChangeMonth(DateTime(visibleMonth.year, visibleMonth.month + 1)),
                icon: Icon(Icons.chevron_right_rounded, color: isCurrentMonth ? AppColors.textHint : AppColors.navy),
              ),
            ]),
            const SizedBox(height: 4),
            Row(children: _weekdayShort.map((w) => Expanded(
              child: Center(child: Text(w, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textLight))),
            )).toList()),
            const SizedBox(height: 6),
            GridView.count(
              crossAxisCount: 7,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                ...List.generate(leadingOffset, (_) => const SizedBox()),
                ...List.generate(daysInMonth, (i) {
                  final day = i + 1;
                  final isToday = isCurrentMonth && now.day == day;
                  final status = statusByDay[DateTime(visibleMonth.year, visibleMonth.month, day)];
                  final dotColor = status == 'P' ? AppColors.green : status == 'A' ? AppColors.red : null;
                  return Container(
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
                        height: 5, width: 5,
                        child: dotColor == null ? null : DecoratedBox(
                          decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                        ),
                      ),
                    ]),
                  );
                }),
              ],
            ),
          ]),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.05,
          children: [
            _statTile('$present', 'Present', AppColors.green, AppColors.greenLight),
            _statTile('${presentPct.toStringAsFixed(0)}%', 'Present %', AppColors.green, AppColors.greenLight),
            _statTile('$marked', 'Marked Days', AppColors.amber, AppColors.amberLight),
            _statTile('$absent', 'Absent', AppColors.red, AppColors.redLight),
            _statTile('${absentPct.toStringAsFixed(0)}%', 'Absent %', AppColors.red, AppColors.redLight),
            _statTile('$daysInMonth', 'Days in Month', AppColors.navy, AppColors.blueLight),
          ],
        ),
      ],
    );
  }

  Widget _statTile(String value, String label, Color color, Color bg) => Container(
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 2),
      Text(label, textAlign: TextAlign.center,
        style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w600)),
    ]),
  );
}

// ── Yearly: one card per month with a percent ring ──────────────────────────

class _YearlyTab extends StatelessWidget {
  final List<Map<String, dynamic>> records;
  const _YearlyTab({required this.records});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    DateTime earliest = DateTime(now.year, now.month, 1);
    for (final r in records) {
      final d = DateTime.tryParse((r['date'] ?? '').toString());
      if (d != null) {
        final monthStart = DateTime(d.year, d.month, 1);
        if (monthStart.isBefore(earliest)) earliest = monthStart;
      }
    }
    final currentMonthStart = DateTime(now.year, now.month, 1);

    final months = <DateTime>[];
    var cursor = earliest;
    while (!cursor.isAfter(currentMonthStart)) {
      months.add(cursor);
      cursor = DateTime(cursor.year, cursor.month + 1, 1);
    }

    if (months.isEmpty) {
      return const Center(child: Text('No attendance records yet.', style: TextStyle(color: AppColors.textLight)));
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: months.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) {
        final month = months[i];
        final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
        int present = 0, absent = 0;
        final absentDates = <int>[];
        for (final r in records) {
          final d = DateTime.tryParse((r['date'] ?? '').toString());
          if (d == null || d.year != month.year || d.month != month.month) continue;
          final s = r['status'] as String?;
          if (s == 'P') present++;
          if (s == 'A') { absent++; absentDates.add(d.day); }
        }
        absentDates.sort();
        final marked = present + absent;
        final pct = marked == 0 ? 0.0 : present / marked * 100;
        final accent = _monthAccents[i % _monthAccents.length];
        final accentLight = _monthAccentLights[i % _monthAccentLights.length];

        return Container(
          decoration: BoxDecoration(
            color: accentLight,
            borderRadius: BorderRadius.circular(16),
            border: Border(left: BorderSide(color: accent, width: 4)),
          ),
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${_monthNames[month.month - 1]} ${month.year}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
              const SizedBox(height: 6),
              Text('Present Days: $present', style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
              Text('Absent Days: $absent', style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
              Text('Absent Dates: ${absentDates.isEmpty ? '-' : absentDates.join(', ')}',
                style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
              Text('$daysInMonth days this month', style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
            ])),
            const SizedBox(width: 12),
            _PercentRing(percent: pct, color: accent),
          ]),
        );
      },
    );
  }
}

class _PercentRing extends StatelessWidget {
  final double percent;
  final Color color;
  const _PercentRing({required this.percent, required this.color});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 64, height: 64,
    child: Stack(alignment: Alignment.center, children: [
      SizedBox(
        width: 64, height: 64,
        child: CircularProgressIndicator(
          value: percent / 100,
          strokeWidth: 6,
          backgroundColor: color.withOpacity(.2),
          valueColor: AlwaysStoppedAnimation(color),
        ),
      ),
      Text('${percent.toStringAsFixed(0)}%',
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
    ]),
  );
}
