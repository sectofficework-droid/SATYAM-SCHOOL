import 'package:get/get.dart';
import '../modules/splash/splash_screen.dart';
import '../modules/auth/views/login_view.dart';
import '../modules/auth/controllers/login_controller.dart';
import '../modules/teacher/dashboard/teacher_home.dart';
import '../modules/teacher/attendance/teacher_attendance_page.dart';
import '../modules/teacher/my_attendance/teacher_my_attendance_page.dart';
import '../modules/teacher/students/teacher_students_page.dart';
import '../modules/teacher/marks/teacher_marks_page.dart';
import '../modules/teacher/homework/teacher_homework_page.dart';
import '../modules/teacher/tasks/teacher_tasks_page.dart';
import '../modules/teacher/question_bank/teacher_question_bank_page.dart';
import '../modules/teacher/question_bank/teacher_create_paper_page.dart';
import '../modules/teacher/calendar/teacher_calendar_page.dart';
import '../modules/teacher/notices/teacher_notices_page.dart';
import '../modules/teacher/profile/teacher_profile_page.dart';
import '../modules/teacher/syllabus/teacher_syllabus_page.dart';
import '../modules/teacher/query/teacher_query_page.dart';
import '../modules/teacher/rules/teacher_rules_page.dart';
import '../modules/teacher/official_exams/teacher_official_exams_page.dart';
import 'app_routes.dart';

// Route table for the Teacher-flavor build only - the Student app's build
// never references (and never compiles in) any of these screens. See
// app_pages_student.dart for the mirror image.
class AppPagesTeacher {
  static final routes = [
    GetPage(name: Routes.splash, page: () => const SplashScreen()),
    GetPage(
      name: Routes.login,
      page: () => const LoginView(),
      binding: BindingsBuilder(() => Get.lazyPut(() => LoginController())),
    ),
    GetPage(name: Routes.teacherHome,     page: () => const TeacherHome()),
    GetPage(name: Routes.teacherAttend,   page: () => const TeacherAttendancePage()),
    GetPage(name: Routes.teacherMyAttend, page: () => const TeacherMyAttendancePage()),
    GetPage(name: Routes.teacherStudents, page: () => const TeacherStudentsPage()),
    GetPage(name: Routes.teacherMarks,    page: () => const TeacherMarksPage()),
    GetPage(name: Routes.teacherHomework, page: () => const TeacherHomeworkPage()),
    GetPage(name: Routes.teacherTasks,    page: () => const TeacherTasksPage()),
    GetPage(name: Routes.teacherQuestionBank, page: () => const TeacherQuestionBankPage()),
    GetPage(name: Routes.teacherCreatePaper, page: () => const TeacherCreatePaperPage()),
    GetPage(name: Routes.teacherCalendar, page: () => const TeacherCalendarPage()),
    GetPage(name: Routes.teacherNotices,  page: () => const TeacherNoticesPage()),
    GetPage(name: Routes.teacherProfile,  page: () => const TeacherProfilePage()),
    GetPage(name: Routes.teacherSyllabus, page: () => const TeacherSyllabusPage()),
    GetPage(name: Routes.teacherQuery,    page: () => const TeacherQueryPage()),
    GetPage(name: Routes.teacherRules,    page: () => const TeacherRulesPage()),
    GetPage(name: Routes.teacherOfficialExams, page: () => const TeacherOfficialExamsPage()),
  ];
}
