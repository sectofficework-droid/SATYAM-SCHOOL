import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// management only — mirrors admin_get_salary_payments/
// admin_record_salary_payment's tier rule exactly.
class AdminSalaryPage extends StatefulWidget {
  const AdminSalaryPage({super.key});
  @override
  State<AdminSalaryPage> createState() => _AdminSalaryPageState();
}

class _AdminSalaryPageState extends State<AdminSalaryPage> {
  List<Map<String, dynamic>> _payments = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.salaryPayments(_employeeId);
      if (mounted) setState(() { _payments = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load salary data. Management tier only.'; _loading = false; });
    }
  }

  Future<void> _record() async {
    final searchCtrl = TextEditingController();
    List<Map<String, dynamic>> results = [];
    Map<String, dynamic>? selected;
    final amountCtrl = TextEditingController();

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Record Salary Payment', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          if (selected == null) ...[
            TextField(controller: searchCtrl, decoration: const InputDecoration(labelText: 'Search employee', border: OutlineInputBorder()),
              onChanged: (v) async {
                if (v.trim().length < 2) return;
                final r = await StaffAdminService.searchEmployees(AuthService.to.profile.value?['id'] as String? ?? '', v.trim());
                setSheet(() => results = r);
              }),
            if (results.isNotEmpty) SizedBox(height: 140, child: ListView(children: results.map((e) => ListTile(
              dense: true, title: Text(e['name'] as String? ?? ''),
              onTap: () => setSheet(() => selected = e),
            )).toList())),
          ] else Row(children: [
            Expanded(child: Text(selected!['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700))),
            TextButton(onPressed: () => setSheet(() => selected = null), child: const Text('Change')),
          ]),
          const SizedBox(height: 10),
          TextField(controller: amountCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Record Payment')),
        ])),
      )),
    );
    final amount = num.tryParse(amountCtrl.text);
    if (ok != true || selected == null || amount == null) return;
    try {
      final now = DateTime.now();
      await StaffAdminService.recordSalaryPayment(_employeeId,
        targetEmployeeId: selected!['id'] as String,
        month: DateFormat('yyyy-MM-01').format(now), amount: amount, paidOn: DateFormat('yyyy-MM-dd').format(now));
      if (mounted) showAdminSnack(context, 'Payment recorded');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to record payment.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Salary'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _record, child: const Icon(Icons.add)),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _payments.isEmpty ? const AdminEmptyState(icon: Icons.payments_rounded, title: 'No payments recorded', subtitle: 'Tap + to record one.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _payments.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final p = _payments[i];
              return AdminCard(child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p['employee_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text('${p['month']} • Paid ${p['paid_on']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ])),
                Text('₹${p['amount'] ?? 0}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.green)),
              ]));
            },
          )),
    );
  }
}
