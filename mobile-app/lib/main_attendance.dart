import 'app_bootstrap.dart';
import 'app/routes/app_pages_attendance.dart';
import 'core/services/auth_service.dart';

// Entry point for the Attendance Kiosk flavor build - a standalone app
// meant for one shared device at the school entrance, not the Teacher or
// Student app. flutter run -t lib/main_attendance.dart --flavor attendance
Future<void> main() async {
  await runSatyamApp(role: UserRole.kiosk, pages: AppPagesAttendance.routes);
}
