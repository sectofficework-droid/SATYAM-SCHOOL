import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminInventoryPage extends StatefulWidget {
  const AdminInventoryPage({super.key});
  @override
  State<AdminInventoryPage> createState() => _AdminInventoryPageState();
}

class _AdminInventoryPageState extends State<AdminInventoryPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Inventory'),
      body: Column(children: [
        Material(color: AppColors.card, child: TabBar(
          controller: _tabs, labelColor: AppColors.navy, unselectedLabelColor: AppColors.textLight, indicatorColor: AppColors.navy,
          isScrollable: true,
          tabs: const [Tab(text: 'Record Usage'), Tab(text: 'Assets'), Tab(text: 'Items & Stock')],
        )),
        Expanded(child: TabBarView(controller: _tabs, children: [
          _UsageTab(employeeId: _employeeId),
          _AssetsTab(employeeId: _employeeId),
          _ItemsTab(employeeId: _employeeId),
        ])),
      ]),
    );
  }
}

class _ItemsTab extends StatefulWidget {
  final String employeeId;
  const _ItemsTab({required this.employeeId});
  @override
  State<_ItemsTab> createState() => _ItemsTabState();
}

class _ItemsTabState extends State<_ItemsTab> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.inventoryItems(widget.employeeId);
      if (mounted) setState(() { _items = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load items.'; _loading = false; });
    }
  }

  Future<void> _addItem() async {
    final nameCtrl = TextEditingController();
    final categoryCtrl = TextEditingController();
    final unitCtrl = TextEditingController(text: 'Pcs');
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('New Item', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Item Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: categoryCtrl, decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Item')),
        ])),
      ),
    );
    if (ok != true || nameCtrl.text.trim().isEmpty) return;
    try {
      await StaffAdminService.addInventoryItem(widget.employeeId, name: nameCtrl.text.trim(), category: categoryCtrl.text.trim(), unit: unitCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Item added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add item.', isError: true);
    }
  }

  Future<void> _addBatch(Map<String, dynamic> item) async {
    final qtyCtrl = TextEditingController();
    final byCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Add Stock — ${item['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity Received', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: byCtrl, decoration: const InputDecoration(labelText: 'Received by', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Stock')),
        ]),
      ),
    );
    final qty = int.tryParse(qtyCtrl.text);
    if (ok != true || qty == null) return;
    try {
      await StaffAdminService.addInventoryBatch(widget.employeeId,
        itemId: item['id'] as String, qty: qty, receivedDate: DateFormat('yyyy-MM-dd').format(DateTime.now()), receivedBy: byCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Stock added');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add stock.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _load);
    return Stack(children: [
      _items.isEmpty
        ? const AdminEmptyState(icon: Icons.inventory_2_rounded, title: 'No items', subtitle: 'Tap + to add one.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            itemCount: _items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final it = _items[i];
              return AdminCard(onTap: () => _addBatch(it), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(it['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text('${it['category'] ?? ''} • ${it['unit'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ])),
                const Icon(Icons.add_box_rounded, color: AppColors.teal),
              ]));
            },
          )),
      Positioned(bottom: 16, right: 16, child: FloatingActionButton(
        backgroundColor: AppColors.navy, onPressed: _addItem, child: const Icon(Icons.add))),
    ]);
  }
}

class _UsageTab extends StatefulWidget {
  final String employeeId;
  const _UsageTab({required this.employeeId});
  @override
  State<_UsageTab> createState() => _UsageTabState();
}

class _UsageTabState extends State<_UsageTab> {
  List<Map<String, dynamic>> _items = [];
  Map<String, dynamic>? _selectedItem;
  final _qtyCtrl = TextEditingController(text: '1');
  final _purposeCtrl = TextEditingController();
  final _byCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.inventoryItems(widget.employeeId);
      if (mounted) setState(() { _items = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load items.'; _loading = false; });
    }
  }

  Future<void> _save() async {
    if (_selectedItem == null) { showAdminSnack(context, 'Pick an item first.', isError: true); return; }
    final qty = int.tryParse(_qtyCtrl.text) ?? 0;
    if (qty <= 0) { showAdminSnack(context, 'Enter a valid quantity.', isError: true); return; }
    setState(() => _saving = true);
    try {
      await StaffAdminService.recordInventoryUsage(widget.employeeId,
        itemId: _selectedItem!['id'] as String, qty: qty,
        usageDate: DateFormat('yyyy-MM-dd').format(DateTime.now()),
        purpose: _purposeCtrl.text.trim().isEmpty ? null : _purposeCtrl.text.trim(),
        usedBy: _byCtrl.text.trim().isEmpty ? null : _byCtrl.text.trim());
      if (mounted) {
        showAdminSnack(context, 'Usage recorded');
        setState(() { _selectedItem = null; _qtyCtrl.text = '1'; _purposeCtrl.clear(); _byCtrl.clear(); });
      }
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to record usage.', isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _load);
    return ListView(padding: const EdgeInsets.all(16), children: [
      DropdownButtonFormField<Map<String, dynamic>>(
        initialValue: _selectedItem,
        decoration: const InputDecoration(labelText: 'Item', border: OutlineInputBorder()),
        items: _items.map((it) => DropdownMenuItem(value: it, child: Text('${it['name']} (${it['unit']})'))).toList(),
        onChanged: (v) => setState(() => _selectedItem = v),
      ),
      const SizedBox(height: 12),
      TextField(controller: _qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      TextField(controller: _purposeCtrl, decoration: const InputDecoration(labelText: 'Purpose', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      TextField(controller: _byCtrl, decoration: const InputDecoration(labelText: 'Used by', border: OutlineInputBorder())),
      const SizedBox(height: 20),
      ElevatedButton(
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
        onPressed: _saving ? null : _save,
        child: _saving ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Record Usage'),
      ),
    ]);
  }
}

class _AssetsTab extends StatefulWidget {
  final String employeeId;
  const _AssetsTab({required this.employeeId});
  @override
  State<_AssetsTab> createState() => _AssetsTabState();
}

class _AssetsTabState extends State<_AssetsTab> {
  List<Map<String, dynamic>> _assets = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.assets(widget.employeeId);
      if (mounted) setState(() { _assets = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load assets.'; _loading = false; });
    }
  }

  Future<void> _checkout(Map<String, dynamic> asset) async {
    final takenByCtrl = TextEditingController();
    final purposeCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Checkout ${asset['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: takenByCtrl, decoration: const InputDecoration(labelText: 'Taken by', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: purposeCtrl, decoration: const InputDecoration(labelText: 'Purpose', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () => Navigator.pop(ctx, true), child: const Text('Checkout')),
        ]),
      ),
    );
    if (ok != true || takenByCtrl.text.trim().isEmpty) return;
    try {
      await StaffAdminService.checkoutAsset(widget.employeeId,
        assetId: asset['id'] as String, takenBy: takenByCtrl.text.trim(),
        purpose: purposeCtrl.text.trim(), takenDate: DateFormat('yyyy-MM-dd').format(DateTime.now()));
      if (mounted) showAdminSnack(context, 'Asset checked out');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Checkout failed.', isError: true);
    }
  }

  Future<void> _return(Map<String, dynamic> asset) async {
    final checkout = asset['currentCheckout'] as Map?;
    if (checkout == null) return;
    final ok = await confirmAdminAction(context, title: 'Return asset', message: 'Mark ${asset['name']} as returned?', confirmLabel: 'Return');
    if (!ok) return;
    try {
      await StaffAdminService.returnAsset(widget.employeeId, checkout['id'] as String, DateFormat('yyyy-MM-dd').format(DateTime.now()));
      if (mounted) showAdminSnack(context, 'Asset returned');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Return failed.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AdminLoading();
    if (_error != null) return AdminErrorState(message: _error!, onRetry: _load);
    if (_assets.isEmpty) return const AdminEmptyState(icon: Icons.devices_other_rounded, title: 'No assets', subtitle: 'Assets will appear here.');

    return RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _assets.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final a = _assets[i];
        final checkout = a['currentCheckout'] as Map?;
        return AdminCard(child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(a['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            if (checkout != null)
              Text('With ${checkout['takenBy']} since ${checkout['takenDate']}', style: const TextStyle(fontSize: 12, color: AppColors.textLight))
            else
              const Text('Available', style: TextStyle(fontSize: 12, color: AppColors.green)),
          ])),
          if (checkout != null)
            OutlinedButton(onPressed: () => _return(a), child: const Text('Return'))
          else
            ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => _checkout(a), child: const Text('Checkout')),
        ]));
      },
    ));
  }
}
