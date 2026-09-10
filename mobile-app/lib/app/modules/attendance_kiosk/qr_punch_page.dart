import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/utils/punctuality.dart';

enum _Stage { loading, waiting, success, error }

// Third kiosk check-in method, alongside face-scan (face_punch_page.dart)
// and the admin-issued override code (enter_punch_code_page.dart). Unlike
// those two, the kiosk here has no idea who's about to punch in - it just
// mints a random one-time code (generateQrSession) and displays it as a QR;
// a staff member's own Teacher app scans it and redeems it as themselves
// (see scan_attendance_qr_page.dart). This screen just polls
// checkQrSession every 2s to notice the moment that happens - identity only
// ever flows kiosk <- staff app, never the other way. See SUPABASE_QR_PUNCH.sql.
class QrPunchPage extends StatefulWidget {
  const QrPunchPage({super.key});
  @override
  State<QrPunchPage> createState() => _QrPunchPageState();
}

class _QrPunchPageState extends State<QrPunchPage> {
  static const _pollInterval = Duration(seconds: 2);

  _Stage _stage = _Stage.loading;
  String? _code;
  DateTime? _expiresAt;
  String _employeeName = '';
  String? _punctuality;
  Timer? _pollTimer;
  Timer? _returnTimer;

  @override
  void initState() {
    super.initState();
    _generateCode();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _returnTimer?.cancel();
    super.dispose();
  }

  Future<void> _generateCode() async {
    _pollTimer?.cancel();
    try {
      final result = await SupabaseService.generateQrSession();
      if (!mounted) return;
      setState(() {
        _stage = _Stage.waiting;
        _code = result['code'] as String;
        _expiresAt = result['expiresAt'] as DateTime;
      });
      _pollTimer = Timer.periodic(_pollInterval, (_) => _poll());
    } catch (e, st) {
      debugPrint('QR session generation failed: $e\n$st');
      if (!mounted) return;
      setState(() => _stage = _Stage.error);
    }
  }

  Future<void> _poll() async {
    final code = _code;
    final expiresAt = _expiresAt;
    if (code == null || expiresAt == null || _stage != _Stage.waiting) return;

    // Expired unclaimed - silently mint a fresh code rather than showing an
    // error; a stale QR just quietly becomes a new one while staff are
    // still looking at the screen.
    if (DateTime.now().isAfter(expiresAt)) {
      await _generateCode();
      return;
    }

    try {
      final result = await SupabaseService.checkQrSession(code);
      if (!mounted || _stage != _Stage.waiting) return;
      final claimedAt = result['claimedAt'] as DateTime?;
      if (claimedAt == null) return; // still waiting, keep polling silently

      _pollTimer?.cancel();
      setState(() {
        _stage = _Stage.success;
        _employeeName = result['employeeName'] as String? ?? 'Staff';
        _punctuality = punctualityLabel(result['isLate'] as bool?, result['lateMinutes'] as int?);
      });
      _returnTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) Get.back();
      });
    } catch (e, st) {
      debugPrint('QR session poll failed: $e\n$st');
      // Transient network hiccup - keep polling, don't interrupt the flow.
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: switch (_stage) {
        _Stage.loading => const Center(child: CircularProgressIndicator(color: Colors.white)),
        _Stage.waiting => _buildWaiting(),
        _Stage.success => _buildSuccess(),
        _Stage.error   => _buildError(),
      },
    ),
  );

  Widget _buildWaiting() => Column(children: [
    Align(
      alignment: Alignment.topLeft,
      child: IconButton(
        icon: const Icon(Icons.close_rounded, color: Colors.white70),
        onPressed: () => Get.back(),
      ),
    ),
    const SizedBox(height: 8),
    const Text('Scan with your Staff App', style: TextStyle(
      color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
    const SizedBox(height: 6),
    const Text('Open My Attendance → Scan Attendance QR', style: TextStyle(
      color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
    const Spacer(),
    Center(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
        child: _code == null
            ? const SizedBox(width: 240, height: 240)
            : QrImageView(data: _code!, size: 240, version: QrVersions.auto),
      ),
    ),
    const Spacer(),
    const Padding(
      padding: EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Text('This code refreshes automatically', textAlign: TextAlign.center, style: TextStyle(
        color: Colors.white38, fontSize: 12, fontFamily: 'Poppins')),
    ),
  ]);

  Widget _buildSuccess() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 96, height: 96,
          decoration: const BoxDecoration(color: AppColors.green, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, color: Colors.white, size: 56),
        ),
        const SizedBox(height: 24),
        Text('$_employeeName is checked in', textAlign: TextAlign.center, style: const TextStyle(
          color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
        if (_punctuality != null) ...[
          const SizedBox(height: 6),
          Text(_punctuality!, textAlign: TextAlign.center, style: TextStyle(
            color: _punctuality == 'On time' ? AppColors.green : AppColors.amber,
            fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
        ],
      ]),
    ),
  );

  Widget _buildError() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 96, height: 96,
          decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle),
          child: const Icon(Icons.close_rounded, color: Colors.white, size: 56),
        ),
        const SizedBox(height: 24),
        const Text('Could not generate a QR code. Please try again.', textAlign: TextAlign.center, style: TextStyle(
          color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          TextButton(
            onPressed: () { setState(() => _stage = _Stage.loading); _generateCode(); },
            child: const Text('Try Again', style: TextStyle(color: AppColors.amber, fontSize: 15, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => Get.back(),
            child: const Text('Cancel', style: TextStyle(color: Colors.white60, fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ]),
      ]),
    ),
  );
}
