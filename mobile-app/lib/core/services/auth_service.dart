import 'dart:convert';
import 'package:get/get.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'supabase_service.dart';
import '../app_config.dart';

// kiosk: the standalone Attendance flavor - never persists a session (see
// runSatyamApp/AppConfig), so AuthService's login/session methods below are
// only ever used by the teacher/student flavors.
enum UserRole { teacher, student, kiosk, none }

class AuthService extends GetxService {
  static AuthService get to => Get.find();

  final _storage = const FlutterSecureStorage();

  final role       = UserRole.none.obs;
  final profile    = Rx<Map<String, dynamic>?>(null);
  final isLoggedIn = false.obs;

  // Sibling profile switcher (Student app only) - real enrolled students an
  // admin has linked to the current one via student_siblings.sibling_student_id
  // (see SUPABASE_SIBLING_SWITCHER.sql). Cached summaries for the Home
  // dashboard's switcher row: [{id, first_name, last_name, photo_url,
  // class_name, section_name}].
  final linkedSiblings = <Map<String, dynamic>>[].obs;

  Future<void> initSession() async {
    final roleStr     = await _storage.read(key: 'user_role');
    final profileJson = await _storage.read(key: 'user_profile');
    if (roleStr == null || profileJson == null) return;

    // Each build is locked to one role (see AppConfig) - but on Windows
    // desktop specifically, the teacher and student builds share the same
    // flutter_secure_storage (same exe identity; unlike Android, which gets
    // separate encrypted storage per flavor's applicationId for free), so
    // logging into one flavor on a dev machine and then launching the other
    // could otherwise silently restore the WRONG role's cached session -
    // e.g. a teacher-locked build showing a student's profile data inside
    // its own teacher-shaped Home screen. Never restore a session whose
    // role doesn't match this build's locked role; just drop the stale
    // cache instead, same as if nobody had ever logged in on this build.
    final expectedRole = AppConfig.lockedRole == UserRole.teacher ? 'teacher' : 'student';
    if (AppConfig.lockedRole != UserRole.kiosk && roleStr != expectedRole) {
      await _storage.delete(key: 'user_role');
      await _storage.delete(key: 'user_profile');
      return;
    }

    try {
      final p = jsonDecode(profileJson) as Map<String, dynamic>;
      profile.value    = p;
      role.value       = roleStr == 'teacher' ? UserRole.teacher : UserRole.student;
      isLoggedIn.value = true;
      if (role.value == UserRole.student) await refreshLinkedSiblings();
    } catch (_) {}
  }

  Future<String?> loginTeacher(String empId, String password) async {
    try {
      final result = await SupabaseService.client.rpc(
        'teacher_login',
        params: {'p_employee_id': empId.trim(), 'p_password': password},
      );
      if (result == null) return 'Incorrect Employee ID or password.';
      final p = (result is Map) ? Map<String, dynamic>.from(result) : jsonDecode(result as String) as Map<String, dynamic>;
      await _saveSession('teacher', p);
      return null;
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  Future<String?> loginStudent(String enrollNo, String password) async {
    try {
      final result = await SupabaseService.client.rpc(
        'student_login',
        params: {'p_enrollment_no': enrollNo.trim(), 'p_password': password},
      );
      if (result == null) return 'Incorrect Enrollment No. or password.';
      final p = (result is Map) ? Map<String, dynamic>.from(result) : jsonDecode(result as String) as Map<String, dynamic>;
      await _saveSession('student', p);
      await refreshLinkedSiblings();
      return null;
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  // Re-fetches which real, admin-linked siblings the CURRENTLY active
  // student has - called after login, session restore, and after switching
  // (so the strip reflects the newly-active student's own siblings, not the
  // one just switched away from).
  Future<void> refreshLinkedSiblings() async {
    final studentId = profile.value?['id'] as String?;
    if (studentId == null) { linkedSiblings.clear(); return; }
    try {
      final result = await SupabaseService.client.rpc(
        'get_linked_siblings',
        params: {'p_student_id': studentId},
      );
      final list = (result is List) ? result : (jsonDecode(result as String? ?? '[]') as List);
      linkedSiblings.value = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      linkedSiblings.clear();
    }
  }

  // Switches the active session to a linked sibling's own full profile, no
  // password - get_sibling_profile only returns data when student_siblings
  // genuinely links the two ids (set by an admin), so this can't be used to
  // reach an arbitrary student. Reuses the same _saveSession path login
  // already uses, so the switched-to sibling becomes a normal fully-active
  // session, not a special "viewing" mode.
  Future<String?> switchToSibling(String targetStudentId) async {
    final currentId = profile.value?['id'] as String?;
    if (currentId == null) return 'No active session.';
    try {
      final result = await SupabaseService.client.rpc(
        'get_sibling_profile',
        params: {'p_current_student_id': currentId, 'p_target_student_id': targetStudentId},
      );
      if (result == null) return 'Could not switch profile - this student is no longer linked as a sibling.';
      final p = (result is Map) ? Map<String, dynamic>.from(result) : jsonDecode(result as String) as Map<String, dynamic>;
      await _saveSession('student', p);
      await refreshLinkedSiblings();
      return null;
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  // Redeems a one-time admin-generated access code (see
  // mobile-app/SUPABASE_IMPERSONATION.sql) and logs straight into that
  // student's/teacher's account - no password needed. `role` is always
  // AppConfig.lockedRole (this build's own fixed role, never user-typed),
  // so a code generated for a student can't be redeemed inside the teacher
  // app build or vice versa. Reuses _saveSession, so the resulting session
  // is indistinguishable from a normal login.
  Future<String?> loginWithAccessCode(String code, UserRole role) async {
    try {
      final result = await SupabaseService.client.rpc(
        'redeem_impersonation_code',
        params: {
          'p_code': code.trim(),
          'p_expected_role': role == UserRole.teacher ? 'teacher' : 'student',
        },
      );
      if (result == null) return 'Invalid or expired code.';
      final p = (result is Map) ? Map<String, dynamic>.from(result) : jsonDecode(result as String) as Map<String, dynamic>;
      await _saveSession(role == UserRole.teacher ? 'teacher' : 'student', p);
      return null;
    } on PostgrestException catch (e) {
      // The RPC's RAISE EXCEPTION text is already a human-readable message
      // ("This code has expired.", "This code has already been used.", etc.)
      return e.message;
    } catch (e) {
      return _friendlyError(e.toString());
    }
  }

  Future<void> _saveSession(String roleStr, Map<String, dynamic> p) async {
    await _storage.write(key: 'user_role',    value: roleStr);
    await _storage.write(key: 'user_profile', value: jsonEncode(p));
    profile.value    = p;
    role.value       = roleStr == 'teacher' ? UserRole.teacher : UserRole.student;
    isLoggedIn.value = true;
  }

  // Merges fields (e.g. after a profile edit) into the cached session
  // without a full re-login, and re-persists so it survives an app restart.
  Future<void> updateProfileFields(Map<String, dynamic> patch) async {
    if (profile.value == null) return;
    final updated = {...profile.value!, ...patch};
    await _storage.write(key: 'user_profile', value: jsonEncode(updated));
    profile.value = updated;
  }

  Future<void> signOut() async {
    await _storage.delete(key: 'user_role');
    await _storage.delete(key: 'user_profile');
    profile.value    = null;
    role.value       = UserRole.none;
    isLoggedIn.value = false;
    linkedSiblings.clear();
    Get.offAllNamed('/login');
  }

  String _friendlyError(String raw) {
    if (raw.contains('network') || raw.contains('SocketException')) return 'No internet connection.';
    return 'Something went wrong. Please try again.';
  }
}
