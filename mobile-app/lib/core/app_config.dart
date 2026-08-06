import 'services/auth_service.dart';

/// The single role this build is locked to - set once at startup by
/// main_teacher.dart / main_student.dart, before runApp. Read by the splash
/// screen (which home route to restore a session into) and the login screen
/// (which role to log in as - a locked build has no Teacher/Student picker).
class AppConfig {
  static late final UserRole lockedRole;
}
