import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

Color _statusColor(String status) => switch (status) {
  'Completed'   => AppColors.green,
  'In Progress' => AppColors.amber,
  _             => AppColors.textHint,
};

Color _statusBg(String status) => switch (status) {
  'Completed'   => AppColors.greenLight,
  'In Progress' => AppColors.amberLight,
  _             => AppColors.border,
};

// Read-only: shows the syllabus chapters for the student's own class,
// grouped by subject, with whatever status the teacher who owns each
// chapter has set. Nothing here is editable from the student side.
class StudentSyllabusPage extends StatefulWidget {
  final bool embedded;
  const StudentSyllabusPage({super.key, this.embedded = false});
  @override
  State<StudentSyllabusPage> createState() => _StudentSyllabusPageState();
}

class _StudentSyllabusPageState extends State<StudentSyllabusPage> {
  List<Map<String, dynamic>> _chapters = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String?;
    final chapters = (className != null && className.isNotEmpty)
        ? await SupabaseService.fetchSyllabus(className: className)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _chapters = chapters; _loading = false; });
  }

  Map<String, List<Map<String, dynamic>>> get _grouped {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final c in _chapters) {
      final subject = (c['subject'] ?? '').toString();
      map.putIfAbsent(subject, () => []).add(c);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? _buildShimmer()
        : _chapters.isEmpty
            ? _emptyState()
            : _buildList();

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Syllabus'),
      ),
      body: body,
    );
  }

  Widget _buildList() {
    final sections = _grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        itemCount: sections.length,
        itemBuilder: (_, i) {
          final section  = sections[i];
          final chapters = section.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8, left: 2),
                child: Text(section.key, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navy)),
              ),
              ...chapters.map((c) {
                final status = (c['status'] ?? 'Not Started') as String;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: AppShadows.card,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(children: [
                    Expanded(child: Text(c['chapter'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
                      child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                );
              }),
            ]),
          );
        },
      ),
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 6,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 52, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.menu_book_rounded, color: AppColors.navy, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Syllabus Yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Your teachers haven\'t added any chapters yet.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
