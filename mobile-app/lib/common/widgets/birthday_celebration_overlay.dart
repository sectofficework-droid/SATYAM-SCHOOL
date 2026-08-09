import 'dart:math';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import 's3_image.dart';

// Full-screen celebration shown once per day to the birthday person
// themselves when they open the app on their own birthday - confetti +
// their own photo, not just a bell notice. Separate from (and shown
// alongside) the quieter "Happy Birthday!" bell item in recent_notices.dart,
// which stays as a persistent reminder for the rest of the day.
Future<void> showBirthdayCelebration(BuildContext context, {required String name, String? photoKey}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Birthday celebration',
    barrierColor: Colors.black.withOpacity(.55),
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (_, __, ___) => _BirthdayCelebrationDialog(name: name, photoKey: photoKey),
    transitionBuilder: (_, anim, __, child) => FadeTransition(opacity: anim, child: child),
  );
}

class _BirthdayCelebrationDialog extends StatefulWidget {
  final String name;
  final String? photoKey;
  const _BirthdayCelebrationDialog({required this.name, required this.photoKey});

  @override
  State<_BirthdayCelebrationDialog> createState() => _BirthdayCelebrationDialogState();
}

const List<Color> _confettiColors = [
  AppColors.pink, AppColors.amber, AppColors.green, AppColors.blue, AppColors.purple, AppColors.teal,
];

class _BirthdayCelebrationDialogState extends State<_BirthdayCelebrationDialog> {
  late final ConfettiController _confettiLeft;
  late final ConfettiController _confettiRight;

  @override
  void initState() {
    super.initState();
    _confettiLeft  = ConfettiController(duration: const Duration(seconds: 4));
    _confettiRight = ConfettiController(duration: const Duration(seconds: 4));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _confettiLeft.play();
      _confettiRight.play();
    });
  }

  @override
  void dispose() {
    _confettiLeft.dispose();
    _confettiRight.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: Stack(alignment: Alignment.center, children: [
      Align(
        alignment: Alignment.topLeft,
        child: ConfettiWidget(
          confettiController: _confettiLeft,
          blastDirection: -pi / 4, // toward bottom-right
          emissionFrequency: 0.04,
          numberOfParticles: 12,
          maxBlastForce: 20, minBlastForce: 8,
          gravity: 0.25,
          colors: _confettiColors,
        ),
      ),
      Align(
        alignment: Alignment.topRight,
        child: ConfettiWidget(
          confettiController: _confettiRight,
          blastDirection: -3 * pi / 4, // toward bottom-left
          emissionFrequency: 0.04,
          numberOfParticles: 12,
          maxBlastForce: 20, minBlastForce: 8,
          gravity: 0.25,
          colors: _confettiColors,
        ),
      ),
      TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.6, end: 1.0),
        duration: const Duration(milliseconds: 500),
        curve: Curves.elasticOut,
        builder: (_, scale, child) => Transform.scale(scale: scale, child: child),
        child: _card(context),
      ),
    ]),
  );

  Widget _card(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(horizontal: 32),
    padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(28),
      boxShadow: [BoxShadow(color: Colors.black.withOpacity(.25), blurRadius: 30, offset: const Offset(0, 12))],
    ),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 112, height: 112,
        padding: const EdgeInsets.all(4),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(colors: [AppColors.amber, AppColors.pink], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        child: ClipOval(
          child: S3Image(
            s3Key: widget.photoKey,
            width: 104, height: 104,
            fallback: (_) => Container(
              color: AppColors.pinkLight,
              child: const Icon(Icons.person, color: AppColors.pink, size: 52),
            ),
          ),
        ),
      ),
      const SizedBox(height: 18),
      const Text('🎉  Happy Birthday!  🎉', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.text)),
      const SizedBox(height: 6),
      Text(widget.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.navy)),
      const SizedBox(height: 12),
      const Text(
        'Wishing you a wonderful day, from all of us at\nSatyam Stars International School!',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5),
      ),
      const SizedBox(height: 22),
      SizedBox(width: double.infinity, child: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          height: 48,
          decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(14)),
          child: const Center(child: Text('Thank You!',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
        ),
      )),
    ]),
  );
}
