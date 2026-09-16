import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/supabase_service.dart';
import '../../core/utils/diagnostic_logger.dart';

// Shared "Report a Problem" dialog (AGENTS.md §L, REQ-HYG-006 Phase 1.5).
// Replaces the earlier local-only "Diagnostic Log" viewer - the tester
// reports the problem, they don't have to read or explain a log; the
// recent structured entries go straight to Supabase's diagnostic_reports
// table where the admin panel and an AI agent (via this project's
// Supabase MCP connection) can retrieve them directly.
Future<void> showReportProblemDialog(
  BuildContext context, {
  required String app, // 'teacher' | 'student' | 'attendance'
  String? userType,
  String? userId,
  String? userName,
}) {
  final controller = TextEditingController();
  var submitting = false;

  return showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (dialogContext, setDialogState) {
        return AlertDialog(
          title: const Text('Report a Problem'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('What happened? (optional)',
                    style: TextStyle(fontSize: 13, color: AppColors.textHint)),
                const SizedBox(height: 8),
                TextField(
                  controller: controller,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    hintText: 'e.g. tapped Submit and nothing happened',
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Recent app activity is sent automatically so support can '
                  'see what led up to this - no need to describe it in detail.',
                  style: TextStyle(fontSize: 11, color: AppColors.textHint),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setDialogState(() => submitting = true);
                      try {
                        final info = await PackageInfo.fromPlatform();
                        final id = await SupabaseService.submitDiagnosticReport({
                          'app': app,
                          'platform': defaultTargetPlatform.name,
                          'version': '${info.version}+${info.buildNumber}',
                          'session_id': DiagnosticLogger.instance.sessionId,
                          'user_type': userType,
                          'user_id': userId,
                          'user_name': userName,
                          'description': controller.text.trim().isEmpty ? null : controller.text.trim(),
                          'log_entries': DiagnosticLogger.instance.buffer,
                        });
                        if (dialogContext.mounted) {
                          Navigator.pop(dialogContext);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Reported — Ref #${id.substring(0, 8)}')),
                          );
                        }
                      } catch (e) {
                        DiagnosticLogger.instance.error(
                          'Failed to submit diagnostic report',
                          {'error': e.toString()},
                        );
                        if (dialogContext.mounted) {
                          setDialogState(() => submitting = false);
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            const SnackBar(
                              content: Text('Could not send report — check your connection and try again'),
                            ),
                          );
                        }
                      }
                    },
              child: submitting
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Report'),
            ),
          ],
        );
      },
    ),
  );
}
