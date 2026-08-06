import 'app_bootstrap.dart';
import 'app/routes/app_pages_teacher.dart';
import 'core/services/auth_service.dart';

// Entry point for the Teacher flavor build:
// flutter run -t lib/main_teacher.dart --flavor teacher
Future<void> main() async {
  await runSatyamApp(role: UserRole.teacher, pages: AppPagesTeacher.routes);
}
