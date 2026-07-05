import 'package:get/get.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'supabase_service.dart';

enum UserRole { teacher, student, none }

class AuthService extends GetxService {
  static AuthService get to => Get.find();

  final _storage = const FlutterSecureStorage();

  final role       = UserRole.none.obs;
  final profile    = Rx<Map<String, dynamic>?>(null);
  final isLoggedIn = false.obs;

  /// Called explicitly from main() before runApp so the initial route is correct.
  Future<void> initSession() => _restoreSession();

  Future<void> _restoreSession() async {
    final user = SupabaseService.currentUser;
    if (user == null) return;

    final savedRole = await _storage.read(key: 'user_role');
    if (savedRole == 'teacher') {
      await _loadTeacherProfile(user.id);
    } else if (savedRole == 'student') {
      await _loadStudentProfile(user.id);
    }
  }

  Future<String?> loginTeacher(String empId, String password) async {
    try {
      final res = await SupabaseService.signInTeacher(empId, password);
      if (res.user == null) return 'Login failed. Check Employee ID and password.';
      await _storage.write(key: 'user_role', value: 'teacher');
      await _loadTeacherProfile(res.user!.id);
      return null; // success
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  Future<String?> loginStudent(String enrollNo, String password) async {
    try {
      final res = await SupabaseService.signInStudent(enrollNo, password);
      if (res.user == null) return 'Login failed. Check Enrollment No. and password.';
      await _storage.write(key: 'user_role', value: 'student');
      await _loadStudentProfile(res.user!.id);
      return null;
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  Future<void> _loadTeacherProfile(String userId) async {
    final data = await SupabaseService.fetchTeacherProfile(userId);
    if (data == null) {
      await signOut();
      return;
    }
    profile.value  = data;
    role.value     = UserRole.teacher;
    isLoggedIn.value = true;
  }

  Future<void> _loadStudentProfile(String userId) async {
    final data = await SupabaseService.fetchStudentProfile(userId);
    if (data == null) {
      await signOut();
      return;
    }
    profile.value  = data;
    role.value     = UserRole.student;
    isLoggedIn.value = true;
  }

  Future<void> signOut() async {
    await SupabaseService.signOut();
    await _storage.delete(key: 'user_role');
    profile.value    = null;
    role.value       = UserRole.none;
    isLoggedIn.value = false;
    Get.offAllNamed('/login');
  }

  String _friendlyError(String raw) {
    if (raw.contains('Invalid login credentials')) return 'Incorrect ID or password.';
    if (raw.contains('Email not confirmed'))        return 'Account not activated. Contact admin.';
    if (raw.contains('network'))                    return 'No internet connection.';
    return 'Something went wrong. Please try again.';
  }
}
