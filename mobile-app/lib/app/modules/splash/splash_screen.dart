import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/auth_service.dart';
import '../../../app/routes/app_routes.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _logoCtrl;
  late final AnimationController _textCtrl;
  late final AnimationController _exitCtrl;

  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;
  late final Animation<Offset>  _nameSlide;
  late final Animation<double>  _nameOpacity;
  late final Animation<double>  _tagOpacity;
  late final Animation<double>  _dotsOpacity;
  late final Animation<double>  _screenOpacity;

  @override
  void initState() {
    super.initState();

    _logoCtrl = AnimationController(duration: const Duration(milliseconds: 1000), vsync: this);
    _textCtrl = AnimationController(duration: const Duration(milliseconds: 900), vsync: this);
    _exitCtrl = AnimationController(duration: const Duration(milliseconds: 500), vsync: this);

    _logoScale   = Tween(begin: 0.25, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut));
    _logoOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: const Interval(0, 0.35, curve: Curves.easeOut)));

    _nameSlide   = Tween(begin: const Offset(0, 0.4), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: Curves.easeOutCubic));
    _nameOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0, 0.5, curve: Curves.easeOut)));
    _tagOpacity  = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.45, 0.85, curve: Curves.easeOut)));
    _dotsOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.75, 1.0, curve: Curves.easeOut)));

    _screenOpacity = Tween(begin: 1.0, end: 0.0).animate(
        CurvedAnimation(parent: _exitCtrl, curve: Curves.easeIn));

    _runSequence();
  }

  Future<void> _runSequence() async {
    // Logo bounces in
    await _logoCtrl.forward();
    // Wait a beat then cascade text
    await Future.delayed(const Duration(milliseconds: 80));
    await _textCtrl.forward();
    // Hold for user to read
    await Future.delayed(const Duration(milliseconds: 1000));
    // Fade out and navigate
    await _exitCtrl.forward();
    if (mounted) _navigate();
  }

  void _navigate() {
    final auth = AuthService.to;
    if (auth.isLoggedIn.value) {
      Get.offAllNamed(auth.role.value == UserRole.teacher
          ? Routes.teacherHome
          : Routes.studentHome);
    } else {
      Get.offAllNamed(Routes.login);
    }
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _textCtrl.dispose();
    _exitCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _screenOpacity,
    builder: (_, __) => Opacity(
      opacity: _screenOpacity.value,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(gradient: AppColors.navyGradient),
          child: SafeArea(
            child: Stack(
              children: [
                // Decorative circles for depth
                Positioned(top: -60, right: -60,
                  child: Container(width: 240, height: 240,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(.04),
                    ))),
                Positioned(bottom: 80, left: -80,
                  child: Container(width: 280, height: 280,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(.03),
                    ))),

                // Center content
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Logo with scale + fade
                      AnimatedBuilder(
                        animation: _logoCtrl,
                        builder: (_, __) => Opacity(
                          opacity: _logoOpacity.value.clamp(0.0, 1.0),
                          child: Transform.scale(
                            scale: _logoScale.value,
                            child: Container(
                              width: 120, height: 120,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(30),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(.3),
                                    blurRadius: 40, offset: const Offset(0, 16),
                                  ),
                                  BoxShadow(
                                    color: Colors.white.withOpacity(.1),
                                    blurRadius: 8, offset: const Offset(0, -2),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(30),
                                child: Image.asset(
                                  'assets/images/school_logo.jpg',
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 36),

                      // School name with slide + fade
                      AnimatedBuilder(
                        animation: _textCtrl,
                        builder: (_, __) => SlideTransition(
                          position: _nameSlide,
                          child: FadeTransition(
                            opacity: _nameOpacity,
                            child: const Column(children: [
                              Text(
                                'Satyam Stars',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 32,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                  height: 1.1,
                                  fontFamily: 'Poppins',
                                ),
                                textAlign: TextAlign.center,
                              ),
                              Text(
                                'International School',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w400,
                                  letterSpacing: 3,
                                  fontFamily: 'Poppins',
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ]),
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),

                      // Tag badge
                      AnimatedBuilder(
                        animation: _textCtrl,
                        builder: (_, __) => FadeTransition(
                          opacity: _tagOpacity,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(.12),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(color: Colors.white.withOpacity(.25)),
                            ),
                            child: const Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.school_rounded, color: Colors.white70, size: 15),
                              SizedBox(width: 7),
                              Text(
                                'School Management System',
                                style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 13,
                                  letterSpacing: 0.5,
                                  fontFamily: 'Poppins',
                                ),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Bottom loading dots
                Positioned(
                  bottom: 48,
                  left: 0, right: 0,
                  child: AnimatedBuilder(
                    animation: _textCtrl,
                    builder: (_, __) => FadeTransition(
                      opacity: _dotsOpacity,
                      child: const _LoadingDots(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

// Animated loading dots at the bottom
class _LoadingDots extends StatefulWidget {
  const _LoadingDots();
  @override
  State<_LoadingDots> createState() => _LoadingDotsState();
}

class _LoadingDotsState extends State<_LoadingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(duration: const Duration(milliseconds: 900), vsync: this)
      ..repeat();
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _ctrl,
    builder: (_, __) => Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (i) {
        final offset = ((_ctrl.value - i * 0.2) % 1.0).clamp(0.0, 1.0);
        final scale  = 0.5 + 0.5 * (offset < 0.5 ? offset * 2 : (1 - offset) * 2);
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: 7 * scale, height: 7 * scale,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.4 + 0.4 * scale),
            shape: BoxShape.circle,
          ),
        );
      }),
    ),
  );
}
