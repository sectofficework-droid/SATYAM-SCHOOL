import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/staff_admin_service.dart';
import '../../../../core/services/s3_upload_service.dart';
import '../../../../common/widgets/admin_workspace_common.dart';

// Read-only admin view of teacher-uploaded documents (Assignment / Exam
// Paper / Question Bank) — admin-panel calls this "Question Papers", but
// it actually reads the teacher_documents table (see
// STAFF-APP-DESIGN-FIXED.md's grounding note: question_papers/
// question_bank tables are a different, unrelated paper-builder feature
// not exposed here).
class AdminDocumentsPage extends StatefulWidget {
  const AdminDocumentsPage({super.key});
  @override
  State<AdminDocumentsPage> createState() => _AdminDocumentsPageState();
}

class _AdminDocumentsPageState extends State<AdminDocumentsPage> {
  static const _sections = ['Assignment', 'Exam Paper', 'Question Bank'];
  String _section = 'Assignment';
  List<Map<String, dynamic>> _docs = [];
  bool _loading = true;
  String? _error;
  String? _opening;
  String get _employeeId => AuthService.to.profile.value?['id'] as String? ?? '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await StaffAdminService.teacherDocuments(_employeeId, section: _section);
      if (mounted) setState(() { _docs = list; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Could not load documents.'; _loading = false; });
    }
  }

  Future<void> _open(Map<String, dynamic> doc) async {
    setState(() => _opening = doc['id'] as String?);
    try {
      final url = await S3UploadService.getS3ViewUrl(doc['file_key'] as String);
      if (url == null) {
        if (mounted) showAdminSnack(context, 'Could not open this document.', isError: true);
      } else {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
    } finally {
      if (mounted) setState(() => _opening = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AdminAppBar(title: 'Question Papers'),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: SegmentedButton<String>(
            segments: _sections.map((s) => ButtonSegment(value: s, label: Text(s))).toList(),
            selected: {_section},
            onSelectionChanged: (s) { setState(() => _section = s.first); _load(); },
          ),
        ),
        Expanded(child: _loading ? const AdminLoading()
          : _error != null ? AdminErrorState(message: _error!, onRetry: _load)
          : _docs.isEmpty ? const AdminEmptyState(icon: Icons.description_rounded, title: 'No documents', subtitle: 'Teacher-uploaded documents will appear here.')
          : RefreshIndicator(color: AppColors.navy, onRefresh: _load, child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _docs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final d = _docs[i];
                final busy = _opening == d['id'];
                return AdminCard(onTap: busy ? null : () => _open(d), child: Row(children: [
                  Container(width: 40, height: 40,
                    decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.insert_drive_file_rounded, color: AppColors.indigo, size: 20)),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(d['title'] as String? ?? d['file_name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    Text('${d['teacher_name'] ?? ''} • ${d['class'] ?? ''} • ${d['subject'] ?? ''}', style: const TextStyle(fontSize: 11, color: AppColors.textLight)),
                  ])),
                  if (busy) const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  else const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.textHint),
                ]));
              },
            )),
        ),
      ]),
    );
  }
}
