import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  // Attendance ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchClassStudents(String className) async {
    final res = await client.rpc('get_class_students', params: {'p_class': className});
    if (res == null) return [];
    return List<Map<String, dynamic>>.from(res as List);
  }

  static Future<void> saveAttendanceBatch(List<Map<String, dynamic>> records) async {
    await client.from('student_attendance').upsert(records);
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

  static Future<List<Map<String, dynamic>>> fetchHomework({String? className}) async {
    var query = client.from('homework').select();
    if (className != null) query = query.eq('class', className);
    final res = await query.order('due_date');
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createHomework(Map<String, dynamic> data) async {
    await client.from('homework').insert(data);
  }

  // Exam marks ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchExams({String? className}) async {
    var query = client.from('exams').select();
    if (className != null) query = query.eq('class', className);
    final res = await query.order('date', ascending: false);
    return List<Map<String, dynamic>>.from(res);
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

  // Notices ───────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchNotices({String? audience}) async {
    var query = client.from('notices').select();
    if (audience != null) query = query.eq('audience', audience);
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
