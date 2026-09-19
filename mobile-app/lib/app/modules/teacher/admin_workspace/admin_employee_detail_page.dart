import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import '../../../../common/widgets/s3_image.dart';

class AdminEmployeeDetailPage extends StatefulWidget {
  final String employeeId;
  const AdminEmployeeDetailPage({super.key, required this.employeeId});
  @override
  State<AdminEmployeeDetailPage> createState() => _AdminEmployeeDetailPageState();
}

class _AdminEmployeeDetailPageState extends State<AdminEmployeeDetailPage> {
  Map<String, dynamic>? _emp;
  bool _loading = true;
  String? _error;
  String get _callerId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final d = await StaffAdminService.employeeDetails(_callerId, widget.employeeId);
      if (mounted) setState(() { _emp = d; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load employee.'; _loading = false; });
    }
  }

  Future<void> _edit() async {
    final e = _emp!;
    final nameCtrl = TextEditingController(text: e['name'] as String? ?? '');
    final designationCtrl = TextEditingController(text: e['designation'] as String? ?? '');
    final phoneCtrl = TextEditingController(text: e['phone'] as String? ?? '');
    final emailCtrl = TextEditingController(text: e['email'] as String? ?? '');
    final addressCtrl = TextEditingController(text: e['address'] as String? ?? '');

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Edit Employee', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: designationCtrl, decoration: const InputDecoration(labelText: 'Designation', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: addressCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ])),
      ),
    );
    if (saved != true) return;
    try {
      await StaffAdminService.updateEmployee(_callerId, widget.employeeId,
        name: nameCtrl.text.trim(), designation: designationCtrl.text.trim(),
        phone: phoneCtrl.text.trim(), email: emailCtrl.text.trim(), address: addressCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Employee updated');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to update.', isError: true);
    }
  }

  Future<void> _resetPassword() async {
    final pwCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Reset App Password', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: pwCtrl, decoration: const InputDecoration(labelText: 'New password (min 6 chars)', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Reset Password')),
        ]),
      ),
    );
    if (ok != true || pwCtrl.text.trim().length < 6) {
      if (ok == true) showAdminSnack(context, 'Password must be at least 6 characters.', isError: true);
      return;
    }
    try {
      await StaffAdminService.resetEmployeePassword(_callerId, widget.employeeId, pwCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Password reset');
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to reset password.', isError: true);
    }
  }

  Future<void> _impersonate() async {
    try {
      final result = await StaffAdminService.createImpersonationCode(_callerId, 'employee', widget.employeeId);
      if (!mounted) return;
      await showDialog(context: context, builder: (ctx) => AlertDialog(
        title: const Text('Admin Access Code'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(result['code'] as String? ?? '', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 4)),
          const SizedBox(height: 8),
          const Text('Valid for 10 minutes', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
        ]),
        actions: [
          TextButton(onPressed: () { Clipboard.setData(ClipboardData(text: result['code'] as String? ?? '')); Navigator.pop(ctx); }, child: const Text('Copy & Close')),
        ],
      ));
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to generate code.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AdminAppBar(title: _loading ? 'Employee' : _emp?['name'] as String? ?? 'Employee'),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _buildBody(),
    );
  }

  Widget _buildBody() {
    final e = _emp!;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Center(child: ClipRRect(borderRadius: BorderRadius.circular(48), child: S3Image(
        s3Key: e['photo_url'] as String?, width: 96, height: 96,
        fallback: (_) => Container(width: 96, height: 96, decoration: const BoxDecoration(color: AppColors.tealLight, shape: BoxShape.circle),
          child: const Icon(Icons.person, size: 44, color: AppColors.teal))))),
      const SizedBox(height: 16),
      AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 8),
        _row('Employee Code', e['emp_code']), _row('Type', e['type']), _row('Designation', e['designation']),
        _row('Department', e['department']), _row('Phone', e['phone']), _row('Email', e['email']),
        _row('Joining Date', e['joining_date']), _row('Employment Type', e['employment_type']), _row('Status', e['status']),
      ])),
      const SizedBox(height: 20),
      ElevatedButton.icon(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
        onPressed: _edit, icon: const Icon(Icons.edit_rounded, size: 18), label: const Text('Edit Profile')),
      const SizedBox(height: 10),
      OutlinedButton.icon(onPressed: _resetPassword, icon: const Icon(Icons.lock_reset_rounded, size: 18), label: const Text('Reset App Password')),
      const SizedBox(height: 10),
      OutlinedButton.icon(onPressed: _impersonate, icon: const Icon(Icons.login_rounded, size: 18), label: const Text('Generate Admin Access Code')),
    ]);
  }

  Widget _row(String label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 130, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textLight))),
      Expanded(child: Text('${value ?? '—'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
    ]),
  );
}
