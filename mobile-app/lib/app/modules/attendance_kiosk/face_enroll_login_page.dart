import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/supabase_service.dart';
import '../../routes/app_routes.dart';

// A one-off identity check before letting someone (re-)enroll a face on the
// shared kiosk - proves it's really that staff member before their face
// gets tied to their employee record. Deliberately calls the teacher_login
// RPC directly instead of AuthService.loginTeacher: that method persists
// the session to secure storage, which is right for a personal phone but
// wrong here - nothing should stay "logged in" on a shared device once
// enrollment finishes.
class FaceEnrollLoginPage extends StatefulWidget {
  const FaceEnrollLoginPage({super.key});
  @override
  State<FaceEnrollLoginPage> createState() => _FaceEnrollLoginPageState();
}

class _FaceEnrollLoginPageState extends State<FaceEnrollLoginPage> {
  final _idCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _showPass = false;
  String? _error;

  @override
  void dispose() {
    _idCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final id = _idCtrl.text.trim();
    final pass = _passCtrl.text;
    if (id.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Enter your Employee Code and password');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final result = await SupabaseService.client.rpc(
        'teacher_login',
        params: {'p_employee_id': id, 'p_password': pass},
      );
      if (result == null) {
        setState(() { _loading = false; _error = 'Incorrect Employee Code or password.'; });
        return;
      }
      final profile = (result is Map) ? Map<String, dynamic>.from(result) : jsonDecode(result as String) as Map<String, dynamic>;
      if (!mounted) return;
      Get.offNamed(Routes.kioskEnrollCapture, arguments: {
        'id':   profile['id'] as String,
        'name': profile['name'] as String? ?? 'Staff',
      });
    } catch (e) {
      setState(() { _loading = false; _error = 'Something went wrong. Please try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(
      flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
      title: const Text('Set Up Face Punch'),
    ),
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 72, height: 72,
            decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
            child: const Icon(Icons.face_retouching_natural_rounded, color: AppColors.blue, size: 34),
          ),
          const SizedBox(height: 16),
          const Text('Confirm it\'s you', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 6),
          const Text('Log in once with your own Employee Code and password before we scan your face.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.4)),
          const SizedBox(height: 24),
          TextField(
            controller: _idCtrl,
            decoration: const InputDecoration(labelText: 'Employee Code', prefixIcon: Icon(Icons.badge_outlined)),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _passCtrl,
            obscureText: !_showPass,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                icon: Icon(_showPass ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 20),
                onPressed: () => setState(() => _showPass = !_showPass),
              ),
            ),
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: AppColors.red, fontSize: 13)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Continue'),
            ),
          ),
        ]),
      ),
    ),
  );
}
