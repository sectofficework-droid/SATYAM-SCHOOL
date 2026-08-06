import 'main_teacher.dart' as teacher_entry;

// This app now ships as two separate flavor builds - see main_teacher.dart
// and main_student.dart (built with `--flavor teacher`/`--flavor student`).
// This file only exists so a plain `flutter run` / `flutter build` with no
// explicit -t target still does something reasonable (defaults to Teacher)
// instead of failing to find an entry point.
Future<void> main() => teacher_entry.main();
