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

  // REQ-SEC-002 Category 3 Group B (2026-09-22): student_attendance moved
  // from direct anon table access to session-token-gated RPCs, is_teacher_
  // of_class-checked server-side (no "any class" feature exists here,
  // unlike exams/homework/syllabus below - strictly the teacher's own
  // assigned class). records: [{student_id, status}] - date/class/marked_by
  // are no longer per-record, they're shared params the RPC applies to the
  // whole batch (matches how this screen always builds them anyway).
  static Future<void> saveAttendanceBatch({
    required String className,
    required String sessionToken,
    required String date,
    required String employeeId,
    required List<Map<String, dynamic>> records,
  }) async {
    await client.rpc('save_attendance_batch', params: {
      'p_employee_id': employeeId,
      'p_session_token': sessionToken,
      'p_class_name': className,
      'p_date': date,
      'p_records': records.map((r) => {'student_id': r['student_id'], 'status': r['status']}).toList(),
    });
  }

  // Per-student statuses already submitted for a class+date - used to show
  // real prior marks (not a blank all-Present form) when a teacher reopens
  // a day they already marked.
  static Future<List<Map<String, dynamic>>> fetchAttendanceForClassDate(String employeeId, String sessionToken, String className, String date) async {
    final res = await client.rpc('fetch_attendance_for_class_date', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': className, 'p_date': date,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Attendance edit-request workflow ─────────────────────────────────────────

  // REQ-SEC-002 Category 3 Group A (2026-09-19): these 9 tables moved from
  // direct anon table access to session-token-gated RPCs - every method
  // below now takes a sessionToken (AuthService.to.sessionToken at the
  // call site) alongside the id it always took.
  static Future<List<Map<String, dynamic>>> fetchTeacherAlerts(String teacherId, String sessionToken) async {
    final res = await client.rpc('fetch_teacher_alerts', params: {
      'p_teacher_id': teacherId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Per-student equivalent of fetchTeacherAlerts above (student_alerts table -
  // SUPABASE_HASH_APP_PASSWORD.sql). Currently only populated by
  // admin_reset_student_password, but not tied to that specifically - any
  // future targeted admin->student message can use the same table/row shape.
  static Future<List<Map<String, dynamic>>> fetchStudentAlerts(String studentId, String sessionToken) async {
    final res = await client.rpc('fetch_student_alerts', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchMyEditRequests(String teacherId, String sessionToken) async {
    final res = await client.rpc('fetch_my_edit_requests', params: {
      'p_teacher_id': teacherId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // App update check ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> fetchLatestAppVersion(String app) async {
    final res = await client
        .from('app_versions')
        .select()
        .eq('app', app)
        .order('version_code', ascending: false)
        .limit(1);
    final rows = List<Map<String, dynamic>>.from(res);
    return rows.isEmpty ? null : rows.first;
  }

  static Future<void> submitAttendanceEditRequest({
    required String teacherId,
    required String sessionToken,
    required String className,
    String? sectionName,
    required String date,
    String? reason,
  }) async {
    await client.rpc('submit_attendance_edit_request', params: {
      'p_teacher_id': teacherId,
      'p_session_token': sessionToken,
      'p_class_name': className,
      'p_section_name': sectionName,
      'p_date': date,
      'p_reason': reason,
    });
  }

  // REQ-SEC-002 Category 3 Group C (2026-09-22): student_attendance's
  // per-student full-year read moved to a session-token-gated RPC - own
  // record only, not actually dual-shape despite the plan's stated
  // uncertainty (only the student app calls this; teacher-side attendance
  // is the separate saveAttendanceBatch/fetchAttendanceForClassDate pair,
  // already covered by Group B). No limit - the Yearly attendance view
  // needs the whole academic year's records, not just the most recent ones
  // (a school year is well under a thousand rows per student, so fetching
  // all of it is cheap).
  static Future<List<Map<String, dynamic>>> fetchStudentAttendance(String studentId, String sessionToken) async {
    final res = await client.rpc('fetch_my_attendance_history', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Staff leave + staff attendance ─────────────────────────────────────────
  // Same request/approve/reject shape as the attendance-edit-request
  // workflow above - approving a leave request (admin panel) auto-inserts
  // employee_attendance rows with status 'L' for every day in the range.

  static Future<void> submitLeaveRequest({
    required String employeeId,
    required String sessionToken,
    required String fromDate,
    required String toDate,
    required String reason,
  }) async {
    await client.rpc('teacher_submit_leave_request', params: {
      'p_employee_id': employeeId,
      'p_session_token': sessionToken,
      'p_from_date': fromDate,
      'p_to_date': toDate,
      'p_reason': reason,
    });
  }

  static Future<List<Map<String, dynamic>>> fetchMyLeaveRequests(String employeeId, String sessionToken) async {
    final res = await client.rpc('fetch_my_leave_requests', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Every other active teaching-staff member (excludes the given employeeId,
  // the requester, since they can't cover their own leave) - lets the Leave
  // page's "Managed By" picker offer a real name instead of free text. Phone
  // is included so that same picker can WhatsApp the covering teacher
  // directly, not just the Principal.
  static Future<List<Map<String, dynamic>>> fetchOtherTeachers(String excludeEmployeeId) async {
    final res = await client
        .from('employees')
        .select('id, name, phone')
        .eq('type', 'teaching')
        .eq('status', 'Active')
        .neq('id', excludeEmployeeId)
        .order('name');
    return List<Map<String, dynamic>>.from(res);
  }

  // Same "designation = Principal" lookup get_student_helpdesk_contacts uses
  // for the Student app's Help Desk - direct select works fine for the
  // teacher app too (name/phone aren't sensitive the way aadhar/address are).
  static Future<Map<String, dynamic>?> fetchPrincipalContact() async {
    final res = await client
        .from('employees')
        .select('name, phone')
        .eq('designation', 'Principal')
        .eq('status', 'Active')
        .maybeSingle();
    return res;
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
  // face_embedding is a jsonb array of ~10 reference vectors (one per
  // enrollment shot, see face_enroll_capture_page.dart), not one averaged
  // vector - matching against the best of several references per person
  // handles lighting/distance/angle variation far better than a single
  // blended-together average would. supabase_flutter already decodes jsonb
  // into plain Lists, no manual jsonDecode needed.

  // REQ-SEC-002 fast-track (2026-09-19): face_embedding is no longer
  // anon-writable directly - goes through the PIN-token-gated RPC instead.
  static Future<void> saveFaceEmbedding(String kioskToken, String employeeId, List<List<double>> embeddings) async {
    await client.rpc('kiosk_save_face_embedding', params: {
      'p_token': kioskToken,
      'p_employee_id': employeeId,
      'p_embeddings': embeddings,
    });
  }

  // Clears a staff member's enrollment - the kiosk's "Registered" tab uses
  // this so admin can wipe a bad/duplicate enrollment and have them show up
  // under "Not Registered" again for a clean re-scan.
  static Future<void> deleteFaceEmbedding(String kioskToken, String employeeId) async {
    await client.rpc('kiosk_delete_face_embedding', params: {
      'p_token': kioskToken,
      'p_employee_id': employeeId,
    });
  }

  // Server-side 1-to-many match (see SUPABASE_FACE_MATCH_RPC.sql) - the
  // kiosk's actual per-punch match path. Sends just this one live 192-float
  // embedding and gets back a name + two similarity scores; Postgres does
  // the comparison against every enrolled person's references itself
  // instead of the phone downloading all of them first (which is still
  // what fetchAllFaceEmbeddings below does, for the two callers - the
  // enrollment duplicate-check and the admin enrollment picker - where that
  // was never the bottleneck). Was measured taking 6-11+ seconds on real
  // kiosk network conditions, sometimes timing out outright, before this
  // existed (SESSION-2026-09-15).
  static Future<Map<String, dynamic>> matchFaceEmbedding(List<double> liveEmbedding) async {
    final res = await client.rpc('match_face_embedding', params: {
      'p_embedding': liveEmbedding,
    }) as List;
    final row = res.first as Map;
    return {
      'id': row['o_employee_id'] as String?,
      'name': row['o_employee_name'] as String?,
      'bestSimilarity': (row['o_best_similarity'] as num?)?.toDouble() ?? -1.0,
      'secondSimilarity': (row['o_second_similarity'] as num?)?.toDouble() ?? -1.0,
      'enrolledCount': (row['o_enrolled_count'] as num?)?.toInt() ?? 0,
    };
  }

  // Every enrolled staff member's reference embeddings - used by the
  // enrollment screen's own duplicate-face check and the admin enrollment
  // picker (both lower-volume, less time-pressured than the kiosk's
  // per-punch match above, which uses matchFaceEmbedding instead).
  // Inactive staff are excluded so a former employee's old enrollment can't
  // still clock someone in.
  // REQ-SEC-002 fast-track (2026-09-19): raw embeddings are no longer
  // anon-readable directly (were - any anon caller could read every
  // enrolled staff member's biometric data) - goes through the
  // PIN-token-gated RPC instead.
  static Future<List<Map<String, dynamic>>> fetchAllFaceEmbeddings(String kioskToken) async {
    final res = await client.rpc('kiosk_get_face_embeddings', params: {'p_token': kioskToken}) as List;
    return List<Map<String, dynamic>>.from(res).map((row) {
      final raw = row['face_embedding'];
      final embeddings = raw is List
          ? raw.whereType<List>().map((e) => e.map((v) => (v as num).toDouble()).toList()).toList()
          : <List<double>>[];
      return {
        'id': row['id'],
        'name': row['name'],
        'embeddings': embeddings,
      };
    }).where((row) => (row['embeddings'] as List).isNotEmpty).toList();
  }

  // Active staff for the kiosk's admin-facing enrollment picker, split into
  // "not registered" / "registered" by whether face_embedding is set - lets
  // admin pick a name instead of that staff member typing their own login.
  // REQ-SEC-002 fast-track (2026-09-19): also moved behind the same
  // PIN-token gate for consistency, even though this one only ever
  // returned a name + registered boolean, not raw biometric data.
  static Future<List<Map<String, dynamic>>> fetchStaffForEnrollment(String kioskToken) async {
    final res = await client.rpc('kiosk_get_staff_for_enrollment', params: {'p_token': kioskToken}) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // The kiosk only ever handles check-in - checkout is self-service from
  // the staff member's own app (recordCheckOut below), since that's
  // already behind their own login and doesn't need a face-scan. Goes
  // through the record_face_punch RPC (not a direct table write) so the
  // "one open shift at a time" rule is enforced server-side, where a
  // tampered kiosk APK can't bypass it - status comes back 'checked_in' or
  // 'already_in' so the caller can show a block message instead of a
  // silent no-op.
  static Future<Map<String, dynamic>> recordFacePunch(String employeeId, String date) async {
    final now = DateTime.now();
    final res = await client.rpc('record_face_punch', params: {
      'p_employee_id': employeeId,
      'p_date': date,
      // .toUtc() before serializing - see the timezone note on
      // redeemPunchCode below, same reasoning applies here.
      'p_check_in_at': now.toUtc().toIso8601String(),
    }) as List;
    final row = res.first as Map;
    return {
      'status': row['o_status'] as String,
      'time':   DateTime.parse(row['o_check_in_at'] as String).toLocal(),
      // Only meaningful when status is 'checked_in' - null on 'already_in'
      // and null on any shift after the day's first (see
      // SUPABASE_KIOSK_SETTINGS.sql - lateness is only judged on arrival).
      'isLate':      row['o_is_late'] as bool?,
      'lateMinutes': row['o_late_minutes'] as int?,
    };
  }

  // Kiosk settings - expected start time / grace period (for the late-vs-
  // on-time judgement above) and whether the admin PIN has been configured.
  // Never the PIN hash itself - see kiosk_pin_service.dart.
  static Future<Map<String, dynamic>> fetchKioskPublicSettings() async {
    final res = await client.rpc('get_kiosk_public_settings') as List;
    final row = res.first as Map;
    return {
      'expectedStartTime': row['o_expected_start_time'] as String?, // "HH:MM:SS"
      'lateGraceMinutes':  row['o_late_grace_minutes'] as int?,
      'pinIsSet':          row['o_pin_is_set'] as bool? ?? false,
    };
  }

  // REQ-SEC-002 fast-track (2026-09-19): now returns a short-lived
  // (20 min) kiosk-admin session token instead of a bare bool - the token
  // gates the face-embedding RPCs above. Null means wrong PIN, PIN not
  // configured, or currently locked out (same as the old `false`).
  static Future<String?> verifyKioskAdminPin(String pin) async {
    final res = await client.rpc('verify_kiosk_admin_pin', params: {'p_pin': pin});
    return res as String?;
  }

  // Staff-initiated checkout from their own app (My Attendance) - the
  // counterpart to the kiosk's check-in-only recordFacePunch above. Closes
  // whichever shift is currently open for them via the record_check_out
  // RPC (not date-scoped - handles a shift that started before midnight).
  // status comes back 'checked_out' or 'no_open_shift'.
  static Future<Map<String, dynamic>> recordCheckOut(String employeeId) async {
    final now = DateTime.now();
    final res = await client.rpc('record_check_out', params: {
      'p_employee_id': employeeId,
      'p_check_out_at': now.toUtc().toIso8601String(),
    }) as List;
    final row = res.first as Map;
    final checkOutAt = row['o_check_out_at'] as String?;
    return {
      'status': row['o_status'] as String,
      'time':   checkOutAt != null ? DateTime.parse(checkOutAt).toLocal() : null,
    };
  }

  // Every shift for one employee on one day, oldest first - the teacher
  // app's My Attendance banner lists all of them (not just one in/out
  // pair), and the checkout button always targets whichever one has no
  // check_out_at yet. Direct SELECT, not an RPC: authenticated already has
  // a read grant on employee_shifts, no need for a bespoke fetch function.
  static Future<List<Map<String, dynamic>>> fetchEmployeeShiftsForDate(String employeeId, String date) async {
    final res = await client
        .from('employee_shifts')
        .select()
        .eq('employee_id', employeeId)
        .eq('date', date)
        .order('check_in_at');
    return List<Map<String, dynamic>>.from(res);
  }

  // Punch override codes - the fallback when the kiosk's face match is
  // wrong or fails outright (see face_punch_page.dart's "Not me" / "Enter
  // Code Instead"). Admin mints a code from the employee's profile in the
  // admin panel (generate_punch_code, authenticated-only); these two are
  // the kiosk's anon-callable half of that flow. Both are thin wrappers -
  // lookup_punch_code/redeem_punch_code do the real validation server-side
  // (expiry, single-use, time bounds), these just shape the response and
  // let PostgrestException surface for the caller to map into a friendly
  // message.

  static Future<Map<String, dynamic>?> lookupPunchCode(String code) async {
    final res = await client.rpc('lookup_punch_code', params: {'p_code': code}) as List;
    if (res.isEmpty) return null;
    final row = res.first as Map;
    return {
      'employeeId':   row['o_employee_id'] as String,
      'employeeName': row['o_employee_name'] as String? ?? 'Staff',
      'generatedAt':  DateTime.parse(row['o_generated_at'] as String).toLocal(),
      'expiresAt':    DateTime.parse(row['o_expires_at'] as String).toLocal(),
    };
  }

  static Future<Map<String, dynamic>> redeemPunchCode(String code, String date, DateTime checkInAt) async {
    final res = await client.rpc('redeem_punch_code', params: {
      'p_code': code,
      'p_date': date,
      'p_check_in_at': checkInAt.toUtc().toIso8601String(),
    }) as List;
    final row = res.first as Map;
    return {
      'employeeName': row['o_employee_name'] as String? ?? 'Staff',
      'status':       row['o_status'] as String,
      'checkInAt':    DateTime.parse(row['o_check_in_at'] as String).toLocal(),
      'isLate':       row['o_is_late'] as bool?,
      'lateMinutes':  row['o_late_minutes'] as int?,
    };
  }

  // QR-code punch - the third check-in method, inverted from the override
  // code above: the KIOSK mints an anonymous one-time code (generateQrSession)
  // and shows it as a QR, the STAFF MEMBER's own Teacher app scans it and
  // redeems it as themselves (redeemQrSession, passing their own already-known
  // employeeId - the QR itself carries no identity). checkQrSession is the
  // kiosk's poll to detect the moment a scan claims its on-screen code. See
  // SUPABASE_QR_PUNCH.sql.

  static Future<Map<String, dynamic>> generateQrSession() async {
    final res = await client.rpc('generate_qr_session') as List;
    final row = res.first as Map;
    return {
      'code':      row['o_code'] as String,
      'expiresAt': DateTime.parse(row['o_expires_at'] as String).toLocal(),
    };
  }

  static Future<Map<String, dynamic>> checkQrSession(String code) async {
    final res = await client.rpc('check_qr_session', params: {'p_code': code}) as List;
    if (res.isEmpty) return {'claimedAt': null, 'employeeName': null, 'checkInAt': null, 'isLate': null, 'lateMinutes': null};
    final row = res.first as Map;
    final claimedAt = row['o_claimed_at'] as String?;
    final checkInAt = row['o_check_in_at'] as String?;
    return {
      'claimedAt':    claimedAt != null ? DateTime.parse(claimedAt).toLocal() : null,
      'employeeName': row['o_employee_name'] as String?,
      'checkInAt':    checkInAt != null ? DateTime.parse(checkInAt).toLocal() : null,
      'isLate':       row['o_is_late'] as bool?,
      'lateMinutes':  row['o_late_minutes'] as int?,
    };
  }

  static Future<Map<String, dynamic>> redeemQrSession(String code, String employeeId, String date, DateTime checkInAt) async {
    final res = await client.rpc('redeem_qr_session', params: {
      'p_code': code,
      'p_employee_id': employeeId,
      'p_date': date,
      'p_check_in_at': checkInAt.toUtc().toIso8601String(),
    }) as List;
    final row = res.first as Map;
    return {
      'status':       row['o_status'] as String,
      'employeeName': row['o_employee_name'] as String? ?? 'Staff',
      'checkInAt':    DateTime.parse(row['o_check_in_at'] as String).toLocal(),
      'isLate':       row['o_is_late'] as bool?,
      'lateMinutes':  row['o_late_minutes'] as int?,
    };
  }

  // Homework ──────────────────────────────────────────────────────────────────

  // Returns homework in any of classNames UNION homework created by
  // createdBy (merged client-side, same reasoning as fetchExams below) - so
  // a class teacher sees every homework given to their own class (by any
  // teacher) plus anything they personally assigned elsewhere, while a
  // subject teacher with no class of their own just sees what they gave.
  // className stays for backward compatibility with callers that only need
  // a single class with no creator filter (e.g. a student's own class).
  //
  // REQ-SEC-002 Category 3 Group B (2026-09-22): homework moved from direct
  // anon table access to session-token-gated RPCs. Any teacher may still
  // create homework for any class (deliberate existing feature, see
  // lib/core/utils/teacher_classes.dart) - only READ is class-gated
  // (is_teacher_of_class, server-side) via fetch_homework_for_class; a
  // teacher's own-authored homework is always visible via fetch_my_homework
  // regardless of class.
  static Future<List<Map<String, dynamic>>> fetchHomework({
    required String employeeId, required String sessionToken,
    String? className, List<String>? classNames, String? createdBy,
  }) async {
    if (classNames != null && classNames.isNotEmpty) {
      final merged = <Map<String, dynamic>>[];
      final seenIds = <dynamic>{};
      for (final c in classNames) {
        final res = await client.rpc('fetch_homework_for_class', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': c,
        }) as List;
        for (final h in List<Map<String, dynamic>>.from(res)) {
          if (seenIds.add(h['id'])) merged.add(h);
        }
      }
      if (createdBy != null) {
        final byCreator = await client.rpc('fetch_my_homework', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken,
        }) as List;
        for (final h in List<Map<String, dynamic>>.from(byCreator)) {
          if (seenIds.add(h['id'])) merged.add(h);
        }
      }
      merged.sort((a, b) => ('${a['due_date'] ?? ''}').compareTo('${b['due_date'] ?? ''}'));
      return merged;
    }
    if (createdBy != null) {
      final res = await client.rpc('fetch_my_homework', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken,
      }) as List;
      return List<Map<String, dynamic>>.from(res);
    }
    if (className != null) {
      final res = await client.rpc('fetch_homework_for_class', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': className,
      }) as List;
      final list = List<Map<String, dynamic>>.from(res);
      list.sort((a, b) => ('${a['due_date'] ?? ''}').compareTo('${b['due_date'] ?? ''}'));
      return list;
    }
    return [];
  }

  static Future<void> createHomework(Map<String, dynamic> data, String sessionToken) async {
    await client.rpc('create_homework', params: {
      'p_employee_id': data['created_by'],
      'p_session_token': sessionToken,
      'p_class_name': data['class'],
      'p_subject': data['subject'],
      'p_description': data['description'],
      'p_due_date': data['due_date'],
    });
  }

  // Exam marks ────────────────────────────────────────────────────────────────

  // Returns exams in any of classNames UNION exams created by createdBy, so a
  // subject teacher sees every class they teach, and a class teacher also
  // sees exams they personally conducted for other classes. Runs as two
  // simple queries merged client-side rather than one hand-built OR filter
  // string, since class names can contain spaces/hyphens (e.g. "11th -
  // Commerce") that would need careful escaping in a raw PostgREST filter.
  // REQ-SEC-002 Category 3 Group B (2026-09-22): exams moved from direct
  // anon table access to session-token-gated RPCs - same shape as
  // fetchHomework above (any teacher may create for any class, only READ
  // is class-gated).
  static Future<List<Map<String, dynamic>>> fetchExams({
    required String employeeId, required String sessionToken,
    String? className, List<String>? classNames, String? createdBy,
  }) async {
    if (classNames != null && classNames.isNotEmpty) {
      final merged = <Map<String, dynamic>>[];
      final seenIds = <dynamic>{};
      for (final c in classNames) {
        final res = await client.rpc('fetch_exams_for_class', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': c,
        }) as List;
        for (final e in List<Map<String, dynamic>>.from(res)) {
          if (seenIds.add(e['id'])) merged.add(e);
        }
      }
      if (createdBy != null) {
        final byCreator = await client.rpc('fetch_my_exams', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken,
        }) as List;
        for (final e in List<Map<String, dynamic>>.from(byCreator)) {
          if (seenIds.add(e['id'])) merged.add(e);
        }
      }
      merged.sort((a, b) => ('${b['date'] ?? ''}').compareTo('${a['date'] ?? ''}'));
      return merged;
    }
    if (createdBy != null) {
      final res = await client.rpc('fetch_my_exams', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken,
      }) as List;
      return List<Map<String, dynamic>>.from(res);
    }
    if (className != null) {
      final res = await client.rpc('fetch_exams_for_class', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': className,
      }) as List;
      final list = List<Map<String, dynamic>>.from(res);
      list.sort((a, b) => ('${b['date'] ?? ''}').compareTo('${a['date'] ?? ''}'));
      return list;
    }
    return [];
  }

  static Future<void> createExam(Map<String, dynamic> data, String sessionToken) async {
    await client.rpc('create_exam', params: {
      'p_employee_id': data['created_by'],
      'p_session_token': sessionToken,
      'p_name': data['name'],
      'p_class_name': data['class'],
      'p_subject': data['subject'],
      'p_date': data['date'],
      'p_max_marks': data['max_marks'],
    });
  }

  // Admin-configurable default full marks for a new Monthly Test (Settings →
  // Exams in the admin panel) - stored on the single-row school_profile
  // table, falls back to 25 if unset/unmigrated.
  static Future<int> fetchMonthlyTestMaxMarks() async {
    final res = await client.from('school_profile').select('monthly_test_max_marks').maybeSingle();
    return (res?['monthly_test_max_marks'] as num?)?.toInt() ?? 25;
  }

  // REQ-SEC-002 Category 3 Group B (2026-09-22): exam_marks moved from
  // direct anon table access to session-token-gated RPCs, scoped via the
  // parent exam (own exam or is_teacher_of_class(exam's class)).
  //
  // Which of these exam ids already have at least one mark entered - used to
  // count "pending" exams (held, but marks not started) on the dashboard.
  static Future<Set<String>> fetchExamIdsWithMarks(String employeeId, String sessionToken, List<String> examIds) async {
    if (examIds.isEmpty) return {};
    final res = await client.rpc('fetch_exam_ids_with_marks', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_exam_ids': examIds,
    }) as List;
    return List<Map<String, dynamic>>.from(res).map((r) => r['exam_id'].toString()).toSet();
  }

  static Future<List<Map<String, dynamic>>> fetchExamMarks(String employeeId, String sessionToken, String examId) async {
    final res = await client.rpc('fetch_exam_marks', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_exam_id': examId,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // records: [{exam_id, student_id, marks_obtained, entered_by}] (entered_by
  // is ignored server-side, always forced to the verified caller) - the RPC
  // itself does the same "insert or update on (exam_id, student_id)" upsert
  // this table's real UNIQUE constraint requires, previously done client-side
  // via .upsert(onConflict:).
  static Future<void> saveMarksBatch(String employeeId, String sessionToken, String examId, List<Map<String, dynamic>> records) async {
    await client.rpc('save_marks_batch', params: {
      'p_employee_id': employeeId,
      'p_session_token': sessionToken,
      'p_exam_id': examId,
      'p_marks': records.map((r) => {'student_id': r['student_id'], 'marks_obtained': r['marks_obtained']}).toList(),
    });
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
    final res = await query.order('sort_order', ascending: true);
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<String>> fetchClassSubjects(String className) async {
    final res = await client
        .from('class_subjects')
        .select('subject_name')
        .eq('class_name', className)
        .order('sort_order', ascending: true);
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

  // REQ-SEC-002 Category 3 Group C (2026-09-22): official_exam_marks moved
  // to session-token-gated RPCs. Entering marks uses the same "any teacher,
  // any class" picker as Group B's exams/homework/syllabus (identity-gated
  // only); the Class Overview (all subjects, whole class) is
  // is_teacher_of_class-gated, matching Group B's broadened-read shape.
  static Future<List<Map<String, dynamic>>> fetchOfficialExamMarks(String employeeId, String sessionToken, String examId, String className, String subjectName) async {
    final res = await client.rpc('fetch_official_exam_marks', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken,
      'p_exam_id': examId, 'p_class_name': className, 'p_subject': subjectName,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Class-teacher read-only "all subjects for my class" view.
  static Future<List<Map<String, dynamic>>> fetchOfficialExamMarksForClass(String employeeId, String sessionToken, String examId, String className) async {
    final res = await client.rpc('fetch_official_exam_marks_for_class', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_exam_id': examId, 'p_class_name': className,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // records: [{exam_id, student_id, class_name, subject_name, marks_obtained,
  // entered_by}], all sharing one exam_id/class_name/subject_name per call
  // (entered_by ignored server-side, always forced to the verified caller).
  static Future<void> saveOfficialMarksBatch(String employeeId, String sessionToken, List<Map<String, dynamic>> records) async {
    if (records.isEmpty) return;
    await client.rpc('save_official_marks_batch', params: {
      'p_employee_id': employeeId,
      'p_session_token': sessionToken,
      'p_exam_id': records.first['exam_id'],
      'p_class_name': records.first['class_name'],
      'p_subject': records.first['subject_name'],
      'p_marks': records.map((r) => {'student_id': r['student_id'], 'marks_obtained': r['marks_obtained']}).toList(),
    });
  }

  // Student-facing: own rows only, across every subject for one exam -
  // replaces the previous fetchOfficialExamMarksForClass()-then-client-
  // filter pattern the student page used, which could already read every
  // student's official results directly (anon, no auth existed for this
  // table before Group C).
  static Future<List<Map<String, dynamic>>> fetchOfficialExamMarksForStudent(String studentId, String sessionToken, String examId) async {
    final res = await client.rpc('fetch_official_exam_marks_for_student', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken, 'p_exam_id': examId,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Syllabus ──────────────────────────────────────────────────────────────────

  // Same classNames-UNION-createdBy shape as fetchHomework/fetchExams above -
  // a class teacher sees every chapter added for their own class (by any
  // teacher) plus anything they personally added for other classes, while a
  // subject teacher with no class of their own just sees what they added.
  // REQ-SEC-002 Category 3 Group B (2026-09-22): syllabus moved from direct
  // anon table access to session-token-gated RPCs. Create is open to any
  // class (deliberate feature, same as exams/homework); update/delete/lock
  // are own-record (teacher_id must match the caller server-side) - not
  // class-gated, matching this table's existing per-row ownership shape.
  static Future<List<Map<String, dynamic>>> fetchSyllabus({
    required String employeeId, required String sessionToken,
    String? className, List<String>? classNames, String? teacherId,
  }) async {
    if (classNames != null && classNames.isNotEmpty) {
      final merged = <Map<String, dynamic>>[];
      final seenIds = <dynamic>{};
      for (final c in classNames) {
        final res = await client.rpc('fetch_syllabus_for_class', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': c,
        }) as List;
        for (final s in List<Map<String, dynamic>>.from(res)) {
          if (seenIds.add(s['id'])) merged.add(s);
        }
      }
      if (teacherId != null) {
        final byTeacher = await client.rpc('fetch_my_syllabus', params: {
          'p_employee_id': employeeId, 'p_session_token': sessionToken,
        }) as List;
        for (final s in List<Map<String, dynamic>>.from(byTeacher)) {
          if (seenIds.add(s['id'])) merged.add(s);
        }
      }
      merged.sort((a, b) => (a['sort_order'] ?? 0).compareTo(b['sort_order'] ?? 0));
      return merged;
    }
    if (teacherId != null) {
      final res = await client.rpc('fetch_my_syllabus', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken,
      }) as List;
      return List<Map<String, dynamic>>.from(res);
    }
    if (className != null) {
      final res = await client.rpc('fetch_syllabus_for_class', params: {
        'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_class_name': className,
      }) as List;
      final list = List<Map<String, dynamic>>.from(res);
      list.sort((a, b) => (a['sort_order'] ?? 0).compareTo(b['sort_order'] ?? 0));
      return list;
    }
    return [];
  }

  // Bulk insert so a teacher can add a whole chapter list in one go instead
  // of one at a time - each row still gets its own id/status/progress.
  // rows: [{teacher_id, class, subject, chapter, status, sort_order}, ...] -
  // all rows in one call share class_name/subject/starting sort_order.
  static Future<void> createSyllabusChapters(List<Map<String, dynamic>> rows, String sessionToken) async {
    if (rows.isEmpty) return;
    await client.rpc('create_syllabus_chapters', params: {
      'p_employee_id': rows.first['teacher_id'],
      'p_session_token': sessionToken,
      'p_class_name': rows.first['class'],
      'p_subject': rows.first['subject'],
      'p_chapters': rows.map((r) => r['chapter']).toList(),
      'p_start_sort_order': rows.first['sort_order'],
    });
  }

  static Future<void> updateSyllabusStatus(String id, String status, String employeeId, String sessionToken) async {
    await client.rpc('update_syllabus_status', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_chapter_id': id, 'p_status': status,
    });
  }

  static Future<void> deleteSyllabusChapter(String id, String employeeId, String sessionToken) async {
    await client.rpc('delete_syllabus_chapter', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_chapter_id': id,
    });
  }

  static Future<void> updateSyllabusChapterName(String id, String chapter, String employeeId, String sessionToken) async {
    await client.rpc('update_syllabus_chapter_name', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_chapter_id': id, 'p_chapter_name': chapter,
    });
  }

  // Wipes every chapter (and via ON DELETE CASCADE, their subtopics) this
  // teacher has for one class+subject - used by "Replace Existing" on Add
  // Chapters/Import, so re-uploading a corrected sheet doesn't just append
  // another full copy on top of what's already there.
  static Future<void> deleteSyllabusForSubject({
    required String teacherId, required String sessionToken, required String className, required String subject,
  }) async {
    await client.rpc('delete_syllabus_for_subject', params: {
      'p_employee_id': teacherId, 'p_session_token': sessionToken, 'p_class_name': className, 'p_subject': subject,
    });
  }

  // Subtopics under a chapter - optional, own independent progress. A
  // chapter with subtopics has its own status derived app-side from these
  // instead of being cycled directly.
  //
  // REQ-SEC-002 Category 3 Group B (2026-09-22): scoped via the parent
  // chapter (syllabus.teacher_id for ownership/writes, syllabus.class for
  // the broadened class-teacher read) - fetch naturally filters to
  // authorized chapter_ids rather than raising, since it's a batch read
  // across a caller-supplied id list spanning both "my own" and "my class".
  static Future<List<Map<String, dynamic>>> fetchSubtopics(String employeeId, String sessionToken, List<String> chapterIds) async {
    if (chapterIds.isEmpty) return [];
    final res = await client.rpc('fetch_syllabus_subtopics', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_chapter_ids': chapterIds,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // rows: [{chapter_id, name, status, sort_order}, ...] - all rows share one
  // chapter_id/starting sort_order per call (matches every call site).
  static Future<void> createSubtopics(List<Map<String, dynamic>> rows, String employeeId, String sessionToken) async {
    if (rows.isEmpty) return;
    await client.rpc('create_syllabus_subtopics', params: {
      'p_employee_id': employeeId,
      'p_session_token': sessionToken,
      'p_chapter_id': rows.first['chapter_id'],
      'p_names': rows.map((r) => r['name']).toList(),
      'p_start_sort_order': rows.first['sort_order'],
    });
  }

  static Future<void> updateSubtopicStatus(String id, String status, String employeeId, String sessionToken) async {
    await client.rpc('update_subtopic_status', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_subtopic_id': id, 'p_status': status,
    });
  }

  static Future<void> deleteSubtopic(String id, String employeeId, String sessionToken) async {
    await client.rpc('delete_subtopic', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_subtopic_id': id,
    });
  }

  // Student reads for exams/homework/syllabus (Group B addendum) ──────────
  // REQ-SEC-002 Category 3 Group B (2026-09-22): the student app reads its
  // own class's exams/homework/syllabus/subtopics too, missed in the
  // initial teacher-focused pass above - separate RPCs since the identity
  // shape differs (student session, own class resolved server-side via
  // student_enrollments, never trusted from the client - a student can only
  // ever see their own class, no "which class" parameter needed at all).
  static Future<List<Map<String, dynamic>>> fetchExamsForStudent(String studentId, String sessionToken) async {
    final res = await client.rpc('fetch_exams_for_student', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchHomeworkForStudent(String studentId, String sessionToken) async {
    final res = await client.rpc('fetch_homework_for_student', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchSyllabusForStudent(String studentId, String sessionToken) async {
    final res = await client.rpc('fetch_syllabus_for_student', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // A student's own mark for one exam (never the whole class's) - matches
  // the existing Dart-side filter's intent, and is tighter than the
  // pre-Group-B state (any anon caller could read every student's marks).
  static Future<List<Map<String, dynamic>>> fetchMyExamMark(String studentId, String sessionToken, String examId) async {
    final res = await client.rpc('fetch_my_exam_mark', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken, 'p_exam_id': examId,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<List<Map<String, dynamic>>> fetchSubtopicsForStudent(String studentId, String sessionToken, List<String> chapterIds) async {
    if (chapterIds.isEmpty) return [];
    final res = await client.rpc('fetch_syllabus_subtopics_for_student', params: {
      'p_student_id': studentId, 'p_session_token': sessionToken, 'p_chapter_ids': chapterIds,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Syllabus lock + edit-request workflow ──────────────────────────────────
  // Same idiom as the attendance edit-request workflow above: approving a
  // request sets approved_at, which opens a 24-hour edit window checked
  // app-side (now() - approved_at < 24h) - no separate "window open" flag.

  // Sets locked on every chapter row for this teacher+class+subject at once,
  // since they were all added/locked together as one syllabus.
  static Future<void> lockSyllabus({required String teacherId, required String sessionToken, required String className, required String subject}) async {
    await client.rpc('lock_syllabus', params: {
      'p_employee_id': teacherId, 'p_session_token': sessionToken, 'p_class_name': className, 'p_subject': subject,
    });
  }

  static Future<void> submitSyllabusEditRequest({
    required String teacherId,
    required String sessionToken,
    required String className,
    required String subject,
    String? reason,
    String? requestedChanges,
  }) async {
    await client.rpc('submit_syllabus_edit_request', params: {
      'p_teacher_id': teacherId,
      'p_session_token': sessionToken,
      'p_class_name': className,
      'p_subject': subject,
      'p_reason': reason,
      'p_requested_changes': requestedChanges,
    });
  }

  static Future<List<Map<String, dynamic>>> fetchMySyllabusEditRequests(String teacherId, String sessionToken) async {
    final res = await client.rpc('fetch_my_syllabus_edit_requests', params: {
      'p_teacher_id': teacherId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // Ends an approved edit window early ("Save & Lock") instead of waiting
  // the full 24 hours out. Now requires and verifies the owning teacherId
  // (previously id-only, no owner check at all - REQ-SEC-002 Category 3).
  static Future<void> closeSyllabusEditWindow(String requestId, String teacherId, String sessionToken) async {
    await client.rpc('close_syllabus_edit_window', params: {
      'p_request_id': requestId, 'p_teacher_id': teacherId, 'p_session_token': sessionToken,
    });
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
    final res = await client.from('academic_years').select('label, is_current').order('label', ascending: true);
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

  // Which subjects this teacher actually teaches, per class - derived from
  // the real Timetable instead of profile['subject_mappings'] (see
  // teacherSubjectsForClass in teacher_classes.dart), which most teachers
  // never get configured at all. Homework/Marks Entry subject dropdowns use
  // this so a teacher only sees subjects they're actually scheduled to
  // teach for the selected class, not the entire school subject list.
  static Future<Map<String, List<String>>> fetchTeacherSubjectsByClass(String academicYear, String teacherName) async {
    final rows = await fetchTimetableForTeacher(academicYear, teacherName);
    final reverseOverrides = {for (final e in _timetableClassNameOverrides.entries) e.value: e.key};
    final map = <String, Set<String>>{};
    for (final r in rows) {
      final subject = r['subject'] as String?;
      final ttClassName = r['class_name'] as String?;
      if (subject == null || subject.isEmpty || ttClassName == null || ttClassName.isEmpty) continue;
      final className = reverseOverrides[ttClassName] ?? ttClassName;
      map.putIfAbsent(className, () => {}).add(subject);
    }
    return map.map((k, v) => MapEntry(k, v.toList()..sort()));
  }

  // Queries & Suggestions ────────────────────────────────────────────────────

  // REQ-SEC-002 Category 3 Group A (2026-09-19): data must contain
  // user_type/user_id/user_name/class_name/message (unchanged shape),
  // plus a sessionToken keyed to that same user_type/user_id.
  static Future<void> submitQuery(Map<String, dynamic> data, String sessionToken) async {
    await client.rpc('submit_query', params: {
      'p_user_type': data['user_type'],
      'p_user_id': data['user_id'],
      'p_session_token': sessionToken,
      'p_user_name': data['user_name'],
      'p_class_name': data['class_name'],
      'p_message': data['message'],
    });
  }

  // Diagnostic Reports (AGENTS.md §L, REQ-HYG-006) ────────────────────────────

  /// Submits a "Report a Problem" entry and returns its id (shown to the
  /// reporter as a short reference, e.g. the first 8 chars).
  static Future<String> submitDiagnosticReport(Map<String, dynamic> data) async {
    final res = await client.from('diagnostic_reports').insert(data).select('id').single();
    return res['id'] as String;
  }

  static Future<List<Map<String, dynamic>>> fetchMyQueries(String userType, String userId, String sessionToken) async {
    final res = await client.rpc('fetch_my_queries', params: {
      'p_user_type': userType, 'p_user_id': userId, 'p_session_token': sessionToken,
    }) as List;
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
  static Future<List<Map<String, dynamic>>> fetchTeacherTasks(String employeeId, String sessionToken) async {
    final res = await client.rpc('fetch_teacher_tasks', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  static Future<void> updateTaskAssigneeStatus(String taskId, String employeeId, String sessionToken, String status) async {
    await client.rpc('update_task_assignee_status', params: {
      'p_task_id': taskId, 'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_status': status,
    });
  }

  // Daily Tasks ───────────────────────────────────────────────────────────────
  // A recurring admin-defined staff checklist - separate from tasks/
  // task_assignees above (one-off, deadline-based). 'all' tasks apply to
  // every employee implicitly; 'specific' tasks only apply if
  // daily_task_targets has a row for this employee. Completion is a per
  // (task, employee, calendar date) row so it resets automatically each day.

  static Future<List<Map<String, dynamic>>> fetchDailyTasksForEmployee(String employeeId, String sessionToken) async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    // daily_tasks itself is already anon-readable (REQ-SEC-002 Category 2,
    // fixed earlier) - only daily_task_completions needed the session gate.
    final tasksRes = await client
        .from('daily_tasks')
        .select('id, title, description, target_type, daily_task_targets(employee_id)')
        .eq('active', true)
        .order('created_at', ascending: true);
    final completionsRes = await client.rpc('fetch_my_daily_task_completions', params: {
      'p_employee_id': employeeId, 'p_session_token': sessionToken, 'p_date': today,
    }) as List;

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

  static Future<void> markDailyTaskDone(String dailyTaskId, String employeeId, String sessionToken) async {
    await client.rpc('mark_daily_task_done', params: {
      'p_daily_task_id': dailyTaskId, 'p_employee_id': employeeId, 'p_session_token': sessionToken,
    });
  }

  static Future<void> unmarkDailyTaskDone(String dailyTaskId, String employeeId, String sessionToken) async {
    await client.rpc('unmark_daily_task_done', params: {
      'p_daily_task_id': dailyTaskId, 'p_employee_id': employeeId, 'p_session_token': sessionToken,
    });
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

  // Returns null both when the employee id doesn't match a row and when
  // p_password is wrong - callers should treat null as "check your password"
  // since a bad employee id can't happen from the app's own logged-in state.
  static Future<Map<String, dynamic>?> updateTeacherProfile({
    required String employeeId, required String name, required String phone, required String email, required String password,
  }) async {
    final res = await client.rpc('teacher_update_profile', params: {
      'p_employee_id': employeeId, 'p_name': name, 'p_phone': phone, 'p_email': email, 'p_password': password,
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

  // Student settings ────────────────────────────────────────────────────────

  static Future<bool> verifyStudentPassword({
    required String studentId, required String password,
  }) async {
    final res = await client.rpc('student_verify_password', params: {
      'p_student_id': studentId, 'p_password': password,
    });
    return res == true;
  }

  // Returns false when p_old_password didn't match - callers should surface
  // that as a wrong-password error, not a generic failure.
  static Future<bool> changeStudentPassword({
    required String studentId, required String oldPassword, required String newPassword,
  }) async {
    final res = await client.rpc('student_change_password', params: {
      'p_student_id': studentId, 'p_old_password': oldPassword, 'p_new_password': newPassword,
    });
    return res == true;
  }

  // Question Bank module - Assignment / Exam Paper / Question Bank ─────────────
  // All three sections are plain uploaded documents (teacher_documents,
  // distinguished by `section`) rather than in-app question building - see
  // SUPABASE_TEACHER_DOCUMENTS.sql. Private per teacher (query always filters
  // by teacher_id), same as the old question_bank table this replaces.

  static Future<List<String>> fetchAcademicYearLabels() async {
    final res = await client.from('academic_years').select('label').order('label', ascending: true);
    return List<Map<String, dynamic>>.from(res).map((r) => r['label'] as String).toList();
  }

  static Future<List<Map<String, dynamic>>> fetchTeacherDocuments({
    required String teacherId, required String sessionToken, required String section,
  }) async {
    final res = await client.rpc('fetch_teacher_documents', params: {
      'p_teacher_id': teacherId, 'p_session_token': sessionToken, 'p_section': section,
    }) as List;
    return List<Map<String, dynamic>>.from(res);
  }

  // REQ-SEC-002 Category 3 Group A (2026-09-19): data must contain
  // teacher_id/section/academic_year/class/subject/title/file_key/
  // file_name/file_size (unchanged shape), plus a sessionToken keyed to
  // that same teacher_id.
  static Future<void> createTeacherDocument(Map<String, dynamic> data, String sessionToken) async {
    await client.rpc('create_teacher_document', params: {
      'p_teacher_id': data['teacher_id'],
      'p_session_token': sessionToken,
      'p_section': data['section'],
      'p_academic_year': data['academic_year'],
      'p_class': data['class'],
      'p_subject': data['subject'],
      'p_title': data['title'],
      'p_file_key': data['file_key'],
      'p_file_name': data['file_name'],
      'p_file_size': data['file_size'],
    });
  }

  // Now requires and verifies the owning teacherId (previously id-only, no
  // owner check at all - REQ-SEC-002 Category 3).
  static Future<void> deleteTeacherDocument(String id, String teacherId, String sessionToken) async {
    await client.rpc('delete_teacher_document', params: {
      'p_id': id, 'p_teacher_id': teacherId, 'p_session_token': sessionToken,
    });
  }

  // School Calendar ──────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> fetchCalendarEvents(DateTime rangeStart, DateTime rangeEnd) async {
    final res = await client.from('school_calendar_events').select()
        .gte('event_date', rangeStart.toIso8601String().split('T').first)
        .lte('event_date', rangeEnd.toIso8601String().split('T').first)
        .order('event_date', ascending: true)
        .order('id');
    return List<Map<String, dynamic>>.from(res);
  }
}
