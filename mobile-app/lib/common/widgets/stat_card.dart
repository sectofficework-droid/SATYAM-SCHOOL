import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

// Module-card style, matching the reference ("module icon in mobile view.png"):
// a pastel card whose top is a wide, shallow color-wave (a big circle
// positioned mostly above the card and clipped to the card's own rounded
// corners, rather than a small hand-drawn dome), a Material icon in a white
// badge sitting on that wave, and the module name left-aligned below it - no
// stat text on the card face (tap through to the module to see its numbers).
// badgeCount is for genuinely unread-style counts (kept optional, unused by
// most cards).
class StatCard extends StatefulWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final int? badgeCount;
  final VoidCallback? onTap;
  // Teacher dashboard wants icon + label centered (and a bigger icon badge);
  // the student dashboard keeps the original left-aligned layout that was
  // matched to the mobile reference screenshot.
  final bool centered;

  const StatCard({
    super.key,
    required this.label,
    required this.icon,
    this.color   = AppColors.navy,
    this.bgColor = AppColors.blueLight,
    this.badgeCount,
    this.onTap,
    this.centered = false,
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
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              decoration: BoxDecoration(
                color: widget.bgColor,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: widget.color.withOpacity(.55), width: _pressed ? 2.2 : 1.6),
                boxShadow: [
                  BoxShadow(color: widget.color.withOpacity(.14), blurRadius: 14, offset: const Offset(0, 6)),
                ],
              ),
              child: Stack(
                children: [
                  // The "wave": a circle much bigger than the card, mostly
                  // positioned above it - only its lower arc shows once the
                  // outer ClipRRect cuts it to the card's own rounded shape,
                  // giving a wide, shallow curve instead of a tight dome.
                  Positioned(
                    top: -96, left: -28, right: -28,
                    child: Container(
                      height: 150,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withOpacity(.30)),
                    ),
                  ),
                  if (widget.centered)
                    // Fills the full card instead of a fixed-width FittedBox
                    // block - a fixed width left slack on either side of the
                    // icon/label whenever a responsive column's card came
                    // out wider than that block, which made the horizontal
                    // gap between cards look much bigger than the vertical
                    // gap between rows even though the Wrap spacing was the
                    // same on both axes.
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
                      // Without an explicit width, this column (and the
                      // colored card behind it) shrinks to fit each label's
                      // own text width - a short label like "Homework" made
                      // a narrower card than "Student Attendance", all
                      // left-anchored in the same grid cell, which is what
                      // produced the zig-zag row. Forcing full width here
                      // keeps every card in a row the same visible size.
                      child: SizedBox(
                        width: double.infinity,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              width: 46, height: 46,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(color: widget.color.withOpacity(.30), blurRadius: 8, offset: const Offset(0, 3)),
                                ],
                              ),
                              child: Icon(widget.icon, color: widget.color, size: 27),
                            ),
                            const SizedBox(height: 8),
                            Text(widget.label,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.text)),
                          ],
                        ),
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 16, 8, 14),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              height: 42,
                              child: Center(
                                child: Container(
                                  width: 40, height: 40,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(color: widget.color.withOpacity(.30), blurRadius: 8, offset: const Offset(0, 3)),
                                    ],
                                  ),
                                  child: Icon(widget.icon, color: widget.color, size: 22),
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            // Fixed width + forced single line (not just a
                            // max-width) so every card's natural size is
                            // identical before the outer FittedBox scales it -
                            // a card whose label wraps to 2 lines is taller
                            // than its neighbors, and the FittedBox then
                            // shrinks THAT card more than the others to fit
                            // the same grid cell, making icons render smaller
                            // than the rest of the row.
                            SizedBox(
                              width: 104,
                              child: Text(widget.label,
                                maxLines: 1,
                                softWrap: false,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.text)),
                            ),
                          ],
                        ),
                      ),
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
