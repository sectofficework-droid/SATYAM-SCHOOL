import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

// Shared building blocks for the Admin Workspace (Staff App Unification
// phase 1) — kept separate from the Teacher-flavor widgets so the two
// feature sets stay easy to tell apart in review. Deliberately simple
// (no shimmer/stagger animation) — functional parity with the design doc,
// not a pixel-for-pixel match of every existing Teacher screen's polish.

class AdminAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  const AdminAppBar({super.key, required this.title, this.actions});
  @override
  Widget build(BuildContext context) => AppBar(
    flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
    title: Text(title),
    actions: actions,
  );
  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class AdminLoading extends StatelessWidget {
  const AdminLoading({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator(color: AppColors.navy));
}

class AdminEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const AdminEmptyState({super.key, required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: Icon(icon, color: AppColors.navy, size: 38)),
      const SizedBox(height: 16),
      Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
    ]),
  ));
}

class AdminErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const AdminErrorState({super.key, required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 40),
      const SizedBox(height: 12),
      Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
      const SizedBox(height: 12),
      OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
    ]),
  ));
}

class AdminCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  const AdminCard({super.key, required this.child, this.onTap});
  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.card,
    borderRadius: BorderRadius.circular(16),
    elevation: 0,
    child: InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
        padding: const EdgeInsets.all(14),
        child: child,
      ),
    ),
  );
}

class AdminStatusPill extends StatelessWidget {
  final String label;
  final Color color;
  final Color light;
  const AdminStatusPill({super.key, required this.label, required this.color, required this.light});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: light, borderRadius: BorderRadius.circular(6)),
    child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
  );
}

Future<void> showAdminSnack(BuildContext context, String message, {bool isError = false}) async {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(message),
    backgroundColor: isError ? AppColors.red : AppColors.green,
  ));
}

Future<bool> confirmAdminAction(BuildContext context, {required String title, required String message, String confirmLabel = 'Confirm'}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (ctx) => Padding(
      padding: const EdgeInsets.all(20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 8),
        Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel'))),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel),
          )),
        ]),
      ]),
    ),
  );
  return result ?? false;
}
