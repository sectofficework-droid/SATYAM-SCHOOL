import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminExpensesPage extends StatefulWidget {
  const AdminExpensesPage({super.key});
  @override
  State<AdminExpensesPage> createState() => _AdminExpensesPageState();
}

class _AdminExpensesPageState extends State<AdminExpensesPage> {
  List<Map<String, dynamic>> _expenses = [];
  bool _loading = true;
  String? _error;
  String? _categoryFilter;
  DateTimeRange? _dateRange;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  List<Map<String, dynamic>> get _filtered => _expenses.where((e) {
    if (_categoryFilter != null && (e['category'] as String? ?? '') != _categoryFilter) return false;
    if (_dateRange != null) {
      final d = DateTime.tryParse(e['expense_date'] as String? ?? '');
      if (d == null) return false;
      final day = DateTime(d.year, d.month, d.day);
      if (day.isBefore(_dateRange!.start) || day.isAfter(_dateRange!.end)) return false;
    }
    return true;
  }).toList();

  Future<void> _pickDateRange() async {
    final picked = await showDateRangePicker(context: context, firstDate: DateTime(2020, 1, 1), lastDate: DateTime.now(), initialDateRange: _dateRange);
    if (picked != null) setState(() => _dateRange = picked);
  }

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.expenses(_employeeId);
      if (mounted) setState(() { _expenses = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load expenses.'; _loading = false; });
    }
  }

  Future<void> _add() async {
    final titleCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final byCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('New Expense', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: categoryCtrl, decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: amountCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: byCtrl, decoration: const InputDecoration(labelText: 'Paid by', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Expense')),
        ])),
      ),
    );
    final amount = num.tryParse(amountCtrl.text);
    if (ok != true || titleCtrl.text.trim().isEmpty || amount == null) return;
    try {
      await StaffAdminService.addExpense(_employeeId,
        title: titleCtrl.text.trim(), category: categoryCtrl.text.trim(), amount: amount,
        date: DateFormat('yyyy-MM-dd').format(DateTime.now()), paidBy: byCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Expense added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add expense.', isError: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> exp) async {
    final ok = await confirmAdminAction(context, title: 'Delete expense', message: exp['title'] as String? ?? '', confirmLabel: 'Delete');
    if (!ok) return;
    try {
      await StaffAdminService.deleteExpense(_employeeId, exp['id'] as String);
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to delete.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = _expenses.map((e) => e['category'] as String? ?? '').where((c) => c.isNotEmpty).toSet().toList()..sort();
    return Scaffold(
      appBar: const AdminAppBar(title: 'Expenses'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _add, child: const Icon(Icons.add)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(children: [
            Expanded(child: AdminFilterBar(options: categories, selected: _categoryFilter, onChanged: (v) => setState(() => _categoryFilter = v))),
            IconButton(
              icon: Icon(Icons.date_range_rounded, color: _dateRange != null ? AppColors.navy : AppColors.textLight),
              tooltip: 'Filter by date range',
              onPressed: _pickDateRange,
            ),
            if (_dateRange != null) IconButton(icon: const Icon(Icons.close_rounded, size: 18), onPressed: () => setState(() => _dateRange = null)),
          ]),
        ),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
          : _filtered.isEmpty ? const AdminEmptyState(icon: Icons.receipt_rounded, title: 'No expenses', subtitle: 'Tap + to add one, or clear your filters.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final e = _filtered[i];
              return AdminCard(onTap: () => _delete(e), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text('${e['category'] ?? ''} • ${e['expense_date'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ])),
                Text('₹${e['amount'] ?? 0}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.red)),
              ]));
            },
          )),
        ),
      ]),
    );
  }
}
