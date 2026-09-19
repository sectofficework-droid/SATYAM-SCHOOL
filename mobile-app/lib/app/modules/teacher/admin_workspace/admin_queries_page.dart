import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminQueriesPage extends StatefulWidget {
  const AdminQueriesPage({super.key});
  @override
  State<AdminQueriesPage> createState() => _AdminQueriesPageState();
}

class _AdminQueriesPageState extends State<AdminQueriesPage> {
  List<Map<String, dynamic>> _queries = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.queries(_employeeId);
      if (mounted) setState(() { _queries = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load queries.'; _loading = false; });
    }
  }

  Future<void> _openThread(Map<String, dynamic> q) async {
    final replyCtrl = TextEditingController(text: q['admin_reply'] as String? ?? '');
    final resolved = q['status'] == 'Resolved';
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(q['user_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 6),
          Text(q['message'] as String? ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
          const SizedBox(height: 14),
          TextField(controller: replyCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Reply', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await StaffAdminService.setQueryResolved(_employeeId, q['id'] as String, !resolved);
                _load();
              },
              child: Text(resolved ? 'Reopen' : 'Mark Resolved'),
            )),
            const SizedBox(width: 10),
            Expanded(child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
              onPressed: () async {
                if (replyCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await StaffAdminService.replyToQuery(_employeeId, q['id'] as String, replyCtrl.text.trim());
                  if (mounted) showAdminSnack(context, 'Reply sent');
                  _load();
                } catch (e) {
                  if (mounted) showAdminSnack(context, 'Failed to send reply.', isError: true);
                }
              },
              child: const Text('Send Reply'),
            )),
          ]),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Queries'),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _queries.isEmpty ? const AdminEmptyState(icon: Icons.forum_rounded, title: 'No queries', subtitle: 'Queries and suggestions will appear here.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _queries.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final q = _queries[i];
              final resolved = q['status'] == 'Resolved';
              return AdminCard(onTap: () => _openThread(q), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(q['user_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                  AdminStatusPill(label: resolved ? 'Resolved' : 'Pending',
                    color: resolved ? AppColors.green : AppColors.amber, light: resolved ? AppColors.greenLight : AppColors.amberLight),
                ]),
                const SizedBox(height: 4),
                Text(q['message'] as String? ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
              ]));
            },
          )),
    );
  }
}
