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
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final profile   = AuthService.to.profile.value ?? {};
      final studentId = profile['id'] as String? ?? '';
      if (studentId.isEmpty) {
        setState(() { _loading = false; _error = 'Student ID not found.'; });
        return;
      }
      final data = await SupabaseService.fetchFees(studentId);
      if (mounted) setState(() { _data = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _error = 'Failed to load fees.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
            ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textLight)))
            : _buildContent();

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Fee Status'),
      ),
      body: body,
    );
  }

  Widget _buildContent() {
    final fmt      = NumberFormat('#,##0', 'en_IN');
    final d        = _data ?? {};
    final total    = (d['fee_total']    as num?)?.toDouble() ?? 0;
    final discount = (d['fee_discount'] as num?)?.toDouble() ?? 0;
    final paid     = (d['total_paid']   as num?)?.toDouble() ?? 0;
    final balance  = (d['balance']      as num?)?.toDouble() ?? 0;
    final payments  = (d['payments']  as List?)?.cast<Map<String, dynamic>>() ?? [];
    final inventory = (d['inventory'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Summary card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.navy, AppColors.navyDark],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              children: [
                Row(children: [
                  Expanded(child: _summaryBox('Total Fee', '₹${fmt.format(total)}', Colors.white70)),
                  Container(width: 1, height: 44, color: Colors.white24),
                  Expanded(child: _summaryBox('Discount', '₹${fmt.format(discount)}', AppColors.amber)),
                ]),
                const SizedBox(height: 14),
                Container(height: 1, color: Colors.white12),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(child: _summaryBox('Paid', '₹${fmt.format(paid)}', AppColors.green)),
                  Container(width: 1, height: 44, color: Colors.white24),
                  Expanded(child: _summaryBox(
                    'Balance Due',
                    '₹${fmt.format(balance)}',
                    balance > 0 ? const Color(0xFFFF6B6B) : AppColors.green,
                  )),
                ]),
              ],
            ),
          ),

          const SizedBox(height: 20),

          if (d['discount_reason'] != null && (d['discount_reason'] as String).isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.amberLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.amber.withOpacity(.3)),
              ),
              child: Row(children: [
                const Icon(Icons.discount_outlined, color: AppColors.amber, size: 16),
                const SizedBox(width: 8),
                Expanded(child: Text('Discount reason: ${d['discount_reason']}',
                  style: const TextStyle(fontSize: 12, color: AppColors.text))),
              ]),
            ),

          Text('Payment History',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
          const SizedBox(height: 10),

          if (payments.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: const Center(
                child: Text('No payments recorded yet.',
                  style: TextStyle(color: AppColors.textLight)),
              ),
            )
          else
            ...payments.asMap().entries.map((entry) {
              final i = entry.key;
              final p = entry.value;
              final amt  = (p['amount'] as num?)?.toDouble() ?? 0;
              final date = DateTime.tryParse(p['payment_date'] ?? '');
              // Chronological number from the server (1 = earliest payment
              // ever made), independent of this list's most-recent-first
              // display order - falls back to list position only if a row
              // somehow has no payment_number (e.g. before the RPC update).
              final number = (p['payment_number'] as num?)?.toInt() ?? (i + 1);
              return Container(
                margin: EdgeInsets.only(bottom: i < payments.length - 1 ? 10 : 0),
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
                      color: AppColors.greenLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.check_circle, color: AppColors.green, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Payment #$number',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      if (date != null)
                        Text(DateFormat('d MMM yyyy').format(date),
                          style: const TextStyle(color: AppColors.textHint, fontSize: 12)),
                      if ((p['received_by'] ?? '').toString().isNotEmpty)
                        Text('Received by: ${p['received_by']}',
                          style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                    ],
                  )),
                  Text('₹${fmt.format(amt)}',
                    style: const TextStyle(
                      color: AppColors.green, fontWeight: FontWeight.w700, fontSize: 15)),
                ]),
              );
            }),

          const SizedBox(height: 24),
          Text('Inventory Items',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.text)),
          const SizedBox(height: 10),

          if (inventory.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: const Center(
                child: Text('No inventory items assigned yet.',
                  style: TextStyle(color: AppColors.textLight)),
              ),
            )
          else
            ...inventory.asMap().entries.map((entry) {
              final i    = entry.key;
              final item = entry.value;
              final given = item['status'] == 'Given';
              final givenDate = DateTime.tryParse(item['given_date'] ?? '');
              final color = given ? AppColors.green : AppColors.amber;
              final bg    = given ? AppColors.greenLight : AppColors.amberLight;
              return Container(
                margin: EdgeInsets.only(bottom: i < inventory.length - 1 ? 10 : 0),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
                    child: Icon(given ? Icons.inventory_2_rounded : Icons.hourglass_empty_rounded, color: color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text((item['item_name'] ?? '').toString(),
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      if (given && givenDate != null)
                        Text('Given on ${DateFormat('d MMM yyyy').format(givenDate)}',
                          style: const TextStyle(color: AppColors.textHint, fontSize: 12)),
                    ],
                  )),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
                    child: Text(given ? 'Given' : 'Pending',
                      style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11.5)),
                  ),
                ]),
              );
            }),
        ],
      ),
    );
  }

  Widget _summaryBox(String label, String value, Color valueColor) => Column(
    children: [
      Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
      const SizedBox(height: 4),
      Text(value, style: TextStyle(color: valueColor, fontSize: 16, fontWeight: FontWeight.w700)),
    ],
  );
}
