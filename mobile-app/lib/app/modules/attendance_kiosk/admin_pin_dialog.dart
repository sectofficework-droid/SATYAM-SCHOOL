import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/kiosk_pin_service.dart';

// Shows a PIN dialog gating access to the enrollment flow - first run walks
// through setting a PIN (nothing stored yet), every run after that asks for
// it. Returns true only once the admin has proved they know the PIN.
Future<bool> showAdminPinGate(BuildContext context) async {
  final hasPin = await KioskPinService.hasPin();
  if (!context.mounted) return false;
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (_) => _AdminPinDialog(isSetup: !hasPin),
  );
  return result ?? false;
}

class _AdminPinDialog extends StatefulWidget {
  const _AdminPinDialog({required this.isSetup});
  final bool isSetup;
  @override
  State<_AdminPinDialog> createState() => _AdminPinDialogState();
}

class _AdminPinDialogState extends State<_AdminPinDialog> {
  final _pinCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _pinCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final pin = _pinCtrl.text;
    if (pin.length < 4) {
      setState(() => _error = 'PIN must be at least 4 digits');
      return;
    }

    if (widget.isSetup) {
      if (pin != _confirmCtrl.text) {
        setState(() => _error = 'PINs don\'t match');
        return;
      }
      setState(() => _busy = true);
      await KioskPinService.setPin(pin);
      if (mounted) Navigator.of(context).pop(true);
      return;
    }

    setState(() => _busy = true);
    final ok = await KioskPinService.verifyPin(pin);
    if (!mounted) return;
    if (!ok) {
      setState(() { _busy = false; _error = 'Incorrect PIN'; _pinCtrl.clear(); });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.isSetup ? 'Set Admin PIN' : 'Enter Admin PIN'),
    content: Column(mainAxisSize: MainAxisSize.min, children: [
      if (widget.isSetup) ...[
        const Text('This PIN will be required to enroll or update staff faces on this device.',
          style: TextStyle(fontSize: 13, color: AppColors.textLight)),
        const SizedBox(height: 16),
      ],
      TextField(
        controller: _pinCtrl,
        autofocus: true,
        obscureText: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
        decoration: const InputDecoration(labelText: 'PIN'),
        onSubmitted: (_) => widget.isSetup ? null : _submit(),
      ),
      if (widget.isSetup) ...[
        const SizedBox(height: 10),
        TextField(
          controller: _confirmCtrl,
          obscureText: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          decoration: const InputDecoration(labelText: 'Confirm PIN'),
          onSubmitted: (_) => _submit(),
        ),
      ],
      if (_error != null) ...[
        const SizedBox(height: 10),
        Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 13)),
      ],
    ]),
    actions: [
      TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
      ElevatedButton(
        onPressed: _busy ? null : _submit,
        child: _busy
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(widget.isSetup ? 'Set PIN' : 'Continue'),
      ),
    ],
  );
}
