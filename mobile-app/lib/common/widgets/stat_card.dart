import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class StatCard extends StatefulWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final VoidCallback? onTap;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color   = AppColors.navy,
    this.bgColor = AppColors.blueLight,
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: widget.bgColor,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: widget.color.withOpacity(_pressed ? .5 : 0), width: 1.5),
          boxShadow: [
            BoxShadow(color: widget.color.withOpacity(.18), blurRadius: 14, offset: const Offset(0, 6)),
          ],
        ),
        // Every card gets an identical-size icon badge and a text block
        // pinned to the same fixed width, so all cards share one natural
        // layout size regardless of how long their label/value text is.
        // The outer FittedBox then only ever scales down for genuinely
        // cramped screens, and applies the SAME factor to every card in the
        // grid (since they're all the same size to begin with) instead of a
        // different factor per card - which is what made icons render at
        // different sizes card-to-card before.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 46, height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [widget.color, widget.color.withOpacity(.75)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(color: widget.color.withOpacity(.4), blurRadius: 8, offset: const Offset(0, 3)),
                  ],
                ),
                child: Icon(widget.icon, color: Colors.white, size: 23),
              ),
              const SizedBox(height: 9),
              SizedBox(
                width: 92,
                child: Text(widget.value,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.text)),
              ),
              const SizedBox(height: 2),
              SizedBox(
                width: 92,
                child: Text(widget.label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: widget.color.withOpacity(.75))),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
