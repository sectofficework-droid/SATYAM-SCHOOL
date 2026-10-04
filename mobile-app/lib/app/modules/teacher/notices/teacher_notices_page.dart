import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/notice_type_filter.dart';
import '../../../../common/widgets/notice_card.dart';

class TeacherNoticesPage extends StatefulWidget {
  final bool embedded;
  const TeacherNoticesPage({super.key, this.embedded = false});
  @override
  State<TeacherNoticesPage> createState() => _TeacherNoticesPageState();
}

class _TeacherNoticesPageState extends State<TeacherNoticesPage> {
  List<Map<String, dynamic>> _notices = [];
  String _typeFilter = 'All';
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  // REQ-BUG-069 (2026-10-04): no try/catch at all - any network blip left
  // this spinning forever with no error/retry shown.
  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      // A teacher should see notices meant for staff, plus anything meant for
      // everyone - not notices aimed only at students/parents.
      final notices = await SupabaseService.fetchNotices(
        audiences: const ['Everyone', 'All Staff', 'Management'],
      );
      if (mounted) setState(() { _notices = notices; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = 'Failed to load notices.'; });
    }
  }

  List<Map<String, dynamic>> get _filtered => _typeFilter == 'All'
      ? _notices
      : _notices.where((n) => n['type'] == _typeFilter).toList();

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    Widget listArea;

    if (_loading) {
      listArea = _buildShimmer();
    } else if (_error != null) {
      listArea = Center(child: Text(_error!, style: const TextStyle(color: AppColors.textLight)));
    } else if (filtered.isEmpty) {
      listArea = _emptyState();
    } else {
      listArea = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: filtered.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 300 + i * 50),
            curve: Curves.easeOut,
            builder: (_, v, child) => Opacity(opacity: v,
              child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
            child: NoticeCard(notice: filtered[i]),
          ),
        ),
      );
    }

    final body = Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: NoticeTypeFilter(
          selected: _typeFilter,
          onChanged: (t) => setState(() => _typeFilter = t),
        ),
      ),
      Expanded(child: listArea),
    ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Notices'),
      ),
      body: body,
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 90, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.notifications_none_rounded, color: AppColors.navy, size: 38)),
      const SizedBox(height: 16),
      const Text('No Notices', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('School notices will appear here.', style: TextStyle(fontSize: 13, color: AppColors.textLight)),
    ]),
  ));
}
