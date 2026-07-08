import 'package:flutter/material.dart';
import 'package:get/get.dart';
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

class _TeacherDashboardTabState extends State<TeacherDashboardTab> {
  int _studentCount = 0;
  int _pendingHomework = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final profile = AuthService.to.profile.value ?? {};
    final cls = profile['class_teacher_of_section_id']?.toString();
    if (cls != null) {
      final students = await SupabaseService.fetchClassStudents(cls);
      final hw = await SupabaseService.fetchHomework(className: cls);
      final now = DateTime.now();
      setState(() {
        _studentCount    = students.length;
        _pendingHomework = hw.where((h) {
          final due = DateTime.tryParse(h['due_date'] ?? '');
          return due != null && due.isAfter(now);
        }).length;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_teacher_of_section_id']?.toString() ?? '—';
    final subject   = '';

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Class info banner
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
                    const Text('Your Class', style: TextStyle(color: Colors.white60, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text(className,
                      style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
                    if (subject.isNotEmpty)
                      Text(subject, style: const TextStyle(color: AppColors.amber, fontSize: 13)),
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

            const SizedBox(height: 16),

            // Stats grid
            if (_loading)
              const Center(child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(),
              ))
            else
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12, mainAxisSpacing: 12,
                childAspectRatio: 1.3,
                children: [
                  StatCard(label: 'Students',       value: '$_studentCount',    icon: Icons.people,        color: AppColors.blue,  bgColor: AppColors.blueLight,  onTap: () => Get.toNamed(Routes.teacherAttend)),
                  StatCard(label: 'Pending Tasks',  value: '$_pendingHomework', icon: Icons.assignment,    color: AppColors.amber, bgColor: AppColors.amberLight, onTap: () => Get.toNamed(Routes.teacherHomework)),
                  StatCard(label: 'Mark Attendance',value: 'Today',             icon: Icons.fact_check,    color: AppColors.green, bgColor: AppColors.greenLight, onTap: () => Get.toNamed(Routes.teacherAttend)),
                  StatCard(label: 'Enter Marks',    value: 'Exams',             icon: Icons.grading,       color: AppColors.navy,  bgColor: AppColors.blueLight,  onTap: () => Get.toNamed(Routes.teacherMarks)),
                ],
              ),

            const SizedBox(height: 24),

            // Quick actions
            const Text('Quick Actions',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
            const SizedBox(height: 12),

            _quickAction(Icons.fact_check, 'Mark Today\'s Attendance', AppColors.green, AppColors.greenLight, () => Get.toNamed(Routes.teacherAttend)),
            const SizedBox(height: 10),
            _quickAction(Icons.add_task, 'Add Homework', AppColors.amber, AppColors.amberLight, () => Get.toNamed(Routes.teacherHomework)),
            const SizedBox(height: 10),
            _quickAction(Icons.grading, 'Enter Exam Marks', AppColors.navy, AppColors.blueLight, () => Get.toNamed(Routes.teacherMarks)),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(IconData icon, String label, Color color, Color bg, VoidCallback onTap) =>
    GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.text)),
          const Spacer(),
          const Icon(Icons.chevron_right, color: AppColors.textHint),
        ]),
      ),
    );
}
