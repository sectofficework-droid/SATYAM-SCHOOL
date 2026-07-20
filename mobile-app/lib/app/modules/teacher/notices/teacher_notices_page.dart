import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherNoticesPage extends StatefulWidget {
  final bool embedded;
  const TeacherNoticesPage({super.key, this.embedded = false});
  @override
  State<TeacherNoticesPage> createState() => _TeacherNoticesPageState();
}

class _TeacherNoticesPageState extends State<TeacherNoticesPage> {
  List<Map<String, dynamic>> _notices = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final notices = await SupabaseService.fetchNotices();
    if (mounted) setState(() { _notices = notices; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    Widget body;

    if (_loading) {
      body = _buildShimmer();
    } else if (_notices.isEmpty) {
      body = _emptyState();
    } else {
      body = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _notices.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) => TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: Duration(milliseconds: 300 + i * 50),
            curve: Curves.easeOut,
            builder: (_, v, child) => Opacity(opacity: v,
              child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
            child: _NoticeCard(notice: _notices[i]),
          ),
        ),
      );
    }

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

class _NoticeCard extends StatelessWidget {
  final Map<String, dynamic> notice;
  const _NoticeCard({required this.notice});

  Color get _color {
    final t = (notice['type'] ?? '').toString().toLowerCase();
    if (t.contains('urgent') || t.contains('exam')) return AppColors.red;
    if (t.contains('event') || t.contains('holiday')) return AppColors.green;
    return AppColors.blue;
  }

  Color get _lightColor {
    final t = (notice['type'] ?? '').toString().toLowerCase();
    if (t.contains('urgent') || t.contains('exam')) return AppColors.redLight;
    if (t.contains('event') || t.contains('holiday')) return AppColors.greenLight;
    return AppColors.blueLight;
  }

  @override
  Widget build(BuildContext context) {
    final date = notice['created_at'] != null
      ? DateTime.tryParse(notice['created_at'] as String)
      : null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppShadows.card,
      ),
      child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          width: 5,
          decoration: BoxDecoration(
            color: _color,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
          ),
        ),
        Expanded(child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: _lightColor, borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.campaign_rounded, color: _color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if ((notice['type'] ?? '').toString().isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(bottom: 5),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: _lightColor, borderRadius: BorderRadius.circular(6)),
                  child: Text(notice['type'].toString(),
                    style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              Text(notice['title'] ?? '',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
              if ((notice['message'] ?? '').toString().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(notice['message'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.4)),
              ],
              if (date != null) ...[
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(Icons.access_time_rounded, size: 12, color: AppColors.textHint),
                  const SizedBox(width: 4),
                  Text(DateFormat('d MMM yyyy').format(date),
                    style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
                ]),
              ],
            ])),
          ]),
        )),
      ])),
    );
  }
}
