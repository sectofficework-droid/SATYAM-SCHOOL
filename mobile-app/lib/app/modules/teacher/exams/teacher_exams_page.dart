import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../marks/teacher_marks_page.dart';
import '../official_exams/teacher_official_exams_page.dart';

// Single "Exams & Marks" entry point, merging what used to be two separate
// modules: Monthly Test (freeform, subject-teacher-created — teacher_marks_page)
// and Main Exams (admin-managed First Unit Test/Half Yearly/Annual —
// teacher_official_exams_page). Both pages already support `embedded: true`
// to render just their body, so this wrapper just adds the tab switcher and
// reuses them unchanged. IndexedStack keeps each tab's state (selected exam,
// scroll position, etc.) alive when switching between them.
class TeacherExamsPage extends StatefulWidget {
  final bool embedded;
  const TeacherExamsPage({super.key, this.embedded = false});
  @override
  State<TeacherExamsPage> createState() => _TeacherExamsPageState();
}

class _TeacherExamsPageState extends State<TeacherExamsPage> {
  // 0 = Monthly Test, 1 = Main Exams
  int _tab = 0;

  // Lets this page see into (and step back) the embedded Main Exams page's
  // own class->subject->entry flow, since that page is always rendered
  // embedded here (its own Scaffold/back-button handling never runs) - see
  // TeacherOfficialExamsPageState's class comment for the full reasoning.
  final _officialExamsKey = GlobalKey<TeacherOfficialExamsPageState>();

  @override
  Widget build(BuildContext context) {
    final body = Column(children: [
      _buildTabBar(),
      Expanded(
        child: IndexedStack(
          index: _tab,
          children: [
            const TeacherMarksPage(embedded: true),
            TeacherOfficialExamsPage(key: _officialExamsKey, embedded: true),
          ],
        ),
      ),
    ]);

    if (widget.embedded) return body;

    // On the Main Exams tab, mid-flow (class/subject/entry/overview), the
    // system back gesture and the AppBar's default back button should step
    // back one screen inside that flow instead of popping this whole page
    // straight to wherever it was opened from. canPop only depends on _tab
    // (parent-owned, so this widget reliably rebuilds when it changes) -
    // the embedded page's own step is read fresh via the GlobalKey INSIDE
    // the handler below, not captured here at build time, since its
    // internal setState calls don't trigger a rebuild of this parent.
    return PopScope(
      canPop: _tab != 1,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        final officialExams = _officialExamsKey.currentState;
        if (officialExams == null || officialExams.isAtRoot) {
          Navigator.of(context).pop();
        } else {
          officialExams.goBack();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          flexibleSpace: Container(decoration: const BoxDecoration(gradient: AppColors.navyGradient)),
          title: const Text('Exams & Marks'),
        ),
        body: body,
      ),
    );
  }

  Widget _buildTabBar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.navy.withValues(alpha: .08), borderRadius: BorderRadius.circular(12)),
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
