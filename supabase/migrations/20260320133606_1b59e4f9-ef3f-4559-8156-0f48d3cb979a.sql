
-- Drop old FK pointing to demand_assignees
ALTER TABLE demands DROP CONSTRAINT IF EXISTS demands_assignee_id_fkey;

-- Add new FK pointing to user_profiles
ALTER TABLE demands 
  ADD CONSTRAINT demands_assignee_id_user_profiles_fkey 
  FOREIGN KEY (assignee_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Nullify any assignee_id that doesn't exist in user_profiles (orphaned refs to demand_assignees)
UPDATE demands
SET assignee_id = NULL
WHERE assignee_id IS NOT NULL
  AND assignee_id NOT IN (SELECT id FROM user_profiles);
