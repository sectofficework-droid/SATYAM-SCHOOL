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
