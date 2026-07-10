import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

  static const _pages = [
    _StudentDashboard(),
    StudentAttendancePage(embedded: true),
    StudentMarksPage(embedded: true),
    StudentFeesPage(embedded: true),
    StudentNoticesPage(embedded: true),
  ];

  void _setTab(int i) {
    if (i == _tab) return;
    HapticFeedback.selectionClick();
    setState(() => _tab = i);
  }

  @override
  Widget build(BuildContext context) {
    final profile   = AuthService.to.profile.value ?? {};
    final firstName = profile['first_name'] as String? ?? '';
    final photoKey  = profile['photo_url'] as String?;
    final className = profile['class_name'] as String? ?? '';

    return Scaffold(
      extendBody: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          decoration: const BoxDecoration(gradient: AppColors.navyGradient),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello, $firstName',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white, fontFamily: 'Poppins')),
                  Text(className.isNotEmpty ? 'Class $className' : 'Student',
                    style: const TextStyle(fontSize: 11, color: Colors.white60, fontFamily: 'Poppins')),
                ])),
                GestureDetector(
                  onTap: () => Get.toNamed(Routes.studentProfile),
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withOpacity(.4), width: 2),
                    ),
                    child: ClipOval(child: StudentProfilePage.buildAvatar(photoKey, firstName, 20)),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.logout_rounded, color: Colors.white70, size: 20),
                  onPressed: () async {
                    HapticFeedback.mediumImpact();
                    final c = await Get.dialog<bool>(AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
                      content: const Text('Are you sure?'),
                      actions: [
                        TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
                        TextButton(onPressed: () => Get.back(result: true),
                          child: const Text('Sign Out', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700))),
                      ],
                    ));
                    if (c == true) AuthService.to.signOut();
                  },
                ),
              ]),
            ),
          ),
        ),
      ),
      body: _pages[_tab],
      bottomNavigationBar: _StudentBottomNav(currentIndex: _tab, onTap: _setTab),
    );
  }
}

class _StudentBottomNav extends StatelessWidget {
  final int currentIndex;
  final void Function(int) onTap;
  const _StudentBottomNav({required this.currentIndex, required this.onTap});

  static const _items = [
    (icon: Icons.home_outlined,                   active: Icons.home_rounded,                  label: 'Home'),
    (icon: Icons.event_note_outlined,             active: Icons.event_note_rounded,            label: 'Attendance'),
    (icon: Icons.bar_chart_outlined,              active: Icons.bar_chart_rounded,             label: 'Marks'),
    (icon: Icons.account_balance_wallet_outlined, active: Icons.account_balance_wallet_rounded, label: 'Fees'),
    (icon: Icons.notifications_outlined,          active: Icons.notifications_rounded,          label: 'Notices'),
  ];

  @override
  Widget build(BuildContext context) => Container(
    height: 72,
    decoration: BoxDecoration(color: Colors.white, boxShadow: AppShadows.nav),
    child: Row(
      children: List.generate(_items.length, (i) {
        final item   = _items[i];
        final active = currentIndex == i;
        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onTap(i),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                padding: EdgeInsets.symmetric(horizontal: active ? 16 : 10, vertical: 6),
                decoration: BoxDecoration(
                  color: active ? AppColors.navy.withOpacity(.08) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                  child: Icon(active ? item.active : item.icon,
                    key: ValueKey(active),
                    color: active ? AppColors.navy : AppColors.textHint,
                    size: active ? 24 : 22),
                ),
              ),
              const SizedBox(height: 2),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                  color: active ? AppColors.navy : AppColors.textHint,
                  fontFamily: 'Poppins',
                ),
                child: Text(item.label),
              ),
            ]),
          ),
        );
      }),
    ),
  );
}

// ── Student Dashboard ─────────────────────────────────────────────────────────

class _StudentDashboard extends StatelessWidget {
  const _StudentDashboard();

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    final profile     = AuthService.to.profile.value ?? {};
    final firstName   = profile['first_name'] as String? ?? '';
    final className   = profile['class_name'] as String? ?? '—';
    final sectionName = profile['section_name'] as String? ?? '';
    final rollNo      = profile['roll_no']?.toString() ?? '—';
    final enrollNo    = profile['enrollment_no']?.toString() ?? '—';
    final classLabel  = sectionName.isEmpty ? className : '$className - $sectionName';

    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 96),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Greeting banner
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(opacity: v,
            child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.navyMid, AppColors.navyDark],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.3), blurRadius: 20, offset: const Offset(0, 8))],
            ),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_greeting, style: const TextStyle(color: Colors.white60, fontSize: 13)),
                const SizedBox(height: 2),
                Text(firstName.isEmpty ? 'Student' : firstName,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
                const SizedBox(height: 8),
                Row(children: [
                  _infoBadge(Icons.class_rounded, classLabel),
                  const SizedBox(width: 8),
                  _infoBadge(Icons.numbers_rounded, 'Roll $rollNo'),
                ]),
                const SizedBox(height: 4),
                _infoBadge(Icons.confirmation_number_outlined, 'Enroll: $enrollNo'),
              ])),
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(.12),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withOpacity(.2)),
                ),
                child: const Icon(Icons.school_rounded, color: Colors.white, size: 34),
              ),
            ]),
          ),
        ),

        const SizedBox(height: 24),

        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(opacity: v,
            child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
          child: const Text('Quick Access',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
        ),
        const SizedBox(height: 12),

        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 800),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(opacity: v,
            child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
          child: GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12, mainAxisSpacing: 12,
            childAspectRatio: 1.1,
            children: [
              _Tile('Attendance',   Icons.event_note_rounded,            AppColors.green,  AppColors.greenLight,  () => Get.toNamed(Routes.studentAttend)),
              _Tile('Exam Marks',   Icons.bar_chart_rounded,             AppColors.blue,   AppColors.blueLight,   () => Get.toNamed(Routes.studentMarks)),
              _Tile('Fee Status',   Icons.account_balance_wallet_rounded, AppColors.amber, AppColors.amberLight,  () => Get.toNamed(Routes.studentFees)),
              _Tile('Homework',     Icons.assignment_rounded,            AppColors.purple, AppColors.purpleLight,  () => Get.toNamed(Routes.studentHomework)),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _infoBadge(IconData icon, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.white.withOpacity(.12),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: Colors.white.withOpacity(.2)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: Colors.white70, size: 12),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
    ]),
  );
}

class _Tile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bg;
  final VoidCallback onTap;
  const _Tile(this.label, this.icon, this.color, this.bg, this.onTap);

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: color.withOpacity(.12), blurRadius: 16, offset: const Offset(0, 4)),
          const BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 46, height: 46,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [color, color.withOpacity(.7)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: Colors.white, size: 24),
        ),
        const Spacer(),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
        const SizedBox(height: 2),
        const Text('Tap to view', style: TextStyle(fontSize: 10, color: AppColors.textHint)),
      ]),
    ),
  );
}
