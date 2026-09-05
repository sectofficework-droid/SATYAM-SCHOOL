import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/notice_types.dart';

// Full, untruncated view of a notice/notification - both NoticeCard (Notices
// list) and the "recent notices" bell sheet only ever show a couple of lines
// of content with no way to read the rest, so this is what a tap on either
// one opens.
void showNoticeDetailDialog(BuildContext context, Map<String, dynamic> notice) {
  final dateStr = (notice['posted_date'] ?? notice['created_at']) as String?;
  final date    = dateStr != null ? DateTime.tryParse(dateStr) : null;
  final type    = notice['type'] as String?;
  final color   = noticeTypeColor(type);
  final light   = noticeTypeLight(type);

  showDialog(
    context: context,
    builder: (ctx) => Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 480),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if ((type ?? '').isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: light, borderRadius: BorderRadius.circular(6)),
                  child: Text(type!, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              if (date != null)
                Text(DateFormat('d MMM yyyy, h:mm a').format(date),
                  style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
              const Spacer(),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.close_rounded, color: AppColors.textHint, size: 20),
                onPressed: () => Navigator.pop(ctx),
              ),
            ]),
            const SizedBox(height: 10),
            Text(notice['title'] ?? '',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: AppColors.text)),
            if ((notice['content'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 10),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(notice['content'].toString(),
                    style: const TextStyle(color: AppColors.textLight, fontSize: 14, height: 1.6)),
                ),
              ),
            ],
          ]),
        ),
      ),
    ),
  );
}
