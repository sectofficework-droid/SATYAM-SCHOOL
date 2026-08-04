import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import '../services/supabase_service.dart';

// Same bucket the rest of the app already reads from directly with no auth -
// see common/widgets/s3_image.dart's _s3Base.
const _s3Base = 'https://satyam-stars-international-school.s3.ap-south-1.amazonaws.com';

// Compares the installed build (pubspec's +N, read via package_info_plus)
// against the newest row in app_versions and, if behind, shows an update
// prompt. "Later" is remembered per-version-per-day (same idiom as the
// notice popup's shouldShowNoticePopupToday) so it doesn't nag on every
// launch; force_update rows skip that entirely and can't be dismissed.
Future<void> checkForAppUpdate(BuildContext context) async {
  final latest = await SupabaseService.fetchLatestAppVersion();
  if (latest == null) return;

  final info = await PackageInfo.fromPlatform();
  final installedCode = int.tryParse(info.buildNumber) ?? 0;
  final latestCode = latest['version_code'] as int? ?? 0;
  if (latestCode <= installedCode) return;

  final forceUpdate = latest['force_update'] == true;
  final today = DateTime.now().toIso8601String().substring(0, 10);
  final dismissKey = 'update_dismissed_v${latestCode}_$today';

  if (!forceUpdate) {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(dismissKey) == true) return;
  }

  if (!context.mounted) return;
  await showDialog(
    context: context,
    barrierDismissible: !forceUpdate,
    builder: (ctx) => PopScope(
      canPop: !forceUpdate,
      child: AlertDialog(
        icon: Container(
          width: 52, height: 52,
          decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
          child: const Icon(Icons.system_update_alt_rounded, color: AppColors.navy, size: 26),
        ),
        title: const Text('Update Available', textAlign: TextAlign.center),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('A new version (${latest['version_name']}) is ready to install.',
            textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
          if ((latest['release_notes'] ?? '').toString().trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(10)),
              child: Text(latest['release_notes'].toString(),
                style: const TextStyle(fontSize: 12.5, color: AppColors.text, height: 1.4)),
            ),
          ],
          if (forceUpdate) ...[
            const SizedBox(height: 10),
            const Text('This update is required to continue using the app.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.red, fontWeight: FontWeight.w600)),
          ],
        ]),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          if (!forceUpdate)
            TextButton(
              onPressed: () async {
                final prefs = await SharedPreferences.getInstance();
                await prefs.setBool(dismissKey, true);
                if (ctx.mounted) Navigator.of(ctx).pop();
              },
              child: const Text('Later', style: TextStyle(color: AppColors.textLight)),
            ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              final url = Uri.parse('$_s3Base/${latest['apk_key']}');
              await launchUrl(url, mode: LaunchMode.externalApplication);
              if (!forceUpdate && ctx.mounted) Navigator.of(ctx).pop();
            },
            child: const Text('Update Now'),
          ),
        ],
      ),
    ),
  );
}
