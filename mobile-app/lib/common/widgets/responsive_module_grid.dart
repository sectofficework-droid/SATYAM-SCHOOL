import 'package:flutter/material.dart';

// Lays out module/StatCard-style children in a grid whose column count
// scales with the available width - 3 per row on a phone, growing to
// 4/5/6 on tablets/desktop/web - instead of a fixed GridView.count column
// count that either cramps big screens or stretches cards too wide.
// Uses Wrap (not GridView) with fixed per-card widths so an incomplete
// final row (1-2 leftover cards) still lines up flush left, matching the
// full rows above it, rather than centering or leaving a blank gap.
class ResponsiveModuleGrid extends StatelessWidget {
  final List<Widget> children;
  final double aspectRatio;
  final double spacing;

  const ResponsiveModuleGrid({
    super.key,
    required this.children,
    this.aspectRatio = 1.05,
    this.spacing = 10,
  });

  static int columnsFor(double width) {
    if (width >= 1200) return 6;
    if (width >= 900)  return 5;
    if (width >= 600)  return 4;
    return 3;
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final columns   = columnsFor(constraints.maxWidth);
      final cardWidth = (constraints.maxWidth - spacing * (columns - 1)) / columns;
      final cardHeight = cardWidth / aspectRatio;
      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        alignment: WrapAlignment.start,
        children: children.map((c) => SizedBox(
          width: cardWidth,
          height: cardHeight,
          child: c,
        )).toList(),
      );
    },
  );
}
