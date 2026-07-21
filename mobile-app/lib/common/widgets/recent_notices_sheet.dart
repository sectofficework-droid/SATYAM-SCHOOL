import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/notice_types.dart';

// Bottom sheet shown once per day when the app opens, if there are notices
// from the last 24 hours - a compact summary with a "View All" hand-off to
// the full Notices screen (navigation is the caller's responsibility, via
// onViewAll, since routes differ between the teacher and student apps).
Future<void> showRecentNoticesSheet(
  BuildContext context, {
  required List<Map<String, dynamic>> notices,
  required VoidCallback onViewAll,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.3,
      maxChildSize: 0.85,
      expand: false,
      builder: (ctx, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(children: [
          const SizedBox(height: 12),
          Container(
            width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.notifications_active_rounded, color: AppColors.navy, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('New Today', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
                Text('${notices.length} notification${notices.length == 1 ? '' : 's'} in the last 24 hours',
                  style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
              ])),
              IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
            ]),
          ),
          Expanded(
            child: ListView.separated(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              itemCount: notices.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final n      = notices[i];
                final type   = n['type'] as String?;
                final color  = noticeTypeColor(type);
                final light  = noticeTypeLight(type);
                final dateStr = (n['posted_date'] ?? n['created_at']) as String?;
                final date   = dateStr != null ? DateTime.tryParse(dateStr) : null;
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 8, height: 8,
                      margin: const EdgeInsets.only(top: 5),
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        if ((type ?? '').isNotEmpty)
                          Container(
                            margin: const EdgeInsets.only(right: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(color: light, borderRadius: BorderRadius.circular(5)),
                            child: Text(type!, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)),
                          ),
                        if (date != null)
                          Text(DateFormat('h:mm a').format(date), style: const TextStyle(color: AppColors.textHint, fontSize: 10)),
                      ]),
                      const SizedBox(height: 3),
                      Text(n['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text)),
                      if ((n['content'] ?? '').toString().isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(n['content'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: AppColors.textLight, height: 1.3)),
                      ],
                    ])),
                  ]),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: GestureDetector(
              onTap: () { Navigator.pop(ctx); onViewAll(); },
              child: Container(
                height: 48,
                decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(14)),
                child: const Center(child: Text('View All Notices',
                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700))),
              ),
            ),
          ),
        ]),
      ),
    ),
  );
}
