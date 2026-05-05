-- A. Garantir demands.workspace (idempotente)
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'cx'
  CHECK (workspace IN ('cx','tech'));
UPDATE demands SET workspace = 'cx' WHERE workspace IS NULL;
CREATE INDEX IF NOT EXISTS idx_demands_workspace ON demands(workspace);
COMMENT ON COLUMN demands.workspace IS 'cx = demanda do CX Hub; tech = demanda do workspace TECH. Definido automaticamente no momento da criação pelo workspace ativo.';

-- B. demand_areas.workspace
ALTER TABLE demand_areas
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'both'
  CHECK (workspace IN ('cx','tech','both'));

UPDATE demand_areas
SET workspace = CASE
  WHEN LOWER(name) LIKE '%opera%' THEN 'cx'
  ELSE 'tech'
END;

CREATE INDEX IF NOT EXISTS idx_demand_areas_workspace
  ON demand_areas(workspace) WHERE active = true;
COMMENT ON COLUMN demand_areas.workspace IS 'Define em qual workspace a área aparece como raia: cx = só CX, tech = só TECH, both = ambos. Configurável em Settings → Áreas.';

-- C. Cleanup do 3-A
DROP INDEX IF EXISTS idx_demands_squad;
ALTER TABLE demands DROP COLUMN IF EXISTS squad_id;
DROP TABLE IF EXISTS squad_members CASCADE;
DROP TABLE IF EXISTS squads CASCADE;