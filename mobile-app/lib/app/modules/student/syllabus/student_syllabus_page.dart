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

// Small radial "% complete" ring - same widget as the teacher app's subject
// grid, kept as its own copy here since the two pages don't share a common
// widgets file for this yet.
class _CircularProgress extends StatelessWidget {
  final double percent; // 0-100
  final Color color;
  final double size;
  const _CircularProgress({required this.percent, required this.color, this.size = 60});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: Stack(alignment: Alignment.center, children: [
      SizedBox(
        width: size,
        height: size,
        child: CircularProgressIndicator(
          value: (percent / 100).clamp(0, 1),
          strokeWidth: 6,
          backgroundColor: AppColors.border,
          valueColor: AlwaysStoppedAnimation<Color>(color),
          strokeCap: StrokeCap.round,
        ),
      ),
      Text('${percent.toStringAsFixed(0)}%',
        style: TextStyle(fontSize: size * 0.24, fontWeight: FontWeight.w800, color: color)),
    ]),
  );
}

// Read-only: shows the syllabus chapters for the student's own class, one
// subject card per subject (progress ring + chapter count, same layout as
// the teacher app's own subject grid so the two feel consistent) - tapping
// a subject drills into its numbered chapter list. Nothing here is editable
// from the student side.
class StudentSyllabusPage extends StatefulWidget {
  final bool embedded;
  const StudentSyllabusPage({super.key, this.embedded = false});
  @override
  State<StudentSyllabusPage> createState() => _StudentSyllabusPageState();
}

class _StudentSyllabusPageState extends State<StudentSyllabusPage> {
  List<Map<String, dynamic>> _chapters = [];
  Map<String, List<Map<String, dynamic>>> _subtopicsByChapter = {};
  bool _loading = true;

  // null = showing the subject grid; set = drilled into that subject's chapters.
  String? _selectedSubject;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_name'] as String?;
    final chapters = (className != null && className.isNotEmpty)
        ? await SupabaseService.fetchSyllabus(className: className)
        : <Map<String, dynamic>>[];
    final subtopics = await SupabaseService.fetchSubtopics(chapters.map((c) => c['id'] as String).toList());
    final subMap = <String, List<Map<String, dynamic>>>{};
    for (final s in subtopics) {
      subMap.putIfAbsent(s['chapter_id'] as String, () => []).add(s);
    }
    if (mounted) setState(() { _chapters = chapters; _subtopicsByChapter = subMap; _loading = false; });
  }

  // Same derivation as the teacher app: a chapter with subtopics shows a
  // status computed from them instead of its own stored value.
  String _statusFor(Map<String, dynamic> chapter) {
    final subtopics = _subtopicsByChapter[chapter['id']] ?? const [];
    if (subtopics.isEmpty) return (chapter['status'] ?? 'Not Started') as String;
    final statuses = subtopics.map((s) => (s['status'] ?? 'Not Started') as String).toList();
    if (statuses.every((s) => s == 'Completed')) return 'Completed';
    if (statuses.any((s) => s != 'Not Started')) return 'In Progress';
    return 'Not Started';
  }

  // Whole-chapter completion (not leaf units) - "X/Y chapters", distinct
  // from the ring's percent which is leaf-based (see _leafCounts).
  ({int total, int completed}) _chapterProgress(List<Map<String, dynamic>> chapters) {
    int completed = 0;
    for (final c in chapters) {
      if (_statusFor(c) == 'Completed') completed++;
    }
    return (total: chapters.length, completed: completed);
  }

  // A "leaf unit" is a subtopic if the chapter has any, else the chapter
  // itself - same growth-counting rule as the teacher app.
  ({int total, int completed}) _leafCounts(List<Map<String, dynamic>> chapters) {
    int total = 0, completed = 0;
    for (final c in chapters) {
      final subs = _subtopicsByChapter[c['id']] ?? const [];
      if (subs.isEmpty) {
        total++;
        if ((c['status'] ?? '') == 'Completed') completed++;
      } else {
        total += subs.length;
        completed += subs.where((s) => (s['status'] ?? '') == 'Completed').length;
      }
    }
    return (total: total, completed: completed);
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
    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else if (_chapters.isEmpty) {
      body = _emptyState();
    } else {
      body = _selectedSubject == null ? _buildSubjectGrid() : _buildSubjectDetail();
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Syllabus'),
      ),
      body: body,
    );
  }

  // ── Subject grid (top level) ────────────────────────────────────────────

  Widget _buildSubjectGrid() {
    final sections = _grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1,
        ),
        itemCount: sections.length,
        itemBuilder: (_, i) {
          final subject  = sections[i].key;
          final chapters = sections[i].value;
          final counts   = _leafCounts(chapters);
          final progress = _chapterProgress(chapters);
          final pct      = counts.total == 0 ? 0.0 : counts.completed / counts.total * 100;
          final color    = pct >= 75 ? AppColors.green : pct >= 40 ? AppColors.amber : AppColors.red;
          return GestureDetector(
            onTap: () => setState(() => _selectedSubject = subject),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(18),
                boxShadow: AppShadows.card,
                border: Border.all(color: AppColors.border),
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _CircularProgress(percent: pct, color: color, size: 60),
                    const SizedBox(height: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 130),
                      child: Text(subject, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text)),
                    ),
                    const SizedBox(height: 2),
                    Text('${progress.completed}/${progress.total} chapters',
                      style: const TextStyle(fontSize: 10.5, color: AppColors.textHint)),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Chapter detail (drilled into one subject) ───────────────────────────

  Widget _buildSubjectDetail() {
    final subject  = _selectedSubject!;
    final chapters = _grouped[subject];
    if (chapters == null || chapters.isEmpty) {
      // The subject disappeared from under us (e.g. its last chapter was
      // removed) - bounce back to the grid instead of showing a dead end.
      WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) setState(() => _selectedSubject = null); });
      return const SizedBox.shrink();
    }
    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        children: [
          Row(children: [
            GestureDetector(
              onTap: () => setState(() => _selectedSubject = null),
              child: Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                child: const Icon(Icons.arrow_back_rounded, size: 18, color: AppColors.navy),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navy))),
          ]),
          const SizedBox(height: 14),
          _progressSummary(_leafCounts(chapters), _chapterProgress(chapters)),
          const SizedBox(height: 14),
          ...chapters.asMap().entries.map((e) => _chapterTile(e.value, number: e.key + 1)),
        ],
      ),
    );
  }

  // The same completeness ring shown on the subject card, repeated at the
  // top of the drilled-in chapter list.
  Widget _progressSummary(({int total, int completed}) leafCounts, ({int total, int completed}) chapterProgress) {
    final pct   = leafCounts.total == 0 ? 0.0 : leafCounts.completed / leafCounts.total * 100;
    final color = pct >= 75 ? AppColors.green : pct >= 40 ? AppColors.amber : AppColors.red;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        _CircularProgress(percent: pct, color: color, size: 56),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${chapterProgress.completed}/${chapterProgress.total} chapters completed',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text)),
          const SizedBox(height: 2),
          Text('${pct.toStringAsFixed(0)}% of the syllabus covered',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textLight)),
        ])),
      ]),
    );
  }

  Widget _chapterTile(Map<String, dynamic> chapter, {required int number}) {
    final status    = _statusFor(chapter);
    final subtopics = _subtopicsByChapter[chapter['id']] ?? const [];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 22, height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.navy.withValues(alpha: .08), shape: BoxShape.circle),
            child: Text('$number', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(chapter['chapter'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
            child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
        if (subtopics.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          ...subtopics.map((s) => Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 32),
            child: Row(children: [
              Expanded(child: Text(s['name'] ?? '', style: const TextStyle(fontSize: 12.5, color: AppColors.textLight))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: _statusBg(s['status'] ?? 'Not Started'), borderRadius: BorderRadius.circular(6)),
                child: Text(s['status'] ?? 'Not Started',
                  style: TextStyle(color: _statusColor(s['status'] ?? 'Not Started'), fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ]),
          )),
        ],
      ]),
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
