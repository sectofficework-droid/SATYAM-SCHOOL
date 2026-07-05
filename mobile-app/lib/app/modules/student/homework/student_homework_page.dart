import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentHomeworkPage extends StatefulWidget {
  final bool embedded;
  const StudentHomeworkPage({super.key, this.embedded = false});
  @override
  State<StudentHomeworkPage> createState() => _StudentHomeworkPageState();
}

class _StudentHomeworkPageState extends State<StudentHomeworkPage> {
  List<Map<String, dynamic>> _list = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final className = profile['class'] as String?;
    final hw        = await SupabaseService.fetchHomework(className: className);
    setState(() { _list = hw; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _list.isEmpty
            ? const Center(child: Text('No homework assigned.', style: TextStyle(color: AppColors.textLight)))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final hw      = _list[i];
                    final due     = DateTime.tryParse(hw['due_date'] ?? '');
                    final overdue = due != null && due.isBefore(DateTime.now());
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: overdue ? AppColors.red.withOpacity(.3) : AppColors.border),
                      ),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: overdue ? AppColors.redLight : AppColors.amberLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.assignment,
                            color: overdue ? AppColors.red : AppColors.amber),
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
                              Icon(Icons.schedule, size: 13,
                                color: overdue ? AppColors.red : AppColors.textLight),
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

    if (widget.embedded) return body;
    return Scaffold(appBar: AppBar(title: const Text('Homework')), body: body);
  }
}
