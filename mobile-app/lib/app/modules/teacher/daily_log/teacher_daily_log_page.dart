import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/auth_service.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../core/utils/teacher_classes.dart';

// REQ-FEAT-017 (2026-10-17) - user: "student weekly improvement -
// homework,classwork,attentiveness,diary (teacher will see their teaching
// subjects from any class they teaching then they click that class subject
// that class student list will load then they will click the dropdown of
// every student will load like: homework,classwork,attentiveness,diary
// which by default checked if any student didn't have done that it will be
// crossed by teacher)". Entry is per class-subject-period, per day - a
// "weekly" view is a 7-day rollup over this same daily data, built as a
// separate admin-panel report (no Student/Parent app view yet, per the
// user's own answer when asked). Any teacher may log any class/subject they
// teach - same "any class" picker as Marks/Homework (teacherClassSubjectPairs,
// lib/core/utils/teacher_classes.dart), not restricted to a class teacher's
// own homeroom.
class TeacherDailyLogPage extends StatefulWidget {
  const TeacherDailyLogPage({super.key});
  @override
  State<TeacherDailyLogPage> createState() => _TeacherDailyLogPageState();
}

class _TeacherDailyLogPageState extends State<TeacherDailyLogPage> {
  List<({String className, String subject})> _pairs = [];
  String? _className;
  String? _subject;
  DateTime _date = DateTime.now();

  List<Map<String, dynamic>> _students = [];
  // studentId -> {homework_done, classwork_done, attentive, diary_done}, all default true.
  final Map<String, Map<String, bool>> _state = {};
  final Set<String> _expanded = {};

  bool _loadingRoster = false;
  bool _saving = false;
  bool _saved = false;

  static const _items = [
    ('homework_done', 'Homework', Icons.assignment_rounded),
    ('classwork_done', 'Classwork', Icons.edit_note_rounded),
    ('attentive', 'Attentiveness', Icons.visibility_rounded),
    ('diary_done', 'Diary', Icons.menu_book_rounded),
  ];

  @override
  void initState() {
    super.initState();
    final profile = AuthService.to.profile.value ?? {};
    _pairs = teacherClassSubjectPairs(profile);
    if (_pairs.isNotEmpty) {
      _className = _pairs.first.className;
      _subject = _pairs.first.subject;
      _loadRoster();
    }
  }

  Map<String, bool> _defaultState() => {
    'homework_done': true, 'classwork_done': true, 'attentive': true, 'diary_done': true,
  };

  Future<void> _loadRoster() async {
    if (_className == null || _subject == null) return;
    setState(() { _loadingRoster = true; _students = []; _state.clear(); _expanded.clear(); });
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);

    final students = await SupabaseService.fetchClassStudentsByName(_className!);
    final existing = (employeeId != null && sessionToken != null)
        ? await SupabaseService.fetchStudentDailyLog(employeeId, sessionToken, _className!, _subject!, dateStr)
        : <Map<String, dynamic>>[];

    final byStudent = <String, Map<String, dynamic>>{};
    for (final r in existing) { byStudent[r['student_id'] as String] = r; }

    final state = <String, Map<String, bool>>{};
    for (final s in students) {
      final id = s['id'] as String;
      final row = byStudent[id];
      state[id] = row == null
          ? _defaultState()
          : {
              'homework_done': row['homework_done'] as bool? ?? true,
              'classwork_done': row['classwork_done'] as bool? ?? true,
              'attentive': row['attentive'] as bool? ?? true,
              'diary_done': row['diary_done'] as bool? ?? true,
            };
    }
    if (!mounted) return;
    setState(() { _students = students; _state.addAll(state); _loadingRoster = false; });
  }

  Future<void> _save() async {
    final profile = AuthService.to.profile.value ?? {};
    final employeeId = profile['id'] as String?;
    final sessionToken = AuthService.to.sessionToken;
    if (employeeId == null || sessionToken == null || _className == null || _subject == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Session error - please sign in again.'), backgroundColor: AppColors.red, behavior: SnackBarBehavior.floating));
      return;
    }
    setState(() => _saving = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_date);
    final records = _students.map((s) {
      final id = s['id'] as String;
      final st = _state[id] ?? _defaultState();
      return {'student_id': id, ...st};
    }).toList();
    try {
      await SupabaseService.saveStudentDailyLogBatch(
        employeeId: employeeId, sessionToken: sessionToken,
        className: _className!, subject: _subject!, date: dateStr, records: records,
      );
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to save: $e'), backgroundColor: AppColors.red, behavior: SnackBarBehavior.floating));
      }
      return;
    }
    if (mounted) {
      setState(() { _saving = false; _saved = true; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Row(children: [
          Icon(Icons.check_circle, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text('Saved!'),
        ]),
        backgroundColor: AppColors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ));
      Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => _saved = false); });
    }
  }

  int _doneCount(String studentId) {
    final st = _state[studentId] ?? _defaultState();
    return st.values.where((v) => v).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Daily Progress'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(children: [
        _buildPickerBar(),
        const Divider(height: 1, color: AppColors.border),
        Expanded(child: _buildBody()),
        if (_students.isNotEmpty) Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: _buildSaveButton(),
        ),
      ]),
    );
  }

  Widget _buildPickerBar() {
    final hasPairs = _pairs.isNotEmpty;
    return Container(
      color: AppColors.card,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(children: [
        Row(children: [
          Expanded(child: hasPairs
            ? DropdownButtonFormField<String>(
                initialValue: _className == null ? null : '$_className|$_subject',
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Class - Subject', border: OutlineInputBorder(), isDense: true),
                items: _pairs.map((p) => DropdownMenuItem(
                  value: '${p.className}|${p.subject}',
                  child: Text('${p.className} - ${p.subject}', overflow: TextOverflow.ellipsis),
                )).toList(),
                onChanged: (v) {
                  if (v == null) return;
                  final parts = v.split('|');
                  setState(() { _className = parts[0]; _subject = parts[1]; });
                  _loadRoster();
                },
              )
            : DropdownButtonFormField<String>(
                initialValue: _className,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Class', border: OutlineInputBorder(), isDense: true),
                items: allSchoolClasses.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (v) { setState(() => _className = v); if (_subject != null) _loadRoster(); },
              )),
          const SizedBox(width: 10),
          if (!hasPairs) Expanded(child: DropdownButtonFormField<String>(
            initialValue: _subject,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Subject', border: OutlineInputBorder(), isDense: true),
            items: schoolSubjects.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) { setState(() => _subject = v); if (_className != null) _loadRoster(); },
          )),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: AppColors.blueLight, borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.calendar_month_rounded, color: AppColors.navy, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(DateFormat('EEEE, d MMMM yyyy').format(_date),
            style: const TextStyle(fontSize: 13, color: AppColors.text, fontWeight: FontWeight.w700))),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context, initialDate: _date,
                firstDate: DateTime.now().subtract(const Duration(days: 60)), lastDate: DateTime.now(),
              );
              if (picked != null && mounted) {
                setState(() => _date = picked);
                await _loadRoster();
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(gradient: AppColors.navyGradient, borderRadius: BorderRadius.circular(10)),
              child: const Text('Change', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _buildBody() {
    if (_className == null || _subject == null) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(color: AppColors.blueLight, shape: BoxShape.circle),
            child: const Icon(Icons.groups_rounded, color: AppColors.navy, size: 38),
          ),
          const SizedBox(height: 16),
          const Text('Pick a Class and Subject', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
          const SizedBox(height: 8),
          const Text('Choose a class-subject you teach above to load its students.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppColors.textLight, height: 1.5)),
        ]),
      ));
    }
    if (_loadingRoster) {
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: 8,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Shimmer.fromColors(
          baseColor: const Color(0xFFE2E8F0),
          highlightColor: const Color(0xFFF8FAFC),
          child: Container(height: 60, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14))),
        ),
      );
    }
    if (_students.isEmpty) {
      return Center(child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: const BoxDecoration(color: AppColors.amberLight, shape: BoxShape.circle),
            child: const Icon(Icons.groups_rounded, color: AppColors.amber, size: 38),
          ),
          const SizedBox(height: 16),
          const Text('No Students Found', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.text)),
        ]),
      ));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      itemCount: _students.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final s = _students[i];
        final id = s['id'] as String;
        final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
        final done = _doneCount(id);
        final allDone = done == _items.length;
        final expanded = _expanded.contains(id);
        final st = _state[id] ?? _defaultState();

        return Container(
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppShadows.card,
            border: Border.all(color: allDone ? AppColors.green.withValues(alpha: .15) : AppColors.red.withValues(alpha: .2)),
          ),
          child: Column(children: [
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => setState(() => expanded ? _expanded.remove(id) : _expanded.add(id)),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppColors.navy, AppColors.navyMid],
                        begin: Alignment.topLeft, end: Alignment.bottomRight),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(child: Text('${i + 1}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name.isNotEmpty ? name : '—',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.text)),
                    Text('Roll: ${s['roll_no'] ?? ''}',
                      style: const TextStyle(color: AppColors.textLight, fontSize: 11)),
                  ])),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: (allDone ? AppColors.green : AppColors.red).withValues(alpha: .1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text('$done/${_items.length}',
                      style: TextStyle(color: allDone ? AppColors.green : AppColors.red, fontWeight: FontWeight.w700, fontSize: 12)),
                  ),
                  Icon(expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: AppColors.textLight),
                ]),
              ),
            ),
            if (expanded) Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 10, 8),
              child: Column(children: _items.map((item) {
                final (key, label, icon) = item;
                final value = st[key] ?? true;
                return SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  secondary: Icon(icon, size: 18, color: value ? AppColors.green : AppColors.red),
                  title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text(value ? 'Done' : 'Not done',
                    style: TextStyle(fontSize: 11, color: value ? AppColors.green : AppColors.red, fontWeight: FontWeight.w600)),
                  value: value,
                  activeThumbColor: AppColors.green,
                  onChanged: (v) => setState(() => _state[id] = {...st, key: v}),
                );
              }).toList()),
            ),
          ]),
        );
      },
    );
  }

  Widget _buildSaveButton() => GestureDetector(
    onTap: _saving ? null : _save,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 52,
      decoration: BoxDecoration(
        gradient: _saving ? null : (_saved
          ? const LinearGradient(colors: [AppColors.green, Color(0xFF059669)])
          : AppColors.navyGradient),
        color: _saving ? AppColors.textHint : null,
        borderRadius: BorderRadius.circular(14),
        boxShadow: _saving ? [] : [
          BoxShadow(color: (_saved ? AppColors.green : AppColors.navy).withValues(alpha: .35), blurRadius: 16, offset: const Offset(0, 6)),
        ],
      ),
      child: Center(child: _saving
        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
        : Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(_saved ? Icons.check_rounded : Icons.save_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            Text(_saved ? 'Saved!' : 'Save',
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, fontFamily: 'Poppins')),
          ])),
    ),
  );
}
