import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import 's3_image.dart';

// Shared "Today's Birthdays" view for both apps - identical for students and
// teachers (same data, same read-only display), so it lives here rather than
// under either role's module folder. Students and staff are always shown as
// two clearly separate sections - staff use a navy/gold accent instead of
// the student section's pink, and show designation/department instead of
// class/section, so nobody could mistake one list for the other.
class BirthdaysView extends StatelessWidget {
  final List<Map<String, dynamic>> students;
  final List<Map<String, dynamic>> staff;
  const BirthdaysView({super.key, required this.students, required this.staff});

  @override
  Widget build(BuildContext context) {
    if (students.isEmpty && staff.isEmpty) return _emptyState();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      children: [
        if (students.isNotEmpty) _section(
          title: 'Student Birthdays',
          icon: Icons.cake_rounded,
          color: AppColors.pink,
          bg: AppColors.pinkLight,
          children: students.map((s) {
            final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
            final classLabel = [s['class_name'], s['section_name']].where((v) => (v ?? '').toString().isNotEmpty).join(' - ');
            return _personTile(
              photoKey: s['photo_url'] as String?,
              name: name.isEmpty ? '—' : name,
              subtitle: classLabel.isEmpty ? 'Class —' : 'Class $classLabel',
              accent: AppColors.pink,
              accentBg: AppColors.pinkLight,
            );
          }).toList(),
        ),
        if (students.isNotEmpty && staff.isNotEmpty) const SizedBox(height: 20),
        if (staff.isNotEmpty) _section(
          title: 'Staff Birthdays',
          icon: Icons.emoji_events_rounded,
          color: AppColors.navy,
          bg: AppColors.blueLight,
          children: staff.map((s) {
            final subtitle = [s['designation'], s['department']].where((v) => (v ?? '').toString().isNotEmpty).join(' · ');
            return _personTile(
              photoKey: s['photo_url'] as String?,
              name: (s['name'] ?? '—').toString(),
              subtitle: subtitle.isEmpty ? 'Staff' : subtitle,
              accent: AppColors.navy,
              accentBg: AppColors.amberLight,
              badge: 'STAFF',
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _section({required String title, required IconData icon, required Color color, required Color bg, required List<Widget> children}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 10),
        Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
      ]),
      const SizedBox(height: 10),
      ...children,
    ],
  );

  Widget _personTile({
    required String? photoKey,
    required String name,
    required String subtitle,
    required Color accent,
    required Color accentBg,
    String? badge,
  }) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(14),
      boxShadow: AppShadows.card,
      border: Border.all(color: accent.withOpacity(.15)),
    ),
    child: Row(children: [
      ClipOval(
        child: S3Image(
          s3Key: photoKey,
          width: 44, height: 44,
          fallback: (_) => Container(
            width: 44, height: 44,
            color: accentBg,
            child: Icon(Icons.person, color: accent, size: 22),
          ),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text))),
          if (badge != null) Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: accentBg, borderRadius: BorderRadius.circular(6)),
            child: Text(badge, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: accent)),
          ),
        ]),
        Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
      ])),
      Icon(Icons.cake_rounded, size: 18, color: accent.withOpacity(.6)),
    ]),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.pinkLight, shape: BoxShape.circle),
        child: const Icon(Icons.cake_outlined, color: AppColors.pink, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Birthdays Today', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Check back tomorrow!', textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
