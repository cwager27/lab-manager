-- 1. Move any existing "Reagent storage audit" task from MISC to PM monthly
UPDATE tasks_definitions
SET category = 'PM', frequency = 'monthly'
WHERE (title ILIKE '%reagent storage audit%' OR group_name ILIKE '%reagent storage audit%')
  AND category = 'MISC';

-- 2. Insert PM monthly "Reagent Storage Audit" task if it doesn't already exist
INSERT INTO tasks_definitions (category, frequency, group_name, title, sort_order, response_type, sop_trigger, conditional_text, status)
SELECT 'PM', 'monthly', 'Reagent Storage Audit',
  'All reagent storage boxes were audited this month: contents of each box were individually checked and confirmed per the monthly box audit protocol.',
  1, 'yes_no', false, '', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks_definitions
  WHERE title ILIKE '%reagent storage audit%' OR group_name ILIKE '%Reagent Storage Audit%'
);

-- 3. Rename "Reagents and Orders" subsection to "Lab Aliquots"
UPDATE tasks_definitions
SET group_name = 'Lab Aliquots'
WHERE group_name = 'Reagents and Orders';

-- 4. Enable generic conditional display for PM weekly Live Cell parent task
--    (questions 2–6 only appear when question 1 is answered Yes)
UPDATE tasks_definitions
SET conditional_text = 'on_yes'
WHERE group_name = 'Lab SOP for Live Cell Materials'
  AND response_type = 'yes_no'
  AND frequency = 'weekly'
  AND category = 'PM';

-- 5. Same for the longer-named Live Cell group if it exists in the DB
UPDATE tasks_definitions
SET conditional_text = 'on_yes'
WHERE group_name = 'Lab SOP for Live Cell Materials Entering Tissue Culture for the First Time'
  AND response_type = 'yes_no';
