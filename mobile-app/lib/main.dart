import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/theme/app_theme.dart';
import 'core/services/auth_service.dart';
import 'app/routes/app_pages.dart';
import 'app/routes/app_routes.dart';

// ⚠️  Replace these with your actual Supabase project values.
// Find them in: Supabase Dashboard → Settings → API
const _supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
const _supabaseKey = 'YOUR_ANON_KEY';

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

class SatyamSchoolApp extends StatelessWidget {
  const SatyamSchoolApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthService.to;
    String initialRoute = Routes.login;
    if (auth.isLoggedIn.value) {
      initialRoute = auth.role.value == UserRole.teacher
          ? Routes.teacherHome
          : Routes.studentHome;
    }

    return GetMaterialApp(
      title: 'Satyam School',
      theme: AppTheme.light,
      debugShowCheckedModeBanner: false,
      initialRoute: initialRoute,
      getPages: AppPages.routes,
    );
  }
}
