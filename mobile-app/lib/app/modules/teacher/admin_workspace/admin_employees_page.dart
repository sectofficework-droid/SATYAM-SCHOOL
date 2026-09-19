import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import '../../../../common/widgets/s3_image.dart';
import 'admin_employee_detail_page.dart';

class AdminEmployeesPage extends StatefulWidget {
  const AdminEmployeesPage({super.key});
  @override
  State<AdminEmployeesPage> createState() => _AdminEmployeesPageState();
}

class _AdminEmployeesPageState extends State<AdminEmployeesPage> {
  List<Map<String, dynamic>> _employees = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.employees(_employeeId, search: search);
      if (mounted) setState(() { _employees = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load employees.'; _loading = false; });
    }
  }

  Future<void> _addEmployee() async {
    final codeCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final designationCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    String type = 'teaching';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add Employee', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: codeCtrl, decoration: const InputDecoration(labelText: 'Employee Code', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: type,
            decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
            items: const ['teaching', 'non-teaching', 'management', 'media'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            onChanged: (v) => setSheet(() => type = v ?? type),
          ),
          const SizedBox(height: 10),
          TextField(controller: designationCtrl, decoration: const InputDecoration(labelText: 'Designation', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Employee')),
        ])),
      )),
    );
    if (saved != true || codeCtrl.text.trim().isEmpty || nameCtrl.text.trim().isEmpty) return;
    try {
      await StaffAdminService.addEmployee(_employeeId,
        empCode: codeCtrl.text.trim(), name: nameCtrl.text.trim(), type: type,
        designation: designationCtrl.text.trim(), phone: phoneCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Employee added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add employee.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Employees'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _addEmployee, child: const Icon(Icons.person_add_alt_1_rounded)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(labelText: 'Search by name, code', border: OutlineInputBorder(), prefixIcon: Icon(Icons.search)),
            onSubmitted: (v) => _load(search: v),
          ),
        ),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: () => _load())
          : _employees.isEmpty ? const AdminEmptyState(icon: Icons.badge_rounded, title: 'No employees', subtitle: 'Try a different search.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: () => _load(search: _searchCtrl.text), child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _employees.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final e = _employees[i];
                return AdminCard(
                  onTap: () => Get.to(() => AdminEmployeeDetailPage(employeeId: e['id'] as String))?.then((_) => _load()),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(20), child: S3Image(
                      s3Key: e['photo_url'] as String?, width: 40, height: 40,
                      fallback: (_) => Container(width: 40, height: 40, decoration: const BoxDecoration(color: AppColors.tealLight, shape: BoxShape.circle),
                        child: const Icon(Icons.person, color: AppColors.teal)),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(e['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      Text('${e['emp_code'] ?? ''} • ${e['designation'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                    ])),
                    if (e['status'] != 'Active') AdminStatusPill(label: e['status'] as String? ?? '', color: AppColors.stone, light: AppColors.stoneLight),
                  ]),
                );
              },
            )),
        ),
      ]),
    );
  }
}
