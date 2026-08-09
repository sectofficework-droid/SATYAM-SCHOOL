// Working-day / holiday rule for student attendance marking - derived
// entirely from school_calendar_events (SupabaseService.fetchCalendarEvents),
// the same data Year Planning already manages, no separate schema needed.
//
// Sunday defaults to non-working. A 'working_day' event on a specific date
// overrides that default (and any 'holiday'/'govt' event on the same date),
// so admin can open a particular Sunday - or any other date - back up for
// attendance by adding one event in Year Planning.
bool isWorkingDay(DateTime date, List<Map<String, dynamic>> calendarEvents) {
  final onDate = _eventsOn(date, calendarEvents);
  if (onDate.any((e) => e['category'] == 'working_day')) return true;
  if (date.weekday == DateTime.sunday) return false;
  if (onDate.any((e) => e['category'] == 'holiday' || e['category'] == 'govt')) return false;
  return true;
}

// Short label for the blocking message - the specific holiday event's
// title if there is one, else a generic "Sunday" fallback.
String nonWorkingReason(DateTime date, List<Map<String, dynamic>> calendarEvents) {
  final holidayEvents = _eventsOn(date, calendarEvents)
      .where((e) => e['category'] == 'holiday' || e['category'] == 'govt');
  if (holidayEvents.isNotEmpty) {
    return (holidayEvents.first['title'] ?? 'Holiday').toString();
  }
  return 'Sunday';
}

Iterable<Map<String, dynamic>> _eventsOn(DateTime date, List<Map<String, dynamic>> calendarEvents) {
  return calendarEvents.where((e) {
    final d = DateTime.tryParse((e['event_date'] ?? '').toString());
    return d != null && d.year == date.year && d.month == date.month && d.day == date.day;
  });
}
