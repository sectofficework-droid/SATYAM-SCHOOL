import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../../app_bootstrap.dart';
import 'auth_service.dart';

// Dart equivalents of admin-panel/src/lib/s3Upload.js's uploadFileToS3/
// getS3ViewUrl - the mobile app has never uploaded to S3 directly (only read
// via presigned view URLs), so this calls the admin panel's existing
// /api/s3/upload and /api/s3/view-url routes over plain HTTP instead of
// embedding AWS credentials in the Flutter app. Both routes already run
// server-side with real credentials; question-bank/ was added to their
// isAllowedKey() prefix allowlist alongside students/, employees/, etc.
//
// REQ-SEC-013: both routes used to accept any caller with no auth at all.
// They now require either an admin session (the admin-panel's own caller)
// or this app's own employeeId+sessionToken, verified server-side against
// mobile_sessions via verify_mobile_session - same identity proof already
// required by every staff_admin_* RPC.
class S3UploadService {
  static Future<String> uploadToS3(Uint8List bytes, String key, String filename) async {
    final employeeId = AuthService.to.profile.value?['id'] as String? ?? '';
    final sessionToken = AuthService.to.sessionToken ?? '';
    final uri = Uri.parse('$adminPanelUrl/api/s3/upload');
    final request = http.MultipartRequest('POST', uri)
      ..fields['key'] = key
      ..fields['employeeId'] = employeeId
      ..fields['sessionToken'] = sessionToken
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode != 200) {
      Map<String, dynamic>? body;
      try { body = jsonDecode(response.body) as Map<String, dynamic>; } catch (_) {}
      throw Exception(body?['error'] ?? 'Upload failed (${response.statusCode})');
    }
    return key;
  }

  static Future<String?> getS3ViewUrl(String key) async {
    final employeeId = AuthService.to.profile.value?['id'] as String? ?? '';
    final sessionToken = AuthService.to.sessionToken ?? '';
    final uri = Uri.parse(
      '$adminPanelUrl/api/s3/view-url?key=${Uri.encodeComponent(key)}'
      '&employeeId=${Uri.encodeComponent(employeeId)}'
      '&sessionToken=${Uri.encodeComponent(sessionToken)}',
    );
    final response = await http.get(uri);
    if (response.statusCode != 200) return null;
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['viewUrl'] as String?;
  }
}
