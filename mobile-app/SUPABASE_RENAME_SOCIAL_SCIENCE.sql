-- ─────────────────────────────────────────────────────────────────────────────
-- Renames "Social Studies" → "Social Science" everywhere it's already been
-- saved as free text (dropdown lists in the app/admin code were updated
-- separately - this migrates existing rows so old records match the new
-- label too). Every table below is optional-safe: skipped if it doesn't
-- exist yet on this project.
-- Run this in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.timetables') IS NOT NULL THEN
    UPDATE timetables SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.syllabus') IS NOT NULL THEN
    UPDATE syllabus SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.syllabus_edit_requests') IS NOT NULL THEN
    UPDATE syllabus_edit_requests SET subject_name = 'Social Science' WHERE subject_name = 'Social Studies';
  END IF;

  IF to_regclass('public.question_bank') IS NOT NULL THEN
    UPDATE question_bank SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.question_papers') IS NOT NULL THEN
    UPDATE question_papers SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.homework') IS NOT NULL THEN
    UPDATE homework SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.exams') IS NOT NULL THEN
    UPDATE exams SET subject = 'Social Science' WHERE subject = 'Social Studies';
  END IF;

  IF to_regclass('public.official_exam_subject_config') IS NOT NULL THEN
    UPDATE official_exam_subject_config SET subject_name = 'Social Science' WHERE subject_name = 'Social Studies';
  END IF;

  IF to_regclass('public.official_exam_marks') IS NOT NULL THEN
    UPDATE official_exam_marks SET subject_name = 'Social Science' WHERE subject_name = 'Social Studies';
  END IF;

  IF to_regclass('public.class_subjects') IS NOT NULL THEN
    UPDATE class_subjects SET subject_name = 'Social Science' WHERE subject_name = 'Social Studies';
  END IF;

  -- employees.subject_mappings is a JSONB array of {subject, classes} objects.
  IF to_regclass('public.employees') IS NOT NULL THEN
    UPDATE employees
    SET subject_mappings = (
      SELECT jsonb_agg(
        CASE WHEN elem->>'subject' = 'Social Studies'
             THEN jsonb_set(elem, '{subject}', '"Social Science"')
             ELSE elem
        END
      )
      FROM jsonb_array_elements(subject_mappings) elem
    )
    WHERE subject_mappings::text LIKE '%Social Studies%';
  END IF;
END $$;
