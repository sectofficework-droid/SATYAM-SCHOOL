import 'package:intl/intl.dart';
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

// Adapts a task_assignees row (as returned by SupabaseService.fetchTeacherTasks
// - {task_id, status, task: {...}}) into the same shape as a notice, so a
// newly assigned task can appear in the same notification bell/panel as
// Notices instead of only being visible on the separate My Tasks screen.
// "Recent" is judged by the task's own created_at, since task_assignees has
// no per-assignee assigned-at timestamp of its own to go by.
Map<String, dynamic> taskAsNoticeItem(Map<String, dynamic> assignment) {
  final task = Map<String, dynamic>.from(assignment['task'] ?? {});
  final taskId = assignment['task_id'] ?? task['id'];
  return {
    'id': 'task-$taskId',
    'title': task['title'] ?? '',
    'content': task['description'] ?? '',
    'type': 'Task',
    'posted_date': task['created_at'],
    'created_at': task['created_at'],
    '_isTask': true,
    '_taskId': taskId,
  };
}

// Monthly Test rows (exams table) due within `days` of today, adapted into
// notice-shaped items for the same bell/popup Notices/Tasks/Alerts already
// share. posted_date is stamped to "now" at call time rather than a stored
// value, so recentNotices()'s existing 24h-recency filter naturally
// re-admits the same reminder every day the test stays inside the window,
// and it stops appearing on its own once the test falls outside it or the
// date passes - no server-side cron/scheduling needed.
List<Map<String, dynamic>> monthlyTestReminders(List<Map<String, dynamic>> exams, {int days = 7}) {
  final now      = DateTime.now();
  final today    = DateTime(now.year, now.month, now.day);
  final nowIso   = now.toIso8601String();
  return exams.where((e) {
    final d = DateTime.tryParse(e['date'] ?? '');
    if (d == null) return false;
    final diff = DateTime(d.year, d.month, d.day).difference(today).inDays;
    return diff >= 0 && diff <= days;
  }).map((e) {
    final d = DateTime.parse(e['date'] as String);
    return {
      'id': 'monthlytest-${e['id']}',
      'title': 'Upcoming Monthly Test: ${e['name'] ?? ''}',
      'content': '${e['subject'] ?? ''} · Class ${e['class'] ?? ''} · ${DateFormat('d MMM').format(d)}',
      'type': 'Exam',
      'posted_date': nowIso,
      'created_at': nowIso,
      '_isExam': true,
    };
  }).toList();
}

// Same idea for Main Exams (official_exams table) - keyed off start_date
// (falling back to end_date for single-day exams that predate start_date).
List<Map<String, dynamic>> officialExamReminders(List<Map<String, dynamic>> exams, {int days = 7}) {
  final now    = DateTime.now();
  final today  = DateTime(now.year, now.month, now.day);
  final nowIso = now.toIso8601String();
  return exams.where((e) {
    final raw = (e['start_date'] ?? e['end_date']) as String?;
    final d = DateTime.tryParse(raw ?? '');
    if (d == null) return false;
    final diff = DateTime(d.year, d.month, d.day).difference(today).inDays;
    return diff >= 0 && diff <= days;
  }).map((e) {
    final raw = (e['start_date'] ?? e['end_date']) as String;
    final d = DateTime.parse(raw);
    return {
      'id': 'officialexam-${e['id']}',
      'title': 'Upcoming Exam: ${e['name'] ?? ''}',
      'content': 'Starts ${DateFormat('d MMM').format(d)}',
      'type': 'Exam',
      'posted_date': nowIso,
      'created_at': nowIso,
      '_isExam': true,
    };
  }).toList();
}

// Adapts a teacher_alerts row into the same shape as a notice - same reasoning
// as taskAsNoticeItem above, so a targeted admin alert (attendance reminder,
// or "your edit request was approved") shows up in the one shared notice bell
// instead of needing its own separate inbox screen.
Map<String, dynamic> alertAsNoticeItem(Map<String, dynamic> alert) {
  return {
    'id': 'alert-${alert['id']}',
    'title': alert['title'] ?? '',
    'content': alert['message'] ?? '',
    'type': 'Alert',
    'posted_date': alert['created_at'],
    'created_at': alert['created_at'],
    '_isAlert': true,
  };
}
