import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

class AdminSyllabusPage extends StatefulWidget {
  const AdminSyllabusPage({super.key});
  @override
  State<AdminSyllabusPage> createState() => _AdminSyllabusPageState();
}

class _AdminSyllabusPageState extends State<AdminSyllabusPage> {
  List<Map<String, dynamic>> _chapters = [];
  bool _loading = true;
  String? _error;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.syllabus(_employeeId);
      if (mounted) setState(() { _chapters = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load syllabus.'; _loading = false; });
    }
  }

  Future<void> _addChapter() async {
    final classCtrl = TextEditingController();
    final subjectCtrl = TextEditingController();
    final chapterCtrl = TextEditingController();
    List<Map<String, dynamic>> teachers = [];
    String? teacherId;
    try { teachers = await StaffAdminService.teachingStaff(_employeeId); } catch (_) {}

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) => Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('New Chapter', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          TextField(controller: classCtrl, decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: chapterCtrl, decoration: const InputDecoration(labelText: 'Chapter', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: teacherId,
            decoration: const InputDecoration(labelText: 'Owning Teacher', border: OutlineInputBorder()),
            items: teachers.map((t) => DropdownMenuItem(value: t['id'] as String, child: Text(t['name'] as String))).toList(),
            onChanged: (v) => setSheet(() => teacherId = v),
          ),
          const SizedBox(height: 16),
          ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy), onPressed: () => Navigator.pop(ctx, true), child: const Text('Add Chapter')),
        ])),
      )),
    );
    if (ok != true || teacherId == null || chapterCtrl.text.trim().isEmpty) return;
    try {
      await StaffAdminService.addSyllabusChapter(_employeeId,
        teacherId: teacherId!, className: classCtrl.text.trim(), subject: subjectCtrl.text.trim(), chapter: chapterCtrl.text.trim());
      if (mounted) showAdminSnack(context, 'Chapter added');
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Failed to add chapter.', isError: true);
    }
  }

  Future<void> _manage(Map<String, dynamic> ch) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(ch['chapter'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 12),
          ListTile(leading: const Icon(Icons.hourglass_empty_rounded), title: const Text('Not Started'), onTap: () => Navigator.pop(ctx, 'Not Started')),
          ListTile(leading: const Icon(Icons.trending_up_rounded), title: const Text('In Progress'), onTap: () => Navigator.pop(ctx, 'In Progress')),
          ListTile(leading: const Icon(Icons.check_circle_outline_rounded), title: const Text('Completed'), onTap: () => Navigator.pop(ctx, 'Completed')),
          ListTile(leading: const Icon(Icons.delete_outline_rounded, color: AppColors.red), title: const Text('Delete', style: TextStyle(color: AppColors.red)), onTap: () => Navigator.pop(ctx, 'delete')),
        ]),
      ),
    );
    if (action == null) return;
    try {
      if (action == 'delete') {
        final ok = await confirmAdminAction(context, title: 'Delete chapter', message: 'This cannot be undone.', confirmLabel: 'Delete');
        if (!ok) return;
        await StaffAdminService.deleteSyllabusChapter(_employeeId, ch['id'] as String);
      } else {
        await StaffAdminService.setSyllabusChapterStatus(_employeeId, ch['id'] as String, action);
      }
      _load();
    } catch (e) {
      if (mounted) showAdminSnack(context, 'Action failed.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Syllabus'),
      floatingActionButton: FloatingActionButton(backgroundColor: AppColors.navy, onPressed: _addChapter, child: const Icon(Icons.add)),
      body: _loading ? const AdminLoading()
        : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
        : _chapters.isEmpty ? const AdminEmptyState(icon: Icons.menu_book_rounded, title: 'No chapters', subtitle: 'Tap + to add one.')
        : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _chapters.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final ch = _chapters[i];
              final status = ch['status'] as String? ?? 'Not Started';
              final color = status == 'Completed' ? AppColors.green : status == 'In Progress' ? AppColors.amber : AppColors.stone;
              final light = status == 'Completed' ? AppColors.greenLight : status == 'In Progress' ? AppColors.amberLight : AppColors.stoneLight;
              return AdminCard(onTap: () => _manage(ch), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${ch['class']} • ${ch['subject']}', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                  Text(ch['chapter'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text(ch['teacher_name'] as String? ?? '', style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
                ])),
                AdminStatusPill(label: status, color: color, light: light),
              ]));
            },
          )),
    );
  }
}
