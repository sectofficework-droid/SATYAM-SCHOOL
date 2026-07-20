import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/notice_types.dart';

// Horizontal scrollable "All / Academic / Exam / Event / ..." chip row used
// to filter a notice list by category on both the teacher and student apps.
class NoticeTypeFilter extends StatelessWidget {
  final String selected; // 'All' or one of noticeTypes
  final ValueChanged<String> onChanged;
  const NoticeTypeFilter({super.key, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final options = ['All', ...noticeTypes];
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final opt    = options[i];
          final active = opt == selected;
          final color  = opt == 'All' ? AppColors.navy : noticeTypeColor(opt);
          final light  = opt == 'All' ? AppColors.blueLight : noticeTypeLight(opt);
          return GestureDetector(
            onTap: () => onChanged(opt),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: active ? color : light,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: active ? color : color.withOpacity(.25)),
              ),
              child: Text(opt,
                style: TextStyle(
                  color: active ? Colors.white : color,
                  fontSize: 12,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                )),
            ),
          );
        },
      ),
    );
  }
}
