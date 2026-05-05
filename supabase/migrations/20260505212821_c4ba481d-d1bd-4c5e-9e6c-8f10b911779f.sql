-- Migration 1: demand_collaborators
CREATE TABLE demand_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id   UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  added_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_demand_collaborator UNIQUE (demand_id, user_id)
);

CREATE INDEX idx_demand_collaborators_demand ON demand_collaborators(demand_id);
CREATE INDEX idx_demand_collaborators_user   ON demand_collaborators(user_id);

ALTER TABLE demand_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_collaborators_select" ON demand_collaborators FOR SELECT USING (
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  )
);

CREATE POLICY "demand_collaborators_insert" ON demand_collaborators FOR INSERT
  WITH CHECK (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY "demand_collaborators_delete" ON demand_collaborators FOR DELETE
  USING (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

COMMENT ON TABLE demand_collaborators IS
  'Colaboradores secundarios de uma demanda. Owner principal continua em demands.assignee_id. Subdemandas (demand_tasks) nao tem colaboradores.';


-- Migration 2: blocker_types
CREATE TABLE blocker_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#E24B4A',
  icon       TEXT NOT NULL DEFAULT '🔒',
  active     BOOLEAN NOT NULL DEFAULT true,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_blocker_types_active ON blocker_types(active, position);

ALTER TABLE blocker_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocker_types_select" ON blocker_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "blocker_types_insert" ON blocker_types FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND global_role = 'admin'
  ));

CREATE POLICY "blocker_types_update" ON blocker_types FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND global_role = 'admin'
  ));

CREATE POLICY "blocker_types_delete" ON blocker_types FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND global_role = 'admin'
  ));

INSERT INTO blocker_types (name, color, icon, position) VALUES
  ('Aguardando cliente',     '#EF9F27', '⏳', 1),
  ('Dependência técnica',    '#378ADD', '🔗', 2),
  ('Infra / Ambiente',       '#7F77DD', '⚙️', 3),
  ('Aguardando decisão',     '#E24B4A', '❓', 4),
  ('Dependência externa',    '#1D9E75', '🌐', 5)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE blocker_types IS
  'Categorias de bloqueio configuraveis pelo admin em Settings - Bloqueios.';


-- Migration 3: demands.blocker_type_id
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS blocker_type_id UUID
    REFERENCES blocker_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demands_blocker_type
  ON demands(blocker_type_id)
  WHERE blocker_type_id IS NOT NULL;

COMMENT ON COLUMN demands.blocker_type_id IS
  'Categoria do bloqueio. blocker_reason continua para texto livre complementar.';