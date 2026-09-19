import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// GR Book register — read-only view on mobile. Bulk Excel import (the
// admin panel's primary way rows get created) intentionally stays
// admin-panel-only: importing hundreds of rows from a spreadsheet isn't a
// phone-shaped workflow, disclosed in the plan file rather than attempting
// a poor mobile approximation of it.
class AdminGrBookPage extends StatefulWidget {
  const AdminGrBookPage({super.key});
  @override
  State<AdminGrBookPage> createState() => _AdminGrBookPageState();
}

class _AdminGrBookPageState extends State<AdminGrBookPage> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.grBook(_employeeId, search: search);
      if (mounted) setState(() { _rows = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load GR Book.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'GR Book'),
      body: Column(children: [
        Padding(padding: const EdgeInsets.all(16), child: TextField(
          controller: _searchCtrl,
          decoration: const InputDecoration(labelText: 'Search by name, GR no.', border: OutlineInputBorder(), prefixIcon: Icon(Icons.search)),
          onSubmitted: (v) => _load(search: v),
        )),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: () => _load())
          : _rows.isEmpty ? const AdminEmptyState(icon: Icons.book_rounded, title: 'No entries', subtitle: 'GR Book entries are imported via the admin panel.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: () => _load(search: _searchCtrl.text), child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final r = _rows[i];
                return AdminCard(child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r['student_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    Text('GR ${r['gr_no']} • ${r['admission_class'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                  ])),
                  if (r['date_of_leaving'] != null) const AdminStatusPill(label: 'Left', color: AppColors.stone, light: AppColors.stoneLight),
                ]));
              },
            )),
        ),
      ]),
    );
  }
}
