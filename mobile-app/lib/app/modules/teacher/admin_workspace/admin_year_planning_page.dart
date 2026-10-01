import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Mobile port of the web admin panel's Settings -> Year Planning tab
// (YearPlanningTab.js) - add/edit/delete school calendar events. XLSX/PDF
// export stays web-only, same call as the Monthly Attendance Register.
// Senior Admin/Management only.
class AdminYearPlanningPage extends StatefulWidget {
  const AdminYearPlanningPage({super.key});
  @override
  State<AdminYearPlanningPage> createState() => _AdminYearPlanningPageState();
}

class _CategoryDef {
  final String key, label;
  final Color color;
  const _CategoryDef(this.key, this.label, this.color);
}

const _categories = [
  _CategoryDef('govt', 'Govt Holiday', Color(0xFFEF4444)),
  _CategoryDef('function', 'Function', Color(0xFF8B5CF6)),
  _CategoryDef('celebration', 'Celebration', Color(0xFFF59E0B)),
  _CategoryDef('ptm', 'PTM', Color(0xFF3B82F6)),
  _CategoryDef('exam', 'Exam', Color(0xFFE11D48)),
  _CategoryDef('holiday', 'Holiday', Color(0xFF0D9488)),
  _CategoryDef('sunday', 'Sunday', Color(0xFFF97316)),
  _CategoryDef('working_day', 'Working Day', Color(0xFF16A34A)),
];

class _AdminYearPlanningPageState extends State<AdminYearPlanningPage> {
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final rows = await StaffAdminService.getCalendarEvents();
      if (mounted) setState(() { _events = rows; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load the calendar.'; _loading = false; });
    }
  }

  _CategoryDef _catFor(String? key) => _categories.firstWhere((c) => c.key == key, orElse: () => _categories.last);

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    DateTime date = existing != null ? DateTime.parse(existing['event_date'] as String) : DateTime.now();
    String category = existing != null ? existing['category'] as String : _categories.first.key;
    final labelCtrl = TextEditingController(text: existing?['title'] as String? ?? '');

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(existing == null ? 'Add Calendar Event' : 'Edit Calendar Event', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: () async {
              final picked = await showDatePicker(context: ctx, initialDate: date, firstDate: DateTime(2024, 1, 1), lastDate: DateTime(2035, 12, 31));
              if (picked != null) setSheet(() => date = picked);
            },
            child: Text(DateFormat('yyyy-MM-dd').format(date)),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: category,
            decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
            items: _categories.map((c) => DropdownMenuItem(value: c.key, child: Row(children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: c.color, shape: BoxShape.circle)),
              const SizedBox(width: 8), Text(c.label),
            ]))).toList(),
            onChanged: (v) { if (v != null) setSheet(() => category = v); },
          ),
          const SizedBox(height: 10),
          TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            onPressed: () {
              if (labelCtrl.text.trim().isEmpty) { showAdminSnack(ctx, 'Enter a title.', isError: true); return; }
              Navigator.pop(ctx, true);
            },
            child: const Text('Save'),
          ),
        ])),
      )),
    );

    if (saved != true) return;
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    try {
      if (existing == null) {
        await StaffAdminService.addCalendarEvent(_employeeId, date: dateStr, category: category, label: labelCtrl.text.trim());
      } else {
        await StaffAdminService.updateCalendarEvent(_employeeId, existing['id'] as String, date: dateStr, category: category, label: labelCtrl.text.trim());
      }
      if (mounted) showAdminSnack(context, existing == null ? 'Event added' : 'Event updated');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to save.', isError: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> e) async {
    final ok = await confirmAdminAction(context, title: 'Delete event', message: 'Remove "${e['title']}" from the calendar?', confirmLabel: 'Delete');
    if (!ok) return;
    try {
      await StaffAdminService.deleteCalendarEvent(_employeeId, e['id'] as String);
      if (mounted) setState(() => _events.removeWhere((x) => x['id'] == e['id']));
    } catch (err) {
      if (mounted) showAdminSnack(context, 'Failed to delete.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Year Planning'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: () => _openForm(), child: const Icon(Icons.add_rounded, color: Colors.white)),
      body: _loading
        ? const AdminLoading()
        : _error != null
          ? AdminErrorState(message: _error!, onRetry: _load)
          : _events.isEmpty
            ? const AdminEmptyState(icon: Icons.event_note_rounded, title: 'No events yet', subtitle: 'Tap + to add a holiday, function, or exam date.')
            : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                itemCount: _events.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = _events[i];
                  final cat = _catFor(e['category'] as String?);
                  return AdminCard(
                    onTap: () => _openForm(existing: e),
                    child: Row(children: [
                      Container(width: 4, height: 36, decoration: BoxDecoration(color: cat.color, borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(e['title'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        Text('${DateFormat('d MMM yyyy').format(DateTime.parse(e['event_date'] as String))} • ${cat.label}', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                      ])),
                      IconButton(icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red, size: 20), onPressed: () => _delete(e)),
                    ]),
                  );
                },
              )),
    );
  }
}
