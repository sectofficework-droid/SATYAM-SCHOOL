import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../routes/app_routes.dart';

// Idle screen for the shared attendance kiosk - no login, just a live clock
// and one big action. Staff walk up, tap Scan, and the punch screen figures
// out who they are from their face alone (see face_punch_page.dart).
class KioskHomePage extends StatefulWidget {
  const KioskHomePage({super.key});
  @override
  State<KioskHomePage> createState() => _KioskHomePageState();
}

class _KioskHomePageState extends State<KioskHomePage> {
  late Timer _clockTimer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _clockTimer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(gradient: AppColors.navyGradient),
      child: SafeArea(
        child: Column(children: [
          Align(
            alignment: Alignment.topRight,
            child: IconButton(
              icon: const Icon(Icons.settings_outlined, color: Colors.white54, size: 22),
              tooltip: 'Set up / update my face',
              onPressed: () => Get.toNamed(Routes.kioskEnrollLogin),
            ),
          ),
          const Spacer(),
          Container(
            width: 96, height: 96,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(.3), blurRadius: 30, offset: const Offset(0, 12))],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Image.asset('assets/images/school_logo.jpg', fit: BoxFit.contain),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('SATYAM STARS', style: TextStyle(
            color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1, fontFamily: 'Poppins')),
          const Text('Staff Attendance', style: TextStyle(
            color: Colors.white60, fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: 2, fontFamily: 'Poppins')),
          const SizedBox(height: 36),
          Text(DateFormat('h:mm:ss a').format(_now), style: const TextStyle(
            color: Colors.white, fontSize: 44, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
          const SizedBox(height: 4),
          Text(DateFormat('EEEE, d MMMM yyyy').format(_now), style: const TextStyle(
            color: Colors.white70, fontSize: 15, fontWeight: FontWeight.w500, fontFamily: 'Poppins')),
          const Spacer(),
          GestureDetector(
            onTap: () => Get.toNamed(Routes.kioskPunch),
            child: Container(
              width: 220, height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.amber,
                boxShadow: [BoxShadow(color: AppColors.amber.withOpacity(.5), blurRadius: 40, offset: const Offset(0, 12))],
              ),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.face_retouching_natural_rounded, color: AppColors.navyDark, size: 64),
                SizedBox(height: 10),
                Text('SCAN FACE', style: TextStyle(
                  color: AppColors.navyDark, fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 1, fontFamily: 'Poppins')),
                Text('to punch in / out', style: TextStyle(
                  color: AppColors.navyDark, fontSize: 12, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
              ]),
            ),
          ),
          const Spacer(flex: 2),
        ]),
      ),
    ),
  );
}
