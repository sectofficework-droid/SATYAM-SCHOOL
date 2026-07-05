import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;
  static GoTrueClient   get auth   => client.auth;

  // Auth helpers ─────────────────────────────────────────────────────────────

  /// Teachers sign in with Employee ID; email is constructed internally.
  static Future<AuthResponse> signInTeacher(String empId, String password) {
    final email = 'T${empId.trim().toUpperCase()}@satyam.local';
    return auth.signInWithPassword(email: email, password: password);
  }

  /// Students sign in with Enrollment No; email is constructed internally.
  static Future<AuthResponse> signInStudent(String enrollNo, String password) {
    final email = 'S${enrollNo.trim().toUpperCase()}@satyam.local';
    return auth.signInWithPassword(email: email, password: password);
  }

  static Future<void> signOut() => auth.signOut();

  static User? get currentUser => auth.currentUser;

  // Profile helpers ───────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> fetchTeacherProfile(String userId) async {
    final res = await client
        .from('employees')
        .select('*, employee_category(*)')
        .eq('app_user_id', userId)
        .maybeSingle();
    return res;
  }

  static Future<Map<String, dynamic>?> fetchStudentProfile(String userId) async {
    final res = await client
        .from('students')
        .select('*')
        .eq('app_user_id', userId)
        .maybeSingle();
    return res;
  }

  // Attendance ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchClassStudents(String className) async {
    final res = await client
        .from('students')
        .select('id, full_name, enrollment_no, photo_url')
        .eq('class', className)
        .order('full_name');
    return List<Map<String, dynamic>>.from(res);
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
    var query = client.from('homework').select().order('due_date');
    if (className != null) query = query.eq('class', className);
    final res = await query;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createHomework(Map<String, dynamic> data) async {
    await client.from('homework').insert(data);
  }

  // Exam marks ────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchExams({String? className}) async {
    var query = client.from('exams').select().order('date', ascending: false);
    if (className != null) query = query.eq('class', className);
    final res = await query;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchExamMarks(String examId) async {
    final res = await client
        .from('exam_marks')
        .select('*, students(full_name, enrollment_no)')
        .eq('exam_id', examId);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> saveMarksBatch(List<Map<String, dynamic>> records) async {
    await client.from('exam_marks').upsert(records);
  }

  // Notices ───────────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchNotices({String? audience}) async {
    var query = client.from('notices').select().order('created_at', ascending: false).limit(30);
    if (audience != null) query = query.eq('audience', audience);
    final res = await query;
    return List<Map<String, dynamic>>.from(res);
  }

  // Fees (student) ────────────────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchFees(String studentId) async {
    final res = await client
        .from('fees')
        .select()
        .eq('student_id', studentId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }
}
