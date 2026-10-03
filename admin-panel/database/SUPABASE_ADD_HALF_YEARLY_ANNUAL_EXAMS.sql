-- ─────────────────────────────────────────────────────────────────────────────
-- Adds "Half Yearly Exam" and "Annual Exam" as official exams for academic
-- year 2026-27, alongside the existing "First Unit Test". Without this, the
-- Documents -> Marksheet feature only ever showed Unit Test, because the
-- marksheet code is fully dynamic (reads whatever's in official_exams for
-- the current year via marksheetService.getCurrentOfficialExams()) - it
-- isn't a code bug, Half Yearly/Annual simply didn't exist as records yet.
--
-- Also fills in official_exam_subject_config max-marks (100, matching First
-- Unit Test's existing values) for every real class/subject, for ALL THREE
-- exams - First Unit Test itself was only configured for 1 of 12 classes
-- (JR.KG) before this, so its own marksheet was incomplete too. Existing
-- rows are left untouched (ON CONFLICT DO NOTHING) - nothing already
-- entered is overwritten.
--
-- Placeholder dates (editable in Settings -> Exams once the real school
-- calendar is finalized):
--   Half Yearly Exam: 2026-10-05 to 2026-10-10
--   Annual Exam:       2027-03-01 to 2027-03-07
-- Marks entry for an official exam unlocks the day AFTER its end_date
-- (examService.isExamUnlocked) - so both new exams show as locked in the
-- marksheet's exam picker until their real dates are set and pass.
--
-- Does NOT enter any actual marks - that's still the teachers' normal
-- workflow from the mobile app, unchanged by this migration.
--
-- Idempotent on the subject-config insert (ON CONFLICT DO NOTHING); the
-- official_exams insert is NOT idempotent - only run once. Run in Supabase
-- Dashboard -> SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO official_exams (name, start_date, end_date, academic_year_id, sort_order)
SELECT 'Half Yearly Exam', '2026-10-05', '2026-10-10', ay.id, 1
FROM academic_years ay WHERE ay.is_current = true
UNION ALL
SELECT 'Annual Exam', '2027-03-01', '2027-03-07', ay.id, 2
FROM academic_years ay WHERE ay.is_current = true;

INSERT INTO official_exam_subject_config (exam_id, class_name, subject_name, max_marks)
SELECT oe.id, cs.class_name, cs.subject_name, 100
FROM official_exams oe
JOIN academic_years ay ON ay.id = oe.academic_year_id AND ay.is_current = true
CROSS JOIN (
  SELECT DISTINCT class_name, subject_name FROM class_subjects WHERE class_name <> 'ADMIN QA'
) cs
ON CONFLICT (exam_id, class_name, subject_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Year Planning calendar (Settings -> Year Planning, school_calendar_events)
-- is a SEPARATE table from official_exams above, and is normally a faithful
-- transcription of the school's real "ANNUAL PLANNING 2026-27" PDF (see
-- admin-panel/src/lib/yearPlanData.js's own header comment) - it
-- deliberately had zero "Exam" category entries before this, since the real
-- PDF doesn't show exam dates yet either. Added here ONLY on the user's
-- explicit request, for visual consistency with the placeholder dates
-- above - titled "(TBC)" so nobody mistakes these for real transcribed
-- dates. DELETE these two blocks (by title) once the real dates are known,
-- then re-add with the real dates so the calendar goes back to being an
-- accurate record.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO school_calendar_events (event_date, title, category, icon, applies_to_classes)
SELECT d::date, 'Half Yearly Exam (TBC)', 'exam', NULL, NULL::text[]
FROM generate_series('2026-10-05'::date, '2026-10-10'::date, interval '1 day') d
UNION ALL
SELECT d::date, 'Annual Exam (TBC)', 'exam', NULL, NULL::text[]
FROM generate_series('2027-03-01'::date, '2027-03-07'::date, interval '1 day') d;
