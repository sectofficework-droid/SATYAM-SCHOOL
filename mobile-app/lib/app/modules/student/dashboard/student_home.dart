import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/recent_notices.dart';
import '../../../../core/utils/app_update.dart';
import '../../../../common/widgets/notification_bell.dart';
import '../../../../common/widgets/recent_notices_sheet.dart';
import '../../../../common/widgets/birthday_celebration_overlay.dart';
import '../../../../common/widgets/stat_card.dart';
import '../../../../common/widgets/responsive_module_grid.dart';
import '../../../../common/widgets/todays_birthdays_card.dart';
import '../profile/student_profile_page.dart';
import '../attendance/student_attendance_page.dart';
import '../exams/student_exams_page.dart';
import '../fees/student_fees_page.dart';
import '../notices/student_notices_page.dart';
import '../../../../app/routes/app_routes.dart';

class StudentHome extends StatefulWidget {
  const StudentHome({super.key});
  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  int _tab = 0;
  List<Map<String, dynamic>> _recent = [];

  static const _pages = [
    _StudentDashboard(),
    StudentAttendancePage(embedded: true),
    StudentExamsPage(embedded: true),
    StudentFeesPage(embedded: true),
    StudentNoticesPage(embedded: true),
  ];

  static const _noticesTabIndex = 4;
  String? _userKey; // 'student_<studentId>', used for once-a-day popup + swipe dismissals

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadNotifications();
      checkForAppUpdate(context);
    });
  }

  Future<void> _loadNotifications() async {
    final profile   = AuthService.to.profile.value ?? {};
    final studentId = profile['id'] as String?;
    if (studentId == null) return;
    _userKey = 'student_$studentId';
    final className = profile['class_name'] as String? ?? '';

    final notices = await SupabaseService.fetchNotices(
      audiences: const ['Everyone', 'All Students', 'Parents'],
    );

    // Upcoming Monthly Test / Main Exam reminders for this student's class,
    // merged into the same feed as Notices - see monthlyTestReminders /
    // officialExamReminders for why these need no server-side scheduling.
    final classExams = className.isNotEmpty
        ? await SupabaseService.fetchExams(className: className)
        : <Map<String, dynamic>>[];
    final officialExams = await SupabaseService.fetchOfficialExams();
    final alerts = await SupabaseService.fetchStudentAlerts(studentId);
    final birthday = birthdayNoticeItem(profile['dob'] as String?);

    final combined = [
      ...notices,
      ...alerts.map(alertAsNoticeItem),
      ...monthlyTestReminders(classExams),
      ...officialExamReminders(officialExams),
      if (birthday != null) birthday,
    ];

    final visible = await visibleRecentNotices(combined, _userKey!);
    if (!mounted) return;
    setState(() => _recent = visible);

    // Full-screen confetti + photo celebration, separate from (and shown
    // before) the regular notice popup below - once per day, same idiom as
    // shouldShowNoticePopupToday, just its own storage key.
    if (birthday != null) {
      final shouldCelebrate = await shouldShowNoticePopupToday('birthday_celebration_shown_student_$studentId');
      if (shouldCelebrate && mounted) {
        final firstName = profile['first_name'] as String? ?? '';
        await showBirthdayCelebration(context,
          name: firstName.isEmpty ? 'Student' : firstName,
          photoKey: profile['photo_url'] as String?,
        );
      }
    }
    if (!mounted || visible.isEmpty) return;

    final shouldShow = await shouldShowNoticePopupToday('notif_popup_shown_student_$studentId');
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
      onItemTap: (notice) {
        if (notice['_isExam'] == true) _setTab(2); // Marks (Exams & Marks) tab
      },
    );
  }

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
                NotificationBell(
                  count: _recent.length,
                  onTap: _showNotifications,
                ),
                const SizedBox(width: 14),
                GestureDetector(
                  onTap: () => Get.toNamed(Routes.studentProfile),
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withValues(alpha: .4), width: 2),
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
    decoration: const BoxDecoration(color: Colors.white, boxShadow: AppShadows.nav),
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
                  color: active ? AppColors.navy.withValues(alpha: .08) : Colors.transparent,
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

class _StudentDashboard extends StatefulWidget {
  const _StudentDashboard();
  @override
  State<_StudentDashboard> createState() => _StudentDashboardState();
}

class _StudentDashboardState extends State<_StudentDashboard> {
  // Guards against double-taps firing overlapping switch requests while the
  // RPC round-trip for the first tap is still in flight.
  String? _switchingId;

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  Future<void> _switchTo(String targetId) async {
    if (_switchingId != null) return;
    setState(() => _switchingId = targetId);
    final err = await AuthService.to.switchToSibling(targetId);
    if (!mounted) return;
    if (err != null) {
      setState(() => _switchingId = null);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err), behavior: SnackBarBehavior.floating));
      return;
    }
    // Full reset, not a partial rebuild - StudentHome's tabs each load their
    // own data once in initState, so switching while parked on e.g. Fees
    // wouldn't otherwise refresh that tab, and could leave the previous
    // sibling's data on screen after switching. This guarantees every tab
    // re-reads the newly active profile from scratch.
    Get.offAllNamed(Routes.studentHome);
  }

  // Sibling switcher row - only rendered once there's actually something to
  // switch to, wrapped in Obx since linkedSiblings is populated
  // asynchronously (fetched at login/session-restore time, may resolve
  // after this dashboard has already first rendered).
  Widget _buildSiblingSwitcher() => Obx(() {
    final siblings = AuthService.to.linkedSiblings;
    if (siblings.isEmpty) return const SizedBox.shrink();
    final profile = AuthService.to.profile.value ?? {};
    final myId = profile['id'] as String?;
    final myName = profile['first_name'] as String? ?? 'Me';
    final myPhoto = profile['photo_url'] as String?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: SizedBox(
        height: 78,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.zero,
          children: [
            _siblingChip(id: myId ?? '', name: myName, photoKey: myPhoto, active: true, onTap: null),
            for (final s in siblings)
              _siblingChip(
                id: s['id'] as String? ?? '',
                name: s['first_name'] as String? ?? 'Sibling',
                photoKey: s['photo_url'] as String?,
                active: false,
                onTap: () => _switchTo(s['id'] as String),
              ),
          ],
        ),
      ),
    );
  });

  Widget _siblingChip({required String id, required String name, String? photoKey, required bool active, VoidCallback? onTap}) {
    final busy = _switchingId == id;
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Container(
        width: 62,
        margin: const EdgeInsets.only(right: 12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Stack(alignment: Alignment.center, children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: active ? AppColors.navy : AppColors.border, width: active ? 2.5 : 1.5),
              ),
              child: ClipOval(child: StudentProfilePage.buildAvatar(photoKey, name, 24)),
            ),
            if (busy) const SizedBox(width: 52, height: 52, child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.navy)),
          ]),
          const SizedBox(height: 4),
          Text(active ? 'You' : name, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? AppColors.navy : AppColors.textLight)),
        ]),
      ),
    );
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
        _buildSiblingSwitcher(),
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
              boxShadow: [BoxShadow(color: AppColors.navy.withValues(alpha: .3), blurRadius: 20, offset: const Offset(0, 8))],
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
                  color: Colors.white.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: .2)),
                ),
                child: const Icon(Icons.school_rounded, color: Colors.white, size: 34),
              ),
            ]),
          ),
        ),

        const SizedBox(height: 24),

        const TodaysBirthdaysCard(),

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
          child: ResponsiveModuleGrid(
            children: [
              StatCard(label: 'Attendance', icon: Icons.how_to_reg_rounded,
                color: AppColors.green, bgColor: AppColors.greenLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentAttend)),
              StatCard(label: 'Exam Marks', icon: Icons.emoji_events_rounded,
                color: AppColors.blue, bgColor: AppColors.blueLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentMarks)),
              StatCard(label: 'Fee Status', icon: Icons.account_balance_wallet_rounded,
                color: AppColors.amber, bgColor: AppColors.amberLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentFees)),
              StatCard(label: 'Homework', icon: Icons.assignment_rounded,
                color: AppColors.purple, bgColor: AppColors.purpleLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentHomework)),
              StatCard(label: 'Syllabus', icon: Icons.list_alt_rounded,
                color: AppColors.orange, bgColor: AppColors.orangeLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentSyllabus)),
              StatCard(label: 'Timetable', icon: Icons.calendar_view_week_rounded,
                color: AppColors.teal, bgColor: AppColors.tealLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentTimetable)),
              StatCard(label: 'Query / Suggestion', icon: Icons.forum_rounded,
                color: AppColors.cyan, bgColor: AppColors.cyanLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentQuery)),
              StatCard(label: 'Rules & Regulations', icon: Icons.gavel_rounded,
                color: AppColors.stone, bgColor: AppColors.stoneLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentRules)),
              StatCard(label: 'Help Desk', icon: Icons.support_agent_rounded,
                color: AppColors.indigo, bgColor: AppColors.indigoLight,
                centered: true,
                onTap: () => Get.toNamed(Routes.studentHelpDesk)),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _infoBadge(IconData icon, String label) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: Colors.white.withValues(alpha: .2)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, color: Colors.white70, size: 12),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
    ]),
  );
}
