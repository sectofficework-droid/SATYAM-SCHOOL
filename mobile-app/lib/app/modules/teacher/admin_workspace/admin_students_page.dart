import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import '../../../../common/widgets/s3_image.dart';
import 'admin_student_detail_page.dart';

class AdminStudentsPage extends StatefulWidget {
  const AdminStudentsPage({super.key});
  @override
  State<AdminStudentsPage> createState() => _AdminStudentsPageState();
}

class _AdminStudentsPageState extends State<AdminStudentsPage> {
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.students(_employeeId, search: search);
      if (mounted) setState(() { _students = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load students.'; _loading = false; });
    }
  }

  Future<void> _addStudent() async {
    final firstCtrl = TextEditingController();
    final lastCtrl = TextEditingController();
    final fatherCtrl = TextEditingController();
    final motherCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    DateTime? dob;
    String gender = 'Male';
    List<Map<String, dynamic>> classes = [];
    List<Map<String, dynamic>> sections = [];
    String? classId;
    String? sectionId;

    try { classes = await StaffAdminService.classListWithIds(_employeeId); } catch (_) {}

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Add Student', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: firstCtrl, decoration: const InputDecoration(labelText: 'First Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: lastCtrl, decoration: const InputDecoration(labelText: 'Last Name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: OutlinedButton(
              onPressed: () async {
                final d = await showDatePicker(context: ctx, initialDate: DateTime(2015,1,1), firstDate: DateTime(1990), lastDate: DateTime.now());
                if (d != null) setSheet(() => dob = d);
              },
              child: Text(dob == null ? 'Date of Birth' : '${dob!.year}-${dob!.month.toString().padLeft(2,'0')}-${dob!.day.toString().padLeft(2,'0')}'),
            )),
            const SizedBox(width: 10),
            Expanded(child: DropdownButtonFormField<String>(
              initialValue: gender,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: const ['Male', 'Female', 'Other'].map((g) => DropdownMenuItem(value: g, child: Text(g))).toList(),
              onChanged: (v) => setSheet(() => gender = v ?? gender),
            )),
          ]),
          const SizedBox(height: 10),
          TextField(controller: fatherCtrl, decoration: const InputDecoration(labelText: "Father's Name", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: motherCtrl, decoration: const InputDecoration(labelText: "Mother's Name", border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: mobileCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: classId,
            decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder()),
            items: classes.map((c) => DropdownMenuItem(value: c['id'] as String, child: Text(c['name'] as String))).toList(),
            onChanged: (v) async {
              setSheet(() { classId = v; sectionId = null; sections = []; });
              if (v != null) {
                final s = await StaffAdminService.sectionList(_employeeId, v);
                setSheet(() => sections = s);
              }
            },
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: sectionId,
            decoration: const InputDecoration(labelText: 'Section', border: OutlineInputBorder()),
            items: sections.map((s) => DropdownMenuItem(value: s['id'] as String, child: Text(s['name'] as String))).toList(),
            onChanged: (v) => setSheet(() => sectionId = v),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Student')),
        ])),
      )),
    );

    if (saved != true) return;
    if (firstCtrl.text.trim().isEmpty || dob == null || classId == null || sectionId == null) {
      showAdminSnack(context, 'Fill in name, DOB, class and section.', isError: true);
      return;
    }
    try {
      final dobStr = '${dob!.year}-${dob!.month.toString().padLeft(2,'0')}-${dob!.day.toString().padLeft(2,'0')}';
      await StaffAdminService.addStudent(_employeeId,
        firstName: firstCtrl.text.trim(), lastName: lastCtrl.text.trim(), dob: dobStr, gender: gender,
        fatherName: fatherCtrl.text.trim(), motherName: motherCtrl.text.trim(), mobile1: mobileCtrl.text.trim(),
        classId: classId!, sectionId: sectionId!);
      if (mounted) showAdminSnack(context, 'Student added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add student.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Students'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _addStudent, child: const Icon(Icons.person_add_rounded)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(labelText: 'Search by name, GR no.', border: OutlineInputBorder(), prefixIcon: Icon(Icons.search)),
            onSubmitted: (v) => _load(search: v),
          ),
        ),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: () => _load())
          : _students.isEmpty ? const AdminEmptyState(icon: Icons.groups_rounded, title: 'No students', subtitle: 'Try a different search.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: () => _load(search: _searchCtrl.text), child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _students.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final s = _students[i];
                final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                return AdminCard(
                  onTap: () => Get.to(() => AdminStudentDetailPage(studentId: s['student_id'] as String))?.then((_) => _load()),
                  child: Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(20), child: S3Image(
                      s3Key: s['photo_url'] as String?, width: 40, height: 40,
                      fallback: (_) => Container(width: 40, height: 40, decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
                        child: const Icon(Icons.person, color: AppColors.blue)),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      Text('${s['class_name'] ?? ''} - ${s['section_name'] ?? ''} • Roll ${s['roll_no'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                    ])),
                    if (s['status'] != 'Active') AdminStatusPill(label: s['status'] as String? ?? '', color: AppColors.stone, light: AppColors.stoneLight),
                  ]),
                );
              },
            )),
        ),
      ]),
    );
  }
}
