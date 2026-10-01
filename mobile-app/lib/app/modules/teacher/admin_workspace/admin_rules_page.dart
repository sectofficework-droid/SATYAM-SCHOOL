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
        TextField(
          controller: _controllers[audience],
          maxLines: 16,
          decoration: InputDecoration(
            hintText: 'Type the ${label.toLowerCase()} rules and regulations here.',
            border: const OutlineInputBorder(), alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 14),
        Row(children: [
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20)),
            onPressed: _saving[audience]! ? null : () => _save(audience),
            icon: _saving[audience]!
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.save_rounded, size: 18),
            label: Text(_saving[audience]! ? 'Saving…' : 'Save'),
          ),
          if (_saved[audience]!) ...[
            const SizedBox(width: 12),
            const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 18),
            const SizedBox(width: 4),
            const Text('Saved', style: TextStyle(color: AppColors.green, fontWeight: FontWeight.w600)),
          ],
        ]),
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
