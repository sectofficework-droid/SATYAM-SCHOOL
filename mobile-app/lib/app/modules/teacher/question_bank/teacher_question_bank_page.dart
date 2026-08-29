import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/services/s3_upload_service.dart';
import '../../../../core/utils/teacher_classes.dart';
import '../../../../core/utils/document_compression.dart';

// Assignment / Exam Paper / Question Bank - three sections, one module, all
// backed by teacher_documents (see SUPABASE_TEACHER_DOCUMENTS.sql). Replaces
// the old question-by-question builder + auto-generated paper: teachers now
// just upload an already-prepared file per section instead of building
// questions inside the app.
const _kMaxDocBytes = 2 * 1024 * 1024; // 2 MB

class _Section {
  final String key;
  final String label;
  final String fieldLabel; // "Title" normally, "Exam Name" for Exam Paper
  final IconData icon;
  const _Section(this.key, this.label, this.fieldLabel, this.icon);
}

const _sections = [
  _Section('assignment', 'Assignment', 'Title', Icons.assignment_outlined),
  _Section('exam_paper', 'Exam Paper', 'Exam Name', Icons.description_outlined),
  _Section('question_bank', 'Question Bank', 'Title', Icons.menu_book_rounded),
];

class TeacherQuestionBankPage extends StatefulWidget {
  const TeacherQuestionBankPage({super.key});
  @override
  State<TeacherQuestionBankPage> createState() => _TeacherQuestionBankPageState();
}

class _TeacherQuestionBankPageState extends State<TeacherQuestionBankPage> {
  int _sectionIndex = 0;
  List<Map<String, dynamic>> _documents = [];
  bool _loading = true;

  String? get _employeeId => (AuthService.to.profile.value ?? {})['id'] as String?;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final employeeId = _employeeId;
    final docs = employeeId != null
        ? await SupabaseService.fetchTeacherDocuments(teacherId: employeeId, section: _sections[_sectionIndex].key)
        : <Map<String, dynamic>>[];
    if (mounted) setState(() { _documents = docs; _loading = false; });
  }

  Future<void> _openDocument(Map<String, dynamic> doc) async {
    final url = await S3UploadService.getS3ViewUrl(doc['file_key'] as String);
    if (url == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not open this document.'), behavior: SnackBarBehavior.floating));
      return;
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  Future<void> _confirmDelete(Map<String, dynamic> doc) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Document?'),
        content: Text('"${doc['title']}" will be removed. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: AppColors.red))),
        ],
      ),
    );
    if (confirm != true) return;
    await SupabaseService.deleteTeacherDocument(doc['id'] as String);
    _load();
  }

  String _formatSize(num? bytes) {
    if (bytes == null) return '';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  String _formatDate(String? iso) {
    final d = iso != null ? DateTime.tryParse(iso) : null;
    return d != null ? DateFormat('d MMM yyyy').format(d) : '';
  }

  @override
  Widget build(BuildContext context) {
    final section = _sections[_sectionIndex];
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Question Bank'),
      ),
      body: Column(children: [
        Container(
          color: AppColors.card,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(children: _sections.asMap().entries.map((e) {
            final active = e.key == _sectionIndex;
            return Expanded(child: GestureDetector(
              onTap: () { setState(() => _sectionIndex = e.key); _load(); },
              child: Container(
                margin: EdgeInsets.only(right: e.key == _sections.length - 1 ? 0 : 8),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: active ? AppColors.navy : AppColors.bg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: active ? AppColors.navy : AppColors.border),
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(e.value.icon, size: 18, color: active ? Colors.white : AppColors.textLight),
                  const SizedBox(height: 4),
                  Text(e.value.label, textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight)),
                ]),
              ),
            ));
          }).toList()),
        ),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _documents.isEmpty
                  ? _emptyState(section)
                  : RefreshIndicator(
                      color: AppColors.navy,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                        itemCount: _documents.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _documentCard(_documents[i]),
                      ),
                    ),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showUploadSheet,
        backgroundColor: AppColors.navy,
        icon: const Icon(Icons.upload_file_rounded, color: Colors.white),
        label: const Text('Upload', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _emptyState(_Section section) => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.indigoLight, shape: BoxShape.circle),
        child: Icon(section.icon, color: AppColors.indigo, size: 38),
      ),
      const SizedBox(height: 16),
      Text('No ${section.label} Documents Yet', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Tap "Upload" below to add one.', textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));

  Widget _documentCard(Map<String, dynamic> doc) => GestureDetector(
    onTap: () => _openDocument(doc),
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), boxShadow: AppShadows.card),
      child: Row(children: [
        Container(
          width: 42, height: 42,
          decoration: BoxDecoration(color: AppColors.indigoLight, borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.insert_drive_file_outlined, color: AppColors.indigo, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(doc['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
          const SizedBox(height: 3),
          Text('${doc['class']} · ${doc['subject']} · ${doc['academic_year']}',
            style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
          const SizedBox(height: 2),
          Text('${_formatSize(doc['file_size'] as num?)} · ${_formatDate(doc['created_at'] as String?)}',
            style: const TextStyle(fontSize: 11, color: AppColors.textHint)),
        ])),
        IconButton(
          icon: const Icon(Icons.delete_outline_rounded, color: AppColors.red, size: 20),
          onPressed: () => _confirmDelete(doc),
        ),
      ]),
    ),
  );

  Future<void> _showUploadSheet() async {
    final section = _sections[_sectionIndex];
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final teacherName = profile['name'] as String?;
    final titleCtrl = TextEditingController();

    String selectedClass = (profile['class_name'] as String?)?.isNotEmpty == true
        ? profile['class_name'] as String
        : allSchoolClasses.first;
    String? selectedSubject;

    final academicYears = await SupabaseService.fetchAcademicYearLabels();
    final currentYear = await SupabaseService.fetchCurrentAcademicYearLabel();
    String? selectedAcademicYear = currentYear ?? (academicYears.isNotEmpty ? academicYears.last : null);
    final classSubjects = (teacherName != null && currentYear != null)
        ? await SupabaseService.fetchTeacherSubjectsByClass(currentYear, teacherName)
        : <String, List<String>>{};

    PlatformFile? pickedFile;
    String? fileExt;
    bool picking = false;
    bool uploading = false;
    String? error;

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          final subjectOptions = classSubjects[selectedClass] ?? const <String>[];

          Future<void> pickFile() async {
            setS(() { error = null; picking = true; });
            try {
              final result = await FilePicker.pickFiles(
                type: FileType.custom, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], withData: true,
              );
              final files = result?.files ?? const [];
              if (files.isEmpty) { setS(() => picking = false); return; }
              setS(() { pickedFile = files.first; fileExt = files.first.extension; picking = false; });
            } catch (_) {
              setS(() { error = 'Could not read that file.'; picking = false; });
            }
          }

          Future<void> confirmUpload() async {
            if ((selectedSubject ?? '').trim().isEmpty) { setS(() => error = 'Please select a subject.'); return; }
            if (titleCtrl.text.trim().isEmpty) { setS(() => error = 'Please enter a ${section.fieldLabel.toLowerCase()}.'); return; }
            if (pickedFile == null) { setS(() => error = 'Please pick a file to upload.'); return; }
            if (employeeId == null || selectedAcademicYear == null) { setS(() => error = 'Session error - please sign in again.'); return; }

            setS(() { uploading = true; error = null; });
            try {
              final bytes = pickedFile!.bytes ?? (pickedFile!.path != null ? await File(pickedFile!.path!).readAsBytes() : null);
              if (bytes == null) throw Exception('Could not read the selected file.');
              final ext = (fileExt ?? 'pdf').toLowerCase();
              final compressed = await compressDocumentBytes(bytes, ext, maxBytes: _kMaxDocBytes);
              final key = 'question-bank/$employeeId/${section.key}/${DateTime.now().millisecondsSinceEpoch}.$ext';
              await S3UploadService.uploadToS3(compressed, key, pickedFile!.name);
              await SupabaseService.createTeacherDocument({
                'teacher_id': employeeId,
                'section': section.key,
                'academic_year': selectedAcademicYear,
                'class': selectedClass,
                'subject': selectedSubject,
                'title': titleCtrl.text.trim(),
                'file_key': key,
                'file_name': pickedFile!.name,
                'file_size': compressed.length,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              _load();
            } catch (e) {
              setS(() { error = 'Upload failed: $e'; uploading = false; });
            }
          }

          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.9),
              decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
              child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                          Row(children: [
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('Upload ${section.label}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.text)),
                              const Text('PDF or image, up to 2 MB - larger files are compressed automatically',
                                style: TextStyle(fontSize: 11.5, color: AppColors.textLight)),
                            ])),
                            IconButton(icon: const Icon(Icons.close_rounded, color: AppColors.textHint), onPressed: () => Navigator.pop(ctx)),
                          ]),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            value: selectedAcademicYear,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'Academic Year', isDense: true,
                              prefixIcon: Icon(Icons.calendar_month_rounded, color: AppColors.navy, size: 20)),
                            items: academicYears.map((y) => DropdownMenuItem(value: y, child: Text(y))).toList(),
                            onChanged: (v) => setS(() => selectedAcademicYear = v),
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            value: selectedClass,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'Class', isDense: true,
                              prefixIcon: Icon(Icons.class_outlined, color: AppColors.navy, size: 20)),
                            items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis))).toList(),
                            onChanged: (v) => setS(() { selectedClass = v!; selectedSubject = null; }),
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            value: selectedSubject,
                            isExpanded: true,
                            hint: const Text('Select', style: TextStyle(fontSize: 13)),
                            decoration: const InputDecoration(labelText: 'Subject', isDense: true,
                              prefixIcon: Icon(Icons.book_outlined, color: AppColors.navy, size: 20)),
                            items: subjectOptions.map((s) => DropdownMenuItem(value: s, child: Text(s, overflow: TextOverflow.ellipsis))).toList(),
                            onChanged: (v) => setS(() => selectedSubject = v),
                          ),
                          const SizedBox(height: 14),
                          TextField(
                            controller: titleCtrl,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: InputDecoration(labelText: section.fieldLabel,
                              prefixIcon: const Icon(Icons.edit_outlined, color: AppColors.navy, size: 20)),
                          ),
                          const SizedBox(height: 16),
                          GestureDetector(
                            onTap: picking ? null : pickFile,
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.blueLight,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.blue.withOpacity(.3)),
                              ),
                              child: Row(children: [
                                Icon(pickedFile != null ? Icons.check_circle_rounded : Icons.attach_file_rounded, color: AppColors.blue, size: 20),
                                const SizedBox(width: 10),
                                Expanded(child: Text(
                                  picking ? 'Reading file...' : (pickedFile?.name ?? 'Select PDF or Image'),
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.w700),
                                )),
                              ]),
                            ),
                          ),
                          if (error != null) ...[
                            const SizedBox(height: 10),
                            Text(error!, style: const TextStyle(color: AppColors.red, fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: uploading ? null : confirmUpload,
                            child: Container(
                              height: 52,
                              decoration: BoxDecoration(
                                gradient: AppColors.navyGradient,
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: [BoxShadow(color: AppColors.navy.withOpacity(.35), blurRadius: 16, offset: const Offset(0, 6))],
                              ),
                              child: Center(child: uploading
                                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : const Text('Upload', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins'))),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
          );
        },
      ),
    );
  }
}
