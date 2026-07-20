-- ─────────────────────────────────────────────────────────────────────────────
-- Add "Exam" as its own notice type, distinct from general "Academic" notices.
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_type_check;
ALTER TABLE notices ADD CONSTRAINT notices_type_check
  CHECK (type IN ('Academic','Exam','Event','Holiday','Fee','Circular','General','Urgent'));
