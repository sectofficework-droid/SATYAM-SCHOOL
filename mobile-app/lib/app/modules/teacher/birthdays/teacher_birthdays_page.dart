import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/birthdays_view.dart';

class TeacherBirthdaysPage extends StatefulWidget {
  final bool embedded;
  const TeacherBirthdaysPage({super.key, this.embedded = false});
  @override
  State<TeacherBirthdaysPage> createState() => _TeacherBirthdaysPageState();
}

class _TeacherBirthdaysPageState extends State<TeacherBirthdaysPage> {
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _staff = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final data = await SupabaseService.fetchTodaysBirthdays();
    if (mounted) setState(() { _students = data['students']!; _staff = data['staff']!; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final body = _loading
        ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
        : BirthdaysView(students: _students, staff: _staff);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Birthdays Today'),
      ),
      body: body,
    );
  }
}
