import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';

class StudentHelpDeskPage extends StatefulWidget {
  final bool embedded;
  const StudentHelpDeskPage({super.key, this.embedded = false});
  @override
  State<StudentHelpDeskPage> createState() => _StudentHelpDeskPageState();
}

class _StudentHelpDeskPageState extends State<StudentHelpDeskPage> {
  Map<String, dynamic> _contacts = {};
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final sectionId = profile['section_id'] as String?;
    final contacts   = await SupabaseService.fetchHelpDeskContacts(sectionId);
    if (mounted) setState(() { _contacts = contacts; _loading = false; });
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading ? _buildShimmer() : _buildContent();
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Help Desk'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: body,
    );
  }

  Widget _buildContent() {
    final classTeacher = _contacts['class_teacher'] as Map?;
    final supporting    = List<Map>.from(_contacts['supporting_teachers'] as List? ?? []);
    final admins         = List<Map>.from(_contacts['admins'] as List? ?? []);
    final principal      = _contacts['principal'] as Map?;

    final sections = <Widget>[];
    if (classTeacher != null) {
      sections.add(_sectionCard(
        title: 'Class Teacher',
        icon: Icons.school_rounded,
        color: AppColors.blue,
        bgColor: AppColors.blueLight,
        rows: [{'label': classTeacher['name'], 'phone': classTeacher['phone']}],
      ));
    }
    if (supporting.isNotEmpty) {
      sections.add(_sectionCard(
        title: 'Supporting Teacher${supporting.length > 1 ? 's' : ''}',
        icon: Icons.people_alt_rounded,
        color: AppColors.purple,
        bgColor: AppColors.purpleLight,
        rows: supporting.map((t) => {'label': t['name'], 'phone': t['phone']}).toList(),
      ));
    }
    if (admins.isNotEmpty) {
      sections.add(_sectionCard(
        title: 'Admin Office',
        icon: Icons.support_agent_rounded,
        color: AppColors.indigo,
        bgColor: AppColors.indigoLight,
        rows: admins.map((a) => {'label': a['label'], 'phone': a['phone']}).toList(),
      ));
    }
    if (principal != null) {
      sections.add(_sectionCard(
        title: 'Principal',
        icon: Icons.workspace_premium_rounded,
        color: AppColors.amber,
        bgColor: AppColors.amberLight,
        rows: [{'label': principal['name'], 'phone': principal['phone']}],
      ));
    }

    return RefreshIndicator(
      color: AppColors.navy,
      onRefresh: _load,
      child: sections.isEmpty
        ? ListView(padding: const EdgeInsets.all(16), children: [_emptyState()])
        : ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            children: [
              const Text('Who to call', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
              const SizedBox(height: 4),
              const Text('In order — your class contacts first, then the school office.',
                style: TextStyle(fontSize: 12, color: AppColors.textLight)),
              const SizedBox(height: 14),
              ...sections,
            ],
          ),
    );
  }

  Widget _sectionCard({
    required String title,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required List<Map> rows,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), boxShadow: AppShadows.card, border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
          child: Row(children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(9)),
              child: Icon(icon, color: color, size: 17),
            ),
            const SizedBox(width: 10),
            Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.text)),
          ]),
        ),
        ...rows.where((r) => (r['phone'] ?? '').toString().isNotEmpty).map((r) => _contactRow(
          label: (r['label'] ?? '').toString(),
          phone: (r['phone'] ?? '').toString(),
        )),
      ]),
    );
  }

  Widget _contactRow({required String label, required String phone}) {
    return InkWell(
      onTap: () => _call(phone),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (label.isNotEmpty)
                Text(label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.text)),
              Text(phone, style: const TextStyle(fontSize: 12.5, color: AppColors.textLight)),
            ]),
          ),
          Container(
            width: 34, height: 34,
            decoration: const BoxDecoration(color: AppColors.greenLight, shape: BoxShape.circle),
            child: const Icon(Icons.call_rounded, color: AppColors.green, size: 16),
          ),
        ]),
      ),
    );
  }

  Widget _buildShimmer() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Shimmer.fromColors(
        baseColor: const Color(0xFFE2E8F0),
        highlightColor: const Color(0xFFF8FAFC),
        child: Container(height: 260, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16))),
      ),
    ],
  );

  Widget _emptyState() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: Center(child: Column(children: [
      Container(
        width: 72, height: 72,
        decoration: const BoxDecoration(color: AppColors.indigoLight, shape: BoxShape.circle),
        child: const Icon(Icons.support_agent_rounded, color: AppColors.indigo, size: 32),
      ),
      const SizedBox(height: 14),
      const Text('No contacts set up yet', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 4),
      const Text('Check back soon or contact your school directly.', style: TextStyle(fontSize: 12, color: AppColors.textLight)),
    ])),
  );
}
