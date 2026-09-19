import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// senior_admin/management only — server-enforced (staff_admin_syllabus_edit_requests
// raises for normal_admin). STAFF-APP-DESIGN-FIXED.md §3: deliberate
// tightening vs. the admin panel's flat gate.
class AdminSyllabusRequestsPage extends StatefulWidget {
  const AdminSyllabusRequestsPage({super.key});
  @override
  State<AdminSyllabusRequestsPage> createState() => _AdminSyllabusRequestsPageState();
}

class _AdminSyllabusRequestsPageState extends State<AdminSyllabusRequestsPage> {
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.syllabusEditRequests(_employeeId);
      if (mounted) setState(() { _requests = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load requests.'; _loading = false; });
    }
  }

  Future<void> _respond(Map<String, dynamic> req, bool approve) async {
    String? note;
    if (!approve) {
      note = await showModalBottomSheet<String>(
        context: context,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (ctx) {
          final ctrl = TextEditingController();
          return Padding(
            padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('Reject request', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Reject')),
            ]),
          );
        },
      );
      if (note == null) return;
    } else {
      final ok = await confirmAdminAction(context, title: 'Approve edit request',
        message: 'Allow ${req['teacher_name'] ?? 'this teacher'} to edit the ${req['subject_name']} syllabus for ${req['class_name']}?',
        confirmLabel: 'Approve');
      if (!ok) return;
    }
    try {
      await StaffAdminService.respondSyllabusEditRequest(_employeeId, req['id'] as String, approve: approve, adminNote: note);
      if (mounted) showAdminSnack(context, approve ? 'Approved' : 'Rejected');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to respond.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Syllabus Requests'),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _requests.isEmpty ? const AdminEmptyState(icon: Icons.menu_book_rounded, title: 'No pending requests', subtitle: 'Syllabus edit requests will appear here.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _requests.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final r = _requests[i];
              return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r['teacher_name'] ?? 'Unknown'} — ${r['subject_name']} (${r['class_name']})',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                if ((r['reason'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Reason: ${r['reason']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ],
                if ((r['requested_changes'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('Requested: ${r['requested_changes']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ],
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => _respond(r, false), child: const Text('Reject'))),
                  const SizedBox(width: 10),
                  Expanded(child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.green),
                    onPressed: () => _respond(r, true), child: const Text('Approve'))),
                ]),
              ]));
            },
          )),
    );
  }
}
