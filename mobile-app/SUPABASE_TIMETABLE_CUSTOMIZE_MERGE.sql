-- ─────────────────────────────────────────────────────────────────────────────
-- Timetable: fully customizable day groups + Merge Classes.
--
-- 1. merged_with - for a merged cell, the *other* class name(s) sharing this
--    exact subject+teacher+slot. Merging class A with class B writes one row
--    for A with merged_with = ['B'] and one row for B with merged_with =
--    ['A'] (symmetric, so either class's own timetable view can show "merged
--    with X" without a join).
--
-- 2. day_group_weekdays - { groupName: [weekday, ...] }. Until now, "which
--    weekdays use this day group's periods" was never actually stored
--    anywhere - both apps just assumed exactly 3 groups named "Mon – Wed",
--    "Thu – Fri", "Saturday" and inferred the weekdays from the NAME itself.
--    That breaks once an admin can rename/add/remove groups freely, so this
--    makes the mapping an explicit, editable fact instead of a hardcoded
--    assumption. Seeded to match today's exact hardcoded behavior, so
--    nothing changes for any school until the new admin UI is actually used.
--
-- period_defs (school_profile, existing JSONB {groupName: [slot,...]}) needs
-- NO migration - it already supports arbitrary keys/counts; the 3-group
-- limit was purely in the admin panel's own code, not the data model.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE timetables ADD COLUMN IF NOT EXISTS merged_with TEXT[];

ALTER TABLE school_profile ADD COLUMN IF NOT EXISTS day_group_weekdays JSONB;

UPDATE school_profile SET day_group_weekdays = '{
  "Mon – Wed": ["Monday","Tuesday","Wednesday"],
  "Thu – Fri": ["Thursday","Friday"],
  "Saturday": ["Saturday"]
}'::jsonb
WHERE day_group_weekdays IS NULL;
