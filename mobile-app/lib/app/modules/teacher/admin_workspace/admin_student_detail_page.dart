import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import '../../../../common/widgets/s3_image.dart';

// Full student detail/edit/actions — Staff App phase-2 (2026-09-19: user
// asked for full admin-web parity). TC issuance here is gated server-side
// (staff_admin_tier) unlike the admin panel's own saveTransferCertificate
// (TODO.md REQ-SEC-008, still open there) — this mobile path was built
// correctly from the start, not a copy of the ungated web version.
class AdminStudentDetailPage extends StatefulWidget {
  final String studentId;
  const AdminStudentDetailPage({super.key, required this.studentId});
  @override
  State<AdminStudentDetailPage> createState() => _AdminStudentDetailPageState();
}

class _AdminStudentDetailPageState extends State<AdminStudentDetailPage> {
  Map<String, dynamic>? _student;
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  String get _tier => (AuthService.to.profile.value?['admin_role'] as Map?)?['tier'] as String? ?? '';
  bool get _isSeniorOrMgmt => _tier == 'senior_admin' || _tier == 'management';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final d = await StaffAdminService.studentDetails(_employeeId, widget.studentId);
      if (mounted) setState(() { _student = d; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load student.'; _loading = false; });
    }
  }

  Future<void> _edit() async {
    final s = _student!;
    final firstCtrl = TextEditingController(text: s['first_name'] as String? ?? '');
    final lastCtrl = TextEditingController(text: s['last_name'] as String? ?? '');
    final fatherCtrl = TextEditingController(text: s['father_name'] as String? ?? '');
    final motherCtrl = TextEditingController(text: s['mother_name'] as String? ?? '');
    final mobileCtrl = TextEditingController(text: s['mobile1'] as String? ?? '');
    final addressCtrl = TextEditingController(text: s['address'] as String? ?? '');

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Edit Student', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: firstCtrl, decoration: const InputDecoration(labelText: 'First Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: lastCtrl, decoration: const InputDecoration(labelText: 'Last Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: fatherCtrl, decoration: const InputDecoration(labelText: "Father's Name", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: motherCtrl, decoration: const InputDecoration(labelText: "Mother's Name", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: mobileCtrl, decoration: const InputDecoration(labelText: 'Mobile', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: addressCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ])),
      ),
    );
    if (saved != true) return;
    try {
      await StaffAdminService.updateStudentBasic(_employeeId, widget.studentId,
        firstName: firstCtrl.text.trim(), lastName: lastCtrl.text.trim(),
        fatherName: fatherCtrl.text.trim(), motherName: motherCtrl.text.trim(),
        dob: s['dob'] as String, mobile1: mobileCtrl.text.trim(), address: addressCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Student updated');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to update.', isError: true);
    }
  }

  Future<void> _issueTc() async {
    final tcNoCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Issue Transfer Certificate', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 4),
          const Text('This marks the student as Left. This cannot be easily undone.', style: TextStyle(fontSize: 12, color: AppColors.red)),
          const SizedBox(height: 12),
          TextField(controller: tcNoCtrl, decoration: const InputDecoration(labelText: 'TC Number', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Reason for leaving', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.red), onPressed: () => Navigator.pop(ctx, true), child: const Text('Issue TC')),
        ]),
      )),
    );
    if (ok != true || tcNoCtrl.text.trim().isEmpty) return;
    try {
      final today = DateTime.now();
      final dateStr = '${today.year}-${today.month.toString().padLeft(2,'0')}-${today.day.toString().padLeft(2,'0')}';
      await StaffAdminService.issueTc(_employeeId, studentId: widget.studentId,
        enrollmentId: (_student!['enrollment'] as Map?)?['id'] as String?,
        tcNumber: tcNoCtrl.text.trim(), issueDate: dateStr, leavingDate: dateStr, reason: reasonCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'TC issued');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to issue TC.', isError: true);
    }
  }

  Future<void> _impersonate() async {
    try {
      final result = await StaffAdminService.createImpersonationCode(_employeeId, 'student', widget.studentId);
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

  Future<void> _deletePermanently() async {
    final ok = await confirmAdminAction(context,
      title: 'Permanently delete student',
      message: 'This deletes ${_student!['first_name']} and all their records (TC, fee payments, promotions). This cannot be undone.',
      confirmLabel: 'Delete Permanently');
    if (!ok) return;
    try {
      await StaffAdminService.deleteStudentPermanently(_employeeId, widget.studentId);
      if (mounted) { showAdminSnack(context, 'Student deleted'); Navigator.pop(context); }
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to delete.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AdminAppBar(title: _loading ? 'Student' : '${_student?['first_name'] ?? ''} ${_student?['last_name'] ?? ''}'),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _buildBody(),
    );
  }

  Widget _buildBody() {
    final s = _student!;
    final enr = s['enrollment'] as Map?;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Center(child: ClipRRect(borderRadius: BorderRadius.circular(48), child: S3Image(
        s3Key: s['photo_url'] as String?, width: 96, height: 96,
        fallback: (_) => Container(width: 96, height: 96, decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
          child: const Icon(Icons.person, size: 44, color: AppColors.blue))))),
      const SizedBox(height: 16),
      AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Profile', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        const SizedBox(height: 8),
        _row('GR No.', s['grno']), _row('DOB', s['dob']), _row('Gender', s['gender']),
        _row("Father's Name", s['father_name']), _row("Mother's Name", s['mother_name']),
        _row('Mobile', s['mobile1']), _row('Address', s['address']), _row('Status', s['status']),
      ])),
      if (enr != null) ...[
        const SizedBox(height: 10),
        AdminCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Enrollment', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 8),
          _row('Enrollment No.', enr['enrollment_no']),
          _row('Class', '${enr['class_name'] ?? ''} - ${enr['section_name'] ?? ''}'),
          _row('Roll No.', enr['roll_no']),
          _row('Fee Total', '₹${enr['fee_total'] ?? 0}'),
          _row('Fee Paid', '₹${s['fee_paid_total'] ?? 0}'),
        ])),
      ],
      const SizedBox(height: 20),
      ElevatedButton.icon(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
        onPressed: _edit, icon: const Icon(Icons.edit_rounded, size: 18), label: const Text('Edit Profile')),
      const SizedBox(height: 10),
      OutlinedButton.icon(onPressed: _impersonate, icon: const Icon(Icons.login_rounded, size: 18), label: const Text('Generate Admin Access Code')),
      const SizedBox(height: 10),
      if (s['status'] == 'Active')
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.amber, side: const BorderSide(color: AppColors.amber)),
          onPressed: _issueTc, icon: const Icon(Icons.assignment_return_rounded, size: 18), label: const Text('Issue Transfer Certificate')),
      if (_isSeniorOrMgmt) ...[
        const SizedBox(height: 10),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.red, side: const BorderSide(color: AppColors.red)),
          onPressed: _deletePermanently, icon: const Icon(Icons.delete_forever_rounded, size: 18), label: const Text('Delete Permanently')),
      ],
    ]);
  }

  Widget _row(String label, dynamic value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 120, child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textLight))),
      Expanded(child: Text('${value ?? '—'}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
    ]),
  );
}
