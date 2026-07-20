// Every class a teacher is associated with: the class they're the class
// teacher of (profile['class_name']) plus every class listed in any of
// their subject mappings (profile['subject_mappings'], shape
// [{subject, classes: [...]}], set in the admin panel's Employee form).
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
