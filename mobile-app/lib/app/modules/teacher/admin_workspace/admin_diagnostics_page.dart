import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Diagnostics page - the error-report
// inbox fed by both apps' auto-capture (gated by the enabled switch below)
// and the mobile "Report a Problem" flow (always on). See CLAUDE.md's
// REQ-HYG-006 note for the full picture. Senior Admin/Management only - the
// Teacher app's Admin Workspace is already gated end-to-end for this tile,
// so (unlike the web, which still gives normal_admin a redacted summary)
// this screen always shows full report content.
class AdminDiagnosticsPage extends StatefulWidget {
  const AdminDiagnosticsPage({super.key});
  @override
  State<AdminDiagnosticsPage> createState() => _AdminDiagnosticsPageState();
}

class _AdminDiagnosticsPageState extends State<AdminDiagnosticsPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;
  String? _error;
  bool _enabled = false;
  bool _enabledLoading = true;
  bool _togglingEnabled = false;

  @override
  void initState() { super.initState(); _load(); _loadEnabled(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await StaffAdminService.diagnosticReports(_employeeId);
      if (mounted) setState(() { _reports = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load diagnostic reports.'; _loading = false; });
    }
  }

  Future<void> _loadEnabled() async {
    try {
      final v = await StaffAdminService.getDiagnosticsEnabled(_employeeId);
      if (mounted) setState(() { _enabled = v; _enabledLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _enabledLoading = false);
    }
  }

  Future<void> _toggleEnabled(bool v) async {
    setState(() => _togglingEnabled = true);
    try {
      await StaffAdminService.setDiagnosticsEnabled(_employeeId, v);
      if (mounted) setState(() { _enabled = v; _togglingEnabled = false; });
    } catch (e) {
      if (mounted) { setState(() => _togglingEnabled = false); showAdminSnack(context, 'Failed to update.', isError: true); }
    }
  }

  Future<void> _markReport(Map<String, dynamic> report, String status) async {
    try {
      await StaffAdminService.markDiagnosticReport(_employeeId, report['id'] as String, status);
      if (mounted) setState(() => report['status'] = status);
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to update status.', isError: true);
    }
  }

  void _openDetail(Map<String, dynamic> r) {
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false, initialChildSize: 0.75,
        builder: (ctx, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(20),
          child: ListView(controller: scrollCtrl, children: [
            Text(r['description'] as String? ?? 'No description', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 8),
            Text('${r['app'] ?? ''} • ${r['platform'] ?? ''} • v${r['version'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
            Text('${r['user_type'] ?? ''}: ${r['user_name'] ?? '—'}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
            const SizedBox(height: 14),
            const Text('Log Entries', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(8)),
              child: Text(
                r['log_entries'] == null ? 'No log entries.' : const JsonEncoder.withIndent('  ').convert(r['log_entries']),
                style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  static const _statusColors = {'New': AppColors.red, 'Reviewed': AppColors.amber, 'Resolved': AppColors.green};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AdminAppBar(title: 'Diagnostics', actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load)]),
      body: Column(children: [
        Container(
          width: double.infinity, color: AppColors.card,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(children: [
            const Expanded(child: Text('Auto-capture logging', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
            _enabledLoading || _togglingEnabled
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Switch(value: _enabled, activeThumbColor: AppColors.navy, onChanged: _toggleEnabled),
          ]),
        ),
        Expanded(child: _loading
          ? const AdminLoading()
          : _error != null
            ? AdminErrorState(message: _error!, onRetry: _load)
            : _reports.isEmpty
              ? const AdminEmptyState(icon: Icons.bug_report_outlined, title: 'No reports', subtitle: 'Error reports from the apps will appear here.')
              : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _reports.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = _reports[i];
                    final status = r['status'] as String? ?? 'New';
                    final color = _statusColors[status] ?? AppColors.textLight;
                    return AdminCard(
                      onTap: () => _openDetail(r),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(r['description'] as String? ?? 'No description', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                          AdminStatusPill(label: status, color: color, light: color.withValues(alpha: .15)),
                        ]),
                        const SizedBox(height: 4),
                        Text('${r['app'] ?? ''} • ${r['platform'] ?? ''} • ${r['user_name'] ?? '—'}', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                        if (status == 'New') Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Row(children: [
                            OutlinedButton(onPressed: () => _markReport(r, 'Reviewed'), child: const Text('Mark Reviewed')),
                            const SizedBox(width: 8),
                            OutlinedButton(onPressed: () => _markReport(r, 'Resolved'), child: const Text('Resolve')),
                          ]),
                        ),
                      ]),
                    );
                  },
                )),
        ),
      ]),
    );
  }
}
