import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class SchoolAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBack;
  final Widget? bottom;
  final double bottomHeight;

  const SchoolAppBar({
    super.key,
    required this.title,
    this.actions,
    this.showBack = false,
    this.bottom,
    this.bottomHeight = 0,
  });

  @override
  Widget build(BuildContext context) => AppBar(
    title: Text(title),
    automaticallyImplyLeading: showBack,
    actions: actions,
    bottom: bottom != null ? PreferredSize(
      preferredSize: Size.fromHeight(bottomHeight),
      child: bottom!,
    ) : null,
  );

  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + bottomHeight);
}
