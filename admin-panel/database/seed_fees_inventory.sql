-- ============================================================
-- SEED: inventory_items + fee_structures
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── 1. Inventory Items ──────────────────────────────────────
INSERT INTO inventory_items (name, category, unit)
VALUES
  ('Bag',           'student', 'Piece'),
  ('Uniform Set',   'student', 'Set'),
  ('Book Set',      'student', 'Set'),
  ('Notebook Set',  'student', 'Set'),
  ('ID Card',       'student', 'Piece'),
  ('School Diary',  'student', 'Piece')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Fee Structures — 2025-26 ────────────────────────────
INSERT INTO fee_structures (academic_year_id, class_id, tuition_amount, uniform_amount, old_student_discount)
SELECT
  ay.id,
  c.id,
  v.tuition,
  0,
  1000
FROM academic_years ay
CROSS JOIN (VALUES
  ('JR.KG',           14000),
  ('SR.KG',           14000),
  ('Balvatika',       14500),
  ('1st',             15000),
  ('2nd',             15200),
  ('3rd',             15400),
  ('4th',             15700),
  ('5th',             16000),
  ('6th',             16300),
  ('7th',             16500),
  ('8th',             16800),
  ('9th',             17000),
  ('10th',            17500),
  ('11th - Commerce', 18500),
  ('12th - Commerce', 18500)
) AS v(class_name, tuition)
JOIN classes c ON c.name = v.class_name
WHERE ay.label = '2025-26'
ON CONFLICT (academic_year_id, class_id) DO NOTHING;

-- ── 3. Fee Structures — 2026-27 ────────────────────────────
INSERT INTO fee_structures (academic_year_id, class_id, tuition_amount, uniform_amount, old_student_discount)
SELECT
  ay.id,
  c.id,
  v.tuition,
  0,
  1000
FROM academic_years ay
CROSS JOIN (VALUES
  ('JR.KG',           14500),
  ('SR.KG',           14500),
  ('Balvatika',       15000),
  ('1st',             15500),
  ('2nd',             15700),
  ('3rd',             15900),
  ('4th',             16200),
  ('5th',             16500),
  ('6th',             16800),
  ('7th',             17000),
  ('8th',             17300),
  ('9th',             17500),
  ('10th',            18000),
  ('11th - Commerce', 19000),
  ('12th - Commerce', 19000)
) AS v(class_name, tuition)
JOIN classes c ON c.name = v.class_name
WHERE ay.label = '2026-27'
ON CONFLICT (academic_year_id, class_id) DO NOTHING;
