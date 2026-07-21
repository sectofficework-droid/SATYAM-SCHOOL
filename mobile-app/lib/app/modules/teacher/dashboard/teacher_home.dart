import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/recent_notices.dart';
import '../../../../common/widgets/s3_image.dart';
import '../../../../common/widgets/notification_bell.dart';
import '../../../../common/widgets/recent_notices_sheet.dart';
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

class _TeacherHomeState extends State<TeacherHome> with SingleTickerProviderStateMixin {
  int _tab = 0;
  List<Map<String, dynamic>> _recent = [];

  static const _pages = [
    TeacherDashboardTab(),
    TeacherAttendancePage(embedded: true),
    TeacherMarksPage(embedded: true),
    TeacherHomeworkPage(embedded: true),
    TeacherNoticesPage(embedded: true),
  ];

  static const _noticesTabIndex = 4;
  String? _userKey; // 'teacher_<employeeId>', used for once-a-day popup + swipe dismissals

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadNotifications());
  }

  Future<void> _loadNotifications() async {
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    if (employeeId == null) return;
    _userKey = 'teacher_$employeeId';

    // Merge Notices with newly assigned Tasks into one feed - a task
    // assignment is "something new for this teacher" the same way a notice
    // is, and previously only showed up on the separate My Tasks screen.
    final notices = await SupabaseService.fetchNotices(
      audiences: const ['Everyone', 'All Staff', 'Management'],
    );
    final taskAssignments = await SupabaseService.fetchTeacherTasks(employeeId);
    final combined = [...notices, ...taskAssignments.map(taskAsNoticeItem)];

    final visible = await visibleRecentNotices(combined, _userKey!);
    if (!mounted) return;
    setState(() => _recent = visible);
    if (visible.isEmpty) return;

    final shouldShow = await shouldShowNoticePopupToday('notif_popup_shown_teacher_$employeeId');
    if (shouldShow && mounted) _showNotifications();
  }

  void _showNotifications() {
    if (_userKey == null) return;
    showRecentNoticesSheet(
      context,
      notices: _recent,
      userKey: _userKey!,
      onViewAll: () => _setTab(_noticesTabIndex),
      onDismissed: (notice) => setState(() => _recent.removeWhere((n) => n['id'] == notice['id'])),
      onItemTap: (notice) { if (notice['_isTask'] == true) Get.toNamed(Routes.teacherTasks); },
    );
  }

  void _setTab(int i) {
    if (i == _tab) return;
    HapticFeedback.selectionClick();
    setState(() => _tab = i);
  }

  @override
  Widget build(BuildContext context) {
    final profile = AuthService.to.profile.value ?? {};
    final name    = profile['name'] as String? ?? 'Teacher';
    final className  = profile['class_name'] as String? ?? '';
    final sectionName = profile['section_name'] as String? ?? '';
    final classLabel  = className.isEmpty ? '' : (sectionName.isEmpty ? className : '$className - $sectionName');

    return Scaffold(
      extendBody: true,
      body: _pages[_tab],
      appBar: _buildAppBar(profile, name, classLabel),
      bottomNavigationBar: _AnimatedBottomNav(currentIndex: _tab, onTap: _setTab),
    );
  }

  PreferredSizeWidget _buildAppBar(Map profile, String name, String classLabel) {
    final photoKey = profile['photo_url'] as String?;
    return PreferredSize(
      preferredSize: const Size.fromHeight(64),
      child: Container(
        decoration: const BoxDecoration(gradient: AppColors.navyGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Hello, ${name.split(' ').first}',
                      style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white, fontFamily: 'Poppins')),
                    if (classLabel.isNotEmpty)
                      Text('Class Teacher · $classLabel',
                        style: const TextStyle(fontSize: 11, color: Colors.white60, fontFamily: 'Poppins')),
                  ],
                ),
              ),
              NotificationBell(
                count: _recent.length,
                onTap: _showNotifications,
              ),
              const SizedBox(width: 14),
              GestureDetector(
                onTap: () => Get.toNamed(Routes.teacherProfile),
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withOpacity(.4), width: 2),
                  ),
                  child: ClipOval(
                    child: S3Image(
                      s3Key: photoKey,
                      width: 40, height: 40,
                      fallback: (_) => Container(
                        color: Colors.white.withOpacity(.2),
                        child: const Icon(Icons.person, color: Colors.white, size: 22),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton(
                icon: const Icon(Icons.logout_rounded, color: Colors.white70, size: 20),
                onPressed: () async {
                  HapticFeedback.mediumImpact();
                  final confirm = await Get.dialog<bool>(AlertDialog(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
                    content: const Text('Are you sure you want to sign out?'),
                    actions: [
                      TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
                      TextButton(
                        onPressed: () => Get.back(result: true),
                        child: const Text('Sign Out', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700))),
                    ],
                  ));
                  if (confirm == true) AuthService.to.signOut();
                },
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Animated Bottom Navigation Bar
// ──────────────────────────────────────────────────────────────────────────────

class _AnimatedBottomNav extends StatelessWidget {
  final int currentIndex;
  final void Function(int) onTap;

  const _AnimatedBottomNav({required this.currentIndex, required this.onTap});

  static const _items = [
    _NavItem(icon: Icons.home_outlined,          active: Icons.home_rounded,       label: 'Home'),
    _NavItem(icon: Icons.fact_check_outlined,    active: Icons.fact_check_rounded, label: 'Attendance'),
    _NavItem(icon: Icons.grading_outlined,       active: Icons.grading,            label: 'Marks'),
    _NavItem(icon: Icons.assignment_outlined,    active: Icons.assignment_rounded,  label: 'Homework'),
    _NavItem(icon: Icons.notifications_outlined, active: Icons.notifications_rounded, label: 'Notices'),
  ];

  @override
  Widget build(BuildContext context) => Container(
    height: 72,
    decoration: BoxDecoration(
      color: Colors.white,
      boxShadow: AppShadows.nav,
    ),
    child: Row(
      children: List.generate(_items.length, (i) {
        final item  = _items[i];
        final active = currentIndex == i;
        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onTap(i),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  curve: Curves.easeOutCubic,
                  padding: EdgeInsets.symmetric(horizontal: active ? 18 : 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: active ? AppColors.navy.withOpacity(.08) : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                    child: Icon(
                      active ? item.active : item.icon,
                      key: ValueKey(active),
                      color: active ? AppColors.navy : AppColors.textHint,
                      size: active ? 24 : 22,
                    ),
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
              ],
            ),
          ),
        );
      }),
    ),
  );
}

class _NavItem {
  final IconData icon;
  final IconData active;
  final String label;
  const _NavItem({required this.icon, required this.active, required this.label});
}
