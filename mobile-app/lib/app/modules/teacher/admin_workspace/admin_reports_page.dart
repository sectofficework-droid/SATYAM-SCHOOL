import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Report Builder (/report page), slice
// 5 of this effort - a hub listing the 7 report types beyond Staff
// Attendance (already shipped 2026-10-01 as its own screen). Deliberately
// condensed, not field-for-field parity - see
// mobile-app/SUPABASE_STAFF_APP_REPORTS_ADMIN.sql's header comment for why.
// Senior Admin/Management only (Fees - Super Admin is management-only).
class AdminReportsPage extends StatelessWidget {
  const AdminReportsPage({super.key});

  bool get _isMgmt => (AuthService.to.profile.value?['admin_role'] as Map?)?['tier'] == 'management';

  @override
  Widget build(BuildContext context) {
    final tiles = <(String, IconData, Future<List<Map<String, dynamic>>> Function(String))>[
      ('Students', Icons.school_rounded, StaffAdminService.reportStudents),
      ('TC Issued', Icons.description_rounded, StaffAdminService.reportTcIssued),
      ('Fee Payments', Icons.payments_rounded, StaffAdminService.reportPayments),
      ('Fees (Current Year)', Icons.receipt_long_rounded, StaffAdminService.reportFees),
      if (_isMgmt) ('Fees — Super Admin', Icons.account_balance_wallet_rounded, StaffAdminService.reportFeesSuperAdmin),
      ('Employees', Icons.badge_rounded, StaffAdminService.reportEmployees),
      ('Inventory', Icons.inventory_2_rounded, StaffAdminService.reportInventory),
    ];

    return Scaffold(
      appBar: const AdminAppBar(title: 'Reports'),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: tiles.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          final (title, icon, loader) = tiles[i];
          return AdminCard(
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => _ReportListPage(title: title, loader: loader))),
            child: Row(children: [
              Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: AppColors.navy, size: 18)),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
            ]),
          );
        },
      ),
    );
  }
}

// Generic read-only report list: fetches once, renders every non-o_-prefix-
// stripped column as a "Label: value" line per row, with a simple text
// search across all values. No export - the web page remains the
// authoritative full/condensed-field and XLSX/PDF export tool.
class _ReportListPage extends StatefulWidget {
  final String title;
  final Future<List<Map<String, dynamic>>> Function(String employeeId) loader;
  const _ReportListPage({required this.title, required this.loader});
  @override
  State<_ReportListPage> createState() => _ReportListPageState();
}

class _ReportListPageState extends State<_ReportListPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;
  String _query = '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await widget.loader(_employeeId);
      if (mounted) setState(() { _rows = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load this report.'; _loading = false; });
    }
  }

  String _label(String key) {
    final stripped = key.startsWith('o_') ? key.substring(2) : key;
    final words = stripped.split('_');
    return words.map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1)).join(' ');
  }

  String _fmtValue(dynamic v) {
    if (v == null) return '—';
    if (v is bool) return v ? 'Yes' : 'No';
    if (v is num) return v == v.roundToDouble() ? v.toInt().toString() : v.toString();
    if (v is String && RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(v)) {
      final d = DateTime.tryParse(v);
      if (d != null) return DateFormat('d MMM yyyy').format(d);
    }
    return v.toString();
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.trim().isEmpty) return _rows;
    final q = _query.toLowerCase();
    return _rows.where((r) => r.values.any((v) => v != null && v.toString().toLowerCase().contains(q))).toList();
  }

  // The first non-null text-ish field is used as the row's title; the rest
  // render as a label:value grid.
  String _titleFor(Map<String, dynamic> row) {
    for (final v in row.values) {
      if (v is String && v.isNotEmpty) return v;
    }
    return 'Row';
  }

  @override
  Widget build(BuildContext context) {
    final rows = _filtered;
    return Scaffold(
      appBar: AdminAppBar(title: widget.title, actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load)]),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Search…', border: OutlineInputBorder(), isDense: true),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Expanded(child: _loading
          ? const AdminLoading()
          : _error != null
            ? AdminErrorState(message: _error!, onRetry: _load)
            : rows.isEmpty
              ? const AdminEmptyState(icon: Icons.inbox_rounded, title: 'No records', subtitle: 'Nothing to show for this report.')
              : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final row = rows[i];
                    final entries = row.entries.toList();
                    final titleEntry = entries.firstWhere((e) => e.value is String && (e.value as String).isNotEmpty, orElse: () => entries.first);
                    final rest = entries.where((e) => e.key != titleEntry.key).toList();
                    return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_titleFor(row), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 6),
                      Wrap(spacing: 14, runSpacing: 4, children: rest.map((e) => Text(
                        '${_label(e.key)}: ${_fmtValue(e.value)}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textLight),
                      )).toList()),
                    ]));
                  },
                )),
        ),
      ]),
    );
  }
}
