import 'package:shared_preferences/shared_preferences.dart';

// Notices posted (or, for older rows with no posted_date, created) within
// the last 24 hours - used for the header bell badge and the on-open popup.
List<Map<String, dynamic>> recentNotices(List<Map<String, dynamic>> notices, {Duration window = const Duration(hours: 24)}) {
  final cutoff = DateTime.now().subtract(window);
  return notices.where((n) {
    final raw = (n['posted_date'] ?? n['created_at']) as String?;
    if (raw == null) return false;
    final d = DateTime.tryParse(raw);
    return d != null && d.isAfter(cutoff);
  }).toList();
}

// The on-open recent-notices popup should only appear once per calendar day
// per user, not on every app launch/hot-reload. storageKey should include
// the logged-in user's id (e.g. 'notif_popup_shown_teacher_<employeeId>') so
// different accounts on the same device each get their own once-a-day popup.
Future<bool> shouldShowNoticePopupToday(String storageKey) async {
  final prefs = await SharedPreferences.getInstance();
  final today = DateTime.now().toIso8601String().substring(0, 10); // yyyy-MM-dd
  final lastShown = prefs.getString(storageKey);
  if (lastShown == today) return false;
  await prefs.setString(storageKey, today);
  return true;
}

// Swiped-away notices stay dismissed for the rest of the day - the key
// bakes in today's date, so it naturally "resets" once the notice would
// have rolled out of the 24h window anyway; no explicit cleanup needed.
String _dismissedKey(String userKey) =>
    'dismissed_notices_${userKey}_${DateTime.now().toIso8601String().substring(0, 10)}';

Future<Set<String>> getDismissedNoticeIds(String userKey) async {
  final prefs = await SharedPreferences.getInstance();
  return (prefs.getStringList(_dismissedKey(userKey)) ?? const []).toSet();
}

Future<void> dismissNotice(String userKey, String noticeId) async {
  final prefs = await SharedPreferences.getInstance();
  final key = _dismissedKey(userKey);
  final ids = (prefs.getStringList(key) ?? const []).toSet()..add(noticeId);
  await prefs.setStringList(key, ids.toList());
}

// Convenience: recent notices minus whatever's already been swiped away today.
Future<List<Map<String, dynamic>>> visibleRecentNotices(
  List<Map<String, dynamic>> notices,
  String userKey,
) async {
  final recent    = recentNotices(notices);
  final dismissed = await getDismissedNoticeIds(userKey);
  return recent.where((n) => !dismissed.contains('${n['id']}')).toList();
}
