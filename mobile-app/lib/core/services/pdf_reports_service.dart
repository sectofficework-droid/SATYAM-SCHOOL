import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../app_bootstrap.dart';

// Calls the admin-panel's new server-side PDF report routes
// (admin-panel/src/app/api/reports/*) and returns the raw PDF bytes for the
// caller to share/save via Printing.sharePdf. Mirrors this project's mobile
// trust model: employeeId is re-verified server-side via staff_admin_tier()
// — see admin-panel/src/lib/reportsServerAuth.js.
// REQ-SEC-014 (2026-10-04): sessionToken is now also required and verified
// server-side (verify_mobile_session) before the employeeId is trusted at
// all - previously anyone who obtained/guessed a valid employee ID could
// call these routes directly and receive PDFs with Aadhaar/DOB/salary data.
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

  static Future<List<int>> idCard(String employeeId, String sessionToken, List<String> studentIds) =>
      _post('id-card', {'employeeId': employeeId, 'sessionToken': sessionToken, 'studentIds': studentIds});

  static Future<List<int>> bonafide(String employeeId, String sessionToken, List<String> studentIds) =>
      _post('bonafide', {'employeeId': employeeId, 'sessionToken': sessionToken, 'studentIds': studentIds});

  static Future<List<int>> tc(String employeeId, String sessionToken, String studentId) =>
      _post('tc', {'employeeId': employeeId, 'sessionToken': sessionToken, 'studentId': studentId});

  static Future<List<int>> marksheet(String employeeId, String sessionToken, String studentId, String className) =>
      _post('marksheet', {'employeeId': employeeId, 'sessionToken': sessionToken, 'studentId': studentId, 'className': className});

  static Future<List<int>> attendance(String employeeId, String sessionToken, String fromDate, String toDate) =>
      _post('attendance', {'employeeId': employeeId, 'sessionToken': sessionToken, 'fromDate': fromDate, 'toDate': toDate});

  static Future<List<int>> salary(String employeeId, String sessionToken, [String? month]) =>
      _post('salary', {'employeeId': employeeId, 'sessionToken': sessionToken, 'month': month});
}
