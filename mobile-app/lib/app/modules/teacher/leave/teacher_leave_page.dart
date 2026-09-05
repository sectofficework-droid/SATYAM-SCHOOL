import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherLeavePage extends StatefulWidget {
  final bool embedded;
  const TeacherLeavePage({super.key, this.embedded = false});
  @override
  State<TeacherLeavePage> createState() => _TeacherLeavePageState();
}

class _TeacherLeavePageState extends State<TeacherLeavePage> {
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile    = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final requests = employeeId != null
        ? await SupabaseService.fetchMyLeaveRequests(employeeId)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _requests = requests; _loading = false; });
  }

  void _showRequestSheet() {
    DateTime? fromDate;
    DateTime? toDate;
    final reasonCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
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
                      gradient: LinearGradient(colors: [AppColors.orange, AppColors.orange.withValues(alpha: .6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.beach_access_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Request Leave', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                    Text('Submit before the leave date - admin will review it', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
                  ])),
                  IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                ]),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx, initialDate: DateTime.now(),
                      firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (d != null) setS(() { fromDate = d; if (toDate == null || toDate!.isBefore(d)) toDate = d; });
                  },
                  child: _dateBox('From Date', fromDate),
                ),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx, initialDate: fromDate ?? DateTime.now(),
                      firstDate: fromDate ?? DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (d != null) setS(() => toDate = d);
                  },
                  child: _dateBox('To Date (same as From for one day)', toDate),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: reasonCtrl,
                  maxLines: 3,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Reason', alignLabelWithHint: true,
                    prefixIcon: Icon(Icons.edit_outlined, color: AppColors.navy, size: 20),
                  ),
                ),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () async {
                    if (fromDate == null || toDate == null) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Please pick from and to dates'), behavior: SnackBarBehavior.floating));
                      return;
                    }
                    if (reasonCtrl.text.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                        content: Text('Please enter a reason'), behavior: SnackBarBehavior.floating));
                      return;
                    }
                    final profile    = AuthService.to.profile.value ?? {};
                    final employeeId = profile['id'] as String?;
                    if (employeeId == null) return;
                    await SupabaseService.submitLeaveRequest(
                      employeeId: employeeId,
                      fromDate: DateFormat('yyyy-MM-dd').format(fromDate!),
                      toDate: DateFormat('yyyy-MM-dd').format(toDate!),
                      reason: reasonCtrl.text.trim(),
                    );
                    if (ctx.mounted) Navigator.pop(ctx);
                    _load();
                  },
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.navyGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [BoxShadow(color: AppColors.navy.withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: const Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Submit Request', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
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

  Widget _dateBox(String label, DateTime? date) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      border: Border.all(color: date != null ? AppColors.navy : AppColors.border, width: date != null ? 2 : 1),
      borderRadius: BorderRadius.circular(12),
      color: AppColors.card,
    ),
    child: Row(children: [
      Icon(Icons.calendar_month_rounded, size: 20, color: date != null ? AppColors.navy : AppColors.textHint),
      const SizedBox(width: 10),
      Text(date == null ? label : DateFormat('EEEE, d MMM yyyy').format(date),
        style: TextStyle(color: date == null ? AppColors.textHint : AppColors.text, fontWeight: date != null ? FontWeight.w600 : FontWeight.normal)),
    ]),
  );

  Color _statusColor(String status) => switch (status) {
    'Approved' => AppColors.green,
    'Rejected' => AppColors.red,
    _          => AppColors.amber,
  };
  Color _statusBg(String status) => switch (status) {
    'Approved' => AppColors.greenLight,
    'Rejected' => AppColors.redLight,
    _          => AppColors.amberLight,
  };

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator(color: AppColors.navy));
    } else if (_requests.isEmpty) {
      body = _emptyState();
    } else {
      body = RefreshIndicator(
        color: AppColors.navy,
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
          itemCount: _requests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final r      = _requests[i];
            final status = (r['status'] ?? 'Pending') as String;
            final from   = DateTime.tryParse(r['from_date'] ?? '');
            final to     = DateTime.tryParse(r['to_date'] ?? '');
            final sameDay = from != null && to != null && from.year == to.year && from.month == to.month && from.day == to.day;
            return Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card, border: Border.all(color: AppColors.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(
                    from == null ? '—' : (sameDay
                        ? DateFormat('d MMM yyyy').format(from)
                        : '${DateFormat('d MMM').format(from)} – ${DateFormat('d MMM yyyy').format(to!)}'),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: _statusBg(status), borderRadius: BorderRadius.circular(8)),
                    child: Text(status, style: TextStyle(color: _statusColor(status), fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ]),
                const SizedBox(height: 6),
                Text((r['reason'] ?? '').toString(), style: const TextStyle(fontSize: 13, color: AppColors.textLight)),
                if (status == 'Rejected' && (r['admin_note'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text('Admin note: ${r['admin_note']}', style: const TextStyle(fontSize: 12, color: AppColors.red, fontStyle: FontStyle.italic)),
                ],
              ]),
            );
          },
        ),
      );
    }

    final fab = FloatingActionButton.extended(
      onPressed: _showRequestSheet,
      backgroundColor: AppColors.navy,
      icon: const Icon(Icons.add, color: Colors.white),
      label: const Text('Request Leave', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
    );

    if (widget.embedded) {
      return Stack(children: [
        Positioned.fill(child: body),
        Positioned(right: 16, bottom: 16, child: fab),
      ]);
    }
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('My Leave'),
      ),
      floatingActionButton: fab,
      body: body,
    );
  }

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.orangeLight, shape: BoxShape.circle),
        child: const Icon(Icons.beach_access_rounded, color: AppColors.orange, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Leave Requests', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Tap "Request Leave" below to ask admin for time off.',
        textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}
