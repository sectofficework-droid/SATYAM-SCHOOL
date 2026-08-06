import 'package:get/get.dart';
import '../modules/splash/splash_screen.dart';
import '../modules/auth/views/login_view.dart';
import '../modules/auth/controllers/login_controller.dart';
import '../modules/student/dashboard/student_home.dart';
import '../modules/student/attendance/student_attendance_page.dart';
import '../modules/student/marks/student_marks_page.dart';
import '../modules/student/fees/student_fees_page.dart';
import '../modules/student/homework/student_homework_page.dart';
import '../modules/student/notices/student_notices_page.dart';
import '../modules/student/profile/student_profile_page.dart';
import '../modules/student/syllabus/student_syllabus_page.dart';
import '../modules/student/query/student_query_page.dart';
import '../modules/student/rules/student_rules_page.dart';
import '../modules/student/official_results/student_official_results_page.dart';
import 'app_routes.dart';

// Route table for the Student-flavor build only - the Teacher app's build
// never references (and never compiles in) any of these screens. See
// app_pages_teacher.dart for the mirror image.
class AppPagesStudent {
  static final routes = [
    GetPage(name: Routes.splash, page: () => const SplashScreen()),
    GetPage(
      name: Routes.login,
      page: () => const LoginView(),
      binding: BindingsBuilder(() => Get.lazyPut(() => LoginController())),
    ),
    GetPage(name: Routes.studentHome,     page: () => const StudentHome()),
    GetPage(name: Routes.studentAttend,   page: () => const StudentAttendancePage()),
    GetPage(name: Routes.studentMarks,    page: () => const StudentMarksPage()),
    GetPage(name: Routes.studentFees,     page: () => const StudentFeesPage()),
    GetPage(name: Routes.studentHomework, page: () => const StudentHomeworkPage()),
    GetPage(name: Routes.studentNotices,  page: () => const StudentNoticesPage()),
    GetPage(name: Routes.studentProfile,  page: () => const StudentProfilePage()),
    GetPage(name: Routes.studentSyllabus, page: () => const StudentSyllabusPage()),
    GetPage(name: Routes.studentQuery,    page: () => const StudentQueryPage()),
    GetPage(name: Routes.studentRules,    page: () => const StudentRulesPage()),
    GetPage(name: Routes.studentOfficialResults, page: () => const StudentOfficialResultsPage()),
  ];
}
