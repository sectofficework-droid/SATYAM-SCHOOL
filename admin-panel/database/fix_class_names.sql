-- Fix class names to match app format
-- Run this once in Supabase SQL Editor

UPDATE classes SET name = 'JR.KG'          WHERE name = 'JR KG';
UPDATE classes SET name = 'SR.KG'          WHERE name = 'SR KG';
UPDATE classes SET name = '11th - Commerce' WHERE name = '11th Commerce';
UPDATE classes SET name = '12th - Commerce' WHERE name = '12th Commerce';
