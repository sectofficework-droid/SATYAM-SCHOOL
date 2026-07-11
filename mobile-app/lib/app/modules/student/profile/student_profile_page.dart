import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../common/widgets/s3_image.dart';

class StudentProfilePage extends StatelessWidget {
  const StudentProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile   = AuthService.to.profile.value ?? {};
    final name      = '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'.trim();
    final photoKey  = profile['photo_url'] as String?;
    final className = profile['class_name']?.toString() ?? '';
    final section   = profile['section_name']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            buildAvatar(photoKey, name, 54),
            const SizedBox(height: 12),
            Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 4),
            if (className.isNotEmpty)
              Text(
                [className, if (section.isNotEmpty) section].join(' · '),
                style: const TextStyle(color: AppColors.navy, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            const SizedBox(height: 4),
            Text('Enrollment No: ${profile['enrollment_no'] ?? '—'}',
              style: const TextStyle(color: AppColors.textLight, fontSize: 13)),
            const SizedBox(height: 24),

            _section('Student Details', [
              _row('Enrollment No.',  profile['enrollment_no']?.toString() ?? '—'),
              _row('Roll No.',        profile['roll_no']?.toString() ?? '—'),
              _row('Class',           [className, if (section.isNotEmpty) section].join(' · ')),
              _row('Date of Birth',   profile['dob'] ?? '—'),
              _row('Gender',          profile['gender'] ?? '—'),
              _row("Father's Name",   profile['father_name'] ?? '—'),
              _row("Mother's Name",   profile['mother_name'] ?? '—'),
              _row('Phone',           profile['mobile1'] ?? '—'),
              _row('Address',         profile['address'] ?? '—'),
            ]),

            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.logout),
                label: const Text('Sign Out'),
                onPressed: () => AuthService.to.signOut(),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.red),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget buildAvatar(String? photoKey, String name, double radius) {
    return S3Image(
      s3Key:  photoKey,
      width:  radius * 2,
      height: radius * 2,
      fit:    BoxFit.cover,
      fallback: (_) => _initialsAvatar(name, radius),
    );
  }

  static Widget _initialsAvatar(String name, double radius) {
    final parts    = name.trim().split(' ');
    final initials = parts.length >= 2
        ? '${parts[0][0]}${parts[1][0]}'.toUpperCase()
        : name.isNotEmpty ? name[0].toUpperCase() : '?';
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.blueLight,
      child: Text(initials,
        style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: radius * 0.55)),
    );
  }

  Widget _section(String title, List<Widget> rows) => Container(
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Text(title, style: const TextStyle(
            fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.navy))),
        const Divider(height: 1),
        ...rows,
      ],
    ),
  );

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 130, child: Text(label,
          style: const TextStyle(color: AppColors.textLight, fontSize: 13))),
        Expanded(child: Text(value,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: AppColors.text))),
      ],
    ),
  );
}
