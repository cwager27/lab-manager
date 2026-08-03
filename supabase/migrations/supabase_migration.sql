-- ── STEP 1: Add new columns ──────────────────────────────────────────
ALTER TABLE tasks_definitions
  ADD COLUMN IF NOT EXISTS group_name TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

ALTER TABLE task_responses
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE sporadic_tasks
  ADD COLUMN IF NOT EXISTS notes TEXT;
