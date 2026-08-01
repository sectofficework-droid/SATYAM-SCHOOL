import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class TeacherQueryPage extends StatefulWidget {
  final bool embedded;
  const TeacherQueryPage({super.key, this.embedded = false});
  @override
  State<TeacherQueryPage> createState() => _TeacherQueryPageState();
}

class _TeacherQueryPageState extends State<TeacherQueryPage> {
  final _msgCtrl = TextEditingController();
  List<Map<String, dynamic>> _mine = [];
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _msgCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile = AuthService.to.profile.value ?? {};
    final id = profile['id'] as String?;
    final mine = id != null ? await SupabaseService.fetchMyQueries(id) : <Map<String, dynamic>>[];
    if (mounted) setState(() { _mine = mine; _loading = false; });
  }

  Future<void> _submit() async {
    final message = _msgCtrl.text.trim();
    if (message.isEmpty) return;
    final profile = AuthService.to.profile.value ?? {};
    setState(() => _submitting = true);
    try {
      await SupabaseService.submitQuery({
        'user_type':  'teacher',
        'user_id':    profile['id'],
        'user_name':  profile['name'] ?? '',
        'class_name': profile['class_name'],
        'message':    message,
      });
      _msgCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Submitted. The school will review it soon.'), backgroundColor: AppColors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: $e'), backgroundColor: AppColors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading ? _buildShimmer() : _buildContent();
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Query / Suggestion'),
      ),
      body: body,
    );
  }

  Widget _buildContent() => RefreshIndicator(
    color: AppColors.navy,
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      children: [
        _buildForm(),
        const SizedBox(height: 20),
        const Text('Your Submissions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
        const SizedBox(height: 10),
        if (_mine.isEmpty) _emptyState() else ..._mine.map(_buildCard),
      ],
    ),
  );

  Widget _buildForm() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Have a query or suggestion for the school?', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 4),
      const Text('Write it below and the admin office will review it.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
      const SizedBox(height: 12),
      TextField(
        controller: _msgCtrl,
        maxLines: 4,
        maxLength: 500,
        decoration: InputDecoration(
          hintText: 'Type your query or suggestion here...',
          filled: true,
          fillColor: AppColors.bg,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        ),
      ),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _submitting ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.navy,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(_submitting ? 'Submitting...' : 'Submit', style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      ),
    ]),
  );

  Widget _buildCard(Map<String, dynamic> q) {
    final status  = (q['status'] ?? 'Pending') as String;
    final resolved = status == 'Resolved';
    final date = DateTime.tryParse(q['created_at'] ?? '');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(date != null ? DateFormat('d MMM yyyy, h:mm a').format(date) : '',
            style: const TextStyle(fontSize: 11, color: AppColors.textLight, fontWeight: FontWeight.w600))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: resolved ? AppColors.greenLight : AppColors.amberLight,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(status, style: TextStyle(
              color: resolved ? AppColors.green : AppColors.amber, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
        const SizedBox(height: 8),
        Text(q['message'] ?? '', style: const TextStyle(fontSize: 13.5, color: AppColors.text, height: 1.4)),
        if ((q['admin_reply'] ?? '').toString().isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.bg, borderRadius: BorderRadius.circular(10)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('School\'s Reply', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
              const SizedBox(height: 3),
              Text(q['admin_reply'], style: const TextStyle(fontSize: 13, color: AppColors.text, height: 1.4)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _buildShimmer() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Shimmer.fromColors(
        baseColor: const Color(0xFFE2E8F0),
        highlightColor: const Color(0xFFF8FAFC),
        child: Container(height: 200, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
      ),
    ],
  );

  Widget _emptyState() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: Center(child: Column(children: [
      Container(
        width: 72, height: 72,
        decoration: const BoxDecoration(color: AppColors.cyanLight, shape: BoxShape.circle),
        child: const Icon(Icons.forum_rounded, color: AppColors.cyan, size: 32),
      ),
      const SizedBox(height: 14),
      const Text('No submissions yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 4),
      const Text('Anything you submit above will show up here.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
    ])),
  );
}
