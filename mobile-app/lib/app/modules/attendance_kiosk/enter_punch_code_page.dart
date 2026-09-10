import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/utils/punctuality.dart';
import '../../routes/app_routes.dart';

enum _Stage { code, confirm, saving, success, error }

// The fallback for when face-scan can't complete a punch - wrong match
// ("Not me" on face_punch_page.dart) or no match at all. Admin generates a
// 6-digit code from the staff member's profile in the admin panel
// (generate_punch_code, authenticated-only - the kiosk itself can never
// mint a code, only redeem one), staff types it here. lookup_punch_code
// resolves who it belongs to without consuming it, so this can show a
// name-confirmation + time-adjust step before committing; redeem_punch_code
// re-validates and actually records the punch. The time slider is bounded
// to [code generation time, now] server-side too - this UI just mirrors
// that bound so the slider can't even be dragged somewhere the backend
// would reject.
class EnterPunchCodePage extends StatefulWidget {
  const EnterPunchCodePage({super.key});
  @override
  State<EnterPunchCodePage> createState() => _EnterPunchCodePageState();
}

class _EnterPunchCodePageState extends State<EnterPunchCodePage> {
  final _codeCtrl = TextEditingController();
  _Stage _stage = _Stage.code;
  String _message = '';
  bool _busy = false;

  String? _code;
  String? _employeeName;
  String? _punctuality;
  DateTime? _generatedAt;
  DateTime? _maxTime;
  int _offsetMinutes = 0; // minutes back from _maxTime

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _lookupCode() async {
    final code = _codeCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _message = 'Enter the 6-digit code from admin');
      return;
    }
    setState(() { _busy = true; _message = ''; });
    try {
      final result = await SupabaseService.lookupPunchCode(code);
      if (!mounted) return;
      if (result == null) {
        setState(() { _busy = false; _message = 'That code is invalid or has expired. Ask admin for a new one.'; });
        return;
      }
      final maxTime = DateTime.now();
      setState(() {
        _busy = false;
        _stage = _Stage.confirm;
        _code = code;
        _employeeName = result['employeeName'] as String;
        _generatedAt = result['generatedAt'] as DateTime;
        _maxTime = maxTime;
        _offsetMinutes = 0;
      });
    } catch (e, st) {
      debugPrint('Punch code lookup failed: $e\n$st');
      if (!mounted) return;
      setState(() { _busy = false; _message = 'Something went wrong. Please try again.'; });
    }
  }

  DateTime get _chosenTime => _maxTime!.subtract(Duration(minutes: _offsetMinutes));

  int get _maxOffsetMinutes {
    final span = _maxTime!.difference(_generatedAt!).inMinutes;
    return span < 0 ? 0 : span;
  }

  Future<void> _punchIn() async {
    final code = _code;
    if (code == null || _busy) return;
    setState(() { _busy = true; _stage = _Stage.saving; });
    try {
      final date = DateFormat('yyyy-MM-dd').format(_chosenTime);
      final result = await SupabaseService.redeemPunchCode(code, date, _chosenTime);
      if (!mounted) return;
      if (result['status'] == 'already_in') {
        final since = DateFormat('h:mm a').format(result['checkInAt'] as DateTime);
        setState(() {
          _busy = false;
          _stage = _Stage.error;
          _employeeName = result['employeeName'] as String;
          _message = '$_employeeName is already checked in since $since. Check out from your app first.';
        });
        return;
      }
      setState(() {
        _stage = _Stage.success;
        _employeeName = result['employeeName'] as String;
        _punctuality = punctualityLabel(result['isLate'] as bool?, result['lateMinutes'] as int?);
      });
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) Get.until((r) => r.settings.name == Routes.kioskHome);
      });
    } catch (e, st) {
      debugPrint('Punch code redeem failed: $e\n$st');
      if (!mounted) return;
      final msg = e.toString().contains('invalid_or_expired_code')
          ? 'That code was already used or has expired.'
          : e.toString().contains('check_in_time_out_of_range')
              ? 'That time is no longer valid. Please try again.'
              : 'Something went wrong. Please try again.';
      setState(() { _busy = false; _stage = _Stage.error; _message = msg; });
    }
  }

  void _startOver() {
    setState(() {
      _busy = false; _stage = _Stage.code; _message = '';
      _codeCtrl.clear();
      _code = null; _employeeName = null; _punctuality = null; _generatedAt = null; _maxTime = null; _offsetMinutes = 0;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.navyDark,
    body: SafeArea(
      child: switch (_stage) {
        _Stage.code    => _buildCodeEntry(),
        _Stage.confirm => _buildConfirm(),
        _Stage.saving  => _buildMessage(spinner: true, text: 'Punching in...'),
        _Stage.success => _buildMessage(icon: Icons.check_rounded, iconColor: AppColors.green, text: '$_employeeName is checked in${_punctuality != null ? "\n$_punctuality" : ""}'),
        _Stage.error   => _buildMessage(icon: Icons.close_rounded, iconColor: AppColors.red, text: _message, retry: _startOver),
      },
    ),
  );

  Widget _buildCodeEntry() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Align(
          alignment: Alignment.topLeft,
          child: IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white70), onPressed: () => Get.back()),
        ),
        const Icon(Icons.password_rounded, color: AppColors.amber, size: 48),
        const SizedBox(height: 16),
        const Text('Enter Code', style: TextStyle(
          color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
        const SizedBox(height: 6),
        const Text('Ask admin for your 6-digit code', textAlign: TextAlign.center, style: TextStyle(
          color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
        const SizedBox(height: 24),
        TextField(
          controller: _codeCtrl,
          autofocus: true,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 12),
          decoration: const InputDecoration(
            counterText: '',
            enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.white24)),
            focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.amber)),
          ),
          onSubmitted: (_) => _lookupCode(),
        ),
        if (_message.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.red, fontSize: 13)),
        ],
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _busy ? null : _lookupCode,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.amber, foregroundColor: AppColors.navyDark,
              padding: const EdgeInsets.symmetric(vertical: 14)),
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.navyDark))
                : const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
        ),
      ]),
    ),
  );

  Widget _buildConfirm() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.person_rounded, color: AppColors.amber, size: 48),
        const SizedBox(height: 12),
        Text(_employeeName ?? '', textAlign: TextAlign.center, style: const TextStyle(
          color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
        const SizedBox(height: 24),
        const Text('Check-in time', style: TextStyle(color: Colors.white60, fontSize: 12, fontFamily: 'Poppins')),
        Text(DateFormat('h:mm a').format(_chosenTime), style: const TextStyle(
          color: AppColors.amber, fontSize: 32, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
        if (_maxOffsetMinutes > 0) ...[
          Slider(
            value: _offsetMinutes.toDouble(),
            min: 0,
            max: _maxOffsetMinutes.toDouble(),
            divisions: _maxOffsetMinutes,
            activeColor: AppColors.amber,
            onChanged: (v) => setState(() => _offsetMinutes = v.round()),
          ),
          const Text('Drag to adjust if this took a few minutes', style: TextStyle(
            color: Colors.white38, fontSize: 11, fontFamily: 'Poppins')),
        ],
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          TextButton(
            onPressed: _startOver,
            child: const Text('Not Me', style: TextStyle(color: Colors.white60, fontSize: 15, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 16),
          ElevatedButton(
            onPressed: _busy ? null : _punchIn,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.green, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12)),
            child: const Text('Punch In', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          ),
        ]),
      ]),
    ),
  );

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
