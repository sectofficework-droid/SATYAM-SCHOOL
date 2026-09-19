import 'package:supabase_flutter/supabase_flutter.dart';

// Admin Workspace data layer — Staff App Unification, phase 1
// (governance\planning\STAFF-APP-DESIGN-FIXED.md,
// STAFF-APP-UI-DESIGN.md, both approved 2026-09-19). Deliberately kept
// separate from SupabaseService (the existing Teacher-flavor service) so
// the two feature sets stay easy to tell apart in code review — this file
// is entirely new/additive, nothing here touches existing Teacher screens.
//
// Every call passes the current employee's id as the first RPC argument;
// the backend (mobile-app/SUPABASE_STAFF_APP_ADMIN_WORKSPACE.sql)
// re-derives the admin tier server-side via staff_admin_tier() and raises
// on every call if the employee isn't linked to an admin_users row - never
// trust a locally-cached role for gating, only what the RPC accepts.
class StaffAdminService {
  static SupabaseClient get client => Supabase.instance.client;

  static List<Map<String, dynamic>> _list(dynamic res) {
    if (res == null) return [];
    return List<Map<String, dynamic>>.from(res as List);
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> dashboardSummary(String employeeId) async {
    final res = await client.rpc('staff_admin_dashboard_summary', params: {'p_employee_id': employeeId});
    return Map<String, dynamic>.from(res as Map);
  }

  // ── Attendance ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> classList(String employeeId) async {
    final res = await client.rpc('staff_admin_classes', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<List<Map<String, dynamic>>> classStudents(String className) async {
    final res = await client.rpc('get_class_students_by_name', params: {'p_class_name': className});
    return _list(res);
  }

  static Future<void> markAttendance(String employeeId, List<Map<String, dynamic>> records) async {
    await client.rpc('staff_admin_mark_attendance', params: {
      'p_employee_id': employeeId,
      'p_records': records,
    });
  }

  static Future<List<Map<String, dynamic>>> classAttendance(String employeeId, String className, String date) async {
    final res = await client.rpc('staff_admin_class_attendance', params: {
      'p_employee_id': employeeId, 'p_class': className, 'p_date': date,
    });
    return _list(res);
  }

  static Future<List<Map<String, dynamic>>> attendanceEditRequests(String employeeId) async {
    final res = await client.rpc('staff_admin_attendance_edit_requests', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> respondAttendanceEditRequest(
    String employeeId, String requestId, {required bool approve, String? adminNote}) async {
    await client.rpc('staff_admin_attendance_edit_request_respond', params: {
      'p_employee_id': employeeId, 'p_request_id': requestId,
      'p_approve': approve, 'p_admin_note': adminNote,
    });
  }

  static Future<void> sendAttendanceReminder(
    String employeeId, String teacherId, String className, String? sectionName, String message) async {
    await client.rpc('staff_admin_send_attendance_reminder', params: {
      'p_employee_id': employeeId, 'p_teacher_id': teacherId,
      'p_class_name': className, 'p_section_name': sectionName, 'p_message': message,
    });
  }

  // ── Employee — punch code ───────────────────────────────────────────────
  static Future<Map<String, dynamic>> generatePunchCode(String employeeId, String targetEmployeeId) async {
    final res = await client.rpc('staff_generate_punch_code', params: {
      'p_employee_id': employeeId, 'p_target_employee_id': targetEmployeeId,
    }) as List;
    return Map<String, dynamic>.from(res.first as Map);
  }

  static Future<List<Map<String, dynamic>>> searchEmployees(String employeeId, String query) async {
    final res = await client.rpc('staff_admin_employee_search', params: {
      'p_employee_id': employeeId, 'p_query': query,
    });
    return _list(res);
  }

  // ── Inventory ────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> inventoryItems(String employeeId) async {
    final res = await client.rpc('staff_admin_inventory_items', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> recordInventoryUsage(String employeeId, {
    required String itemId, required int qty, required String usageDate,
    String? purpose, String? usedBy, String? note,
  }) async {
    await client.rpc('staff_admin_record_inventory_usage', params: {
      'p_employee_id': employeeId, 'p_item_id': itemId, 'p_qty': qty,
      'p_usage_date': usageDate, 'p_purpose': purpose, 'p_used_by': usedBy, 'p_note': note,
    });
  }

  static Future<List<Map<String, dynamic>>> assets(String employeeId) async {
    final res = await client.rpc('staff_admin_assets', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> checkoutAsset(String employeeId, {
    required String assetId, required String takenBy, required String purpose, required String takenDate,
  }) async {
    await client.rpc('staff_admin_asset_checkout', params: {
      'p_employee_id': employeeId, 'p_asset_id': assetId,
      'p_taken_by': takenBy, 'p_purpose': purpose, 'p_taken_date': takenDate,
    });
  }

  static Future<void> returnAsset(String employeeId, String checkoutId, String returnDate) async {
    await client.rpc('staff_admin_asset_return', params: {
      'p_employee_id': employeeId, 'p_checkout_id': checkoutId, 'p_return_date': returnDate,
    });
  }

  // ── Notices ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> notices(String employeeId) async {
    final res = await client.rpc('staff_admin_notices', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> createNotice(String employeeId, {
    required String title, required String content, String type = 'General',
    String audience = 'Everyone', required String postedDate, String? expiryDate,
    bool pinned = false, String? postedBy,
  }) async {
    await client.rpc('staff_admin_notice_create', params: {
      'p_employee_id': employeeId, 'p_title': title, 'p_content': content,
      'p_type': type, 'p_audience': audience, 'p_posted_date': postedDate,
      'p_expiry_date': expiryDate, 'p_pinned': pinned, 'p_posted_by': postedBy,
    });
  }

  static Future<void> updateNotice(String employeeId, String noticeId, {
    required String title, required String content, String? expiryDate,
  }) async {
    await client.rpc('staff_admin_notice_update', params: {
      'p_employee_id': employeeId, 'p_notice_id': noticeId,
      'p_title': title, 'p_content': content, 'p_expiry_date': expiryDate,
    });
  }

  static Future<void> setNoticeFlags(String employeeId, String noticeId, {required bool pinned, required bool archived}) async {
    await client.rpc('staff_admin_notice_set_flags', params: {
      'p_employee_id': employeeId, 'p_notice_id': noticeId, 'p_pinned': pinned, 'p_archived': archived,
    });
  }

  // ── Queries ──────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> queries(String employeeId) async {
    final res = await client.rpc('staff_admin_queries', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> replyToQuery(String employeeId, String queryId, String reply) async {
    await client.rpc('staff_admin_query_reply', params: {
      'p_employee_id': employeeId, 'p_query_id': queryId, 'p_reply': reply,
    });
  }

  static Future<void> setQueryResolved(String employeeId, String queryId, bool resolved) async {
    await client.rpc('staff_admin_query_set_status', params: {
      'p_employee_id': employeeId, 'p_query_id': queryId, 'p_resolved': resolved,
    });
  }

  // ── Question Papers / teacher-uploaded documents (read-only) ───────────────
  static Future<List<Map<String, dynamic>>> teacherDocuments(String employeeId, {String? section}) async {
    final res = await client.rpc('staff_admin_teacher_documents', params: {
      'p_employee_id': employeeId, 'p_section': section,
    });
    return _list(res);
  }

  // ── Syllabus edit-requests (senior_admin/management only — server-enforced) ─
  static Future<List<Map<String, dynamic>>> syllabusEditRequests(String employeeId) async {
    final res = await client.rpc('staff_admin_syllabus_edit_requests', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> respondSyllabusEditRequest(
    String employeeId, String requestId, {required bool approve, String? adminNote}) async {
    await client.rpc('staff_admin_syllabus_edit_request_respond', params: {
      'p_employee_id': employeeId, 'p_request_id': requestId,
      'p_approve': approve, 'p_admin_note': adminNote,
    });
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> tasks(String employeeId) async {
    final res = await client.rpc('staff_admin_tasks', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> createTask(String employeeId, {
    required String title, String? description, String? deadlineDate,
    String priority = 'Medium', required List<String> assigneeIds,
  }) async {
    await client.rpc('staff_admin_task_create', params: {
      'p_employee_id': employeeId, 'p_title': title, 'p_description': description,
      'p_deadline_date': deadlineDate, 'p_priority': priority, 'p_assignee_ids': assigneeIds,
    });
  }

  static Future<void> updateTaskStatus(String employeeId, String taskId, String status) async {
    await client.rpc('staff_admin_task_update_status', params: {
      'p_employee_id': employeeId, 'p_task_id': taskId, 'p_status': status,
    });
  }

  static Future<void> deleteTask(String employeeId, String taskId) async {
    await client.rpc('staff_admin_task_delete', params: {'p_employee_id': employeeId, 'p_task_id': taskId});
  }

  // ── Phase 2 (full admin-web parity, 2026-09-19) ─────────────────────────

  static Future<Map<String, dynamic>?> currentAcademicYear(String employeeId) async {
    final res = await client.rpc('staff_admin_current_academic_year', params: {'p_employee_id': employeeId});
    return res == null ? null : Map<String, dynamic>.from(res as Map);
  }

  static Future<List<Map<String, dynamic>>> classListWithIds(String employeeId) async {
    final res = await client.rpc('staff_admin_class_list', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<List<Map<String, dynamic>>> sectionList(String employeeId, String classId) async {
    final res = await client.rpc('staff_admin_section_list', params: {'p_employee_id': employeeId, 'p_class_id': classId});
    return _list(res);
  }

  // ── Students ─────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> students(String employeeId, {String? search, String? classId}) async {
    final res = await client.rpc('staff_admin_students', params: {
      'p_employee_id': employeeId, 'p_search': search, 'p_class_id': classId,
    });
    return _list(res);
  }

  static Future<Map<String, dynamic>> studentDetails(String employeeId, String studentId) async {
    final res = await client.rpc('staff_admin_student_details', params: {'p_employee_id': employeeId, 'p_student_id': studentId});
    return Map<String, dynamic>.from(res as Map);
  }

  static Future<void> updateStudentBasic(String employeeId, String studentId, {
    required String firstName, required String lastName, required String fatherName, required String motherName,
    required String dob, String? mobile1, String? mobile2, String? address,
  }) async {
    await client.rpc('staff_admin_student_update_basic', params: {
      'p_employee_id': employeeId, 'p_student_id': studentId, 'p_first_name': firstName, 'p_last_name': lastName,
      'p_father_name': fatherName, 'p_mother_name': motherName, 'p_dob': dob,
      'p_mobile1': mobile1, 'p_mobile2': mobile2, 'p_address': address,
    });
  }

  static Future<Map<String, dynamic>> addStudent(String employeeId, {
    required String firstName, required String lastName, required String dob, required String gender,
    required String fatherName, required String motherName, required String mobile1,
    required String classId, required String sectionId, String? address,
  }) async {
    final res = await client.rpc('staff_admin_student_add', params: {
      'p_employee_id': employeeId, 'p_first_name': firstName, 'p_last_name': lastName, 'p_dob': dob,
      'p_gender': gender, 'p_father_name': fatherName, 'p_mother_name': motherName, 'p_mobile1': mobile1,
      'p_class_id': classId, 'p_section_id': sectionId, 'p_address': address,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  static Future<void> deleteStudentPermanently(String employeeId, String studentId) async {
    await client.rpc('staff_admin_student_delete_permanently', params: {'p_employee_id': employeeId, 'p_student_id': studentId});
  }

  static Future<void> issueTc(String employeeId, {
    required String studentId, String? enrollmentId, required String tcNumber, required String issueDate,
    required String leavingDate, required String reason, String? conduct, bool duesCleared = false, String? remarks,
  }) async {
    await client.rpc('staff_admin_issue_tc', params: {
      'p_employee_id': employeeId, 'p_student_id': studentId, 'p_enrollment_id': enrollmentId,
      'p_tc_number': tcNumber, 'p_issue_date': issueDate, 'p_leaving_date': leavingDate, 'p_reason': reason,
      'p_conduct': conduct, 'p_dues_cleared': duesCleared, 'p_remarks': remarks,
    });
  }

  static Future<Map<String, dynamic>> createImpersonationCode(String employeeId, String targetType, String targetId) async {
    final res = await client.rpc('staff_create_impersonation_code', params: {
      'p_employee_id': employeeId, 'p_target_type': targetType, 'p_target_id': targetId,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  // ── Employees (full CRUD) ────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> employees(String employeeId, {String? search}) async {
    final res = await client.rpc('staff_admin_employees', params: {'p_employee_id': employeeId, 'p_search': search});
    return _list(res);
  }

  static Future<Map<String, dynamic>> employeeDetails(String employeeId, String targetId) async {
    final res = await client.rpc('staff_admin_employee_details', params: {'p_employee_id': employeeId, 'p_target_id': targetId});
    return Map<String, dynamic>.from(res as Map);
  }

  static Future<Map<String, dynamic>> addEmployee(String employeeId, {
    required String empCode, required String name, required String type, required String designation,
    String? department, String? gender, String? dob, String? phone, String? email, String? address,
    String? joiningDate, String? employmentType,
  }) async {
    final res = await client.rpc('staff_admin_employee_add', params: {
      'p_employee_id': employeeId, 'p_emp_code': empCode, 'p_name': name, 'p_type': type, 'p_designation': designation,
      'p_department': department, 'p_gender': gender, 'p_dob': dob, 'p_phone': phone, 'p_email': email,
      'p_address': address, 'p_joining_date': joiningDate, 'p_employment_type': employmentType,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  static Future<void> updateEmployee(String employeeId, String targetId, {
    required String name, required String designation, String? department, String? phone, String? email,
    String? address, String? status,
  }) async {
    await client.rpc('staff_admin_employee_update', params: {
      'p_employee_id': employeeId, 'p_target_id': targetId, 'p_name': name, 'p_designation': designation,
      'p_department': department, 'p_phone': phone, 'p_email': email, 'p_address': address, 'p_status': status,
    });
  }

  static Future<bool> resetEmployeePassword(String employeeId, String targetId, String newPassword) async {
    final res = await client.rpc('staff_admin_employee_reset_password', params: {
      'p_employee_id': employeeId, 'p_target_id': targetId, 'p_new_password': newPassword,
    });
    return res == true;
  }

  // ── Fees ─────────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> feeStructures(String employeeId) async {
    final res = await client.rpc('staff_admin_fee_structures', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> upsertFeeStructure(String employeeId, String classId, num tuition, num uniform) async {
    await client.rpc('staff_admin_fee_structure_upsert', params: {
      'p_employee_id': employeeId, 'p_class_id': classId, 'p_tuition': tuition, 'p_uniform': uniform,
    });
  }

  static Future<List<Map<String, dynamic>>> studentsFees(String employeeId, {String? search}) async {
    final res = await client.rpc('staff_admin_students_fees', params: {'p_employee_id': employeeId, 'p_search': search});
    return _list(res);
  }

  static Future<void> recordFeePayment(String employeeId, {
    required String enrollmentId, required String studentId, required num amount, required String date, String? receivedBy,
  }) async {
    await client.rpc('staff_admin_record_fee_payment', params: {
      'p_employee_id': employeeId, 'p_enrollment_id': enrollmentId, 'p_student_id': studentId,
      'p_amount': amount, 'p_date': date, 'p_received_by': receivedBy,
    });
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> expenses(String employeeId) async {
    final res = await client.rpc('staff_admin_expenses', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> addExpense(String employeeId, {
    required String title, String? category, required num amount, required String date, String? paidBy, String? note,
  }) async {
    await client.rpc('staff_admin_expense_add', params: {
      'p_employee_id': employeeId, 'p_title': title, 'p_category': category, 'p_amount': amount,
      'p_date': date, 'p_paid_by': paidBy, 'p_note': note,
    });
  }

  static Future<void> deleteExpense(String employeeId, String expenseId) async {
    await client.rpc('staff_admin_expense_delete', params: {'p_employee_id': employeeId, 'p_expense_id': expenseId});
  }

  // ── Inventory (full item/batch CRUD) ────────────────────────────────────
  static Future<Map<String, dynamic>> addInventoryItem(String employeeId, {
    required String name, String? category, String unit = 'Pcs', int lowStockAt = 10, String? storageAddress,
  }) async {
    final res = await client.rpc('staff_admin_inventory_item_add', params: {
      'p_employee_id': employeeId, 'p_name': name, 'p_category': category, 'p_unit': unit,
      'p_low_stock_at': lowStockAt, 'p_storage_address': storageAddress,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  static Future<void> deleteInventoryItem(String employeeId, String itemId) async {
    await client.rpc('staff_admin_inventory_item_delete', params: {'p_employee_id': employeeId, 'p_item_id': itemId});
  }

  static Future<void> addInventoryBatch(String employeeId, {
    required String itemId, required int qty, required String receivedDate, String? receivedBy, String? note,
  }) async {
    await client.rpc('staff_admin_inventory_batch_add', params: {
      'p_employee_id': employeeId, 'p_item_id': itemId, 'p_qty': qty,
      'p_received_date': receivedDate, 'p_received_by': receivedBy, 'p_note': note,
    });
  }

  // ── Syllabus (full chapter CRUD) ─────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> syllabus(String employeeId) async {
    final res = await client.rpc('staff_admin_syllabus', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> addSyllabusChapter(String employeeId, {
    required String teacherId, required String className, required String subject, required String chapter,
  }) async {
    await client.rpc('staff_admin_syllabus_chapter_add', params: {
      'p_employee_id': employeeId, 'p_teacher_id': teacherId, 'p_class': className,
      'p_subject': subject, 'p_chapter': chapter,
    });
  }

  static Future<void> setSyllabusChapterStatus(String employeeId, String chapterId, String status) async {
    await client.rpc('staff_admin_syllabus_chapter_set_status', params: {
      'p_employee_id': employeeId, 'p_chapter_id': chapterId, 'p_status': status,
    });
  }

  static Future<void> deleteSyllabusChapter(String employeeId, String chapterId) async {
    await client.rpc('staff_admin_syllabus_chapter_delete', params: {'p_employee_id': employeeId, 'p_chapter_id': chapterId});
  }

  static Future<List<Map<String, dynamic>>> teachingStaff(String employeeId) async {
    final res = await client.rpc('staff_admin_employees', params: {'p_employee_id': employeeId, 'p_search': null});
    return _list(res).where((e) => e['type'] == 'teaching').toList();
  }

  // ── GR Book (register view) ─────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> grBook(String employeeId, {String? search}) async {
    final res = await client.rpc('staff_admin_gr_book', params: {'p_employee_id': employeeId, 'p_search': search});
    return _list(res);
  }

  // ── Settings: Users & Roles ──────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> adminUsers(String employeeId) async {
    final res = await client.rpc('staff_admin_users_list', params: {'p_employee_id': employeeId});
    return _list(res);
  }

  static Future<void> createAdminUser(String employeeId, String name, String initials, String role) async {
    await client.rpc('staff_admin_user_create', params: {
      'p_employee_id': employeeId, 'p_name': name, 'p_initials': initials, 'p_role': role,
    });
  }

  static Future<void> updateAdminUser(String employeeId, String targetId, String name, String initials, String role) async {
    await client.rpc('staff_admin_user_update', params: {
      'p_employee_id': employeeId, 'p_target_id': targetId, 'p_name': name, 'p_initials': initials, 'p_role': role,
    });
  }

  static Future<void> deleteAdminUser(String employeeId, String targetId) async {
    await client.rpc('staff_admin_user_delete', params: {'p_employee_id': employeeId, 'p_target_id': targetId});
  }

  // ── Super-Admin: Salary (management only) ────────────────────────────────
  static Future<List<Map<String, dynamic>>> salaryPayments(String employeeId, {String? from, String? to}) async {
    final res = await client.rpc('staff_admin_salary_payments', params: {'p_employee_id': employeeId, 'p_from': from, 'p_to': to});
    return _list(res);
  }

  static Future<void> recordSalaryPayment(String employeeId, {
    required String targetEmployeeId, required String month, required num amount, required String paidOn, String? paidBy,
  }) async {
    await client.rpc('staff_admin_record_salary_payment', params: {
      'p_employee_id': employeeId, 'p_target_employee_id': targetEmployeeId, 'p_month': month,
      'p_amount': amount, 'p_paid_on': paidOn, 'p_paid_by': paidBy,
    });
  }
}
