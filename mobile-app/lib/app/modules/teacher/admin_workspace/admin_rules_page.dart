import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Settings -> Rules & Regulations tab
// (admin-panel/src/app/(dashboard)/settings/RulesRegulationsTab.js). Senior
// Admin/Management only. Each editor is exactly what teachers/students see
// read-only in their own apps under Rules & Regulations.
class AdminRulesPage extends StatefulWidget {
  const AdminRulesPage({super.key});
  @override
  State<AdminRulesPage> createState() => _AdminRulesPageState();
}

class _AdminRulesPageState extends State<AdminRulesPage> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  bool _loading = true;
  String? _error;
  final Map<String, TextEditingController> _controllers = {'teacher': TextEditingController(), 'student': TextEditingController()};
  final Map<String, bool> _saving = {'teacher': false, 'student': false};
  final Map<String, bool> _saved = {'teacher': false, 'student': false};

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() {
    _tabs.dispose();
    for (final c in _controllers.values) { c.dispose(); }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rules = await StaffAdminService.getSchoolRules();
      if (mounted) {
        setState(() {
          _controllers['teacher']!.text = rules['teacher'] ?? '';
          _controllers['student']!.text = rules['student'] ?? '';
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load rules.'; _loading = false; });
    }
  }

  Future<void> _save(String audience) async {
    setState(() => _saving[audience] = true);
    try {
      await StaffAdminService.saveSchoolRules(_employeeId, audience, _controllers[audience]!.text);
      if (mounted) {
        setState(() { _saving[audience] = false; _saved[audience] = true; });
        Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _saved[audience] = false); });
      }
    } catch (e) {
      if (mounted) { setState(() => _saving[audience] = false); showAdminSnack(context, 'Failed to save.', isError: true); }
    }
  }

  Widget _editor(String audience, String label) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Shown read-only to ${label.toLowerCase()}s in the mobile app, under Rules & Regulations.',
          style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
        const SizedBox(height: 12),
        // Fixed-height + internally-scrolling, not maxLines: N - a tall
        // maxLines value here was measuring out far taller than it painted
        // on at least one real device, pushing the Save button below any
        // reachable scroll extent and silently eating every save. A bounded
        // SizedBox is unambiguous regardless of platform text metrics.
        SizedBox(
          height: 320,
          child: TextField(
            controller: _controllers[audience],
            maxLines: null,
            expands: true,
            textAlignVertical: TextAlignVertical.top,
            decoration: InputDecoration(
              hintText: 'Type the ${label.toLowerCase()} rules and regulations here.',
              border: const OutlineInputBorder(), alignLabelWithHint: true,
            ),
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: _saving[audience]! ? null : () => _save(audience),
            child: Text(_saving[audience]! ? 'Saving…' : (_saved[audience]! ? 'Saved ✓' : 'Save')),
          ),
        ),
        const SizedBox(height: 20),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Rules & Regulations'),
      body: _loading
        ? const AdminLoading()
        : _error != null
          ? AdminErrorState(message: _error!, onRetry: _load)
          : Column(children: [
              Material(color: AppColors.card, child: TabBar(
                controller: _tabs, labelColor: AppColors.navy, unselectedLabelColor: AppColors.textLight, indicatorColor: AppColors.navy,
                tabs: const [Tab(text: 'Student'), Tab(text: 'Teacher')],
              )),
              Expanded(child: TabBarView(controller: _tabs, children: [
                SingleChildScrollView(child: _editor('student', 'Student')),
                SingleChildScrollView(child: _editor('teacher', 'Teacher')),
              ])),
            ]),
    );
  }
}
