import 'package:get/get.dart';
import '../modules/splash/splash_screen.dart';
import '../modules/auth/views/login_view.dart';
import '../modules/auth/controllers/login_controller.dart';
import '../modules/teacher/dashboard/teacher_home.dart';
import '../modules/teacher/attendance/teacher_attendance_page.dart';
import '../modules/teacher/marks/teacher_marks_page.dart';
import '../modules/teacher/homework/teacher_homework_page.dart';
import '../modules/teacher/tasks/teacher_tasks_page.dart';
import '../modules/teacher/notices/teacher_notices_page.dart';
import '../modules/teacher/profile/teacher_profile_page.dart';
import '../modules/student/dashboard/student_home.dart';
import '../modules/student/attendance/student_attendance_page.dart';
import '../modules/student/marks/student_marks_page.dart';
import '../modules/student/fees/student_fees_page.dart';
import '../modules/student/homework/student_homework_page.dart';
import '../modules/student/notices/student_notices_page.dart';
import '../modules/student/profile/student_profile_page.dart';
import 'app_routes.dart';

class AppPages {
  static final routes = [
    GetPage(name: Routes.splash, page: () => const SplashScreen()),
    GetPage(
      name: Routes.login,
      page: () => const LoginView(),
      binding: BindingsBuilder(() => Get.lazyPut(() => LoginController())),
    ),

    // ── Teacher ──────────────────────────────────────────────────────────────
    GetPage(name: Routes.teacherHome,     page: () => const TeacherHome()),
    GetPage(name: Routes.teacherAttend,   page: () => const TeacherAttendancePage()),
    GetPage(name: Routes.teacherMarks,    page: () => const TeacherMarksPage()),
    GetPage(name: Routes.teacherHomework, page: () => const TeacherHomeworkPage()),
    GetPage(name: Routes.teacherTasks,    page: () => const TeacherTasksPage()),
    GetPage(name: Routes.teacherNotices,  page: () => const TeacherNoticesPage()),
    GetPage(name: Routes.teacherProfile,  page: () => const TeacherProfilePage()),

    // ── Student ──────────────────────────────────────────────────────────────
    GetPage(name: Routes.studentHome,     page: () => const StudentHome()),
    GetPage(name: Routes.studentAttend,   page: () => const StudentAttendancePage()),
    GetPage(name: Routes.studentMarks,    page: () => const StudentMarksPage()),
    GetPage(name: Routes.studentFees,     page: () => const StudentFeesPage()),
    GetPage(name: Routes.studentHomework, page: () => const StudentHomeworkPage()),
    GetPage(name: Routes.studentNotices,  page: () => const StudentNoticesPage()),
    GetPage(name: Routes.studentProfile,  page: () => const StudentProfilePage()),
  ];
}
