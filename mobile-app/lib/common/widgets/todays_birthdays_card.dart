import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/supabase_service.dart';
import 's3_image.dart';

// Compact "today only" birthdays card for the Home dashboard - students and
// staff whose birthday is today, school-wide (get_todays_birthdays RPC,
// same one the admin dashboard's Birthdays cards use, so the two can never
// drift). Renders nothing at all when there's nobody to show today, same
// "hide entirely rather than an empty card" idiom already used for the
// sibling switcher and notice popups on these dashboards.
class TodaysBirthdaysCard extends StatefulWidget {
  const TodaysBirthdaysCard({super.key});
  @override
  State<TodaysBirthdaysCard> createState() => _TodaysBirthdaysCardState();
}

class _TodaysBirthdaysCardState extends State<TodaysBirthdaysCard> {
  List<Map<String, dynamic>> _students = const [];
  List<Map<String, dynamic>> _staff = const [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    SupabaseService.fetchTodaysBirthdays().then((data) {
      if (!mounted) return;
      setState(() {
        _students = data['students'] ?? const [];
        _staff = data['staff'] ?? const [];
        _loaded = true;
      });
    }).catchError((_) {
      if (mounted) setState(() => _loaded = true); // fail quiet - just don't show the card
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || (_students.isEmpty && _staff.isEmpty)) return const SizedBox.shrink();
    final people = [
      ..._students.map((s) => (
        name: '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim(),
        subtitle: [s['class_name'], s['section_name']].where((v) => (v ?? '').toString().isNotEmpty).join('-'),
        photoKey: s['photo_url'] as String?,
        isStaff: false,
      )),
      ..._staff.map((s) => (
        name: (s['name'] ?? '—').toString(),
        subtitle: (s['designation'] ?? 'Staff').toString(),
        photoKey: s['photo_url'] as String?,
        isStaff: true,
      )),
    ];

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.pinkLight,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.pink.withOpacity(.25)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Text('🎂', style: TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            const Text("Today's Birthdays", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
            const Spacer(),
            Text('${people.length}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.pink)),
          ]),
          const SizedBox(height: 12),
          SizedBox(
            height: 82,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: people.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) => _personChip(people[i]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _personChip(({String name, String subtitle, String? photoKey, bool isStaff}) p) {
    final accent = p.isStaff ? AppColors.navy : AppColors.pink;
    return SizedBox(
      width: 64,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Stack(clipBehavior: Clip.none, children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: accent, width: 2)),
            child: ClipOval(child: S3Image(
              s3Key: p.photoKey,
              width: 52, height: 52,
              fallback: (_) => Container(
                color: accent.withOpacity(.15),
                child: Icon(Icons.person, color: accent, size: 24),
              ),
            )),
          ),
          const Positioned(right: -2, bottom: -2, child: Text('🎉', style: TextStyle(fontSize: 16))),
        ]),
        const SizedBox(height: 4),
        Text(p.name.isEmpty ? '—' : p.name, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.text)),
        Text(p.subtitle.isEmpty ? (p.isStaff ? 'Staff' : 'Student') : p.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 9.5, color: AppColors.textLight)),
      ]),
    );
  }
}
