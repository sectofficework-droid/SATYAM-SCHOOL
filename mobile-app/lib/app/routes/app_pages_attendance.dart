import 'package:get/get.dart';
import '../modules/splash/splash_screen.dart';
import '../modules/attendance_kiosk/kiosk_home_page.dart';
import '../modules/attendance_kiosk/face_punch_page.dart';
import '../modules/attendance_kiosk/staff_enroll_list_page.dart';
import '../modules/attendance_kiosk/face_enroll_capture_page.dart';
import '../modules/attendance_kiosk/enter_punch_code_page.dart';
import '../modules/attendance_kiosk/qr_punch_page.dart';
import 'app_routes.dart';

// Route table for the standalone Attendance Kiosk flavor - a separate app
// from Teacher/Student (see main_attendance.dart), so it only ever needs
// its own screens, never the login/home routes the other two flavors
// register.
class AppPagesAttendance {
  static final routes = [
    GetPage(name: Routes.splash, page: () => const SplashScreen()),
    GetPage(name: Routes.kioskHome, page: () => const KioskHomePage()),
    GetPage(name: Routes.kioskPunch, page: () => const FacePunchPage()),
    GetPage(name: Routes.kioskEnrollList, page: () => const StaffEnrollListPage()),
    GetPage(name: Routes.kioskEnrollCapture, page: () => const FaceEnrollCapturePage()),
    GetPage(name: Routes.kioskEnterCode, page: () => const EnterPunchCodePage()),
    GetPage(name: Routes.kioskQrPunch, page: () => const QrPunchPage()),
  ];
}
