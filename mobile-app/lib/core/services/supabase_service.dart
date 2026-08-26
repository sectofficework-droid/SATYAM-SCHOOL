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

  // Per-student statuses already submitted for a class+date - used to show
  // real prior marks (not a blank all-Present form) when a teacher reopens
  // a day they already marked.
  static Future<List<Map<String, dynamic>>> fetchAttendanceForClassDate(String className, String date) async {
    final res = await client.from('student_attendance').select('student_id, status').eq('class', className).eq('date', date);
    return List<Map<String, dynamic>>.from(res);
  }

  // Attendance edit-request workflow ─────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> fetchTeacherAlerts(String teacherId) async {
    final res = await client
        .from('teacher_alerts')
        .select()
        .eq('teacher_id', teacherId)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(res);
  }

  // Per-student equivalent of fetchTeacherAlerts above (student_alerts table -
  // SUPABASE_HASH_APP_PASSWORD.sql). Currently only populated by
  // admin_reset_student_password, but not tied to that specifically - any
  // future targeted admin->student message can use the same table/row shape.
  static Future<List<Map<String, dynamic>>> fetchStudentAlerts(String studentId) async {
    final res = await client
        .from('student_alerts')
        .select()
        .eq('student_id', studentId)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchMyEditRequests(String teacherId) async {
    final res = await client
        .from('attendance_edit_requests')
        .select()
        .eq('teacher_id', teacherId)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(res);
  }

  // App update check ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> fetchLatestAppVersion() async {
    final res = await client
        .from('app_versions')
        .select()
        .order('version_code', ascending: false)
        .limit(1);
    final rows = List<Map<String, dynamic>>.from(res);
    return rows.isEmpty ? null : rows.first;
  }

  static Future<void> submitAttendanceEditRequest({
    required String teacherId,
    required String className,
    String? sectionName,
    required String date,
    String? reason,
  }) async {
    await client.from('attendance_edit_requests').insert({
      'teacher_id': teacherId,
      'class_name': className,
      'section_name': sectionName,
      'date': date,
      'reason': reason,
    });
  }

  // No limit - the Yearly attendance view needs the whole academic year's
  // records, not just the most recent ones (a school year is well under a
  // thousand rows per student, so fetching all of it is cheap).
  static Future<List<Map<String, dynamic>>> fetchStudentAttendance(String studentId) async {
    final res = await client
        .from('student_attendance')
        .select()
        .eq('student_id', studentId)
        .order('date', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  // Staff leave + staff attendance ─────────────────────────────────────────
  // Same request/approve/reject shape as the attendance-edit-request
  // workflow above - approving a leave request (admin panel) auto-inserts
  // employee_attendance rows with status 'L' for every day in the range.

  static Future<void> submitLeaveRequest({
    required String employeeId,
    required String fromDate,
    required String toDate,
    required String reason,
  }) async {
    await client.from('leave_requests').insert({
      'employee_id': employeeId,
      'from_date': fromDate,
      'to_date': toDate,
      'reason': reason,
    });
  }

  static Future<List<Map<String, dynamic>>> fetchMyLeaveRequests(String employeeId) async {
    final res = await client
        .from('leave_requests')
        .select()
        .eq('employee_id', employeeId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  // No limit, same reasoning as fetchStudentAttendance above - the Yearly
  // attendance view needs the whole academic year's records.
  static Future<List<Map<String, dynamic>>> fetchEmployeeAttendance(String employeeId) async {
    final res = await client
        .from('employee_attendance')
        .select()
        .eq('employee_id', employeeId)
        .order('date', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  // Face-scan punch attendance ──────────────────────────────────────────────
  // face_embedding is a jsonb array of doubles (MobileFaceNet output) -
  // supabase_flutter already decodes jsonb into a plain List, no manual
  // jsonDecode needed.

  static Future<List<double>?> fetchFaceEmbedding(String employeeId) async {
    final res = await client
        .from('employees')
        .select('face_embedding')
        .eq('id', employeeId)
        .maybeSingle();
    final raw = res?['face_embedding'];
    if (raw is! List) return null;
    return raw.map((e) => (e as num).toDouble()).toList();
  }

  static Future<void> saveFaceEmbedding(String employeeId, List<double> embedding) async {
    await client.from('employees').update({
      'face_embedding': embedding,
      'face_enrolled_at': DateTime.now().toIso8601String(),
    }).eq('id', employeeId);
  }

  // Every enrolled staff member's reference embedding, for the kiosk's
  // 1-to-many "whose face is this" match - inactive staff are excluded so a
  // former employee's old enrollment can't still clock someone in.
  static Future<List<Map<String, dynamic>>> fetchAllFaceEmbeddings() async {
    final res = await client
        .from('employees')
        .select('id, name, face_embedding')
        .not('face_embedding', 'is', null)
        .neq('status', 'Inactive');
    return List<Map<String, dynamic>>.from(res).map((row) {
      final raw = row['face_embedding'];
      return {
        'id': row['id'],
        'name': row['name'],
        'embedding': raw is List ? raw.map((e) => (e as num).toDouble()).toList() : <double>[],
      };
    }).where((row) => (row['embedding'] as List).isNotEmpty).toList();
  }

  // Decides check-in vs check-out from today's existing row (if any) and
  // upserts only the field that changed - onConflict upsert only touches
  // columns present in the payload, so an already-set check_in_at survives
  // the check-out call untouched. Returns what happened so the punch screen
  // can show the right message.
  static Future<Map<String, dynamic>> recordFacePunch(String employeeId, String date) async {
    final existing = await client
        .from('employee_attendance')
        .select('check_in_at, check_out_at')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .maybeSingle();

    final now = DateTime.now();

    if (existing == null || existing['check_in_at'] == null) {
      await client.from('employee_attendance').upsert({
        'employee_id':  employeeId,
        'date':         date,
        'status':       'P',
        'check_in_at':  now.toIso8601String(),
        'punch_method': 'face',
      }, onConflict: 'employee_id,date');
      return {'action': 'check_in', 'time': now};
    }

    if (existing['check_out_at'] == null) {
      await client.from('employee_attendance').upsert({
        'employee_id':  employeeId,
        'date':         date,
        'status':       'P',
        'check_out_at': now.toIso8601String(),
        'punch_method': 'face',
      }, onConflict: 'employee_id,date');
      return {'action': 'check_out', 'time': now};
    }

    return {'action': 'already_done'};
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
    if (createdBy != null) query = query.eq('created_by', createdBy);
    final res = await query.order('date', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createExam(Map<String, dynamic> data) async {
    await client.from('exams').insert(data);
  }

  // Admin-configurable default full marks for a new Monthly Test (Settings →
  // Exams in the admin panel) - stored on the single-row school_profile
  // table, falls back to 25 if unset/unmigrated.
  static Future<int> fetchMonthlyTestMaxMarks() async {
    final res = await client.from('school_profile').select('monthly_test_max_marks').maybeSingle();
    return (res?['monthly_test_max_marks'] as num?)?.toInt() ?? 25;
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

  // Official Exams ────────────────────────────────────────────────────────────
  // Admin-managed exams (First Unit Test / Half Yearly / Annual, etc.) -
  // separate from the freeform exams/exam_marks above. Marks entry unlocks
  // once an exam's end_date has passed (checked app-side, no stored flag).

  static Future<List<Map<String, dynamic>>> fetchOfficialExams({String? academicYearId}) async {
    var query = client.from('official_exams').select();
    if (academicYearId != null) query = query.eq('academic_year_id', academicYearId);
    final res = await query.order('sort_order');
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<String>> fetchClassSubjects(String className) async {
    final res = await client
        .from('class_subjects')
        .select('subject_name')
        .eq('class_name', className)
        .order('sort_order');
    return List<Map<String, dynamic>>.from(res).map((r) => r['subject_name'] as String).toList();
  }

  static Future<double> fetchExamSubjectMaxMarks(String examId, String className, String subjectName) async {
    final res = await client
        .from('official_exam_subject_config')
        .select('max_marks')
        .eq('exam_id', examId)
        .eq('class_name', className)
        .eq('subject_name', subjectName)
        .maybeSingle();
    return (res?['max_marks'] as num?)?.toDouble() ?? 100;
  }

  // Bulk variant of the above - every subject's max marks for one exam+class
  // in a single query, used by the student results view (one exam spans
  // every subject, so fetching per-subject would be N+1).
  static Future<Map<String, double>> fetchExamSubjectConfigForClass(String examId, String className) async {
    final res = await client
        .from('official_exam_subject_config')
        .select('subject_name, max_marks')
        .eq('exam_id', examId)
        .eq('class_name', className);
    final map = <String, double>{};
    for (final row in List<Map<String, dynamic>>.from(res)) {
      map[row['subject_name'] as String] = (row['max_marks'] as num?)?.toDouble() ?? 100;
    }
    return map;
  }

  static Future<List<Map<String, dynamic>>> fetchOfficialExamMarks(String examId, String className, String subjectName) async {
    final res = await client
        .from('official_exam_marks')
        .select()
        .eq('exam_id', examId)
        .eq('class_name', className)
        .eq('subject_name', subjectName);
    return List<Map<String, dynamic>>.from(res);
  }

  // Class-teacher read-only "all subjects for my class" view.
  static Future<List<Map<String, dynamic>>> fetchOfficialExamMarksForClass(String examId, String className) async {
    final res = await client
        .from('official_exam_marks')
        .select()
        .eq('exam_id', examId)
        .eq('class_name', className);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> saveOfficialMarksBatch(List<Map<String, dynamic>> records) async {
    await client.from('official_exam_marks').upsert(records, onConflict: 'exam_id,student_id,subject_name');
  }

  // Syllabus ──────────────────────────────────────────────────────────────────

  // Same classNames-UNION-createdBy shape as fetchHomework/fetchExams above -
  // a class teacher sees every chapter added for their own class (by any
  // teacher) plus anything they personally added for other classes, while a
  // subject teacher with no class of their own just sees what they added.
  static Future<List<Map<String, dynamic>>> fetchSyllabus({String? className, List<String>? classNames, String? teacherId}) async {
    if (classNames != null && classNames.isNotEmpty) {
      final byClass = await client.from('syllabus').select().inFilter('class', classNames);
      final merged  = List<Map<String, dynamic>>.from(byClass);
      if (teacherId != null) {
        final byTeacher = await client.from('syllabus').select().eq('teacher_id', teacherId);
        final seenIds    = merged.map((s) => s['id']).toSet();
        for (final s in List<Map<String, dynamic>>.from(byTeacher)) {
          if (!seenIds.contains(s['id'])) merged.add(s);
        }
      }
      merged.sort((a, b) => (a['sort_order'] ?? 0).compareTo(b['sort_order'] ?? 0));
      return merged;
    }
    var query = client.from('syllabus').select();
    if (className != null) query = query.eq('class', className);
    if (teacherId != null) query = query.eq('teacher_id', teacherId);
    final res = await query.order('sort_order');
    return List<Map<String, dynamic>>.from(res);
  }

  // Bulk insert so a teacher can add a whole chapter list in one go instead
  // of one at a time - each row still gets its own id/status/progress.
  static Future<void> createSyllabusChapters(List<Map<String, dynamic>> rows) async {
    if (rows.isEmpty) return;
    await client.from('syllabus').insert(rows);
  }

  // Distinct chapter names already added to the syllabus for a class+subject
  // (by any teacher) - lets Question Bank offer the real curriculum chapter
  // list instead of generic "Chapter 1..12" placeholders.
  static Future<List<String>> fetchSyllabusChapterNames({
    required String className, required String subject,
  }) async {
    final res = await client.from('syllabus').select('chapter')
        .eq('class', className).eq('subject', subject);
    final chapters = List<Map<String, dynamic>>.from(res).map((r) => r['chapter'] as String).toSet().toList();
    chapters.sort();
    return chapters;
  }

  static Future<void> updateSyllabusStatus(String id, String status) async {
    await client.from('syllabus').update({
      'status': status,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  static Future<void> deleteSyllabusChapter(String id) async {
    await client.from('syllabus').delete().eq('id', id);
  }

  // Subtopics under a chapter - optional, own independent progress. A
  // chapter with subtopics has its own status derived app-side from these
  // instead of being cycled directly.
  static Future<List<Map<String, dynamic>>> fetchSubtopics(List<String> chapterIds) async {
    if (chapterIds.isEmpty) return [];
    final res = await client.from('syllabus_subtopics').select().inFilter('chapter_id', chapterIds).order('sort_order');
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> createSubtopics(List<Map<String, dynamic>> rows) async {
    if (rows.isEmpty) return;
    await client.from('syllabus_subtopics').insert(rows);
  }

  static Future<void> updateSubtopicStatus(String id, String status) async {
    await client.from('syllabus_subtopics').update({
      'status': status,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', id);
  }

  static Future<void> deleteSubtopic(String id) async {
    await client.from('syllabus_subtopics').delete().eq('id', id);
  }

  // Syllabus lock + edit-request workflow ──────────────────────────────────
  // Same idiom as the attendance edit-request workflow above: approving a
  // request sets approved_at, which opens a 24-hour edit window checked
  // app-side (now() - approved_at < 24h) - no separate "window open" flag.

  // Sets locked on every chapter row for this teacher+class+subject at once,
  // since they were all added/locked together as one syllabus.
  static Future<void> lockSyllabus({required String teacherId, required String className, required String subject}) async {
    await client.from('syllabus').update({
      'locked': true,
      'locked_at': DateTime.now().toIso8601String(),
    }).eq('teacher_id', teacherId).eq('class', className).eq('subject', subject);
  }

  static Future<void> submitSyllabusEditRequest({
    required String teacherId,
    required String className,
    required String subject,
    String? reason,
    String? requestedChanges,
  }) async {
    await client.from('syllabus_edit_requests').insert({
      'teacher_id': teacherId,
      'class_name': className,
      'subject_name': subject,
      'reason': reason,
      'requested_changes': requestedChanges,
    });
  }

  static Future<List<Map<String, dynamic>>> fetchMySyllabusEditRequests(String teacherId) async {
    final res = await client
        .from('syllabus_edit_requests')
        .select()
        .eq('teacher_id', teacherId)
        .order('created_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(res);
  }

  // Ends an approved edit window early ("Save & Lock") instead of waiting
  // the full 24 hours out.
  static Future<void> closeSyllabusEditWindow(String requestId) async {
    await client.from('syllabus_edit_requests').update({
      'closed_at': DateTime.now().toIso8601String(),
    }).eq('id', requestId);
  }

  // Birthdays ─────────────────────────────────────────────────────────────
  // Who has a birthday today, students and staff separately - via a
  // SECURITY DEFINER RPC (see SUPABASE_BIRTHDAYS.sql) rather than reading
  // students/employees directly, since those tables' RLS would otherwise
  // block seeing anyone but yourself and the RPC only returns non-sensitive
  // fields for the handful of people who actually match today.
  static Future<Map<String, List<Map<String, dynamic>>>> fetchTodaysBirthdays() async {
    final res = await client.rpc('get_todays_birthdays');
    if (res == null) return {'students': [], 'staff': []};
    final map = res as Map<String, dynamic>;
    return {
      'students': List<Map<String, dynamic>>.from(map['students'] as List? ?? const []),
      'staff':    List<Map<String, dynamic>>.from(map['staff'] as List? ?? const []),
    };
  }

  // Every student/staff birthday (not just today's) for the year-round
  // scrollable Birthdays list - see SUPABASE_ALL_BIRTHDAYS.sql.
  static Future<Map<String, List<Map<String, dynamic>>>> fetchAllBirthdays() async {
    final res = await client.rpc('get_all_birthdays');
    if (res == null) return {'students': [], 'staff': []};
    final map = res as Map<String, dynamic>;
    return {
      'students': List<Map<String, dynamic>>.from(map['students'] as List? ?? const []),
      'staff':    List<Map<String, dynamic>>.from(map['staff'] as List? ?? const []),
    };
  }

  // Timetable ─────────────────────────────────────────────────────────────
  // Read-only in both apps - entirely built by the admin panel's Settings →
  // Timetable (timetables: academic_year/day_group/slot_id/class_name/
  // subject/teacher, plus school_profile.period_defs for period timings).

  // The admin panel's Timetable grid stores 4 class names in a different
  // format than the rest of the app (settings/page.js's own CLASSES
  // constant, not the DB-canonical classes.name used everywhere else) -
  // same drift PROJECT_CONTEXT.md already flags for `activeClasses`.
  static const Map<String, String> _timetableClassNameOverrides = {
    'JR.KG': 'JR KG',
    'SR.KG': 'SR KG',
    '11th - Commerce': '11th Commerce',
    '12th - Commerce': '12th Commerce',
  };

  static Future<String?> fetchCurrentAcademicYearLabel() async {
    final res = await client.from('academic_years').select('label, is_current').order('label');
    final rows = List<Map<String, dynamic>>.from(res);
    if (rows.isEmpty) return null;
    final current = rows.where((r) => r['is_current'] == true).toList();
    return (current.isNotEmpty ? current.first : rows.last)['label'] as String?;
  }

  // Same school_profile.period_defs the admin panel's Timetable tab reads/
  // writes (Prayer/Period/Recess start-end times per day-group).
  static Future<Map<String, dynamic>?> fetchPeriodDefs() async {
    final res = await client.from('school_profile').select('period_defs').maybeSingle();
    return res?['period_defs'] as Map<String, dynamic>?;
  }

  // { groupName: [weekday, ...] } - which weekdays use which day group's
  // periods. Day groups are fully custom now (admin can add/rename/delete
  // them in Settings → Timetable), so this replaces what used to be a
  // hardcoded assumption in TimetableView (_weekdayToGroup) that the
  // group's own name told you the weekdays. Null if never customized -
  // callers fall back to the old hardcoded 3-group mapping in that case.
  static Future<Map<String, dynamic>?> fetchDayGroupWeekdays() async {
    final res = await client.from('school_profile').select('day_group_weekdays').maybeSingle();
    return res?['day_group_weekdays'] as Map<String, dynamic>?;
  }

  static Future<List<Map<String, dynamic>>> fetchTimetableForClass(String academicYear, String className) async {
    final ttClassName = _timetableClassNameOverrides[className] ?? className;
    final res = await client
        .from('timetables')
        .select()
        .eq('academic_year', academicYear)
        .eq('class_name', ttClassName);
    return List<Map<String, dynamic>>.from(res);
  }

  // teacherName must match employees.name exactly - the timetable grid
  // stores it as free text, not a teacher_id FK.
  static Future<List<Map<String, dynamic>>> fetchTimetableForTeacher(String academicYear, String teacherName) async {
    final res = await client
        .from('timetables')
        .select()
        .eq('academic_year', academicYear)
        .eq('teacher', teacherName);
    return List<Map<String, dynamic>>.from(res);
  }

  // Queries & Suggestions ────────────────────────────────────────────────────

  static Future<void> submitQuery(Map<String, dynamic> data) async {
    await client.from('queries_suggestions').insert(data);
  }

  static Future<List<Map<String, dynamic>>> fetchMyQueries(String userId) async {
    final res = await client
        .from('queries_suggestions')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(res);
  }

  // Help Desk (Student app) ────────────────────────────────────────────────────
  // Class teacher, supporting teacher(s), admin numbers, and principal — see
  // get_student_helpdesk_contacts in SUPABASE_HELPDESK.sql.
  static Future<Map<String, dynamic>> fetchHelpDeskContacts(String? sectionId) async {
    final res = await client.rpc('get_student_helpdesk_contacts', params: {'p_section_id': sectionId});
    if (res == null) return {};
    return Map<String, dynamic>.from(res as Map);
  }

  // School Rules & Regulations ───────────────────────────────────────────────
  // One row per audience ('teacher' or 'student'), edited from the admin
  // panel - the app just reads its own row.

  static Future<String> fetchSchoolRules(String audience) async {
    final res = await client.from('school_rules').select('content').eq('audience', audience).maybeSingle();
    return (res?['content'] as String?) ?? '';
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

  // Daily Tasks ───────────────────────────────────────────────────────────────
  // A recurring admin-defined staff checklist - separate from tasks/
  // task_assignees above (one-off, deadline-based). 'all' tasks apply to
  // every employee implicitly; 'specific' tasks only apply if
  // daily_task_targets has a row for this employee. Completion is a per
  // (task, employee, calendar date) row so it resets automatically each day.

  static Future<List<Map<String, dynamic>>> fetchDailyTasksForEmployee(String employeeId) async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final tasksRes = await client
        .from('daily_tasks')
        .select('id, title, description, target_type, daily_task_targets(employee_id)')
        .eq('active', true)
        .order('created_at');
    final completionsRes = await client
        .from('daily_task_completions')
        .select('daily_task_id, completed_at')
        .eq('employee_id', employeeId)
        .eq('completion_date', today);

    final completedAt = <String, String>{};
    for (final c in List<Map<String, dynamic>>.from(completionsRes)) {
      completedAt[c['daily_task_id'] as String] = c['completed_at'] as String;
    }

    final applicable = <Map<String, dynamic>>[];
    for (final t in List<Map<String, dynamic>>.from(tasksRes)) {
      final targetType = t['target_type'] as String;
      final targets = List<Map<String, dynamic>>.from(t['daily_task_targets'] as List? ?? []);
      final isTargeted = targets.any((x) => x['employee_id'] == employeeId);
      if (targetType == 'all' || isTargeted) {
        applicable.add({
          'id': t['id'],
          'title': t['title'],
          'description': t['description'],
          'completedAt': completedAt[t['id']],
        });
      }
    }
    return applicable;
  }

  static Future<void> markDailyTaskDone(String dailyTaskId, String employeeId) async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    await client.from('daily_task_completions').upsert({
      'daily_task_id': dailyTaskId,
      'employee_id': employeeId,
      'completion_date': today,
    }, onConflict: 'daily_task_id,employee_id,completion_date');
  }

  static Future<void> unmarkDailyTaskDone(String dailyTaskId, String employeeId) async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    await client
        .from('daily_task_completions')
        .delete()
        .eq('daily_task_id', dailyTaskId)
        .eq('employee_id', employeeId)
        .eq('completion_date', today);
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

  // School Calendar ──────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchCalendarEvents(DateTime rangeStart, DateTime rangeEnd) async {
    final res = await client.from('school_calendar_events').select()
        .gte('event_date', rangeStart.toIso8601String().split('T').first)
        .lte('event_date', rangeEnd.toIso8601String().split('T').first)
        .order('event_date');
    return List<Map<String, dynamic>>.from(res);
  }
}
