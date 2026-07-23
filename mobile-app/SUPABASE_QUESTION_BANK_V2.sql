-- Adds an exam/assignment date to a generated paper (shown on the PDF
-- header along with the day of week, which is derived client-side from
-- this date - no separate day column needed). Run after
-- SUPABASE_QUESTION_BANK.sql.

ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS exam_date DATE;
