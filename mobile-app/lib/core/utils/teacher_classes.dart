// Every class in the school, in natural (not alphabetical) order - matches
// the admin panel's CLASSES list. Any teacher can give homework or conduct
// an exam for any class, so this is the source of truth for those pickers,
// not profile['subject_mappings'] - most teachers never get a subject/class
// mapping configured in the admin panel at all, which made class selection
// look "restricted to my own class" for everyone except a class teacher.
const List<String> allSchoolClasses = [
  'JR.KG', 'SR.KG', 'Balvatika',
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
  '11th - Commerce', '12th - Commerce',
];

// Classes worth defaulting a teacher's picker to first: their own class (if
// they're a class teacher) plus anything in their subject mappings, if set.
// The full allSchoolClasses list is always offered too.
List<String> teacherClasses(Map profile) {
  final classes = <String>{};

  final className = profile['class_name'] as String?;
  if (className != null && className.isNotEmpty) classes.add(className);

  final mappings = profile['subject_mappings'];
  if (mappings is List) {
    for (final m in mappings) {
      if (m is Map && m['classes'] is List) {
        for (final c in (m['classes'] as List)) {
          if (c is String && c.isNotEmpty) classes.add(c);
        }
      }
    }
  }

  final list = classes.toList()..sort();
  return list;
}

// Every subject offered school-wide - matches the admin panel's timetable
// subject list (SUBJECTS_TT in settings/page.js). Used as the Question Bank's
// Subject dropdown since most teachers have no subject_mappings configured.
const List<String> schoolSubjects = [
  "Mathematics", "Science", "English", "Hindi", "Social Studies", "Computer",
  "Accountancy", "Economics", "Business Studies", "P.E.", "Drawing",
  "Sanskrit", "Gujarati", "EVS", "Odia", "Rhymes & Activity", "Dance / Yoga",
  "Activity & Play", "Free Period",
];

// Subjects a teacher has mapped to a specific class, from subject_mappings.
List<String> teacherSubjectsForClass(Map profile, String className) {
  final subjects = <String>{};
  final mappings = profile['subject_mappings'];
  if (mappings is List) {
    for (final m in mappings) {
      if (m is Map && m['classes'] is List && (m['classes'] as List).contains(className)) {
        final s = m['subject'];
        if (s is String && s.isNotEmpty) subjects.add(s);
      }
    }
  }
  return subjects.toList()..sort();
}
