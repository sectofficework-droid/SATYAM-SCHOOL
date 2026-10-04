import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../core/services/pdf_reports_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import 'admin_staff_attendance_report_page.dart';

// Mobile port of the web admin panel's Report Builder (/report page), slice
// 5 of this effort - a hub listing all 8 report types, including Staff
// Attendance (shipped 2026-10-01 as its own screen, with a date-range picker
// rather than the generic list below - listed here too for discoverability,
// per user feedback that it wasn't found under its original Kiosk-section
// tile alone; that tile stays too, this is additive). Deliberately condensed
// for the other 7, not field-for-field parity - see
// mobile-app/SUPABASE_STAFF_APP_REPORTS_ADMIN.sql's header comment for why.
// Senior Admin/Management only (Fees - Super Admin is management-only).
class AdminReportsPage extends StatelessWidget {
  const AdminReportsPage({super.key});

  bool get _isMgmt => (AuthService.to.profile.value?['admin_role'] as Map?)?['tier'] == 'management';

  @override
  Widget build(BuildContext context) {
    final tiles = <(String, IconData, VoidCallback)>[
      ('Staff Attendance', Icons.fact_check_rounded, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminStaffAttendanceReportPage()))),
      ('Students', Icons.school_rounded, () => _openList(context, 'Students', StaffAdminService.reportStudents)),
      ('TC Issued', Icons.description_rounded, () => _openList(context, 'TC Issued', StaffAdminService.reportTcIssued)),
      ('Fee Payments', Icons.payments_rounded, () => _openList(context, 'Fee Payments', StaffAdminService.reportPayments)),
      ('Fees (Current Year)', Icons.receipt_long_rounded, () => _openList(context, 'Fees (Current Year)', StaffAdminService.reportFees)),
      if (_isMgmt) ('Fees — Super Admin', Icons.account_balance_wallet_rounded, () => _openList(context, 'Fees — Super Admin', StaffAdminService.reportFeesSuperAdmin)),
      ('Employees', Icons.badge_rounded, () => _openList(context, 'Employees', StaffAdminService.reportEmployees)),
      ('Inventory', Icons.inventory_2_rounded, () => _openList(context, 'Inventory', StaffAdminService.reportInventory)),
    ];

    final downloadTiles = <(String, IconData, VoidCallback)>[
      ('Download ID Cards (PDF)', Icons.badge_outlined, () => _downloadIdCards(context)),
      ('Download Bonafide Certificate (PDF)', Icons.file_present_rounded, () => _downloadBonafide(context)),
      ('Download Transfer Certificate (PDF)', Icons.move_up_rounded, () => _downloadTc(context)),
      ('Download Marksheet (PDF)', Icons.assignment_rounded, () => _downloadMarksheet(context)),
      ('Download Attendance Report (PDF)', Icons.event_note_rounded, () => _downloadAttendance(context)),
      if (_isMgmt) ('Download Salary Report (PDF)', Icons.currency_rupee_rounded, () => _downloadSalary(context)),
    ];

    return Scaffold(
      appBar: const AdminAppBar(title: 'Reports'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('View', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.textLight)),
          const SizedBox(height: 8),
          ..._tilesWithGaps(tiles),
          const SizedBox(height: 20),
          const Text('Download', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.textLight)),
          const SizedBox(height: 8),
          ..._tilesWithGaps(downloadTiles),
        ],
      ),
    );
  }

  List<Widget> _tilesWithGaps(List<(String, IconData, VoidCallback)> tiles) {
    final widgets = <Widget>[];
    for (final (title, icon, onTap) in tiles) {
      if (widgets.isNotEmpty) widgets.add(const SizedBox(height: 8));
      widgets.add(AdminCard(
        onTap: onTap,
        child: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.navy, size: 18)),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
        ]),
      ));
    }
    return widgets;
  }

  void _openList(BuildContext context, String title, Future<List<Map<String, dynamic>>> Function(String) loader) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => _ReportListPage(title: title, loader: loader)));
  }

  String _employeeIdOf(BuildContext context) => AuthService.to.profile.value?['id'] as String? ?? '';
  String _sessionTokenOf(BuildContext context) => AuthService.to.sessionToken ?? '';

  Future<void> _runDownload(BuildContext context, String filename, Future<List<int>> Function() generate) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(const SnackBar(content: Text('Generating PDF…'), duration: Duration(seconds: 2)));
    try {
      final bytes = await generate();
      await Printing.sharePdf(bytes: Uint8List.fromList(bytes), filename: filename);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<String?> _promptText(BuildContext context, String title, String hint) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: controller, decoration: InputDecoration(hintText: hint)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('OK')),
        ],
      ),
    );
  }

  Future<void> _downloadIdCards(BuildContext context) async {
    final studentId = await _promptText(context, 'ID Card', 'Student ID');
    if (studentId == null || studentId.isEmpty) return;
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'ID_Cards.pdf', () => PdfReportsService.idCard(empId, token, [studentId]));
  }

  Future<void> _downloadBonafide(BuildContext context) async {
    final studentId = await _promptText(context, 'Bonafide Certificate', 'Student ID');
    if (studentId == null || studentId.isEmpty) return;
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'Bonafide_Certificate.pdf', () => PdfReportsService.bonafide(empId, token, [studentId]));
  }

  Future<void> _downloadTc(BuildContext context) async {
    final studentId = await _promptText(context, 'Transfer Certificate', 'Student ID');
    if (studentId == null || studentId.isEmpty) return;
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'Transfer_Certificate.pdf', () => PdfReportsService.tc(empId, token, studentId));
  }

  Future<void> _downloadMarksheet(BuildContext context) async {
    final studentId = await _promptText(context, 'Marksheet', 'Student ID');
    if (studentId == null || studentId.isEmpty) return;
    final className = await _promptText(context, 'Marksheet', 'Class (e.g. 6th)');
    if (className == null || className.isEmpty) return;
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'Marksheet.pdf', () => PdfReportsService.marksheet(empId, token, studentId, className));
  }

  Future<void> _downloadAttendance(BuildContext context) async {
    final fromDate = await _promptText(context, 'Attendance Report', 'From date (YYYY-MM-DD)');
    if (fromDate == null || fromDate.isEmpty) return;
    final toDate = await _promptText(context, 'Attendance Report', 'To date (YYYY-MM-DD)');
    if (toDate == null || toDate.isEmpty) return;
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'Attendance_Report.pdf', () => PdfReportsService.attendance(empId, token, fromDate, toDate));
  }

  Future<void> _downloadSalary(BuildContext context) async {
    final month = await _promptText(context, 'Salary Report', 'Month (YYYY-MM-DD, optional)');
    final empId = _employeeIdOf(context);
    final token = _sessionTokenOf(context);
    await _runDownload(context, 'Salary_Report.pdf', () => PdfReportsService.salary(empId, token, month?.isEmpty == true ? null : month));
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

  // Prefers a "name"-shaped field for the row's title (e.g. o_name,
  // o_student_name) over whatever happens to come first in the RPC's column
  // order - a bare enrollment/code number first in o_enroll_no made a much
  // worse title than the actual name sitting two columns later. Falls back
  // to the first non-empty string field when nothing name-shaped exists.
  String? _titleKeyFor(Map<String, dynamic> row) {
    for (final key in row.keys) {
      final v = row[key];
      if (v is String && v.isNotEmpty && key.toLowerCase().contains('name')) return key;
    }
    for (final key in row.keys) {
      final v = row[key];
      if (v is String && v.isNotEmpty) return key;
    }
    return null;
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
                    final titleKey = _titleKeyFor(row);
                    final title = titleKey != null ? row[titleKey] as String : 'Row';
                    final rest = row.entries.where((e) => e.key != titleKey).toList();
                    return AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
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
