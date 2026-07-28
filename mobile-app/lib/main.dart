import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/theme/app_theme.dart';
import 'core/services/auth_service.dart';
import 'app/routes/app_pages.dart';
import 'app/routes/app_routes.dart';

const _supabaseUrl = 'https://hxkowdaugkkumvzyfsai.supabase.co';
const _supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a293ZGF1Z2trdW12enlmc2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDY0MDksImV4cCI6MjA5NzIyMjQwOX0.uD3gr1gggx6h0wfgT4ee-QOK0krb4TT08_iXorN4wU0';

const adminPanelUrl = 'https://satyam-stars-international-school-admin-61n7y0ovt.vercel.app';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  await Supabase.initialize(url: _supabaseUrl, anonKey: _supabaseKey);

  // Register and initialise AuthService (restores session from secure storage)
  final authService = Get.put(AuthService());
  await authService.initSession();

  runApp(const SatyamSchoolApp());
}

class SatyamSchoolApp extends StatefulWidget {
  const SatyamSchoolApp({super.key});

  @override
  State<SatyamSchoolApp> createState() => _SatyamSchoolAppState();
}

// Replays the splash intro whenever the app comes back to the foreground
// after having been away for a while - e.g. closed today and reopened
// tomorrow without logging out. On Android/iOS the OS often keeps the
// Flutter engine alive when an app is "closed" (swiped from recents), so
// main() never reruns and the app would otherwise just resume straight to
// whatever screen was last open, skipping the intro entirely. A short
// threshold avoids replaying it for brief interruptions like the camera/
// gallery picker used by photo uploads.
class _SatyamSchoolAppState extends State<SatyamSchoolApp> with WidgetsBindingObserver {
  static const _replayThreshold = Duration(minutes: 5);
  DateTime? _pausedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _pausedAt = DateTime.now();
      return;
    }
    if (state != AppLifecycleState.resumed || _pausedAt == null) return;

    final awayFor = DateTime.now().difference(_pausedAt!);
    _pausedAt = null;
    if (awayFor < _replayThreshold) return;

    final current = Get.currentRoute;
    if (current != Routes.splash && current != Routes.login) {
      Get.offAllNamed(Routes.splash);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'Satyam School',
      theme: AppTheme.light,
      debugShowCheckedModeBanner: false,
      defaultTransition: Transition.cupertino,
      transitionDuration: const Duration(milliseconds: 280),
      initialRoute: Routes.splash,
      getPages: AppPages.routes,
    );
  }
}
