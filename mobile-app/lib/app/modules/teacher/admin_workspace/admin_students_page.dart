import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';
import '../../../../common/widgets/s3_image.dart';
import 'admin_student_detail_page.dart';
import 'admin_add_student_page.dart';

class AdminStudentsPage extends StatefulWidget {
  const AdminStudentsPage({super.key});
  @override
  State<AdminStudentsPage> createState() => _AdminStudentsPageState();
}

class _AdminStudentsPageState extends State<AdminStudentsPage> {
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _classes = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String? _classId;
  String? _statusFilter;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  List<Map<String, dynamic>> get _filtered {
    if (_statusFilter == null) return _students;
    return _students.where((s) => (s['status'] as String? ?? 'Active') == _statusFilter).toList();
  }

  @override
  void initState() {
    super.initState();
    _load();
    StaffAdminService.classListWithIds(_employeeId).then((c) { if (mounted) setState(() => _classes = c); }).catchError((_) {});
  }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.students(_employeeId, search: search, classId: _classId);
      if (mounted) setState(() { _students = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load students.'; _loading = false; });
    }
  }

  // 2026-10-04: expanded from a 9-field bottom sheet to a dedicated
  // full-screen form (admin_add_student_page.dart) covering the full
  // admin-panel-web field set - too many fields for a sheet to hold
  // reasonably. Reloads the list on a successful add (page pops `true`).
  Future<void> _addStudent() async {
    final added = await Get.to(() => const AdminAddStudentPage());
    if (added == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Students'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _addStudent, child: const Icon(Icons.person_add_rounded)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(children: [
            Expanded(child: TextField(
              controller: _searchCtrl,
              decoration: const InputDecoration(labelText: 'Search by name, GR no.', border: OutlineInputBorder(), prefixIcon: Icon(Icons.search)),
              onSubmitted: (v) => _load(search: v),
            )),
            const SizedBox(width: 10),
            SizedBox(width: 140, child: DropdownButtonFormField<String?>(
              initialValue: _classId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12)),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('All')),
                ..._classes.map((c) => DropdownMenuItem<String?>(value: c['id'] as String, child: Text(c['name'] as String, overflow: TextOverflow.ellipsis))),
              ],
              onChanged: (v) { setState(() => _classId = v); _load(search: _searchCtrl.text); },
            )),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AdminFilterBar(options: const ['Active', 'Inactive'], selected: _statusFilter, onChanged: (v) => setState(() => _statusFilter = v)),
        ),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: () => _load())
          : _filtered.isEmpty ? const AdminEmptyState(icon: Icons.groups_rounded, title: 'No students', subtitle: 'Try a different search or filter.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: () => _load(search: _searchCtrl.text), child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final s = _filtered[i];
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
