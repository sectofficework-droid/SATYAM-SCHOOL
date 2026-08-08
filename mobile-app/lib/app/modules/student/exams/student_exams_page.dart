import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../marks/student_marks_page.dart';
import '../official_results/student_official_results_page.dart';

// Single "Exams & Marks" entry point, merging what used to be two separate
// modules: Monthly Test (freeform, subject-teacher-created — student_marks_page)
// and Main Exams (admin-managed First Unit Test/Half Yearly/Annual —
// student_official_results_page). Both pages already support `embedded: true`
// to render just their body, so this wrapper just adds the tab switcher and
// reuses them unchanged. IndexedStack keeps each tab's state alive when
// switching between them.
class StudentExamsPage extends StatefulWidget {
  final bool embedded;
  const StudentExamsPage({super.key, this.embedded = false});
  @override
  State<StudentExamsPage> createState() => _StudentExamsPageState();
}

class _StudentExamsPageState extends State<StudentExamsPage> {
  // 0 = Monthly Test, 1 = Main Exams
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final body = Column(children: [
      _buildTabBar(),
      Expanded(
        child: IndexedStack(
          index: _tab,
          children: const [
            StudentMarksPage(embedded: true),
            StudentOfficialResultsPage(embedded: true),
          ],
        ),
      ),
    ]);

    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
        title: const Text('Exams & Marks'),
      ),
      body: body,
    );
  }

  Widget _buildTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withOpacity(.08), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        Expanded(child: _tabButton('Monthly Test', 0)),
        Expanded(child: _tabButton('Main Exams', 1)),
      ]),
    ),
  );

  Widget _tabButton(String label, int index) {
    final active = _tab == index;
    return GestureDetector(
      onTap: () => setState(() => _tab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.navy : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          boxShadow: active ? AppShadows.card : null,
        ),
        child: Center(child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : AppColors.textLight))),
      ),
    );
  }
}
