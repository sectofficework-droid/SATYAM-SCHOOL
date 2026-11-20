import 'package:flutter/material.dart';
import '../../../../common/widgets/rules_page.dart';

class StudentRulesPage extends StatelessWidget {
  final bool embedded;
  const StudentRulesPage({super.key, this.embedded = false});
  @override
  Widget build(BuildContext context) => RulesPage(subjectType: 'student', embedded: embedded);
}
