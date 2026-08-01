import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';

class StudentRulesPage extends StatefulWidget {
  final bool embedded;
  const StudentRulesPage({super.key, this.embedded = false});
  @override
  State<StudentRulesPage> createState() => _StudentRulesPageState();
}

class _StudentRulesPageState extends State<StudentRulesPage> {
  String _content = '';
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final content = await SupabaseService.fetchSchoolRules();
    if (mounted) setState(() { _content = content; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading ? _buildShimmer() : _buildContent();
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Rules & Regulations'),
      ),
      body: body,
    );
  }

  Widget _buildContent() => RefreshIndicator(
    color: AppColors.navy,
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_content.trim().isEmpty)
          _emptyState()
        else
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card),
            child: Text(_content, style: const TextStyle(fontSize: 14, color: AppColors.text, height: 1.7)),
          ),
      ],
    ),
  );

  Widget _buildShimmer() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Shimmer.fromColors(
        baseColor: const Color(0xFFE2E8F0),
        highlightColor: const Color(0xFFF8FAFC),
        child: Container(height: 300, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
      ),
    ],
  );

  Widget _emptyState() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Center(child: Column(children: [
      Container(
        width: 72, height: 72,
        decoration: const BoxDecoration(color: AppColors.stoneLight, shape: BoxShape.circle),
        child: const Icon(Icons.gavel_rounded, color: AppColors.stone, size: 32),
      ),
      const SizedBox(height: 14),
      const Text('No rules published yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 4),
      const Text('The school hasn\'t added Rules & Regulations yet.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
    ])),
  );
}
