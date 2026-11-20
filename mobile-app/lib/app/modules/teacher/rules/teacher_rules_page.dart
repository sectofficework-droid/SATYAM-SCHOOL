import 'package:flutter/material.dart';
import '../../../../common/widgets/rules_page.dart';

class TeacherRulesPage extends StatelessWidget {
  final bool embedded;
  const TeacherRulesPage({super.key, this.embedded = false});
  @override
  Widget build(BuildContext context) => RulesPage(subjectType: 'teacher', embedded: embedded);
}
