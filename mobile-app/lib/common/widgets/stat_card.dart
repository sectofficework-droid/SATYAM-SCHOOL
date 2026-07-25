import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

// Module-card style: a pastel card with a semicircle "dome" accent behind a
// full-color emoji icon, and the module name below - no stat text on the
// card face (tap through to the module to see its numbers). badgeCount is
// for genuinely unread-style counts (kept optional, unused by most cards).
class StatCard extends StatefulWidget {
  final String label;
  final String emoji;
  final Color color;
  final Color bgColor;
  final int? badgeCount;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.label,
    required this.emoji,
    this.color   = AppColors.navy,
    this.bgColor = AppColors.blueLight,
    this.badgeCount,
    this.onTap,
  });

  @override
  State<StatCard> createState() => _StatCardState();
}

class _StatCardState extends State<StatCard> {
  bool _pressed = false;

  void _setPressed(bool v) {
    if (widget.onTap == null) return;
    setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: widget.onTap,
    onTapDown: (_) => _setPressed(true),
    onTapUp:   (_) => _setPressed(false),
    onTapCancel: () => _setPressed(false),
    child: AnimatedScale(
      scale: _pressed ? 0.95 : 1,
      duration: const Duration(milliseconds: 120),
      curve: Curves.easeOut,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
            decoration: BoxDecoration(
              color: widget.bgColor,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: widget.color.withOpacity(.55), width: _pressed ? 2.2 : 1.6),
              boxShadow: [
                BoxShadow(color: widget.color.withOpacity(.14), blurRadius: 14, offset: const Offset(0, 6)),
              ],
            ),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 88, height: 62,
                    child: Stack(
                      alignment: Alignment.bottomCenter,
                      children: [
                        Container(
                          width: 78, height: 39,
                          decoration: BoxDecoration(
                            color: widget.color.withOpacity(.28),
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(39),
                              topRight: Radius.circular(39),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 3,
                          child: Text(widget.emoji, style: const TextStyle(fontSize: 38, height: 1)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Fixed width + forced single line (not just a max-width)
                  // so every card's natural size is identical before the
                  // outer FittedBox scales it - a card whose label wraps to
                  // 2 lines is taller than its neighbors, and the FittedBox
                  // then shrinks THAT card more than the others to fit the
                  // same grid cell, making icons look inconsistently sized
                  // across the grid.
                  SizedBox(
                    width: 108,
                    child: Text(widget.label,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.text)),
                  ),
                ],
              ),
            ),
          ),
          if (widget.badgeCount != null && widget.badgeCount! > 0)
            Positioned(
              top: -6, right: -6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.red,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [BoxShadow(color: AppColors.red.withOpacity(.4), blurRadius: 6, offset: const Offset(0, 2))],
                ),
                child: Text('${widget.badgeCount}',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ),
        ],
      ),
    ),
  );
}
