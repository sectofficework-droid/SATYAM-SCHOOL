import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../app/routes/app_routes.dart';
import '../../../../common/widgets/stat_card.dart';
import '../../../../common/widgets/responsive_module_grid.dart';

class TeacherDashboardTab extends StatefulWidget {
  const TeacherDashboardTab({super.key});
  @override
  State<TeacherDashboardTab> createState() => _TeacherDashboardTabState();
}

class _TeacherDashboardTabState extends State<TeacherDashboardTab>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  Future<void> _refresh() async {
    _animCtrl.forward(from: 0);
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    final profile     = AuthService.to.profile.value ?? {};
    final firstName   = (profile['name'] as String? ?? '').split(' ').first;
    final className   = profile['class_name'] as String? ?? '';
    final sectionName = profile['section_name'] as String? ?? '';
    final classLabel  = className.isEmpty ? 'No class assigned' : (sectionName.isEmpty ? className : '$className - $sectionName');

    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 96),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Greeting banner
            _AnimEntry(delay: 0, child: _GreetingBanner(
              greeting: _greeting,
              firstName: firstName,
              classLabel: classLabel,
            )),

            const SizedBox(height: 20),

            // Modules header
            _AnimEntry(delay: 80, child: const Text('Overview',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text))),
            const SizedBox(height: 12),

            // Module grid - tap a card to see that module's own stats.
            FadeTransition(
              opacity: _fadeAnim,
              child: ResponsiveModuleGrid(
                children: [
                  _AnimEntry(delay: 100, child: StatCard(
                    label: 'My Students', icon: Icons.groups_rounded,
                    color: AppColors.blue, bgColor: AppColors.blueLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherStudents),
                  )),
                  _AnimEntry(delay: 180, child: StatCard(
                    label: 'Homework', icon: Icons.assignment_rounded,
                    color: AppColors.amber, bgColor: AppColors.amberLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherHomework),
                  )),
                  _AnimEntry(delay: 260, child: StatCard(
                    label: 'Student Attendance', icon: Icons.how_to_reg_rounded,
                    color: AppColors.green, bgColor: AppColors.greenLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherAttend),
                  )),
                  _AnimEntry(delay: 340, child: StatCard(
                    label: 'Exam Marks', icon: Icons.emoji_events_rounded,
                    color: AppColors.purple, bgColor: AppColors.purpleLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherMarks),
                  )),
                  _AnimEntry(delay: 420, child: StatCard(
                    label: 'My Tasks', icon: Icons.checklist_rounded,
                    color: AppColors.pink, bgColor: AppColors.pinkLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherTasks),
                  )),
                  _AnimEntry(delay: 500, child: StatCard(
                    label: 'My Attendance', icon: Icons.event_available_rounded,
                    color: AppColors.indigo, bgColor: AppColors.indigoLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherMyAttend),
                  )),
                  _AnimEntry(delay: 580, child: StatCard(
                    label: 'Question Bank', icon: Icons.menu_book_rounded,
                    color: AppColors.red, bgColor: AppColors.redLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherQuestionBank),
                  )),
                  _AnimEntry(delay: 660, child: StatCard(
                    label: 'Calendar', icon: Icons.calendar_month_rounded,
                    color: AppColors.teal, bgColor: AppColors.tealLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherCalendar),
                  )),
                  _AnimEntry(delay: 740, child: StatCard(
                    label: 'Syllabus', icon: Icons.list_alt_rounded,
                    color: AppColors.orange, bgColor: AppColors.orangeLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherSyllabus),
                  )),
                  _AnimEntry(delay: 780, child: StatCard(
                    label: 'My Timetable', icon: Icons.calendar_view_week_rounded,
                    color: AppColors.lime, bgColor: AppColors.limeLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherTimetable),
                  )),
                  _AnimEntry(delay: 790, child: StatCard(
                    label: 'Birthdays', icon: Icons.cake_rounded,
                    color: AppColors.pink, bgColor: AppColors.pinkLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherBirthdays),
                  )),
                  _AnimEntry(delay: 805, child: StatCard(
                    label: 'My Leave', icon: Icons.beach_access_rounded,
                    color: AppColors.orange, bgColor: AppColors.orangeLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherLeave),
                  )),
                  _AnimEntry(delay: 812, child: StatCard(
                    label: 'Daily Tasks', icon: Icons.checklist_rounded,
                    color: AppColors.green, bgColor: AppColors.greenLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherDailyTasks),
                  )),
                  _AnimEntry(delay: 820, child: StatCard(
                    label: 'Query / Suggestion', icon: Icons.forum_rounded,
                    color: AppColors.cyan, bgColor: AppColors.cyanLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherQuery),
                  )),
                  _AnimEntry(delay: 900, child: StatCard(
                    label: 'Rules & Regulations', icon: Icons.gavel_rounded,
                    color: AppColors.stone, bgColor: AppColors.stoneLight,
                    centered: true,
                    onTap: () => Get.toNamed(Routes.teacherRules),
                  )),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _GreetingBanner extends StatelessWidget {
  final String greeting;
  final String firstName;
  final String classLabel;

  const _GreetingBanner({
    required this.greeting,
    required this.firstName,
    required this.classLabel,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppColors.navyMid, AppColors.navyDark],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(24),
      boxShadow: [
        BoxShadow(color: AppColors.navy.withOpacity(.3), blurRadius: 20, offset: const Offset(0, 8)),
      ],
    ),
    child: Row(children: [
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$greeting,', style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Poppins')),
          const SizedBox(height: 2),
          Text(firstName.isEmpty ? 'Teacher' : firstName,
            style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white.withOpacity(.2)),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.class_rounded, color: Colors.white70, size: 13),
              const SizedBox(width: 5),
              Text(classLabel,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600, fontFamily: 'Poppins')),
            ]),
          ),
        ],
      )),
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
  );
}

// ── Staggered entry animation ─────────────────────────────────────────────────
class _AnimEntry extends StatefulWidget {
  final Widget child;
  final int delay;
  const _AnimEntry({required this.child, required this.delay});
  @override
  State<_AnimEntry> createState() => _AnimEntryState();
}

class _AnimEntryState extends State<_AnimEntry> with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late Animation<double>   _opacity;
  late Animation<Offset>   _slide;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(duration: const Duration(milliseconds: 500), vsync: this);
    _opacity = CurvedAnimation(parent: _c, curve: Curves.easeOut);
    _slide   = Tween(begin: const Offset(0, 0.12), end: Offset.zero)
        .animate(CurvedAnimation(parent: _c, curve: Curves.easeOutCubic));
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _opacity,
    child: SlideTransition(position: _slide, child: widget.child),
  );
}
