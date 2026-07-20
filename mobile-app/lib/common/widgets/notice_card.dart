import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/notice_types.dart';

class NoticeCard extends StatelessWidget {
  final Map<String, dynamic> notice;
  const NoticeCard({super.key, required this.notice});

  @override
  Widget build(BuildContext context) {
    // posted_date is the date admin set for the notice; created_at (insert
    // time) is only a fallback for older rows that predate posted_date.
    final dateStr = (notice['posted_date'] ?? notice['created_at']) as String?;
    final date    = dateStr != null ? DateTime.tryParse(dateStr) : null;
    final type    = notice['type'] as String?;
    final color   = noticeTypeColor(type);
    final light   = noticeTypeLight(type);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            if ((type ?? '').isNotEmpty)
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: light, borderRadius: BorderRadius.circular(6)),
                child: Text(type!,
                  style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.amberLight,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(notice['audience'] ?? 'All',
                style: const TextStyle(color: AppColors.amber, fontSize: 11, fontWeight: FontWeight.w600)),
            ),
            const Spacer(),
            if (date != null)
              Text(DateFormat('d MMM').format(date),
                style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
          ]),
          const SizedBox(height: 8),
          Text(notice['title'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
          if ((notice['content'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notice['content'].toString(),
              style: const TextStyle(color: AppColors.textLight, fontSize: 13, height: 1.5),
              maxLines: 4, overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}
