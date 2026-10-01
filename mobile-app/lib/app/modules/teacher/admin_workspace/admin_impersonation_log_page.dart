import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Settings -> Impersonation Log tab
// (ImpersonationLogTab.js) - read-only audit trail for the Admin Access
// Code feature. Senior Admin/Management only.
class AdminImpersonationLogPage extends StatefulWidget {
  const AdminImpersonationLogPage({super.key});
  @override
  State<AdminImpersonationLogPage> createState() => _AdminImpersonationLogPageState();
}

class _AdminImpersonationLogPageState extends State<AdminImpersonationLogPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;

  static const _eventLabels = {
    'created': ('Code Generated', AppColors.blue),
    'redeemed': ('Redeemed', AppColors.green),
    'redeem_failed': ('Failed Attempt', AppColors.red),
  };
  static const _detailLabels = {
    'not_found': 'Invalid code', 'already_used': 'Code already used', 'expired': 'Code expired',
    'role_mismatch': 'Wrong app (student/teacher mismatch)', 'target_deleted': 'Account no longer exists',
  };

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await StaffAdminService.impersonationLog(_employeeId, limit: 200);
      if (mounted) setState(() { _rows = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load the audit log.'; _loading = false; });
    }
  }

  String _fmtWhen(String? iso) {
    if (iso == null) return '—';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '—';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AdminAppBar(title: 'Access Code Log', actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load)]),
      body: _loading
        ? const AdminLoading()
        : _error != null
          ? AdminErrorState(message: _error!, onRetry: _load)
          : _rows.isEmpty
            ? const AdminEmptyState(icon: Icons.key_off_rounded, title: 'No access codes yet', subtitle: 'Generated, redeemed, and failed access codes will appear here.')
            : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final r = _rows[i];
                  final ev = _eventLabels[r['event_type'] as String?] ?? ((r['event_type'] ?? '') as String, AppColors.textLight);
                  return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      AdminStatusPill(label: ev.$1, color: ev.$2, light: ev.$2.withValues(alpha: .15)),
                      const Spacer(),
                      Text(_fmtWhen(r['occurred_at'] as String?), style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                    ]),
                    const SizedBox(height: 8),
                    Text('${r['target_label'] ?? '—'}${r['target_type'] != null ? ' (${r['target_type']})' : ''}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    if (r['created_by_name'] != null) Text('By ${r['created_by_name']}', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                    if (r['detail'] != null) Text(_detailLabels[r['detail']] ?? r['detail'] as String, style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                  ]));
                },
              )),
    );
  }
}
