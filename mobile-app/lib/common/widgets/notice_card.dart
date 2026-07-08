import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';

class NoticeCard extends StatelessWidget {
  final Map<String, dynamic> notice;
  const NoticeCard({super.key, required this.notice});

  @override
  Widget build(BuildContext context) {
    final createdAt = DateTime.tryParse(notice['created_at'] ?? '');
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
            if (createdAt != null)
              Text(DateFormat('d MMM').format(createdAt),
                style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
          ]),
          const SizedBox(height: 8),
          Text(notice['title'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
          if ((notice['body'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notice['body'],
              style: const TextStyle(color: AppColors.textLight, fontSize: 13, height: 1.5),
              maxLines: 4, overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}
