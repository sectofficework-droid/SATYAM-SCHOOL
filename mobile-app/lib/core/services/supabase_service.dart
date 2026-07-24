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

  // Just the day's statuses for a class - used to show a real "X% present
  // today" stat on the teacher dashboard instead of a static call-to-action.
  static Future<List<Map<String, dynamic>>> fetchAttendanceForClassDate(String className, String date) async {
    final res = await client.from('student_attendance').select('status').eq('class', className).eq('date', date);
    return List<Map<String, dynamic>>.from(res);
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

  // Returns homework in any of classNames UNION homework created by
  // createdBy (merged client-side, same reasoning as fetchExams below) - so
  // a class teacher sees every homework given to their own class (by any
  // teacher) plus anything they personally assigned elsewhere, while a
  // subject teacher with no class of their own just sees what they gave.
  // className stays for backward compatibility with callers that only need
  // a single class with no creator filter (e.g. a student's own class).
  static Future<List<Map<String, dynamic>>> fetchHomework({String? className, List<String>? classNames, String? createdBy}) async {
    if (classNames != null && classNames.isNotEmpty) {
      final byClass = await client.from('homework').select().inFilter('class', classNames);
      final merged  = List<Map<String, dynamic>>.from(byClass);
      if (createdBy != null) {
        final byCreator = await client.from('homework').select().eq('created_by', createdBy);
        final seenIds    = merged.map((h) => h['id']).toSet();
        for (final h in List<Map<String, dynamic>>.from(byCreator)) {
          if (!seenIds.contains(h['id'])) merged.add(h);
        }
      }
      merged.sort((a, b) => ('${a['due_date'] ?? ''}').compareTo('${b['due_date'] ?? ''}'));
      return merged;
    }
    var query = client.from('homework').select();
    if (className != null) query = query.eq('class', className);
    if (createdBy != null) query = query.eq('created_by', createdBy);
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

  // Which of these exam ids already have at least one mark entered - used to
  // count "pending" exams (held, but marks not started) on the dashboard.
  static Future<Set<String>> fetchExamIdsWithMarks(List<String> examIds) async {
    if (examIds.isEmpty) return {};
    final res = await client.from('exam_marks').select('exam_id').inFilter('exam_id', examIds);
    return List<Map<String, dynamic>>.from(res).map((r) => r['exam_id'].toString()).toSet();
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

  // Teacher settings ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> updateTeacherProfile({
    required String employeeId, required String name, required String phone, required String email,
  }) async {
    final res = await client.rpc('teacher_update_profile', params: {
      'p_employee_id': employeeId, 'p_name': name, 'p_phone': phone, 'p_email': email,
    });
    return res == null ? null : Map<String, dynamic>.from(res as Map);
  }

  // Returns false when p_old_password didn't match - callers should surface
  // that as a wrong-password error, not a generic failure.
  static Future<bool> changeTeacherPassword({
    required String employeeId, required String oldPassword, required String newPassword,
  }) async {
    final res = await client.rpc('teacher_change_password', params: {
      'p_employee_id': employeeId, 'p_old_password': oldPassword, 'p_new_password': newPassword,
    });
    return res == true;
  }

  // Verify-only check used before revealing the new-password fields in the
  // Change Password flow - doesn't touch app_password.
  static Future<bool> verifyTeacherPassword({
    required String employeeId, required String password,
  }) async {
    final res = await client.rpc('teacher_verify_password', params: {
      'p_employee_id': employeeId, 'p_password': password,
    });
    return res == true;
  }

  // Question Bank ─────────────────────────────────────────────────────────────
  // Private per teacher (query always filters by teacher_id) - see
  // SUPABASE_QUESTION_BANK.sql for why this isn't enforced via RLS.

  static Future<List<Map<String, dynamic>>> fetchQuestions({
    required String teacherId, required String className, required String subject, String? chapter,
  }) async {
    var query = client.from('question_bank').select()
        .eq('teacher_id', teacherId)
        .eq('class', className)
        .eq('subject', subject);
    if (chapter != null && chapter.isNotEmpty) query = query.eq('chapter', chapter);
    final res = await query.order('created_at');
    return List<Map<String, dynamic>>.from(res);
  }

  // Distinct chapter names this teacher has already used for a class+subject,
  // so the chapter picker can suggest existing ones instead of always
  // retyping (and risking inconsistent spelling that would split one chapter
  // into two).
  static Future<List<String>> fetchQuestionChapters({
    required String teacherId, required String className, required String subject,
  }) async {
    final res = await client.from('question_bank').select('chapter')
        .eq('teacher_id', teacherId)
        .eq('class', className)
        .eq('subject', subject);
    final chapters = List<Map<String, dynamic>>.from(res).map((r) => r['chapter'] as String).toSet().toList();
    chapters.sort();
    return chapters;
  }

  static Future<void> createQuestion(Map<String, dynamic> data) async {
    await client.from('question_bank').insert(data);
  }

  static Future<void> updateQuestion(String id, Map<String, dynamic> data) async {
    await client.from('question_bank').update(data).eq('id', id);
  }

  static Future<void> deleteQuestion(String id) async {
    await client.from('question_bank').delete().eq('id', id);
  }

  // Multi-chapter question fetch, used when picking questions for a paper
  // (a paper can pull from more than one chapter at once).
  static Future<List<Map<String, dynamic>>> fetchQuestionsForChapters({
    required String teacherId, required String className, required String subject, required List<String> chapters,
  }) async {
    if (chapters.isEmpty) return [];
    final res = await client.from('question_bank').select()
        .eq('teacher_id', teacherId)
        .eq('class', className)
        .eq('subject', subject)
        .inFilter('chapter', chapters)
        .order('created_at');
    return List<Map<String, dynamic>>.from(res);
  }

  // Question Papers (Exam / Assignment) ─────────────────────────────────────
  static Future<Map<String, dynamic>> createQuestionPaper(Map<String, dynamic> data) async {
    final res = await client.from('question_papers').insert(data).select().single();
    return Map<String, dynamic>.from(res);
  }

  static Future<void> saveQuestionPaperItems(String paperId, List<String> questionIds) async {
    if (questionIds.isEmpty) return;
    final items = List.generate(questionIds.length, (i) => {
      'paper_id': paperId, 'question_id': questionIds[i], 'order_index': i,
    });
    await client.from('question_paper_items').insert(items);
  }
}
