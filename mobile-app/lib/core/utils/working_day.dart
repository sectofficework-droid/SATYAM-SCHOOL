// Working-day / holiday rule for student attendance marking - derived
// entirely from school_calendar_events (SupabaseService.fetchCalendarEvents),
// the same data Year Planning already manages, no separate schema needed.
//
// Sunday defaults to non-working. A 'working_day' event on a specific date
// overrides that default (and any 'holiday'/'govt' event on the same date),
// so admin can open a particular Sunday - or any other date - back up for
// attendance by adding one event in Year Planning.
//
// An event can optionally be scoped to specific classes via
// applies_to_classes (set from the admin panel's Attendance > Holidays tab,
// see SUPABASE_CALENDAR_CLASS_SCOPE.sql) - null/empty means every class,
// same as before that column existed. Pass className to respect scoping;
// omit it (or pass null) to fall back to "does this event apply at all",
// which is what any call site not yet updated for per-class scoping gets.
bool isWorkingDay(DateTime date, List<Map<String, dynamic>> calendarEvents, [String? className]) {
  final onDate = _eventsOn(date, calendarEvents).where((e) => _appliesToClass(e, className));
  if (onDate.any((e) => e['category'] == 'working_day')) return true;
  if (date.weekday == DateTime.sunday) return false;
  if (onDate.any((e) => e['category'] == 'holiday' || e['category'] == 'govt')) return false;
  return true;
}

// Short label for the blocking message - the specific holiday event's
// title if there is one, else a generic "Sunday" fallback.
String nonWorkingReason(DateTime date, List<Map<String, dynamic>> calendarEvents, [String? className]) {
  final holidayEvents = _eventsOn(date, calendarEvents)
      .where((e) => _appliesToClass(e, className))
      .where((e) => e['category'] == 'holiday' || e['category'] == 'govt');
  if (holidayEvents.isNotEmpty) {
    return (holidayEvents.first['title'] ?? 'Holiday').toString();
  }
  return 'Sunday';
}

bool _appliesToClass(Map<String, dynamic> event, String? className) {
  final scope = event['applies_to_classes'];
  if (scope is! List || scope.isEmpty) return true;
  if (className == null) return true; // no class context to check against - don't filter
  return scope.contains(className);
}

Iterable<Map<String, dynamic>> _eventsOn(DateTime date, List<Map<String, dynamic>> calendarEvents) {
  return calendarEvents.where((e) {
    final d = DateTime.tryParse((e['event_date'] ?? '').toString());
    return d != null && d.year == date.year && d.month == date.month && d.day == date.day;
  });
}
