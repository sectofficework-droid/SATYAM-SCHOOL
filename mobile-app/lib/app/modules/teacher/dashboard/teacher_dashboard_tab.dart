import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../app/routes/app_routes.dart';
import '../../../../common/widgets/stat_card.dart';

class TeacherDashboardTab extends StatefulWidget {
  const TeacherDashboardTab({super.key});
  @override
  State<TeacherDashboardTab> createState() => _TeacherDashboardTabState();
}

class _TeacherDashboardTabState extends State<TeacherDashboardTab>
    with SingleTickerProviderStateMixin {
  int _studentCount    = 0;
  int _pendingHomework = 0;
  int _pendingTasks    = 0;
  bool _loading = true;
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
    _load();
  }

  @override
  void dispose() { _animCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final sectionId  = profile['class_teacher_of_section_id']?.toString();
    final employeeId = profile['id'] as String?;

    final tasks = employeeId != null
        ? await SupabaseService.fetchTeacherTasks(employeeId)
        : <Map<String, dynamic>>[];
    final pendingTasks = tasks.where((t) => t['status'] != 'Completed').length;

    // Homework given by this teacher specifically (not the whole class's
    // homework from every teacher) that isn't past its due date yet - any
    // teacher can give homework, not just class teachers, so this no longer
    // depends on having a class_teacher_of_section_id.
    final hw = employeeId != null
        ? await SupabaseService.fetchHomework(createdBy: employeeId)
        : <Map<String, dynamic>>[];
    final now = DateTime.now();
    final pendingHomework = hw.where((h) {
      final due = DateTime.tryParse(h['due_date'] ?? '');
      return due != null && !due.isBefore(now);
    }).length;

    if (sectionId != null && sectionId.isNotEmpty) {
      final students = await SupabaseService.fetchClassStudents(sectionId);
      if (mounted) setState(() {
        _studentCount    = students.length;
        _pendingHomework = pendingHomework;
        _pendingTasks    = pendingTasks;
        _loading         = false;
      });
    } else {
      if (mounted) setState(() {
        _pendingHomework = pendingHomework;
        _pendingTasks    = pendingTasks;
        _loading         = false;
      });
    }
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
      onRefresh: _load,
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

            // Stats header
            _AnimEntry(delay: 80, child: const Text('Overview',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text))),
            const SizedBox(height: 12),

            // Stats grid
            if (_loading) _ShimmerGrid()
            else FadeTransition(
              opacity: _fadeAnim,
              child: GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12, mainAxisSpacing: 12,
                childAspectRatio: 0.85,
                children: [
                  _AnimEntry(delay: 100, child: StatCard(
                    label: 'My Students', value: '$_studentCount',
                    icon: Icons.people_alt_rounded,
                    color: AppColors.blue, bgColor: AppColors.blueLight,
                    onTap: () => Get.toNamed(Routes.teacherStudents),
                  )),
                  _AnimEntry(delay: 180, child: StatCard(
                    label: 'Pending HW', value: '$_pendingHomework',
                    icon: Icons.assignment_late_rounded,
                    color: AppColors.amber, bgColor: AppColors.amberLight,
                    onTap: () => Get.toNamed(Routes.teacherHomework),
                  )),
                  _AnimEntry(delay: 260, child: StatCard(
                    label: 'Attendance', value: 'Mark Today',
                    icon: Icons.fact_check_rounded,
                    color: AppColors.green, bgColor: AppColors.greenLight,
                    onTap: () => Get.toNamed(Routes.teacherAttend),
                  )),
                  _AnimEntry(delay: 340, child: StatCard(
                    label: 'Exam Marks', value: 'Enter Now',
                    icon: Icons.grading_rounded,
                    color: AppColors.purple, bgColor: AppColors.purpleLight,
                    onTap: () => Get.toNamed(Routes.teacherMarks),
                  )),
                  _AnimEntry(delay: 420, child: StatCard(
                    label: 'My Tasks', value: '$_pendingTasks',
                    icon: Icons.task_alt_rounded,
                    color: AppColors.pink, bgColor: AppColors.pinkLight,
                    onTap: () => Get.toNamed(Routes.teacherTasks),
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

class _ShimmerGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) => GridView.count(
    crossAxisCount: 3,
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisSpacing: 12, mainAxisSpacing: 12,
    childAspectRatio: 0.92,
    children: List.generate(5, (_) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    )),
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
