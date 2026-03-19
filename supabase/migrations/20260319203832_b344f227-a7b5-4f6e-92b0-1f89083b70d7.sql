-- Permitir que qualquer autenticado leia perfis ativos (necessário para dropdown de responsável)
CREATE POLICY user_profiles_select_active ON user_profiles
  FOR SELECT TO authenticated
  USING (active = true);

-- Nullify assignee_id onde o UUID aponta para demand_assignees (não existe em user_profiles)
UPDATE demands
SET assignee_id = NULL
WHERE assignee_id IS NOT NULL
  AND assignee_id NOT IN (SELECT id FROM user_profiles);