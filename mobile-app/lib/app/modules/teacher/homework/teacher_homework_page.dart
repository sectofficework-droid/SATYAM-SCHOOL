import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherHomeworkPage extends StatefulWidget {
  final bool embedded;
  const TeacherHomeworkPage({super.key, this.embedded = false});
  @override
  State<TeacherHomeworkPage> createState() => _TeacherHomeworkPageState();
}

class _TeacherHomeworkPageState extends State<TeacherHomeworkPage> {
  List<Map<String, dynamic>> _list = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class_assigned'] as String?;
    final hw        = await SupabaseService.fetchHomework(className: className);
    setState(() { _list = hw; _loading = false; });
  }

  void _showAddSheet() {
    final descCtrl    = TextEditingController();
    final subjectCtrl = TextEditingController();
    DateTime? dueDate;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  const Text('Add Homework', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ]),
                const SizedBox(height: 16),
                TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
                const SizedBox(height: 12),
                TextField(controller: descCtrl, maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description')),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx,
                      initialDate: DateTime.now().add(const Duration(days: 1)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 30)),
                    );
                    if (d != null) setS(() => dueDate = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(children: [
                      const Icon(Icons.calendar_today, size: 18, color: AppColors.navy),
                      const SizedBox(width: 10),
                      Text(dueDate == null ? 'Select Due Date' : DateFormat('d MMM yyyy').format(dueDate!),
                        style: TextStyle(color: dueDate == null ? AppColors.textHint : AppColors.text)),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () async {
                    if (descCtrl.text.isEmpty || dueDate == null) return;
                    final profile   = AuthService.to.profile.value ?? {};
                    await SupabaseService.createHomework({
                      'class':       profile['class_assigned'],
                      'subject':     subjectCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'due_date':    DateFormat('yyyy-MM-dd').format(dueDate!),
                      'created_by':  profile['id'],
                    });
                    if (mounted) Navigator.pop(ctx);
                    _load();
                  },
                  child: const Text('Add Homework'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _list.isEmpty
            ? const Center(child: Text('No homework yet.', style: TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final hw  = _list[i];
                    final due = DateTime.tryParse(hw['due_date'] ?? '');
                    final overdue = due != null && due.isBefore(DateTime.now());
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: overdue ? AppColors.redLight : AppColors.amberLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.assignment, color: overdue ? AppColors.red : AppColors.amber),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if ((hw['subject'] ?? '').isNotEmpty)
                              Text(hw['subject'], style: const TextStyle(
                                color: AppColors.navy, fontSize: 12, fontWeight: FontWeight.w600)),
                            Text(hw['description'] ?? '',
                              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14)),
                            const SizedBox(height: 4),
                            Row(children: [
                              Icon(Icons.schedule, size: 13, color: overdue ? AppColors.red : AppColors.textLight),
                              const SizedBox(width: 4),
                              Text(
                                due == null ? '' : 'Due: ${DateFormat('d MMM').format(due)}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: overdue ? AppColors.red : AppColors.textLight,
                                  fontWeight: overdue ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                            ]),
                          ],
                        )),
                      ]),
                    );
                  },
                ),
              );

    if (widget.embedded) {
      return Scaffold(
        floatingActionButton: FloatingActionButton(
          onPressed: _showAddSheet,
          backgroundColor: AppColors.navy,
          child: const Icon(Icons.add, color: Colors.white),
        ),
        body: body,
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Homework')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddSheet,
        backgroundColor: AppColors.navy,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: body,
    );
  }
}
