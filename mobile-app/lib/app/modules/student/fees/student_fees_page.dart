import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentFeesPage extends StatefulWidget {
  final bool embedded;
  const StudentFeesPage({super.key, this.embedded = false});
  @override
  State<StudentFeesPage> createState() => _StudentFeesPageState();
}

class _StudentFeesPageState extends State<StudentFeesPage> {
  List<Map<String, dynamic>> _fees = [];
  bool _loading = true;

  double get _totalPaid    => _fees.fold(0, (s, f) => s + ((f['amount_paid'] as num?)?.toDouble() ?? 0));
  double get _totalPending => _fees.fold(0, (s, f) => s + ((f['pending_amount'] as num?)?.toDouble() ?? 0));

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final profile   = AuthService.to.profile.value ?? {};
    final studentId = profile['id'] as String? ?? '';
    final fees      = await SupabaseService.fetchFees(studentId);
    setState(() { _fees = fees; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00', 'en_IN');

    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
            // Summary
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.navy, AppColors.navyDark],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                Expanded(child: _feeBox('Paid', '₹ ${fmt.format(_totalPaid)}', AppColors.green)),
                Container(width: 1, height: 40, color: Colors.white.withOpacity(.2)),
                Expanded(child: _feeBox('Pending', '₹ ${fmt.format(_totalPending)}',
                  _totalPending > 0 ? AppColors.amber : AppColors.green)),
              ]),
            ),

            if (_fees.isEmpty)
              const Expanded(child: Center(child: Text('No fee records found.',
                style: TextStyle(color: AppColors.textLight))))
            else
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  itemCount: _fees.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final f       = _fees[i];
                    final paid    = (f['amount_paid'] as num?)?.toDouble() ?? 0;
                    final pending = (f['pending_amount'] as num?)?.toDouble() ?? 0;
                    final date    = DateTime.tryParse(f['created_at'] ?? '');

                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                            color: pending > 0 ? AppColors.amberLight : AppColors.greenLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            pending > 0 ? Icons.pending_actions : Icons.check_circle,
                            color: pending > 0 ? AppColors.amber : AppColors.green,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(f['fee_type'] ?? f['description'] ?? 'Fee',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            if (date != null)
                              Text(DateFormat('d MMM yyyy').format(date),
                                style: const TextStyle(color: AppColors.textHint, fontSize: 11)),
                          ],
                        )),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('₹ ${fmt.format(paid)}',
                              style: const TextStyle(color: AppColors.green, fontWeight: FontWeight.w700)),
                            if (pending > 0)
                              Text('Due: ₹ ${fmt.format(pending)}',
                                style: const TextStyle(color: AppColors.red, fontSize: 11)),
                          ],
                        ),
                      ]),
                    );
                  },
                ),
              ),
          ]);

    if (widget.embedded) return body;
    return Scaffold(appBar: AppBar(title: const Text('Fee Status')), body: body);
  }

  Widget _feeBox(String label, String value, Color color) => Column(children: [
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
    const SizedBox(height: 4),
    Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w700)),
  ]);
}
