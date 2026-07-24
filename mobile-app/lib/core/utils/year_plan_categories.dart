import 'package:flutter/material.dart';

// Mirrors admin-panel/src/lib/yearPlanData.js's YEAR_PLAN_CATEGORIES - keep
// both in sync if categories ever change. This is the single source of
// truth for what shows on the teacher app's Calendar; there is no separate
// hardcoded national-holiday list here anymore, since Year Planning's
// "govt" category already carries the real, admin-maintained dates
// (including lunar festivals whose Gregorian date shifts every year).
class YearPlanCategory {
  final String key;
  final String label;
  final Color color;
  final IconData icon;
  const YearPlanCategory(this.key, this.label, this.color, this.icon);
}

const List<YearPlanCategory> yearPlanCategories = [
  YearPlanCategory('govt', 'Govt Holiday', Color(0xFFEF4444), Icons.flag_rounded),
  YearPlanCategory('function', 'Function', Color(0xFF8B5CF6), Icons.celebration_rounded),
  YearPlanCategory('celebration', 'Celebration', Color(0xFFF59E0B), Icons.auto_awesome_rounded),
  YearPlanCategory('ptm', 'PTM', Color(0xFF3B82F6), Icons.groups_rounded),
  YearPlanCategory('exam', 'Exam', Color(0xFFE11D48), Icons.edit_note_rounded),
  YearPlanCategory('holiday', 'Holiday', Color(0xFF0D9488), Icons.beach_access_rounded),
  YearPlanCategory('sunday', 'Sunday', Color(0xFFF97316), Icons.nightlight_round),
];

final Map<String, YearPlanCategory> yearPlanCategoryByKey = {
  for (final c in yearPlanCategories) c.key: c,
};

YearPlanCategory categoryFor(String? key) =>
    yearPlanCategoryByKey[key] ?? yearPlanCategories.last;
