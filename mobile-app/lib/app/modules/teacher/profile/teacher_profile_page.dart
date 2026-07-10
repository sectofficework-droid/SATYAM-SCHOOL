import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../common/widgets/s3_image.dart';

class TeacherProfilePage extends StatelessWidget {
  const TeacherProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile     = AuthService.to.profile.value ?? {};
    final name        = profile['name'] as String? ?? '—';
    final empId       = profile['emp_code'] as String? ?? '—';
    final designation = profile['designation'] as String? ?? profile['type'] as String? ?? '—';
    final photoKey    = profile['photo_url'] as String?;
    final className   = profile['class_name'] as String? ?? '';
    final sectionName = profile['section_name'] as String? ?? '';
    final classLabel  = className.isEmpty ? '—' : (sectionName.isEmpty ? className : '$className - $sectionName');

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: AppColors.navyDark,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(gradient: AppColors.navyGradient),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 8),
                      // Profile photo
                      Container(
                        width: 88, height: 88,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(.4), width: 3),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(.2), blurRadius: 16, offset: const Offset(0, 6))],
                        ),
                        child: ClipOval(
                          child: S3Image(
                            s3Key: photoKey,
                            width: 88, height: 88,
                            fallback: (_) => Container(
                              color: Colors.white.withOpacity(.15),
                              child: const Icon(Icons.person_rounded, color: Colors.white, size: 44),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(name,
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Poppins')),
                      const SizedBox(height: 4),
                      Text(designation,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Poppins')),
                    ],
                  ),
                ),
              ),
            ),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              // Class badge
              if (className.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.blue.withOpacity(.08), AppColors.blue.withOpacity(.02)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.blue.withOpacity(.2)),
                  ),
                  child: Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [AppColors.blue, AppColors.navy], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.class_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Class Teacher', style: TextStyle(fontSize: 12, color: AppColors.textLight, fontWeight: FontWeight.w500)),
                      Text(classLabel, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text)),
                    ]),
                  ]),
                ),
                const SizedBox(height: 16),
              ],

              // Employee details
              _Section(title: 'Employee Details', icon: Icons.badge_rounded, children: [
                _Row(label: 'Employee Code',  value: empId),
                _Row(label: 'Designation',    value: designation),
                _Row(label: 'Department',     value: profile['department'] as String? ?? '—'),
              ]),
              const SizedBox(height: 12),
              _Section(title: 'Contact', icon: Icons.contact_phone_rounded, children: [
                _Row(label: 'Phone', value: profile['phone'] as String? ?? '—'),
                _Row(label: 'Email', value: profile['email'] as String? ?? '—'),
              ]),
              const SizedBox(height: 24),

              // Sign out
              GestureDetector(
                onTap: () => AuthService.to.signOut(),
                child: Container(
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.redLight,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.red.withOpacity(.3)),
                  ),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.logout_rounded, color: AppColors.red, size: 20),
                    SizedBox(width: 8),
                    Text('Sign Out', style: TextStyle(color: AppColors.red, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                  ]),
                ),
              ),
              const SizedBox(height: 24),
            ])),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;
  const _Section({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      boxShadow: AppShadows.card,
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        child: Row(children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: AppColors.navy, size: 16),
          ),
          const SizedBox(width: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
        ]),
      ),
      const Divider(height: 1, color: AppColors.border),
      ...children,
    ]),
  );
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textLight, fontSize: 13))),
      Expanded(child: Text(value.isEmpty ? '—' : value,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.text))),
    ]),
  );
}
