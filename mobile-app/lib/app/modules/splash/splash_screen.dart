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
  late final AnimationController _ambientCtrl; // continuous, never stops until exit

  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;
  late final Animation<double> _logoRotate;
  late final Animation<double> _wordSatyamOpacity;
  late final Animation<Offset>  _wordSatyamSlide;
  late final Animation<double> _wordStarsOpacity;
  late final Animation<Offset>  _wordStarsSlide;
  late final Animation<double>  _line2Opacity;
  late final Animation<Offset>  _line2Slide;
  late final Animation<double>  _dividerScale;
  late final Animation<double>  _dotsOpacity;
  late final Animation<double>  _screenOpacity;

  @override
  void initState() {
    super.initState();

    _logoCtrl    = AnimationController(duration: const Duration(milliseconds: 1100), vsync: this);
    _textCtrl    = AnimationController(duration: const Duration(milliseconds: 1100), vsync: this);
    _exitCtrl    = AnimationController(duration: const Duration(milliseconds: 500), vsync: this);
    _ambientCtrl = AnimationController(duration: const Duration(milliseconds: 2400), vsync: this)
      ..repeat(reverse: true);

    _logoScale   = Tween(begin: 0.2, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut));
    _logoOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: const Interval(0, 0.3, curve: Curves.easeOut)));
    _logoRotate  = Tween(begin: -0.15, end: 0.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: Curves.elasticOut));

    // Each word of the school name cascades in on its own, slightly
    // overlapping stagger, rather than the whole name appearing as one block.
    _wordSatyamOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.0, 0.45, curve: Curves.easeOut)));
    _wordSatyamSlide   = Tween(begin: const Offset(0, 0.5), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.0, 0.45, curve: Curves.easeOutCubic)));
    _wordStarsOpacity  = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.12, 0.57, curve: Curves.easeOut)));
    _wordStarsSlide    = Tween(begin: const Offset(0, 0.5), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.12, 0.57, curve: Curves.easeOutCubic)));
    _line2Opacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.3, 0.75, curve: Curves.easeOut)));
    _line2Slide   = Tween(begin: const Offset(0, 0.4), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.3, 0.75, curve: Curves.easeOutCubic)));
    _dividerScale = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.5, 0.85, curve: Curves.easeOutCubic)));
    _dotsOpacity = Tween(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.8, 1.0, curve: Curves.easeOut)));

    _screenOpacity = Tween(begin: 1.0, end: 0.0).animate(
        CurvedAnimation(parent: _exitCtrl, curve: Curves.easeIn));

    _runSequence();
  }

  Future<void> _runSequence() async {
    // Logo bounces in with a little rotational settle
    await _logoCtrl.forward();
    // Wait a beat then cascade text, word by word
    await Future.delayed(const Duration(milliseconds: 80));
    await _textCtrl.forward();
    // Hold for user to read, glow/circles keep breathing throughout
    await Future.delayed(const Duration(milliseconds: 900));
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
    _ambientCtrl.dispose();
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
                // Decorative circles for depth — gently breathing, not static
                AnimatedBuilder(
                  animation: _ambientCtrl,
                  builder: (_, __) => Positioned(
                    top: -60, right: -60,
                    child: Transform.scale(
                      scale: 1.0 + _ambientCtrl.value * 0.08,
                      child: Container(width: 240, height: 240,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(.03 + _ambientCtrl.value * 0.02),
                        )),
                    ),
                  ),
                ),
                AnimatedBuilder(
                  animation: _ambientCtrl,
                  builder: (_, __) => Positioned(
                    bottom: 80, left: -80,
                    child: Transform.scale(
                      scale: 1.0 + (1 - _ambientCtrl.value) * 0.08,
                      child: Container(width: 280, height: 280,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(.02 + (1 - _ambientCtrl.value) * 0.02),
                        )),
                    ),
                  ),
                ),

                // Center content
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Logo: bounce + fade + gentle rotational settle, with a
                      // continuously pulsing soft glow ring behind it
                      SizedBox(
                        width: 176, height: 176,
                        child: Stack(alignment: Alignment.center, children: [
                          AnimatedBuilder(
                            animation: Listenable.merge([_logoCtrl, _ambientCtrl]),
                            builder: (_, __) => Opacity(
                              opacity: (_logoOpacity.value * 0.5).clamp(0.0, 0.5),
                              child: Transform.scale(
                                scale: 1.35 + _ambientCtrl.value * 0.12,
                                child: Container(
                                  width: 140, height: 140,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: RadialGradient(colors: [
                                      Colors.white.withOpacity(.35),
                                      Colors.white.withOpacity(0),
                                    ]),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          AnimatedBuilder(
                            animation: _logoCtrl,
                            builder: (_, __) => Opacity(
                              opacity: _logoOpacity.value.clamp(0.0, 1.0),
                              child: Transform.rotate(
                                angle: _logoRotate.value,
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
                                      child: Padding(
                                        padding: const EdgeInsets.all(8),
                                        child: Image.asset(
                                          'assets/images/school_logo.jpg',
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ]),
                      ),

                      const SizedBox(height: 32),

                      // School name — each word cascades in on its own
                      AnimatedBuilder(
                        animation: _textCtrl,
                        builder: (_, __) => Column(children: [
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            SlideTransition(
                              position: _wordSatyamSlide,
                              child: FadeTransition(
                                opacity: _wordSatyamOpacity,
                                child: const Text('SATYAM',
                                  style: TextStyle(
                                    color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5, height: 1.1, fontFamily: 'Poppins',
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            SlideTransition(
                              position: _wordStarsSlide,
                              child: FadeTransition(
                                opacity: _wordStarsOpacity,
                                child: const Text('STARS',
                                  style: TextStyle(
                                    color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5, height: 1.1, fontFamily: 'Poppins',
                                  ),
                                ),
                              ),
                            ),
                          ]),
                          SlideTransition(
                            position: _line2Slide,
                            child: FadeTransition(
                              opacity: _line2Opacity,
                              child: const Text(
                                'INTERNATIONAL SCHOOL',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w400,
                                  letterSpacing: 3,
                                  fontFamily: 'Poppins',
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          ScaleTransition(
                            scale: _dividerScale,
                            child: Container(
                              width: 56, height: 3,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(.5),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                        ]),
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
