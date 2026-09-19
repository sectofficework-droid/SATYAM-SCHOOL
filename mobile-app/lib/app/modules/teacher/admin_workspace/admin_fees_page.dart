import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminFeesPage extends StatefulWidget {
  const AdminFeesPage({super.key});
  @override
  State<AdminFeesPage> createState() => _AdminFeesPageState();
}

class _AdminFeesPageState extends State<AdminFeesPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Fees'),
      body: Column(children: [
        Material(color: AppColors.card, child: TabBar(
          controller: _tabs, labelColor: AppColors.navy, unselectedLabelColor: AppColors.textLight, indicatorColor: AppColors.navy,
          tabs: const [Tab(text: 'Students'), Tab(text: 'Fee Structure')],
        )),
        Expanded(child: TabBarView(controller: _tabs, children: [
          _StudentsFeesTab(employeeId: _employeeId),
          _FeeStructureTab(employeeId: _employeeId),
        ])),
      ]),
    );
  }
}

class _StudentsFeesTab extends StatefulWidget {
  final String employeeId;
  const _StudentsFeesTab({required this.employeeId});
  @override
  State<_StudentsFeesTab> createState() => _StudentsFeesTabState();
}

class _StudentsFeesTabState extends State<_StudentsFeesTab> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.studentsFees(widget.employeeId, search: search);
      if (mounted) setState(() { _rows = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load fee data.'; _loading = false; });
    }
  }

  Future<void> _recordPayment(Map<String, dynamic> row) async {
    final amountCtrl = TextEditingController();
    final byCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Record Payment — ${row['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: amountCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: byCtrl, decoration: const InputDecoration(labelText: 'Received by', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Record Payment')),
        ]),
      ),
    );
    final amount = num.tryParse(amountCtrl.text);
    if (ok != true || amount == null) return;
    try {
      await StaffAdminService.recordFeePayment(widget.employeeId,
        enrollmentId: row['enrollment_id'] as String, studentId: row['student_id'] as String,
        amount: amount, date: DateFormat('yyyy-MM-dd').format(DateTime.now()), receivedBy: byCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Payment recorded');
      _load(search: _searchCtrl.text);
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to record payment.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(padding: const EdgeInsets.all(16), child: TextField(
        controller: _searchCtrl,
        decoration: const InputDecoration(labelText: 'Search student', border: OutlineInputBorder(), prefixIcon: Icon(Icons.search)),
        onSubmitted: (v) => _load(search: v),
      )),
      Expanded(child: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: () => _load())
        : _rows.isEmpty ? const AdminEmptyState(icon: Icons.payments_rounded, title: 'No students', subtitle: 'Try a different search.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: () => _load(search: _searchCtrl.text), child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _rows.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final r = _rows[i];
              final total = (r['fee_total'] as num? ?? 0) - (r['fee_discount'] as num? ?? 0);
              final paid = r['paid'] as num? ?? 0;
              final due = total - paid;
              return AdminCard(onTap: () => _recordPayment(r), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text('${r['class_name'] ?? ''} - ${r['section_name'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('₹$paid / ₹$total', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  Text(due > 0 ? 'Due ₹$due' : 'Paid up', style: TextStyle(fontSize: 11, color: due > 0 ? AppColors.red : AppColors.green)),
                ]),
              ]));
            },
          )),
      ),
    ]);
  }
}

class _FeeStructureTab extends StatefulWidget {
  final String employeeId;
  const _FeeStructureTab({required this.employeeId});
  @override
  State<_FeeStructureTab> createState() => _FeeStructureTabState();
}

class _FeeStructureTabState extends State<_FeeStructureTab> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.feeStructures(widget.employeeId);
      if (mounted) setState(() { _rows = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load fee structures.'; _loading = false; });
    }
  }

  Future<void> _edit(Map<String, dynamic> row) async {
    final tuitionCtrl = TextEditingController(text: '${row['tuition_amount'] ?? 0}');
    final uniformCtrl = TextEditingController(text: '${row['uniform_amount'] ?? 0}');
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${row['class_name']} Fee Structure', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: tuitionCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Tuition Amount', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: uniformCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Uniform Amount', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ]),
      ),
    );
    if (ok != true) return;
    try {
      await StaffAdminService.upsertFeeStructure(widget.employeeId, row['class_id'] as String,
        num.tryParse(tuitionCtrl.text) ?? 0, num.tryParse(uniformCtrl.text) ?? 0);
      if (mounted) showAdminSnack(context, 'Fee structure updated');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to update.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _load);
    if (_rows.isEmpty) return const AdminEmptyState(icon: Icons.receipt_long_rounded, title: 'No fee structures', subtitle: 'Set up class fee structures in the admin panel first.');
    return RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final r = _rows[i];
        return AdminCard(onTap: () => _edit(r), child: Row(children: [
          Expanded(child: Text(r['class_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
          Text('Tuition ₹${r['tuition_amount'] ?? 0} + Uniform ₹${r['uniform_amount'] ?? 0}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
        ]));
      },
    ));
  }
}
