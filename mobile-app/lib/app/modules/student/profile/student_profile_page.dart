import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';

class StudentProfilePage extends StatelessWidget {
  const StudentProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final profile = AuthService.to.profile.value ?? {};
    final name    = profile['full_name'] ?? '—';

    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              width: 90, height: 90,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.blueLight),
              child: const Icon(Icons.person, size: 50, color: AppColors.navy),
            ),
            const SizedBox(height: 12),
            Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text)),
            const SizedBox(height: 4),
            Text('Class ${profile['class'] ?? '—'} · Roll ${profile['roll_no'] ?? '—'}',
              style: const TextStyle(color: AppColors.textLight, fontSize: 14)),
            const SizedBox(height: 24),

            _section('Student Details', [
              _row('Enrollment No.',  profile['enrollment_no'] ?? '—'),
              _row('Class',          profile['class'] ?? '—'),
              _row('Roll No.',       profile['roll_no'] ?? '—'),
              _row('Date of Birth',  profile['date_of_birth'] ?? '—'),
              _row('Gender',         profile['gender'] ?? '—'),
              _row("Parent's Name",  profile['parent_name'] ?? '—'),
              _row('Phone',          profile['phone'] ?? '—'),
              _row('Address',        profile['address'] ?? '—'),
            ]),

            const SizedBox(height: 16),

            ElevatedButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('Sign Out'),
              onPressed: () => AuthService.to.signOut(),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.red),
            ),
          ],
        ),
      ),
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
