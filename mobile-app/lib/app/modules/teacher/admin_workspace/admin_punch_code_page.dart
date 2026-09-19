import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminPunchCodePage extends StatefulWidget {
  const AdminPunchCodePage({super.key});
  @override
  State<AdminPunchCodePage> createState() => _AdminPunchCodePageState();
}

class _AdminPunchCodePageState extends State<AdminPunchCodePage> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  Map<String, dynamic>? _selected;
  Map<String, dynamic>? _code;
  Timer? _timer;
  int _remaining = 0;
  bool _searching = false;
  bool _generating = false;

  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void dispose() { _timer?.cancel(); _searchCtrl.dispose(); super.dispose(); }

  Future<void> _search(String q) async {
    setState(() => _searching = true);
    try {
      final list = await StaffAdminService.searchEmployees(_employeeId, q);
      if (mounted) setState(() { _results = list; _searching = false; });
    } catch (e) {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _generate() async {
    if (_selected == null) return;
    setState(() => _generating = true);
    try {
      final result = await StaffAdminService.generatePunchCode(_employeeId, _selected!['id'] as String);
      _timer?.cancel();
      if (mounted) {
        setState(() {
          _code = result;
          _remaining = 15 * 60;
          _generating = false;
        });
      }
      _timer = Timer.periodic(const Duration(seconds: 1), (t) {
        if (_remaining <= 0) { t.cancel(); return; }
        setState(() => _remaining--);
      });
    } catch (e) {
      if (mounted) setState(() => _generating = false);
      if (mounted) showAdminSnack(context, 'Could not generate a code.', isError: true);
    }
  }

  String _fmt(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Punch Override Code'),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              labelText: 'Search employee',
              border: const OutlineInputBorder(),
              suffixIcon: _searching ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))) : const Icon(Icons.search),
            ),
            onChanged: (v) { setState(() { _selected = null; _code = null; }); if (v.trim().length >= 2) _search(v.trim()); },
          ),
          const SizedBox(height: 12),
          if (_selected == null)
            Expanded(child: _results.isEmpty
              ? const AdminEmptyState(icon: Icons.person_search_rounded, title: 'Search for an employee', subtitle: 'Type at least 2 characters of a name or code.')
              : ListView.separated(
                  itemCount: _results.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final e = _results[i];
                    return AdminCard(
                      onTap: () => setState(() { _selected = e; _code = null; }),
                      child: Row(children: [
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(e['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          Text('${e['emp_code'] ?? ''} • ${e['designation'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
                        ])),
                        const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
                      ]),
                    );
                  },
                ))
          else Expanded(child: Column(children: [
            AdminCard(child: Row(children: [
              Expanded(child: Text(_selected!['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
              TextButton(onPressed: () => setState(() { _selected = null; _code = null; }), child: const Text('Change')),
            ])),
            const SizedBox(height: 20),
            if (_code == null)
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24)),
                onPressed: _generating ? null : _generate,
                child: _generating ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Generate Code'),
              )
            else Expanded(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(_code!['code'] as String? ?? '', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w800, letterSpacing: 8, color: AppColors.navy)),
              const SizedBox(height: 12),
              Text(_remaining > 0 ? 'Expires in ${_fmt(_remaining)}' : 'Expired', style: TextStyle(fontSize: 13, color: _remaining > 0 ? AppColors.textLight : AppColors.red)),
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: () { Clipboard.setData(ClipboardData(text: _code!['code'] as String? ?? '')); showAdminSnack(context, 'Copied'); },
                icon: const Icon(Icons.copy_rounded, size: 16), label: const Text('Copy code'),
              ),
            ]))),
          ])),
        ]),
      ),
    );
  }
}
