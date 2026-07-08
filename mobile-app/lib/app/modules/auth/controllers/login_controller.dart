import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../app/routes/app_routes.dart';

enum LoginTab { teacher, student }

class LoginController extends GetxController {
  final tab         = LoginTab.teacher.obs;
  final loading     = false.obs;
  final errorMsg    = ''.obs;
  final showPass    = false.obs;

  final idCtrl   = TextEditingController();
  final passCtrl = TextEditingController();

  @override
  void onClose() {
    idCtrl.dispose();
    passCtrl.dispose();
    super.onClose();
  }

  void switchTab(LoginTab t) {
    tab.value  = t;
    errorMsg.value = '';
    idCtrl.clear();
    passCtrl.clear();
  }

  Future<void> login() async {
    errorMsg.value = '';
    final id   = idCtrl.text.trim();
    final pass = passCtrl.text;
    if (id.isEmpty)   { errorMsg.value = 'Enter your ${tab.value == LoginTab.teacher ? "Employee Code" : "Enrollment No."}'; return; }
    if (pass.isEmpty) { errorMsg.value = 'Enter your password'; return; }

    loading.value = true;
    final err = tab.value == LoginTab.teacher
        ? await AuthService.to.loginTeacher(id, pass)
        : await AuthService.to.loginStudent(id, pass);
    loading.value = false;

    if (err != null) {
      errorMsg.value = err;
      return;
    }

    final role = AuthService.to.role.value;
    Get.offAllNamed(role == UserRole.teacher ? Routes.teacherHome : Routes.studentHome);
  }
}
