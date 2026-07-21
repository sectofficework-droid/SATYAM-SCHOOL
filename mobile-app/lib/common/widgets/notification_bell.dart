import 'package:flutter/material.dart';

// Bell icon with a small red count badge, used in the teacher/student home
// app bars near the profile avatar.
class NotificationBell extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  const NotificationBell({super.key, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Stack(clipBehavior: Clip.none, children: [
      const Icon(Icons.notifications_outlined, color: Colors.white70, size: 24),
      if (count > 0)
        Positioned(
          right: -4, top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
            child: Center(
              child: Text(
                count > 9 ? '9+' : '$count',
                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
    ]),
  );
}
