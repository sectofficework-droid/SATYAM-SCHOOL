-- ─────────────────────────────────────────────────────────────────────────────
-- Adds two new staff members, mirroring exactly what the admin panel's
-- "Add Employee" form would insert (employeeService.js mapToDB): emp_code
-- auto-continues from the current highest EMP0xx, app_password uses the
-- table's default ('Satyam@123' - same as every other staff member, so they
-- can log into the teacher app immediately with emp_code + that password
-- and change it later from the app's Settings screen).
--
-- Only name/type/designation/department are known, so phone, email, DOB,
-- gender, aadhar, pan and photo are left blank - fill those in via
-- Employee → Edit in the admin panel whenever convenient.
--
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Santoshini Panigrahi - Teacher
INSERT INTO employees (emp_code, name, type, designation, department, status, employment_type, joining_date)
SELECT
  'EMP' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(emp_code, '\D', '', 'g'), '')::INT), 0) + 1)::TEXT, 3, '0'),
  'Santoshini Panigrahi', 'teaching', 'Subject Teacher', NULL, 'Active', 'Permanent', CURRENT_DATE
FROM employees;

-- Jhumuri Dakua - Care Taker
INSERT INTO employees (emp_code, name, type, designation, department, status, employment_type, joining_date)
SELECT
  'EMP' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(emp_code, '\D', '', 'g'), '')::INT), 0) + 1)::TEXT, 3, '0'),
  'Jhumuri Dakua', 'non-teaching', 'Care Taker', 'Non-Teaching', 'Active', 'Permanent', CURRENT_DATE
FROM employees;
