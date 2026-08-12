-- The admin panel's Question Papers screen used to require picking a
-- teacher first (whose private question_bank to pull from) before Class/
-- Subject - in practice admin doesn't reliably know which teacher owns
-- which class+subject, so that step is being replaced with Class -> Subject
-- dropdowns that search question_bank across every teacher. A generated
-- paper is therefore no longer tied to one teacher (it may pull questions
-- contributed by several), so question_papers.teacher_id - previously
-- required - is now optional metadata instead of being dropped outright,
-- since existing rows and the FK to employees are still worth keeping.
-- Run after SUPABASE_QUESTION_BANK.sql / SUPABASE_QUESTION_BANK_V2.sql.

ALTER TABLE question_papers ALTER COLUMN teacher_id DROP NOT NULL;
