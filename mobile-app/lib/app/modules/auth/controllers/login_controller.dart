import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/app_config.dart';
import '../../../../app/routes/app_routes.dart';

class LoginController extends GetxController {
  // Each flavor build is locked to one role (see AppConfig) - there's no
  // Teacher/Student tab to switch between anymore, so this is a plain
  // getter, not an Rx.
  UserRole get role => AppConfig.lockedRole;

  final loading  = false.obs;
  final errorMsg = ''.obs;
  final showPass = false.obs;

  final idCtrl   = TextEditingController();
  final passCtrl = TextEditingController();

  @override
  void onClose() {
    idCtrl.dispose();
    passCtrl.dispose();
    super.onClose();
  }

  Future<void> login() async {
    errorMsg.value = '';
    final id   = idCtrl.text.trim();
    final pass = passCtrl.text;
    if (id.isEmpty)   { errorMsg.value = 'Enter your ${role == UserRole.teacher ? "Employee Code" : "Enrollment No."}'; return; }
    if (pass.isEmpty) { errorMsg.value = 'Enter your password'; return; }

    loading.value = true;
    final err = role == UserRole.teacher
        ? await AuthService.to.loginTeacher(id, pass)
        : await AuthService.to.loginStudent(id, pass);
    loading.value = false;

    if (err != null) {
      errorMsg.value = err;
      return;
    }

    Get.offAllNamed(role == UserRole.teacher ? Routes.teacherHome : Routes.studentHome);
  }
}
