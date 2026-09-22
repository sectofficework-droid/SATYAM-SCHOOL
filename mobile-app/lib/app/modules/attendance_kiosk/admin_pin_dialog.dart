import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/kiosk_pin_service.dart';

// Shows a PIN dialog gating access to the enrollment flow. The PIN is now
// set centrally from the admin panel (Settings -> Kiosk), not on this
// device - if it hasn't been configured yet, this shows a message pointing
// there instead of the old "set it yourself" first-run flow.
// REQ-SEC-002 fast-track (2026-09-19): returns the short-lived kiosk-admin
// session token minted on a correct PIN (null on cancel/wrong PIN/locked
// out) instead of a bare bool - the caller must thread this token through
// to every face-embedding read/write from here on.
Future<String?> showAdminPinGate(BuildContext context) async {
  bool configured;
  try {
    configured = await KioskPinService.isConfigured();
  } catch (_) {
    if (!context.mounted) return null;
    await _showInfoDialog(context, 'Connection Error',
        'Could not reach the server to check the PIN. Check the kiosk\'s internet connection and try again.');
    return null;
  }
  if (!context.mounted) return null;
  if (!configured) {
    await _showInfoDialog(context, 'PIN Not Configured',
        'Ask your admin to set the Kiosk PIN from the admin panel under Settings → Kiosk before enrolling staff faces here.');
    return null;
  }
  return showDialog<String>(
    context: context,
    barrierDismissible: true,
    builder: (_) => const _AdminPinDialog(),
  );
}

Future<void> _showInfoDialog(BuildContext context, String title, String message) => showDialog<void>(
  context: context,
  builder: (_) => AlertDialog(
    title: Text(title),
    content: Text(message),
    actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK'))],
  ),
);

class _AdminPinDialog extends StatefulWidget {
  const _AdminPinDialog();
  @override
  State<_AdminPinDialog> createState() => _AdminPinDialogState();
}

class _AdminPinDialogState extends State<_AdminPinDialog> {
  final _pinCtrl = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pin = _pinCtrl.text;
    if (pin.length < 4) {
      setState(() => _error = 'PIN must be at least 4 digits');
      return;
    }
    setState(() { _busy = true; _error = null; });
    String? token;
    try {
      token = await KioskPinService.verifyPin(pin);
    } catch (e) {
      if (!mounted) return;
      setState(() { _busy = false; _error = 'Could not verify PIN - check your connection.'; });
      return;
    }
    if (!mounted) return;
    if (token == null) {
      setState(() { _busy = false; _error = 'Incorrect PIN'; _pinCtrl.clear(); });
      return;
    }
    Navigator.of(context).pop(token);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Enter Admin PIN'),
    content: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(
        controller: _pinCtrl,
        autofocus: true,
        obscureText: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
        decoration: const InputDecoration(labelText: 'PIN'),
        onSubmitted: (_) => _submit(),
      ),
      if (_error != null) ...[
        const SizedBox(height: 10),
        Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 13)),
      ],
    ]),
    actions: [
      TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
      ElevatedButton(
        onPressed: _busy ? null : _submit,
        child: _busy
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Continue'),
      ),
    ],
  );
}
