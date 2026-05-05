-- Migration 1: default_workspace em user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS default_workspace TEXT
    NOT NULL DEFAULT 'cx'
    CHECK (default_workspace IN ('cx', 'tech', 'both'));

UPDATE user_profiles
SET default_workspace = 'cx'
WHERE default_workspace IS NULL;

COMMENT ON COLUMN user_profiles.default_workspace IS
  'Workspace padrão do usuário: cx = CX Hub, tech = Workspace TECH, both = vê os dois com switcher';

-- Migration 2: agenda_type em meeting_agendas
ALTER TABLE meeting_agendas
  ADD COLUMN IF NOT EXISTS agenda_type TEXT
    NOT NULL DEFAULT 'client'
    CHECK (agenda_type IN ('client', 'internal'));

UPDATE meeting_agendas
SET agenda_type = 'client'
WHERE agenda_type IS NULL;

COMMENT ON COLUMN meeting_agendas.agenda_type IS
  'client = pauta de reunião com cliente (CX); internal = pauta interna do time (TECH)';

CREATE INDEX IF NOT EXISTS idx_meeting_agendas_type
  ON meeting_agendas(agenda_type);

-- Migration 3: source_demand_id em demands
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS source_demand_id UUID
    REFERENCES demands(id) ON DELETE SET NULL;

COMMENT ON COLUMN demands.source_demand_id IS
  'FK self-reference: task TECH originada de uma demanda de cliente. Nullable.';