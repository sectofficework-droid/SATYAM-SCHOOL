-- ─────────────────────────────────────────────────────────────────────────────
-- Replaces placeholder exam dates (set in SUPABASE_ADD_HALF_YEARLY_ANNUAL_EXAMS.sql)
-- with the real, user-confirmed dates for academic year 2026-27:
--   First Unit Test   : 16 Sep 2026 - 24 Sep 2026  (was 1-3 Aug 2026 - corrected)
--   Half Yearly Exam  : 27 Nov 2026 - 5 Dec 2026    (was a placeholder)
--   Annual Exam       : 11 Mar 2027 - 19 Mar 2027   (was a placeholder)
--
-- Also replaces the Year Planning calendar's "(TBC)" placeholder entries
-- with real ones, and adds a First Unit Test calendar block that never
-- existed before (the original "ANNUAL PLANNING" PDF transcription had no
-- exam-colored cells at all - see yearPlanData.js's header comment).
--
-- Real-calendar conflicts found and left as-is (not mine to resolve -
-- flagged to the user instead):
--   - 24 Sep 2026 (First Unit Test's last day) coincides with "Ganpati
--     Visarjan", a govt holiday already on the calendar.
--   - 22 Sep 2026 (within First Unit Test) coincides with "Navratri Starts"
--     (celebration).
--   - 28 Nov 2026 (within Half Yearly Exam) coincides with "One Minute's
--     Speech" (celebration).
--
-- Run in Supabase Dashboard -> SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE official_exams SET start_date='2026-09-16', end_date='2026-09-24', updated_at=now()
  WHERE name='First Unit Test'  AND academic_year_id=(SELECT id FROM academic_years WHERE is_current=true);
UPDATE official_exams SET start_date='2026-11-27', end_date='2026-12-05', updated_at=now()
  WHERE name='Half Yearly Exam' AND academic_year_id=(SELECT id FROM academic_years WHERE is_current=true);
UPDATE official_exams SET start_date='2027-03-11', end_date='2027-03-19', updated_at=now()
  WHERE name='Annual Exam'      AND academic_year_id=(SELECT id FROM academic_years WHERE is_current=true);

DELETE FROM school_calendar_events WHERE title IN ('Half Yearly Exam (TBC)', 'Annual Exam (TBC)');

INSERT INTO school_calendar_events (event_date, title, category, icon, applies_to_classes)
SELECT d::date, 'First Unit Test', 'exam', NULL, NULL::text[]
FROM generate_series('2026-09-16'::date, '2026-09-24'::date, interval '1 day') d
UNION ALL
SELECT d::date, 'Half Yearly Exam', 'exam', NULL, NULL::text[]
FROM generate_series('2026-11-27'::date, '2026-12-05'::date, interval '1 day') d
UNION ALL
SELECT d::date, 'Annual Exam', 'exam', NULL, NULL::text[]
FROM generate_series('2027-03-11'::date, '2027-03-19'::date, interval '1 day') d;
