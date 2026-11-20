import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Shared by teacher_syllabus_page.dart/student_syllabus_page.dart - both
// defined byte-identical copies of these two helpers (flagged as
// unaddressed duplication by the 2026-11 full-system audit).
Color syllabusStatusColor(String status) => switch (status) {
  'Completed'   => AppColors.green,
  'In Progress' => AppColors.amber,
  _             => AppColors.textHint,
};

Color syllabusStatusBg(String status) => switch (status) {
  'Completed'   => AppColors.greenLight,
  'In Progress' => AppColors.amberLight,
  _             => AppColors.border,
};
