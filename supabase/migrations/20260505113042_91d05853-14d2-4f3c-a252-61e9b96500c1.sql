-- Migration 1: demands.workspace
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS workspace TEXT
    NOT NULL DEFAULT 'cx'
    CHECK (workspace IN ('cx', 'tech'));

UPDATE demands SET workspace = 'cx' WHERE workspace IS NULL;

CREATE INDEX IF NOT EXISTS idx_demands_workspace
  ON demands(workspace);

COMMENT ON COLUMN demands.workspace IS
  'cx = demanda do CX Hub; tech = demanda do workspace TECH. Definido no momento da criação.';

-- Migration 2: tabela squads
CREATE TABLE squads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#7F77DD',
  active     BOOLEAN NOT NULL DEFAULT true,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_squads_active ON squads(active, position);

CREATE OR REPLACE FUNCTION update_squads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_squads_updated_at
  BEFORE UPDATE ON squads
  FOR EACH ROW EXECUTE FUNCTION update_squads_updated_at();

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squads_select" ON squads
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "squads_insert" ON squads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

CREATE POLICY "squads_update" ON squads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

CREATE POLICY "squads_delete" ON squads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

COMMENT ON TABLE squads IS
  'Squads globais do workspace TECH. Usados como raias no Kanban swimlane.';

-- Migration 3: tabela squad_members
CREATE TABLE squad_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id   UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('lead', 'member')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_squad_member UNIQUE (squad_id, user_id)
);

CREATE INDEX idx_squad_members_squad ON squad_members(squad_id);
CREATE INDEX idx_squad_members_user  ON squad_members(user_id);

ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squad_members_select" ON squad_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "squad_members_insert" ON squad_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

CREATE POLICY "squad_members_delete" ON squad_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

COMMENT ON TABLE squad_members IS
  'Membros de cada squad. UNIQUE por (squad_id, user_id).';

-- Migration 4: demands.squad_id FK
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS squad_id UUID
    REFERENCES squads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demands_squad
  ON demands(squad_id)
  WHERE squad_id IS NOT NULL;

COMMENT ON COLUMN demands.squad_id IS
  'FK nullable para squads. Define a raia do Kanban TECH. NULL = "Sem squad".';

-- Seed
INSERT INTO squads (name, color, position) VALUES
  ('Integrações', '#7F77DD', 1),
  ('Produto',     '#1D9E75', 2)
ON CONFLICT DO NOTHING;