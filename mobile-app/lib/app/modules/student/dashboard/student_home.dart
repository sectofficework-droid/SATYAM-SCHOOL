import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../profile/student_profile_page.dart';
import '../attendance/student_attendance_page.dart';
import '../marks/student_marks_page.dart';
import '../fees/student_fees_page.dart';
import '../homework/student_homework_page.dart';
import '../notices/student_notices_page.dart';
import '../../../../app/routes/app_routes.dart';

class StudentHome extends StatefulWidget {
  const StudentHome({super.key});
  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  int _tab = 0;

  final _pages = const [
    _StudentDashboard(),
    StudentAttendancePage(embedded: true),
    StudentMarksPage(embedded: true),
    StudentFeesPage(embedded: true),
    StudentNoticesPage(embedded: true),
  ];

  @override
  Widget build(BuildContext context) {
    final profile    = AuthService.to.profile.value ?? {};
    final name       = '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'.trim();
    final className  = profile['class_name']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hello, ${name.split(' ').first}',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            Text(className.isNotEmpty ? 'Class $className' : 'Student',
              style: const TextStyle(fontSize: 11, color: Colors.white60)),
          ],
        ),
        actions: [
          GestureDetector(
            onTap: () => Get.toNamed(Routes.studentProfile),
            child: Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ClipOval(
                child: SizedBox(
                  width: 36, height: 36,
                  child: StudentProfilePage.buildAvatar(
                    profile['photo_url'] as String?, name, 18),
                ),
              ),
            ),
          ),
          IconButton(icon: const Icon(Icons.logout),
            onPressed: () async {
              final c = await Get.dialog<bool>(AlertDialog(
                title: const Text('Sign Out'),
                content: const Text('Are you sure?'),
                actions: [
                  TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
                  TextButton(onPressed: () => Get.back(result: true),
                    child: const Text('Sign Out', style: TextStyle(color: AppColors.red))),
                ],
              ));
              if (c == true) AuthService.to.signOut();
            }),
        ],
      ),
      body: _pages[_tab],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
        child: BottomNavigationBar(
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.event_note_outlined), activeIcon: Icon(Icons.event_note), label: 'Attendance'),
            BottomNavigationBarItem(icon: Icon(Icons.bar_chart_outlined), activeIcon: Icon(Icons.bar_chart), label: 'Marks'),
            BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), activeIcon: Icon(Icons.account_balance_wallet), label: 'Fees'),
            BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), activeIcon: Icon(Icons.notifications), label: 'Notices'),
          ],
        ),
      ),
    );
  }
}

class _StudentDashboard extends StatelessWidget {
  const _StudentDashboard();

  @override
  Widget build(BuildContext context) {
    final profile    = AuthService.to.profile.value ?? {};
    final className  = profile['class_name']?.toString() ?? '—';
    final section    = profile['section_name']?.toString() ?? '';
    final rollNo     = profile['roll_no']?.toString() ?? '—';
    final enrollNo   = profile['enrollment_no']?.toString() ?? '—';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.navy, AppColors.navyDark],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(children: [
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(section.isNotEmpty ? '$className · $section' : className,
                    style: const TextStyle(color: Colors.white60, fontSize: 12)),
                  Text(className, style: const TextStyle(
                    color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
                  Text('Enroll: $enrollNo  ·  Roll: $rollNo',
                    style: const TextStyle(color: AppColors.amber, fontSize: 11)),
                ],
              )),
              Container(
                width: 60, height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.school, color: Colors.white, size: 30),
              ),
            ]),
          ),

          const SizedBox(height: 20),
          const Text('Quick Access',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
          const SizedBox(height: 12),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12, mainAxisSpacing: 12,
            childAspectRatio: 1.2,
            children: [
              _tile('Attendance', Icons.event_note, AppColors.green,  AppColors.greenLight,  () => Get.toNamed(Routes.studentAttend)),
              _tile('Exam Marks', Icons.bar_chart,  AppColors.blue,   AppColors.blueLight,   () => Get.toNamed(Routes.studentMarks)),
              _tile('Fee Status', Icons.account_balance_wallet, AppColors.amber, AppColors.amberLight, () => Get.toNamed(Routes.studentFees)),
              _tile('Homework',   Icons.assignment,  AppColors.navy,   const Color(0xFFE0E7FF), () => Get.toNamed(Routes.studentHomework)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _tile(String label, IconData icon, Color color, Color bg, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color, size: 22),
              ),
              const Spacer(),
              Text(label, style: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
            ],
          ),
        ),
      );
}
