import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../app/routes/app_routes.dart';
import '../attendance/teacher_attendance_page.dart';
import '../marks/teacher_marks_page.dart';
import '../homework/teacher_homework_page.dart';
import '../notices/teacher_notices_page.dart';
import 'teacher_dashboard_tab.dart';

class TeacherHome extends StatefulWidget {
  const TeacherHome({super.key});
  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> {
  int _tab = 0;

  final _pages = const [
    TeacherDashboardTab(),
    TeacherAttendancePage(embedded: true),
    TeacherMarksPage(embedded: true),
    TeacherHomeworkPage(embedded: true),
    TeacherNoticesPage(embedded: true),
  ];

  @override
  Widget build(BuildContext context) {
    final profile = AuthService.to.profile.value ?? {};
    final name    = profile['name'] ?? 'Teacher';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hello, ${name.split(' ').first}',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            Text(profile['designation'] ?? profile['type'] ?? '',
              style: const TextStyle(fontSize: 11, color: Colors.white60)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => Get.toNamed(Routes.teacherProfile),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final confirm = await Get.dialog<bool>(AlertDialog(
                title: const Text('Sign Out'),
                content: const Text('Are you sure you want to sign out?'),
                actions: [
                  TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
                  TextButton(onPressed: () => Get.back(result: true),  child: const Text('Sign Out',
                    style: TextStyle(color: AppColors.red))),
                ],
              ));
              if (confirm == true) AuthService.to.signOut();
            },
          ),
        ],
      ),
      body: _pages[_tab],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.fact_check_outlined), activeIcon: Icon(Icons.fact_check), label: 'Attendance'),
            BottomNavigationBarItem(icon: Icon(Icons.grading_outlined), activeIcon: Icon(Icons.grading), label: 'Marks'),
            BottomNavigationBarItem(icon: Icon(Icons.assignment_outlined), activeIcon: Icon(Icons.assignment), label: 'Homework'),
            BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), activeIcon: Icon(Icons.notifications), label: 'Notices'),
          ],
        ),
      ),
    );
  }
}
