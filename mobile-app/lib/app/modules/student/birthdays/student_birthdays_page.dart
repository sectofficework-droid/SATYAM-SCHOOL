import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/supabase_service.dart';
import '../../../../common/widgets/birthdays_view.dart';

class StudentBirthdaysPage extends StatefulWidget {
  final bool embedded;
  const StudentBirthdaysPage({super.key, this.embedded = false});
  @override
  State<StudentBirthdaysPage> createState() => _StudentBirthdaysPageState();
}

class _StudentBirthdaysPageState extends State<StudentBirthdaysPage> {
  List<Map<String, dynamic>> _students = [];
  List<Map<String, dynamic>> _staff = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await SupabaseService.fetchAllBirthdays();
      if (!mounted) return;
      setState(() { _students = data['students']!; _staff = data['staff']!; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator(color: AppColors.navy));
    } else if (_error != null) {
      body = _errorState();
    } else {
      body = BirthdaysView(students: _students, staff: _staff);
    }

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Birthdays'),
      ),
      body: body,
    );
  }

  Widget _errorState() => Center(child: Padding(
    padding: const EdgeInsets.all(32),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 40),
      const SizedBox(height: 12),
      const Text('Couldn\'t load birthdays', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
      const SizedBox(height: 6),
      Text(_error ?? '', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: AppColors.textLight)),
      const SizedBox(height: 16),
      GestureDetector(
        onTap: _load,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(color: AppColors.navy, borderRadius: BorderRadius.circular(10)),
          child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
      ),
    ]),
  ));
}
