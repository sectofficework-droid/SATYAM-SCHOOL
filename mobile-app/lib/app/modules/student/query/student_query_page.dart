import 'package:flutter/material.dart';
import '../../../../common/widgets/query_page.dart';

class StudentQueryPage extends StatelessWidget {
  final bool embedded;
  const StudentQueryPage({super.key, this.embedded = false});
  @override
  Widget build(BuildContext context) => QueryPage(subjectType: 'student', embedded: embedded);
}
