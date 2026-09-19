import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminNoticesPage extends StatefulWidget {
  const AdminNoticesPage({super.key});
  @override
  State<AdminNoticesPage> createState() => _AdminNoticesPageState();
}

class _AdminNoticesPageState extends State<AdminNoticesPage> {
  List<Map<String, dynamic>> _notices = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  String get _employeeName => AuthService.to.profile.value?['name'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.notices(_employeeId);
      if (mounted) setState(() { _notices = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load notices.'; _loading = false; });
    }
  }

  Future<void> _compose({Map<String, dynamic>? existing}) async {
    final titleCtrl = TextEditingController(text: existing?['title'] as String? ?? '');
    final contentCtrl = TextEditingController(text: existing?['content'] as String? ?? '');
    String audience = existing?['audience'] as String? ?? 'Everyone';
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(existing == null ? 'New Notice' : 'Edit Notice', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: contentCtrl, maxLines: 4, decoration: const InputDecoration(labelText: 'Content', border: OutlineInputBorder())),
          if (existing == null) ...[
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: audience,
              decoration: const InputDecoration(labelText: 'Audience', border: OutlineInputBorder()),
              items: const ['Everyone', 'All Students', 'All Staff', 'Parents', 'Management']
                  .map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
              onChanged: (v) => setSheet(() => audience = v ?? audience),
            ),
          ],
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ]),
      )),
    );
    if (saved != true || titleCtrl.text.trim().isEmpty) return;
    try {
      if (existing == null) {
        await StaffAdminService.createNotice(_employeeId,
          title: titleCtrl.text.trim(), content: contentCtrl.text.trim(), audience: audience,
          postedDate: DateFormat('yyyy-MM-dd').format(DateTime.now()), postedBy: _employeeName);
      } else {
        await StaffAdminService.updateNotice(_employeeId, existing['id'] as String,
          title: titleCtrl.text.trim(), content: contentCtrl.text.trim());
      }
      if (mounted) showAdminSnack(context, 'Notice saved');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save notice.', isError: true);
    }
  }

  Future<void> _toggleFlag(Map<String, dynamic> n, {bool? pinned, bool? archived}) async {
    try {
      await StaffAdminService.setNoticeFlags(_employeeId, n['id'] as String,
        pinned: pinned ?? (n['pinned'] as bool? ?? false), archived: archived ?? (n['archived'] as bool? ?? false));
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to update notice.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Notices'),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.navy, onPressed: () => _compose(), child: const Icon(Icons.add)),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _notices.isEmpty ? const AdminEmptyState(icon: Icons.campaign_rounded, title: 'No notices', subtitle: 'Tap + to post one.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _notices.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final n = _notices[i];
              final pinned = n['pinned'] as bool? ?? false;
              final archived = n['archived'] as bool? ?? false;
              return AdminCard(onTap: () => _compose(existing: n), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(n['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                  if (pinned) const Icon(Icons.push_pin_rounded, size: 16, color: AppColors.amber),
                  if (archived) const AdminStatusPill(label: 'Archived', color: AppColors.stone, light: AppColors.stoneLight),
                ]),
                if ((n['content'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(n['content'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ],
                const SizedBox(height: 8),
                Row(children: [
                  TextButton.icon(onPressed: () => _toggleFlag(n, pinned: !pinned),
                    icon: Icon(pinned ? Icons.push_pin_rounded : Icons.push_pin_outlined, size: 16),
                    label: Text(pinned ? 'Unpin' : 'Pin')),
                  TextButton.icon(onPressed: () => _toggleFlag(n, archived: !archived),
                    icon: Icon(archived ? Icons.unarchive_rounded : Icons.archive_outlined, size: 16),
                    label: Text(archived ? 'Unarchive' : 'Archive')),
                ]),
              ]));
            },
          )),
    );
  }
}
