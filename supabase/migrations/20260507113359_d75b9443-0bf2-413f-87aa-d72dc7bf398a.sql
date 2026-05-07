-- Migration 1: projects.is_internal
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

UPDATE projects
SET is_internal = true
WHERE client_id IS NULL AND is_internal = false;

COMMENT ON COLUMN projects.is_internal IS
  'true = projeto interno (uMode). client_id deve ser NULL. Exibe badge "Interno" na UI.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_internal_no_client'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT chk_internal_no_client
      CHECK (NOT (is_internal = true AND client_id IS NOT NULL));
  END IF;
END $$;

-- Migration 2: RLS select sem filtro de workspace
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  is_project_accessible(id)
);

-- Migration 3: comentário informativo
COMMENT ON COLUMN projects.workspace IS
  'Workspace de origem do projeto (cx ou tech). Apenas informativo — projetos são visíveis em ambos os workspaces.';