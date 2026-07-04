-- ============================================================
-- Lab Manager — Full Database Schema
-- Paste this into Supabase SQL Editor and click Run
-- ============================================================

-- 1. profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  full_name           text,
  role                text DEFAULT 'member',
  can_assign_tasks    boolean DEFAULT false,
  can_approve_sporadic boolean DEFAULT false,
  can_edit_meetings   boolean DEFAULT false,
  can_view_finance    boolean DEFAULT false,
  can_edit_samples    boolean DEFAULT false,
  can_view_contacts   boolean DEFAULT false,
  can_add_members     boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);

-- 2. tasks_definitions (recurring checklist tasks)
CREATE TABLE IF NOT EXISTS tasks_definitions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  category           text DEFAULT 'MISC',
  frequency          text,
  response_type      text DEFAULT 'yes_no',
  sop_trigger        boolean DEFAULT false,
  conditional_text   text,
  group_name         text,
  sort_order         integer DEFAULT 0,
  status           text DEFAULT 'published',
  is_active        boolean GENERATED ALWAYS AS (status = 'published') STORED,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  recurrence_rule  jsonb,
  recurrence_anchor date
);

-- 3. task_assignments
CREATE TABLE IF NOT EXISTS task_assignments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_definition_id uuid REFERENCES tasks_definitions(id) ON DELETE CASCADE,
  assigned_to        uuid REFERENCES profiles(id),
  assigned_by        uuid REFERENCES profiles(id),
  cycle_start        date,
  cycle_end          date,
  status             text DEFAULT 'pending',
  created_at         timestamptz DEFAULT now()
);

-- 4. task_responses
CREATE TABLE IF NOT EXISTS task_responses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_definition_id   uuid REFERENCES tasks_definitions(id),
  assignment_id        uuid REFERENCES task_assignments(id),
  submitted_by         uuid REFERENCES auth.users(id),
  response             text,
  notes                text,
  photo_url            text,
  sop_photo_url        text,
  conditional_response text,
  responded_at         timestamptz DEFAULT now()
);

-- 5. sporadic_tasks (one-off tasks)
CREATE TABLE IF NOT EXISTS sporadic_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  category      text DEFAULT 'MISC',
  response_type text DEFAULT 'yes_no',
  assigned_to   uuid REFERENCES profiles(id),
  assigned_by   uuid REFERENCES profiles(id),
  due_date      date,
  status        text DEFAULT 'requested',
  file_url      text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 6. vacation_requests
CREATE TABLE IF NOT EXISTS vacation_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid REFERENCES profiles(id),
  start_date    date,
  end_date      date,
  leave_type    text,
  comments      text,
  status        text DEFAULT 'pending',
  reviewed_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- 7. lab_contacts
CREATE TABLE IF NOT EXISTS lab_contacts (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                      text,
  last_name                       text,
  full_name                       text GENERATED ALWAYS AS (TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))) STORED,
  role                            text DEFAULT 'member',
  title                           text,
  phone                           text,
  email                           text,
  alternative_email               text,
  address                         text,
  supervisor                      text,
  supervisor_email                text,
  emergency_contact_name          text,
  emergency_contact_phone         text,
  emergency_contact_email         text,
  emergency_contact_relationship  text,
  status                          text DEFAULT 'active',
  sort_order                      integer DEFAULT 99,
  notes                           text,
  updated_at                      timestamptz DEFAULT now()
);

-- 8. cell_lines
CREATE TABLE IF NOT EXISTS cell_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text,
  cell_type        text,
  passage_number   text,
  storage_location text,
  freezer          text,
  shelf            text,
  box              text,
  status           text DEFAULT 'present',
  notes            text,
  benchling_url    text,
  taken_by         uuid REFERENCES profiles(id),
  vials_available  integer,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 9. mouse_samples
CREATE TABLE IF NOT EXISTS mouse_samples (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id        text,
  mouse_id         text,
  tissue_type      text,
  collection_date  date,
  storage_location text,
  freezer          text,
  shelf            text,
  box              text,
  study            text,
  irb_protocol     text,
  status           text DEFAULT 'present',
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 10. human_samples
CREATE TABLE IF NOT EXISTS human_samples (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id        text,
  patient_id       text,
  tissue_type      text,
  collection_date  date,
  storage_location text,
  freezer          text,
  shelf            text,
  box              text,
  study            text,
  irb_protocol     text,
  status           text DEFAULT 'present',
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 11. sample_audit_log
CREATE TABLE IF NOT EXISTS sample_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   text,
  record_id    uuid,
  record_name  text,
  action       text,
  details      jsonb,
  performed_by uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

-- 12. auth_audit_log
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,          -- 'member_invited' | 'role_changed' | 'password_reset_requested' | 'failed_login'
  actor_id     uuid REFERENCES auth.users(id),
  actor_name   text,
  target_id    uuid,
  target_email text,
  details      jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_audit_log_event_type_idx ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx ON auth_audit_log(created_at DESC);
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
-- Authenticated users can insert (role changes, reset requests)
CREATE POLICY "auth_audit_log_insert" ON auth_audit_log FOR INSERT TO authenticated WITH CHECK (true);
-- Only admin/pm can read
CREATE POLICY "auth_audit_log_select" ON auth_audit_log FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'pm')));

-- 13. shared_reagents
CREATE TABLE IF NOT EXISTS shared_reagents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text,
  category         text,
  storage_location text,
  quantity         text,
  notes            text,
  updated_by       uuid REFERENCES profiles(id),
  updated_at       timestamptz DEFAULT now()
);

-- 13. lab_meetings
CREATE TABLE IF NOT EXISTS lab_meetings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date   date,
  presenter_id   uuid REFERENCES profiles(id),
  guest_name     text,
  guest_title    text,
  is_sof         boolean DEFAULT false,
  sof_topic      text,
  notes          text,
  status         text DEFAULT 'scheduled',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 14. adhoc_meetings
CREATE TABLE IF NOT EXISTS adhoc_meetings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date   date,
  presenter_id   uuid REFERENCES profiles(id),
  guest_name     text,
  guest_title    text,
  is_sof         boolean DEFAULT false,
  sof_topic      text,
  notes          text,
  status         text DEFAULT 'scheduled',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 15. compliance_tasks
CREATE TABLE IF NOT EXISTS compliance_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  section       text,
  response_type text DEFAULT 'yes_no',
  sop_trigger   boolean DEFAULT false,
  conditional_text text,
  sort_order    integer DEFAULT 0,
  status        text DEFAULT 'published',
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

-- 16. compliance_assignments
CREATE TABLE IF NOT EXISTS compliance_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid REFERENCES profiles(id),
  assigned_by uuid REFERENCES auth.users(id),
  sections    text[],
  cycle_start date,
  cycle_end   date,
  status      text DEFAULT 'pending',
  submitted_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- 17. compliance_responses
CREATE TABLE IF NOT EXISTS compliance_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES compliance_assignments(id) ON DELETE CASCADE,
  task_id       uuid REFERENCES compliance_tasks(id),
  response      text,
  photo_url     text,
  sop_photo_url text,
  created_at    timestamptz DEFAULT now()
);

-- 18. compliance_archives
CREATE TABLE IF NOT EXISTS compliance_archives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES compliance_assignments(id),
  archived_data jsonb,
  created_at    timestamptz DEFAULT now()
);

-- 19. compliance_studies
CREATE TABLE IF NOT EXISTS compliance_studies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_name        text,
  irb_number        text,
  irb_exception     boolean DEFAULT false,
  tissues_held      boolean DEFAULT false,
  ilab_exists       boolean DEFAULT false,
  ilab_link         text,
  team_members      text[],
  certificate_expiry date,
  certificate_url   text,
  benchling_url     text,
  notes             text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 20. task_occurrences (generated calendar instances, one per task × due-date)
CREATE TABLE IF NOT EXISTS task_occurrences (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_definition_id uuid REFERENCES tasks_definitions(id) ON DELETE CASCADE,
  due_date           date NOT NULL,
  status             text DEFAULT 'unassigned',  -- unassigned | assigned | done
  assigned_to        uuid REFERENCES profiles(id),
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  UNIQUE(task_definition_id, due_date)
);
CREATE INDEX IF NOT EXISTS task_occurrences_due_date_idx ON task_occurrences(due_date);
CREATE INDEX IF NOT EXISTS task_occurrences_task_idx ON task_occurrences(task_definition_id);

-- 21. assignment_rules (who covers which tasks, rotation config, date range)
CREATE TABLE IF NOT EXISTS assignment_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_definition_id uuid REFERENCES tasks_definitions(id) ON DELETE CASCADE,
  assignee_ids       uuid[] NOT NULL,   -- ordered array; rotation cycles through this order
  rotate_every       integer DEFAULT 1, -- rotate to next assignee after N instances
  start_date         date,
  end_date           date,              -- null = open-ended
  created_by         uuid REFERENCES auth.users(id),
  created_at         timestamptz DEFAULT now()
);

-- 22. lab_policies
CREATE TABLE IF NOT EXISTS lab_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text,
  category     text,
  document_url text,
  benchling_url text,
  review_date  date,
  notes        text,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ============================================================
-- Row Level Security — allow all authenticated users full access
-- (tighten per-table later if needed)
-- ============================================================

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'profiles','tasks_definitions','task_assignments','task_responses',
    'sporadic_tasks','vacation_requests','lab_contacts',
    'cell_lines','mouse_samples','human_samples','sample_audit_log','shared_reagents',
    'lab_meetings','adhoc_meetings',
    'compliance_tasks','compliance_assignments','compliance_responses','compliance_archives',
    'compliance_studies','task_occurrences','assignment_rules','lab_policies'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    BEGIN
      EXECUTE format(
        'CREATE POLICY "authenticated_full_access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- Trigger: auto-create profile row on new auth signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'member')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
