import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/punctuality.dart';

enum _Stage { scanning, saving, success, error }

// Staff-side counterpart of the kiosk's qr_punch_page.dart: scans the code
// the kiosk is displaying and redeems it as the logged-in staff member
// (employeeId already known locally from AuthService - the QR itself
// carries no identity, just the anonymous one-time session code). See
// SUPABASE_QR_PUNCH.sql / SupabaseService.redeemQrSession.
class ScanAttendanceQrPage extends StatefulWidget {
  const ScanAttendanceQrPage({super.key});
  @override
  State<ScanAttendanceQrPage> createState() => _ScanAttendanceQrPageState();
}

class _ScanAttendanceQrPageState extends State<ScanAttendanceQrPage> {
  final _scannerController = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  _Stage _stage = _Stage.scanning;
  String _message = '';
  String _employeeName = '';
  String? _punctuality;
  bool _handled = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final barcodes = capture.barcodes;
    final code = barcodes.isNotEmpty ? barcodes.first.rawValue : null;
    if (code == null || code.isEmpty) return;
    _handled = true;
    await _scannerController.stop();

    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    if (employeeId == null) {
      setState(() { _stage = _Stage.error; _message = 'Could not identify your account. Please log in again.'; });
      return;
    }

    setState(() => _stage = _Stage.saving);
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final result = await SupabaseService.redeemQrSession(code, employeeId, today, DateTime.now());
      if (!mounted) return;
      if (result['status'] == 'already_in') {
        final since = DateFormat('h:mm a').format(result['checkInAt'] as DateTime);
        setState(() {
          _stage = _Stage.error;
          _message = 'You are already checked in since $since. Check out from My Attendance first.';
        });
        return;
      }
      setState(() {
        _stage = _Stage.success;
        _employeeName = result['employeeName'] as String;
        _punctuality = punctualityLabel(result['isLate'] as bool?, result['lateMinutes'] as int?);
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) Get.back(result: true);
      });
    } catch (e, st) {
      debugPrint('QR redeem failed: $e\n$st');
      if (!mounted) return;
      final msg = e.toString().contains('invalid_or_expired_code')
          ? 'That QR code has expired. Ask the kiosk for a fresh one and scan again.'
          : 'Something went wrong. Please try again.';
      setState(() { _stage = _Stage.error; _message = msg; });
    }
  }

  void _retry() {
    setState(() { _stage = _Stage.scanning; _message = ''; _handled = false; });
    _scannerController.start();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: switch (_stage) {
        _Stage.scanning => _buildScanning(),
        _Stage.saving   => _buildMessage(spinner: true, text: 'Punching in...'),
        _Stage.success  => _buildMessage(icon: Icons.check_rounded, iconColor: AppColors.green, text: '$_employeeName is checked in${_punctuality != null ? "\n$_punctuality" : ""}'),
        _Stage.error    => _buildMessage(icon: Icons.close_rounded, iconColor: AppColors.red, text: _message, retry: _retry),
      },
    ),
  );

  Widget _buildScanning() => Column(children: [
    Align(
      alignment: Alignment.topLeft,
      child: IconButton(
        icon: const Icon(Icons.close_rounded, color: Colors.white70),
        onPressed: () => Get.back(),
      ),
    ),
    const SizedBox(height: 8),
    const Text('Scan the kiosk\'s QR code', style: TextStyle(
      color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
    const SizedBox(height: 20),
    Expanded(
      child: Center(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            width: 280, height: 280,
            child: MobileScanner(controller: _scannerController, onDetect: _onDetect),
          ),
        ),
      ),
    ),
    const Padding(
      padding: EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Text('Point your camera at the kiosk screen', textAlign: TextAlign.center, style: TextStyle(
        color: AppColors.amber, fontSize: 14, fontFamily: 'Poppins')),
    ),
  ]);

  Widget _buildMessage({IconData? icon, Color? iconColor, bool spinner = false, required String text, VoidCallback? retry}) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        if (spinner) const CircularProgressIndicator(color: Colors.white)
        else Container(
          width: 96, height: 96,
          decoration: BoxDecoration(color: iconColor, shape: BoxShape.circle),
          child: Icon(icon, color: Colors.white, size: 56),
        ),
        const SizedBox(height: 24),
        Text(text, textAlign: TextAlign.center, style: const TextStyle(
          color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
        if (retry != null) ...[
          const SizedBox(height: 24),
          TextButton(
            onPressed: retry,
            child: const Text('Try Again', style: TextStyle(color: AppColors.amber, fontSize: 15, fontWeight: FontWeight.w700)),
          ),
        ],
      ]),
    ),
  );
}
