import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

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
    setState(() => _loading = true);
    final profile = AuthService.to.profile.value ?? {};
    final classes  = teacherClasses(profile);
    final hw       = await SupabaseService.fetchHomework(classNames: classes);
    if (mounted) setState(() { _list = hw; _loading = false; });
  }

  void _showAddSheet() {
    final descCtrl    = TextEditingController();
    final subjectCtrl = TextEditingController();
    DateTime? dueDate;
    final profile    = AuthService.to.profile.value ?? {};
    final myClasses  = teacherClasses(profile);
    String? selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : (myClasses.isNotEmpty ? myClasses.first : null);

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
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(child: Container(
                  width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)),
                )),
                Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [AppColors.amber, AppColors.amber.withOpacity(.6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.assignment_add, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Add Homework', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                    Text('Assign task to your class', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                  ])),
                  IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                ]),
                const SizedBox(height: 20),
                if (myClasses.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.redLight, borderRadius: BorderRadius.circular(10)),
                    child: const Text(
                      'No classes are assigned to you yet. Ask admin to set your Subject/Class mapping.',
                      style: TextStyle(color: AppColors.red, fontSize: 12),
                    ),
                  )
                else
                  DropdownButtonFormField<String>(
                    value: selectedClass,
                    decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                    items: myClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                    onChanged: (v) => setS(() => selectedClass = v),
                  ),
                const SizedBox(height: 14),
                TextField(
                  controller: subjectCtrl,
                  decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Description / Task', prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 40),
                    child: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20),
                  )),
                ),
                const SizedBox(height: 14),
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
                      border: Border.all(color: dueDate != null ? AppColors.navy : AppColors.border, width: dueDate != null ? 2 : 1),
                      borderRadius: BorderRadius.circular(12),
                      color: AppColors.card,
                    ),
                    child: Row(children: [
                      Icon(Icons.calendar_month_rounded, size: 20, color: dueDate != null ? AppColors.navy : AppColors.textHint),
                      const SizedBox(width: 10),
                      Text(
                        dueDate == null ? 'Select Due Date' : DateFormat('EEEE, d MMM yyyy').format(dueDate!),
                        style: TextStyle(color: dueDate == null ? AppColors.textHint : AppColors.text, fontWeight: dueDate != null ? FontWeight.w600 : FontWeight.normal),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () async {
                    if (descCtrl.text.isEmpty || dueDate == null || selectedClass == null) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Please select a class and fill description and due date'),
                        behavior: SnackBarBehavior.floating,
                      ));
                      return;
                    }
                    await SupabaseService.createHomework({
                      'class':       selectedClass,
                      'subject':     subjectCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'due_date':    DateFormat('yyyy-MM-dd').format(dueDate!),
                      'created_by':  profile['id'],
                    });
                    if (mounted) Navigator.pop(ctx);
                    _load();
                  },
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.navyGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: const Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.add_circle_outline_rounded, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Assign Homework', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
                    ])),
                  ),
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
    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else if (_list.isEmpty) {
      body = _emptyState();
    } else {
      body = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final hw    = _list[i];
            final due   = DateTime.tryParse(hw['due_date'] ?? '');
            final overdue = due != null && due.isBefore(DateTime.now());
            final urgent  = due != null && !overdue && due.difference(DateTime.now()).inDays <= 2;

            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.0, end: 1.0),
              duration: Duration(milliseconds: 300 + i * 50),
              curve: Curves.easeOut,
              builder: (_, v, child) => Opacity(opacity: v,
                child: Transform.translate(offset: Offset(0, 20 * (1-v)), child: child)),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: AppShadows.card,
                  border: overdue
                    ? Border.all(color: AppColors.red.withOpacity(.3))
                    : urgent
                      ? Border.all(color: AppColors.amber.withOpacity(.3))
                      : null,
                ),
                child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    width: 5,
                    decoration: BoxDecoration(
                      color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.green,
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                            color: overdue ? AppColors.redLight : urgent ? AppColors.amberLight : AppColors.greenLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.assignment_rounded,
                            color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.green,
                            size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          if ((hw['subject'] ?? '').isNotEmpty || (hw['class'] ?? '').isNotEmpty)
                            Wrap(spacing: 6, runSpacing: 4, children: [
                              if ((hw['class'] ?? '').isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: AppColors.greenLight, borderRadius: BorderRadius.circular(6)),
                                  child: Text('Class ${hw['class']}', style: const TextStyle(color: AppColors.green, fontSize: 11, fontWeight: FontWeight.w700)),
                                ),
                              if ((hw['subject'] ?? '').isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(6)),
                                  child: Text(hw['subject'], style: const TextStyle(color: AppColors.blue, fontSize: 11, fontWeight: FontWeight.w700)),
                                ),
                            ]),
                          Text(hw['description'] ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(Icons.schedule_rounded, size: 13,
                              color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.textLight),
                            const SizedBox(width: 4),
                            Text(
                              due == null ? '' : overdue
                                ? 'Overdue · ${DateFormat('d MMM').format(due)}'
                                : 'Due: ${DateFormat('d MMM yyyy').format(due)}',
                              style: TextStyle(fontSize: 12,
                                color: overdue ? AppColors.red : urgent ? AppColors.amber : AppColors.textLight,
                                fontWeight: overdue || urgent ? FontWeight.w600 : FontWeight.normal),
                            ),
                          ]),
                        ])),
                      ]),
                    ),
                  ),
                ])),
              ),
            );
          },
        ),
      );
    }

    if (widget.embedded) {
      return Scaffold(
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _showAddSheet,
          backgroundColor: AppColors.navy,
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text('Add', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
        body: body,
      );
    }
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Homework'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        backgroundColor: AppColors.navy,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Homework', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: body,
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 5,
    separatorBuilder: (_, __) => const SizedBox(height: 10),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 86, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
        child: const Icon(Icons.assignment_outlined, color: AppColors.amber, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Homework Yet', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Tap the + button to assign homework to your class.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
