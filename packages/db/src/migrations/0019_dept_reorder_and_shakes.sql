-- Migration: Reorder POS departments and add Shakes category
-- Requested order: Beef, Chicken, Duck, Fish, Meat, Mutton, Sides, Veg,
--                  Beverages, Local Juice, Shakes (new), Snacks, Pastry, Specials, Boxes

-- 1. Rename departments to match requested names
UPDATE reporting_category SET name = 'Veg'    WHERE id = 'd1000000-0000-4000-8000-000000000006';
UPDATE reporting_category SET name = 'Pastry' WHERE id = 'd1000000-0000-4000-8000-000000000008';

-- 2. Resequence sort_order
UPDATE reporting_category SET sort_order = 1  WHERE id = 'd1000000-0000-4000-8000-000000000003'; -- Beef
UPDATE reporting_category SET sort_order = 2  WHERE id = 'd1000000-0000-4000-8000-000000000001'; -- Chicken
UPDATE reporting_category SET sort_order = 3  WHERE id = 'd1000000-0000-4000-8000-000000000004'; -- Duck
UPDATE reporting_category SET sort_order = 4  WHERE id = 'd1000000-0000-4000-8000-000000000002'; -- Fish
UPDATE reporting_category SET sort_order = 5  WHERE id = 'd1000000-0000-4000-8000-00000000000d'; -- Meat
UPDATE reporting_category SET sort_order = 6  WHERE id = 'd1000000-0000-4000-8000-000000000005'; -- Mutton
UPDATE reporting_category SET sort_order = 7  WHERE id = 'd1000000-0000-4000-8000-00000000000b'; -- Sides
UPDATE reporting_category SET sort_order = 8  WHERE id = 'd1000000-0000-4000-8000-000000000006'; -- Veg
UPDATE reporting_category SET sort_order = 9  WHERE id = 'd1000000-0000-4000-8000-00000000000a'; -- Beverages
UPDATE reporting_category SET sort_order = 10 WHERE id = 'd1000000-0000-4000-8000-00000000000c'; -- Local Juice
-- Shakes will be 11 (inserted below)
UPDATE reporting_category SET sort_order = 12 WHERE id = 'd1000000-0000-4000-8000-000000000009'; -- Snacks
UPDATE reporting_category SET sort_order = 13 WHERE id = 'd1000000-0000-4000-8000-000000000008'; -- Pastry
UPDATE reporting_category SET sort_order = 14 WHERE id = 'd1000000-0000-4000-8000-000000000007'; -- Specials
UPDATE reporting_category SET sort_order = 15 WHERE id = 'd1000000-0000-4000-8000-00000000000e'; -- Boxes

-- 3. Create Shakes department (borrow org_id from Local Juice)
INSERT INTO reporting_category (id, organization_id, name, sort_order, is_active, pin_protected)
SELECT
  'd1000000-0000-4000-8000-00000000000f',
  organization_id,
  'Shakes',
  11,
  true,
  false
FROM reporting_category
WHERE id = 'd1000000-0000-4000-8000-00000000000c'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 4. Assign Shakes to the Beverage & Pickup POS register
INSERT INTO register_department (register_id, department_id)
VALUES (
  'c0000000-0000-4000-8000-000000000003',
  'd1000000-0000-4000-8000-00000000000f'
)
ON CONFLICT DO NOTHING;

-- 5. Move shake products from Local Juice → Shakes
UPDATE product
SET reporting_category_id = 'd1000000-0000-4000-8000-00000000000f'
WHERE id IN (
  '94fe9872-b1ba-4844-b046-4528f4ece9a3',
  '61592da0-4037-43a5-9767-6206c8709a47',
  '9e9c70f0-842a-40ba-b716-af24908b973e'
);
