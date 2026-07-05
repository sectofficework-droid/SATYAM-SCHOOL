import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/login_controller.dart';

class LoginView extends GetView<LoginController> {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
              child: Column(
                children: [
                  Container(
                    width: 80, height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Image.asset('assets/images/school_logo.png', fit: BoxFit.contain),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Satyam Stars International School',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center),
                  const SizedBox(height: 4),
                  const Text('School Management App',
                    style: TextStyle(color: Colors.white60, fontSize: 13)),
                ],
              ),
            ),

            // ── Form Card ───────────────────────────────────────────────────
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: AppColors.bg,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 8),

                      // Role tabs
                      Obx(() => Container(
                        decoration: BoxDecoration(
                          color: AppColors.border,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.all(4),
                        child: Row(children: [
                          _tab('Teacher', LoginTab.teacher),
                          _tab('Student', LoginTab.student),
                        ]),
                      )),

                      const SizedBox(height: 28),

                      // ID field
                      Obx(() => TextFormField(
                        controller: controller.idCtrl,
                        textInputAction: TextInputAction.next,
                        keyboardType: TextInputType.text,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: controller.tab.value == LoginTab.teacher
                              ? 'Employee ID' : 'Enrollment Number',
                          hintText: controller.tab.value == LoginTab.teacher
                              ? 'e.g. EMP001' : 'e.g. 2024001',
                          prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.navy),
                        ),
                      )),

                      const SizedBox(height: 16),

                      // Password field
                      Obx(() => TextFormField(
                        controller: controller.passCtrl,
                        obscureText: !controller.showPass.value,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => controller.login(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline, color: AppColors.navy),
                          suffixIcon: IconButton(
                            icon: Icon(
                              controller.showPass.value ? Icons.visibility_off : Icons.visibility,
                              color: AppColors.textHint,
                            ),
                            onPressed: () => controller.showPass.toggle(),
                          ),
                        ),
                      )),

                      const SizedBox(height: 12),

                      // Error message
                      Obx(() => controller.errorMsg.value.isEmpty
                          ? const SizedBox.shrink()
                          : Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.redLight,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.red.withOpacity(.3)),
                              ),
                              child: Row(children: [
                                const Icon(Icons.error_outline, color: AppColors.red, size: 16),
                                const SizedBox(width: 8),
                                Expanded(child: Text(controller.errorMsg.value,
                                  style: const TextStyle(color: AppColors.red, fontSize: 13))),
                              ]),
                            )),

                      const SizedBox(height: 8),

                      // Login button
                      Obx(() => ElevatedButton(
                        onPressed: controller.loading.value ? null : controller.login,
                        child: controller.loading.value
                            ? const SizedBox(width: 22, height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                            : const Text('Sign In'),
                      )),

                      const SizedBox(height: 24),

                      // Help text
                      const Center(
                        child: Text(
                          'Forgot your password? Contact the school admin.',
                          style: TextStyle(color: AppColors.textLight, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ),

                      const SizedBox(height: 32),
                      const Center(
                        child: Text('© 2026 Satyam Stars International School',
                          style: TextStyle(color: AppColors.textHint, fontSize: 11)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tab(String label, LoginTab t) => Expanded(
    child: Obx(() {
      final active = controller.tab.value == t;
      return GestureDetector(
        onTap: () => controller.switchTab(t),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? AppColors.navy : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active ? Colors.white : AppColors.textLight,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            )),
        ),
      );
    }),
  );
}
