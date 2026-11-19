-- REQ-SEC-026 (CRITICAL): every RPC in staff_admin_service.dart (the
-- Teacher app's mobile Admin Workspace) authorized by trusting a
-- client-supplied p_employee_id with no proof the caller actually is
-- that employee. Mobile apps run as the public `anon` Postgres role with
-- no real Supabase Auth session - the anon key ships inside every
-- installed APK - so anyone holding it who knew or guessed one
-- senior_admin/management employee's UUID could call these RPCs *as*
-- that admin directly via the REST API, bypassing the app entirely.
-- Worst instance: staff_create_impersonation_code minted a real 10-minute
-- login code for any student/employee target with no caller-identity
-- check at all - chainable to full account takeover.
--
-- Fixed by extending a session-token system that already existed and was
-- already proven on ~60 other RPCs in this database (mint_mobile_session/
-- verify_mobile_session, minted at teacher_login) to the ~95 RPCs in
-- staff_admin_service.dart plus redeem_qr_session - 101 function
-- signatures in total (3 overloads of staff_admin_student_add).
--
-- Applied live via Supabase MCP on 2026-11-19 as two migrations (not
-- reproduced as literal CREATE FUNCTION statements here - 101 of them
-- would make this file unreadable; the transformation below is exact and
-- was verified against every target function's live signature
-- afterward - zero unprotected overloads remained). To see the current
-- state of any one function, query pg_get_functiondef() directly rather
-- than trusting this file as the source of truth, same caution CLAUDE.md
-- already gives about the SQL files in this repo generally.

-- ============================================================
-- Migration 1 of 2: req_sec_026_session_token_all_staff_admin_rpcs
-- For every target function: CREATE OR REPLACE with
-- "p_employee_id uuid" -> "p_employee_id uuid, p_session_token text"
-- inserted into the signature (first occurrence only), and
-- "IF NOT public.verify_mobile_session('teacher', p_employee_id,
-- p_session_token) THEN RAISE EXCEPTION 'Not authorized'; END IF;"
-- inserted as the first statement after the outer BEGIN (first
-- occurrence only - correctly skips nested BEGIN...END blocks inside
-- loops/exception handlers, verified against
-- staff_create_impersonation_code's LOOP/EXCEPTION block specifically).
-- Every other line of each function preserved exactly as-is, including
-- any pre-existing staff_admin_tier(p_employee_id) authorization-tier
-- check - identity (verify_mobile_session) and authorization level
-- (staff_admin_tier) are different checks, both still needed.
-- ============================================================
DO $migration$
DECLARE
  r RECORD;
  v_new_def text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT oid, proname, pg_get_functiondef(oid) AS def
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN (
        'staff_admin_asset_checkout','staff_admin_asset_return','staff_admin_assets',
        'staff_admin_attendance_edit_request_respond','staff_admin_attendance_edit_requests',
        'staff_admin_attendance_overview','staff_admin_calendar_add_event',
        'staff_admin_calendar_delete_event','staff_admin_calendar_update_event',
        'staff_admin_class_attendance','staff_admin_class_list','staff_admin_classes',
        'staff_admin_current_academic_year','staff_admin_dashboard_summary',
        'staff_admin_diagnostic_reports','staff_admin_employee_add','staff_admin_employee_details',
        'staff_admin_employee_reset_password','staff_admin_employee_search','staff_admin_employee_update',
        'staff_admin_employees','staff_admin_exam_subject_max_marks_bulk',
        'staff_admin_exam_subject_max_marks_save','staff_admin_expense_add','staff_admin_expense_delete',
        'staff_admin_expenses','staff_admin_fee_structure_upsert','staff_admin_fee_structures',
        'staff_admin_get_diagnostics_enabled','staff_admin_gr_book','staff_admin_impersonation_log',
        'staff_admin_inventory_batch_add','staff_admin_inventory_item_add',
        'staff_admin_inventory_item_delete','staff_admin_inventory_items','staff_admin_issue_tc',
        'staff_admin_kiosk_attendance_report','staff_admin_kiosk_delete_special_day',
        'staff_admin_kiosk_get_settings','staff_admin_kiosk_list_special_days',
        'staff_admin_kiosk_save_settings','staff_admin_kiosk_save_special_day',
        'staff_admin_kiosk_set_pin','staff_admin_mark_attendance','staff_admin_mark_diagnostic_report',
        'staff_admin_monthly_test_marks','staff_admin_monthly_tests','staff_admin_notice_create',
        'staff_admin_notice_set_flags','staff_admin_notice_update','staff_admin_notices',
        'staff_admin_official_exam_create','staff_admin_official_exam_delete',
        'staff_admin_official_exam_marks_entered','staff_admin_official_exam_update',
        'staff_admin_queries','staff_admin_query_reply','staff_admin_query_set_status',
        'staff_admin_record_fee_payment','staff_admin_record_inventory_usage',
        'staff_admin_record_salary_payment','staff_admin_report_employees','staff_admin_report_fees',
        'staff_admin_report_fees_super_admin','staff_admin_report_inventory','staff_admin_report_payments',
        'staff_admin_report_students','staff_admin_report_tc_issued','staff_admin_salary_payments',
        'staff_admin_save_monthly_test_max_marks','staff_admin_save_school_rules',
        'staff_admin_section_list','staff_admin_send_attendance_reminder',
        'staff_admin_send_attendance_reminders','staff_admin_set_diagnostics_enabled',
        'staff_admin_student_add','staff_admin_student_delete_permanently','staff_admin_student_details',
        'staff_admin_student_update_basic','staff_admin_students','staff_admin_students_fees',
        'staff_admin_syllabus','staff_admin_syllabus_chapter_add','staff_admin_syllabus_chapter_delete',
        'staff_admin_syllabus_chapter_set_status','staff_admin_syllabus_edit_request_respond',
        'staff_admin_syllabus_edit_requests','staff_admin_task_create','staff_admin_task_delete',
        'staff_admin_task_update_status','staff_admin_tasks','staff_admin_teacher_documents',
        'staff_admin_user_create','staff_admin_user_delete','staff_admin_user_update',
        'staff_admin_users_list','staff_create_impersonation_code','staff_generate_punch_code',
        'redeem_qr_session'
      )
  LOOP
    v_new_def := regexp_replace(
      regexp_replace(r.def, 'p_employee_id uuid', 'p_employee_id uuid, p_session_token text', 1),
      'BEGIN', 'BEGIN' || chr(10) || '  IF NOT public.verify_mobile_session(''teacher'', p_employee_id, p_session_token) THEN RAISE EXCEPTION ''Not authorized''; END IF;' || chr(10), 1
    );
    EXECUTE v_new_def;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Patched % functions', v_count;
END;
$migration$;

-- ============================================================
-- Migration 2 of 2: req_sec_026_drop_old_unprotected_overloads
-- CREATE OR REPLACE with a different parameter list does NOT replace a
-- Postgres function - it creates a second overload alongside the
-- original (function identity includes the parameter signature). This
-- step drops every original signature (the ones still missing
-- p_session_token) for the same target list above - without this step,
-- the old vulnerable overloads stay fully callable side-by-side with the
-- new ones, i.e. the vulnerability would NOT actually be fixed by
-- migration 1 alone. Verified zero remaining unprotected overloads
-- after this ran.
-- ============================================================
DO $migration$
DECLARE
  r RECORD;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT oid, proname, pg_get_function_identity_arguments(oid) AS idargs
    FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN (
        'staff_admin_asset_checkout','staff_admin_asset_return','staff_admin_assets',
        'staff_admin_attendance_edit_request_respond','staff_admin_attendance_edit_requests',
        'staff_admin_attendance_overview','staff_admin_calendar_add_event',
        'staff_admin_calendar_delete_event','staff_admin_calendar_update_event',
        'staff_admin_class_attendance','staff_admin_class_list','staff_admin_classes',
        'staff_admin_current_academic_year','staff_admin_dashboard_summary',
        'staff_admin_diagnostic_reports','staff_admin_employee_add','staff_admin_employee_details',
        'staff_admin_employee_reset_password','staff_admin_employee_search','staff_admin_employee_update',
        'staff_admin_employees','staff_admin_exam_subject_max_marks_bulk',
        'staff_admin_exam_subject_max_marks_save','staff_admin_expense_add','staff_admin_expense_delete',
        'staff_admin_expenses','staff_admin_fee_structure_upsert','staff_admin_fee_structures',
        'staff_admin_get_diagnostics_enabled','staff_admin_gr_book','staff_admin_impersonation_log',
        'staff_admin_inventory_batch_add','staff_admin_inventory_item_add',
        'staff_admin_inventory_item_delete','staff_admin_inventory_items','staff_admin_issue_tc',
        'staff_admin_kiosk_attendance_report','staff_admin_kiosk_delete_special_day',
        'staff_admin_kiosk_get_settings','staff_admin_kiosk_list_special_days',
        'staff_admin_kiosk_save_settings','staff_admin_kiosk_save_special_day',
        'staff_admin_kiosk_set_pin','staff_admin_mark_attendance','staff_admin_mark_diagnostic_report',
        'staff_admin_monthly_test_marks','staff_admin_monthly_tests','staff_admin_notice_create',
        'staff_admin_notice_set_flags','staff_admin_notice_update','staff_admin_notices',
        'staff_admin_official_exam_create','staff_admin_official_exam_delete',
        'staff_admin_official_exam_marks_entered','staff_admin_official_exam_update',
        'staff_admin_queries','staff_admin_query_reply','staff_admin_query_set_status',
        'staff_admin_record_fee_payment','staff_admin_record_inventory_usage',
        'staff_admin_record_salary_payment','staff_admin_report_employees','staff_admin_report_fees',
        'staff_admin_report_fees_super_admin','staff_admin_report_inventory','staff_admin_report_payments',
        'staff_admin_report_students','staff_admin_report_tc_issued','staff_admin_salary_payments',
        'staff_admin_save_monthly_test_max_marks','staff_admin_save_school_rules',
        'staff_admin_section_list','staff_admin_send_attendance_reminder',
        'staff_admin_send_attendance_reminders','staff_admin_set_diagnostics_enabled',
        'staff_admin_student_add','staff_admin_student_delete_permanently','staff_admin_student_details',
        'staff_admin_student_update_basic','staff_admin_students','staff_admin_students_fees',
        'staff_admin_syllabus','staff_admin_syllabus_chapter_add','staff_admin_syllabus_chapter_delete',
        'staff_admin_syllabus_chapter_set_status','staff_admin_syllabus_edit_request_respond',
        'staff_admin_syllabus_edit_requests','staff_admin_task_create','staff_admin_task_delete',
        'staff_admin_task_update_status','staff_admin_tasks','staff_admin_teacher_documents',
        'staff_admin_user_create','staff_admin_user_delete','staff_admin_user_update',
        'staff_admin_users_list','staff_create_impersonation_code','staff_generate_punch_code',
        'redeem_qr_session'
      )
      AND pg_get_function_arguments(oid) NOT LIKE '%p_session_token%'
  LOOP
    EXECUTE format('DROP FUNCTION public.%I(%s)', r.proname, r.idargs);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Dropped % old unprotected overloads', v_count;
END;
$migration$;

-- Post-verification run after both migrations (2026-11-19): 101 live
-- function signatures across the target list, 100% with p_session_token
-- present, 0 remaining without it.
