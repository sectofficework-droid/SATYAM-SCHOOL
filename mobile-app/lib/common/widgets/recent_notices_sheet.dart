import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/notice_types.dart';
import '../../core/utils/recent_notices.dart';

// Simple swipeable notification panel - notices from the last 24 hours only,
// swipe left or right to dismiss one. Shown both on app open (once per day,
// if there's anything new) and whenever the header bell is tapped.
// userKey identifies the logged-in account for persisting dismissals (e.g.
// 'teacher_<employeeId>') so a swiped-away notice doesn't reappear today.
Future<void> showRecentNoticesSheet(
  BuildContext context, {
  required List<Map<String, dynamic>> notices,
  required String userKey,
  required VoidCallback onViewAll,
  ValueChanged<Map<String, dynamic>>? onDismissed,
  ValueChanged<Map<String, dynamic>>? onItemTap,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => _RecentNoticesSheet(
      notices: notices,
      userKey: userKey,
      onViewAll: onViewAll,
      onDismissed: onDismissed,
      onItemTap: onItemTap,
    ),
  );
}

class _RecentNoticesSheet extends StatefulWidget {
  final List<Map<String, dynamic>> notices;
  final String userKey;
  final VoidCallback onViewAll;
  final ValueChanged<Map<String, dynamic>>? onDismissed;
  final ValueChanged<Map<String, dynamic>>? onItemTap;
  const _RecentNoticesSheet({
    required this.notices, required this.userKey, required this.onViewAll, this.onDismissed, this.onItemTap,
  });

  @override
  State<_RecentNoticesSheet> createState() => _RecentNoticesSheetState();
}

class _RecentNoticesSheetState extends State<_RecentNoticesSheet> {
  late List<Map<String, dynamic>> _items;

  @override
  void initState() { super.initState(); _items = List.of(widget.notices); }

  void _remove(Map<String, dynamic> notice) {
    dismissNotice(widget.userKey, '${notice['id']}');
    setState(() => _items.remove(notice));
    widget.onDismissed?.call(notice);
  }

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
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
              const Text('Notifications', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
              Text(_items.isEmpty ? 'Nothing new in the last 24 hours' : '${_items.length} in the last 24 hours · swipe to remove',
                style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
            ])),
            IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(context)),
          ]),
        ),
        Expanded(
          child: _items.isEmpty
              ? Center(child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.notifications_off_outlined, color: AppColors.textHint, size: 36),
                    const SizedBox(height: 10),
                    const Text('You\'re all caught up', style: TextStyle(color: AppColors.textLight, fontSize: 13)),
                  ]),
                ))
              : ListView.separated(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final n      = _items[i];
                    final type   = n['type'] as String?;
                    final color  = noticeTypeColor(type);
                    final light  = noticeTypeLight(type);
                    final dateStr = (n['posted_date'] ?? n['created_at']) as String?;
                    final date   = dateStr != null ? DateTime.tryParse(dateStr) : null;
                    final tappable = n['_isTask'] == true && widget.onItemTap != null;
                    return Dismissible(
                      key: ValueKey(n['id'] ?? '${n['title']}_$i'),
                      direction: DismissDirection.horizontal,
                      onDismissed: (_) => _remove(n),
                      background: _swipeBg(Alignment.centerLeft),
                      secondaryBackground: _swipeBg(Alignment.centerRight),
                      child: GestureDetector(
                        onTap: tappable ? () { Navigator.pop(context); widget.onItemTap!(n); } : null,
                        child: Container(
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
                            if (tappable) const Padding(
                              padding: EdgeInsets.only(left: 4, top: 5),
                              child: Icon(Icons.chevron_right_rounded, color: AppColors.textHint, size: 18),
                            ),
                          ]),
                        ),
                      ),
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: GestureDetector(
            onTap: () { Navigator.pop(context); widget.onViewAll(); },
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
  );

  Widget _swipeBg(Alignment align) => Container(
    decoration: BoxDecoration(color: AppColors.redLight, borderRadius: BorderRadius.circular(12)),
    alignment: align,
    padding: const EdgeInsets.symmetric(horizontal: 20),
    child: const Icon(Icons.close_rounded, color: AppColors.red),
  );
}
