import 'package:flutter/material.dart';
import '../../../../common/widgets/query_page.dart';

class TeacherQueryPage extends StatelessWidget {
  final bool embedded;
  const TeacherQueryPage({super.key, this.embedded = false});
  @override
  Widget build(BuildContext context) => QueryPage(subjectType: 'teacher', embedded: embedded);
}
