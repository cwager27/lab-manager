-- 1. Reagent Check: add SOP trigger so No answer expands the exception form
UPDATE tasks_definitions
SET sop_trigger = true
WHERE group_name = 'Reagent Check'
  AND category = 'PM'
  AND frequency = 'monthly';

-- 2. Move Human Sample Logging from MISC to PM monthly
UPDATE tasks_definitions
SET category = 'PM'
WHERE group_name = 'Human Sample Logging'
  AND category = 'MISC';

-- 3. Add gate question for Human Sample Logging (if not already present)
INSERT INTO tasks_definitions (category, frequency, group_name, title, sort_order, response_type, sop_trigger, conditional_text, status)
SELECT 'PM', 'monthly', 'Human Sample Logging',
  'New human samples entered the lab over the past month.',
  47, 'yes_no', false, 'on_yes', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks_definitions
  WHERE group_name = 'Human Sample Logging' AND conditional_text = 'on_yes'
);

-- 4. Move Other Samples from MISC to PM monthly
UPDATE tasks_definitions
SET category = 'PM'
WHERE group_name = 'Other Samples Received by Collaborators'
  AND category = 'MISC';

-- 5. Shift existing Other Samples sort_orders up by 1 to make room for gate at 51
UPDATE tasks_definitions
SET sort_order = sort_order + 1
WHERE group_name = 'Other Samples Received by Collaborators'
  AND conditional_text != 'on_yes'
  AND NOT EXISTS (
    SELECT 1 FROM tasks_definitions t2
    WHERE t2.group_name = 'Other Samples Received by Collaborators' AND t2.conditional_text = 'on_yes'
  );

-- 6. Add gate question for Other Samples (if not already present)
INSERT INTO tasks_definitions (category, frequency, group_name, title, sort_order, response_type, sop_trigger, conditional_text, status)
SELECT 'PM', 'monthly', 'Other Samples Received by Collaborators',
  'New biological specimens (not human) entered the lab over the past month.',
  51, 'yes_no', false, 'on_yes', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM tasks_definitions
  WHERE group_name = 'Other Samples Received by Collaborators' AND conditional_text = 'on_yes'
);
