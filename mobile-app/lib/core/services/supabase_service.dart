import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  // Attendance ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchClassStudents(String sectionId) async {
    final res = await client.rpc('get_class_students', params: {'p_section_id': sectionId});
    if (res == null) return [];
    return List<Map<String, dynamic>>.from(res as List);
  }

  // Same roster, plus personal-detail fields (DOB, gender, parents, contact,
  // address) for the "My Students" module - see SUPABASE_TEACHER_STUDENT_DETAILS.sql.
  static Future<List<Map<String, dynamic>>> fetchClassStudentDetails(String sectionId) async {
    final res = await client.rpc('get_class_students_details', params: {'p_section_id': sectionId});
    if (res == null) return [];
    return List<Map<String, dynamic>>.from(res as List);
  }

  static Future<void> saveAttendanceBatch(List<Map<String, dynamic>> records) async {
    // Records don't carry the row's own id (student_attendance.id), so an
    // upsert with no onConflict target would try to INSERT every row and
    // fail on the table's UNIQUE(student_id, date) constraint whenever a
    // teacher re-saves attendance already marked for that day.
    await client.from('student_attendance').upsert(records, onConflict: 'student_id,date');
  }

  static Future<List<Map<String, dynamic>>> fetchStudentAttendance(String studentId) async {
    final res = await client
        .from('student_attendance')
        .select()
        .eq('student_id', studentId)
        .order('date', ascending: false)
        .limit(90);
    return List<Map<String, dynamic>>.from(res);
  }

  // Homework ──────────────────────────────────────────────────────────────────

  // classNames takes precedence when provided (a teacher can teach more than
  // one class); className stays for backward compatibility with callers that
  // only need a single class (e.g. a student's own class).
  static Future<List<Map<String, dynamic>>> fetchHomework({String? className, List<String>? classNames}) async {
    var query = client.from('homework').select();
    if (classNames != null && classNames.isNotEmpty) {
      query = query.inFilter('class', classNames);
    } else if (className != null) {
      query = query.eq('class', className);
    }
    final res = await query.order('due_date');
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createHomework(Map<String, dynamic> data) async {
    await client.from('homework').insert(data);
  }

  // Exam marks ────────────────────────────────────────────────────────────────

  // Returns exams in any of classNames UNION exams created by createdBy, so a
  // subject teacher sees every class they teach, and a class teacher also
  // sees exams they personally conducted for other classes. Runs as two
  // simple queries merged client-side rather than one hand-built OR filter
  // string, since class names can contain spaces/hyphens (e.g. "11th -
  // Commerce") that would need careful escaping in a raw PostgREST filter.
  static Future<List<Map<String, dynamic>>> fetchExams({String? className, List<String>? classNames, String? createdBy}) async {
    if (classNames != null && classNames.isNotEmpty) {
      final byClass = await client.from('exams').select().inFilter('class', classNames);
      final merged  = List<Map<String, dynamic>>.from(byClass);
      if (createdBy != null) {
        final byCreator = await client.from('exams').select().eq('created_by', createdBy);
        final seenIds    = merged.map((e) => e['id']).toSet();
        for (final e in List<Map<String, dynamic>>.from(byCreator)) {
          if (!seenIds.contains(e['id'])) merged.add(e);
        }
      }
      merged.sort((a, b) => ('${b['date'] ?? ''}').compareTo('${a['date'] ?? ''}'));
      return merged;
    }
    var query = client.from('exams').select();
    if (className != null) query = query.eq('class', className);
    final res = await query.order('date', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createExam(Map<String, dynamic> data) async {
    await client.from('exams').insert(data);
  }

  static Future<List<Map<String, dynamic>>> fetchExamMarks(String examId) async {
    final res = await client
        .from('exam_marks')
        .select()
        .eq('exam_id', examId);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> saveMarksBatch(List<Map<String, dynamic>> records) async {
    await client.from('exam_marks').upsert(records);
  }

  // Same shape as fetchClassStudents, but looks a class up by name instead of
  // section_id — needed for a subject teacher entering marks/homework for a
  // class they aren't the class-teacher of (so they have no section_id).
  static Future<List<Map<String, dynamic>>> fetchClassStudentsByName(String className) async {
    final res = await client.rpc('get_class_students_by_name', params: {'p_class_name': className});
    if (res == null) return [];
    return List<Map<String, dynamic>>.from(res as List);
  }

  // Tasks ─────────────────────────────────────────────────────────────────────

  // task_assignees has a composite primary key (task_id, employee_id) - no
  // single id column - so rows are addressed by that pair, not a row id.
  static Future<List<Map<String, dynamic>>> fetchTeacherTasks(String employeeId) async {
    final res = await client
        .from('task_assignees')
        .select('task_id, status, task:tasks(*)')
        .eq('employee_id', employeeId);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> updateTaskAssigneeStatus(String taskId, String employeeId, String status) async {
    await client.from('task_assignees').update({
      'status': status,
      'status_updated_at': DateTime.now().toIso8601String(),
    }).eq('task_id', taskId).eq('employee_id', employeeId);
  }

  // Notices ───────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchNotices({String? audience, List<String>? audiences}) async {
    var query = client.from('notices').select();
    if (audiences != null && audiences.isNotEmpty) {
      query = query.inFilter('audience', audiences);
    } else if (audience != null) {
      query = query.eq('audience', audience);
    }
    final res = await query.order('created_at', ascending: false).limit(30);
    return List<Map<String, dynamic>>.from(res);
  }

  // Fees ──────────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> fetchFees(String studentId) async {
    final res = await client.rpc('get_student_fees', params: {'p_student_id': studentId});
    if (res == null) return {};
    return Map<String, dynamic>.from(res as Map);
  }
}
