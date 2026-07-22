import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/s3_image.dart';

class TeacherStudentsPage extends StatefulWidget {
  const TeacherStudentsPage({super.key});
  @override
  State<TeacherStudentsPage> createState() => _TeacherStudentsPageState();
}

class _TeacherStudentsPageState extends State<TeacherStudentsPage> {
  List<Map<String, dynamic>> _students = [];
  String _query = '';
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final profile   = AuthService.to.profile.value ?? {};
    final sectionId = profile['class_teacher_of_section_id']?.toString() ?? '';
    if (sectionId.isEmpty) { if (mounted) setState(() => _loading = false); return; }
    final students = await SupabaseService.fetchClassStudentDetails(sectionId);
    if (mounted) setState(() { _students = students; _loading = false; });
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.trim().isEmpty) return _students;
    final q = _query.trim().toLowerCase();
    return _students.where((s) {
      final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.toLowerCase();
      final grno = '${s['grno'] ?? ''}'.toLowerCase();
      final roll = '${s['roll_no'] ?? ''}'.toLowerCase();
      return name.contains(q) || grno.contains(q) || roll.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final profile     = AuthService.to.profile.value ?? {};
    final className   = profile['class_name'] as String? ?? '';
    final sectionName = profile['section_name'] as String? ?? '';
    final classLabel  = sectionName.isEmpty ? className : '$className - $sectionName';

    Widget body;
    if (_loading) {
      body = _buildShimmer();
    } else if (_students.isEmpty) {
      body = _emptyState();
    } else {
      final list = _filtered;
      body = Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Search by name, roll no. or GR no.',
              prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textHint, size: 20),
              filled: true,
              fillColor: AppColors.card,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
        ),
        Expanded(
          child: list.isEmpty
            ? Center(child: Text('No students match "$_query"',
                style: const TextStyle(color: AppColors.textLight, fontSize: 13)))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _StudentRow(student: list[i], index: i),
              ),
        ),
      ]);
    }

    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: Text(classLabel.isEmpty ? 'My Students' : 'My Students · $classLabel'),
      ),
      body: body,
    );
  }

  Widget _buildShimmer() => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 8,
    separatorBuilder: (_, __) => const SizedBox(height: 8),
    itemBuilder: (_, __) => Shimmer.fromColors(
      baseColor: const Color(0xFFE2E8F0),
      highlightColor: const Color(0xFFF8FAFC),
      child: Container(height: 68, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
    ),
  );

  Widget _emptyState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 80, height: 80,
        decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
        child: const Icon(Icons.groups_rounded, color: AppColors.navy, size: 38),
      ),
      const SizedBox(height: 16),
      const Text('No Class Assigned', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
      const SizedBox(height: 8),
      const Text('Ask admin to assign a class to your profile.',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
    ]),
  ));
}

class _StudentRow extends StatelessWidget {
  final Map<String, dynamic> student;
  final int index;
  const _StudentRow({required this.student, required this.index});

  @override
  Widget build(BuildContext context) {
    final name = '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}'.trim();

    return GestureDetector(
      onTap: () => _openDetails(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          boxShadow: AppShadows.card,
          border: Border.all(color: AppColors.border),
        ),
        child: Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: S3Image(
              s3Key: student['photo_url'] as String?,
              width: 44, height: 44, fit: BoxFit.cover,
              fallback: (_) => _initialsAvatar(name),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name.isEmpty ? '—' : name,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
            Text('GR: ${student['grno'] ?? '—'}  ·  Roll: ${student['roll_no'] ?? '—'}',
              style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
          ])),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textHint),
        ]),
      ),
    );
  }

  Widget _initialsAvatar(String name) {
    final parts    = name.trim().split(' ');
    final initials = parts.length >= 2
        ? '${parts[0][0]}${parts[1][0]}'.toUpperCase()
        : name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Container(
      width: 44, height: 44,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.navy, AppColors.navyMid],
          begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Center(child: Text(initials,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15))),
    );
  }

  void _openDetails(BuildContext context) {
    final name = '${student['first_name'] ?? ''} ${student['last_name'] ?? ''}'.trim();
    final address = [
      student['room_plot_no'], student['society'], student['landmark'],
      student['area'], student['address'],
    ].where((v) => v != null && v.toString().trim().isNotEmpty).join(', ');
    final pincode = student['pincode']?.toString() ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.92,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => Container(
          decoration: const BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.all(20),
            children: [
              Center(child: Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(4)),
              )),
              const SizedBox(height: 16),
              Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: S3Image(
                    s3Key: student['photo_url'] as String?,
                    width: 60, height: 60, fit: BoxFit.cover,
                    fallback: (_) => _initialsAvatar(name),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name.isEmpty ? '—' : name,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
                  const SizedBox(height: 2),
                  Text('GR No: ${student['grno'] ?? '—'}',
                    style: const TextStyle(color: AppColors.textLight, fontSize: 12)),
                ])),
              ]),
              const SizedBox(height: 20),
              _section('Student Details', [
                _row('Enrollment No.', student['enrollment_no']?.toString() ?? '—'),
                _row('Roll No.',       student['roll_no']?.toString() ?? '—'),
                _row('Date of Birth',  student['dob']?.toString() ?? '—'),
                _row('Gender',         student['gender']?.toString() ?? '—'),
              ]),
              const SizedBox(height: 12),
              _section('Parent / Contact', [
                _row("Father's Name", student['father_name']?.toString() ?? '—'),
                _row("Mother's Name", student['mother_name']?.toString() ?? '—'),
                _row('Mobile 1',      student['mobile1']?.toString() ?? '—'),
                _row('Mobile 2',      student['mobile2']?.toString() ?? '—'),
              ]),
              const SizedBox(height: 12),
              _section('Address', [
                _row('Address', address.isEmpty ? '—' : address),
                _row('Pincode', pincode.isEmpty ? '—' : pincode),
              ]),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> rows) => Container(
    decoration: BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Text(title, style: const TextStyle(
            fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.navy))),
        const Divider(height: 1),
        ...rows,
      ],
    ),
  );

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(width: 120, child: Text(label,
          style: const TextStyle(color: AppColors.textLight, fontSize: 12))),
        Expanded(child: Text(value,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: AppColors.text))),
      ],
    ),
  );
}
