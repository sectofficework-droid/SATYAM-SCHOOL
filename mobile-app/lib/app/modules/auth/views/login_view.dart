import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/login_controller.dart';

class LoginView extends GetView<LoginController> {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.navyGradient),
        child: SafeArea(
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: const Duration(milliseconds: 750),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => Column(
              children: [
                // Header: logo + school name
                Expanded(
                  flex: 3,
                  child: Opacity(
                    opacity: v.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, -30 * (1 - v)),
                      child: Center(child: _Header()),
                    ),
                  ),
                ),
                // Form card slides up
                Expanded(
                  flex: 7,
                  child: Opacity(
                    opacity: v.clamp(0.0, 1.0),
                    child: Transform.translate(
                      offset: Offset(0, 60 * (1 - v)),
                      child: _FormCard(controller: controller),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 96, height: 96,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(.25), blurRadius: 24, offset: const Offset(0, 8)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Image.asset('assets/images/school_logo.jpg', fit: BoxFit.contain),
          ),
        ),
      ),
      const SizedBox(height: 18),
      const Text(
        'SATYAM STARS INTERNATIONAL SCHOOL',
        style: TextStyle(
          color: Colors.white,
          fontSize: 17,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          fontFamily: 'Poppins',
        ),
        textAlign: TextAlign.center,
      ),
    ],
  );
}

class _FormCard extends StatelessWidget {
  final LoginController controller;
  const _FormCard({required this.controller});

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: AppColors.bg,
      borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
    ),
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          const Text('Welcome Back!',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.text)),
          const SizedBox(height: 4),
          const Text('Sign in to continue',
            style: TextStyle(fontSize: 14, color: AppColors.textLight)),
          const SizedBox(height: 24),

          // Role tabs
          Container(
            decoration: BoxDecoration(
              color: AppColors.border.withOpacity(.5),
              borderRadius: BorderRadius.circular(14),
            ),
            padding: const EdgeInsets.all(4),
            child: Row(children: [
              _Tab(label: 'Teacher', t: LoginTab.teacher, controller: controller),
              _Tab(label: 'Student', t: LoginTab.student, controller: controller),
            ]),
          ),

          const SizedBox(height: 24),

          Obx(() => TextFormField(
            controller: controller.idCtrl,
            textInputAction: TextInputAction.next,
            keyboardType: TextInputType.text,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              labelText: controller.tab.value == LoginTab.teacher ? 'Employee Code' : 'Enrollment No.',
              hintText: controller.tab.value == LoginTab.teacher ? 'e.g. EMP001' : 'e.g. 2024001',
              prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.navy),
            ),
          )),
          const SizedBox(height: 14),

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
          const SizedBox(height: 14),

          Obx(() => controller.errorMsg.value.isEmpty
            ? const SizedBox.shrink()
            : TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 300),
                builder: (_, v, child) => Opacity(
                  opacity: v,
                  child: Transform.translate(offset: Offset(0, 10 * (1-v)), child: child),
                ),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.redLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.red.withOpacity(.3)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.error_outline, color: AppColors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(controller.errorMsg.value,
                      style: const TextStyle(color: AppColors.red, fontSize: 13))),
                  ]),
                ),
              )),

          const SizedBox(height: 6),

          Obx(() => _GradientButton(
            onTap: controller.loading.value ? null : controller.login,
            loading: controller.loading.value,
          )),

          const SizedBox(height: 20),
          const Center(
            child: Text(
              'Forgot password? Contact school admin.',
              style: TextStyle(color: AppColors.textLight, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text('© 2026 Satyam Stars International School',
              style: TextStyle(color: AppColors.textHint, fontSize: 11)),
          ),
        ],
      ),
    ),
  );
}

class _Tab extends StatelessWidget {
  final String label;
  final LoginTab t;
  final LoginController controller;
  const _Tab({required this.label, required this.t, required this.controller});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Obx(() {
      final active = controller.tab.value == t;
      return GestureDetector(
        onTap: () => controller.switchTab(t),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            gradient: active ? AppColors.navyGradient : null,
            borderRadius: BorderRadius.circular(10),
            boxShadow: active ? [
              BoxShadow(color: AppColors.navy.withOpacity(.3), blurRadius: 8, offset: const Offset(0, 4)),
            ] : null,
          ),
          child: Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: active ? Colors.white : AppColors.textLight,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            )),
        ),
      );
    }),
  );
}

class _GradientButton extends StatefulWidget {
  final VoidCallback? onTap;
  final bool loading;
  const _GradientButton({this.onTap, required this.loading});

  @override
  State<_GradientButton> createState() => _GradientButtonState();
}

class _GradientButtonState extends State<_GradientButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _pressed = true),
    onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
    onTapCancel: () => setState(() => _pressed = false),
    child: AnimatedScale(
      scale: _pressed ? 0.97 : 1.0,
      duration: const Duration(milliseconds: 100),
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          gradient: widget.onTap == null
            ? null
            : AppColors.navyGradient,
          color: widget.onTap == null ? AppColors.textHint : null,
          borderRadius: BorderRadius.circular(14),
          boxShadow: widget.onTap != null ? [
            BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6)),
          ] : null,
        ),
        child: Center(
          child: widget.loading
            ? const SizedBox(width: 22, height: 22,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
            : const Text('Sign In',
                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
        ),
      ),
    ),
  );
}
