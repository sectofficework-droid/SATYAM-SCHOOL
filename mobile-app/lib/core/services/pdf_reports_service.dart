import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../app_bootstrap.dart';

// Calls the admin-panel's new server-side PDF report routes
// (admin-panel/src/app/api/reports/*) and returns the raw PDF bytes for the
// caller to share/save via Printing.sharePdf. Mirrors this project's mobile
// trust model: employeeId is sent as-is, re-verified server-side via
// staff_admin_tier() — see admin-panel/src/lib/reportsServerAuth.js.
class PdfReportsService {
  static Uri _u(String path) => Uri.parse('$adminPanelUrl/api/reports/$path');

  static Future<List<int>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(_u(path), headers: {'Content-Type': 'application/json'}, body: jsonEncode(body));
    if (res.statusCode != 200) {
      String msg = 'Failed to generate report (${res.statusCode})';
      try { msg = (jsonDecode(res.body) as Map)['error'] as String? ?? msg; } catch (_) {}
      throw Exception(msg);
    }
    return res.bodyBytes;
  }

  static Future<List<int>> idCard(String employeeId, List<String> studentIds) =>
      _post('id-card', {'employeeId': employeeId, 'studentIds': studentIds});

  static Future<List<int>> bonafide(String employeeId, List<String> studentIds) =>
      _post('bonafide', {'employeeId': employeeId, 'studentIds': studentIds});

  static Future<List<int>> tc(String employeeId, String studentId) =>
      _post('tc', {'employeeId': employeeId, 'studentId': studentId});

  static Future<List<int>> marksheet(String employeeId, String studentId, String className) =>
      _post('marksheet', {'employeeId': employeeId, 'studentId': studentId, 'className': className});

  static Future<List<int>> attendance(String employeeId, String fromDate, String toDate) =>
      _post('attendance', {'employeeId': employeeId, 'fromDate': fromDate, 'toDate': toDate});

  static Future<List<int>> salary(String employeeId, [String? month]) =>
      _post('salary', {'employeeId': employeeId, 'month': month});
}
