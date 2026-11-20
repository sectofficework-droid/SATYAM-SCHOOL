-- Tech-debt cleanup from the 2026-11 full-system audit's "still open" list
-- (TODO.md's non-checkbox tail: "Live Supabase performance advisories ...
-- 45 unindexed foreign keys"). Supabase's live performance advisor flagged
-- 55 foreign keys with no covering index. Purely additive - no behavior
-- change, just query-plan speedups on joins/deletes through these columns.
-- Applied live via Supabase MCP 2026-11-20.
--
-- 3 of the original 55 are deliberately NOT indexed here:
-- timetable_entries_section_id_fkey, timetable_entries_teacher_id_fkey,
-- users_role_id_fkey - all on tables CLAUDE.md documents as known-unused
-- legacy drift (`users`/`timetable_entries`, superseded by `timetables`).
-- No point indexing dead tables.

CREATE INDEX IF NOT EXISTS idx_asset_checkouts_asset_id ON public.asset_checkouts (asset_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_marked_by ON public.employee_attendance (marked_by);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON public.employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_punch_codes_employee_id ON public.employee_punch_codes (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_subject_mappings_class_id ON public.employee_subject_mappings (class_id);
CREATE INDEX IF NOT EXISTS idx_employee_subject_mappings_employee_id ON public.employee_subject_mappings (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_class_teacher_of_section_id ON public.employees (class_teacher_of_section_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_entered_by ON public.exam_marks (entered_by);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student_id ON public.exam_marks (student_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON public.exams (created_by);
CREATE INDEX IF NOT EXISTS idx_fee_payments_enrollment_id ON public.fee_payments (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON public.fee_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_class_id ON public.fee_structures (class_id);
CREATE INDEX IF NOT EXISTS idx_homework_created_by ON public.homework (created_by);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_log_code_id ON public.impersonation_audit_log (code_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_audit_log_created_by ON public.impersonation_audit_log (created_by);
CREATE INDEX IF NOT EXISTS idx_impersonation_codes_created_by ON public.impersonation_codes (created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON public.inventory_batches (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reset_backups_created_by ON public.inventory_reset_backups (created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_usages_item_id ON public.inventory_usages (item_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_qr_sessions_employee_id ON public.kiosk_qr_sessions (employee_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_special_day_overrides_created_by ON public.kiosk_special_day_overrides (created_by);
CREATE INDEX IF NOT EXISTS idx_notebook_log_marked_by ON public.notebook_log (marked_by);
CREATE INDEX IF NOT EXISTS idx_official_exam_marks_entered_by ON public.official_exam_marks (entered_by);
CREATE INDEX IF NOT EXISTS idx_official_exam_marks_student_id ON public.official_exam_marks (student_id);
CREATE INDEX IF NOT EXISTS idx_official_exams_academic_year_id ON public.official_exams (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_question_paper_items_question_id ON public.question_paper_items (question_id);
CREATE INDEX IF NOT EXISTS idx_question_papers_teacher_id ON public.question_papers (teacher_id);
CREATE INDEX IF NOT EXISTS idx_section_supporting_teachers_employee_id ON public.section_supporting_teachers (employee_id);
CREATE INDEX IF NOT EXISTS idx_student_admin_notes_updated_by ON public.student_admin_notes (updated_by);
CREATE INDEX IF NOT EXISTS idx_student_attendance_marked_by ON public.student_attendance (marked_by);
CREATE INDEX IF NOT EXISTS idx_student_daily_log_marked_by ON public.student_daily_log (marked_by);
CREATE INDEX IF NOT EXISTS idx_student_document_followups_updated_by ON public.student_document_followups (updated_by);
CREATE INDEX IF NOT EXISTS idx_student_documents_document_type_id ON public.student_documents (document_type_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_admission_class_id ON public.student_enrollments (admission_class_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_id ON public.student_enrollments (class_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_section_id ON public.student_enrollments (section_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student_id ON public.student_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_student_import_phases_created_by ON public.student_import_phases (created_by);
CREATE INDEX IF NOT EXISTS idx_student_inventory_assignments_item_id ON public.student_inventory_assignments (item_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_from_enrollment_id ON public.student_promotions (from_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id ON public.student_promotions (student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_to_enrollment_id ON public.student_promotions (to_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_remarks_academic_year_id ON public.student_remarks (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_reminders_resolved_by ON public.student_reminders (resolved_by);
CREATE INDEX IF NOT EXISTS idx_student_reminders_updated_by ON public.student_reminders (updated_by);
CREATE INDEX IF NOT EXISTS idx_student_risk_flags_acknowledged_by ON public.student_risk_flags (acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_student_siblings_student_id ON public.student_siblings (student_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_teacher_id ON public.syllabus (teacher_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_employee_id ON public.task_assignees (employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_transfer_certificates_student_id ON public.transfer_certificates (student_id);
