import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

const _roleLabels = {'management': 'Management Head', 'senior_admin': 'Senior Admin', 'normal_admin': 'Admin'};

// senior_admin/management only, matches the admin panel's Users & Roles
// tab exactly (staff_admin_user_* RPCs mirror admin_create_user/
// admin_update_user/admin_delete_user's tier rules — management-only for
// senior_admin/management accounts, no self-role-change, no self-delete).
class AdminUsersRolesPage extends StatefulWidget {
  const AdminUsersRolesPage({super.key});
  @override
  State<AdminUsersRolesPage> createState() => _AdminUsersRolesPageState();
}

class _AdminUsersRolesPageState extends State<AdminUsersRolesPage> {
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  String get _myAdminId => (AuthService.to.profile.value?['admin_role'] as Map?)?['adminUserId'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.adminUsers(_employeeId);
      if (mounted) setState(() { _users = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load users. You may not have permission.'; _loading = false; });
    }
  }

  Future<void> _editOrCreate({Map<String, dynamic>? existing}) async {
    final nameCtrl = TextEditingController(text: existing?['name'] as String? ?? '');
    final initialsCtrl = TextEditingController(text: existing?['initials'] as String? ?? '');
    String role = existing?['role'] as String? ?? 'normal_admin';

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(existing == null ? 'Add Admin User' : 'Edit Admin User', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: initialsCtrl, maxLength: 3, decoration: const InputDecoration(labelText: 'Initials', border: OutlineInputBorder())),
          DropdownButtonFormField<String>(
            initialValue: role,
            decoration: const InputDecoration(labelText: 'Role', border: OutlineInputBorder()),
            items: _roleLabels.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
            onChanged: (v) => setSheet(() => role = v ?? role),
          ),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: Text(existing == null ? 'Add User' : 'Save')),
        ]),
      )),
    );
    if (ok != true || nameCtrl.text.trim().isEmpty) return;
    try {
      if (existing == null) {
        await StaffAdminService.createAdminUser(_employeeId, nameCtrl.text.trim(), initialsCtrl.text.trim().toUpperCase(), role);
      } else {
        await StaffAdminService.updateAdminUser(_employeeId, existing['id'] as String, nameCtrl.text.trim(), initialsCtrl.text.trim().toUpperCase(), role);
      }
      if (mounted) showAdminSnack(context, 'Saved');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, e.toString().contains('Only management') ? 'Only management can do that.' : 'Failed to save.', isError: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> u) async {
    final ok = await confirmAdminAction(context, title: 'Remove admin access', message: '${u['name']} will lose admin panel access.', confirmLabel: 'Remove');
    if (!ok) return;
    try {
      await StaffAdminService.deleteAdminUser(_employeeId, u['id'] as String);
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to remove.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Users & Roles'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: () => _editOrCreate(), child: const Icon(Icons.person_add_rounded)),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _users.isEmpty ? const AdminEmptyState(icon: Icons.admin_panel_settings_rounded, title: 'No admin users', subtitle: '')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _users.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final u = _users[i];
              final isSelf = u['id'] == _myAdminId;
              return AdminCard(onTap: () => _editOrCreate(existing: u), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(u['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    if (isSelf) const Padding(padding: EdgeInsets.only(left: 6), child: Text('(you)', style: TextStyle(fontSize: 11, color: AppColors.textHint))),
                  ]),
                  Text(_roleLabels[u['role']] ?? u['role'] as String? ?? '', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                ])),
                if (!isSelf) IconButton(icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red), onPressed: () => _delete(u)),
              ]));
            },
          )),
    );
  }
}
