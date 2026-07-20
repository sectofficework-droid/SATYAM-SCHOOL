import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Matches admin-panel's NOTICE_TYPES (admin-panel/src/app/(dashboard)/notice/page.js),
// plus "Exam" as its own category distinct from general "Academic" notices.
const List<String> noticeTypes = [
  'Academic', 'Exam', 'Event', 'Holiday', 'Fee', 'Circular', 'General', 'Urgent',
];

Color noticeTypeColor(String? type) {
  switch (type) {
    case 'Academic': return AppColors.blue;
    case 'Exam':     return AppColors.purple;
    case 'Event':    return AppColors.navy;
    case 'Holiday':  return AppColors.green;
    case 'Fee':      return AppColors.amber;
    case 'Circular': return AppColors.purple;
    case 'Urgent':   return AppColors.red;
    default:         return AppColors.textLight; // General / unset
  }
}

Color noticeTypeLight(String? type) {
  switch (type) {
    case 'Academic': return AppColors.blueLight;
    case 'Exam':     return AppColors.purpleLight;
    case 'Event':    return AppColors.blueLight;
    case 'Holiday':  return AppColors.greenLight;
    case 'Fee':      return AppColors.amberLight;
    case 'Circular': return AppColors.purpleLight;
    case 'Urgent':   return AppColors.redLight;
    default:         return AppColors.border;
  }
}
