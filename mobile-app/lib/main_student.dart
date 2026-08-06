import 'app_bootstrap.dart';
import 'app/routes/app_pages_student.dart';
import 'core/services/auth_service.dart';

// Entry point for the Student flavor build:
// flutter run -t lib/main_student.dart --flavor student
Future<void> main() async {
  await runSatyamApp(role: UserRole.student, pages: AppPagesStudent.routes);
}
